// js/controllers/task/formHelpers.js

import { parseCriteriaScore } from '../../domain/criteria.js';

/**
 * Collects criteria evaluations from selects in the form.
 * @param {Array<{id, weight}>} criteria
 * @param {Document|HTMLElement} [root=document]
 * @param {string} [selectIdPrefix='criteria_'] — 'criteria_' for create, 'editCriteria_' for edit
 */
export function collectCriteriaEvaluations(criteria, root = document, selectIdPrefix = 'criteria_') {
    const evaluations = {};
    criteria.forEach((criterion) => {
        const select = root.getElementById(`${selectIdPrefix}${criterion.id}`);
        const score = select ? parseCriteriaScore(select.value) : 0;
        evaluations[criterion.id] = {
            score,
            value: (score * criterion.weight) / 10
        };
    });
    return evaluations;
}
