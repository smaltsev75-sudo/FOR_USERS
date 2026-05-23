import { parseStrictIntegerInRange } from '../../domain/strictInteger.js';
import {
    collectValidIds,
    createIdAllocator,
    normalizeInteger,
    safePlainObject
} from './primitiveNormalizers.js';

export function normalizeCriteria(criteria) {
    if (!Array.isArray(criteria)) return [];
    const objectCriteria = criteria.filter((c) => c && typeof c === 'object' && !Array.isArray(c));
    const validIds = collectValidIds(objectCriteria, 1);
    const allocate = createIdAllocator(validIds, 1);
    const seenIds = new Set();

    return objectCriteria.map((criterion) => {
        let id = parseStrictIntegerInRange(criterion.id, 1, Number.MAX_SAFE_INTEGER);
        if (id === null || seenIds.has(id)) {
            id = allocate();
        }
        seenIds.add(id);
        return {
            ...criterion,
            id,
            name: String(criterion.name ?? ''),
            abbreviation: String(criterion.abbreviation ?? ''),
            weight: normalizeInteger(criterion.weight, 0, 0, 100),
            rationale: String(criterion.rationale ?? ''),
            scale: { ...safePlainObject(criterion.scale) }
        };
    });
}

// Raw criterion id view до reallocation: нужен для alignment с analyzeImportIssues.
export function collectRawCriterionIds(rawCriteria) {
    const ids = new Set();
    if (!Array.isArray(rawCriteria)) return ids;
    for (const c of rawCriteria) {
        if (c && typeof c === 'object' && !Array.isArray(c)) {
            const cid = parseStrictIntegerInRange(c.id, 1, Number.MAX_SAFE_INTEGER);
            if (cid !== null) ids.add(cid);
        }
    }
    return ids;
}
