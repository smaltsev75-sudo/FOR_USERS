import { ALGORITHM_KEYS } from '../../domain/selection/config.js';
import { getOptimizationRecommendations } from '../../domain/selection/index.js';
import { icon } from '../../utils/icons.js';
import { escapeHtml } from '../../utils/escapeHtml.js';
import { formatUiPercent } from '../../utils/percent.js';
import { ALGORITHM_NAMES } from '../selectionReport/constants.js';
import { getSeverityClass, getSeverityHint } from '../selectionReport/format.js';
import {
    EMPTY_RECOMMENDATIONS_HTML,
    PERCENT_IN_MESSAGE_RE,
    TEAM_RECOMMENDATION_PREFIX
} from './constants.js';

/**
 * Builds the HTML for a single recommendation card.
 * @param {Object} rec
 * @param {string} [modifier] - дополнительный модификатор класса (например, 'rec-card--full')
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
 * от разных алгоритмов в диапазон.
 *
 * @param {Array<{type:string, message:string, percentage?:number, severity:string, suggestion?:string}>} recs
 * @returns {Array} dedup'd рекомендации с диапазоном % в message
 */
export function aggregateGeneralRecommendations(recs) {
    const byType = new Map(); // type -> { rec, percentages: number[] }
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
            if (typeof pct !== 'number') return rec;
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
    return String(message).replace(PERCENT_IN_MESSAGE_RE, `(${replacement})`);
}

export function collectRecommendationSections(multiSelectionResults, capacityByRole, algorithms = ALGORITHM_KEYS) {
    const generalRaw = [];
    const specific = Object.fromEntries(algorithms.map(a => [a, []]));

    algorithms.forEach(algo => {
        const res = multiSelectionResults.results[algo];
        if (!res || res.error) return;
        const recs = getOptimizationRecommendations(res, capacityByRole) || [];
        recs.forEach(rec => {
            if (rec.type && rec.type.startsWith(TEAM_RECOMMENDATION_PREFIX)) {
                generalRaw.push(rec);
            } else {
                specific[algo].push(rec);
            }
        });
    });

    return {
        general: aggregateGeneralRecommendations(generalRaw),
        specific
    };
}

/**
 * Builds the recommendations HTML from multi-selection results.
 * @param {Object} multiSelectionResults - { results, comparison }
 * @param {Object} capacityByRole
 * @param {string[]} [algorithms]
 * @returns {string}
 */
export function buildRecommendationsHtml(multiSelectionResults, capacityByRole, algorithms = ALGORITHM_KEYS) {
    const { general, specific } = collectRecommendationSections(multiSelectionResults, capacityByRole, algorithms);

    const hasAny = general.length > 0 || algorithms.some(a => specific[a].length > 0);
    if (!hasAny) {
        return EMPTY_RECOMMENDATIONS_HTML;
    }

    let html = '<div class="recommendations-container">';

    if (general.length > 0) {
        html += `
            <div class="general-recommendations">
                <div class="rec-section-title">${icon('pin')}<span>Общие рекомендации</span></div>
                <div class="rec-cards rec-cards--general">
        `;
        general.forEach(rec => {
            html += buildRecCardHtml(rec, 'rec-card--full');
        });
        html += '</div></div>';
    }

    html += '<div class="algorithms-grid">';

    algorithms.forEach(algo => {
        const algoName = ALGORITHM_NAMES[algo] || algo;
        const items = specific[algo] || [];

        html += '<div class="algorithm-column">';
        html += `<div class="rec-section-title rec-section-title--center">${icon('search')}<span>${escapeHtml(algoName)}</span></div>`;

        if (items.length === 0) {
            html += '<div class="rec-card rec-card--empty">Нет рекомендаций</div>';
        } else {
            html += '<div class="rec-cards">';
            items.forEach(rec => { html += buildRecCardHtml(rec); });
            html += '</div>';
        }
        html += '</div>';
    });

    html += '</div></div>';
    return html;
}
