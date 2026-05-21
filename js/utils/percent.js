// js/utils/percent.js

export function clampNonNegativeNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? Math.max(0, num) : 0;
}

export function clampPercentWidth(value) {
    return Math.min(100, clampNonNegativeNumber(value));
}

export function formatUiPercent(value) {
    return String(Math.round(clampNonNegativeNumber(value)));
}

export function formatSignedUiPercent(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num === 0) return '0%';
    const formatted = `${formatUiPercent(Math.abs(num))}%`;
    return num > 0 ? `+${formatted}` : `↓${formatted}`;
}
