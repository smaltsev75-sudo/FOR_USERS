// js/ui/utils.js
import { NumberFormatService } from '../services/numberFormat.js';

export function getNFS(nfs) {
    return nfs || new NumberFormatService();
}

export function updateTabTitle(state) {
    const criteriaTabBtn = document.querySelector('.tab-btn[data-tab="criteria"]');
    if (criteriaTabBtn) {
        criteriaTabBtn.textContent = `⚖️ Критерии оценки (${state.criteria.length})`;
    }
}
