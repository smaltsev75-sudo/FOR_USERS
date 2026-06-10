// @ts-check
// js/controllers/task/taskListHandler.js

import { messageService } from '../../services/message.js';
import { showSnackbar } from '../../ui/snackbar.js';
import { buildCriteriaEvaluationUpdate } from './criteriaScoreMutations.js';
import { buildEstimateUpdate } from './taskEstimateMutations.js';
import { buildToggleExcludeUpdate } from './taskExcludeMutations.js';
import { moveTaskByDirection, resortTasksByPriority, sortTasksByPriority } from './taskOrderingActions.js';
import { restoreDeletedTask, restoreDeletedTasks } from './undoDeleteService.js';

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
     * Авто-сортировка (owner, v2): список всегда пересортируется DESC по
     * Priority Score после правки оценок / исключения / удаления / undo.
     * Кэш-калькулятор используется когда готов; иначе тихий fallback на
     * доменный расчёт (без user-message — это не ручная команда сортировки).
     * Вызов в одном синхронном флоу с мутацией → один rAF-кадр, нет мерцания.
     */
    _resortByPriority() {
        resortTasksByPriority(
            this.store,
            this._cache.isReady()
                ? (task, criteria) => this._cache.getCachedPriorityScore(task, criteria)
                : null
        );
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
        const update = buildEstimateUpdate(task, roleId, input.value, this.nfs);
        if (!update) return;
        this.store.updateTask(taskId, update);
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
        const criterion = state.criteria.find(c => c.id === criterionId);
        const update = buildCriteriaEvaluationUpdate(task, criterion, score);
        if (!update) return;
        this.store.updateTask(taskId, update);
        this._cache.invalidate();
        this._resortByPriority();
    }

    /**
     * Переключает исключение задачи из спринта.
     * Анимирует opacity → 0.5 при исключении, затем обновляет store.
     * @param {number} taskId
     */
    handleToggleExclude(taskId) {
        const state = this.store.getState();
        const task = state.tasks.find(t => t.id === taskId);
        const updates = buildToggleExcludeUpdate(task);
        if (!updates) return;
        const applyExclusion = () => {
            this.store.updateTask(taskId, updates);
            this._cache.invalidate();
            // v2 auto-sort: вместо только excluded-в-конец — полная пересортировка
            // DESC по score (включает fixTaskOrder).
            this._resortByPriority();
        };
        const taskElement = /** @type {HTMLElement|null} */ (document.querySelector(`.task-item[data-id="${taskId}"]`));
        if (taskElement) {
            taskElement.style.transition = 'opacity 0.3s ease';
            taskElement.style.opacity = updates.excluded ? '0.5' : '1';
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
            this._resortByPriority();
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
                const restored = restoreDeletedTask(currentTasks, deletedTask, originalIndex);
                if (restored) this.store.setTasks(restored);
                this._cache.invalidate();
                // v2 auto-sort: восстановленная задача занимает позицию по score.
                this._resortByPriority();
            }
        });
    }

    /**
     * Удаляет все задачи с подтверждением.
     *
     * v8.30.33: undo НЕ восстанавливает stale full snapshot. Между delete-all и
     * undo пользователь может создать новые задачи — они должны остаться.
     * Snapshot хранит ТОЛЬКО удалённые задачи; на undo берём текущий state
     * (с возможными новыми задачами) и merge'им: новые остаются, удалённые
     * восстанавливаются в исходном порядке, дубликаты по id отфильтрованы
     * (если id переиспользован между delete и undo — приоритет current).
     *
     * См. memory/feedback-undo-full-snapshot-breaks-intermediate-edits.md.
     */
    handleDeleteAll() {
        messageService.showConfirm('Удалить все задачи?', () => {
            const deletedTasks = [...this.store.getState().tasks];
            if (deletedTasks.length === 0) return;

            this.store.setTasks([]);
            this._setSelectedTaskId(null);
            this._cache.invalidate();

            showSnackbar(`Удалено ${deletedTasks.length} задач`, {
                onUndo: () => {
                    const currentTasks = this.store.getState().tasks;
                    this.store.setTasks(restoreDeletedTasks(currentTasks, deletedTasks));
                    this._cache.invalidate();
                    // v2 auto-sort: восстановленный список — DESC по score.
                    this._resortByPriority();
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
        const sorted = sortTasksByPriority(
            state.tasks,
            state.criteria,
            (task, criteria) => this._cache.getCachedPriorityScore(task, criteria)
        );
        this.store.reorderTasks(sorted);
    }

    /**
     * Перемещает задачу на одну позицию для keyboard/touch сценариев, где
     * native HTML5 drag недоступен или неудобен.
     * @param {number} taskId
     * @param {'up'|'down'} direction
     * @returns {boolean} true если порядок изменён
     */
    handleMoveTask(taskId, direction) {
        const moved = moveTaskByDirection(this.store.getState().tasks, taskId, direction);
        if (!moved) return false;
        this.store.reorderTasks(moved);
        this._cache.invalidate();
        return true;
    }
}
