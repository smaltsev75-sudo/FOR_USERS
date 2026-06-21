// js/ui/selectionReport.js
// Facade for the multi-algorithm selection report modal.
//
// Архитектурные принципы:
//   - Только классы дизайн-системы. Inline style допускается только для
//     geometry-bar width в submodules.
//   - Иконки — inline-SVG из js/utils/icons.js, не эмодзи.
//   - Все user-input строки (task.title, task.reason) — через escapeHtml.

import {
    buildComparisonDisplayData,
    computeComparisonBestValues,
    pickRecommendedAlgorithm
} from '../domain/selection/comparisonDisplay.js';
import { ALGORITHM_KEYS } from '../domain/selection/config.js';
import { showModal } from './modalManager.js';
import {
    buildAlgorithmCardsHtml,
    buildAlgorithmDescriptionsHtml,
    buildAlgorithmDetailsHtml,
    buildAlgorithmSetInsightData,
    buildAlgorithmSetInsightHtml,
    buildRecommendationsButtonHtml
} from './selectionReport/sections.js';
import { bindAccordionHandlers, highlightRecommendedApplyButton } from './selectionReport/interactions.js';

export { ALGORITHM_NAMES, METRIC_HINTS } from './selectionReport/constants.js';
export { getSeverityClass, getSeverityHint } from './selectionReport/format.js';

/**
 * Renders the full selection report into the `#selectionReportContent` element
 * and shows the `#selectionReportModal`.
 *
 * @param {Object} multiSelectionResults - { results, comparison }
 * @param {string[]} [algorithms] - algorithm keys to display (defaults to ALGORITHM_KEYS)
 * @returns {boolean} true if rendered successfully
 */
export function renderSelectionReport(multiSelectionResults, algorithms = ALGORITHM_KEYS) {
    if (!multiSelectionResults) return false;

    const { results, comparison } = multiSelectionResults;
    const contentEl = document.getElementById('selectionReportContent');
    if (!contentEl) return false;

    const comparableData = buildComparisonDisplayData(results, comparison, algorithms);

    if (comparableData.length === 0) {
        contentEl.innerHTML = '<div class="report-empty-state">Нет данных для отображения</div>';
        highlightRecommendedApplyButton(null);
        const modal = document.getElementById('selectionReportModal');
        if (modal) showModal(modal);
        return true;
    }

    const bestValues = computeComparisonBestValues(comparableData);
    const recommended = pickRecommendedAlgorithm(comparableData);
    const recommendedKey = recommended ? recommended.algo : null;
    const setInsight = buildAlgorithmSetInsightData(results, algorithms);

    contentEl.innerHTML = [
        buildAlgorithmCardsHtml(comparableData, bestValues, recommendedKey),
        buildAlgorithmSetInsightHtml(setInsight),
        buildRecommendationsButtonHtml(),
        buildAlgorithmDescriptionsHtml(),
        buildAlgorithmDetailsHtml(results, comparison, algorithms)
    ].join('');

    highlightRecommendedApplyButton(recommendedKey);
    bindAccordionHandlers(contentEl);

    const modal = document.getElementById('selectionReportModal');
    if (modal) showModal(modal);

    return true;
}
