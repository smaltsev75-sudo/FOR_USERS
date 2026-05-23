import { parseStrictIntegerInRange } from '../../../domain/strictInteger.js';
import { collectValidIds, isPlainRecord, valueSample } from './shared.js';

export function collectValidCriterionIds(rawState) {
    return collectValidIds(rawState.criteria);
}

export function addCriteriaIssues(issues, rawState) {
    if (!Array.isArray(rawState.criteria)) return;

    const seenCritIds = new Set();
    rawState.criteria.forEach((criterion, i) => {
        if (isPlainRecord(criterion)) {
            if (criterion.id !== undefined && parseStrictIntegerInRange(criterion.id, 1, Number.MAX_SAFE_INTEGER) === null) {
                issues.push(`criteria[${i}].id = ${JSON.stringify(criterion.id)} отвергнуто (требуется целое ≥1); назначен новый id`);
            } else if (criterion.id !== undefined) {
                const sid = parseStrictIntegerInRange(criterion.id, 1, Number.MAX_SAFE_INTEGER);
                if (seenCritIds.has(sid)) {
                    issues.push(`criteria[${i}].id = ${sid} — duplicate criterion id; назначен новый`);
                } else {
                    seenCritIds.add(sid);
                }
            }
            if (criterion.weight !== undefined && parseStrictIntegerInRange(criterion.weight, 0, 100) === null) {
                issues.push(`criteria[${i}].weight = ${JSON.stringify(criterion.weight)} отвергнуто (требуется целое 0..100); применён fallback`);
            }
            if (criterion.scale !== undefined && !isPlainRecord(criterion.scale)) {
                issues.push(`criteria[${i}].scale = ${valueSample(criterion.scale)} отвергнуто (требуется plain object); применён {}`);
            }
        } else if (criterion !== undefined) {
            issues.push(`criteria[${i}] = ${JSON.stringify(criterion)} отвергнуто (требуется object); пропущено`);
        }
    });
}
