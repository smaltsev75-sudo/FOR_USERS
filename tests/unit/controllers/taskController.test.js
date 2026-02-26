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

const { TaskController } = await import('../../../js/controllers/taskController.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function createStore(tasks = [], criteria = [{ id: 1, weight: 40 }]) {
    const state = {
        tasks: [...tasks],
        criteria,
        taskFilter: { search: '', type: '' },
        config: { days: 10, availCoef: 93.5, alert: 3 },
        roles: [{ id: 'fe', name: 'FE', fte: 100, off: 0 }],
        lastAddedTaskId: null
    };
    return {
        getState: jest.fn(() => state),
        addTask: jest.fn((task) => { state.tasks.unshift(task); }),
        updateState: jest.fn((patch) => Object.assign(state, patch)),
        updateTask: jest.fn((id, updates) => {
            const t = state.tasks.find(t => t.id === id);
            if (t) Object.assign(t, updates);
        }),
        setTaskFilter: jest.fn(),
        setTasks: jest.fn(),
        reorderTasks: jest.fn((tasks) => { state.tasks.splice(0, state.tasks.length, ...tasks); }),
        deleteTask: jest.fn((id) => { state.tasks.splice(state.tasks.findIndex(t => t.id === id), 1); })
    };
}

const nfs = {
    parseNumber: (v) => Number(String(v).replace(',', '.')),
    formatNumber: (v, d) => Number(v).toFixed(d ?? 0)
};

function createBaseDom() {
    document.body.innerHTML = `
        <input id="newTitle" value="Valid task title" />
        <input id="newJira" value="https://jira.local/TASK-1" />
        <select id="newType"><option value="us" selected>us</option></select>
        <textarea id="newComment">test comment</textarea>
        <input id="h_uiux" value="1" />
        <input id="h_ca" value="2" />
        <input id="h_fe" value="3" />
        <input id="h_be" value="4" />
        <input id="h_qa" value="5" />
        <select id="criteria_1"><option value="7" selected>7</option></select>
        <div id="createEffortHeader"></div>
        <span id="createPriorityScoreHeader"></span>
        <div id="createCriteriaContainer"></div>
        <div id="createTaskModal" style="display:none;"></div>
        <div id="taskList"></div>
        <button id="addTaskBtn"></button>
        <button id="closeCreateModalBtn"></button>
        <button id="cancelCreateBtn"></button>
        <button id="saveCreateBtn"></button>
        <button id="sortByPriorityBtn"></button>
        <button id="deleteAllTasksBtn"></button>
        <input id="taskSearchInput" />
        <select id="taskTypeFilter"><option value="">All</option></select>
        <div id="editModal" style="display:none;"></div>
        <input id="editTitle" />
        <input id="editJira" />
        <select id="editType"><option value="us" selected>us</option></select>
        <textarea id="editComment"></textarea>
        <span id="editCommentCounter">0/255</span>
        <button id="closeEditModalBtn"></button>
        <button id="cancelEditBtn"></button>
        <button id="saveTaskEditBtn"></button>
        <div id="confirmModal" style="display:none;">
            <div id="confirmText"></div>
            <button id="confirmYesBtn"></button>
            <button id="confirmNoBtn"></button>
            <button id="closeConfirmModalBtn"></button>
        </div>
        <div id="messageModal" style="display:none;">
            <div id="messageText"></div>
            <button id="okMessageBtn"></button>
            <button id="closeMessageModalBtn"></button>
        </div>
    `;
}

describe('controllers/taskController', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        createBaseDom();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    // ── constructor ───────────────────────────────────────────────────────────

    test('constructor initializes sub-controllers', () => {
        const store = createStore();
        const controller = new TaskController(store, nfs);

        expect(controller.store).toBe(store);
        expect(controller.selectedTaskId).toBeNull();
        expect(controller._cache).toBeDefined();
        expect(controller._form).toBeDefined();
        expect(controller._drag).toBeDefined();
        expect(controller._list).toBeDefined();
    });

    // ── handleAddTask ─────────────────────────────────────────────────────────

    test('handleAddTask creates task and updates store', () => {
        const store = createStore();
        const controller = new TaskController(store, nfs);

        const ok = controller.handleAddTask();

        expect(ok).toBe(true);
        expect(store.addTask).toHaveBeenCalledTimes(1);
        const createdTask = store.addTask.mock.calls[0][0];
        expect(createdTask.title).toBe('Valid task title');
        expect(createdTask.jira).toBe('https://jira.local/TASK-1');
        expect(createdTask.est).toEqual({ uiux: 1, ca: 2, fe: 3, be: 4, qa: 5 });
        expect(createdTask.criteriaEvaluations[1]).toEqual({ score: 7, value: 28 });
        expect(store.updateState).toHaveBeenCalled();
    });

    test('updateCreateFormTotal updates effort header', () => {
        const store = createStore();
        const controller = new TaskController(store, nfs);

        controller.updateCreateFormTotal();

        expect(document.getElementById('createEffortHeader').textContent).toContain('Effort: 15');
    });

    // ── proxy methods ─────────────────────────────────────────────────────────

    describe('proxy methods', () => {
        test('openCreateModal delegates to _form', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            const spy = jest.spyOn(controller._form, 'openCreateModal');

            controller.openCreateModal();

            expect(spy).toHaveBeenCalled();
        });

        test('closeCreateModal delegates to _form', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            const spy = jest.spyOn(controller._form, 'closeCreateModal');

            controller.closeCreateModal();

            expect(spy).toHaveBeenCalled();
        });

        test('openEditModal delegates to _form', () => {
            const store = createStore([{ id: 1, title: 'T', jira: 'https://j.co/1', type: 'us', comment: '' }]);
            const controller = new TaskController(store, nfs);
            const spy = jest.spyOn(controller._form, 'openEditModal');

            controller.openEditModal(1);

            expect(spy).toHaveBeenCalledWith(1);
        });

        test('closeEditModal delegates to _form', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            const spy = jest.spyOn(controller._form, 'closeEditModal');

            controller.closeEditModal();

            expect(spy).toHaveBeenCalled();
        });

        test('handleAddTaskWithSelect delegates to _form.handleAddTask', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            const spy = jest.spyOn(controller._form, 'handleAddTask');

            controller.handleAddTaskWithSelect();

            expect(spy).toHaveBeenCalled();
        });
    });

    // ── caching ───────────────────────────────────────────────────────────────

    describe('caching', () => {
        test('getCachedPriorityScore delegates to _cache', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            controller.setPriorityScoreCalculator(() => 5);

            const task = { id: 1, criteriaEvaluations: {} };
            const result = controller.getCachedPriorityScore(task);

            expect(result).toBe(5);
        });

        test('getCachedRoleLoad delegates to _cache', () => {
            const store = createStore([{ id: 1, excluded: 0, est: { fe: 5 } }]);
            const controller = new TaskController(store, nfs);

            const load = controller.getCachedRoleLoad();

            expect(load).toBeDefined();
            expect(typeof load).toBe('object');
        });

        test('invalidateCaches clears both caches', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            const spy = jest.spyOn(controller._cache, 'invalidate');

            controller.invalidateCaches();

            expect(spy).toHaveBeenCalled();
        });

        test('setPriorityScoreCalculator delegates to _cache', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            const fn = () => 42;

            controller.setPriorityScoreCalculator(fn);

            expect(controller._cache.isReady()).toBe(true);
        });
    });

    // ── handleToggleExclude ───────────────────────────────────────────────────

    describe('handleToggleExclude', () => {
        test('excludes an included task', () => {
            const tasks = [{ id: 1, title: 'T', excluded: 0, est: { fe: 5 } }];
            const store = createStore(tasks);
            const controller = new TaskController(store, nfs);

            controller.handleToggleExclude(1);
            jest.runAllTimers();

            expect(store.updateTask).toHaveBeenCalledWith(1, expect.objectContaining({ excluded: 1 }));
        });

        test('includes an excluded task', () => {
            const tasks = [{ id: 2, title: 'T', excluded: 1, est: { fe: 5 } }];
            const store = createStore(tasks);
            const controller = new TaskController(store, nfs);

            controller.handleToggleExclude(2);
            jest.runAllTimers();

            expect(store.updateTask).toHaveBeenCalledWith(2, expect.objectContaining({ excluded: 0 }));
        });

        test('does nothing for non-existent task', () => {
            const store = createStore([]);
            const controller = new TaskController(store, nfs);

            controller.handleToggleExclude(999);

            expect(store.updateTask).not.toHaveBeenCalled();
        });

        test('sets exclusionReason when excluding', () => {
            const tasks = [{ id: 3, title: 'T', excluded: 0, est: {} }];
            const store = createStore(tasks);
            const controller = new TaskController(store, nfs);

            controller.handleToggleExclude(3);
            jest.runAllTimers();

            expect(store.updateTask).toHaveBeenCalledWith(3, expect.objectContaining({
                exclusionReason: 'Исключена вручную'
            }));
        });

        test('clears exclusionReason when including', () => {
            const tasks = [{ id: 4, title: 'T', excluded: 1, exclusionReason: 'Old reason', est: {} }];
            const store = createStore(tasks);
            const controller = new TaskController(store, nfs);

            controller.handleToggleExclude(4);
            jest.runAllTimers();

            expect(store.updateTask).toHaveBeenCalledWith(4, expect.objectContaining({
                exclusionReason: ''
            }));
        });

        test('sets selectedTaskId when including excluded task', () => {
            const tasks = [{ id: 5, title: 'T', excluded: 1, est: {} }];
            const store = createStore(tasks);
            const controller = new TaskController(store, nfs);

            controller.handleToggleExclude(5);

            expect(controller.selectedTaskId).toBe(5);
            jest.runAllTimers();
        });

        test('applies opacity animation when task element exists in DOM', () => {
            const tasks = [{ id: 11, title: 'T', excluded: 0, est: {} }];
            const store = createStore(tasks);
            const controller = new TaskController(store, nfs);

            const taskEl = document.createElement('div');
            taskEl.className = 'task-item';
            taskEl.dataset.id = '11';
            document.body.appendChild(taskEl);

            controller.handleToggleExclude(11);

            expect(taskEl.style.opacity).toBe('0.5');

            document.body.removeChild(taskEl);
            jest.runAllTimers();
        });
    });

    // ── handleDeleteTask ──────────────────────────────────────────────────────

    describe('handleDeleteTask', () => {
        test('deletes task after confirmation', () => {
            const tasks = [{ id: 10, title: 'Delete Me', excluded: 0, est: {} }];
            const store = createStore(tasks);
            const controller = new TaskController(store, nfs);

            controller.handleDeleteTask(10);
            jest.runAllTimers();

            expect(store.deleteTask).toHaveBeenCalledWith(10);
        });

        test('clears selectedTaskId when deleting selected task', () => {
            const tasks = [{ id: 11, title: 'T', excluded: 0, est: {} }];
            const store = createStore(tasks);
            const controller = new TaskController(store, nfs);
            controller.selectedTaskId = 11;

            controller.handleDeleteTask(11);
            jest.runAllTimers();

            expect(controller.selectedTaskId).toBeNull();
        });

        test('adds removing class when task element exists in DOM', () => {
            const tasks = [{ id: 12, title: 'T', excluded: 0, est: {} }];
            const store = createStore(tasks);
            const controller = new TaskController(store, nfs);

            const taskEl = document.createElement('div');
            taskEl.className = 'task-item';
            taskEl.dataset.id = '12';
            document.body.appendChild(taskEl);

            controller.handleDeleteTask(12);

            expect(taskEl.classList.contains('removing')).toBe(true);

            document.body.removeChild(taskEl);
            jest.runAllTimers();
        });
    });

    // ── handleDeleteAll ───────────────────────────────────────────────────────

    test('handleDeleteAll clears all tasks', () => {
        const tasks = [
            { id: 1, title: 'T1', excluded: 0, est: {} },
            { id: 2, title: 'T2', excluded: 0, est: {} }
        ];
        const store = createStore(tasks);
        const controller = new TaskController(store, nfs);

        controller.handleDeleteAll();

        expect(store.setTasks).toHaveBeenCalledWith([]);
        expect(controller.selectedTaskId).toBeNull();
    });

    // ── handleSortByPriority ──────────────────────────────────────────────────

    describe('handleSortByPriority', () => {
        test('sorts tasks by priority score descending', () => {
            const tasks = [
                { id: 1, title: 'Low', excluded: 0, est: {}, criteriaEvaluations: { 1: { score: 2, value: 8 } } },
                { id: 2, title: 'High', excluded: 0, est: {}, criteriaEvaluations: { 1: { score: 9, value: 36 } } }
            ];
            const store = createStore(tasks);
            const controller = new TaskController(store, nfs);
            controller.setPriorityScoreCalculator((task) => {
                return task.criteriaEvaluations?.[1]?.score || 0;
            });

            controller.handleSortByPriority();

            const reorderedTasks = store.reorderTasks.mock.calls[0][0];
            expect(reorderedTasks[0].id).toBe(2);
            expect(reorderedTasks[1].id).toBe(1);
        });

        test('shows message when no calculator set', async () => {
            const { messageService } = await import('../../../js/services/message.js');
            const store = createStore([]);
            const controller = new TaskController(store, nfs);

            controller.handleSortByPriority();

            expect(messageService.showMessage).toHaveBeenCalled();
        });
    });

    // ── selectTask / deselectTask ─────────────────────────────────────────────

    describe('selectTask', () => {
        test('sets selectedTaskId when task exists', () => {
            const tasks = [{ id: 5, title: 'T', excluded: 0, est: {} }];
            const store = createStore(tasks);
            const controller = new TaskController(store, nfs);

            controller.selectTask(5);

            expect(controller.selectedTaskId).toBe(5);
        });

        test('does nothing for non-existent task', () => {
            const store = createStore([]);
            const controller = new TaskController(store, nfs);

            controller.selectTask(999);

            expect(controller.selectedTaskId).toBeNull();
        });

        test('does nothing when taskId is falsy', () => {
            const store = createStore([]);
            const controller = new TaskController(store, nfs);

            controller.selectTask(0);

            expect(controller.selectedTaskId).toBeNull();
        });

        test('adds selected-task class to matching DOM element', () => {
            const tasks = [{ id: 7, title: 'T', excluded: 0, est: {} }];
            const store = createStore(tasks);
            const controller = new TaskController(store, nfs);

            const taskEl = document.createElement('div');
            taskEl.className = 'task-item';
            taskEl.dataset.id = '7';
            taskEl.getBoundingClientRect = jest.fn(() => ({ top: 0, bottom: 100 }));
            document.getElementById('taskList').appendChild(taskEl);

            controller.selectTask(7);

            expect(taskEl.classList.contains('selected-task')).toBe(true);
        });

        test('removes selected-task from previously selected element', () => {
            const tasks = [
                { id: 7, title: 'T1', excluded: 0, est: {} },
                { id: 8, title: 'T2', excluded: 0, est: {} }
            ];
            const store = createStore(tasks);
            const controller = new TaskController(store, nfs);

            const taskList = document.getElementById('taskList');
            const el7 = document.createElement('div');
            el7.className = 'task-item';
            el7.dataset.id = '7';
            el7.getBoundingClientRect = jest.fn(() => ({ top: 0, bottom: 100 }));
            taskList.appendChild(el7);

            const el8 = document.createElement('div');
            el8.className = 'task-item';
            el8.dataset.id = '8';
            el8.getBoundingClientRect = jest.fn(() => ({ top: 0, bottom: 100 }));
            taskList.appendChild(el8);

            controller.selectTask(7);
            expect(el7.classList.contains('selected-task')).toBe(true);

            controller.selectTask(8);
            expect(el7.classList.contains('selected-task')).toBe(false);
            expect(el8.classList.contains('selected-task')).toBe(true);
        });

        test('scrolls into view when forceScroll is true', () => {
            const tasks = [{ id: 9, title: 'T', excluded: 0, est: {} }];
            const store = createStore(tasks);
            const controller = new TaskController(store, nfs);

            const taskEl = document.createElement('div');
            taskEl.className = 'task-item';
            taskEl.dataset.id = '9';
            taskEl.getBoundingClientRect = jest.fn(() => ({ top: 0, bottom: 100 }));
            taskEl.scrollIntoView = jest.fn();
            document.getElementById('taskList').appendChild(taskEl);

            controller.selectTask(9, true);

            expect(taskEl.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
        });
    });

    test('deselectTask clears selectedTaskId', () => {
        const tasks = [{ id: 6, title: 'T', excluded: 0, est: {} }];
        const store = createStore(tasks);
        const controller = new TaskController(store, nfs);
        controller.selectedTaskId = 6;

        controller.deselectTask();

        expect(controller.selectedTaskId).toBeNull();
    });

    test('deselectTask removes selected-task class from DOM', () => {
        const tasks = [{ id: 6, title: 'T', excluded: 0, est: {} }];
        const store = createStore(tasks);
        const controller = new TaskController(store, nfs);

        const taskEl = document.createElement('div');
        taskEl.className = 'task-item selected-task';
        taskEl.dataset.id = '6';
        document.body.appendChild(taskEl);

        controller.deselectTask();

        expect(taskEl.classList.contains('selected-task')).toBe(false);
    });

    // ── handleUpdateEst ───────────────────────────────────────────────────────

    test('handleUpdateEst updates task estimate', () => {
        const tasks = [{ id: 7, title: 'T', excluded: 0, est: { fe: 0 } }];
        const store = createStore(tasks);
        const controller = new TaskController(store, nfs);

        const event = {
            target: {
                dataset: { id: '7', role: 'fe' },
                value: '8'
            }
        };
        controller.handleUpdateEst(event);

        expect(store.updateTask).toHaveBeenCalledWith(7, { est: { fe: 8 } });
    });

    test('handleUpdateEst ignores excluded tasks', () => {
        const tasks = [{ id: 8, title: 'T', excluded: 1, est: { fe: 0 } }];
        const store = createStore(tasks);
        const controller = new TaskController(store, nfs);

        const event = {
            target: {
                dataset: { id: '8', role: 'fe' },
                value: '5'
            }
        };
        controller.handleUpdateEst(event);

        expect(store.updateTask).not.toHaveBeenCalled();
    });

    // ── handleCriteriaScoreChange ─────────────────────────────────────────────

    describe('handleCriteriaScoreChange', () => {
        test('updates criteria evaluation for task', () => {
            const tasks = [{ id: 9, title: 'T', excluded: 0, est: {}, criteriaEvaluations: {} }];
            const criteria = [{ id: 1, weight: 40 }];
            const store = createStore(tasks, criteria);
            const controller = new TaskController(store, nfs);

            const event = {
                target: {
                    dataset: { id: '9', criterionId: '1' },
                    value: '7'
                }
            };
            controller.handleCriteriaScoreChange(event);

            expect(store.updateTask).toHaveBeenCalledWith(9, {
                criteriaEvaluations: { 1: { score: 7, value: 28 } }
            });
        });

        test('does nothing for non-existent task', () => {
            const store = createStore([]);
            const controller = new TaskController(store, nfs);

            const event = {
                target: { dataset: { id: '999', criterionId: '1' }, value: '5' }
            };
            controller.handleCriteriaScoreChange(event);

            expect(store.updateTask).not.toHaveBeenCalled();
        });

        test('does nothing for non-existent criterion', () => {
            const tasks = [{ id: 10, title: 'T', excluded: 0, est: {}, criteriaEvaluations: {} }];
            const store = createStore(tasks, []);
            const controller = new TaskController(store, nfs);

            const event = {
                target: { dataset: { id: '10', criterionId: '999' }, value: '5' }
            };
            controller.handleCriteriaScoreChange(event);

            expect(store.updateTask).not.toHaveBeenCalled();
        });
    });

    // ── attachEvents ──────────────────────────────────────────────────────────

    describe('attachEvents', () => {
        test('addTaskBtn click opens create modal', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            const spy = jest.spyOn(controller._form, 'openCreateModal');

            controller.init();
            document.getElementById('addTaskBtn').click();

            expect(spy).toHaveBeenCalled();
        });

        test('closeCreateModalBtn click closes create modal', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            const spy = jest.spyOn(controller._form, 'closeCreateModal');

            controller.init();
            document.getElementById('closeCreateModalBtn').click();

            expect(spy).toHaveBeenCalled();
        });

        test('cancelCreateBtn click closes create modal', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            const spy = jest.spyOn(controller._form, 'closeCreateModal');

            controller.init();
            document.getElementById('cancelCreateBtn').click();

            expect(spy).toHaveBeenCalled();
        });

        test('sortByPriorityBtn click calls handleSortByPriority', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            const spy = jest.spyOn(controller, 'handleSortByPriority');

            controller.init();
            document.getElementById('sortByPriorityBtn').click();

            expect(spy).toHaveBeenCalled();
        });

        test('deleteAllTasksBtn click calls handleDeleteAll', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            const spy = jest.spyOn(controller, 'handleDeleteAll');

            controller.init();
            document.getElementById('deleteAllTasksBtn').click();

            expect(spy).toHaveBeenCalled();
        });

        test('closeEditModalBtn click closes edit modal', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            const spy = jest.spyOn(controller._form, 'closeEditModal');

            controller.init();
            document.getElementById('closeEditModalBtn').click();

            expect(spy).toHaveBeenCalled();
        });

        test('cancelEditBtn click closes edit modal', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            const spy = jest.spyOn(controller._form, 'closeEditModal');

            controller.init();
            document.getElementById('cancelEditBtn').click();

            expect(spy).toHaveBeenCalled();
        });

        test('saveTaskEditBtn click calls handleSaveEdit', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            const spy = jest.spyOn(controller._form, 'handleSaveEdit');

            controller.init();
            document.getElementById('saveTaskEditBtn').click();

            expect(spy).toHaveBeenCalled();
        });

        test('editComment input updates counter', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            controller.init();

            const editComment = document.getElementById('editComment');
            editComment.value = 'Hello World';
            editComment.dispatchEvent(new Event('input', { bubbles: true }));

            expect(document.getElementById('editCommentCounter').textContent).toBe('11/255');
        });

        test('taskSearchInput dispatches setTaskFilter', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            controller.init();

            const searchInput = document.getElementById('taskSearchInput');
            searchInput.value = 'test';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));

            expect(store.setTaskFilter).toHaveBeenCalledWith({ search: 'test' });
        });

        test('taskTypeFilter dispatches setTaskFilter', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            controller.init();

            const typeFilter = document.getElementById('taskTypeFilter');
            typeFilter.value = '';
            typeFilter.dispatchEvent(new Event('change', { bubbles: true }));

            expect(store.setTaskFilter).toHaveBeenCalledWith({ type: '' });
        });

        test('hour input blur formats value', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            controller.init();

            const feFld = document.getElementById('h_fe');
            feFld.value = '3,7';
            feFld.dispatchEvent(new Event('blur'));

            expect(feFld.value).toBe('3.7');
        });

        test('hour input clamps negative values to 0', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            controller.init();

            const feFld = document.getElementById('h_fe');
            feFld.value = '-5';
            feFld.dispatchEvent(new Event('input'));

            expect(feFld.value).toBe('0');
        });

        test('clicking on task item in taskList selects it', () => {
            const tasks = [{ id: 20, title: 'T', excluded: 0, est: {} }];
            const store = createStore(tasks);
            const controller = new TaskController(store, nfs);
            controller.init();

            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';
            taskItem.dataset.id = '20';
            taskItem.getBoundingClientRect = jest.fn(() => ({ top: 0, bottom: 100 }));
            document.getElementById('taskList').appendChild(taskItem);

            taskItem.click();

            expect(controller.selectedTaskId).toBe(20);
        });

        test('clicking outside task items deselects', () => {
            const tasks = [{ id: 21, title: 'T', excluded: 0, est: {} }];
            const store = createStore(tasks);
            const controller = new TaskController(store, nfs);
            controller.init();
            controller.selectedTaskId = 21;

            document.body.click();

            expect(controller.selectedTaskId).toBeNull();
        });

        test('clicking on button inside task item does not select task', () => {
            const tasks = [{ id: 22, title: 'T', excluded: 0, est: {} }];
            const store = createStore(tasks);
            const controller = new TaskController(store, nfs);
            controller.init();

            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';
            taskItem.dataset.id = '22';
            const btn = document.createElement('button');
            taskItem.appendChild(btn);
            document.getElementById('taskList').appendChild(taskItem);

            btn.click();

            // Should not select because click was on a button
            expect(controller.selectedTaskId).toBeNull();
        });
    });

    // ── _onTaskCreated ────────────────────────────────────────────────────────

    describe('_onTaskCreated', () => {
        test('sets up MutationObserver without throwing', () => {
            const tasks = [{ id: 100, title: 'T', excluded: 0, est: {} }];
            const store = createStore(tasks);
            const controller = new TaskController(store, nfs);

            // _onTaskCreated should set up observer and timeout without error
            expect(() => controller._onTaskCreated({ id: 100 })).not.toThrow();

            jest.runAllTimers();
        });

        test('handles missing taskList gracefully', () => {
            const store = createStore();
            const controller = new TaskController(store, nfs);
            document.getElementById('taskList').remove();

            expect(() => controller._onTaskCreated({ id: 1 })).not.toThrow();
        });
    });
});
