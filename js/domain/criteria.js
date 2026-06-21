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

/**
 * Strict-align eval-карты задачи к набору критериев: только ключи criteria,
 * существующие значения сохраняются, отсутствующие → {score:0,value:0},
 * orphan-ключи (нет в criteria) отбрасываются. Используется при импорте/восстановлении.
 */
export function alignCriteriaEvaluations(sourceEvaluations, criteria) {
    const source = sourceEvaluations || {};
    const evaluations = {};
    for (const criterion of criteria) {
        evaluations[criterion.id] = source[criterion.id] || { score: 0, value: 0 };
    }
    return evaluations;
}

export function alignTasksToCriteria(tasks, criteria) {
    return tasks.map(task => ({
        ...task,
        criteriaEvaluations: alignCriteriaEvaluations(task.criteriaEvaluations, criteria)
    }));
}

/**
 * CTRL-2 (DEEP-REFAC 2026-06-21): удаляет eval-ключ criterionId из всех задач
 * (delete-критерий path). Behavior-preserving extract из
 * criteriaController.deleteCriteria: spread + delete только этого ключа,
 * остальные (включая orphan) сохраняются, input не мутируется.
 */
export function removeCriterionEvaluation(tasks, criterionId) {
    return tasks.map(task => {
        const criteriaEvaluations = { ...(task.criteriaEvaluations || {}) };
        if (criteriaEvaluations[criterionId]) {
            delete criteriaEvaluations[criterionId];
        }
        return { ...task, criteriaEvaluations };
    });
}

/**
 * CTRL-2 (DEEP-REFAC 2026-06-21): добавляет {score:0,value:0} для отсутствующих
 * criteria-ключей, НЕ трогая существующие значения и НЕ удаляя orphan-ключи
 * (add-критерий path). Отличается от alignCriteriaEvaluations, который orphan
 * отбрасывает — поэтому отдельный helper, а не переиспользование align
 * (иначе orphan-drop = behavior-change).
 */
export function fillMissingCriteriaEvaluations(tasks, criteria) {
    return tasks.map(task => {
        const criteriaEvaluations = { ...(task.criteriaEvaluations || {}) };
        criteria.forEach(criterion => {
            if (!criteriaEvaluations[criterion.id]) {
                criteriaEvaluations[criterion.id] = { score: 0, value: 0 };
            }
        });
        return { ...task, criteriaEvaluations };
    });
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

