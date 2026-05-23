// js/utils/fileName.js
// Helpers for user-visible export filenames.

const RESERVED_FILENAME_CHARS = /[\\/:*?"<>|]+/g;
const MAX_FILENAME_PART_LENGTH = 60;

/**
 * Normalizes a user-entered value so it is safe as one part of a filename.
 * It removes OS-reserved characters, ASCII control chars and trailing dots/spaces.
 *
 * @param {*} value
 * @returns {string}
 */
export function sanitizeFilenamePart(value) {
    return String(value ?? '')
        .replace(RESERVED_FILENAME_CHARS, '_')
        .split('')
        .map(ch => ch.charCodeAt(0) < 32 ? '_' : ch)
        .join('')
        .replace(/[. ]+$/g, '')
        .slice(0, MAX_FILENAME_PART_LENGTH)
        .trim()
        .replace(/[. ]+$/g, '');
}

/**
 * Builds the JSON export filename used by Sprint Planner.
 *
 * @param {*} productName
 * @param {Date|string|number} [date]
 * @returns {string}
 */
export function buildSprintPlanFilename(productName, date = new Date()) {
    const parsedDate = date instanceof Date ? date : new Date(date);
    const datePart = Number.isFinite(parsedDate.getTime())
        ? parsedDate.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    const productSlug = sanitizeFilenamePart(productName);
    const productPrefix = productSlug ? productSlug + '-' : '';
    return productPrefix + 'sprint-plan-' + datePart + '.json';
}
