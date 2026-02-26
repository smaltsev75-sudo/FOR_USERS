import { jest } from '@jest/globals';

const renderAppMock = jest.fn();
const storageSaveMock = jest.fn();
const nfsSaveSettingsMock = jest.fn();
let subscribeListener = null;

class MockStore {
    constructor(initialState) {
        this.state = initialState;
    }
    getState() {
        return this.state;
    }
    setCriteria(criteria) {
        this.state.criteria = criteria;
    }
    subscribe(listener) {
        subscribeListener = listener;
    }
}

class MockCriteriaManager {
    constructor() {
        this.criteria = [{ id: 1, name: 'C1', abbreviation: 'C1', weight: 100, scale: {} }];
    }
    loadCriteria(criteria) {
        this.criteria = criteria;
    }
    getCriteria() {
        return this.criteria;
    }
}

class MockController {
    constructor() {
        this.init = jest.fn();
    }
}

class MockTaskController extends MockController {
    setPriorityScoreCalculator(fn) {
        this.priorityCalculator = fn;
    }
}

jest.unstable_mockModule('../../js/state/store.js', () => ({ Store: MockStore }));
jest.unstable_mockModule('../../js/domain/criteriaManager.js', () => ({ CriteriaManager: MockCriteriaManager }));
jest.unstable_mockModule('../../js/ui/index.js', () => ({ renderApp: renderAppMock }));
jest.unstable_mockModule('../../js/services/storage.js', () => ({
    storageService: {
        load: jest.fn(() => null),
        save: storageSaveMock
    }
}));
jest.unstable_mockModule('../../js/services/numberFormat.js', () => ({
    NumberFormatService: class {
        constructor() {
            this.decimalSeparator = ',';
        }
        saveSettings() {
            nfsSaveSettingsMock();
        }
    }
}));
jest.unstable_mockModule('../../js/domain/config.js', () => ({
    createDefaultConfig: () => ({ product: 'P', days: 10, startDate: '01.01.2026', endDate: '10.01.2026', availCoef: 90, alert: 3 })
}));
jest.unstable_mockModule('../../js/domain/role.js', () => ({
    createDefaultRoles: () => [{ id: 'fe', name: 'FE', fte: 100, off: 0 }]
}));
jest.unstable_mockModule('../../js/domain/criteria.js', () => ({ calculatePriorityScore: () => 5 }));
jest.unstable_mockModule('../../js/state/persistence.js', () => ({
    migratePersistedState: (s) => s,
    serializeStateForStorage: () => ({ persisted: true })
}));

jest.unstable_mockModule('../../js/controllers/configController.js', () => ({ ConfigController: MockController }));
jest.unstable_mockModule('../../js/controllers/roleController.js', () => ({ RoleController: MockController }));
jest.unstable_mockModule('../../js/controllers/taskController.js', () => ({ TaskController: MockTaskController }));
jest.unstable_mockModule('../../js/controllers/criteriaController.js', () => ({ CriteriaController: MockController }));
jest.unstable_mockModule('../../js/controllers/selectionController.js', () => ({ SelectionController: MockController }));
jest.unstable_mockModule('../../js/controllers/fileController.js', () => ({ FileController: MockController }));
jest.unstable_mockModule('../../js/controllers/tabController.js', () => ({ TabController: MockController }));
jest.unstable_mockModule('../../js/controllers/helpController.js', () => ({ HelpController: MockController }));
jest.unstable_mockModule('../../js/controllers/keyboardController.js', () => ({ KeyboardController: MockController }));

describe('app integration', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        subscribeListener = null;
        window.__PLANNER_DISABLE_AUTOBOOT__ = true;
        global.requestAnimationFrame = (cb) => {
            cb();
            return 1;
        };
    });

    afterEach(() => {
        jest.useRealTimers();
        delete window.__PLANNER_DISABLE_AUTOBOOT__;
    });

    test('initializes controllers and performs initial render', async () => {
        const { App } = await import('../../js/app.js');
        const app = new App();

        expect(app.store).toBeDefined();
        expect(renderAppMock).toHaveBeenCalledTimes(1);
        expect(typeof subscribeListener).toBe('function');
    });

    test('store change triggers render and deferred persistence', async () => {
        const { App } = await import('../../js/app.js');
        new App();

        subscribeListener();
        jest.advanceTimersByTime(210);

        expect(renderAppMock).toHaveBeenCalledTimes(2);
        expect(storageSaveMock).toHaveBeenCalledWith({ persisted: true });
        expect(nfsSaveSettingsMock).toHaveBeenCalledTimes(1);
    });
});
