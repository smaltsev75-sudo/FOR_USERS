import { parseStrictIntegerInRange } from '../../domain/strictInteger.js';
import { normalizeInteger, normalizeNumber, safePlainObject } from './primitiveNormalizers.js';

/**
 * v8.30.36/v8.30.37: context-aware criteria evaluation map.
 * Invalid keys are dropped; orphan keys are dropped only when criteria context
 * is explicitly known. Numeric keys are canonicalized to runtime lookup shape.
 */
export function normalizeCriteriaEvaluations(evaluations, validCriterionIds = null) {
    const safe = safePlainObject(evaluations);
    const normalized = {};
    for (const key of Object.keys(safe)) {
        const keyId = parseStrictIntegerInRange(key, 1, Number.MAX_SAFE_INTEGER);
        if (keyId === null) continue;
        if (validCriterionIds !== null && !validCriterionIds.has(keyId)) continue;

        const canonicalKey = String(keyId);
        if (Object.prototype.hasOwnProperty.call(normalized, canonicalKey)) continue;

        const item = safe[key];
        const safeItem = (item && typeof item === 'object' && !Array.isArray(item)) ? item : {};
        normalized[canonicalKey] = {
            score: normalizeInteger(safeItem.score, 0, 0, 10),
            value: normalizeNumber(safeItem.value, 0, 0, Number.POSITIVE_INFINITY, 2)
        };
    }
    return normalized;
}
