import { jest } from '@jest/globals';
import { Store } from '../../../js/state/store.js';
import { ROLES } from '../../../js/utils/constants.js';

describe('state/Store', () => {
    let store;

    beforeEach(() => {
        store = new Store();
        jest.clearAllMocks();
    });

    test('constructor initializes with default state', () => {
        const state = store.getState();
        expect(state.config).toBeDefined();
        expect(state.roles).toEqual(ROLES.map(r => ({ ...r })));
        expect(state.tasks).toEqual([]);
        expect(state.criteria).toEqual([]);
    });

    test('subscribe adds listener', () => {
        const listener = jest.fn();
        store.subscribe(listener);
        store.setConfig({ product: 'Test' });
        expect(listener).toHaveBeenCalled();
    });

    test('setConfig updates config', () => {
        store.setConfig({ product: 'New Product' });
        expect(store.getState().config.product).toBe('New Product');
    });

    test('updateRole updates specific role', () => {
        store.updateRole('uiux', { fte: 80 });
        const role = store.getState().roles.find(r => r.id === 'uiux');
        expect(role.fte).toBe(80);
    });

    test('addTask adds task to beginning', () => {
        const task = { id: 1, title: 'Test' };
        store.addTask(task);
        expect(store.getState().tasks[0]).toEqual(task);
    });

    test('updateTask updates task', () => {
        store.addTask({ id: 1, title: 'Old' });
        store.updateTask(1, { title: 'New' });
        expect(store.getState().tasks[0].title).toBe('New');
    });

    test('deleteTask removes task', () => {
        store.addTask({ id: 1 });
        store.deleteTask(1);
        expect(store.getState().tasks).toHaveLength(0);
    });

    test('setTasks replaces tasks', () => {
        const tasks = [{ id: 2 }, { id: 3 }];
        store.setTasks(tasks);
        expect(store.getState().tasks).toEqual(tasks);
    });

    test('reorderTasks updates order', () => {
        store.addTask({ id: 1 });
        store.addTask({ id: 2 });
        store.reorderTasks([{ id: 2 }, { id: 1 }]);
        expect(store.getState().tasks.map(t => t.id)).toEqual([2, 1]);
    });

    test('setCriteria sets criteria', () => {
        const criteria = [{ id: 1, name: 'Test' }];
        store.setCriteria(criteria);
        expect(store.getState().criteria).toHaveLength(1);
    });

    test('setActiveTab changes tab', () => {
        store.setActiveTab('criteria');
        expect(store.getState().activeTab).toBe('criteria');
    });

    test('loadState replaces entire state', () => {
        const newState = {
            config: { product: 'New' },
            roles: [],
            tasks: [{ id: 99 }],
            criteria: [],
            numberFormatSettings: {},
            activeTab: 'planning'
        };
        store.loadState(newState);
        expect(store.getState().config.product).toBe('New');
        expect(store.getState().tasks).toEqual([{ id: 99 }]);
    });

    test('setTaskFilter updates filter', () => {
        store.setTaskFilter({ search: 'test' });
        expect(store.getState().taskFilter.search).toBe('test');
    });

    test('clearTaskFilter resets filter', () => {
        store.setTaskFilter({ search: 'test', type: 'us' });
        store.clearTaskFilter();
        expect(store.getState().taskFilter).toEqual({ search: '', type: '' });
    });

    test('setTaskSort updates sort', () => {
        store.setTaskSort({ by: 'effort', order: 'asc' });
        expect(store.getState().taskSort).toEqual({ by: 'effort', order: 'asc' });
    });

    test('updateState merges fields and notifies listeners', () => {
        const listener = jest.fn();
        store.subscribe(listener);
        store.updateState({ lastAddedTaskId: 42 });
        expect(store.getState().lastAddedTaskId).toBe(42);
        expect(listener).toHaveBeenCalled();
    });

    test('updateState preserves existing state fields', () => {
        store.addTask({ id: 1, title: 'Existing' });
        store.updateState({ lastAddedTaskId: 1 });
        expect(store.getState().tasks).toHaveLength(1);
        expect(store.getState().lastAddedTaskId).toBe(1);
    });
});



