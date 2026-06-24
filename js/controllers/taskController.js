// js/controllers/taskController.js

import { parseCriteriaScore } from '../domain/criteria.js';
import { showModal, hideModal } from '../ui/modalManager.js';
import { TaskCacheService } from './task/taskCacheService.js';
import { TaskFormController } from './task/taskFormController.js';
import { TaskDragController } from './task/taskDragController.js';
import { TaskListHandler } from './task/taskListHandler.js';
import {
    isInteractiveTaskTarget,
    isPrimaryTaskFormShortcut,
    readTaskListButtonAction,
    submitTaskFormAction
} from './task/taskFlowActions.js';

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

    // CTRL-4 (DEEP-REFAC 2026-06-21): attachEvents разбит на приватные wiring-
    // методы без смены поведения — порядок регистрации listener'ов сохранён
    // (важно для click-делегации на #taskList, где обработчики closest-гейтят
    // свои селекторы по порядку). Каждый метод содержит свой блок verbatim.
    attachEvents() {
        this._wireFormButtons();
        this._wireCreateCriteriaDelegation();
        this._wireListActions();
        this._wireTaskListDelegation();
        this._wireNoteModalAndDrag();
        this._wireGlobalDeselect();
        this._wireCommentAndShortcuts();
        this._wireFilters();
    }

    /** @private */
    _wireFormButtons() {
        // ➕ Новая задача
        const addBtn = document.getElementById('addTaskBtn');
        if (addBtn) addBtn.addEventListener('click', () => this._form.openCreateModal());

        // v8.27: единый task-form modal — close/cancel/save диспатчат
        // по this._form.editId (если != null → edit, иначе → create).
        const closeCreateBtn = document.getElementById('closeCreateModalBtn');
        if (closeCreateBtn) closeCreateBtn.addEventListener('click', () => {
            if (this._form.editId !== null) this._form.closeEditModal();
            else this._form.closeCreateModal();
        });

        const cancelCreateBtn = document.getElementById('cancelCreateBtn');
        if (cancelCreateBtn) cancelCreateBtn.addEventListener('click', () => {
            if (this._form.editId !== null) this._form.closeEditModal();
            else this._form.closeCreateModal();
        });

        const saveCreateBtn = document.getElementById('saveCreateBtn');
        if (saveCreateBtn) {
            saveCreateBtn.addEventListener('click', () => {
                submitTaskFormAction(this._form);
            });
        }
    }

    /** @private */
    _wireCreateCriteriaDelegation() {
        // Делегация мероприятия для изменения критериев отбора
        const criteriaContainer = document.getElementById('createCriteriaContainer');
        if (criteriaContainer) {
            criteriaContainer.addEventListener('change', (e) => {
                if (e.target.classList.contains('criteria-score-select')) {
                    this._form.updateCreateFormPriorityScore();
                }
            });

            // Шкала-полоса критериев: 1 клик по делению → значение.
            criteriaContainer.addEventListener('click', (e) => {
                const tick = e.target.closest('.cf-scale__tick');
                if (!tick) return;
                const scale = tick.closest('.cf-scale');
                if (!scale) return;
                this._form.setCriteriaScaleValue(scale.dataset.criterionId, Number(tick.dataset.value), { dispatch: true });
            });

            // Клавиатура на шкале (role="slider"): ←/↓ −1, →/↑ +1, Home 0, End 10.
            criteriaContainer.addEventListener('keydown', (e) => {
                const scale = e.target.closest && e.target.closest('.cf-scale');
                if (!scale) return;
                const cur = Number(scale.getAttribute('aria-valuenow')) || 0;
                let next;
                if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = cur + 1;
                else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = cur - 1;
                else if (e.key === 'Home') next = 0;
                else if (e.key === 'End') next = 10;
                else return;
                e.preventDefault();
                this._form.setCriteriaScaleValue(scale.dataset.criterionId, next, { dispatch: true });
            });
        }
    }

    /** @private */
    _wireListActions() {
        // Кнопка «Сортировать по приоритету»
        const sortBtn = document.getElementById('sortByPriorityBtn');
        if (sortBtn) sortBtn.addEventListener('click', () => this.handleSortByPriority());

        // Кнопка «Удалить все задачи»
        const deleteAllBtn = document.getElementById('deleteAllTasksBtn');
        if (deleteAllBtn) deleteAllBtn.addEventListener('click', () => this.handleDeleteAll());
    }

    /** @private */
    _wireTaskListDelegation() {
        // Список задач – обработчики событий
        const taskList = document.getElementById('taskList');
        if (taskList) {
            taskList.addEventListener('click', (e) => {
                const taskItem = e.target.closest('.task-item');
                if (!taskItem) return;
                if (isInteractiveTaskTarget(e.target)) return;
                this.selectTask(Number(taskItem.dataset.id));
            });

            taskList.addEventListener('focusin', (e) => {
                const taskItem = e.target.closest('.task-item');
                if (!taskItem) return;
                // Не вызываем selectTask при фокусе на интерактивных элементах,
                // чтобы scrollIntoView не сдвигал кнопку из-под курсора
                if (isInteractiveTaskTarget(e.target)) return;
                this.selectTask(Number(taskItem.dataset.id));
            });

            taskList.addEventListener('change', (e) => {
                if (e.target.dataset.action === 'updateEst') this.handleUpdateEst(e);
                if (e.target.classList?.contains('criteria-score-input')
                    || e.target.classList?.contains('criteria-score-select')) {
                    this.handleCriteriaScoreChange(e);
                }
            });

            // v8.30.24: live cap для inline est inputs через делегацию `input`
            // event (P1.1 fix — раньше handleInput не вызывался ни в одном
            // production code-path). DOM ephemeral — делегация на родителе
            // корректнее, чем listener-in-render.
            taskList.addEventListener('input', (e) => {
                if (e.target.dataset.action === 'updateEst') {
                    this.nfs.handleInput(e.target);
                }
            });

            taskList.addEventListener('click', (e) => {
                const buttonAction = readTaskListButtonAction(e.target);
                if (!buttonAction) return;
                const { action, id } = buttonAction;
                if (action === 'edit') this._form.openEditModal(id);
                else if (action === 'moveUp') this.handleMoveTask(id, 'up');
                else if (action === 'moveDown') this.handleMoveTask(id, 'down');
                else if (action === 'toggleExclude') this.handleToggleExclude(id);
                else if (action === 'delete') this.handleDeleteTask(id);
                else if (action === 'openNote') this.handleOpenNote(id);
            });
        }
    }

    /** @private */
    _wireNoteModalAndDrag() {
        // Модалка комментария SM (#noteModal): открытие из иконки строки задачи.
        const saveNoteBtn = document.getElementById('saveNoteBtn');
        if (saveNoteBtn) saveNoteBtn.addEventListener('click', () => this._saveNote());
        const closeNote = () => { const m = document.getElementById('noteModal'); if (m) hideModal(m); };
        document.getElementById('cancelNoteBtn')?.addEventListener('click', closeNote);
        document.getElementById('closeNoteModalBtn')?.addEventListener('click', closeNote);
        document.getElementById('noteModalInput')?.addEventListener('input', () => this._updateNoteCounter());
        const taskList = document.getElementById('taskList');
        if (taskList) {
            this._drag.attachTo(taskList);
        }
    }

    /** @private */
    _wireGlobalDeselect() {
        // Снятие выделения при клике вне области задачи
        document.addEventListener('click', (e) => {
            if (!this.selectedTaskId) return;
            if (e.target.closest('.task-item')) return;
            this.deselectTask();
        });
    }

    /** @private */
    _wireCommentAndShortcuts() {
        // v8.27: counter-обновление + Ctrl+S/Ctrl+Enter навешены на единый
        // newComment / createTaskModal (отдельный editModal удалён).
        const newCommentEl = document.getElementById('newComment');
        if (newCommentEl) {
            newCommentEl.addEventListener('input', (e) => {
                this._form.updateCommentCounter(e.target.value.length, 255);
            });
        }

        const taskFormModal = document.getElementById('createTaskModal');
        if (taskFormModal) {
            taskFormModal.addEventListener('keydown', (e) => {
                // Ctrl+Enter / Ctrl+S — primary action в любом режиме (create или edit)
                if (isPrimaryTaskFormShortcut(e)) {
                    e.preventDefault();
                    submitTaskFormAction(this._form);
                }
            });
        }
    }

    /** @private */
    _wireFilters() {
        // Фильтры
        const searchInput = document.getElementById('taskSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.store.setTaskFilter({ search: searchInput.value });
            });
        }

        const typeFilter = document.getElementById('taskTypeFilter');
        if (typeFilter) {
            typeFilter.addEventListener('change', () => {
                this.store.setTaskFilter({ type: typeFilter.value });
            });
        }
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
