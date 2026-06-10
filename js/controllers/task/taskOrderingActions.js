// @ts-check
// js/controllers/task/taskOrderingActions.js

import { fixTaskOrder } from '../../domain/task.js';
import { calculatePriorityScore } from '../../domain/criteria.js';

/**
 * Нормализует order-поля без изменения пользовательского порядка.
 *
 * @param {Array<object>} tasks
 * @returns {Array<object>}
 */
export function normalizeTaskOrder(tasks) {
    return fixTaskOrder(tasks);
}

/**
 * Возвращает задачи, отсортированные по убыванию Priority Score.
 *
 * @param {Array<object>} tasks
 * @param {Array<object>} criteria
 * @param {(task: object, criteria: Array<object>) => number} getPriorityScore
 * @returns {Array<object>}
 */
export function sortTasksByPriority(tasks, criteria, getPriorityScore) {
    const sorted = [...tasks].sort((a, b) => {
        const scoreA = getPriorityScore(a, criteria);
        const scoreB = getPriorityScore(b, criteria);
        return scoreB - scoreA;
    });
    return fixTaskOrder(sorted);
}

/**
 * Авто-сортировка (owner, v2): пересортирует задачи store по убыванию
 * Priority Score (excluded — в конец) и коммитит через store.reorderTasks.
 *
 * Единая точка для всех триггеров авто-сортировки: импорт JSON / recovery,
 * создание задачи, правка оценок критериев, удаление/undo, исключение.
 * ВАЖНО: вызывать в ОДНОМ синхронном флоу с мутацией-триггером — несколько
 * синхронных store.update сливаются rAF-батчингом RenderScheduler в один
 * кадр (см. tests/unit/app/renderScheduler.test.js), экран не мерцает.
 *
 * @param {{ getState: Function, reorderTasks: Function }} store
 * @param {((task: object, criteria: Array<object>) => number)|null} [getPriorityScore]
 *        — опциональный калькулятор (например, кэшированный); по умолчанию
 *        доменный calculatePriorityScore.
 */
export function resortTasksByPriority(store, getPriorityScore = null) {
    const state = store.getState();
    const calc = getPriorityScore
        || ((task, criteria) => calculatePriorityScore(criteria || [], task.criteriaEvaluations));
    store.reorderTasks(sortTasksByPriority(state.tasks, state.criteria || [], calc));
}

/**
 * Перемещает задачу на одну позицию вверх/вниз.
 *
 * @param {Array<object>} tasks
 * @param {number} taskId
 * @param {'up'|'down'} direction
 * @returns {Array<object>|null}
 */
export function moveTaskByDirection(tasks, taskId, direction) {
    const delta = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
    if (delta === 0) return null;

    const reordered = [...tasks];
    const index = reordered.findIndex(task => task.id === taskId);
    const targetIndex = index + delta;
    if (index === -1 || targetIndex < 0 || targetIndex >= reordered.length) return null;

    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    return fixTaskOrder(reordered);
}
