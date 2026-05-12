// js/controllers/task/formHelpers.js

export function parseNonNegativeNumber(nfs, value) {
    const parsed = nfs.parseNumber(value) || 0;
    return Math.max(0, parsed);
}

/**
 * Reads role-hour estimates from the form. Used by both Create (default
 * prefix 'h_') and Edit (prefix 'eh_') modals — the modals duplicate
 * structure but DOM IDs must be unique.
 * @param {Object} nfs - NumberFormatService
 * @param {Document|HTMLElement} [root=document]
 * @param {string} [prefix='h_'] - id prefix ('h_' for create, 'eh_' for edit)
 */
export function readCreateTaskEstimates(nfs, root = document, prefix = 'h_') {
    return {
        uiux: parseNonNegativeNumber(nfs, root.getElementById(`${prefix}uiux`)?.value),
        ca: parseNonNegativeNumber(nfs, root.getElementById(`${prefix}ca`)?.value),
        fe: parseNonNegativeNumber(nfs, root.getElementById(`${prefix}fe`)?.value),
        be: parseNonNegativeNumber(nfs, root.getElementById(`${prefix}be`)?.value),
        qa: parseNonNegativeNumber(nfs, root.getElementById(`${prefix}qa`)?.value)
    };
}

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
        const score = select ? (parseInt(select.value, 10) || 0) : 0;
        evaluations[criterion.id] = {
            score,
            value: (score * criterion.weight) / 10
        };
    });
    return evaluations;
}

export function calculateCreateFormTotal(nfs, root = document, prefix = 'h_') {
    const estimates = readCreateTaskEstimates(nfs, root, prefix);
    return estimates.uiux + estimates.ca + estimates.fe + estimates.be + estimates.qa;
}
