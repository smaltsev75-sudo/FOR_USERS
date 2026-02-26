/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

// ── Моки зависимостей ────────────────────────────────────────────────────────

const mockShowMessage = jest.fn();
const mockShowConfirm = jest.fn((msg, cb) => cb());

jest.unstable_mockModule('../../../../js/services/message.js', () => ({
    messageService: {
        showMessage: mockShowMessage,
        showConfirm: mockShowConfirm
    }
}));

const mockFixTaskOrder = jest.fn(tasks => tasks);

jest.unstable_mockModule('../../../../js/domain/task.js', () => ({
    fixTaskOrder: mockFixTaskOrder
}));

const mockShowSnackbar = jest.fn();

jest.unstable_mockModule('../../../../js/ui/snackbar.js', () => ({
    showSnackbar: mockShowSnackbar
}));

// Динамический импорт после моков
const { TaskListHandler } = await import('../../../../js/controllers/task/taskListHandler.js');

// ── Хелперы ──────────────────────────────────────────────────────────────────

function createStore(tasks = [], criteria = []) {
    const state = { tasks, criteria };
    return {
        getState: jest.fn(() => ({ ...state, tasks: [...state.tasks], criteria: [...state.criteria] })),
        updateTask: jest.fn((id, upd) => {
            const t = state.tasks.find(t => t.id === id);
            if (t) Object.assign(t, upd);
        }),
        setTasks: jest.fn(newTasks => { state.tasks = newTasks; }),
        deleteTask: jest.fn(id => { state.tasks = state.tasks.filter(t => t.id !== id); }),
        reorderTasks: jest.fn(newTasks => { state.tasks = newTasks; })
    };
}

function createCache(ready = true, scoreMap = {}) {
    return {
        invalidate: jest.fn(),
        isReady: jest.fn(() => ready),
        getCachedPriorityScore: jest.fn((task) => scoreMap[task.id] || 0)
    };
}

function createNfs() {
    return {
        parseNumber: jest.fn(v => parseFloat(v) || 0),
        formatNumber: jest.fn(v => String(v))
    };
}

function createEvent(dataset, value) {
    return { target: { dataset, value } };
}

// ── Тесты ────────────────────────────────────────────────────────────────────

describe('TaskListHandler', () => {
    let store, cache, nfs, handler;
    let getSelectedTaskId, setSelectedTaskId;

    beforeEach(() => {
        jest.clearAllMocks();
        mockFixTaskOrder.mockImplementation(tasks => tasks);
        getSelectedTaskId = jest.fn(() => null);
        setSelectedTaskId = jest.fn();
    });

    // ── handleUpdateEst ──────────────────────────────────────────────────────

    describe('handleUpdateEst', () => {
        test('обновляет est для указанной роли', () => {
            store = createStore([{ id: 1, est: { fe: 5 }, excluded: 0 }]);
            cache = createCache();
            nfs = createNfs();
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleUpdateEst(createEvent({ id: '1', role: 'be' }, '10'));

            expect(store.updateTask).toHaveBeenCalledWith(1, { est: { fe: 5, be: 10 } });
            expect(cache.invalidate).toHaveBeenCalled();
        });

        test('не обновляет исключённую задачу', () => {
            store = createStore([{ id: 2, est: { fe: 5 }, excluded: 1 }]);
            cache = createCache();
            nfs = createNfs();
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleUpdateEst(createEvent({ id: '2', role: 'fe' }, '20'));

            expect(store.updateTask).not.toHaveBeenCalled();
        });

        test('ограничивает значение минимумом 0', () => {
            store = createStore([{ id: 1, est: {}, excluded: 0 }]);
            cache = createCache();
            nfs = createNfs();
            nfs.parseNumber.mockReturnValue(-5);
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleUpdateEst(createEvent({ id: '1', role: 'fe' }, '-5'));

            expect(store.updateTask).toHaveBeenCalledWith(1, { est: { fe: 0 } });
        });

        test('игнорирует несуществующую задачу', () => {
            store = createStore([]);
            cache = createCache();
            nfs = createNfs();
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleUpdateEst(createEvent({ id: '999', role: 'fe' }, '5'));

            expect(store.updateTask).not.toHaveBeenCalled();
        });
    });

    // ── handleCriteriaScoreChange ────────────────────────────────────────────

    describe('handleCriteriaScoreChange', () => {
        test('обновляет оценку по критерию', () => {
            store = createStore(
                [{ id: 1, criteriaEvaluations: {} }],
                [{ id: 10, weight: 40 }]
            );
            cache = createCache();
            nfs = createNfs();
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleCriteriaScoreChange(createEvent({ id: '1', criterionId: '10' }, '8'));

            expect(store.updateTask).toHaveBeenCalledWith(1, {
                criteriaEvaluations: {
                    10: { score: 8, value: 8 * 40 / 10 }
                }
            });
            expect(cache.invalidate).toHaveBeenCalled();
        });

        test('игнорирует несуществующий критерий', () => {
            store = createStore(
                [{ id: 1, criteriaEvaluations: {} }],
                []
            );
            cache = createCache();
            nfs = createNfs();
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleCriteriaScoreChange(createEvent({ id: '1', criterionId: '999' }, '5'));

            expect(store.updateTask).not.toHaveBeenCalled();
        });

        test('обрабатывает пустое значение score как 0', () => {
            store = createStore(
                [{ id: 1, criteriaEvaluations: {} }],
                [{ id: 10, weight: 50 }]
            );
            cache = createCache();
            nfs = createNfs();
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleCriteriaScoreChange(createEvent({ id: '1', criterionId: '10' }, ''));

            expect(store.updateTask).toHaveBeenCalledWith(1, {
                criteriaEvaluations: {
                    10: { score: 0, value: 0 }
                }
            });
        });
    });

    // ── handleToggleExclude ──────────────────────────────────────────────────

    describe('handleToggleExclude', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('исключает задачу (excluded: 0 → 1)', () => {
            store = createStore([{ id: 1, excluded: 0 }]);
            cache = createCache();
            nfs = createNfs();
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleToggleExclude(1);
            jest.advanceTimersByTime(350);

            expect(store.updateTask).toHaveBeenCalledWith(1, {
                excluded: 1,
                exclusionReason: 'Исключена вручную'
            });
            expect(cache.invalidate).toHaveBeenCalled();
        });

        test('включает задачу обратно (excluded: 1 → 0)', () => {
            store = createStore([{ id: 1, excluded: 1 }]);
            cache = createCache();
            nfs = createNfs();
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleToggleExclude(1);
            jest.advanceTimersByTime(350);

            expect(store.updateTask).toHaveBeenCalledWith(1, {
                excluded: 0,
                exclusionReason: ''
            });
        });

        test('вызывает fixTaskOrder после исключения', () => {
            store = createStore([{ id: 1, excluded: 0 }]);
            cache = createCache();
            nfs = createNfs();
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleToggleExclude(1);
            jest.advanceTimersByTime(350);

            expect(mockFixTaskOrder).toHaveBeenCalled();
            expect(store.setTasks).toHaveBeenCalled();
        });

        test('игнорирует несуществующую задачу', () => {
            store = createStore([]);
            cache = createCache();
            nfs = createNfs();
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleToggleExclude(999);

            expect(store.updateTask).not.toHaveBeenCalled();
        });
    });

    // ── handleDeleteTask ─────────────────────────────────────────────────────

    describe('handleDeleteTask', () => {
        test('удаляет задачу без подтверждения (с Undo)', () => {
            store = createStore([{ id: 1, title: 'Test' }]);
            cache = createCache();
            nfs = createNfs();
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleDeleteTask(1);

            expect(store.deleteTask).toHaveBeenCalledWith(1);
            expect(cache.invalidate).toHaveBeenCalled();
            expect(mockShowSnackbar).toHaveBeenCalledWith(
                expect.stringContaining('Test'),
                expect.objectContaining({ onUndo: expect.any(Function) })
            );
        });

        test('сбрасывает selectedTaskId при удалении выделенной задачи', () => {
            store = createStore([{ id: 5, title: 'Selected' }]);
            cache = createCache();
            nfs = createNfs();
            getSelectedTaskId = jest.fn(() => 5);
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleDeleteTask(5);

            expect(setSelectedTaskId).toHaveBeenCalledWith(null);
        });

        test('не сбрасывает selectedTaskId при удалении другой задачи', () => {
            store = createStore([{ id: 1, title: 'Other' }]);
            cache = createCache();
            nfs = createNfs();
            getSelectedTaskId = jest.fn(() => 99);
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleDeleteTask(1);

            expect(setSelectedTaskId).not.toHaveBeenCalled();
        });

        test('игнорирует несуществующую задачу', () => {
            store = createStore([]);
            cache = createCache();
            nfs = createNfs();
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleDeleteTask(999);

            expect(store.deleteTask).not.toHaveBeenCalled();
            expect(mockShowSnackbar).not.toHaveBeenCalled();
        });

        test('undo восстанавливает задачи', () => {
            const originalTasks = [{ id: 1, title: 'Restore' }, { id: 2, title: 'Keep' }];
            store = createStore(originalTasks);
            cache = createCache();
            nfs = createNfs();
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleDeleteTask(1);

            // Вызываем onUndo callback
            const onUndo = mockShowSnackbar.mock.calls[0][1].onUndo;
            onUndo();

            expect(store.setTasks).toHaveBeenCalled();
            expect(cache.invalidate).toHaveBeenCalledTimes(2); // delete + undo
        });
    });

    // ── handleDeleteAll ──────────────────────────────────────────────────────

    describe('handleDeleteAll', () => {
        test('удаляет все задачи с подтверждением и Undo', () => {
            store = createStore([{ id: 1 }, { id: 2 }]);
            cache = createCache();
            nfs = createNfs();
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleDeleteAll();

            expect(mockShowConfirm).toHaveBeenCalledWith('Удалить все задачи?', expect.any(Function));
            expect(store.setTasks).toHaveBeenCalledWith([]);
            expect(setSelectedTaskId).toHaveBeenCalledWith(null);
            expect(cache.invalidate).toHaveBeenCalled();
            expect(mockShowSnackbar).toHaveBeenCalledWith(
                expect.stringContaining('2'),
                expect.objectContaining({ onUndo: expect.any(Function) })
            );
        });

        test('ундо восстанавливает все задачи', () => {
            store = createStore([{ id: 1 }, { id: 2 }]);
            cache = createCache();
            nfs = createNfs();
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleDeleteAll();

            const onUndo = mockShowSnackbar.mock.calls[0][1].onUndo;
            onUndo();

            expect(store.setTasks).toHaveBeenCalledTimes(2); // clear + restore
            expect(cache.invalidate).toHaveBeenCalledTimes(2);
        });
    });

    // ── handleSortByPriority ─────────────────────────────────────────────────

    describe('handleSortByPriority', () => {
        test('сортирует задачи по убыванию Priority Score', () => {
            const tasks = [
                { id: 1, criteriaEvaluations: {} },
                { id: 2, criteriaEvaluations: {} },
                { id: 3, criteriaEvaluations: {} }
            ];
            store = createStore(tasks, []);
            cache = createCache(true, { 1: 3, 2: 9, 3: 5 });
            nfs = createNfs();
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleSortByPriority();

            const reordered = store.reorderTasks.mock.calls[0][0];
            expect(reordered.map(t => t.id)).toEqual([2, 3, 1]);
        });

        test('показывает сообщение об ошибке, если кэш не готов', () => {
            store = createStore([]);
            cache = createCache(false);
            nfs = createNfs();
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleSortByPriority();

            expect(mockShowMessage).toHaveBeenCalledWith('calculatePriorityScore не определено');
            expect(store.reorderTasks).not.toHaveBeenCalled();
        });

        test('вызывает fixTaskOrder для фиксации порядка', () => {
            store = createStore([{ id: 1, criteriaEvaluations: {} }]);
            cache = createCache(true, { 1: 5 });
            nfs = createNfs();
            handler = new TaskListHandler(store, nfs, cache, getSelectedTaskId, setSelectedTaskId);

            handler.handleSortByPriority();

            expect(mockFixTaskOrder).toHaveBeenCalled();
        });
    });
});
