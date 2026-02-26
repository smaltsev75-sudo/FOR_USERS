// js/controllers/task/formHelpers.js

export function parseNonNegativeNumber(nfs, value) {
    const parsed = nfs.parseNumber(value) || 0;
    return Math.max(0, parsed);
}

export function readCreateTaskEstimates(nfs, root = document) {
    return {
        uiux: parseNonNegativeNumber(nfs, root.getElementById('h_uiux')?.value),
        ca: parseNonNegativeNumber(nfs, root.getElementById('h_ca')?.value),
        fe: parseNonNegativeNumber(nfs, root.getElementById('h_fe')?.value),
        be: parseNonNegativeNumber(nfs, root.getElementById('h_be')?.value),
        qa: parseNonNegativeNumber(nfs, root.getElementById('h_qa')?.value)
    };
}

export function collectCriteriaEvaluations(criteria, root = document) {
    const evaluations = {};
    criteria.forEach((criterion) => {
        const select = root.getElementById(`criteria_${criterion.id}`);
        const score = select ? (parseInt(select.value, 10) || 0) : 0;
        evaluations[criterion.id] = {
            score,
            value: (score * criterion.weight) / 10
        };
    });
    return evaluations;
}

export function calculateCreateFormTotal(nfs, root = document) {
    const estimates = readCreateTaskEstimates(nfs, root);
    return estimates.uiux + estimates.ca + estimates.fe + estimates.be + estimates.qa;
}
