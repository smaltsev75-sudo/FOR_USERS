// @ts-check
// js/domain/selection/quadrants.js
// Pure-функция назначения квадрантов задачам для UI-группировки.
//
// В отличие от matrix/valueDensity/hybrid (которые делают полный отбор),
// здесь только распределяем задачи по 4 квадрантам приоритетной матрицы
// и сортируем внутри каждого по priorityScore ↓. Используется в режиме
// группировки списка задач (View toggle: List ↔ Quadrants).

import { ROLES } from '../../utils/constants.js';
import { calculateMedians, categorizeIntoQuadrants, compareByPriority } from './base.js';

/**
 * Список ключей квадрантов в порядке Q1 → Q4.
 * Используется для итерации по группам в UI.
 * @type {ReadonlyArray<'q1'|'q2'|'q3'|'q4'>}
 */
export const QUADRANT_KEYS = Object.freeze(['q1', 'q2', 'q3', 'q4']);

/**
 * Полный список ключей групп для UI-режима Quadrants, включая отдельную
 * группу «Исключённые» (рендерится 5-й секцией под Q4).
 * @type {ReadonlyArray<'q1'|'q2'|'q3'|'q4'|'excluded'>}
 */
export const QUADRANT_KEYS_WITH_EXCLUDED = Object.freeze(['q1', 'q2', 'q3', 'q4', 'excluded']);

const QUADRANT_LABELS = {
    q1: 'Лёгкие победы',
    q2: 'Стратегические задачи',
    q3: 'Заполнители спринта',
    q4: 'Откладывать',
    excluded: 'Исключённые из спринта'
};

const QUADRANT_DESCRIPTIONS = {
    q1: 'Высокий приоритет, малые трудозатраты',
    q2: 'Высокий приоритет, большие трудозатраты',
    q3: 'Низкий приоритет, малые трудозатраты',
    q4: 'Низкий приоритет, большие трудозатраты',
    excluded: 'Задачи, помеченные исключёнными — не учитываются в спринте'
};

/**
 * Возвращает читаемое название квадранта (для заголовка группы).
 * @param {string} key — 'q1' | 'q2' | 'q3' | 'q4'
 * @returns {string}
 */
export function getQuadrantLabel(key) {
    return QUADRANT_LABELS[key] || '';
}

/**
 * Возвращает краткое описание квадранта (для подсказки/aria-label).
 * @param {string} key
 * @returns {string}
 */
export function getQuadrantDescription(key) {
    return QUADRANT_DESCRIPTIONS[key] || '';
}

/**
 * Вычисляет суммарный effort задачи: либо явное поле task.effort,
 * либо сумма всех est по ролям. Pure — не зависит от store/DOM.
 * @param {Object} task
 * @returns {number}
 */
function resolveEffort(task) {
    if (typeof task.effort === 'number' && Number.isFinite(task.effort)) {
        return task.effort;
    }
    if (task.est && typeof task.est === 'object') {
        return ROLES.reduce((sum, role) => sum + (Number(task.est[role.id]) || 0), 0);
    }
    return 0;
}

/**
 * Распределяет задачи по 4 квадрантам приоритетной матрицы.
 *
 * На вход — задачи c полями `priorityScore` (число) и либо `effort` (число),
 * либо `est` (объект `{ roleId: hours }`). На выход — четыре массива (q1..q4),
 * в каждом задачи отсортированы по `priorityScore ↓`. Каждой задаче в выходе
 * добавляется поле `quadrant` (читается UI для дата-атрибутов) и `rawTask`
 * (ссылка на оригинал).
 *
 * Pure-функция: не читает store, не трогает DOM.
 *
 * @param {Array<Object>|null|undefined} tasks
 * @returns {{
 *   q1: Array, q2: Array, q3: Array, q4: Array,
 *   medians: { medianPriority: number, medianEffort: number },
 *   stats: { q1: number, q2: number, q3: number, q4: number, total: number }
 * }}
 */
export function assignQuadrants(tasks) {
    const safeTasks = Array.isArray(tasks) ? tasks : [];

    // Нормализуем задачи под shape, ожидаемый базовыми функциями (priorityScore, effort).
    const normalized = safeTasks.map((task) => ({
        id: task.id,
        priorityScore: Number(task.priorityScore) || 0,
        effort: resolveEffort(task),
        excluded: !!task.excluded,
        rawTask: task
    }));

    if (normalized.length === 0) {
        return {
            q1: [],
            q2: [],
            q3: [],
            q4: [],
            excluded: [],
            medians: { medianPriority: 0, medianEffort: 0 },
            stats: { q1: 0, q2: 0, q3: 0, q4: 0, excluded: 0, total: 0 }
        };
    }

    // v8.29.1: исключённые задачи полностью выносятся ИЗ квадрантной
    // классификации в отдельную группу `excluded`. До этой правки они
    // могли торчать в Q1/Q2 из-за высокого priorityScore, что
    // противоречит UX-ожиданию «исключённое → в самый низ списка».
    //
    // Медиана считается ТОЛЬКО по не-исключённым задачам — иначе
    // outlier'ы в excluded (старые задачи с высоким priority) перекашивают
    // классификацию и заставляют активные задачи мигрировать между
    // квадрантами при каждом исключении.
    const includedTasks = normalized.filter((t) => !t.excluded);
    const excludedTasks = normalized.filter((t) => t.excluded);

    const medians = includedTasks.length > 0
        ? calculateMedians(includedTasks)
        : { medianPriority: 0, medianEffort: 0 };

    const grouped = categorizeIntoQuadrants(includedTasks, medians.medianPriority, medians.medianEffort);

    // Q1..Q4 — только не-исключённые, sorted priority ↓.
    const result = { q1: [], q2: [], q3: [], q4: [], excluded: [] };
    QUADRANT_KEYS.forEach((key) => {
        const sorted = [...grouped[key]].sort(compareByPriority);
        result[key] = sorted.map((t) => ({ ...t, quadrant: key }));
    });

    // Excluded — отдельная группа, sorted priority ↓.
    result.excluded = [...excludedTasks]
        .sort(compareByPriority)
        .map((t) => ({ ...t, quadrant: 'excluded' }));

    return {
        ...result,
        medians,
        stats: {
            q1: result.q1.length,
            q2: result.q2.length,
            q3: result.q3.length,
            q4: result.q4.length,
            excluded: result.excluded.length,
            total: normalized.length
        }
    };
}
