// js/ui/utils.js
import { NumberFormatService } from '../services/numberFormat.js';
import { icon } from '../utils/icons.js';

export function getNFS(nfs) {
    return nfs || new NumberFormatService();
}

/**
 * v8.30.0: было `textContent = '⚖️ Критерии оценки (N)'` — эмодзи затирал
 * SVG-иконку, заданную в index.html. Теперь рендерим тот же шаблон, что в
 * HTML, дополняя только counter'ом. `state.criteria.length` — number, безопасен
 * для innerHTML.
 */
export function updateTabTitle(state) {
    const criteriaTabBtn = document.querySelector('.tab-btn[data-tab="criteria"]');
    if (!criteriaTabBtn) return;
    const count = Number(state.criteria?.length) || 0;
    criteriaTabBtn.innerHTML = `${icon('scale')}<span>Критерии оценки (${count})</span>`;
}
