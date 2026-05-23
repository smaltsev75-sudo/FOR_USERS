// @ts-check
// js/controllers/task/taskOrderingActions.js

import { fixTaskOrder } from '../../domain/task.js';

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
