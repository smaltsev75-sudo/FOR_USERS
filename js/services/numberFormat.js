
// js/services/numberFormat.js

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

    saveSettings() {
        const settings = { decimalSeparator: this.decimalSeparator };
        localStorage.setItem('numberFormatSettings', JSON.stringify(settings));
    }

    formatNumber(value, decimals = 1) {
        if (value === undefined || value === null || isNaN(value)) {
            return '0' + this.decimalSeparator + '0';
        }
        const num = parseFloat(value);
        const formatted = num.toFixed(decimals);
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

    roundToDecimals(value, decimals = 1) {
        if (typeof value !== 'number' || isNaN(value)) return 0;
        const factor = 10 ** decimals;
        return Math.round(value * factor) / factor;
    }

    handleInput(element) {
        let value = element.value;
        value = value.replace(/[^\d.,]/g, '').replace(/,/g, '.');
        const parts = value.split('.');
        if (parts.length > 2) {
            value = parts[0] + '.' + parts.slice(1).join('');
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
