// js/ui/modalManager.js
// Public facade for centralized modal windows + focus management.
//
// Focusable filtering, Tab-trap, open-order stack and non-modal status overlay
// behavior live in js/ui/modalManager/* helpers. Keep this file as the stable
// import surface for controllers/services.

import {
    closeModalWithFocusRestore,
    openModalWithFocusTrap
} from './modalManager/focusTrap.js';
import {
    getTopmostOpenModal,
    isModalElementOpen,
    pushModalToStack,
    removeModalFromStack
} from './modalManager/stack.js';
import {
    hideStatusOverlay,
    showStatusOverlay
} from './modalManager/statusOverlay.js';

export { getTopmostOpenModal };
export { showStatusOverlay, hideStatusOverlay };

/**
 * Открывает модальное окно. Сохраняет текущий фокус, переводит на первый
 * focusable внутри modal, активирует Tab-trap и кладёт modal на вершину стека.
 * @param {HTMLElement|null} modal
 */
export function showModal(modal) {
    if (!modal) return;
    openModalWithFocusTrap(modal);
    pushModalToStack(modal);
}

/**
 * Закрывает модальное окно. Снимает Tab-trap, восстанавливает previously-focused.
 * @param {HTMLElement|null} modal
 */
export function hideModal(modal) {
    if (!modal) return;
    closeModalWithFocusRestore(modal);
    removeModalFromStack(modal);
}

/**
 * Проверяет, открыто ли модальное окно.
 * @param {HTMLElement|null} modal
 * @returns {boolean}
 */
export function isModalOpen(modal) {
    return isModalElementOpen(modal);
}
