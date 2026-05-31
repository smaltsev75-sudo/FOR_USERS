// js/domain/selection/matrix.js
// Алгоритм «Priority-Effort Matrix» — отбор задач по матрице приоритетов.
//
// Логика: задачи распределяются по 4 квадрантам относительно медиан приоритета
// и трудозатрат, затем отбираются в порядке Q1 → Q2 → Q3 → Q4.
// Внутри квадрантов сортировка по приоритету (Q1, Q3, Q4) или трудозатратам (Q2).

import {
    prepareTasks, calculateMedians, categorizeIntoQuadrants,
    selectTasksUniform, compareByPriority, buildSelectionResult
} from './base.js';

/**
 * Алгоритм отбора «Priority-Effort Matrix».
 *
 * Стратегия приоритизации по квадрантам:
 *   Q1 (высокий приоритет + малые трудозатраты) — сортировка по убыванию приоритета.
 *       Эти «лёгкие победы» отбираются первыми.
 *   Q2 (высокий приоритет + большие трудозатраты) — сортировка по возрастанию трудозатрат.
 *       Среди важных задач предпочтение отдаётся менее трудоёмким.
 *   Q3 (низкий приоритет + малые трудозатраты) — сортировка по убыванию приоритета.
 *       Используются как «заполнители» оставшейся ёмкости.
 *   Q4 (низкий приоритет + большие трудозатраты) — сортировка по убыванию приоритета.
 *       Включаются только если осталась значительная ёмкость.
 *
 * @param {Array} tasks — исходные задачи с priorityScore и effort
 * @param {Object} capacityByRole — ёмкость команды по ролям: { BE: 80, FE: 60, ... }
 * @returns {Object} результат отбора: selectedTasks, excludedTasks, quadrants, stats
 */
export function selectTasksMatrix(tasks, capacityByRole) {
    const prepared = prepareTasks(tasks);
    // v8.30.68: медиана и квадранты считаются ТОЛЬКО по не-исключённым задачам.
    // Исключённые вручную — не кандидаты на отбор; их priority/effort-outlier'ы
    // перекашивали бы медиану и порядок жадного отбора активных задач. Тот же
    // инвариант, что и в ui/selection/quadrants.js (v8.29.1). Исключённые всё
    // равно передаются в selectTasksUniform (в конце sortedTasks), чтобы попасть
    // в excludedTasks с причиной «Исключена вручную».
    const active = prepared.filter(t => !t.excluded);
    const excluded = prepared.filter(t => t.excluded);
    const medians = calculateMedians(active);
    const quadrants = categorizeIntoQuadrants(active, medians.medianPriority, medians.medianEffort);

    // Q1: сортировка по убыванию приоритета (самые ценные и лёгкие — первыми)
    const q1 = [...quadrants.q1].sort(compareByPriority);
    // Q2: сортировка по возрастанию трудозатрат (среди важных берём менее тяжёлые)
    const q2 = [...quadrants.q2].sort((a, b) => {
        if (a.effort !== b.effort) return a.effort - b.effort;
        if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
        return b.id - a.id;
    });
    // Q3: заполнители — по приоритету
    const q3 = [...quadrants.q3].sort(compareByPriority);
    // Q4: наименее приоритетные — тоже по приоритету
    const q4 = [...quadrants.q4].sort(compareByPriority);

    // Объединяем в порядке приоритета квадрантов и заполняем спринт жадным алгоритмом.
    // Исключённые добавляем в конец — selectTasksUniform пометит их «Исключена вручную»
    // (позиция не влияет на отбор: они никогда не коммитятся и не занимают ёмкость).
    const sortedTasks = [...q1, ...q2, ...q3, ...q4, ...excluded];
    const selectionResult = selectTasksUniform(sortedTasks, capacityByRole);

    return buildSelectionResult(selectionResult, quadrants, medians, 'matrix');
}
