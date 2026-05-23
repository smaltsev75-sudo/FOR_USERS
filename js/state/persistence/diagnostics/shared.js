import { parseStrictIntegerInRange } from '../../../domain/strictInteger.js';

export function isPlainRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function valueSample(value, limit = 80) {
    const sample = JSON.stringify(value) || String(value);
    return sample.slice(0, limit);
}

export function collectValidIds(items) {
    const ids = new Set();
    if (!Array.isArray(items)) return ids;
    for (const item of items) {
        if (!isPlainRecord(item)) continue;
        const id = parseStrictIntegerInRange(item.id, 1, Number.MAX_SAFE_INTEGER);
        if (id !== null) ids.add(id);
    }
    return ids;
}

export function addArrayShapeIssue(issues, rawState, fieldName, consequence) {
    if (rawState[fieldName] === undefined || Array.isArray(rawState[fieldName])) return;
    issues.push(`${fieldName} = ${valueSample(rawState[fieldName])} отвергнуто (требуется array); ${consequence}`);
}

export function addPlainObjectShapeIssues(issues, rawState, fieldNames, consequence) {
    for (const field of fieldNames) {
        if (rawState[field] === undefined) continue;
        if (!isPlainRecord(rawState[field])) {
            issues.push(`${field} = ${valueSample(rawState[field])} отвергнуто (требуется plain object); ${consequence}`);
        }
    }
}
