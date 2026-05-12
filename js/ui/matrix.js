// js/ui/matrix.js
import { escapeHtml } from '../utils/escapeHtml.js';
import { calculateAvailability } from '../domain/role.js';

const TYPE_KEYS = ['bug', 'tech', 'us'];
const TYPE_LABELS = { bug: 'Bug', tech: 'Tech', us: 'US' };

export function renderMatrix(state, nfs) {
    const matrixBody = document.getElementById('matrixBody');
    const matrixFooter = document.getElementById('matrixFooter');
    if (!matrixBody || !matrixFooter) return;
    const config = state.config;

    let totalAvailable = 0;
    state.roles.forEach(role => {
        const avail = calculateAvailability(role, config);
        totalAvailable += avail.useful;
    });

    const stats = state.roles.map(r => ({ name: r.name, bug: 0, tech: 0, us: 0 }));
    state.tasks.forEach(t => {
        if (t.excluded) return;
        state.roles.forEach((r, i) => {
            const val = t.est[r.id] || 0;
            stats[i][t.type] += val;
        });
    });

    const typeTotals = { bug: 0, tech: 0, us: 0 };
    stats.forEach(s => {
        typeTotals.bug += s.bug;
        typeTotals.tech += s.tech;
        typeTotals.us += s.us;
    });

    // Data Bars: нормализация per-column — внутри каждой колонки самое
    // большое значение растягивает бар на всю ширину ячейки. Это даёт
    // мгновенное сравнение даже когда абсолютные числа в колонках сильно
    // разные (Bug ~ десятки, US ~ сотни).
    const colMax = { bug: 0, tech: 0, us: 0 };
    stats.forEach(s => TYPE_KEYS.forEach(t => {
        if (s[t] > colMax[t]) colMax[t] = s[t];
    }));

    const rows = stats.map((s, idx) => {
        const roleTotal = s.bug + s.tech + s.us;
        const cells = TYPE_KEYS.map(t => {
            const v = s[t];
            const barWidth = colMax[t] > 0 ? (v / colMax[t]) * 100 : 0;
            const pctOfRole = roleTotal > 0 ? (v / roleTotal) * 100 : 0;
            const tip = v > 0
                ? `${TYPE_LABELS[t]}: ${nfs.formatNumber(v)} ч · ${nfs.formatNumber(pctOfRole)}% от часов роли ${s.name}`
                : `${TYPE_LABELS[t]}: задач этого типа нет у роли ${s.name}`;
            const muted = v === 0 ? ' is-empty' : '';
            return `<td class="data-cell number-display${muted}" data-type="${t}" style="--bar-width:${barWidth.toFixed(1)}%" title="${escapeHtml(tip)}">
                <span class="data-cell__bar" aria-hidden="true"></span>
                <span class="data-cell__value">${nfs.formatNumber(v)}</span>
            </td>`;
        }).join('');
        const roleTip = `Всего по роли ${s.name}: ${nfs.formatNumber(roleTotal)} ч`;
        const stripe = idx % 2 === 0 ? '' : ' matrix-row--alt';
        return `<tr class="matrix-row${stripe}">
            <td class="matrix-role" title="${escapeHtml(roleTip)}">
                <span class="matrix-role__name">${escapeHtml(s.name)}</span>
            </td>
            ${cells}
        </tr>`;
    }).join('');
    matrixBody.innerHTML = rows;

    const bugPercent = totalAvailable > 0 ? (typeTotals.bug / totalAvailable) * 100 : 0;
    const techPercent = totalAvailable > 0 ? (typeTotals.tech / totalAvailable) * 100 : 0;
    const usPercent = totalAvailable > 0 ? (typeTotals.us / totalAvailable) * 100 : 0;

    const totalCells = [
        { type: 'bug', total: typeTotals.bug, pct: bugPercent },
        { type: 'tech', total: typeTotals.tech, pct: techPercent },
        { type: 'us', total: typeTotals.us, pct: usPercent }
    ].map(({ type, total, pct }) => {
        const tip = totalAvailable > 0
            ? `${TYPE_LABELS[type]}: ${nfs.formatNumber(total)} ч (${nfs.formatNumber(pct)}% от ёмкости команды)`
            : `${TYPE_LABELS[type]}: ${nfs.formatNumber(total)} ч (ёмкость команды не задана)`;
        return `<td class="matrix-total number-display" data-type="${type}" title="${escapeHtml(tip)}">
            <div class="matrix-total__percent percentage-cell">${nfs.formatNumber(pct)}%</div>
            <div class="matrix-total__value">${nfs.formatNumber(total)} ч</div>
        </td>`;
    }).join('');

    matrixFooter.innerHTML = `
        <tr class="total-row">
            <td class="matrix-total-label">
                <span class="matrix-total-label__main">ИТОГО</span>
            </td>
            ${totalCells}
        </tr>
    `;
}
