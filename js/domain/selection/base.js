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
    const excludedTasks = [];   // исключённые задачи с причинами
    const selectedTaskIds = new Set();

    // Текущая загрузка по каждой роли (нарастающий итог)
    const loadByRole = {};
    SELECTION_CONFIG.ROLES.forEach(role => loadByRole[role] = 0);
    let totalLoad = 0; // суммарная загрузка (часы)
    const totalCapacity = Object.values(capacityByRole).reduce((sum, v) => sum + v, 0);

    for (const task of sortedTasks) {
        // Пропускаем вручную исключённые задачи
        if (task.excluded) {
            excludedTasks.push({ ...task, reason: 'Исключена вручную', canBeAdded: false });
            continue;
        }

        // Пропускаем задачи без оценки трудозатрат
        if (task.effort <= 0) {
            excludedTasks.push({ ...task, reason: 'Нулевая оценка трудозатрат', canBeAdded: false });
            continue;
        }

        // Проверка: не превысит ли общая загрузка суммарную ёмкость
        if (totalLoad + task.effort > totalCapacity) {
            excludedTasks.push({ ...task, reason: 'Недостаточно общей ёмкости команды', canBeAdded: false });
            continue;
        }

        // Проверка: не превысит ли загрузка ёмкость хотя бы одной роли
        let roleOverload = false;
        for (const role of SELECTION_CONFIG.ROLES) {
            const current = loadByRole[role] || 0;
            const addition = task.roleEffort[role] || 0;
            const capacity = capacityByRole[role] || 0;
            if (current + addition > capacity) {
                roleOverload = true;
                break;
            }
        }
        if (roleOverload) {
            excludedTasks.push({ ...task, reason: 'Недостаточно ресурсов по ролям', canBeAdded: false });
            continue;
        }

        // Проверка зависимостей: все зависимости должны быть уже отобраны
        if (task.dependencies && task.dependencies.length > 0) {
            const unmet = task.dependencies.some(depId => !selectedTaskIds.has(depId));
            if (unmet) {
                excludedTasks.push({ ...task, reason: 'Не выполнены зависимости', canBeAdded: true });
                continue;
            }
        }

        // Все проверки прошли — включаем задачу в спринт
        selectedTasks.push(task);
        selectedTaskIds.add(task.id);

        // Обновляем текущую загрузку
        SELECTION_CONFIG.ROLES.forEach(role => {
            loadByRole[role] += task.roleEffort[role] || 0;
        });
        totalLoad += task.effort;
    }

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
