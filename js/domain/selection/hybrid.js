// js/domain/selection/hybrid.js
// Алгоритм «Hybrid» — гибридный отбор задач.
//
// Совмещает подходы Matrix и Value Density:
// - Задачи распределяются по квадрантам (как в Matrix)
// - В Q1 и Q2 сортировка по valueDensity (как в Value Density)
// - В Q3 и Q4 сортировка по priorityScore (как в Matrix)
// Это обеспечивает баланс: важные задачи выбираются эффективно,
// а менее важные — по приоритету.

import {
    prepareTasks, calculateMedians, categorizeIntoQuadrants,
    selectTasksUniform, compareByValueDensity, compareByPriority,
    buildSelectionResult
} from './base.js';

/**
 * Гибридный алгоритм отбора (Hybrid).
 *
 * Стратегия приоритизации по квадрантам:
 *   Q1 (высокий приоритет + малые трудозатраты) — сортировка по valueDensity ↓
 *       «Лёгкие победы», но среди них выбираем самые эффективные.
 *   Q2 (высокий приоритет + большие трудозатраты) — сортировка по valueDensity ↓
 *       Стратегические задачи: берём те, что дают больше ценности на час.
 *   Q3 (низкий приоритет + малые трудозатраты) — сортировка по priorityScore ↓
 *       Для заполнения спринта: берём наиболее приоритетные из дешёвых.
 *   Q4 (низкий приоритет + большие трудозатраты) — сортировка по priorityScore ↓
 *       Включаются последними, только если осталась ёмкость.
 *
 * Ключевое отличие от Matrix: Q1 и Q2 сортируются по valueDensity вместо
 * приоритета/трудозатрат, что обеспечивает более эффективное использование ресурсов.
 *
 * @param {Array} tasks — исходные задачи
 * @param {Object} capacityByRole — ёмкость по ролям
 * @returns {Object} результат отбора
 */
export function selectTasksHybrid(tasks, capacityByRole) {
    const prepared = prepareTasks(tasks);
    const medians = calculateMedians(prepared);
    const quadrants = categorizeIntoQuadrants(prepared, medians.medianPriority, medians.medianEffort);

    // Q1: лёгкие победы — по valueDensity для максимальной эффективности
    const q1 = [...quadrants.q1].sort(compareByValueDensity);
    // Q2: стратегические — тоже по valueDensity (берём самые «выгодные» тяжёлые задачи)
    const q2 = [...quadrants.q2].sort(compareByValueDensity);
    // Q3: заполнители — по приоритету (valueDensity здесь менее информативен)
    const q3 = [...quadrants.q3].sort(compareByPriority);
    // Q4: кандидаты на перенос — по приоритету
    const q4 = [...quadrants.q4].sort(compareByPriority);

    const sortedTasks = [...q1, ...q2, ...q3, ...q4];
    const selectionResult = selectTasksUniform(sortedTasks, capacityByRole);

    return buildSelectionResult(selectionResult, quadrants, medians, 'hybrid');
}
