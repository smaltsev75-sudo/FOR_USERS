// js/controllers/taskController.js

import { messageService } from '../services/message.js';
import { fixTaskOrder } from '../domain/task.js';
import { ROLES } from '../utils/constants.js';
import { TaskCacheService } from './task/taskCacheService.js';
import { TaskFormController } from './task/taskFormController.js';
import { TaskDragController } from './task/taskDragController.js';
import { TaskListHandler } from './task/taskListHandler.js';

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

        this._drag = new TaskDragController(store, () => this.invalidateCaches());

        this._list = new TaskListHandler(
            store, numberFormatService, this._cache,
            () => this.selectedTaskId,
            (id) => { this.selectedTaskId = id; }
        );
    }

    init() {
        this.attachEvents();
    }

    attachEvents() {
        // ➕ Новая задача
        const addBtn = document.getElementById('addTaskBtn');
        if (addBtn) addBtn.addEventListener('click', () => this._form.openCreateModal());

        // Обработчики модального окна создания
        const closeCreateBtn = document.getElementById('closeCreateModalBtn');
        if (closeCreateBtn) closeCreateBtn.addEventListener('click', () => this._form.closeCreateModal());

        const cancelCreateBtn = document.getElementById('cancelCreateBtn');
        if (cancelCreateBtn) cancelCreateBtn.addEventListener('click', () => this._form.closeCreateModal());

        const saveCreateBtn = document.getElementById('saveCreateBtn');
        if (saveCreateBtn) {
            saveCreateBtn.addEventListener('click', () => {
                if (this._form.handleAddTask()) {
                    setTimeout(() => this._form.closeCreateModal(), 1200);
                }
            });
        }

        // Обработчики событий для полей оценки (обновить общие затраты и формат)
        ROLES.map(r => `h_${r.id}`).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value);
                    if (val < 0) {
                        e.target.value = 0;
                    }
                    this._form.updateCreateFormTotal();
                });
                el.addEventListener('blur', (e) => {
                    const raw = e.target.value;
                    let num = this.nfs.parseNumber(raw);
                    if (isNaN(num) || num < 0) {
                        num = 0;
                    }
                    num = Math.round(num * 10) / 10;
                    e.target.value = this.nfs.formatNumber(num, 1);
                    this._form.updateCreateFormTotal();
                });
            }
        });

        // Делегация мероприятия для изменения критериев отбора
        const criteriaContainer = document.getElementById('createCriteriaContainer');
        if (criteriaContainer) {
            criteriaContainer.addEventListener('change', (e) => {
                if (e.target.classList.contains('criteria-score-select')) {
                    this._form.updateCreateFormPriorityScore();
                }
            });
        }

        // Кнопка «Сортировать по приоритету»
        const sortBtn = document.getElementById('sortByPriorityBtn');
        if (sortBtn) sortBtn.addEventListener('click', () => this.handleSortByPriority());

        // Кнопка «Удалить все задачи»
        const deleteAllBtn = document.getElementById('deleteAllTasksBtn');
        if (deleteAllBtn) deleteAllBtn.addEventListener('click', () => this.handleDeleteAll());

        // Список задач – обработчики событий
        const taskList = document.getElementById('taskList');
        if (taskList) {
            taskList.addEventListener('click', (e) => {
                const taskItem = e.target.closest('.task-item');
                if (!taskItem) return;
                if (e.target.closest('button, a, select, input, textarea')) return;
                this.selectTask(Number(taskItem.dataset.id));
            });

            taskList.addEventListener('focusin', (e) => {
                const taskItem = e.target.closest('.task-item');
                if (!taskItem) return;
                // Не вызываем selectTask при фокусе на интерактивных элементах,
                // чтобы scrollIntoView не сдвигал кнопку из-под курсора
                if (e.target.closest('button, a, select, input, textarea')) return;
                this.selectTask(Number(taskItem.dataset.id));
            });

            taskList.addEventListener('change', (e) => {
                if (e.target.dataset.action === 'updateEst') this.handleUpdateEst(e);
                if (e.target.classList.contains('criteria-score-select')) this.handleCriteriaScoreChange(e);
            });

            taskList.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;
                const action = btn.dataset.action;
                const id = +btn.dataset.id;
                if (action === 'edit') this._form.openEditModal(id);
                else if (action === 'toggleExclude') this.handleToggleExclude(id);
                else if (action === 'delete') this.handleDeleteTask(id);
            });

            this._drag.attachTo(taskList);
        }

        // Снятие выделения при клике вне области задачи
        document.addEventListener('click', (e) => {
            if (!this.selectedTaskId) return;
            if (e.target.closest('.task-item')) return;
            this.deselectTask();
        });

        // Редактирование задачи
        const closeEditBtn = document.getElementById('closeEditModalBtn');
        if (closeEditBtn) closeEditBtn.addEventListener('click', () => this._form.closeEditModal());

        const cancelEditBtn = document.getElementById('cancelEditBtn');
        if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => this._form.closeEditModal());

        const saveEditBtn = document.getElementById('saveTaskEditBtn');
        if (saveEditBtn) saveEditBtn.addEventListener('click', () => this._form.handleSaveEdit());

        const editComment = document.getElementById('editComment');
        if (editComment) {
            editComment.addEventListener('input', (e) => {
                const counter = document.getElementById('editCommentCounter');
                if (counter) counter.textContent = e.target.value.length + '/255';
            });
        }

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
     * Callback после создания задачи.
     * Использует MutationObserver для отслеживания появления новой задачи в DOM,
     * чтобы автоматически выделить её (selectTask) и запустить таймер сброса подсветки.
     * @param {Object} newTask — только что созданная задача
     * @private
     */
    _onTaskCreated(newTask) {
        const taskList = document.getElementById('taskList');
        if (taskList) {
            const observer = new MutationObserver(() => {
                const taskElement = taskList.querySelector(`.task-item[data-id="${newTask.id}"]`);
                if (taskElement) {
                    observer.disconnect();
                    this.selectTask(newTask.id);
                    setTimeout(() => {
                        if (this.store.getState().lastAddedTaskId === newTask.id) {
                            this.store.updateState({ lastAddedTaskId: null });
                        }
                    }, 5000);
                }
            });
            observer.observe(taskList, { childList: true, subtree: true });
            setTimeout(() => observer.disconnect(), 3000);
        }
    }

    // ---------- Прокси-методы для обратной совместимости с внешними вызовами ----------
    openCreateModal() { this._form.openCreateModal(); }
    closeCreateModal() { this._form.closeCreateModal(); }
    openEditModal(id) { this._form.openEditModal(id); }
    closeEditModal() { this._form.closeEditModal(); }
    handleAddTask() { return this._form.handleAddTask(); }
    handleAddTaskWithSelect() { return this._form.handleAddTask(); }
    updateCreateFormTotal() { this._form.updateCreateFormTotal(); }

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
     * Обрабатывает изменение оценки по критерию.
     * @param {Event} e
     */
    handleCriteriaScoreChange(e) { this._list.handleCriteriaScoreChange(e); }

    /** Переключает исключение задачи. */
    handleToggleExclude(taskId) {
        const task = this.store.getState().tasks.find(t => t.id === taskId);
        const wasExcluded = task && task.excluded;

        // При включении: ставим selectedTaskId ДО ре-рендера
        if (wasExcluded) {
            this.selectedTaskId = taskId;
        }

        this._list.handleToggleExclude(taskId);

        // При включении: MutationObserver ждёт появления задачи без класса excluded
        // Паттерн аналогичен _onTaskCreated — не зависит от таймингов rAF
        if (wasExcluded) {
            const taskList = document.getElementById('taskList');
            if (taskList) {
                const observer = new MutationObserver(() => {
                    const el = taskList.querySelector(`.task-item[data-id="${taskId}"]:not(.excluded)`);
                    if (el) {
                        observer.disconnect();
                        this.selectTask(taskId, true);
                    }
                });
                observer.observe(taskList, { childList: true, subtree: true });
                setTimeout(() => observer.disconnect(), 3000);
            }
        }
    }

    /** Удаляет задачу с анимацией. */
    handleDeleteTask(taskId) { this._list.handleDeleteTask(taskId); }

    /** Удаляет все задачи. */
    handleDeleteAll() { this._list.handleDeleteAll(); }

    /** Сортирует по приоритету. */
    handleSortByPriority() { this._list.handleSortByPriority(); }

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
