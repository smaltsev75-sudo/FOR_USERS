// js/ui/matrix.js
import { escapeHtml } from '../utils/escapeHtml.js';
import { calculateAvailability } from '../domain/role.js';

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
    stats.forEach(s => { typeTotals.bug += s.bug; typeTotals.tech += s.tech; typeTotals.us += s.us; });

    const rows = stats.map(s => `
        <tr>
            <td>${escapeHtml(s.name)}</td>
            <td class="number-display">${nfs.formatNumber(s.bug)}</td>
            <td class="number-display">${nfs.formatNumber(s.tech)}</td>
            <td class="number-display">${nfs.formatNumber(s.us)}</td>
        </tr>
    `).join('');
    matrixBody.innerHTML = rows;

    const bugPercent = totalAvailable > 0 ? (typeTotals.bug / totalAvailable * 100) : 0;
    const techPercent = totalAvailable > 0 ? (typeTotals.tech / totalAvailable * 100) : 0;
    const usPercent = totalAvailable > 0 ? (typeTotals.us / totalAvailable * 100) : 0;

    matrixFooter.innerHTML = `
        <tr class="total-row">
            <td>ИТОГО</td>
            <td class="number-display"><div class="total-row-values">${nfs.formatNumber(typeTotals.bug)}</div><div class="percentage-cell total-row-percent">${nfs.formatNumber(bugPercent)}%</div></td>
            <td class="number-display"><div class="total-row-values">${nfs.formatNumber(typeTotals.tech)}</div><div class="percentage-cell total-row-percent">${nfs.formatNumber(techPercent)}%</div></td>
            <td class="number-display"><div class="total-row-values">${nfs.formatNumber(typeTotals.us)}</div><div class="percentage-cell total-row-percent">${nfs.formatNumber(usPercent)}%</div></td>
        </tr>
    `;
}