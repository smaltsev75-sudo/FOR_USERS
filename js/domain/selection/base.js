// @ts-check
// js/domain/selection/base.js
// Базовые функции для всех алгоритмов автоматического отбора задач в спринт.
// Содержит: подготовку данных, расчёт медиан, категоризацию по квадрантам,
// универсальный алгоритм заполнения спринта с учётом ёмкости.

import { SELECTION_CONFIG } from './config.js';

/**
 * Подготавливает задачи для алгоритмов отбора.
 * Нормализует данные: вычисляет valueDensity (ценность/трудозатраты),
 * копирует roleEffort и сохраняет ссылку на оригинальную задачу (rawTask).
 *
 * @param {Array} tasks — исходные задачи из store
 * @returns {Array} задачи с добавленными полями для алгоритмов
 */
export function prepareTasks(tasks) {
    return tasks.map(task => {
        const effort = task.effort || 0;         // общие трудозатраты (часы)
        const priorityScore = task.priorityScore || 0; // взвешенный приоритет (0-100)
        // Плотность ценности: сколько «приоритета» приходится на 1 час работы.
        // Чем выше — тем эффективнее задача с точки зрения value/effort.
        const valueDensity = effort > 0 ? priorityScore / effort : priorityScore;
        return {
            id: task.id,
            title: task.title,
            priorityScore,
            effort,
            roleEffort: { ...task.roleEffort }, // трудозатраты по ролям: { BE: 8, FE: 4, QA: 2 }
            valueDensity,
            excluded: task.excluded || false,    // вручную исключённые задачи
            type: task.type,                     // тип: US, Bug, Tech
            dependencies: task.dependencies || [],
            rawTask: task                        // ссылка на оригинал для обратного маппинга
        };
    });
}

/**
 * Вычисляет медианы приоритета и трудозатрат по массиву задач.
 * Медианы используются как пороговые значения для разделения на квадранты.
 *
 * @param {Array} tasks — массив подготовленных задач
 * @returns {{medianPriority: number, medianEffort: number}}
 */
export function calculateMedians(tasks) {
    if (tasks.length === 0) return { medianPriority: 0, medianEffort: 0 };
    const sortedPriorities = tasks.map(t => t.priorityScore).sort((a, b) => a - b);
    const sortedEfforts = tasks.map(t => t.effort).sort((a, b) => a - b);
    return {
        medianPriority: getMedian(sortedPriorities),
        medianEffort: getMedian(sortedEfforts)
    };
}

/**
 * Вычисляет медиану отсортированного массива чисел.
 * При чётном количестве элементов — среднее двух центральных.
 */
function getMedian(sortedArray) {
    if (sortedArray.length === 0) return 0;
    const mid = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 === 0
        ? (sortedArray[mid - 1] + sortedArray[mid]) / 2
        : sortedArray[mid];
}

/**
 * Распределяет задачи по четырём квадрантам матрицы «Приоритет × Трудозатраты».
 *
 * Квадранты:
 *   Q1 (★ высокий приоритет, малые трудозатраты)  — «Лёгкие победы»
 *   Q2 (★ высокий приоритет, большие трудозатраты) — «Стратегические задачи»
 *   Q3 (○ низкий приоритет, малые трудозатраты)    — «Заполнители спринта»
 *   Q4 (○ низкий приоритет, большие трудозатраты)  — «Откладывать»
 *
 * @param {Array} tasks — подготовленные задачи
 * @param {number} medianPriority — медиана приоритета
 * @param {number} medianEffort — медиана трудозатрат
 * @returns {{q1: Array, q2: Array, q3: Array, q4: Array}}
 */
export function categorizeIntoQuadrants(tasks, medianPriority, medianEffort) {
    const quadrants = { q1: [], q2: [], q3: [], q4: [] };
    tasks.forEach(task => {
        const highPriority = task.priorityScore >= medianPriority;
        const highEffort = task.effort > medianEffort;
        if (highPriority && !highEffort) quadrants.q1.push(task);      // Q1: важное и лёгкое
        else if (highPriority && highEffort) quadrants.q2.push(task);   // Q2: важное и тяжёлое
        else if (!highPriority && !highEffort) quadrants.q3.push(task); // Q3: неважное и лёгкое
        else quadrants.q4.push(task);                                   // Q4: неважное и тяжёлое
    });
    return quadrants;
}

/**
 * Универсальная функция жадного отбора задач (greedy knapsack).
 *
 * Алгоритм:
 * 1. Проходит по задачам в порядке, определённом вызывающим алгоритмом
 * 2. Для каждой задачи проверяет:
 *    - Не исключена ли вручную
 *    - Есть ли ненулевые трудозатраты
 *    - Не превышает ли общую ёмкость команды
 *    - Не превышает ли ёмкость по каждой роли (BE, FE, QA, SA, Design)
 *    - Удовлетворены ли зависимости
 * 3. Если все проверки прошли — задача включается в спринт
 * 4. Если хотя бы одна проверка не прошла — задача исключается с указанием причины
 *
 * @param {Array} sortedTasks — отсортированные задачи (порядок определяет приоритет включения)
 * @param {Object} capacityByRole — доступная ёмкость: { BE: 80, FE: 60, QA: 40, ... }
 * @returns {Object} результат: selectedTasks, excludedTasks, статистика загрузки
 */
export function selectTasksUniform(sortedTasks, capacityByRole) {
    const selectedTasks = [];   // отобранные задачи
    const selectedTaskIds = new Set();

    // Текущая загрузка по каждой роли (нарастающий итог)
    const loadByRole = {};
    SELECTION_CONFIG.ROLES.forEach(role => loadByRole[role] = 0);
    let totalLoad = 0; // суммарная загрузка (часы)
    const totalCapacity = Object.values(capacityByRole).reduce((sum, v) => sum + v, 0);

    // v8.30.31: topological retry. Раньше — single-pass: если задача A
    // встретилась раньше своей зависимости B в sortedTasks, A отбраковывалась
    // с reason="Не выполнены зависимости" даже если B позже была отобрана и
    // их обоих хватило бы по capacity. Внешний аудит P2.
    //
    // Решение: pending-список для задач с unmet deps + retry-проход до
    // фиксированной точки. Это даёт topological-friendly порядок без явного
    // topo-sort'а (который потребовал бы знать deps до сортировки).
    //
    // Алгоритм:
    //   1. Pass 0: проходим sortedTasks. Каждая задача → либо selected, либо
    //      hard-excluded (excluded/no-effort/no-capacity/role-overload), либо
    //      pending (unmet deps).
    //   2. Loop: пока хоть одну pending удалось добавить в эту итерацию —
    //      пробуем pending заново. Когда итерация не добавила ни одной —
    //      оставшиеся pending → final excluded с reason="Не выполнены зависимости".
    //   3. Capacity по ролям накапливается монотонно в loadByRole; deps-only
    //      retry никогда не отменяет hard-exclusions.

    const hardExcluded = [];
    const pendingDeps = [];

    // helper: проверка capacity. Возвращает 'ok' | 'team-cap' | 'role-cap' | 'zero-effort'.
    function checkCapacity(task) {
        if (task.effort <= 0) return 'zero-effort';
        if (totalLoad + task.effort > totalCapacity) return 'team-cap';
        for (const role of SELECTION_CONFIG.ROLES) {
            const current = loadByRole[role] || 0;
            const addition = task.roleEffort[role] || 0;
            const capacity = capacityByRole[role] || 0;
            if (current + addition > capacity) return 'role-cap';
        }
        return 'ok';
    }

    function commit(task) {
        selectedTasks.push(task);
        selectedTaskIds.add(task.id);
        SELECTION_CONFIG.ROLES.forEach(role => {
            loadByRole[role] += task.roleEffort[role] || 0;
        });
        totalLoad += task.effort;
    }

    // Pass 0: единственный проход по sortedTasks, разделяющий на selected /
    // hardExcluded / pendingDeps.
    for (const task of sortedTasks) {
        if (task.excluded) {
            hardExcluded.push({ ...task, reason: 'Исключена вручную', canBeAdded: false });
            continue;
        }
        const cap = checkCapacity(task);
        if (cap === 'zero-effort') {
            hardExcluded.push({ ...task, reason: 'Нулевая оценка трудозатрат', canBeAdded: false });
            continue;
        }
        if (cap === 'team-cap') {
            hardExcluded.push({ ...task, reason: 'Недостаточно общей ёмкости команды', canBeAdded: false });
            continue;
        }
        if (cap === 'role-cap') {
            hardExcluded.push({ ...task, reason: 'Недостаточно ресурсов по ролям', canBeAdded: false });
            continue;
        }
        if (task.dependencies && task.dependencies.length > 0) {
            const unmet = task.dependencies.some(depId => !selectedTaskIds.has(depId));
            if (unmet) {
                pendingDeps.push(task);
                continue;
            }
        }
        commit(task);
    }

    // Retry loop: пока хоть одну pending удалось закоммитить.
    let progress = true;
    const remainingPending = [...pendingDeps];
    while (progress && remainingPending.length > 0) {
        progress = false;
        for (let i = remainingPending.length - 1; i >= 0; i--) {
            const task = remainingPending[i];
            // Перепроверяем capacity и deps на текущем состоянии loadByRole.
            const cap = checkCapacity(task);
            if (cap === 'team-cap' || cap === 'role-cap') {
                // Capacity stale — пометим как exclusion, не возвращаем в pending.
                remainingPending.splice(i, 1);
                hardExcluded.push({
                    ...task,
                    reason: cap === 'team-cap'
                        ? 'Недостаточно общей ёмкости команды'
                        : 'Недостаточно ресурсов по ролям',
                    canBeAdded: false
                });
                continue;
            }
            const depsMet = task.dependencies.every(depId => selectedTaskIds.has(depId));
            if (depsMet) {
                commit(task);
                remainingPending.splice(i, 1);
                progress = true;
            }
        }
    }

    // Оставшиеся pending — реально циклы или зависимости от hard-excluded.
    const excludedTasks = [
        ...hardExcluded,
        ...remainingPending.map(task => ({
            ...task,
            reason: 'Не выполнены зависимости (зависит от не-отобранной задачи)',
            canBeAdded: true
        }))
    ];

    // Вычисляем процент загрузки и статистику по ролям
    const loadPercentage = totalCapacity > 0 ? (totalLoad / totalCapacity) * 100 : 0;
    const roleUsage = calculateRoleUsage(loadByRole, capacityByRole);

    return {
        selectedTasks,
        excludedTasks,
        loadByRole,
        totalLoad,
        loadPercentage,
        stats: {
            totalSelected: selectedTasks.length,
            totalExcluded: excludedTasks.length,
            loadByRole,
            totalLoad,
            loadPercentage,
            roleUsage,
            totalEffort: totalLoad,
            teamLoadPercentage: loadPercentage
        },
        capacityByRole
    };
}

/**
 * Компаратор: сортировка по valueDensity ↓, при равенстве — по id ↓.
 * Используется в алгоритмах Value Density и Hybrid (Q1, Q2).
 */
export function compareByValueDensity(a, b) {
    if (b.valueDensity !== a.valueDensity) return b.valueDensity - a.valueDensity;
    return b.id - a.id;
}

/**
 * Компаратор: сортировка по priorityScore ↓, при равенстве — по id ↓.
 * Используется в алгоритмах Matrix (Q1, Q3, Q4) и Hybrid (Q3, Q4).
 */
export function compareByPriority(a, b) {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return b.id - a.id;
}

/**
 * Формирует стандартный результат алгоритма отбора.
 * Объединяет результаты selectTasksUniform с квадрантами, медианами и метаинформацией.
 *
 * @param {Object} selectionResult — результат selectTasksUniform
 * @param {Object} quadrants — квадранты { q1, q2, q3, q4 }
 * @param {{medianPriority: number, medianEffort: number}} medians — медианы
 * @param {string} algorithmName — имя алгоритма ('matrix' | 'value-density' | 'hybrid')
 * @returns {Object} полный результат алгоритма
 */
export function buildSelectionResult(selectionResult, quadrants, medians, algorithmName) {
    return {
        ...selectionResult,
        quadrants,
        medians,
        stats: {
            ...selectionResult.stats,
            quadrantsSummary: {
                q1: quadrants.q1.length,
                q2: quadrants.q2.length,
                q3: quadrants.q3.length,
                q4: quadrants.q4.length
            }
        },
        algorithm: algorithmName
    };
}

/**
 * Вычисляет загрузку каждой роли: абсолютную, процентную и статус.
 */
function calculateRoleUsage(loadByRole, capacityByRole) {
    const roleUsage = {};
    SELECTION_CONFIG.ROLES.forEach(role => {
        const load = loadByRole[role] || 0;
        const capacity = capacityByRole[role] || 0;
        const percentage = capacity > 0 ? (load / capacity) * 100 : 0;
        roleUsage[role] = {
            load,
            capacity,
            percentage,
            status: getRoleStatus(percentage)
        };
    });
    return roleUsage;
}

/**
 * Определяет статус загрузки роли по проценту.
 * @returns {'overload'|'optimal'|'warning'|'underload'}
 */
function getRoleStatus(percentage) {
    if (percentage >= 100) return 'overload';
    if (percentage >= SELECTION_CONFIG.TARGET_MIN_LOAD * 100) return 'optimal';
    if (percentage >= SELECTION_CONFIG.UNDERLOAD_THRESHOLD * 100) return 'warning';
    return 'underload';
}
