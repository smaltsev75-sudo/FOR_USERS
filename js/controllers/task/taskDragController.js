// js/controllers/task/taskDragController.js
import { parseStrictIntegerInRange } from '../../domain/strictInteger.js';

/**
 * Handles drag-and-drop reordering of task items.
 * Extracted from TaskController to keep it focused on orchestration.
 */
export class TaskDragController {
    /**
     * @param {import('../../state/store.js').Store} store
     * @param {Function} invalidateCaches - callback to invalidate parent caches
     */
    constructor(store, invalidateCaches) {
        this.store = store;
        this._invalidateCaches = invalidateCaches;
        this.dragSrc = null;
    }

    /**
     * Attaches drag-and-drop event listeners to the task list container.
     * Drag разрешён только с ручки .drag-handle:
     * - mousedown на .drag-handle → ставим draggable=true на карточку
     * - mousedown на что-либо другое → draggable=false (кнопки работают нормально)
     * @param {HTMLElement} taskListEl
     */
    attachTo(taskListEl) {
        // Управляем draggable через mousedown
        taskListEl.addEventListener('mousedown', (e) => {
            const handle = /** @type {Element} */ (e.target).closest('.drag-handle');
            const item = /** @type {Element} */ (e.target).closest('.task-item');
            if (item) {
                item.draggable = !!handle;
            }
        });

        taskListEl.addEventListener('dragstart', (e) => this.handleDragStart(e));
        taskListEl.addEventListener('dragover', (e) => this.handleDragOver(e));
        taskListEl.addEventListener('dragend', () => this.handleDragEnd());
        taskListEl.addEventListener('drop', (e) => this.handleDrop(e));
    }

    handleDragStart(e) {
        const item = /** @type {Element} */ (e.target).closest('.task-item');
        if (!item) return;
        this.dragSrc = item;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.dataset.id);
        item.classList.add('dragging');
    }

    handleDragOver(e) {
        e.preventDefault();
        const overItem = e.target.closest('.task-item');
        if (overItem && overItem !== this.dragSrc) {
            document.querySelectorAll('.task-item').forEach(i => i.classList.remove('drag-over'));
            overItem.classList.add('drag-over');
        }
    }

    handleDragEnd() {
        document.querySelectorAll('.task-item').forEach(i => i.classList.remove('dragging', 'drag-over'));
        this.dragSrc = null;
    }

    handleDrop(e) {
        e.stopPropagation();
        const overItem = e.target.closest('.task-item');
        if (!this.dragSrc || !overItem || this.dragSrc === overItem) return false;

        const draggedId = parseStrictIntegerInRange(e.dataTransfer.getData('text/plain'), 1, Infinity);
        const targetId = parseStrictIntegerInRange(overItem.dataset.id, 1, Infinity);
        if (draggedId === null || targetId === null) return false;

        const tasks = [...this.store.getState().tasks];
        const draggedIndex = tasks.findIndex(t => t.id === draggedId);
        const targetIndex = tasks.findIndex(t => t.id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) return false;

        const [moved] = tasks.splice(draggedIndex, 1);
        tasks.splice(targetIndex, 0, moved);

        this.store.reorderTasks(tasks);
        this._invalidateCaches();
        return false;
    }
}
