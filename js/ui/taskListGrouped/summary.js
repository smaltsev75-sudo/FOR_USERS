// js/ui/taskListGrouped/summary.js
// Escaped inline summary for quadrant group headers.

import { escapeHtml } from '../../utils/escapeHtml.js';
import { formatUiPercent } from '../../utils/percent.js';

export function formatGroupSummary(count, effort, capacityPct, nfs) {
    const safeNfs = nfs && typeof nfs.formatNumber === 'function'
        ? nfs
        : { formatNumber: (n, d = 0) => Number(n).toFixed(d) };

    const tasksText = formatTaskCount(count);
    const effortText = `${safeNfs.formatNumber(effort)}ч`;
    const pctText = `${formatUiPercent(capacityPct)}%`;

    return `
        <span class="quadrant-summary-tasks">${escapeHtml(String(count))} ${escapeHtml(tasksText)}</span>
        <span class="quadrant-summary-sep" aria-hidden="true">·</span>
        <span class="quadrant-summary-effort">${escapeHtml(effortText)}</span>
        <span class="quadrant-summary-sep" aria-hidden="true">·</span>
        <span class="quadrant-summary-capacity" title="Доля от общей ёмкости команды">${escapeHtml(pctText)}</span>
    `.trim();
}

function formatTaskCount(n) {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return 'задач';
    if (last === 1) return 'задача';
    if (last >= 2 && last <= 4) return 'задачи';
    return 'задач';
}
