import { ALGORITHM_KEYS } from '../../domain/selection/config.js';
import { messageService } from '../../services/message.js';
import { hideModal, showModal } from '../modalManager.js';
import { ALGORITHM_NAMES } from '../selectionReport/constants.js';
import {
    CLOSE_RECOMMENDATIONS_BTN_ID,
    CLOSE_RECOMMENDATIONS_MODAL_BTN_ID,
    EMPTY_RECOMMENDATIONS_TEXT,
    RECOMMENDATIONS_CONTENT_ID,
    RECOMMENDATIONS_MODAL_ID
} from './constants.js';
import { buildRecommendationsHtml, collectRecommendationSections } from './sections.js';

/**
 * Fallback text-only recommendations message (when modal is unavailable).
 * @param {Object} multiSelectionResults
 * @param {Object} capacityByRole
 * @param {string[]} [algorithms]
 */
export function showRecommendationsFallback(multiSelectionResults, capacityByRole, algorithms = ALGORITHM_KEYS) {
    const { general, specific } = collectRecommendationSections(multiSelectionResults, capacityByRole, algorithms);

    // v8.30.0: эмодзи (📋 🔍) убраны из text-fallback тоже — он выводится через
    // messageService.showMessage в модальное окно (т.е. в UI), а правило
    // проекта запрещает эмодзи в UI. Используем простые маркеры-заголовки.
    let message = '';
    if (general.length > 0) {
        message += 'Общие рекомендации:\n\n';
        general.forEach(rec => {
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
    if (!message.trim()) message = EMPTY_RECOMMENDATIONS_TEXT;
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
    const modal = document.getElementById(RECOMMENDATIONS_MODAL_ID);
    const content = document.getElementById(RECOMMENDATIONS_CONTENT_ID);

    if (modal && content) {
        content.innerHTML = buildRecommendationsHtml(multiSelectionResults, capacityByRole, algorithms);
        showModal(modal);

        const closeModal = () => hideModal(modal);
        document.getElementById(CLOSE_RECOMMENDATIONS_MODAL_BTN_ID)?.addEventListener('click', closeModal, { once: true });
        document.getElementById(CLOSE_RECOMMENDATIONS_BTN_ID)?.addEventListener('click', closeModal, { once: true });
    } else {
        showRecommendationsFallback(multiSelectionResults, capacityByRole, algorithms);
    }
}
