// js/domain/selection/analysis.js
import { selectTasksMatrix } from './matrix.js';
import { selectTasksValueDensity } from './valueDensity.js';
import { selectTasksHybrid } from './hybrid.js';
import { SELECTION_CONFIG } from './config.js';

export function selectTasks(tasks, capacityByRole, algorithm) {
    switch (algorithm) {
        case SELECTION_CONFIG.ALGORITHMS.MATRIX:
            return withAlgorithmName(selectTasksMatrix(tasks, capacityByRole), algorithm);
        case SELECTION_CONFIG.ALGORITHMS.VALUE_DENSITY:
            return withAlgorithmName(selectTasksValueDensity(tasks, capacityByRole), algorithm);
        case SELECTION_CONFIG.ALGORITHMS.HYBRID:
            return withAlgorithmName(selectTasksHybrid(tasks, capacityByRole), algorithm);
        default:
            throw new Error(`Неизвестный алгоритм: ${algorithm}`);
    }
}

export function compareAlgorithms(tasks, capacityByRole) {
    const algorithms = Object.values(SELECTION_CONFIG.ALGORITHMS);
    const results = {};

    algorithms.forEach((algorithm) => {
        try {
            results[algorithm] = selectTasks(tasks, capacityByRole, algorithm);
        } catch (error) {
            results[algorithm] = { error: error.message };
        }
    });

    const comparison = {};
    algorithms.forEach((algorithm) => {
        const result = results[algorithm];
        if (!result || result.error) {
            comparison[algorithm] = { error: result?.error || 'Ошибка расчета' };
            return;
        }

        comparison[algorithm] = {
            algorithmName: result.algorithmName || SELECTION_CONFIG.ALGORITHM_NAMES[algorithm] || algorithm,
            selectedTasks: result.selectedTasks?.length || 0,
            loadPercentage: result.stats?.loadPercentage || result.loadPercentage || 0,
            efficiency: (result.selectedTasks?.length || 0) > 0
                ? (result.stats?.totalLoad || result.totalLoad || 0) / result.selectedTasks.length
                : 0,
            quadrants: result.stats?.quadrantsSummary || null
        };
    });

    return { results, comparison };
}

export function getOptimizationRecommendations(selectionResult, capacityByRole) {
    if (!selectionResult || !capacityByRole) return [];

    const recommendations = [];
    const loadByRole = selectionResult.stats?.loadByRole || selectionResult.loadByRole || {};
    const totalLoad = selectionResult.stats?.totalLoad || selectionResult.totalLoad || 0;
    const totalCapacity = Object.values(capacityByRole).reduce((sum, value) => sum + value, 0);

    SELECTION_CONFIG.ROLES.forEach((role) => {
        const load = loadByRole[role] || 0;
        const capacity = capacityByRole[role] || 0;
        if (capacity <= 0) return;

        const percentage = (load / capacity) * 100;
        if (percentage > 100) {
            recommendations.push({
                type: 'overload',
                role,
                message: `Роль ${role} перегружена на ${(percentage - 100).toFixed(1)}%`,
                severity: 'high',
                suggestion: 'Рассмотрите возможность передачи части задач или расширения команды'
            });
            return;
        }

        if (percentage < SELECTION_CONFIG.UNDERLOAD_THRESHOLD * 100) {
            recommendations.push({
                type: 'underload',
                role,
                message: `Роль ${role} недогружена (${percentage.toFixed(1)}%)`,
                severity: 'medium',
                suggestion: 'Ищите задачи, которые требуют данной роли'
            });
            return;
        }

        if (percentage > 95) {
            recommendations.push({
                type: 'warning',
                role,
                message: `Роль ${role} близка к перегрузке (${percentage.toFixed(1)}%)`,
                severity: 'low',
                suggestion: 'Мониторьте загрузку в течение спринта'
            });
        }
    });

    if (totalCapacity > 0) {
        const totalPercentage = (totalLoad / totalCapacity) * 100;
        if (totalPercentage < SELECTION_CONFIG.TEAM_UNDERLOAD_THRESHOLD * 100) {
            recommendations.push({
                type: 'team-underload',
                message: `Общая загрузка команды низкая (${totalPercentage.toFixed(1)}%). Рекомендуется добавить больше задач.`,
                severity: 'medium',
                suggestion: 'Просмотрите задачи из всех квадрантов, включая Q3 и Q4'
            });
        } else if (totalPercentage > SELECTION_CONFIG.TEAM_OVERLOAD_THRESHOLD * 100) {
            recommendations.push({
                type: 'team-overload',
                message: `Общая загрузка команды высокая (${totalPercentage.toFixed(1)}%). Рассмотрите возможность переноса части задач.`,
                severity: 'high',
                suggestion: 'Перенесите задачи с низким приоритетом на следующий спринт'
            });
        } else if (totalPercentage >= 90 && totalPercentage <= 95) {
            recommendations.push({
                type: 'team-optimal',
                message: `Общая загрузка команды оптимальна (${totalPercentage.toFixed(1)}%)`,
                severity: 'info',
                suggestion: 'Текущая загрузка соответствует целевым показателям'
            });
        }
    }

    return recommendations;
}

function withAlgorithmName(result, algorithm) {
    return {
        ...result,
        algorithmName: SELECTION_CONFIG.ALGORITHM_NAMES[algorithm] || algorithm
    };
}

