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
        // v8.30.24: live cap уже применён через taskList render (input listener
        // подключает nfs.handleInput). Здесь — округление в state до 2 знаков,
        // чтобы priority/effort расчёты не работали с raw arithmetic-precision.
        let value = this.nfs.parseNumber(input.value) || 0;
        value = Math.max(0, this.nfs.roundToDecimals(value, 2));
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
     *
     * v8.30.31: undo полностью переработан после внешнего аудита.
     * Старый подход:
     *   - Полный snapshot `tasksBefore = [...state.tasks]` при delete.
     *   - На undo: `store.setTasks(tasksBefore)` — восстанавливает stale state,
     *     стирая любые правки сделанные между delete и undo (новые задачи,
     *     изменения других задач).
     *   - Pending 300ms timer не отменялся → undo до timer'а двойной delete.
     * Новый подход:
     *   - Snapshot ТОЛЬКО удалённой задачи + её индекс.
     *   - Pending timer — локальная переменная замыкания (не this._pending…,
     *     иначе второй delete перетирает таймер первого).
     *   - На undo: insertTaskAt(deletedTask, originalIndex) — восстанавливает
     *     именно ту задачу на её место, не трогая остальное.
     *
     * @param {number} taskId
     */
    handleDeleteTask(taskId) {
        const state = this.store.getState();
        const taskIndex = state.tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return;
        const deletedTask = { ...state.tasks[taskIndex] };
        const originalIndex = taskIndex;

        // v8.30.31: локальные closure-переменные (не на this), чтобы одновременные
        // delete двух задач не перетирали состояние друг друга.
        let pendingTimer = null;
        let applied = false;

        const applyDelete = () => {
            if (applied) return;
            applied = true;
            this.store.deleteTask(taskId);
            if (this._getSelectedTaskId() === taskId) this._setSelectedTaskId(null);
            this._cache.invalidate();
        };

        const taskElement = /** @type {HTMLElement|null} */ (document.querySelector(`.task-item[data-id="${taskId}"]`));
        if (taskElement) {
            taskElement.classList.add('removing');
            pendingTimer = setTimeout(() => {
                pendingTimer = null;
                applyDelete();
            }, 300);
        } else {
            applyDelete();
        }

        showSnackbar(`Задача «${deletedTask.title}» удалена`, {
            onUndo: () => {
                // 1. Отменяем pending 300ms timer, если ещё не сработал.
                if (pendingTimer !== null) {
                    clearTimeout(pendingTimer);
                    pendingTimer = null;
                    applied = true; // не даём поздному applyDelete сработать (defence-in-depth)
                }
                // 2. Снимаем CSS-анимацию (если узел ещё в DOM).
                if (taskElement && taskElement.isConnected) {
                    taskElement.classList.remove('removing');
                }
                // 3. Если delete уже применён к store (timer успел сработать ДО undo,
                //    т.е. undo после 300ms) — insert back at original index. В противном
                //    случае задача ещё в store, restore — no-op для данных, только cache.
                const currentTasks = this.store.getState().tasks;
                const stillPresent = currentTasks.some(t => t.id === taskId);
                if (!stillPresent) {
                    const insertAt = Math.min(originalIndex, currentTasks.length);
                    const restored = [...currentTasks];
                    restored.splice(insertAt, 0, deletedTask);
                    this.store.setTasks(fixTaskOrder(restored));
                }
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
