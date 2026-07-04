// @ts-check
// js/controllers/task/taskSortActions.js

import { messageService } from '../../services/message.js';
import { sortTasksByPriority } from './taskOrderingActions.js';

/**
 * Выполняет ручную сортировку списка задач по Priority Score.
 *
 * В отличие от авто-сортировки, ручная команда не использует доменный fallback:
 * если кэш скоринга ещё не готов, пользователь получает прежнее сообщение.
 *
 * @param {object} params
 * @param {{ getState: Function, reorderTasks: Function }} params.store
 * @param {{ isReady: Function, getCachedPriorityScore: Function }} params.cache
 * @param {(message: string) => void} [params.showMessage]
 * @returns {boolean}
 */
export function handleSortByPriorityAction({
    store,
    cache,
    showMessage = messageService.showMessage
}) {
    if (!cache.isReady()) {
        showMessage('calculatePriorityScore не определено');
        return false;
    }

    const state = store.getState();
    const sorted = sortTasksByPriority(
        state.tasks,
        state.criteria,
        (task, criteria) => cache.getCachedPriorityScore(task, criteria)
    );
    store.reorderTasks(sorted);
    return true;
}
