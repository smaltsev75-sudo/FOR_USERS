
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
     * Сохраняет настройки в localStorage.
     * v8.30.2: возвращает status-объект `{ok, error}` (тот же контракт что в
     * storageService.save). Раньше localStorage.setItem мог throw'нуть
     * QuotaExceededError / SecurityError, и App.saveToLS прерывался на этой
     * строке — даже после fix v8.30.0 (там я починил storageService.save,
     * но забыл соседнюю persist-точку в numberFormat). Caller (App.saveToLS)
     * теперь видит result и при !ok показывает snackbar.
     * @returns {{ok: true} | {ok: false, error: string}}
     */
    saveSettings() {
        const settings = { decimalSeparator: this.decimalSeparator };
        try {
            localStorage.setItem('numberFormatSettings', JSON.stringify(settings));
            return { ok: true };
        } catch (err) {
            const name = (err && (err.name || err.message)) || 'StorageError';
            return { ok: false, error: String(name) };
        }
    }

    /**
     * Форматирует число с заданным числом знаков после запятой.
     * v8.30.22: decimals аргумент clamp'ится к [0, MAX_DECIMALS=2]. Любые
     * caller'ы, передающие 3+, получают 2. Также non-finite значения
     * (NaN, ±Infinity) возвращают "0<separator>0" — defense-at-display
     * против чисел, которые могли прорваться из арифметики.
     */
    formatNumber(value, decimals = 1) {
        if (value === undefined || value === null || !Number.isFinite(Number(value))) {
            return '0' + this.decimalSeparator + '0';
        }
        const cappedDecimals = clampDecimals(decimals);
        const num = parseFloat(value);
        const formatted = num.toFixed(cappedDecimals);
        return formatted.replace('.', this.decimalSeparator);
    }

    parseNumber(str) {
        if (!str || str.trim() === '') return 0;
        // Normalize: replace the configured decimal separator with '.',
        // then replace any remaining ',' with '.' (handles both separators).
        // Using replaceAll to handle multiple occurrences (e.g. group separators).
        let normalized = str;
        if (this.decimalSeparator !== '.') {
            // e.g. decimalSeparator = ',' → replace ',' with '.'
            normalized = normalized.replaceAll(this.decimalSeparator, '.');
        }
        // Remove any remaining commas (used as group separators or alternate decimal)
        normalized = normalized.replace(',', '.');
        const num = parseFloat(normalized);
        return isNaN(num) ? 0 : num;
    }

    parseInteger(str) {
        if (str === undefined || str === null) return 0;
        const normalized = String(str).trim();
        if (!normalized) return 0;
        const num = parseInt(normalized, 10);
        return isNaN(num) ? 0 : num;
    }

    /**
     * Округляет до N знаков после запятой.
     * v8.30.22: decimals аргумент clamp'ится к [0, MAX_DECIMALS=2]; non-finite
     * (NaN, ±Infinity) → 0 — иначе `Math.round(Infinity * 100) / 100` возвращает
     * Infinity и отравляет state.
     */
    roundToDecimals(value, decimals = 1) {
        if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
        const cappedDecimals = clampDecimals(decimals);
        const factor = 10 ** cappedDecimals;
        return Math.round(value * factor) / factor;
    }

    /**
     * Live-input handler: убирает запрещённые символы, нормализует разделитель
     * к точке и ограничивает дробную часть MAX_DECIMALS знаками.
     *
     * v8.30.22: добавлен truncate дробной части — пользователь физически не
     * может ввести 3+ знака. Trailing dot (`1.`) сохраняется как mid-typing.
     *
     * v8.30.23: locale-aware paste. Если в строке встретились ОБА `.` И `,`
     * (типичный paste из Excel — `1.234,56`), alt-separator (тот, что НЕ
     * настроен как decimal) считается thousands и стрипается. Иначе раньше
     * `1.234,56` (decimal=',') превращался в `1,23` — потеря 1233 единиц.
     * Если в строке только один тип разделителя — старая логика (он
     * считается decimal).
     */
    handleInput(element) {
        let value = element.value;
        value = value.replace(/[^\d.,]/g, '');

        // Locale-aware mixed-separator handling (v8.30.23).
        const hasDot = value.includes('.');
        const hasComma = value.includes(',');
        if (hasDot && hasComma) {
            const altSeparator = this.decimalSeparator === ',' ? '.' : ',';
            // Strip alt-separator (treated as thousands).
            value = value.split(altSeparator).join('');
        }

        // Normalize remaining commas to dot (universal internal form).
        value = value.replace(/,/g, '.');
        const parts = value.split('.');
        if (parts.length > 2) {
            value = parts[0] + '.' + parts.slice(1).join('');
        }
        // Truncate fractional part to MAX_DECIMALS (after merge of multiple dots).
        const dotIdx = value.indexOf('.');
        if (dotIdx !== -1) {
            const intPart = value.slice(0, dotIdx);
            const fracPart = value.slice(dotIdx + 1);
            if (fracPart.length > MAX_DECIMALS) {
                value = intPart + '.' + fracPart.slice(0, MAX_DECIMALS);
            }
        }
        element.value = value;
    }

    formatInputOnBlur(element) {
        const parsed = this.parseNumber(element.value);
        if (!isNaN(parsed)) {
            element.value = this.formatNumber(parsed);
        }
    }
}
