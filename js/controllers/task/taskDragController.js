// js/controllers/task/taskDragController.js
import { parseStrictIntegerInRange } from '../../domain/strictInteger.js';
import { isInteractiveTaskTarget } from './taskFlowActions.js';

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
        this.pointerDrag = null;
        this._handlePointerMove = this.handlePointerMove.bind(this);
        this._handlePointerUp = this.handlePointerUp.bind(this);
    }

    /**
     * Attaches drag-and-drop event listeners to the task list container.
     * Drag разрешён с ручки .drag-handle и с неинтерактивной области карточки:
     * - mousedown на button/input/select/link → draggable=false
     * - mousedown на .drag-handle → native draggable=true
     * - mousedown на title/comment/пустой области/header → mouse-fallback reorder
     * @param {HTMLElement} taskListEl
     */
    attachTo(taskListEl) {
        // Native draggable оставляем только для ручки. Тело карточки использует
        // mouse-fallback ниже: так вложенные title/comment не зависят от HTML5
        // drag quirks и при этом кнопки/inputs не становятся drag source.
        taskListEl.addEventListener('mousedown', (e) => {
            const handle = /** @type {Element} */ (e.target).closest('.drag-handle');
            const item = /** @type {Element} */ (e.target).closest('.task-item');
            if (item) {
                const isInteractive = isInteractiveTaskTarget(e.target);
                item.draggable = Boolean(handle && !isInteractive);
                this.pointerDrag = isInteractive ? null : {
                    item,
                    startX: e.clientX,
                    startY: e.clientY,
                    active: false
                };
            }
        });

        taskListEl.addEventListener('dragstart', (e) => this.handleDragStart(e));
        taskListEl.addEventListener('dragover', (e) => this.handleDragOver(e));
        taskListEl.addEventListener('dragend', () => this.handleDragEnd());
        taskListEl.addEventListener('drop', (e) => this.handleDrop(e));
        taskListEl.ownerDocument.addEventListener('mousemove', this._handlePointerMove);
        taskListEl.ownerDocument.addEventListener('mouseup', this._handlePointerUp);
    }

    handleDragStart(e) {
        const item = /** @type {Element} */ (e.target).closest('.task-item');
        if (!item) return;
        this.dragSrc = item;
        if (this.pointerDrag?.item === item) this.pointerDrag.active = true;
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
        this.clearDragClasses();
        this.dragSrc = null;
    }

    handleDrop(e) {
        e.stopPropagation();
        const overItem = e.target.closest('.task-item');
        if (!this.dragSrc || !overItem || this.dragSrc === overItem) return false;

        const draggedId = parseStrictIntegerInRange(e.dataTransfer.getData('text/plain'), 1, Infinity);
        const targetId = parseStrictIntegerInRange(overItem.dataset.id, 1, Infinity);
        const result = this.reorderByIds(draggedId, targetId);
        this.pointerDrag = null;
        return result;
    }

    handlePointerMove(e) {
        if (!this.pointerDrag || this.dragSrc) return;
        const distance = Math.hypot(e.clientX - this.pointerDrag.startX, e.clientY - this.pointerDrag.startY);
        if (distance < 8) return;

        this.pointerDrag.active = true;
        this.pointerDrag.item.classList.add('dragging');
        const overItem = this.getTaskItemAtPoint(e.clientX, e.clientY, this.pointerDrag.item);
        document.querySelectorAll('.task-item').forEach(i => i.classList.remove('drag-over'));
        if (overItem && overItem !== this.pointerDrag.item) {
            overItem.classList.add('drag-over');
        }
    }

    handlePointerUp(e) {
        if (!this.pointerDrag) return;
        const pointerDrag = this.pointerDrag;
        this.pointerDrag = null;

        if (pointerDrag.active) {
            const overItem = this.getTaskItemAtPoint(e.clientX, e.clientY, pointerDrag.item);
            if (overItem && overItem !== pointerDrag.item) {
                const draggedId = parseStrictIntegerInRange(pointerDrag.item.dataset.id, 1, Infinity);
                const targetId = parseStrictIntegerInRange(overItem.dataset.id, 1, Infinity);
                this.reorderByIds(draggedId, targetId);
                e.preventDefault?.();
            }
        }
        this.clearDragClasses();
    }

    getTaskItemAtPoint(clientX, clientY, excludeItem = null) {
        const directItem = document.elementFromPoint(clientX, clientY)?.closest('.task-item') || null;
        if (directItem && directItem !== excludeItem) return directItem;

        const candidates = [...document.querySelectorAll('.task-item')]
            .filter(item => item !== excludeItem);
        let nearest = null;
        let nearestDistance = Infinity;
        for (const item of candidates) {
            const rect = item.getBoundingClientRect();
            const insideY = clientY >= rect.top && clientY <= rect.bottom;
            const insideX = clientX >= rect.left && clientX <= rect.right;
            if (insideY && insideX) return item;
            const centerY = rect.top + rect.height / 2;
            const distance = Math.abs(clientY - centerY);
            if (distance < nearestDistance) {
                nearest = item;
                nearestDistance = distance;
            }
        }
        return nearest;
    }

    clearDragClasses() {
        document.querySelectorAll('.task-item').forEach(i => i.classList.remove('dragging', 'drag-over'));
    }

    reorderByIds(draggedId, targetId) {
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
