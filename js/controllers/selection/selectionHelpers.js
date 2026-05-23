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
