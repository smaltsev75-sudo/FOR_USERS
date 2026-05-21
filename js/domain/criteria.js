// @ts-check
// js/domain/criteria.js
import { parseStrictIntegerInRange } from './strictInteger.js';

export function parseCriteriaScore(raw) {
    const parsed = parseStrictIntegerInRange(raw, 0, 10);
    return parsed === null ? 0 : parsed;
}

export function calculatePriorityScore(criteria, evaluations) {
    if (!evaluations || criteria.length === 0) return 0;
    let totalScore = 0;
    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight === 0) return 0;
    criteria.forEach(criterion => {
        const evaluation = evaluations[criterion.id];
        // Используем score=0 как валидное значение (не пропускаем нулевые оценки)
        const score = evaluation !== null && evaluation !== undefined ? parseCriteriaScore(evaluation.score) : 0;
        totalScore += score * criterion.weight;
    });
    // Делим на totalWeight (не на 100), чтобы результат был корректным
    // при любой сумме весов. При сумме весов = 100 результат совпадает с прежним.
    return totalScore / totalWeight;
}

export function initializeCriteriaEvaluations(criteria) {
    const evaluations = {};
    criteria.forEach(criterion => {
        evaluations[criterion.id] = { score: 0, value: 0 };
    });
    return evaluations;
}

export function calculateCriteriaValue(score, weight) {
    return (score * weight) / 10;
}

export function updateCriteriaEvaluation(evaluation, newScore, weight) {
    const score = parseCriteriaScore(newScore);
    return {
        score,
        value: calculateCriteriaValue(score, weight)
    };
}

