// js/ui/header.js
import { getTaskStats } from '../domain/task.js';

const ICON_ALERT_TRIANGLE =
    '<svg class="toolbar-status__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
    '<line x1="12" y1="9" x2="12" y2="13"/>' +
    '<line x1="12" y1="17" x2="12.01" y2="17"/>' +
    '</svg>';

const ICON_CHECK_CIRCLE =
    '<svg class="toolbar-status__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>' +
    '<polyline points="22 4 12 14.01 9 11.01"/>' +
    '</svg>';

/**
 * Render a single status row: icon + label + (optional) per-type breakdown.
 * @param {HTMLElement} el
 * @param {string} iconHtml
 * @param {string} mainLabel — like "Исключено: 1" or "Задач в спринте: 99"
 * @param {{ us:number, bug:number, tech:number }} counts
 */
function renderRow(el, iconHtml, mainLabel, counts) {
    el.replaceChildren();

    const iconWrap = document.createElement('span');
    iconWrap.className = 'toolbar-status__icon-wrap';
    iconWrap.innerHTML = iconHtml;
    el.appendChild(iconWrap);

    const label = document.createElement('span');
    label.className = 'toolbar-status__label';
    label.textContent = mainLabel;
    el.appendChild(label);

    const total = counts.us + counts.bug + counts.tech;
    if (total > 0) {
        const breakdown = document.createElement('span');
        breakdown.className = 'toolbar-status__breakdown';

        const parts = [];
        if (counts.us > 0) parts.push(['us', `US:${counts.us}`]);
        if (counts.bug > 0) parts.push(['bug', `Bug:${counts.bug}`]);
        if (counts.tech > 0) parts.push(['tech', `Tech:${counts.tech}`]);

        parts.forEach(([type, text], idx) => {
            if (idx > 0) {
                breakdown.appendChild(document.createTextNode(' '));
            }
            const chip = document.createElement('span');
            chip.className = 'toolbar-status__chip';
            chip.dataset.type = type;
            chip.textContent = text;
            breakdown.appendChild(chip);
        });

        el.appendChild(breakdown);
    }
}

export function renderHeader(state) {
    const { included, excluded } = getTaskStats(state.tasks);

    const excludedEl = document.getElementById('excludedTasksHeader');
    if (excludedEl) {
        excludedEl.classList.add('toolbar-status', 'toolbar-status--muted');
        renderRow(
            excludedEl,
            ICON_ALERT_TRIANGLE,
            `Исключено из спринта: ${excluded.total}`,
            excluded
        );
    }

    const includedEl = document.getElementById('includedTasksHeader');
    if (includedEl) {
        includedEl.classList.add('toolbar-status', 'toolbar-status--main');
        renderRow(
            includedEl,
            ICON_CHECK_CIRCLE,
            `Задач в спринте: ${included.total}`,
            included
        );
    }
}
