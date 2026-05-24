import { APPLY_BUTTON_IDS } from './constants.js';

/**
 * Подсвечивает кнопку рекомендованного алгоритма как primary, остальные —
 * как нейтральные. IDs кнопок остаются прежними для e2e и controller-логики.
 *
 * @param {string|null} recommendedKey
 */
export function highlightRecommendedApplyButton(recommendedKey) {
    Object.entries(APPLY_BUTTON_IDS).forEach(([key, id]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const isRecommended = key === recommendedKey;
        btn.classList.remove('primary', 'export-btn--success');
        btn.classList.add('export-btn');
        if (isRecommended) {
            btn.classList.add('primary');
        }
        btn.setAttribute('aria-pressed', isRecommended ? 'true' : 'false');
    });
}

export function bindAccordionHandlers(contentEl) {
    contentEl.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', function () {
            const content = this.nextElementSibling;
            if (content && content.classList.contains('accordion-content')) {
                const isHidden = content.hasAttribute('hidden');
                if (isHidden) {
                    content.removeAttribute('hidden');
                } else {
                    content.setAttribute('hidden', '');
                }
                // v8.30.25 (a11y): native <button> требует синхронизации aria-expanded
                // с visible state для screen-reader'ов.
                this.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
                const iconEl = this.querySelector('.accordion-icon');
                if (iconEl) iconEl.textContent = isHidden ? '▼' : '▶';
            }
        });
    });
}
