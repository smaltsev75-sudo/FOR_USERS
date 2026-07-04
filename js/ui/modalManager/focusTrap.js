// js/ui/modalManager/focusTrap.js
// Modal Tab-trap and previously-focused restore.

import { getFocusableElements } from './focusable.js';

function handleTabKey(modal, ev) {
    if (ev.key !== 'Tab') return;
    const focusable = getFocusableElements(modal);
    if (focusable.length === 0) {
        ev.preventDefault();
        return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (ev.shiftKey) {
        if (document.activeElement === first || !modal.contains(document.activeElement)) {
            ev.preventDefault();
            last.focus();
        }
    } else if (document.activeElement === last) {
        ev.preventDefault();
        first.focus();
    }
}

export function openModalWithFocusTrap(modal) {
    if (!modal) return;

    modal._previousFocus = document.activeElement;
    modal.style.display = 'flex';
    modal.classList.add('is-open');

    modal._trapHandler = (ev) => handleTabKey(modal, ev);
    modal.addEventListener('keydown', modal._trapHandler);

    requestAnimationFrame(() => {
        const focusable = getFocusableElements(modal);
        if (focusable.length > 0) {
            focusable[0].focus();
        } else {
            if (!modal.hasAttribute('tabindex')) modal.setAttribute('tabindex', '-1');
            modal.focus();
        }
    });
}

export function closeModalWithFocusRestore(modal) {
    if (!modal) return;

    modal.style.display = 'none';
    modal.classList.remove('is-open');

    if (modal._trapHandler) {
        modal.removeEventListener('keydown', modal._trapHandler);
        delete modal._trapHandler;
    }

    const prev = modal._previousFocus;
    delete modal._previousFocus;
    if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus();
    }
}
