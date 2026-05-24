/**
 * Returns the CSS class for a recommendation severity level.
 * @param {string} severity
 * @returns {string}
 */
export function getSeverityClass(severity) {
    switch (severity) {
        case 'high': return 'severity-high';
        case 'medium': return 'severity-medium';
        case 'low': return 'severity-low';
        default: return 'severity-info';
    }
}

/**
 * Returns a human-readable hint for a severity level.
 * @param {string} severity
 * @returns {string}
 */
export function getSeverityHint(severity) {
    switch (severity) {
        case 'high': return 'Критическая перегрузка: превышение ёмкости > 100% + порог';
        case 'medium': return 'Существенное отклонение: недогрузка или значительный перегруз';
        case 'low': return 'Предупреждение: близко к перегрузке (95–100%)';
        case 'info': return 'Информационное сообщение';
        default: return '';
    }
}

export function fmt1(n) {
    return Number(n).toFixed(1).replace('.', ',');
}

export function fmt2(n) {
    return Number(n).toFixed(2).replace('.', ',');
}

/** Цветовой акцент полосы загрузки: близко к 100 — success, перегруз — danger. */
export function loadBarFillClass(loadPct) {
    if (loadPct > 100) return 'metric-bar__fill--danger';
    if (loadPct >= 90) return 'metric-bar__fill--success';
    if (loadPct < 60) return 'metric-bar__fill--warning';
    return '';
}

/** Нормирует значение к процентам ширины относительно best (0…100). */
export function ratioPct(value, best) {
    if (!best || best <= 0) return 0;
    const pct = Math.round((value / best) * 100);
    if (pct < 0) return 0;
    if (pct > 100) return 100;
    return pct;
}
