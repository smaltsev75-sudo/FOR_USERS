// @ts-check
// js/controllers/task/taskExcludeActions.js

import { buildToggleExcludeUpdate } from './taskExcludeMutations.js';

/**
 * Переключает ручное исключение задачи из спринта и применяет короткий opacity
 * preview, если карточка сейчас есть в DOM.
 *
 * @param {object} params
 * @param {number} params.taskId
 * @param {import('../../state/store.js').Store} params.store
 * @param {import('./taskCacheService.js').TaskCacheService} params.cache
 * @param {Function} params.resortByPriority
 * @param {Document} [params.documentRef]
 * @param {typeof setTimeout} [params.schedule]
 * @returns {boolean}
 */
export function handleToggleExcludeAction({
    taskId,
    store,
    cache,
    resortByPriority,
    documentRef = globalThis.document,
    schedule = setTimeout
}) {
    const state = store.getState();
    const task = state.tasks.find(item => item.id === taskId);
    const updates = buildToggleExcludeUpdate(task);
    if (!updates) return false;

    const applyExclusion = () => {
        store.updateTask(taskId, updates);
        cache.invalidate();
        resortByPriority();
    };

    const taskElement = documentRef?.querySelector?.(`.task-item[data-id="${taskId}"]`) ?? null;
    if (taskElement) {
        taskElement.style.transition = 'opacity 0.3s ease';
        taskElement.style.opacity = updates.excluded ? '0.5' : '1';
        schedule(applyExclusion, 300);
    } else {
        applyExclusion();
    }

    return true;
}
