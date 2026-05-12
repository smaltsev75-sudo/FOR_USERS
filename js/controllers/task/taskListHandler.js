// @ts-check
// js/controllers/task/taskListHandler.js

import { messageService } from '../../services/message.js';
import { fixTaskOrder } from '../../domain/task.js';
import { showSnackbar } from '../../ui/snackbar.js';

/**
 * TaskListHandler — обработчики бизнес-логики задач в списке.
 *
 * Извлечён из TaskController для разделения ответственности.
 * Отвечает за:
 * - Обновление трудозатрат (est) по ролям
 * - Изменение оценок по критериям
 * - Исключение/включение задач в спринт
 * - Удаление задач (с анимацией)
 * - Сортировку по приоритету
 */
export class TaskListHandler {
    /**
     * @param {import('../../state/store.js').Store} store — хранилище состояния
     * @param {import('../../services/numberFormat.js').NumberFormatService} nfs — форматирование чисел
     * @param {import('./taskCacheService.js').TaskCacheService} cache — кэш-сервис
     * @param {Function} getSelectedTaskId — геттер текущей выделенной задачи
     * @param {Function} setSelectedTaskId — сеттер для сброса выделения
     */
    constructor(store, nfs, cache, getSelectedTaskId, setSelectedTaskId) {
        this.store = store;
        this.nfs = nfs;
        this._cache = cache;
        this._getSelectedTaskId = getSelectedTaskId;
        this._setSelectedTaskId = setSelectedTaskId;
    }

    /**
     * Обрабатывает изменение оценки трудозатрат по роли.
     * Обновляет est[roleId] задачи и инвалидирует кэши.
     * @param {Event} e — событие change от input
     */
    handleUpdateEst(e) {
        const input = /** @type {HTMLInputElement} */ (e.target);
        const taskId = +input.dataset.id;
        const roleId = input.dataset.role;
        const state = this.store.getState();
        const task = state.tasks.find(t => t.id === taskId);
        if (!task || task.excluded) return;
        let value = this.nfs.parseNumber(input.value) || 0;
        value = Math.max(0, value);
        const newEst = { ...task.est, [roleId]: value };
        this.store.updateTask(taskId, { est: newEst });
        this._cache.invalidate();
    }

    /**
     * Обрабатывает изменение оценки по критерию.
     * Пересчитывает value = score × weight / 10 и обновляет criteriaEvaluations.
     * @param {Event} e — событие change от select
     */
    handleCriteriaScoreChange(e) {
        const select = /** @type {HTMLSelectElement} */ (e.target);
        const taskId = +select.dataset.id;
        const criterionId = +select.dataset.criterionId;
        const score = select.value;
        const state = this.store.getState();
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return;
        const criterion = state.criteria.find(c => c.id === criterionId);
        if (!criterion) return;

        const evaluations = { ...task.criteriaEvaluations };
        evaluations[criterionId] = {
            score: parseInt(score) || 0,
            value: (parseInt(score) || 0) * criterion.weight / 10
        };
        this.store.updateTask(taskId, { criteriaEvaluations: evaluations });
        this._cache.invalidate();
    }

    /**
     * Переключает исключение задачи из спринта.
     * Анимирует opacity → 0.5 при исключении, затем обновляет store.
     * @param {number} taskId
     */
    handleToggleExclude(taskId) {
        const state = this.store.getState();
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return;
        const newExcluded = task.excluded ? 0 : 1;
        const updates = {
            excluded: newExcluded,
            exclusionReason: newExcluded ? 'Исключена вручную' : ''
        };
        const applyExclusion = () => {
            this.store.updateTask(taskId, updates);
            this._cache.invalidate();
            const fixedTasks = fixTaskOrder(this.store.getState().tasks);
            this.store.setTasks(fixedTasks);
        };
        const taskElement = /** @type {HTMLElement|null} */ (document.querySelector(`.task-item[data-id="${taskId}"]`));
        if (taskElement) {
            taskElement.style.transition = 'opacity 0.3s ease';
            taskElement.style.opacity = newExcluded ? '0.5' : '1';
            setTimeout(applyExclusion, 300);
        } else {
            applyExclusion();
        }
    }

    /**
     * Удаляет задачу с анимацией (.removing → 300мс → deleteTask).
     * @param {number} taskId
     */
    handleDeleteTask(taskId) {
        const state = this.store.getState();
        const taskIndex = state.tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return;
        const deletedTask = { ...state.tasks[taskIndex] };
        const tasksBefore = [...state.tasks];

        // Удаляем сразу (с анимацией)
        const taskElement = /** @type {HTMLElement|null} */ (document.querySelector(`.task-item[data-id="${taskId}"]`));
        if (taskElement) {
            taskElement.classList.add('removing');
            setTimeout(() => {
                this.store.deleteTask(taskId);
                if (this._getSelectedTaskId() === taskId) this._setSelectedTaskId(null);
                this._cache.invalidate();
            }, 300);
        } else {
            this.store.deleteTask(taskId);
            if (this._getSelectedTaskId() === taskId) this._setSelectedTaskId(null);
            this._cache.invalidate();
        }

        // Snackbar с кнопкой «Отменить»
        showSnackbar(`Задача «${deletedTask.title}» удалена`, {
            onUndo: () => {
                this.store.setTasks(tasksBefore);
                this._cache.invalidate();
            }
        });
    }

    /** Удаляет все задачи с подтверждением. */
    handleDeleteAll() {
        messageService.showConfirm('Удалить все задачи?', () => {
            const tasksBefore = [...this.store.getState().tasks];

            this.store.setTasks([]);
            this._setSelectedTaskId(null);
            this._cache.invalidate();

            showSnackbar(`Удалено ${tasksBefore.length} задач`, {
                onUndo: () => {
                    this.store.setTasks(tasksBefore);
                    this._cache.invalidate();
                }
            });
        });
    }

    /**
     * Сортирует задачи по убыванию Priority Score.
     * Использует кэшированные значения из TaskCacheService.
     */
    handleSortByPriority() {
        if (!this._cache.isReady()) {
            messageService.showMessage('calculatePriorityScore не определено');
            return;
        }
        const state = this.store.getState();
        const criteria = state.criteria;
        const sorted = [...state.tasks].sort((a, b) => {
            const scoreA = this._cache.getCachedPriorityScore(a, criteria);
            const scoreB = this._cache.getCachedPriorityScore(b, criteria);
            return scoreB - scoreA;
        });
        const fixed = fixTaskOrder(sorted);
        this.store.reorderTasks(fixed);
    }
}
