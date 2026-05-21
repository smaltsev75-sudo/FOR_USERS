// @ts-check
// js/domain/strictInteger.js
//
// Единый strict-integer контракт для всех integer-полей конфигурации/критериев.
// Закрывает класс ошибок «parseInt-мусор тихо превращается в 1/0»:
//   parseInt('1abc', 10) === 1   // принят как 1 (мусор)
//   parseInt('1.9', 10) === 1    // дробь усечена (мусор)
//   parseInt('', 10) === NaN     // обычно превращался в 0/1 fallback
//
// Контракт парсера v8.30.33:
//   - валидный input → integer
//   - '1abc', '1.9', '', '  ', null, undefined, NaN, Infinity, {}, [] → null
//   - дробь в любой форме → null (включая '5.0' если требуется чистый integer)
//
// Используется:
//   - configController (days ≥1, holidays ≥0, alert ≥0)
//   - criteriaController._handleInlineInput/_handleInlineCommit (weight 0..100)
//   - criteriaFormController.saveCriteria (weight 0..100)
//   - persistence.normalizeInteger (loaded JSON)
//   - roleFieldContract (FTE integer ≥0, через re-export)

/**
 * Strict integer parsing. Принимает: number (integer) или string из чистых цифр
 * (optionally leading '-'). Любая дробь, suffix, NaN, Infinity → null.
 *
 * @param {*} raw — sourced value (UI input, JSON, etc.)
 * @returns {number|null}
 */
export function parseStrictInteger(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') {
        if (!Number.isFinite(raw)) return null;
        if (!Number.isInteger(raw)) return null;
        return raw;
    }
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.length === 0) return null;
        if (!/^-?\d+$/.test(trimmed)) return null;
        const n = Number(trimmed);
        return Number.isFinite(n) && Number.isInteger(n) ? n : null;
    }
    return null;
}

/**
 * Strict integer в диапазоне [min, max] включительно. Вне диапазона → null.
 * Для нижних/верхних безграничных диапазонов передавать -Infinity / Infinity.
 *
 * @param {*} raw
 * @param {number} [min=-Infinity]
 * @param {number} [max=Infinity]
 * @returns {number|null}
 */
export function parseStrictIntegerInRange(raw, min = -Infinity, max = Infinity) {
    const parsed = parseStrictInteger(raw);
    if (parsed === null) return null;
    if (parsed < min || parsed > max) return null;
    return parsed;
}

/**
 * Нормализация для persistence: fallback на default вместо null.
 * Возвращает {value, warning} — warning заполнен если raw был невалиден и
 * пришлось fallback'нуть на default. Используется для honest import warnings.
 *
 * @param {*} raw
 * @param {number} fallback
 * @param {number} [min=-Infinity]
 * @param {number} [max=Infinity]
 * @returns {{value: number, warning: string|null}}
 */
export function normalizeStrictIntegerForPersistence(raw, fallback, min = -Infinity, max = Infinity) {
    const parsed = parseStrictIntegerInRange(raw, min, max);
    if (parsed === null) {
        return {
            value: fallback,
            warning: `value=${JSON.stringify(raw)} отвергнуто (ожидалось целое в [${min}, ${max}]); применён fallback=${fallback}`
        };
    }
    return { value: parsed, warning: null };
}
