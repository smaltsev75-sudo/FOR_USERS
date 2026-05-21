// js/ui/matrix.js
import { escapeHtml } from '../utils/escapeHtml.js';
import { formatUiPercent } from '../utils/percent.js';

const TYPE_KEYS = ['bug', 'tech', 'us'];
const TYPE_LABELS = { bug: 'Bug', tech: 'Tech', us: 'US' };
const TOTAL_PERCENT_DECIMALS = 0;

function distributeRoundedPercentages(totals, decimals = TOTAL_PERCENT_DECIMALS) {
    const values = totals.map(total => Math.max(0, Number(total) || 0));
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

export function renderMatrix(state, nfs) {
    const matrixBody = document.getElementById('matrixBody');
    const matrixFooter = document.getElementById('matrixFooter');
    if (!matrixBody || !matrixFooter) return;

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
                ? `${TYPE_LABELS[t]}: ${nfs.formatNumber(v)} ч · ${formatUiPercent(pctOfRole)}% от часов роли ${s.name}`
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

    // v8.30.37 (user audit): семантика «Распределение работ по типам задач» —
    // ДОЛЯ работы по типу от ОБЩЕЙ работы (сумма по строке ИТОГО = 100%).
    // Раньше: pct = type_hours / team_capacity → сумма ≠ 100% (бывает <100% при
    // недозагрузке, >100% при перегрузке). Это была другая метрика («% capacity
    // использовано данным типом»), но название блока и пользовательское ожидание
    // — именно distribution. Capacity-сравнение остаётся в Team Capacity Dashboard.
    const totalWork = typeTotals.bug + typeTotals.tech + typeTotals.us;
    // v8.30.39: распределяем уже округлённые целые по largest remainder, чтобы
    // видимая строка ИТОГО тоже давала ровно 100% (1/3 + 1/3 + 1/3 → 34/33/33).
    const [bugPercent, techPercent, usPercent] = distributeRoundedPercentages([
        typeTotals.bug,
        typeTotals.tech,
        typeTotals.us
    ]);

    const totalCells = [
        { type: 'bug', total: typeTotals.bug, pct: bugPercent },
        { type: 'tech', total: typeTotals.tech, pct: techPercent },
        { type: 'us', total: typeTotals.us, pct: usPercent }
    ].map(({ type, total, pct }) => {
        const tip = totalWork > 0
            ? `${TYPE_LABELS[type]}: ${nfs.formatNumber(total)} ч (${formatUiPercent(pct)}% от общего объёма работ)`
            : `${TYPE_LABELS[type]}: ${nfs.formatNumber(total)} ч (задач нет)`;
        return `<td class="matrix-total number-display" data-type="${type}" title="${escapeHtml(tip)}">
            <div class="matrix-total__percent percentage-cell">${formatUiPercent(pct)}%</div>
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
