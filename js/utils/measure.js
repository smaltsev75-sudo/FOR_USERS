// @ts-check
// js/utils/measure.js
// Pure value-measurement helpers shared by the diagnostics / recovery /
// statePreview / storageHealth services. No DOM, no Store, no business logic.

/**
 * Coerce a value to a finite number, or null when it is not finite.
 * Uses Number() semantics (e.g. Number(null) === 0, Number('') === 0),
 * preserved exactly from the original per-service copies.
 * @param {*} value
 * @returns {number|null}
 */
export function finiteOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

/**
 * UTF-8 byte length of a string; 0 for non-strings. Prefers TextEncoder, then
 * Blob (both give true UTF-8 byte counts and are equivalent), with a UTF-16
 * code-unit fallback only for runtimes that expose neither. This matches the
 * production behavior of every service that previously kept a private copy
 * (some used TextEncoder, diagnostics used `new Blob([value]).size`).
 * @param {*} value
 * @returns {number}
 */
export function byteLength(value) {
    if (typeof value !== 'string') return 0;
    if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(value).length;
    }
    if (typeof Blob !== 'undefined') {
        return new Blob([value]).size;
    }
    return value.length;
}
