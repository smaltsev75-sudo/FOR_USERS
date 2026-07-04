import { escapeHtml } from '../../utils/escapeHtml.js';
import { icon } from '../../utils/icons.js';

/**
 * Returns CSS modifier class for the sum pill based on total weight.
 * Exported for tests + sticky-bar partial-update logic.
 * @param {number} total
 * @returns {string} '' | 'criteria-sum-pill--invalid-under' | 'criteria-sum-pill--invalid-over'
 */
export function getSumPillModifier(total) {
    if (total === 100) return '';
    if (total < 100) return 'criteria-sum-pill--invalid-under';
    return 'criteria-sum-pill--invalid-over';
}

/**
 * Returns the human-readable label inside the sum pill.
 * @param {number} total
 * @returns {string}
 */
export function getSumPillLabel(total) {
    if (total === 100) return 'Сумма весов: 100%';
    if (total < 100) return `Осталось распределить: ${100 - total}%`;
    return `Превышение на ${total - 100}%`;
}

export function buildSumBarHtml(total) {
    const modifier = getSumPillModifier(total);
    const label = getSumPillLabel(total);
    const pillIcon = total === 100 ? icon('check') : icon('alertCircle');
    const showAutoBalance = total !== 100;
    return `
<div class="criteria-sum-bar" id="criteriaSumBar">
    <span class="criteria-sum-pill ${modifier}" id="criteriaSumPill" data-total="${total}">
        ${pillIcon}<span id="criteriaSumPillLabel">${escapeHtml(label)}</span>
    </span>
    <div class="criteria-sum-actions">
        <button type="button" id="criteriaAutoBalanceBtn" class="criteria-auto-balance-btn"${showAutoBalance ? '' : ' hidden'} title="Распределить веса так, чтобы сумма равнялась 100%">
            ${icon('scale')}
            Авто-баланс
        </button>
        <button type="button" id="resetCriteriaBtn" class="btn-reset-criteria" title="Сбросить критерии к значениям по умолчанию" aria-label="Сбросить критерии к значениям по умолчанию">${icon('rotateCcw')}</button>
        <button type="button" id="addCriteriaBtn" class="btn-add-criteria-small" aria-label="Добавить новый критерий">${icon('plus')}<span>Добавить</span></button>
    </div>
</div>`;
}

/**
 * Обновляет только sum-bar (без перерисовки списка карточек). Используется
 * во время `input` события inline weight-input — нужно мгновенно показать
 * пользователю изменение суммы, но не дёргать DOM карточек (потеря фокуса).
 *
 * @param {number} total — текущая сумма весов
 */
export function updateSumBar(total) {
    const pill = document.getElementById('criteriaSumPill');
    const label = document.getElementById('criteriaSumPillLabel');
    const autoBtn = document.getElementById('criteriaAutoBalanceBtn');
    if (!pill || !label) return;

    pill.classList.remove('criteria-sum-pill--invalid-under', 'criteria-sum-pill--invalid-over');
    const modifier = getSumPillModifier(total);
    if (modifier) pill.classList.add(modifier);
    pill.dataset.total = String(total);
    label.textContent = getSumPillLabel(total);

    if (autoBtn) {
        if (total === 100) {
            autoBtn.setAttribute('hidden', '');
        } else {
            autoBtn.removeAttribute('hidden');
        }
    }
}
