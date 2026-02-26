/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

// Mock messageService before importing controller
jest.unstable_mockModule('../../../js/services/message.js', () => ({
    messageService: {
        showMessage: jest.fn(),
        showConfirm: jest.fn((text, onConfirm) => onConfirm()) // auto-confirm
    }
}));

const { CriteriaController } = await import('../../../js/controllers/criteriaController.js');
const { messageService } = await import('../../../js/services/message.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function createCriteriaManager(criteria = [
    { id: 1, name: 'OKR', abbreviation: 'OKR', weight: 40, rationale: 'R1', scale: {} },
    { id: 2, name: 'UX', abbreviation: 'UX', weight: 60, rationale: 'R2', scale: {} }
]) {
    const list = [...criteria];
    return {
        editCriteriaId: null,
        getCriteria: jest.fn(() => list),
        getCriteriaById: jest.fn((id) => list.find(c => c.id === id)),
        addCriteria: jest.fn((data) => { list.push({ id: Date.now(), ...data }); }),
        updateCriteria: jest.fn((id, data) => {
            const idx = list.findIndex(c => c.id === id);
            if (idx === -1) return false;
            list[idx] = { ...list[idx], ...data };
            return true;
        }),
        deleteCriteria: jest.fn((id) => {
            const idx = list.findIndex(c => c.id === id);
            if (idx === -1) return false;
            list.splice(idx, 1);
            return true;
        }),
        getTotalWeight: jest.fn(() => list.reduce((s, c) => s + c.weight, 0)),
        loadDefaultCriteria: jest.fn(),
        isWeightValid: jest.fn(() => true)
    };
}

function createStore(tasks = []) {
    const state = { tasks, criteria: [] };
    return {
        getState: jest.fn(() => state),
        setCriteria: jest.fn(),
        setTasks: jest.fn()
    };
}

function createDom() {
    document.body.innerHTML = `
        <div id="criteriaList"></div>
        <button id="addCriteriaBtn"></button>
        <button id="resetCriteriaBtn"></button>
        <div id="editCriteriaModal" style="display:none;">
            <h3 id="criteriaModalTitle"></h3>
            <button id="closeEditCriteriaModalBtn"></button>
            <input id="editCriteriaName" />
            <input id="editCriteriaAbbreviation" />
            <input id="editCriteriaWeight" type="number" />
            <textarea id="editCriteriaRationale"></textarea>
            <div id="scaleEditor"></div>
            <button id="cancelEditCriteriaBtn"></button>
            <button id="saveCriteriaEditBtn"></button>
        </div>
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('criteriaController', () => {
    let controller;
    let store;
    let cmgr;

    beforeEach(() => {
        jest.clearAllMocks();
        createDom();
        store = createStore();
        cmgr = createCriteriaManager();
        controller = new CriteriaController(store, cmgr);
        controller.init();
    });

    test('создание экземпляра', () => {
        expect(controller).toBeDefined();
    });

    // ── openEditCriteria ───────────────────────────────────────────────────────

    describe('openEditCriteria', () => {
        test('opens modal in add mode when no id given', () => {
            controller.openEditCriteria();
            expect(document.getElementById('editCriteriaModal').style.display).toBe('flex');
            expect(document.getElementById('criteriaModalTitle').textContent).toBe('Добавить критерий');
        });

        test('opens modal in edit mode when id given', () => {
            controller.openEditCriteria(1);
            expect(document.getElementById('editCriteriaModal').style.display).toBe('flex');
            expect(document.getElementById('criteriaModalTitle').textContent).toBe('Редактировать критерий');
            expect(document.getElementById('editCriteriaName').value).toBe('OKR');
            expect(document.getElementById('editCriteriaWeight').value).toBe('40');
        });

        test('clears form fields in add mode', () => {
            document.getElementById('editCriteriaName').value = 'Old';
            controller.openEditCriteria();
            expect(document.getElementById('editCriteriaName').value).toBe('');
            expect(document.getElementById('editCriteriaAbbreviation').value).toBe('');
        });
    });

    // ── closeEditCriteria ──────────────────────────────────────────────────────

    test('closeEditCriteria hides modal', () => {
        controller.openEditCriteria();
        controller.closeEditCriteria();
        expect(document.getElementById('editCriteriaModal').style.display).toBe('none');
    });

    // ── saveCriteria ───────────────────────────────────────────────────────────

    describe('saveCriteria', () => {
        function fillForm({ name = 'New Criterion', abbr = 'NC', weight = '10', rationale = 'Some rationale' } = {}) {
            document.getElementById('editCriteriaName').value = name;
            document.getElementById('editCriteriaAbbreviation').value = abbr;
            document.getElementById('editCriteriaWeight').value = weight;
            document.getElementById('editCriteriaRationale').value = rationale;
        }

        test('shows error when name is empty', () => {
            fillForm({ name: '' });
            controller.saveCriteria();
            expect(messageService.showMessage).toHaveBeenCalledWith(expect.stringContaining('Название'));
            expect(cmgr.addCriteria).not.toHaveBeenCalled();
        });

        test('shows error when weight is 0', () => {
            fillForm({ weight: '0' });
            controller.saveCriteria();
            expect(messageService.showMessage).toHaveBeenCalledWith(expect.stringContaining('Вес'));
        });

        test('shows error when rationale is empty', () => {
            fillForm({ rationale: '' });
            controller.saveCriteria();
            expect(messageService.showMessage).toHaveBeenCalledWith(expect.stringContaining('Обоснование'));
        });

        test('adds new criterion when form is valid', () => {
            controller.openEditCriteria(); // add mode
            fillForm({ name: 'New Crit', abbr: 'NC', weight: '5', rationale: 'Rationale' });
            controller.saveCriteria();
            expect(cmgr.addCriteria).toHaveBeenCalledWith(expect.objectContaining({
                name: 'New Crit',
                abbreviation: 'NC',
                weight: 5
            }));
            expect(store.setCriteria).toHaveBeenCalled();
        });

        test('updates existing criterion in edit mode', () => {
            controller.openEditCriteria(1); // edit mode
            fillForm({ name: 'Updated OKR', abbr: 'OKR', weight: '40', rationale: 'Updated rationale' });
            controller.saveCriteria();
            expect(cmgr.updateCriteria).toHaveBeenCalledWith(1, expect.objectContaining({
                name: 'Updated OKR'
            }));
        });

        test('closes modal after successful save', () => {
            controller.openEditCriteria();
            fillForm();
            controller.saveCriteria();
            expect(document.getElementById('editCriteriaModal').style.display).toBe('none');
        });
    });

    // ── deleteCriteria ─────────────────────────────────────────────────────────

    describe('deleteCriteria', () => {
        test('calls deleteCriteria on manager after confirmation', () => {
            controller.deleteCriteria(1);
            expect(cmgr.deleteCriteria).toHaveBeenCalledWith(1);
            expect(store.setCriteria).toHaveBeenCalled();
        });

        test('removes criterion evaluations from tasks', () => {
            store = createStore([
                { id: 10, criteriaEvaluations: { 1: { score: 5, value: 20 }, 2: { score: 3, value: 18 } } }
            ]);
            controller = new CriteriaController(store, cmgr);
            controller.deleteCriteria(1);
            const updatedTasks = store.setTasks.mock.calls[0][0];
            expect(updatedTasks[0].criteriaEvaluations[1]).toBeUndefined();
            expect(updatedTasks[0].criteriaEvaluations[2]).toBeDefined();
        });
    });

    // ── resetCriteria ──────────────────────────────────────────────────────────

    test('resetCriteria calls loadDefaultCriteria and updates store', () => {
        controller.resetCriteria();
        expect(cmgr.loadDefaultCriteria).toHaveBeenCalled();
        expect(store.setCriteria).toHaveBeenCalled();
    });

    // ── addCriteriaBtn click ───────────────────────────────────────────────────

    test('clicking addCriteriaBtn opens modal', () => {
        document.getElementById('addCriteriaBtn').click();
        expect(document.getElementById('editCriteriaModal').style.display).toBe('flex');
    });

    // ── cancelEditCriteriaBtn click ────────────────────────────────────────────

    test('clicking cancelEditCriteriaBtn closes modal', () => {
        controller.openEditCriteria();
        document.getElementById('cancelEditCriteriaBtn').click();
        expect(document.getElementById('editCriteriaModal').style.display).toBe('none');
    });
});
