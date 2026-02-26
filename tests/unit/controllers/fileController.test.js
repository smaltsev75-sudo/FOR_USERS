/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

// Mock dependencies before importing
jest.unstable_mockModule('../../../js/services/message.js', () => ({
    messageService: {
        showMessage: jest.fn(),
        showConfirm: jest.fn((text, onConfirm) => onConfirm()) // auto-confirm
    }
}));

jest.unstable_mockModule('../../../js/services/storage.js', () => ({
    storageService: {
        saveFile: jest.fn(),
        loadFile: jest.fn()
    }
}));

jest.unstable_mockModule('../../../js/state/persistence.js', () => ({
    migratePersistedState: jest.fn((data) => ({ ...data, tasks: data.tasks || [] })),
    serializeStateForStorage: jest.fn((state) => ({ ...state, version: 12 }))
}));

const { FileController } = await import('../../../js/controllers/fileController.js');
const { messageService } = await import('../../../js/services/message.js');
const { storageService } = await import('../../../js/services/storage.js');
const { serializeStateForStorage, migratePersistedState } = await import('../../../js/state/persistence.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function createStore(tasks = []) {
    const state = { tasks, config: {}, roles: [], criteria: [], numberFormatSettings: { decimalSeparator: ',' } };
    return {
        getState: jest.fn(() => state),
        loadState: jest.fn()
    };
}

function createCriteriaManager(criteria = []) {
    return {
        getCriteria: jest.fn(() => criteria),
        loadCriteria: jest.fn(),
        loadDefaultCriteria: jest.fn()
    };
}

const nfs = {
    decimalSeparator: ',',
    saveSettings: jest.fn()
};

function createDom() {
    document.body.innerHTML = `
        <button id="saveDataBtn"></button>
        <button id="loadDataBtn"></button>
        <div id="globalProgress" style="display:none;"></div>
        <div id="progressMessage"></div>
        <div id="messageModal" style="display:none;">
            <div id="messageText"></div>
            <button id="okMessageBtn"></button>
            <button id="closeMessageModalBtn"></button>
        </div>
        <div id="confirmModal" style="display:none;">
            <div id="confirmText"></div>
            <button id="confirmYesBtn"></button>
            <button id="confirmNoBtn"></button>
            <button id="closeConfirmModalBtn"></button>
        </div>
    `;
}

describe('fileController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        createDom();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('создание экземпляра', () => {
        const store = createStore();
        const cmgr = createCriteriaManager();
        const controller = new FileController(store, nfs, cmgr);
        expect(controller).toBeDefined();
    });

    // ── saveToFile ─────────────────────────────────────────────────────────────

    describe('saveToFile', () => {
        test('calls serializeStateForStorage and storageService.saveFile', async () => {
            const store = createStore([{ id: 1, title: 'T' }]);
            const cmgr = createCriteriaManager();
            const controller = new FileController(store, nfs, cmgr);

            const promise = controller.saveToFile();
            await jest.runAllTimersAsync();
            await promise;

            expect(serializeStateForStorage).toHaveBeenCalled();
            expect(storageService.saveFile).toHaveBeenCalled();
            const [, filename] = storageService.saveFile.mock.calls[0];
            expect(filename).toMatch(/^sprint-plan-\d{4}-\d{2}-\d{2}\.json$/);
        });

        test('shows error message when saveFile throws', async () => {
            storageService.saveFile.mockImplementationOnce(() => { throw new Error('disk full'); });
            const store = createStore();
            const cmgr = createCriteriaManager();
            const controller = new FileController(store, nfs, cmgr);

            const promise = controller.saveToFile();
            await jest.runAllTimersAsync();
            await promise;

            // fileController теперь объединяет сообщение об ошибке в одну строку:
            // 'Не удалось сохранить файл: <error.message>'
            expect(messageService.showMessage).toHaveBeenCalledWith(
                expect.stringContaining('Не удалось сохранить файл')
            );
        });
    });

    // ── loadFromFile ───────────────────────────────────────────────────────────

    describe('loadFromFile', () => {
        test('loads state when file has valid version', async () => {
            storageService.loadFile.mockResolvedValueOnce({
                version: 12,
                tasks: [{ id: 1, title: 'Loaded Task' }],
                criteria: [],
                config: {}
            });
            const store = createStore();
            const cmgr = createCriteriaManager();
            const controller = new FileController(store, nfs, cmgr);

            const promise = controller.loadFromFile();
            await jest.runAllTimersAsync();
            await promise;

            expect(migratePersistedState).toHaveBeenCalled();
            expect(store.loadState).toHaveBeenCalled();
            expect(messageService.showMessage).toHaveBeenCalledWith(expect.stringContaining('загружен'));
        });

        test('shows error when file version is invalid', async () => {
            storageService.loadFile.mockResolvedValueOnce({ version: 1, tasks: [] });
            const store = createStore();
            const cmgr = createCriteriaManager();
            const controller = new FileController(store, nfs, cmgr);

            await controller.loadFromFile();

            expect(messageService.showMessage).toHaveBeenCalledWith(expect.stringContaining('версия'));
            expect(store.loadState).not.toHaveBeenCalled();
        });

        test('does nothing when loadFile rejects (user cancelled)', async () => {
            storageService.loadFile.mockRejectedValueOnce(new Error('Выбор файла отменён'));
            const store = createStore();
            const cmgr = createCriteriaManager();
            const controller = new FileController(store, nfs, cmgr);

            await controller.loadFromFile();

            expect(store.loadState).not.toHaveBeenCalled();
        });

        test('loads criteria from file when present', async () => {
            const fileCriteria = [{ id: 1, name: 'OKR', abbreviation: 'OKR', weight: 100, rationale: 'R', scale: {} }];
            storageService.loadFile.mockResolvedValueOnce({
                version: 12,
                tasks: [],
                criteria: fileCriteria,
                config: {}
            });
            const store = createStore();
            const cmgr = createCriteriaManager();
            const controller = new FileController(store, nfs, cmgr);

            const promise = controller.loadFromFile();
            await jest.runAllTimersAsync();
            await promise;

            expect(cmgr.loadCriteria).toHaveBeenCalledWith(fileCriteria);
        });

        test('loads default criteria when file has no criteria', async () => {
            storageService.loadFile.mockResolvedValueOnce({
                version: 12,
                tasks: [],
                criteria: [],
                config: {}
            });
            const store = createStore();
            const cmgr = createCriteriaManager();
            const controller = new FileController(store, nfs, cmgr);

            const promise = controller.loadFromFile();
            await jest.runAllTimersAsync();
            await promise;

            expect(cmgr.loadDefaultCriteria).toHaveBeenCalled();
        });
    });

    // ── showProgress / hideProgress ────────────────────────────────────────────

    test('showProgress sets display to flex', () => {
        const store = createStore();
        const cmgr = createCriteriaManager();
        const controller = new FileController(store, nfs, cmgr);
        // progressEl инициализируется в init(), поэтому вызываем его перед showProgress
        controller.init();

        controller.showProgress('Loading...');

        expect(document.getElementById('globalProgress').style.display).toBe('flex');
        expect(document.getElementById('progressMessage').textContent).toBe('Loading...');
    });

    test('hideProgress sets display to none', () => {
        const store = createStore();
        const cmgr = createCriteriaManager();
        const controller = new FileController(store, nfs, cmgr);

        controller.showProgress('Loading...');
        controller.hideProgress();

        expect(document.getElementById('globalProgress').style.display).toBe('none');
    });
});
