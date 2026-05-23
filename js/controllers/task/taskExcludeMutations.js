// @ts-check
// js/controllers/task/taskExcludeMutations.js

/**
 * Собирает update для ручного исключения/возврата задачи в спринт.
 *
 * @param {{ excluded?: number }|null|undefined} task
 * @returns {{ excluded: number, exclusionReason: string } | null}
 */
export function buildToggleExcludeUpdate(task) {
    if (!task) return null;

    const excluded = task.excluded ? 0 : 1;
    return {
        excluded,
        exclusionReason: excluded ? 'Исключена вручную' : ''
    };
}
