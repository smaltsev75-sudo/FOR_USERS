import { calculateCriteriaValue, parseCriteriaScore } from '../../../domain/criteria.js';
import { ROLES } from '../../../utils/constants.js';

export function createEmptyTaskFormDraft(criteria = []) {
    return {
        title: '',
        jira: '',
        type: 'us',
        comment: '',
        criteriaEvaluations: emptyCriteriaEvaluations(criteria)
    };
}

export function taskToTaskFormDraft(task = {}, criteria = []) {
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
        criteriaEvaluations
    };
}

export function taskFormDraftToCreateTaskInput(draft) {
    return {
        title: draft.title,
        jira: draft.jira,
        type: draft.type || 'us',
        comment: draft.comment || '',
        estimates: emptyEstimates()
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

function emptyCriteriaEvaluations(criteria = []) {
    return Object.fromEntries(criteria.map(criterion => [
        criterion.id,
        { score: 0, value: 0 }
    ]));
}
