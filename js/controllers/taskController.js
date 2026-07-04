// js/controllers/taskController.js

import { parseCriteriaScore } from '../domain/criteria.js';
import { showModal, hideModal } from '../ui/modalManager.js';
import { TaskCacheService } from './task/taskCacheService.js';
import { TaskFormController } from './task/taskFormController.js';
import { TaskDragController } from './task/taskDragController.js';
import { TaskListHandler } from './task/taskListHandler.js';
import { wireTaskControllerEvents } from './task/taskEventWiring.js';

/**
 * TaskController — главный контроллер управления задачами.
 *
 * Отвечает за:
 * - Подключение обработчиков событий к DOM-элементам списка задач
 * - Проксирование вызовов к TaskFormController (создание/редактирование)
 * - Проксирование вызовов к TaskDragController (drag & drop)
 * - Кэширование priority-score через TaskCacheService
 * - Обновление трудозатрат, критериев, исключение/удаление задач
 * - Выделение задачи в списке (selectedTaskId)
 * - Сортировку по приоритету
 */
export class TaskController {
    /**
     * @param {import('../state/store.js').Store} store — единое хранилище состояния
     * @param {import('../services/numberFormat.js').NumberFormatService} numberFormatService — форматирование чисел
     */
    constructor(store, numberFormatService) {
        this.store = store;
        this.nfs = numberFormatService;
        this.selectedTaskId = null;
        this._cache = new TaskCacheService();

        this._form = new TaskFormController(
            store,
            numberFormatService,
            (newTask) => this._onTaskCreated(newTask),
            null,
            () => this.invalidateCaches()
        );

        // W37: drag держит рендер (re-render рвёт перетаскивание). Канал
        // мутабельный — RenderScheduler создаётся в App ПОСЛЕ контроллера и
        // подключается через setRenderHoldCallback.
        this._renderHold = () => {};
        this._drag = new TaskDragController(
            store,
            () => this.invalidateCaches(),
            (held) => this._renderHold(held)
        );

        this._list = new TaskListHandler(
            store, numberFormatService, this._cache,
            () => this.selectedTaskId,
            (id) => { this.selectedTaskId = id; }
        );
    }

    init() {
        this.attachEvents();
    }

    /**
     * W37: подключает hold-канал рендера (RenderScheduler.setHold) к drag'у.
     * @param {(held: boolean) => void} fn
     */
    setRenderHoldCallback(fn) {
        if (typeof fn === 'function') this._renderHold = fn;
    }

    attachEvents() {
        wireTaskControllerEvents(this);
    }

    /**
     * CTRL-1 (DEEP-REFAC 2026-06-21): общий MutationObserver-паттерн — дождаться
     * появления узла по selector в #taskList, затем disconnect + onFound, с
     * safety-disconnect через safetyMs. Извлечён из _onTaskCreated и
     * handleToggleExclude (был дублирован).
     * @param {string} selector
     * @param {(el: Element) => void} onFound
     * @param {{ safetyMs?: number }} [opts]
     * @private
     */
    _observeTaskAppearance(selector, onFound, { safetyMs = 3000 } = {}) {
        const taskList = document.getElementById('taskList');
        if (!taskList) return;
        const observer = new MutationObserver(() => {
            const el = taskList.querySelector(selector);
            if (el) {
                observer.disconnect();
                onFound(el);
            }
        });
        observer.observe(taskList, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), safetyMs);
    }

    /**
     * Callback после создания задачи.
     * Использует MutationObserver для отслеживания появления новой задачи в DOM,
     * чтобы автоматически выделить её (selectTask) и запустить таймер сброса подсветки.
     * @param {Object} newTask — только что созданная задача
     * @private
     */
    _onTaskCreated(newTask) {
        this._observeTaskAppearance(`.task-item[data-id="${newTask.id}"]`, () => {
            this.selectTask(newTask.id);
            setTimeout(() => {
                if (this.store.getState().lastAddedTaskId === newTask.id) {
                    this.store.updateState({ lastAddedTaskId: null });
                }
            }, 5000);
        });
    }

    // ---------- Прокси-методы для обратной совместимости с внешними вызовами ----------
    openCreateModal() { this._form.openCreateModal(); }
    closeCreateModal() { this._form.closeCreateModal(); }
    openEditModal(id) { this._form.openEditModal(id); }
    closeEditModal() { this._form.closeEditModal(); }
    handleAddTask() { return this._form.handleAddTask(); }
    handleAddTaskWithSelect() { return this._form.handleAddTask(); }

    // ---------- Кеширование ----------
    getCachedPriorityScore(task) {
        const criteria = this.store.getState().criteria;
        return this._cache.getCachedPriorityScore(task, criteria);
    }

    getCachedRoleLoad() {
        const { tasks, roles, config } = this.store.getState();
        return this._cache.getCachedRoleLoad(tasks, roles, config);
    }

    invalidateCaches() {
        this._cache.invalidate();
    }

    /**
     * Обрабатывает изменение оценки трудозатрат по роли.
     * @param {Event} e
     */
    handleUpdateEst(e) { this._list.handleUpdateEst(e); }

    /**
     * Открывает модалку комментария SM (#noteModal) для задачи id, заполняя
     * текущим значением task.note. Сохранение — _saveNote (кнопка «Сохранить»).
     */
    handleOpenNote(id) {
        const task = (this.store.getState().tasks || []).find(t => t.id === id);
        if (!task) return;
        this._noteTaskId = id;
        const input = document.getElementById('noteModalInput');
        if (input) { input.value = typeof task.note === 'string' ? task.note : ''; }
        this._updateNoteCounter();
        const modal = document.getElementById('noteModal');
        if (modal) showModal(modal);
    }

    /** Сохраняет комментарий SM из модалки в задачу (до 500 симв) и закрывает окно. */
    _saveNote() {
        const input = document.getElementById('noteModalInput');
        const id = this._noteTaskId;
        if (Number.isFinite(id) && input) {
            this.store.updateTask(id, { note: String(input.value || '').slice(0, 500) });
        }
        const modal = document.getElementById('noteModal');
        if (modal) hideModal(modal);
    }

    /** Обновляет счётчик оставшихся символов в модалке комментария. */
    _updateNoteCounter() {
        const input = document.getElementById('noteModalInput');
        const counter = document.getElementById('noteModalCounter');
        if (input && counter) counter.textContent = `Осталось: ${Math.max(0, 500 - input.value.length)}`;
    }

    /** Обрабатывает прямое изменение оценки по критерию. */
    handleCriteriaScoreChange(e) {
        this._syncCriteriaScoreControls(e.target);
        this._list.handleCriteriaScoreChange(e);
    }

    /**
     * Keeps the changed control aligned with the strict score parser before
     * delegating to taskList state mutation.
     * @param {EventTarget|null} target
     */
    _syncCriteriaScoreControls(target) {
        if (!target || !('value' in target)) return;
        const normalizedScore = String(parseCriteriaScore(target.value));
        target.value = normalizedScore;
    }

    /** Переключает исключение задачи. */
    handleToggleExclude(taskId) {
        const task = this.store.getState().tasks.find(t => t.id === taskId);
        const wasExcluded = task && task.excluded;

        // При включении: ставим selectedTaskId ДО ре-рендера
        if (wasExcluded) {
            this.selectedTaskId = taskId;
        }

        this._list.handleToggleExclude(taskId);

        // При включении: ждём появления задачи без класса excluded (CTRL-1 helper,
        // паттерн идентичен _onTaskCreated — не зависит от таймингов rAF).
        if (wasExcluded) {
            this._observeTaskAppearance(`.task-item[data-id="${taskId}"]:not(.excluded)`, () => {
                this.selectTask(taskId, true);
            });
        }
    }

    /** Удаляет задачу с анимацией. */
    handleDeleteTask(taskId) { this._list.handleDeleteTask(taskId); }

    /** Удаляет все задачи. */
    handleDeleteAll() { this._list.handleDeleteAll(); }

    /** Сортирует по приоритету. */
    handleSortByPriority() { this._list.handleSortByPriority(); }

    /** Перемещает задачу на одну позицию вверх/вниз. */
    handleMoveTask(taskId, direction) { this._list.handleMoveTask(taskId, direction); }

    setPriorityScoreCalculator(fn) {
        this._cache.setPriorityScoreCalculator(fn);
    }

    /**
     * Выделяет задачу в списке (добавляет CSS-класс .selected-task и скроллит).
     * @param {number} taskId — ID задачи для выделения
     * @param {boolean} [forceScroll=false] — принудительная прокрутка (даже если элемент видим)
     */
    selectTask(taskId, forceScroll = false) {
        if (!taskId) return;
        const state = this.store.getState();
        const taskExists = state.tasks.some((task) => task.id === taskId);
        if (!taskExists) return;
        this.selectedTaskId = taskId;
        const allTaskItems = document.querySelectorAll('.task-item');
        allTaskItems.forEach((item) => {
            const itemId = Number(item.dataset.id);
            if (itemId === taskId) {
                item.classList.add('selected-task');
                // Прокрутка, если элемент не виден ИЛИ forceScroll
                const rect = item.getBoundingClientRect();
                const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
                if (forceScroll || !inView) {
                    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else {
                item.classList.remove('selected-task');
            }
        });
    }

    /** Снимает выделение со всех задач. */
    deselectTask() {
        this.selectedTaskId = null;
        document.querySelectorAll('.task-item.selected-task').forEach((item) => {
            item.classList.remove('selected-task');
        });
    }
}
