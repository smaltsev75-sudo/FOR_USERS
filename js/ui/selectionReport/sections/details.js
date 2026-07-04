import { escapeHtml } from '../../../utils/escapeHtml.js';
import { icon } from '../../../utils/icons.js';
import {
    ALGORITHM_ICON,
    ALGORITHM_NAMES,
    QUADRANT_DISPLAY,
    algoDetailHint
} from '../constants.js';
import { fmt1 } from '../format.js';

/**
 * Аккордеон детализации одного алгоритма.
 */
function buildSingleAlgorithmDetailHtml(algo, res, displayName) {
    let inner = '';

    if (res.quadrants) {
        QUADRANT_DISPLAY.forEach(q => {
            const tasks = res.quadrants[q.key] || [];
            if (tasks.length === 0) return;

            inner += `
            <div class="algo-detail-section">
                <div class="algo-detail-quadrant-title">${icon(q.icon)}${escapeHtml(q.label)}</div>
                <ul class="algo-detail-list">`;
            tasks.forEach(task => {
                const title = escapeHtml(task.title || 'Без названия');
                const priority = fmt1(task.priorityScore || 0);
                const effort = fmt1(task.effort || 0);
                inner += `<li>${title} <span class="algo-detail-meta">(Priority Score: ${priority} / Effort: ${effort} ч)</span></li>`;
            });
            inner += `</ul>
            </div>`;
        });
    }

    if (res.excludedTasks && res.excludedTasks.length > 0) {
        inner += `
            <div class="algo-detail-excluded-title">${icon('alertCircle')}Исключено (${res.excludedTasks.length})</div>
            <ul class="algo-detail-excluded-list">`;
        res.excludedTasks.forEach(task => {
            const title = escapeHtml(task.title || 'Без названия');
            const reason = escapeHtml(task.reason || 'Неизвестная причина');
            inner += `<li>${title} — <span class="algo-detail-reason">${reason}</span></li>`;
        });
        inner += '</ul>';
    }

    const panelId = `algoDetail_${algo}`;
    return `
<div class="accordion-item algorithm-detail" data-algorithm="${escapeHtml(algo)}">
    <button type="button" class="accordion-header" aria-expanded="false" aria-controls="${panelId}" title="${escapeHtml(algoDetailHint(displayName))}">
        <span class="accordion-icon">▶</span>
        ${icon(ALGORITHM_ICON[algo] || 'barChart')}
        <strong>${escapeHtml(displayName)}</strong>
    </button>
    <div id="${panelId}" class="accordion-content" hidden>${inner}</div>
</div>`;
}

/**
 * Аккордеоны по каждому алгоритму.
 */
export function buildAlgorithmDetailsHtml(results, comparison, algorithms) {
    const items = algorithms
        .map(algo => {
            const res = results[algo];
            if (!res || res.error) return '';
            const algoName = comparison[algo]?.algorithmName || ALGORITHM_NAMES[algo] || algo;
            return buildSingleAlgorithmDetailHtml(algo, res, algoName);
        })
        .filter(Boolean)
        .join('');

    return `
<h3 class="report-section-title report-section-title--sub">Детализация по алгоритмам</h3>
${items}`;
}
