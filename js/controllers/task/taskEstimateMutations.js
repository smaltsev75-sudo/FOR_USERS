// @ts-check
// js/controllers/task/taskEstimateMutations.js

/**
 * Собирает immutable update для оценки трудозатрат по роли.
 *
 * Логика оставлена рядом с task-controller boundary, потому что она зависит от
 * NumberFormatService, но больше не смешана с DOM-событием и Store.
 *
 * @param {object|null|undefined} task
 * @param {string|undefined} roleId
 * @param {string} rawValue
 * @param {import('../../services/numberFormat.js').NumberFormatService} nfs
 * @returns {{ est: Record<string, number> } | null}
 */
export function buildEstimateUpdate(task, roleId, rawValue, nfs) {
    if (!task || task.excluded) return null;

    // v8.30.24: live cap уже применён через taskList render (input listener
    // подключает nfs.handleInput). Здесь — округление в state до 2 знаков,
    // чтобы priority/effort расчёты не работали с raw arithmetic-precision.
    let value = nfs.parseNumber(rawValue) || 0;
    value = Math.max(0, nfs.roundToDecimals(value, 2));

    return {
        est: { ...task.est, [roleId]: value }
    };
}
