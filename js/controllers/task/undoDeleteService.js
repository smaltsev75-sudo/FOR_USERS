// @ts-check
// js/controllers/task/undoDeleteService.js

import { fixTaskOrder } from '../../domain/task.js';

/**
 * Восстанавливает одну удалённую задачу на исходный индекс, не затирая новые
 * задачи, созданные между delete и undo.
 *
 * @param {Array<object>} currentTasks
 * @param {{ id: number }} deletedTask
 * @param {number} originalIndex
 * @returns {Array<object>|null}
 */
export function restoreDeletedTask(currentTasks, deletedTask, originalIndex) {
    if (currentTasks.some(task => task.id === deletedTask.id)) return null;

    const insertAt = Math.min(Math.max(originalIndex, 0), currentTasks.length);
    const restored = [...currentTasks];
    restored.splice(insertAt, 0, deletedTask);
    return fixTaskOrder(restored);
}

/**
 * Восстанавливает delete-all snapshot поверх текущих задач:
 * - удалённые задачи возвращаются первыми в исходном порядке;
 * - задачи, созданные после delete-all, остаются;
 * - если id переиспользован, current-state имеет приоритет.
 *
 * @param {Array<object>} currentTasks
 * @param {Array<{ id: number }>} deletedTasks
 * @returns {Array<object>}
 */
export function restoreDeletedTasks(currentTasks, deletedTasks) {
    const currentIds = new Set(currentTasks.map(task => task.id));
    const restoredDeleted = deletedTasks.filter(task => !currentIds.has(task.id));
    return fixTaskOrder([...restoredDeleted, ...currentTasks]);
}
