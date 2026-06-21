import { parseStrictIntegerInRange } from '../../domain/strictInteger.js';

// v8.30.35: единый helper для всех nested JSON-ish shapes.
export function safePlainObject(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    return {};
}

// v8.30.0: unique-id allocator с first-owner-wins политикой у callers.
export function createIdAllocator(existingIds, minBase = 1) {
    const used = new Set(existingIds);
    // PERSIST-3 (DEEP-REFAC 2026-06-21): fold вместо Math.max(...used) — спред
    // большого Set в аргументы бросал RangeError на крупном импорте и ломал
    // total-function контракт migrate. O(n) без spread, результат идентичен.
    let maxId = minBase - 1;
    for (const id of used) {
        if (id > maxId) maxId = id;
    }
    let next = maxId + 1;
    return () => {
        while (used.has(next)) next++;
        const id = next;
        used.add(id);
        next++;
        return id;
    };
}

// v8.30.34: strict ID контракт — без parseInt-мусора вроде "1abc".
export function collectValidIds(items, minValue = 1) {
    const ids = [];
    if (!Array.isArray(items)) return ids;
    for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const parsed = parseStrictIntegerInRange(item.id, minValue, Number.MAX_SAFE_INTEGER);
        if (parsed !== null) ids.push(parsed);
    }
    return ids;
}

export function checkIntegerField(issues, fieldName, value, min, max) {
    if (value === undefined || value === null) return;
    if (parseStrictIntegerInRange(value, min, max) === null) {
        issues.push(`${fieldName} = ${JSON.stringify(value)} отвергнуто (требуется целое в [${min}, ${max}]); применён fallback`);
    }
}

/**
 * Strict integer для persistence/import: только integer number или строка из
 * чистых цифр в заданном диапазоне, иначе fallback.
 */
export function normalizeInteger(value, fallback, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
    const parsed = parseStrictIntegerInRange(value, min, max);
    return parsed === null ? fallback : parsed;
}

/**
 * Нормализует число для persistence; non-finite значения не попадают в state.
 */
export function normalizeNumber(value, fallback, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY, decimals = null) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    let result = Math.max(min, Math.min(max, parsed));
    if (decimals !== null && Number.isFinite(decimals) && decimals >= 0) {
        const factor = 10 ** Math.floor(decimals);
        result = Math.round(result * factor) / factor;
    }
    return result;
}
