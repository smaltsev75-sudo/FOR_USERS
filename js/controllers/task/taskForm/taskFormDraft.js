import { calculateCriteriaValue, parseCriteriaScore } from '../../../domain/criteria.js';
import { ROLES } from '../../../utils/constants.js';

export function createEmptyTaskFormDraft(criteria = []) {
    return {
        title: '',
        jira: '',
        type: 'us',
        comment: '',
        estimates: emptyEstimates(),
        criteriaEvaluations: emptyCriteriaEvaluations(criteria)
    };
}

export function taskToTaskFormDraft(task = {}, criteria = []) {
    const estimates = emptyEstimates();
    const sourceEstimates = task.est || {};
    ROLES.forEach(role => {
        const value = sourceEstimates[role.id];
        estimates[role.id] = Number.isFinite(value) ? value : 0;
    });

    const sourceEvaluations = task.criteriaEvaluations || {};
    const criteriaEvaluations = {};
    criteria.forEach(criterion => {
        const score = sourceEvaluations[criterion.id]?.score;
        const parsedScore = parseCriteriaScore(score);
        criteriaEvaluations[criterion.id] = {
            score: parsedScore,
            value: calculateCriteriaValue(parsedScore, criterion.weight)
        };
    });

    return {
        title: task.title || '',
        jira: task.jira || '',
        type: task.type || 'us',
        comment: task.comment || '',
        estimates,
        criteriaEvaluations
    };
}

export function taskFormDraftToCreateTaskInput(draft) {
    return {
        title: draft.title,
        jira: draft.jira,
        type: draft.type || 'us',
        comment: draft.comment || '',
        estimates: normalizeEstimates(draft.estimates)
    };
}

export function taskFormDraftToTaskPatch(draft) {
    // Эффорт-секция удалена из модалки (owner): патч НЕ содержит est, поэтому
    // updateTask сохраняет существующие часы задачи (правятся инлайн в строке).
    return {
        title: draft.title,
        jira: draft.jira,
        type: draft.type || 'us',
        comment: draft.comment || '',
        criteriaEvaluations: draft.criteriaEvaluations || {}
    };
}

export function calculateDraftPriorityScore(criteria = [], criteriaEvaluations = {}) {
    if (!criteria.length) return 0;
    const totalWeight = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
    if (totalWeight <= 0) return 0;

    const weightedScore = criteria.reduce((sum, criterion) => {
        const score = parseCriteriaScore(criteriaEvaluations[criterion.id]?.score);
        return sum + score * criterion.weight;
    }, 0);

    return weightedScore / totalWeight;
}

function emptyEstimates() {
    return Object.fromEntries(ROLES.map(role => [role.id, 0]));
}

function normalizeEstimates(estimates = {}) {
    const normalized = {};
    ROLES.forEach(role => {
        const value = estimates[role.id];
        normalized[role.id] = Number.isFinite(value) ? value : 0;
    });
    return normalized;
}

function emptyCriteriaEvaluations(criteria = []) {
    return Object.fromEntries(criteria.map(criterion => [
        criterion.id,
        { score: 0, value: 0 }
    ]));
}
