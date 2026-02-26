// js/domain/selection/valueDensity.js
// Алгоритм «Value Density» — отбор задач по плотности ценности.
//
// Логика: задачи сортируются по valueDensity = priorityScore / effort (убывание)
// и отбираются жадным алгоритмом. Самые «эффективные» задачи (много ценности
// за малые трудозатраты) попадают в спринт первыми.

import { prepareTasks, calculateMedians, categorizeIntoQuadrants, selectTasksUniform } from './base.js';

/**
 * Алгоритм отбора «Value Density».
 *
 * Стратегия: максимизирует суммарную «отдачу» спринта.
 * Ключевая метрика — valueDensity (плотность ценности):
 *   valueDensity = priorityScore / effort
 *
 * Пример:
 *   Задача A: приоритет 80, трудозатраты 10ч → VD = 8.0
 *   Задача B: приоритет 90, трудозатраты 40ч → VD = 2.25
 *   → Алгоритм предпочтёт задачу A, т.к. она даёт больше ценности на час.
 *
 * Отличие от Matrix: не учитывает квадранты, сортирует только по VD.
 * Квадранты вычисляются, но используются только для статистики отчёта.
 *
 * @param {Array} tasks — исходные задачи
 * @param {Object} capacityByRole — ёмкость по ролям
 * @returns {Object} результат отбора
 */
export function selectTasksValueDensity(tasks, capacityByRole) {
    const prepared = prepareTasks(tasks);

    // Сортируем по убыванию valueDensity (наиболее «эффективные» задачи — первыми)
    prepared.sort((a, b) => {
        if (b.valueDensity !== a.valueDensity) return b.valueDensity - a.valueDensity;
        return b.id - a.id; // детерминированный порядок при одинаковой плотности
    });

    // Жадный отбор в порядке убывания плотности ценности
    const selectionResult = selectTasksUniform(prepared, capacityByRole);

    // Квадранты вычисляются для визуализации в отчёте (не влияют на отбор)
    const { medianPriority, medianEffort } = calculateMedians(prepared);
    const quadrants = categorizeIntoQuadrants(prepared, medianPriority, medianEffort);

    return {
        ...selectionResult,
        quadrants,
        medians: { medianPriority, medianEffort },
        stats: {
            ...selectionResult.stats,
            quadrantsSummary: {
                q1: quadrants.q1.length,
                q2: quadrants.q2.length,
                q3: quadrants.q3.length,
                q4: quadrants.q4.length
            }
        },
        algorithm: 'value-density'
    };
}
