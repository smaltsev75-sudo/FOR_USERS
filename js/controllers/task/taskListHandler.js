// @ts-check
// js/controllers/task/taskListHandler.js

import { buildCriteriaEvaluationUpdate } from './criteriaScoreMutations.js';
import { buildEstimateUpdate } from './taskEstimateMutations.js';
import {
    handleDeleteAllTasksAction,
    handleDeleteTaskAction
} from './taskDeleteActions.js';
import { handleToggleExcludeAction } from './taskExcludeActions.js';
import { moveTaskByDirection, resortTasksByPriority } from './taskOrderingActions.js';
import { handleSortByPriorityAction } from './taskSortActions.js';

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
        handleToggleExcludeAction({
            taskId,
            store: this.store,
            cache: this._cache,
            resortByPriority: this._resortByPriority.bind(this)
        });
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
        handleDeleteTaskAction({
            taskId,
            store: this.store,
            cache: this._cache,
            getSelectedTaskId: this._getSelectedTaskId,
            setSelectedTaskId: this._setSelectedTaskId,
            resortByPriority: this._resortByPriority.bind(this)
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
        handleDeleteAllTasksAction({
            store: this.store,
            cache: this._cache,
            setSelectedTaskId: this._setSelectedTaskId,
            resortByPriority: this._resortByPriority.bind(this)
        });
    }

    /**
     * Сортирует задачи по убыванию Priority Score.
     * Использует кэшированные значения из TaskCacheService.
     */
    handleSortByPriority() {
        handleSortByPriorityAction({
            store: this.store,
            cache: this._cache
        });
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
