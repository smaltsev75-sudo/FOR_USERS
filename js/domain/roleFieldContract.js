// @ts-check
// js/domain/roleFieldContract.js
import { parseStrictInteger } from './strictInteger.js';
//
// Единый контракт парсинга/валидации FTE и off (отпуск) для всех entry points:
// roleController (UI ввод), persistence.js (import JSON), unit/integration тесты.
//
// Контракт v8.30.32 (после v8.30.31 audit feedback от пользователя):
//   FTE — целое число процентов ≥ 0, БЕЗ верхнего лимита.
//     Семантика: суммарная доступность роли. 100% = один сотрудник full-time.
//     150% = 1.5 FTE (один full-time + один half-time), 200% = два full-time, и т.д.
//     Дроби (12.5), parseInt-мусор (12abc), пустая строка, NaN, Infinity → null.
//   off — неотрицательное число с точностью до 1 знака после запятой.
//     0.5 = половина дня отсутствия. Принимаются «0.5» и «0,5».
//     Отрицательное (<0), parseInt-мусор, дробь точнее 1 знака (0.05),
//     NaN/Infinity → null.
//
// Контракт строгий: parseInt-мусор НЕ принимается. UI / persistence / tests
// используют ИДЕНТИЧНУЮ функцию.

// SEC-3 (DEEP-REFAC 2026-06-21): parseStrictInteger импортируется из
// strictInteger.js (был байт-идентичный копипаст — два источника правды могли
// разойтись). parseDecimalOneDigit ниже — НЕ дубль (контракт «ровно 1 знак»
// vs configurable maxDecimals у parseStrictDecimal), оставлен как есть.

/**
 * Strict decimal parsing с точностью до 1 знака после запятой.
 * Принимает: number (целое или с одним десятичным знаком) или string вида
 * `[-]ddd[.,]d?` без суффиксов. Запятая и точка — оба валидны.
 *
 * Контракт «1 знак»:
 *   - 5 → 5
 *   - 5.0 → 5  (нормализуется до целого, но не отвергается)
 *   - 5.5 → 5.5
 *   - 5.55 → null (третий знак — нарушение контракта)
 *   - "5,5" → 5.5
 *   - "5.5.5" → null
 *   - "abc" / "5abc" / "" → null
 *
 * @param {*} raw — sourced value
 * @returns {number|null}
 */
function parseDecimalOneDigit(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') {
        if (!Number.isFinite(raw)) return null;
        // Контракт: число с >1 знака после запятой — отвергается, не округляется.
        // 5.5 → 5.5; 5.55 → null; 5.05 → null.
        // Защита от floating-point дребезга: округляем×10 и сверяем.
        const scaled = Math.round(raw * 10);
        if (Math.abs(raw * 10 - scaled) > 1e-9) return null;
        return scaled / 10;
    }
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.length === 0) return null;
        // Допустимо: optional '-', цифры, optional один [.,]d (ровно одна десятая).
        // Запятая ИЛИ точка, не оба.
        if (!/^-?\d+(?:[.,]\d)?$/.test(trimmed)) return null;
        const normalized = trimmed.replace(',', '.');
        const n = Number(normalized);
        if (!Number.isFinite(n)) return null;
        // Двойная защита от floating-point.
        const scaled = Math.round(n * 10);
        if (Math.abs(n * 10 - scaled) > 1e-9) return null;
        return scaled / 10;
    }
    return null;
}

/**
 * Парсит значение поля роли по единому контракту.
 *
 * Семантика:
 *   fte — суммарная доступность роли в процентах, integer ≥ 0, без верхнего
 *     лимита. 100=full-time, 150=1.5 FTE, 200=два full-time.
 *   off — дни отсутствия (отпуск), decimal ≥ 0 с точностью до 1 знака.
 *     0.5 = половина дня. Принимается «0.5» и «0,5».
 *
 * @param {'fte'|'off'} field
 * @param {*} raw
 * @returns {number|null} строго валидное значение или null.
 */
export function parseRoleField(field, raw) {
    if (field === 'fte') {
        const parsed = parseStrictInteger(raw);
        if (parsed === null) return null;
        if (parsed < 0) return null;
        return parsed;
    }
    if (field === 'off') {
        const parsed = parseDecimalOneDigit(raw);
        if (parsed === null) return null;
        if (parsed < 0) return null;
        return parsed;
    }
    return null;
}

/**
 * Нормализует для persistence (import) — fallback на default вместо null.
 * Используется в migratePersistedState чтобы повреждённый JSON не ломал app.
 * @param {'fte'|'off'} field
 * @param {*} raw
 * @param {number} fallback
 * @returns {number}
 */
export function normalizeRoleFieldForPersistence(field, raw, fallback) {
    const parsed = parseRoleField(field, raw);
    return parsed === null ? fallback : parsed;
}
