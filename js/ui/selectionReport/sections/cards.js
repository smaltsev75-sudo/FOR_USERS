import { areNearlyEqual } from '../../../domain/selection/comparisonDisplay.js';
import { clampPercentWidth, formatUiPercent } from '../../../utils/percent.js';
import { escapeHtml } from '../../../utils/escapeHtml.js';
import { icon } from '../../../utils/icons.js';
import {
    ALGORITHM_ICON,
    APPLY_BUTTON_IDS,
    METRIC_HINTS
} from '../constants.js';
import { fmt1, fmt2, loadBarFillClass, ratioPct } from '../format.js';

function buildApplyButtonHtml(item) {
    const id = APPLY_BUTTON_IDS[item.algo];
    if (!id) return '';
    const shortName = item.algo === 'value-density' ? 'Value Density'
        : item.algo === 'hybrid' ? 'Hybrid'
            : 'Matrix';
    return `
    <div class="algo-card-actions">
        <button id="${id}" type="button" class="export-btn export-btn--select-algorithm" data-algorithm="${escapeHtml(item.algo)}" aria-label="Применить алгоритм ${escapeHtml(item.name)}">
            ${icon('check')}
            <span>Применить ${escapeHtml(shortName)}</span>
        </button>
    </div>`;
}

/**
 * Одна карточка алгоритма с метриками.
 * @param {Object} item       - элемент comparableData
 * @param {Object} bestValues - результат computeComparisonBestValues
 * @param {string} recommendedKey
 * @returns {string}
 */
export function buildAlgorithmCardHtml(item, bestValues, recommendedKey) {
    const { bestTasks, bestLoadDiff, bestEffort, bestPriority, bestDensity } = bestValues;

    const isBestTasks   = item.tasksCount === bestTasks;
    const isBestLoad    = areNearlyEqual(Math.abs(item.displayLoad - 100), bestLoadDiff);
    const isBestEffort  = areNearlyEqual(item.displayEffort, bestEffort);
    const isBestPriority = areNearlyEqual(item.displayPriority, bestPriority);
    const isBestDensity = areNearlyEqual(item.displayDensity, bestDensity);

    const isRecommended = item.algo === recommendedKey;

    const tasksPct    = ratioPct(item.tasksCount, bestTasks);
    const loadPct     = clampPercentWidth(item.displayLoad);
    const effortPct   = ratioPct(item.displayEffort, bestEffort);
    const priorityPct = ratioPct(item.displayPriority, bestPriority);
    const densityPct  = ratioPct(item.displayDensity, bestDensity);

    const algoIcon = icon(ALGORITHM_ICON[item.algo] || 'barChart');
    const cardClasses = ['rec-card', 'rec-card--algo'];
    if (isRecommended) cardClasses.push('rec-card--recommended');

    const wrap = (raw, isBest) => isBest
        ? `<span class="best-value">${raw}</span>`
        : raw;

    return `
<div class="${cardClasses.join(' ')}" data-algorithm="${escapeHtml(item.algo)}">
    <div class="rec-card-header">
        <span class="rec-card-title">${algoIcon}<span>${escapeHtml(item.name)}</span></span>
        ${isRecommended ? '<span class="algo-card-marker">Рекомендовано</span>' : ''}
    </div>
    <div class="algo-card-metrics">
        <div class="algo-card-metric" title="${escapeHtml(METRIC_HINTS.tasks)}">
            <span class="algo-card-metric-label">Выбрано задач</span>
            <span class="algo-card-metric-value">${wrap(String(item.tasksCount), isBestTasks)}</span>
            <span class="metric-bar"><span class="metric-bar__fill" style="width:${tasksPct}%"></span></span>
        </div>
        <div class="algo-card-metric" title="${escapeHtml(METRIC_HINTS.load)}">
            <span class="algo-card-metric-label">Загрузка</span>
            <span class="algo-card-metric-value">${wrap(`${formatUiPercent(item.displayLoad)}%`, isBestLoad)}</span>
            <span class="metric-bar"><span class="metric-bar__fill ${loadBarFillClass(item.displayLoad)}" style="width:${loadPct}%"></span></span>
        </div>
        <div class="algo-card-metric" title="${escapeHtml(METRIC_HINTS.effort)}">
            <span class="algo-card-metric-label">Сумм. Effort, ч</span>
            <span class="algo-card-metric-value">${wrap(fmt1(item.displayEffort), isBestEffort)}</span>
            <span class="metric-bar"><span class="metric-bar__fill" style="width:${effortPct}%"></span></span>
        </div>
        <div class="algo-card-metric" title="${escapeHtml(METRIC_HINTS.priority)}">
            <span class="algo-card-metric-label">Сумм. Priority Score</span>
            <span class="algo-card-metric-value">${wrap(fmt1(item.displayPriority), isBestPriority)}</span>
            <span class="metric-bar"><span class="metric-bar__fill" style="width:${priorityPct}%"></span></span>
        </div>
        <div class="algo-card-metric" title="${escapeHtml(METRIC_HINTS.density)}">
            <span class="algo-card-metric-label">Ср. плотность</span>
            <span class="algo-card-metric-value">${wrap(fmt2(item.displayDensity), isBestDensity)}</span>
            <span class="metric-bar"><span class="metric-bar__fill" style="width:${densityPct}%"></span></span>
        </div>
    </div>
    ${buildApplyButtonHtml(item)}
</div>`;
}

/**
 * Сетка карточек для всех алгоритмов.
 * @param {Array} comparableData
 * @param {Object} bestValues
 * @param {string|null} recommendedKey
 * @returns {string}
 */
export function buildAlgorithmCardsHtml(comparableData, bestValues, recommendedKey) {
    const cards = comparableData
        .map(item => buildAlgorithmCardHtml(item, bestValues, recommendedKey))
        .join('');
    return `
<h2 class="report-section-title">Сравнение алгоритмов</h2>
<div class="algo-cards-grid">
${cards}
</div>`;
}
