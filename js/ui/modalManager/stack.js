// js/ui/modalManager/stack.js
// Open-order stack for modal Escape handling.

const openModalStack = [];

export function isModalElementOpen(modal) {
    if (!modal) return false;
    return modal.style.display === 'flex' || modal.classList.contains('is-open');
}

export function pushModalToStack(modal) {
    const idx = openModalStack.indexOf(modal);
    if (idx !== -1) openModalStack.splice(idx, 1);
    openModalStack.push(modal);
}

export function removeModalFromStack(modal) {
    const idx = openModalStack.indexOf(modal);
    if (idx !== -1) openModalStack.splice(idx, 1);
}

export function getTopmostOpenModal() {
    for (let i = openModalStack.length - 1; i >= 0; i--) {
        const modal = openModalStack[i];
        if (modal && isModalElementOpen(modal) && document.contains(modal)) return modal;
    }
    return null;
}
