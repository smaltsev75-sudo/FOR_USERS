// js/ui/modalManager/focusable.js
// Focusable element discovery for modal focus-trap.

// v8.30.27: selector excludes hidden inputs, aria-hidden controls,
// [hidden] ancestors, disabled fieldsets and tabindex=-1.
const FOCUSABLE_SELECTOR = [
    'a[href]:not([aria-hidden="true"])',
    'button:not([disabled]):not([aria-hidden="true"])',
    'input:not([disabled]):not([type="hidden"]):not([aria-hidden="true"])',
    'textarea:not([disabled]):not([aria-hidden="true"])',
    'select:not([disabled]):not([aria-hidden="true"])',
    '[tabindex]:not([tabindex="-1"]):not([aria-hidden="true"])'
].join(', ');

export function getFocusableElements(modal) {
    return Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
        if (el.closest('[hidden]')) return false;
        if (el.closest('[aria-hidden="true"]')) return false;
        if (el.closest('fieldset:disabled')) return false;
        return true;
    });
}
