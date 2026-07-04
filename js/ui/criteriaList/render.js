import { buildCriteriaItemHtml } from './row.js';
import { buildSumBarHtml } from './sumBar.js';
import { attachScaleToggleHandlers, restoreWeightFocus, snapshotWeightFocus } from './actions.js';

/**
 * Renders the criteria management list with sticky sum-bar.
 *
 * @param {Object} state - { criteria: Array }
 * @param {Object} _nfs - number formatting service (unused now)
 * @returns {void}
 */
export function renderCriteriaList(state, _nfs) {
    const criteriaListEl = document.getElementById('criteriaList');
    if (!criteriaListEl) return;

    const criteria = state.criteria || [];
    const totalWeight = criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

    const focusSnapshot = snapshotWeightFocus();
    const expandedIds = new Set(
        Array.from(criteriaListEl.querySelectorAll('.criteria-item[data-expanded="true"]'))
            .map(el => Number(el.dataset.id))
    );

    let html = buildSumBarHtml(totalWeight);

    if (criteria.length === 0) {
        html += '<div class="criteria-empty-state">Нет критериев оценки. Добавьте первый критерий.</div>';
    } else {
        criteria.forEach(criterion => { html += buildCriteriaItemHtml(criterion); });
    }

    criteriaListEl.innerHTML = html;

    // Восстанавливаем раскрытые карточки (которые пользователь открыл до re-render).
    // v8.30.0: aria-expanded переехал с header (role=button) на .criteria-item-toggle-btn.
    expandedIds.forEach(id => {
        const item = criteriaListEl.querySelector(`.criteria-item[data-id="${id}"]`);
        if (item) {
            item.dataset.expanded = 'true';
            item.classList.add('is-expanded');
            const toggleBtn = item.querySelector('.criteria-item-toggle-btn');
            const body = item.querySelector('.criteria-body');
            if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
            if (body) body.removeAttribute('hidden');
        }
    });

    // Восстанавливаем фокус на weight-input после re-render (например, после
    // setCriteria из autoBalance или updateCriteriaWeight).
    restoreWeightFocus(focusSnapshot, criteriaListEl);

    // Локальный listener: только scale-toggle (вложенный в body карточки).
    // Остальные клики/инпуты обрабатываются делегированно в criteriaController.
    attachScaleToggleHandlers(criteriaListEl);
}
