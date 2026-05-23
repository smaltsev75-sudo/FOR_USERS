// @ts-check
// js/controllers/task/criteriaScoreMutations.js

import { parseCriteriaScore } from '../../domain/criteria.js';

/**
 * Собирает immutable update оценки задачи по критерию.
 *
 * @param {object|null|undefined} task
 * @param {{ id: number, weight: number }|null|undefined} criterion
 * @param {string} rawScore
 * @returns {{ criteriaEvaluations: Record<string, { score: number, value: number }> } | null}
 */
export function buildCriteriaEvaluationUpdate(task, criterion, rawScore) {
    if (!task || !criterion) return null;

    const evaluations = { ...task.criteriaEvaluations };
    const parsedScore = parseCriteriaScore(rawScore);
    evaluations[criterion.id] = {
        score: parsedScore,
        value: (parsedScore * criterion.weight) / 10
    };

    return { criteriaEvaluations: evaluations };
}
