// js/ui/selectionRecommendations.js
// Rendering functions for the optimization recommendations modal.
//
// v8.30.0: эмодзи (📌 💡 🔍) заменены inline-SVG, все inline `style="..."`
// перенесены в `css/recommendations.css` (см. проектное правило «UI redesign:
// сначала аудит существующей дизайн-системы»). User-input message/suggestion
// эскейпятся через escapeHtml — раньше уязвимость XSS при подмене rec-данных.

import { getSeverityClass, getSeverityHint, ALGORITHM_NAMES } from './selectionReport.js';
import { ALGORITHM_KEYS } from '../domain/selection/config.js';
import { getOptimizationRecommendations } from '../domain/selection/index.js';
import { messageService } from '../services/message.js';
import { showModal, hideModal } from './modalManager.js';
import { icon } from '../utils/icons.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import { formatUiPercent } from '../utils/percent.js';

/**
 * Builds the HTML for a single recommendation card.
 * @param {Object} rec
 * @param {string} [modifier] - дополнительный модификатор класса (например, 'rec-card--featured')
 * @returns {string}
 */
function buildRecCardHtml(rec, modifier = '') {
    const severityClass = getSeverityClass(rec.severity);
    const severityHint = getSeverityHint(rec.severity);
    const cardClass = `rec-card${modifier ? ' ' + modifier : ''}`;
    return `
        <div class="${cardClass}">
            <div class="rec-card-header">
                <span class="rec-card-title">${escapeHtml(rec.message)}</span>
                <span class="rec-card-severity ${severityClass}" title="${escapeHtml(severityHint)}">${escapeHtml(rec.severity)}</span>
            </div>
            ${rec.suggestion ? `<div class="rec-card-suggestion">${icon('lightbulb')}<span>${escapeHtml(rec.suggestion)}</span></div>` : ''}
        </div>
    `;
}

/**
 * Группирует «общие» (team-*) рекомендации по `type`, склеивая проценты
 * от разных алгоритмов в диапазон. До v8.29.2 dedup шёл по `message`, но
 * процент в строке («61%», «66%», «66%») делал каждое сообщение
 * формально уникальным — пользователь видел 3 одинаковые карточки подряд.
 *
 * @param {Array<{type:string, message:string, percentage?:number, severity:string, suggestion?:string}>} recs
 * @returns {Array} dedup'd рекомендации с диапазоном % в message
 */
export function aggregateGeneralRecommendations(recs) {
    const byType = new Map(); // type → { rec, percentages: number[] }
    recs.forEach(rec => {
        if (!byType.has(rec.type)) {
            byType.set(rec.type, { rec, percentages: [] });
        }
        if (typeof rec.percentage === 'number') {
            byType.get(rec.type).percentages.push(rec.percentage);
        }
    });

    return Array.from(byType.values()).map(({ rec, percentages }) => {
        if (percentages.length <= 1) {
            const pct = percentages[0];
            if (typeof pct !== 'number') return rec; // ничего склеивать
            return { ...rec, message: replaceMessagePercentage(rec.message, `${formatUiPercent(pct)}%`) };
        }
        const min = Math.min(...percentages);
        const max = Math.max(...percentages);
        const minStr = formatUiPercent(min);
        const maxStr = formatUiPercent(max);
        const rangeText = minStr === maxStr ? `${minStr}%` : `${minStr}%–${maxStr}%`;
        const msgWithRange = replaceMessagePercentage(rec.message, rangeText);
        return { ...rec, message: msgWithRange };
    });
}

function replaceMessagePercentage(message, replacement) {
    return String(message).replace(/\(\d+(?:[.,]\d+)?%\)/, `(${replacement})`);
}

/**
 * Builds the recommendations HTML from multi-selection results.
 * @param {Object} multiSelectionResults - { results, comparison }
 * @param {Object} capacityByRole
 * @param {string[]} [algorithms]
 * @returns {string}
 */
export function buildRecommendationsHtml(multiSelectionResults, capacityByRole, algorithms = ALGORITHM_KEYS) {
    const generalRaw = [];
    const specific = Object.fromEntries(algorithms.map(a => [a, []]));

    algorithms.forEach(algo => {
        const res = multiSelectionResults.results[algo];
        if (!res || res.error) return;
        const recs = getOptimizationRecommendations(res, capacityByRole) || [];
        recs.forEach(rec => {
            if (rec.type && rec.type.startsWith('team-')) {
                generalRaw.push(rec);
            } else {
                specific[algo].push(rec);
            }
        });
    });

    const allGeneral = aggregateGeneralRecommendations(generalRaw);

    const hasAny = allGeneral.length > 0 || algorithms.some(a => specific[a].length > 0);
    if (!hasAny) {
        return '<div class="rec-empty">Нет рекомендаций.</div>';
    }

    let html = '<div class="recommendations-container">';

    if (allGeneral.length > 0) {
        html += `
            <div class="general-recommendations">
                <div class="rec-section-title">${icon('pin')}<span>Общие рекомендации</span></div>
                <div class="rec-cards rec-cards--general">
        `;
        allGeneral.forEach(rec => {
            html += buildRecCardHtml(rec, 'rec-card--full');
        });
        html += `</div></div>`;
    }

    html += `<div class="algorithms-grid">`;

    algorithms.forEach(algo => {
        const algoName = ALGORITHM_NAMES[algo] || algo;
        const items = specific[algo] || [];

        html += `<div class="algorithm-column">`;
        html += `<div class="rec-section-title rec-section-title--center">${icon('search')}<span>${escapeHtml(algoName)}</span></div>`;

        if (items.length === 0) {
            html += `<div class="rec-card rec-card--empty">Нет рекомендаций</div>`;
        } else {
            html += `<div class="rec-cards">`;
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

    // v8.30.0: эмодзи (📋 🔍) убраны из text-fallback тоже — он выводится через
    // messageService.showMessage в модальное окно (т.е. в UI), а правило
    // проекта запрещает эмодзи в UI. Используем простые маркеры-заголовки.
    let message = '';
    if (allGeneral.length > 0) {
        message += 'Общие рекомендации:\n\n';
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
            message += `Алгоритм «${algoName}»:\n\n`;
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
