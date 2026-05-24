// js/controllers/selection/selectionHelpers.js

import { calculateTaskTotal } from '../../domain/task.js';
import { ROLES } from '../../utils/constants.js';
export {
    areNearlyEqual,
    buildComparisonDisplayData,
    computeComparisonBestValues,
    pickRecommendedAlgorithm
} from '../../domain/selection/comparisonDisplay.js';

export function setSelectionLoadingState(loadingEl, actionBtn, isLoading) {
    if (loadingEl) {
        loadingEl.style.display = isLoading ? 'flex' : 'none';
    }
    if (actionBtn) {
        actionBtn.disabled = Boolean(isLoading);
    }
}

export function buildTasksWithPriority(tasks, criteriaManager, roles) {
    return tasks.map((task) => {
        // Всегда пересчитываем priorityScore по актуальным весам критериев,
        // чтобы избежать использования устаревших значений из задачи
        const priorityScore = criteriaManager.calculatePriorityScore(task.criteriaEvaluations || {});
        // Рассчитываем effort для каждой задачи
        const effort = calculateTaskTotal(task, roles);
        return {
            ...task,
            priorityScore,
            effort,
            roleEffort: Object.fromEntries(ROLES.map(r => [r.id, task.est?.[r.id] || 0]))
        };
    });
}

export function buildAlgorithmsCacheKey(tasks, capacityByRole) {
    // v8.30.25: добавлены `dependencies` — раньше ключ не учитывал их изменения.
    // selectTasksUniform (domain/selection/base.js) проверяет task.dependencies
    // при отборе; смена deps без `est`/`excluded` могла отдать stale-результат
    // из кэша. Stringify массива даёт стабильный hash.
    const tasksHash = tasks.map((task) => {
        const deps = JSON.stringify(task.dependencies || []);
        return `${task.id}:${task.excluded}:${JSON.stringify(task.est)}:${task.priorityScore || 0}:${deps}`;
    }).join('|');
    const capacityHash = JSON.stringify(capacityByRole);
    return `${tasksHash}_${capacityHash}`;
}

function readSelectedTaskId(task) {
    const raw = task?.rawTask?.id ?? task?.id;
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
}

/**
 * Safety post-condition for applying an algorithm result.
 *
 * The domain algorithms are expected to respect capacity themselves. This helper
 * is a final apply-time guard against stale modal results, corrupted test data,
 * or future algorithm regressions: it preserves the algorithm's selected order,
 * but drops any selected task that would overload a role or the whole team.
 *
 * @param {Array<object>} selectedTasks
 * @param {Array<object>} allTasks
 * @param {Record<string, number>} capacityByRole
 * @param {Array<{id: string}>} [roles=ROLES]
 * @returns {{ selectedIds: Set<number>, droppedIds: Set<number>, loadByRole: Record<string, number>, totalLoad: number, totalCapacity: number }}
 */
export function buildCapacitySafeSelection(selectedTasks, allTasks, capacityByRole, roles = ROLES) {
    const roleList = Array.isArray(roles) && roles.length ? roles : ROLES;
    const taskById = new Map((allTasks || []).map(task => [Number(task.id), task]));
    const selectedIds = new Set();
    const droppedIds = new Set();
    const loadByRole = Object.fromEntries(roleList.map(role => [role.id, 0]));
    const totalCapacity = roleList.reduce((sum, role) => {
        const capacity = Number(capacityByRole?.[role.id]);
        return sum + (Number.isFinite(capacity) && capacity > 0 ? capacity : 0);
    }, 0);
    let totalLoad = 0;
    const epsilon = 1e-9;

    for (const selectedTask of selectedTasks || []) {
        const id = readSelectedTaskId(selectedTask);
        const task = id === null ? null : taskById.get(id);
        if (!task) continue;

        const taskTotal = calculateTaskTotal(task, roleList);
        if (taskTotal <= 0) {
            droppedIds.add(id);
            continue;
        }

        if (totalLoad + taskTotal > totalCapacity + epsilon) {
            droppedIds.add(id);
            continue;
        }

        let fitsRoles = true;
        for (const role of roleList) {
            const addition = Number(task.est?.[role.id]) || 0;
            const capacity = Number(capacityByRole?.[role.id]) || 0;
            if ((loadByRole[role.id] || 0) + addition > capacity + epsilon) {
                fitsRoles = false;
                break;
            }
        }
        if (!fitsRoles) {
            droppedIds.add(id);
            continue;
        }

        selectedIds.add(id);
        totalLoad += taskTotal;
        for (const role of roleList) {
            loadByRole[role.id] += Number(task.est?.[role.id]) || 0;
        }
    }

    return { selectedIds, droppedIds, loadByRole, totalLoad, totalCapacity };
}
