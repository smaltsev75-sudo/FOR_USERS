// js/domain/selection/comparisonDisplay.js

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

/**
 * Эвристика выбора рекомендованного алгоритма для отображения в шапке отчёта
 * сравнения.
 *
 * @param {Array} comparableData - результат buildComparisonDisplayData
 * @returns {Object|null} - элемент comparableData или null, если массив пуст
 */
export function pickRecommendedAlgorithm(comparableData) {
    if (!Array.isArray(comparableData) || comparableData.length === 0) return null;

    const withinBudget = comparableData.filter((item) => item.displayLoad <= 100);
    const pool = withinBudget.length > 0 ? withinBudget : comparableData;

    return pool.reduce((best, item) => {
        if (!best) return item;
        if (item.displayPriority > best.displayPriority) return item;
        if (item.displayPriority < best.displayPriority) return best;
        const itemDelta = Math.abs(item.displayLoad - 100);
        const bestDelta = Math.abs(best.displayLoad - 100);
        if (itemDelta < bestDelta) return item;
        if (itemDelta > bestDelta) return best;
        return item.displayDensity > best.displayDensity ? item : best;
    }, null);
}
