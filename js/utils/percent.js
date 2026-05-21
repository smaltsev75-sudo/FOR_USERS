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

export function distributeRoundedPercentages(totals, decimals = 0) {
    const values = totals.map(total => clampNonNegativeNumber(total));
    const totalWork = values.reduce((sum, value) => sum + value, 0);
    if (totalWork <= 0) return values.map(() => 0);

    const scale = 10 ** decimals;
    const targetUnits = 100 * scale;
    const parts = values.map((value, index) => {
        const exactUnits = (value / totalWork) * targetUnits;
        const baseUnits = Math.floor(exactUnits);
        return {
            index,
            value,
            units: baseUnits,
            remainder: exactUnits - baseUnits
        };
    });

    const remainingUnits = targetUnits - parts.reduce((sum, part) => sum + part.units, 0);
    const byRemainder = [...parts].sort((a, b) => (
        b.remainder - a.remainder
        || b.value - a.value
        || a.index - b.index
    ));

    for (let i = 0; i < remainingUnits; i++) {
        byRemainder[i % byRemainder.length].units += 1;
    }

    return parts.map(part => part.units / scale);
}
