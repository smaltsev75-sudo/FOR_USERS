
// js/services/numberFormat.js

/**
 * Максимум знаков после запятой для отображения и пользовательского ввода.
 * v8.30.22: вся точность чисел в UI и input-полях capped к 2 знакам.
 * Архитектурный инвариант — tests/unit/architecture/decimal-precision-cap.test.js.
 */
export const MAX_DECIMALS = 2;

function clampDecimals(decimals) {
    const n = Number.isFinite(decimals) ? Math.floor(decimals) : 1;
    if (n < 0) return 0;
    if (n > MAX_DECIMALS) return MAX_DECIMALS;
    return n;
}

// v8.30.24: убрать trailing zeros после форматирования fixed-precision.
// `8,50` → `8,5`, `8,00` → `8`. Decimal-separator agnostic.
function trimTrailingZerosFromFormatted(formatted, separator) {
    if (!formatted.includes(separator)) return formatted;
    let result = formatted;
    while (result.endsWith('0')) result = result.slice(0, -1);
    if (result.endsWith(separator)) result = result.slice(0, -1);
    return result;
}

export class NumberFormatService {
    /**
     * @param {string} [initialSeparator] - Начальный разделитель десятичных знаков.
     *   Если не передан, загружается из localStorage.
     */
    constructor(initialSeparator) {
        this.groupSeparator = ' ';
        if (initialSeparator !== undefined) {
            this.decimalSeparator = initialSeparator;
        } else {
            this.decimalSeparator = ',';
            this.loadSettings();
        }
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('numberFormatSettings');
            if (saved) {
                const settings = JSON.parse(saved);
                this.decimalSeparator = settings.decimalSeparator || ',';
            }
        } catch { /* игнор ошибок localStorage */ }
    }

    /**
     * UTILSVC-2 (DEEP-REFAC 2026-06-21): single source of truth для
     * decimalSeparator — главный state-blob (`numberFormatSettings.decimalSeparator`,
     * persistenceCoordinator → serializeStateForStorage). Раньше отдельный
     * standalone-ключ `localStorage['numberFormatSettings']` писался ПАРАЛЛЕЛЬНО:
     * он не попадал в pre-migration backup и diagnostics, мог разойтись с blob и
     * на старте всё равно затирался значением из blob (app.js). Standalone-WRITE
     * убран — separator теперь персистится ТОЛЬКО через state-blob (covered by
     * backup/diagnostics). `loadSettings()` оставлен как legacy read-fallback для
     * старых blob'ов без separator (без data-loss). No-op возвращает ok=true:
     * запись теперь не может провалиться здесь, ошибки storage сигналит state-blob save.
     * @returns {{ok: true}}
     */
    saveSettings() {
        return { ok: true };
    }

    /**
     * Форматирует число для отображения.
     *
     * v8.30.24: дефолт **2 знака + trim trailing zeros**. Это закрывает
     * внешний аудит P1.2 — раньше дефолт был 1 знак, и карточки задач
     * показывали 1,23 как 1,2 (визуально другое число).
     *
     * Поведение: 1.23 → "1,23"; 8 → "8"; 8.5 → "8,5"; 8.50 → "8,5";
     * 12.75 → "12,75". Если нужен fixed формат с trailing — передать
     * `{trimTrailingZeros: false}`: formatNumber(5, 1, {trimTrailingZeros:false}) → "5,0".
     *
     * decimals аргумент по-прежнему clamp'ится к [0, MAX_DECIMALS=2].
     * Non-finite (NaN, ±Infinity) → "0".
     *
     * @param {*} value
     * @param {number} [decimals=2]
     * @param {{trimTrailingZeros?: boolean}} [options]
     */
    formatNumber(value, decimals = 2, options = {}) {
        const trimTrailingZeros = options.trimTrailingZeros !== false; // default true
        if (value === undefined || value === null || !Number.isFinite(Number(value))) {
            return trimTrailingZeros ? '0' : '0' + this.decimalSeparator + '0';
        }
        const cappedDecimals = clampDecimals(decimals);
        const num = parseFloat(value);
        const formatted = num.toFixed(cappedDecimals).replace('.', this.decimalSeparator);
        if (!trimTrailingZeros || cappedDecimals === 0) return formatted;
        return trimTrailingZerosFromFormatted(formatted, this.decimalSeparator);
    }

    /**
     * Строгий парсер числа из пользовательского input.
     *
     * v8.30.24: внешний аудит P2.3 — старый parseFloat принимал мусор
     * ('1abc' → 1, '1.2.3' → 1.2, '1 234,56' → 1). Теперь:
     *   1. trim whitespace по краям.
     *   2. strip thousands-separator (space или alt-separator при mixed).
     *   3. нормализация decimal-separator к '.'.
     *   4. **whole-string match** регекса `^-?\d+(\.\d+)?$` — любой
     *      посторонний символ → 0 (не частичный parseFloat).
     *
     * Возвращает 0 для невалидного input — это контракт, на который
     * полагаются handle*Change методы в controller'ах.
     */
    parseNumber(str) {
        if (str === null || str === undefined) return 0;
        let normalized = String(str).trim();
        if (!normalized) return 0;

        // Strip space (thousands separator из Excel paste).
        normalized = normalized.replace(/\s/g, '');

        const hasDot = normalized.includes('.');
        const hasComma = normalized.includes(',');

        if (hasDot && hasComma) {
            // Mixed: alt-separator (тот, что НЕ настроен как decimal) — thousands.
            const altSeparator = this.decimalSeparator === ',' ? '.' : ',';
            normalized = normalized.split(altSeparator).join('');
            // После strip остаётся только configured separator → к точке.
            normalized = normalized.replace(',', '.');
        } else if (hasComma) {
            // Только запятая → decimal (даже если configured separator = '.').
            // Сохраняет user-friendly cross-separator input.
            normalized = normalized.replace(',', '.');
        }
        // Только точка или нет разделителя — leave as is.

        // Strict whole-string match. Любой посторонний символ или несколько
        // точек → невалидно → 0 (контракт для controller'ов).
        if (!/^-?\d+(\.\d+)?$/.test(normalized)) return 0;

        const num = parseFloat(normalized);
        return Number.isFinite(num) ? num : 0;
    }

    parseInteger(str) {
        if (str === undefined || str === null) return 0;
        const normalized = String(str).trim();
        if (!normalized) return 0;
        if (!/^-?\d+$/.test(normalized)) return 0;
        const num = Number(normalized);
        return Number.isFinite(num) && Number.isInteger(num) ? num : 0;
    }

    /**
     * Округляет до N знаков после запятой.
     * v8.30.22: decimals clamp'ится к [0, MAX_DECIMALS=2]; non-finite → 0.
     */
    roundToDecimals(value, decimals = 1) {
        if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
        const cappedDecimals = clampDecimals(decimals);
        const factor = 10 ** cappedDecimals;
        return Math.round(value * factor) / factor;
    }

    /**
     * Live-input handler: убирает запрещённые символы, принимает `.` и `,`,
     * ограничивает дробную часть MAX_DECIMALS знаками и возвращает значение с
     * настроенным UI-разделителем.
     *
     * v8.30.22: добавлен truncate дробной части.
     * v8.30.23: locale-aware — если ОБА `.` И `,`, alt-separator стрипается
     *           как thousands.
     */
    handleInput(element) {
        if (!element) return;
        let value = element.value;
        value = value.replace(/[^\d.,]/g, '');

        const hasDot = value.includes('.');
        const hasComma = value.includes(',');
        if (hasDot && hasComma) {
            const altSeparator = this.decimalSeparator === ',' ? '.' : ',';
            value = value.split(altSeparator).join('');
        }

        value = value.replace(/,/g, '.');
        const parts = value.split('.');
        if (parts.length > 2) {
            value = parts[0] + '.' + parts.slice(1).join('');
        }
        const dotIdx = value.indexOf('.');
        if (dotIdx !== -1) {
            const intPart = value.slice(0, dotIdx);
            const fracPart = value.slice(dotIdx + 1);
            if (fracPart.length > MAX_DECIMALS) {
                value = intPart + '.' + fracPart.slice(0, MAX_DECIMALS);
            }
        }
        element.value = value.replace('.', this.decimalSeparator);
    }

    formatInputOnBlur(element) {
        if (!element) return;
        const parsed = this.parseNumber(element.value);
        element.value = this.formatNumber(parsed);
    }

    /**
     * Подключает live-cap + blur-format к decimal input element одной
     * строкой. v8.30.24: внешний аудит P1.1 — handleInput жил в коде, но
     * не вызывался ни в одном production code-path. Этот helper делает
     * подключение явным и обязательным.
     *
     * Использование (в controller'ах):
     *   nfs.wireDecimalInput(document.getElementById('cfgAvailCoef'));
     *   nfs.wireDecimalInput(document.querySelector('[data-role="uiux"] input'));
     *
     * Архитектурный invariant: для каждого decimal input в HTML должен
     * существовать вызов `wireDecimalInput` или эквивалент в init-методе
     * controller'а. См. tests/unit/architecture/decimal-input-wired.test.js.
     */
    wireDecimalInput(element) {
        if (!element || typeof element.addEventListener !== 'function') return;
        element.addEventListener('input', (e) => this.handleInput(e.target));
        element.addEventListener('blur', (e) => this.formatInputOnBlur(e.target));
    }
}
