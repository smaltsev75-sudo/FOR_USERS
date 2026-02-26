// js/ui/header.js
import { getTaskStats } from '../domain/task.js';

/**
 * Renders a task counter element with optional per-type breakdown.
 * @param {HTMLElement} el - Target DOM element to render into.
 * @param {string} label - Main label text (e.g. "Задач в спринте: 3").
 * @param {string} colorVar - CSS variable for the main label color.
 * @param {{ us: number, bug: number, tech: number }} counts - Per-type counts.
 */
function renderCounterEl(el, label, colorVar, counts) {
    el.replaceChildren();
    const span = document.createElement('span');
    span.style.color = colorVar;
    span.textContent = label;
    el.appendChild(span);

    if (counts.us > 0 || counts.bug > 0 || counts.tech > 0) {
        const detailsSpan = document.createElement('span');
        detailsSpan.style.marginLeft = '4px';
        detailsSpan.textContent = '(';

        if (counts.us > 0) {
            const usSpan = document.createElement('span');
            usSpan.style.color = 'var(--us-color)';
            usSpan.textContent = `US:${counts.us}`;
            detailsSpan.appendChild(usSpan);
        }
        if (counts.bug > 0) {
            if (counts.us > 0) detailsSpan.appendChild(document.createTextNode(' '));
            const bugSpan = document.createElement('span');
            bugSpan.style.color = 'var(--bug-color)';
            bugSpan.textContent = `Bug:${counts.bug}`;
            detailsSpan.appendChild(bugSpan);
        }
        if (counts.tech > 0) {
            if (counts.us > 0 || counts.bug > 0) detailsSpan.appendChild(document.createTextNode(' '));
            const techSpan = document.createElement('span');
            techSpan.style.color = 'var(--tech-color)';
            techSpan.textContent = `Tech:${counts.tech}`;
            detailsSpan.appendChild(techSpan);
        }

        detailsSpan.appendChild(document.createTextNode(')'));
        el.appendChild(detailsSpan);
    }
}

export function renderHeader(state) {
    const { included, excluded } = getTaskStats(state.tasks);

    const excludedEl = document.getElementById('excludedTasksHeader');
    if (excludedEl) {
        renderCounterEl(
            excludedEl,
            `Исключено из спринта: ${excluded.total}`,
            'var(--excluded)',
            excluded
        );
    }

    const includedEl = document.getElementById('includedTasksHeader');
    if (includedEl) {
        renderCounterEl(
            includedEl,
            `Задач в спринте: ${included.total}`,
            'var(--accent)',
            included
        );
    }
}
