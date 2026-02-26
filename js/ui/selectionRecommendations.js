// js/ui/selectionRecommendations.js
// Rendering functions for the optimization recommendations modal.

import { getSeverityClass, getSeverityHint, ALGORITHM_NAMES } from './selectionReport.js';
import { ALGORITHM_KEYS } from '../domain/selection/config.js';
import { getOptimizationRecommendations } from '../domain/selection/index.js';
import { messageService } from '../services/message.js';
import { showModal, hideModal } from './modalManager.js';

/**
 * Builds the HTML for a single recommendation card.
 * @param {Object} rec
 * @returns {string}
 */
function buildRecCardHtml(rec, extraStyle = '') {
    const severityClass = getSeverityClass(rec.severity);
    const severityHint = getSeverityHint(rec.severity);
    return `
        <div class="rec-card"${extraStyle ? ` style="${extraStyle}"` : ''}>
            <div class="rec-card-header">
                <span class="rec-card-title">${rec.message}</span>
                <span class="rec-card-severity ${severityClass}" title="${severityHint}">${rec.severity}</span>
            </div>
            ${rec.suggestion ? `<div class="rec-card-suggestion">💡 ${rec.suggestion}</div>` : ''}
        </div>
    `;
}

/**
 * Builds the recommendations HTML from multi-selection results.
 * @param {Object} multiSelectionResults - { results, comparison }
 * @param {Object} capacityByRole
 * @param {string[]} [algorithms]
 * @returns {string}
 */
export function buildRecommendationsHtml(multiSelectionResults, capacityByRole, algorithms = ALGORITHM_KEYS) {
    const allGeneral = [];
    const specific = Object.fromEntries(algorithms.map(a => [a, []]));

    algorithms.forEach(algo => {
        const res = multiSelectionResults.results[algo];
        if (!res || res.error) return;
        const recs = getOptimizationRecommendations(res, capacityByRole) || [];
        recs.forEach(rec => {
            if (rec.type && rec.type.startsWith('team-')) {
                if (!allGeneral.some(g => g.message === rec.message)) {
                    allGeneral.push(rec);
                }
            } else {
                specific[algo].push(rec);
            }
        });
    });

    const hasAny = allGeneral.length > 0 || algorithms.some(a => specific[a].length > 0);
    if (!hasAny) {
        return '<div style="text-align:center; padding:20px; color:var(--text-muted);">Нет рекомендаций.</div>';
    }

    let html = '<div class="recommendations-container">';

    if (allGeneral.length > 0) {
        html += `
            <div class="general-recommendations" style="margin-bottom: 24px; width: 100%;">
                <div class="rec-section-title" style="margin-bottom: 12px;">📌 Общие рекомендации</div>
                <div class="rec-cards" style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
        `;
        allGeneral.forEach(rec => {
            html += buildRecCardHtml(rec, 'width: 100%;');
        });
        html += `</div></div>`;
    }

    html += `<div class="algorithms-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">`;

    algorithms.forEach(algo => {
        const algoName = ALGORITHM_NAMES[algo] || algo;
        const items = specific[algo] || [];

        html += `<div class="algorithm-column">`;
        html += `<div class="rec-section-title" style="margin-bottom: 12px; text-align: center;">🔍 ${algoName}</div>`;

        if (items.length === 0) {
            html += `<div class="rec-card" style="text-align: center; color: var(--text-muted);">Нет рекомендаций</div>`;
        } else {
            html += `<div class="rec-cards" style="display: flex; flex-direction: column; gap: 12px;">`;
            items.forEach(rec => { html += buildRecCardHtml(rec); });
            html += `</div>`;
        }
        html += `</div>`;
    });

    html += `</div></div>`;
    return html;
}

/**
 * Fallback text-only recommendations message (when modal is unavailable).
 * @param {Object} multiSelectionResults
 * @param {Object} capacityByRole
 * @param {string[]} [algorithms]
 */
export function showRecommendationsFallback(multiSelectionResults, capacityByRole, algorithms = ALGORITHM_KEYS) {
    const allGeneral = [];
    const specific = Object.fromEntries(algorithms.map(a => [a, []]));

    algorithms.forEach(algo => {
        const res = multiSelectionResults.results[algo];
        if (!res || res.error) return;
        const recs = getOptimizationRecommendations(res, capacityByRole) || [];
        recs.forEach(rec => {
            if (rec.type && rec.type.startsWith('team-')) {
                if (!allGeneral.some(g => g.message === rec.message)) allGeneral.push(rec);
            } else {
                specific[algo].push(rec);
            }
        });
    });

    let message = '';
    if (allGeneral.length > 0) {
        message += '📋 Общее:\n\n';
        allGeneral.forEach(rec => {
            message += `  • ${rec.message}\n`;
            if (rec.suggestion) message += `    Совет: ${rec.suggestion}\n`;
            message += '\n';
        });
    }
    algorithms.forEach(algo => {
        const items = specific[algo];
        if (items.length > 0) {
            const algoName = ALGORITHM_NAMES[algo] || algo;
            message += `🔍 ${algoName}\n\n`;
            items.forEach(rec => {
                message += `  • ${rec.message}\n`;
                if (rec.suggestion) message += `    Совет: ${rec.suggestion}\n`;
                message += '\n';
            });
        }
    });
    if (!message.trim()) message = 'Рекомендаций нет.';
    messageService.showMessage(message);
}

/**
 * Renders recommendations into the `#recommendationsModal` and shows it.
 * Falls back to a text message if the modal is unavailable.
 *
 * @param {Object} multiSelectionResults
 * @param {Object} capacityByRole
 * @param {string[]} [algorithms]
 */
export function renderRecommendations(multiSelectionResults, capacityByRole, algorithms = ALGORITHM_KEYS) {
    const modal = document.getElementById('recommendationsModal');
    const content = document.getElementById('recommendationsContent');

    if (modal && content) {
        content.innerHTML = buildRecommendationsHtml(multiSelectionResults, capacityByRole, algorithms);
        showModal(modal);

        const closeModal = () => hideModal(modal);
        document.getElementById('closeRecommendationsModalBtn')?.addEventListener('click', closeModal, { once: true });
        document.getElementById('closeRecommendationsBtn')?.addEventListener('click', closeModal, { once: true });
    } else {
        showRecommendationsFallback(multiSelectionResults, capacityByRole, algorithms);
    }
}
