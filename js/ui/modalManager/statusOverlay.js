// js/ui/modalManager/statusOverlay.js
// Non-modal status/progress overlay helpers.

export function showStatusOverlay(el) {
    if (!el) return;
    el.style.display = 'flex';
    el.classList.add('is-open');
}

export function hideStatusOverlay(el) {
    if (!el) return;
    el.style.display = 'none';
    el.classList.remove('is-open');
}
