import { jest } from '@jest/globals';
import { KeyboardController } from '../../../js/controllers/keyboardController.js';

describe('controllers/keyboardController', () => {
    let taskController;
    let fileController;
    let printFn;
    let controller;

    beforeEach(() => {
        document.body.innerHTML = `
            <input id="taskSearchInput" />
            <div id="createTaskModal" class="modal-overlay" style="display:none"></div>
            <div id="editModal" class="modal-overlay" style="display:none"></div>
            <div id="confirmModal" class="modal-overlay" style="display:none"></div>
        `;

        taskController = {
            selectedTaskId: null,
            openCreateModal: jest.fn(),
            handleDeleteTask: jest.fn()
        };
        fileController = {
            saveToFile: jest.fn(),
            loadFromFile: jest.fn()
        };
        printFn = jest.fn();
        controller = new KeyboardController(taskController, fileController, printFn);
        controller.init();
    });

    test('opens create modal by Ctrl+Alt+N even when input is focused', () => {
        const input = document.getElementById('taskSearchInput');
        input.focus();

        const event = new KeyboardEvent('keydown', { key: 'n', code: 'KeyN', ctrlKey: true, altKey: true, bubbles: true, cancelable: true });
        input.dispatchEvent(event);

        expect(taskController.openCreateModal).toHaveBeenCalledTimes(1);
    });

    test('focuses search input by Ctrl+Alt+F', () => {
        const event = new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', ctrlKey: true, altKey: true, bubbles: true, cancelable: true });
        document.dispatchEvent(event);

        expect(document.activeElement).toBe(document.getElementById('taskSearchInput'));
    });

    test('deletes selected task by Delete only when no modal is open', () => {
        taskController.selectedTaskId = 42;

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', code: 'Delete', bubbles: true, cancelable: true }));
        expect(taskController.handleDeleteTask).toHaveBeenCalledWith(42);

        taskController.handleDeleteTask.mockClear();
        document.getElementById('confirmModal').style.display = 'flex';

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', code: 'Delete', bubbles: true, cancelable: true }));
        expect(taskController.handleDeleteTask).not.toHaveBeenCalled();
    });
});
