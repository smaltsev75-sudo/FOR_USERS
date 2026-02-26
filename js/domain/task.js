// @ts-check
// js/domain/task.js
import { initializeCriteriaEvaluations } from './criteria.js';
import { ROLES } from '../utils/constants.js';

/**
 * Monotonic ID counter. Seeded from Date.now() so IDs remain unique across
 * page reloads, but rapid successive calls never produce the same value.
 */
let _nextTaskId = Date.now();

/**
 * Resets the task ID counter to the given seed value.
 * Intended for use in tests only — do not call in production code.
 * @param {number} [seed=0]
 */
export function _resetTaskIdCounter(seed = 0) {
    _nextTaskId = seed;
}

/**
 * Рассчитывает суммарный Effort задачи по всем ролям.
 * @param {Object} task - Объект задачи.
 * @param {Array} roles - Массив ролей.
 * @returns {number} Суммарное количество часов.
 */
export function calculateTaskTotal(task, roles) {
    let total = 0;
    roles.forEach(role => total += task.est?.[role.id] || 0);
    return total;
}

/**
 * Создаёт новый объект задачи.
 * @param {Object} params - Параметры задачи.
 * @param {string} params.title - Название.
 * @param {string} params.jira - Ссылка JIRA.
 * @param {string} params.type - Тип (us, bug, tech).
 * @param {string} params.comment - Комментарий.
 * @param {Object} params.estimates - Оценки по ролям.
 * @returns {Object} Новая задача.
 */
export function createTask({ title, jira, type, comment, estimates }) {
    return {
        id: ++_nextTaskId,
        title: title.trim(),
        jira: jira.trim(),
        type,
        comment: comment.trim(),
        excluded: 0,
        est: { ...estimates },
        exclusionReason: '',
        criteriaEvaluations: {}
    };
}

/**
 * Проверяет корректность порядка задач (исключённые должны быть в конце).
 * @param {Array} tasks - Массив задач
 * @returns {boolean} Корректен ли порядок.
 */
export function validateTaskOrder(tasks) {
    let foundExcluded = false;
    for (let i = 0; i < tasks.length; i++) {
        if (tasks[i].excluded) foundExcluded = true;
        else if (foundExcluded) return false;
    }
    return true;
}

/**
 * Перемещает исключённые задачи в конец массива.
 * @param {Array} tasks - Массив задач
 * @returns {Array} Отсортированный массив.
 */
export function fixTaskOrder(tasks) {
    const included = tasks.filter(t => !t.excluded);
    const excluded = tasks.filter(t => t.excluded);
    return [...included, ...excluded];
}

/**
 * Подготавливает задачу для алгоритмов отбора.
 * @param {Object} task - Исходная задача.
 * @param {Array} roles - Массив ролей.
 * @param {Function} priorityScoreFn - Функция расчёта Priority Score.
 * @returns {Object} Подготовленная задача.
 */
export function prepareTaskForSelection(task, roles, priorityScoreFn) {
    const effort = calculateTaskTotal(task, roles);
    return {
        id: task.id,
        title: task.title,
        priorityScore: task.priorityScore !== undefined ? task.priorityScore : priorityScoreFn(task),
        effort,
        roleEffort: Object.fromEntries(ROLES.map(r => [r.id, task.est?.[r.id] || 0])),
        excluded: task.excluded || false,
        type: task.type,
        dependencies: task.dependencies || [],
        rawTask: task
    };
}

/**
 * Возвращает статистику по задачам (включённые/исключённые, типы).
 * @param {Array} tasks - Массив задач
 * @returns {Object} Статистика.
 */
export function getTaskStats(tasks) {
    const stats = {
        included: { total: 0, us: 0, bug: 0, tech: 0 },
        excluded: { total: 0, us: 0, bug: 0, tech: 0 }
    };
    tasks.forEach(t => {
        if (t.excluded) {
            stats.excluded.total++;
            stats.excluded[t.type]++;
        } else {
            stats.included.total++;
            stats.included[t.type]++;
        }
    });
    return stats;
}

/**
 * Сортирует задачи по убыванию Priority Score.
 * @param {Array} tasks - Массив задач
 * @param {Function} priorityScoreFn - Функция расчёта Priority Score.
 * @returns {Array} Отсортированный массив.
 */
export function sortTasksByPriorityScore(tasks, priorityScoreFn) {
    return [...tasks].sort((a, b) => {
        const scoreA = priorityScoreFn(a);
        const scoreB = priorityScoreFn(b);
        return scoreB - scoreA;
    });
}
