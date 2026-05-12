// @ts-check
// js/ui/createTaskRowVM.js
//
// VM-builder для строки задачи. Отделяет данные (для рендера) от DOM-манипуляций.
// Не импортирует Store, не работает с DOM. Чистая трансформация:
//
//   (task, criteria, roles) → TaskRowViewModel
//
// roleChipsVisible — top-3 ненулевых ролей по effort ↓
// roleChipsHidden  — остальные ненулевые роли (для tooltip «+N»)
// criteriaSummary  — массив { id, abbreviation, weight, score, value, name } по криьериям

const TYPE_LETTER = { us: 'U', bug: 'B', tech: 'T' };
const TYPE_LABEL = { us: 'User Story', bug: 'Bug', tech: 'Tech' };
const MAX_VISIBLE_ROLE_CHIPS = 3;

/**
 * Возвращает уровень приоритета по итоговому priorityScore.
 * Используется для цветовой кодировки бейджа Priority Score.
 * 8.0+ → critical, 6.0+ → high, 4.0+ → medium, <4 → low.
 * @param {number} score
 * @returns {'critical'|'high'|'medium'|'low'}
 */
export function getPriorityLevel(score) {
    const s = Number(score) || 0;
    if (s >= 8) return 'critical';
    if (s >= 6) return 'high';
    if (s >= 4) return 'medium';
    return 'low';
}

const PRIORITY_LABEL = {
    critical: 'Критический',
    high: 'Высокий',
    medium: 'Средний',
    low: 'Низкий'
};

/**
 * Текстовая метка приоритета для отображения в бейдже.
 * @param {'critical'|'high'|'medium'|'low'} level
 */
export function getPriorityLabel(level) {
    return PRIORITY_LABEL[level] || PRIORITY_LABEL.low;
}

/**
 * @typedef {Object} RoleChip
 * @property {string} id
 * @property {string} name
 * @property {number} value
 */

/**
 * @typedef {Object} CriterionSummary
 * @property {number|string} id
 * @property {string} abbreviation
 * @property {string} name
 * @property {number} weight
 * @property {number} score
 * @property {number} value
 */

/**
 * @typedef {Object} TaskRowViewModel
 * @property {number} id
 * @property {string} title
 * @property {string} jira
 * @property {string} jiraKey
 * @property {string} comment
 * @property {string} type
 * @property {string} typeLetter
 * @property {string} typeLabel
 * @property {boolean} excluded
 * @property {string} exclusionReason
 * @property {RoleChip[]} roleAll        — все роли (включая 0-значения), для backward-совместимого рендера inputs
 * @property {RoleChip[]} roleChips      — все non-zero роли (отсортированы по value ↓)
 * @property {RoleChip[]} roleChipsVisible — топ-N (MAX_VISIBLE_ROLE_CHIPS)
 * @property {RoleChip[]} roleChipsHidden  — остальные non-zero
 * @property {number} roleChipsOverflow    — длина hidden, для бейджа «+N»
 * @property {string} roleChipsOverflowTooltip — tooltip для бейджа «+N»
 * @property {number} totalEffort
 * @property {CriterionSummary[]} criteriaSummary
 */

/**
 * Строит view-model строки задачи.
 * @param {Object} task — задача
 * @param {Array<Object>} criteria — список критериев
 * @param {Array<{id: string, name: string}>} roles — список ролей
 * @returns {TaskRowViewModel}
 */
export function createTaskRowVM(task, criteria = [], roles = []) {
    const est = (task && task.est) || {};

    const roleAll = roles.map(r => ({
        id: r.id,
        name: r.name,
        value: Number(est[r.id]) || 0
    }));

    // roleChips сохраняет порядок ROLES (для стабильного отображения inputs).
    const roleChips = roleAll.filter(c => c.value > 0);

    // roleChipsVisible — top-N по значению effort ↓ (для компактных chip-ов сверху списка).
    const sortedByValue = roleChips.slice().sort((a, b) => b.value - a.value);
    const roleChipsVisible = sortedByValue.slice(0, MAX_VISIBLE_ROLE_CHIPS);
    const roleChipsHidden = sortedByValue.slice(MAX_VISIBLE_ROLE_CHIPS);
    const roleChipsOverflow = roleChipsHidden.length;
    const roleChipsOverflowTooltip = roleChipsHidden
        .map(c => `${c.name}: ${c.value}`)
        .join(', ');

    const totalEffort = roleAll.reduce((sum, c) => sum + c.value, 0);

    const evaluations = (task && task.criteriaEvaluations) || {};
    const criteriaSummary = (criteria || []).map(crit => {
        const ev = evaluations[crit.id] || { score: 0, value: 0 };
        const score = Number(ev.score) || 0;
        const weight = Number(crit.weight) || 0;
        return {
            id: crit.id,
            abbreviation: String(crit.abbreviation || ''),
            name: String(crit.name || ''),
            weight,
            score,
            value: (score * weight) / 10
        };
    });

    const jira = String((task && task.jira) || '');
    const jiraKey = jira ? (jira.split('/').pop() || '') : '';

    return {
        id: Number((task && task.id) || 0),
        title: String((task && task.title) || ''),
        jira,
        jiraKey,
        comment: String((task && task.comment) || ''),
        type: String((task && task.type) || 'us'),
        typeLetter: TYPE_LETTER[(task && task.type)] || 'U',
        typeLabel: TYPE_LABEL[(task && task.type)] || TYPE_LABEL.us,
        excluded: Boolean(task && task.excluded),
        exclusionReason: String((task && task.exclusionReason) || ''),
        roleAll,
        roleChips,
        roleChipsVisible,
        roleChipsHidden,
        roleChipsOverflow,
        roleChipsOverflowTooltip,
        totalEffort,
        criteriaSummary
    };
}

export const VM_CONSTANTS = Object.freeze({
    MAX_VISIBLE_ROLE_CHIPS
});
