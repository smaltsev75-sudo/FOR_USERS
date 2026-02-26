/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

// Mock messageService before importing
jest.unstable_mockModule('../../../../js/services/message.js', () => ({
    messageService: {
        showMessage: jest.fn(),
        showConfirm: jest.fn()
    }
}));

const { TaskFormController } = await import('../../../../js/controllers/task/taskFormController.js');
const { messageService } = await import('../../../../js/services/message.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function createStore(tasks = [], criteria = []) {
    const state = { tasks: [...tasks], criteria };
    return {
        getState: jest.fn(() => state),
        addTask: jest.fn((task) => { state.tasks.unshift(task); }),
        updateState: jest.fn(),
        updateTask: jest.fn((id, updates) => {
            const t = state.tasks.find(t => t.id === id);
            if (t) Object.assign(t, updates);
        })
    };
}

const nfs = {
    parseNumber: (v) => Number(String(v).replace(',', '.')),
    formatNumber: (v) => String(v)
};

function createDom() {
    document.body.innerHTML = `
        <div id="createTaskModal" style="display:none;"></div>
        <input id="newTitle" value="" />
        <input id="newJira" value="" />
        <select id="newType"><option value="us" selected>us</option><option value="bug">bug</option></select>
        <input id="newComment" value="" />
        <input id="h_uiux" value="0" />
        <input id="h_ca" value="0" />
        <input id="h_fe" value="5" />
        <input id="h_be" value="0" />
        <input id="h_qa" value="0" />
        <div id="createCriteriaContainer"></div>
        <div id="createEffortHeader"></div>
        <span id="createPriorityScoreHeader"></span>
        <div id="editModal" style="display:none;"></div>
        <input id="editTitle" value="" />
        <input id="editJira" value="" />
        <select id="editType"><option value="us" selected>us</option></select>
        <textarea id="editComment"></textarea>
        <span id="editCommentCounter">0/255</span>
        <div id="messageModal" style="display:none;">
            <div id="messageText"></div>
            <button id="okMessageBtn"></button>
            <button id="closeMessageModalBtn"></button>
        </div>
    `;
}

describe('TaskFormController', () => {
    let store;
    let controller;
    const onTaskCreated = jest.fn();
    const onTaskEdited = jest.fn();
    const invalidateCaches = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        createDom();
        store = createStore();
        controller = new TaskFormController(store, nfs, onTaskCreated, onTaskEdited, invalidateCaches);
    });

    // ── openCreateModal ────────────────────────────────────────────────────────

    test('openCreateModal shows the modal', () => {
        controller.openCreateModal();
        expect(document.getElementById('createTaskModal').style.display).toBe('flex');
    });

    test('closeCreateModal hides the modal', () => {
        controller.openCreateModal();
        controller.closeCreateModal();
        expect(document.getElementById('createTaskModal').style.display).toBe('none');
    });

    // ── handleAddTask ──────────────────────────────────────────────────────────

    describe('handleAddTask', () => {
        test('returns false and shows error when title is empty', () => {
            document.getElementById('newTitle').value = '';
            document.getElementById('newJira').value = 'https://jira.local/T-1';
            const result = controller.handleAddTask();
            expect(result).toBe(false);
            expect(messageService.showMessage).toHaveBeenCalled();
            expect(store.addTask).not.toHaveBeenCalled();
        });

        test('returns false and shows error when jira is empty', () => {
            document.getElementById('newTitle').value = 'Valid Title';
            document.getElementById('newJira').value = '';
            const result = controller.handleAddTask();
            expect(result).toBe(false);
            expect(messageService.showMessage).toHaveBeenCalled();
        });

        test('returns true and adds task when form is valid', () => {
            document.getElementById('newTitle').value = 'My Task';
            document.getElementById('newJira').value = 'https://jira.local/T-1';
            const result = controller.handleAddTask();
            expect(result).toBe(true);
            expect(store.addTask).toHaveBeenCalledTimes(1);
            const task = store.addTask.mock.calls[0][0];
            expect(task.title).toBe('My Task');
            expect(task.jira).toBe('https://jira.local/T-1');
        });

        test('calls onTaskCreated callback after successful add', () => {
            document.getElementById('newTitle').value = 'Callback Task';
            document.getElementById('newJira').value = 'https://jira.local/T-2';
            controller.handleAddTask();
            expect(onTaskCreated).toHaveBeenCalledWith(expect.objectContaining({ title: 'Callback Task' }));
        });

        test('calls invalidateCaches after successful add', () => {
            document.getElementById('newTitle').value = 'Cache Task';
            document.getElementById('newJira').value = 'https://jira.local/T-3';
            controller.handleAddTask();
            expect(invalidateCaches).toHaveBeenCalled();
        });

        test('returns false for duplicate title', () => {
            store = createStore([{ id: 1, title: 'Existing', jira: 'https://jira.local/T-1' }]);
            controller = new TaskFormController(store, nfs, onTaskCreated, onTaskEdited, invalidateCaches);
            document.getElementById('newTitle').value = 'Existing';
            document.getElementById('newJira').value = 'https://jira.local/T-2';
            const result = controller.handleAddTask();
            expect(result).toBe(false);
        });
    });

    // ── openEditModal ──────────────────────────────────────────────────────────

    describe('openEditModal', () => {
        test('shows edit modal and fills form with task data', () => {
            store = createStore([{ id: 5, title: 'Edit Me', jira: 'https://jira.local/T-5', type: 'bug', comment: 'Note' }]);
            controller = new TaskFormController(store, nfs, onTaskCreated, onTaskEdited, invalidateCaches);
            controller.openEditModal(5);
            expect(document.getElementById('editModal').style.display).toBe('flex');
            expect(document.getElementById('editTitle').value).toBe('Edit Me');
            expect(document.getElementById('editJira').value).toBe('https://jira.local/T-5');
            expect(document.getElementById('editComment').value).toBe('Note');
        });

        test('does nothing for non-existent task', () => {
            controller.openEditModal(999);
            expect(document.getElementById('editModal').style.display).toBe('none');
        });
    });

    // ── closeEditModal ─────────────────────────────────────────────────────────

    test('closeEditModal hides modal and clears editId', () => {
        store = createStore([{ id: 6, title: 'T', jira: 'https://jira.local/T-6', type: 'us', comment: '' }]);
        controller = new TaskFormController(store, nfs, onTaskCreated, onTaskEdited, invalidateCaches);
        controller.openEditModal(6);
        controller.closeEditModal();
        expect(document.getElementById('editModal').style.display).toBe('none');
        expect(controller.editId).toBeNull();
    });

    // ── handleSaveEdit ─────────────────────────────────────────────────────────

    describe('handleSaveEdit', () => {
        beforeEach(() => {
            store = createStore([{ id: 7, title: 'Original', jira: 'https://jira.local/T-7', type: 'us', comment: '' }]);
            controller = new TaskFormController(store, nfs, onTaskCreated, onTaskEdited, invalidateCaches);
            controller.openEditModal(7);
        });

        test('saves edited task when form is valid', () => {
            document.getElementById('editTitle').value = 'Updated Title';
            document.getElementById('editJira').value = 'https://jira.local/T-7';
            controller.handleSaveEdit();
            expect(store.updateTask).toHaveBeenCalledWith(7, expect.objectContaining({ title: 'Updated Title' }));
        });

        test('closes modal after successful save', () => {
            document.getElementById('editTitle').value = 'Updated';
            document.getElementById('editJira').value = 'https://jira.local/T-7';
            controller.handleSaveEdit();
            expect(document.getElementById('editModal').style.display).toBe('none');
        });

        test('shows error when title is empty', () => {
            document.getElementById('editTitle').value = '';
            controller.handleSaveEdit();
            expect(messageService.showMessage).toHaveBeenCalled();
            expect(store.updateTask).not.toHaveBeenCalled();
        });

        test('does nothing when editId is null', () => {
            controller.editId = null;
            controller.handleSaveEdit();
            expect(store.updateTask).not.toHaveBeenCalled();
        });
    });

    // ── clearAddForm ───────────────────────────────────────────────────────────

    test('clearAddForm resets all form fields', () => {
        document.getElementById('newTitle').value = 'Some Title';
        document.getElementById('newJira').value = 'https://jira.local/T-1';
        document.getElementById('h_fe').value = '8';
        controller.clearAddForm();
        expect(document.getElementById('newTitle').value).toBe('');
        expect(document.getElementById('newJira').value).toBe('');
        expect(document.getElementById('h_fe').value).toBe('');
    });

    // ── _validateField (DOM element not found) ─────────────────────────────────

    describe('_validateField — missing DOM element', () => {
        test('returns null and logs warning when element is not found', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
            const result = controller._validateField(
                'nonExistentElement',
                () => ({ valid: true }),
                () => true,
                'unique error'
            );
            expect(result).toBeNull();
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('nonExistentElement')
            );
            warnSpy.mockRestore();
        });
    });

    // ── _validateTitleField / _validateJiraField — explicit mode ───────────────

    describe('_validateTitleField and _validateJiraField with explicit mode', () => {
        test('_validateTitleField("create") reads from #newTitle', () => {
            document.getElementById('newTitle').value = 'Valid Title Here';
            const result = controller._validateTitleField('create');
            expect(result).toBe('Valid Title Here');
        });

        test('_validateTitleField("edit") reads from #editTitle', () => {
            document.getElementById('editTitle').value = 'Edited Title Here';
            const result = controller._validateTitleField('edit');
            expect(result).toBe('Edited Title Here');
        });

        test('_validateJiraField("create") reads from #newJira', () => {
            document.getElementById('newJira').value = 'https://jira.local/T-99';
            const result = controller._validateJiraField('create');
            expect(result).toBe('https://jira.local/T-99');
        });

        test('_validateJiraField("edit") reads from #editJira', () => {
            document.getElementById('editJira').value = 'https://jira.local/T-88';
            const result = controller._validateJiraField('edit');
            expect(result).toBe('https://jira.local/T-88');
        });

        test('_validateTitleField("edit", excludeId) excludes task from uniqueness check', () => {
            store = createStore([{ id: 42, title: 'Existing Title', jira: 'https://jira.local/T-42' }]);
            controller = new TaskFormController(store, nfs, onTaskCreated, onTaskEdited, invalidateCaches);
            document.getElementById('editTitle').value = 'Existing Title';
            // Without excludeId — should fail uniqueness
            const failResult = controller._validateTitleField('edit', null);
            expect(failResult).toBeNull();
            // With excludeId=42 — should pass (editing the same task)
            const passResult = controller._validateTitleField('edit', 42);
            expect(passResult).toBe('Existing Title');
        });
    });
});
