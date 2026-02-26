// js/controllers/selection/selectionHelpers.js

import { calculateTaskTotal } from '../../domain/task.js';
import { ROLES } from '../../utils/constants.js';

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
    const tasksHash = tasks.map((task) =>
        `${task.id}:${task.excluded}:${JSON.stringify(task.est)}:${task.priorityScore || 0}`
    ).join('|');
    const capacityHash = JSON.stringify(capacityByRole);
    return `${tasksHash}_${capacityHash}`;
}

export function buildComparisonDisplayData(results, comparison, algorithms = ['matrix', 'value-density', 'hybrid']) {
    const algoData = [];

    algorithms.forEach((algo) => {
        const comp = comparison[algo];
        const res = results[algo];
        if (!comp || comp.error || !res) return;

        const selectedTasks = res.selectedTasks || [];
        const totalPriority = selectedTasks.reduce((sum, task) => {
            const score = task.priorityScore !== undefined ? task.priorityScore : (task.rawTask?.priorityScore || 0);
            return sum + (score || 0);
        }, 0);
        const avgDensity = selectedTasks.length > 0
            ? selectedTasks.reduce((sum, task) => {
                const density = task.valueDensity !== undefined ? task.valueDensity : (task.rawTask?.valueDensity || 0);
                return sum + (density || 0);
            }, 0) / selectedTasks.length
            : 0;

        algoData.push({
            algo,
            name: comp.algorithmName || algo,
            tasksCount: comp.selectedTasks || 0,
            loadPct: comp.loadPercentage || 0,
            totalEffort: res.totalLoad || 0,
            totalPriority,
            avgDensity
        });
    });

    return algoData.map((item) => ({
        ...item,
        displayLoad: Number(item.loadPct.toFixed(1)),
        displayEffort: Number(item.totalEffort.toFixed(1)),
        displayPriority: Number(item.totalPriority.toFixed(1)),
        displayDensity: Number(item.avgDensity.toFixed(2))
    }));
}

export function computeComparisonBestValues(comparableData) {
    return {
        bestTasks: Math.max(...comparableData.map((item) => item.tasksCount)),
        bestLoadDiff: Math.min(...comparableData.map((item) => Math.abs(item.displayLoad - 100))),
        bestEffort: Math.max(...comparableData.map((item) => item.displayEffort)),
        bestPriority: Math.max(...comparableData.map((item) => item.displayPriority)),
        bestDensity: Math.max(...comparableData.map((item) => item.displayDensity))
    };
}

export function areNearlyEqual(left, right, epsilon = 0.000001) {
    return Math.abs(left - right) <= epsilon;
}
