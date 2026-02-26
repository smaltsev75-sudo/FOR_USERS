/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import { TaskDragController } from '../../../../js/controllers/task/taskDragController.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function createStore(tasks = []) {
    const state = { tasks: [...tasks] };
    return {
        getState: jest.fn(() => state),
        reorderTasks: jest.fn((newTasks) => { state.tasks.splice(0, state.tasks.length, ...newTasks); })
    };
}

function createTaskItem(id, index = 0) {
    const el = document.createElement('div');
    el.className = 'task-item';
    el.dataset.id = String(id);
    el.dataset.index = String(index);
    el.draggable = true;
    // Добавляем ручку перетаскивания
    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    el.appendChild(handle);
    return el;
}

function createDragEvent(type, dataTransferData = {}) {
    const event = new Event(type, { bubbles: true });
    event.dataTransfer = {
        effectAllowed: '',
        _data: { ...dataTransferData },
        setData: jest.fn((key, val) => { event.dataTransfer._data[key] = val; }),
        getData: jest.fn((key) => event.dataTransfer._data[key] || ''),
    };
    event.preventDefault = jest.fn();
    event.stopPropagation = jest.fn();
    return event;
}

describe('TaskDragController', () => {
    let store;
    let invalidateCaches;
    let controller;
    let container;

    beforeEach(() => {
        invalidateCaches = jest.fn();
        document.body.innerHTML = '<div id="taskList"></div>';
        container = document.getElementById('taskList');
    });

    // ── handleDragStart ────────────────────────────────────────────────────────

    describe('handleDragStart', () => {
        test('sets dragSrc and adds dragging class', () => {
            store = createStore([{ id: 1 }, { id: 2 }]);
            controller = new TaskDragController(store, invalidateCaches);

            const item = createTaskItem(1);
            container.appendChild(item);

            const event = createDragEvent('dragstart');
            Object.defineProperty(event, 'target', { value: item });

            controller.handleDragStart(event);

            expect(controller.dragSrc).toBe(item);
            expect(item.classList.contains('dragging')).toBe(true);
            expect(event.dataTransfer.setData).toHaveBeenCalledWith('text/plain', '1');
        });

        test('does nothing when target is not a task-item', () => {
            store = createStore([]);
            controller = new TaskDragController(store, invalidateCaches);

            const div = document.createElement('div'); // no task-item class
            const event = createDragEvent('dragstart');
            Object.defineProperty(event, 'target', { value: div });

            controller.handleDragStart(event);

            expect(controller.dragSrc).toBeNull();
        });
    });

    // -- mousedown controls draggable --

    describe('mousedown управляет draggable', () => {
        test('включает draggable при mousedown на .drag-handle', () => {
            store = createStore([]);
            controller = new TaskDragController(store, invalidateCaches);
            controller.attachTo(container);

            const item = createTaskItem(1);
            container.appendChild(item);
            const handle = item.querySelector('.drag-handle');

            handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

            expect(item.draggable).toBe(true);
        });

        test('отключает draggable при mousedown на кнопку', () => {
            store = createStore([]);
            controller = new TaskDragController(store, invalidateCaches);
            controller.attachTo(container);

            const item = createTaskItem(1);
            container.appendChild(item);
            const btn = document.createElement('button');
            item.appendChild(btn);

            btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

            expect(item.draggable).toBe(false);
        });
    });

    // ── handleDragOver ─────────────────────────────────────────────────────────

    describe('handleDragOver', () => {
        test('prevents default and adds drag-over class to target', () => {
            store = createStore([{ id: 1 }, { id: 2 }]);
            controller = new TaskDragController(store, invalidateCaches);

            const item1 = createTaskItem(1);
            const item2 = createTaskItem(2);
            container.appendChild(item1);
            container.appendChild(item2);

            // Set dragSrc to item1
            const startEvent = createDragEvent('dragstart');
            Object.defineProperty(startEvent, 'target', { value: item1 });
            controller.handleDragStart(startEvent);

            // Drag over item2
            const overEvent = createDragEvent('dragover');
            Object.defineProperty(overEvent, 'target', { value: item2 });
            controller.handleDragOver(overEvent);

            expect(overEvent.preventDefault).toHaveBeenCalled();
            expect(item2.classList.contains('drag-over')).toBe(true);
        });
    });

    // ── handleDragEnd ──────────────────────────────────────────────────────────

    test('handleDragEnd clears dragging/drag-over classes and resets dragSrc', () => {
        store = createStore([{ id: 1 }, { id: 2 }]);
        controller = new TaskDragController(store, invalidateCaches);

        const item1 = createTaskItem(1);
        const item2 = createTaskItem(2);
        item1.classList.add('dragging');
        item2.classList.add('drag-over');
        container.appendChild(item1);
        container.appendChild(item2);

        controller.dragSrc = item1;
        controller.handleDragEnd();

        expect(item1.classList.contains('dragging')).toBe(false);
        expect(item2.classList.contains('drag-over')).toBe(false);
        expect(controller.dragSrc).toBeNull();
    });

    // ── handleDrop ─────────────────────────────────────────────────────────────

    describe('handleDrop', () => {
        test('reorders tasks when dragging from one position to another', () => {
            const tasks = [
                { id: 1, title: 'First' },
                { id: 2, title: 'Second' },
                { id: 3, title: 'Third' }
            ];
            store = createStore(tasks);
            controller = new TaskDragController(store, invalidateCaches);

            const item1 = createTaskItem(1, 0);
            const item3 = createTaskItem(3, 2);
            container.appendChild(item1);
            container.appendChild(item3);

            // Set dragSrc to item1
            controller.dragSrc = item1;

            // Drop on item3
            const dropEvent = createDragEvent('drop', { 'text/plain': '1' });
            Object.defineProperty(dropEvent, 'target', { value: item3 });

            controller.handleDrop(dropEvent);

            expect(store.reorderTasks).toHaveBeenCalled();
            expect(invalidateCaches).toHaveBeenCalled();
            expect(dropEvent.stopPropagation).toHaveBeenCalled();
        });

        test('does nothing when dragSrc is null', () => {
            store = createStore([{ id: 1 }, { id: 2 }]);
            controller = new TaskDragController(store, invalidateCaches);
            controller.dragSrc = null;

            const item2 = createTaskItem(2);
            const dropEvent = createDragEvent('drop', { 'text/plain': '1' });
            Object.defineProperty(dropEvent, 'target', { value: item2 });

            controller.handleDrop(dropEvent);

            expect(store.reorderTasks).not.toHaveBeenCalled();
        });

        test('does nothing when dropping on same element', () => {
            store = createStore([{ id: 1 }, { id: 2 }]);
            controller = new TaskDragController(store, invalidateCaches);

            const item1 = createTaskItem(1);
            controller.dragSrc = item1;

            const dropEvent = createDragEvent('drop', { 'text/plain': '1' });
            Object.defineProperty(dropEvent, 'target', { value: item1 }); // same element

            controller.handleDrop(dropEvent);

            expect(store.reorderTasks).not.toHaveBeenCalled();
        });
    });

    // ── attachTo ───────────────────────────────────────────────────────────────

    test('attachTo registers event listeners on container', () => {
        store = createStore([]);
        controller = new TaskDragController(store, invalidateCaches);

        const addEventSpy = jest.spyOn(container, 'addEventListener');
        controller.attachTo(container);

        const registeredEvents = addEventSpy.mock.calls.map(c => c[0]);
        expect(registeredEvents).toContain('dragstart');
        expect(registeredEvents).toContain('dragover');
        expect(registeredEvents).toContain('dragend');
        expect(registeredEvents).toContain('drop');
    });
});
