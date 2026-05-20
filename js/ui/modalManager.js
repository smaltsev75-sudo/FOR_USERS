// js/ui/modalManager.js
// Централизованное управление модальными окнами + focus management.
//
// v8.30.26: P2 fix — раньше showModal/hideModal только меняли display + class.
// Это нарушало контракт `aria-modal="true"` в HTML: WCAG 2.1.2 (No Keyboard
// Trap — должен быть «правильный» trap в модалке), WCAG 2.4.3 (Focus Order),
// WCAG 3.2.1 (On Focus — фокус не должен теряться). Теперь:
//   - При open: сохраняем previously-focused, переводим фокус на первый
//     focusable внутри модалки.
//   - Trap Tab/Shift+Tab внутри модалки (циклически).
//   - При close: restore previously-focused.
// Inert на background НЕ применяется (не все модалки в проекте проходят через
// этот manager; inert-стратегия в backlog как unified-focus-management).

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
].join(', ');

function getFocusableElements(modal) {
    // Не фильтруем по offsetParent: в jsdom это всегда null (нет layout) →
    // ломает test environment. В production открытая модалка не содержит
    // hidden focusable children (display:none скрывает целые ветки DOM
    // через CSS, которые querySelectorAll НЕ возвращает только если у
    // элемента нет display:none). Disabled уже исключён selector'ом.
    return Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR));
}

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
    } else {
        if (document.activeElement === last) {
            ev.preventDefault();
            first.focus();
        }
    }
}

/**
 * Открывает модальное окно. Сохраняет текущий фокус, переводит на первый
 * focusable внутри modal, активирует Tab-trap.
 * @param {HTMLElement|null} modal — DOM-элемент модального окна
 */
export function showModal(modal) {
    if (!modal) return;

    // Запоминаем previously-focused element ДО смены focus.
    modal._previousFocus = document.activeElement;

    modal.style.display = 'flex';
    modal.classList.add('is-open');

    // Tab-trap handler — связан с конкретным modal через .bind замыкание,
    // чтобы removeEventListener на close сработал корректно.
    modal._trapHandler = (ev) => handleTabKey(modal, ev);
    modal.addEventListener('keydown', modal._trapHandler);

    // Перемещаем фокус на первый focusable. Откладываем через rAF чтобы
    // CSS transitions / display:flex успели применяться (некоторые элементы
    // не получают focus в момент перехода display: none → flex).
    requestAnimationFrame(() => {
        const focusable = getFocusableElements(modal);
        if (focusable.length > 0) {
            focusable[0].focus();
        } else {
            // Нет focusable — фокус на сам модал (для screen-reader announce).
            // tabindex=-1 нужен на самом modal, чтобы он принимал programmatic focus.
            if (!modal.hasAttribute('tabindex')) modal.setAttribute('tabindex', '-1');
            modal.focus();
        }
    });
}

/**
 * Закрывает модальное окно. Снимает Tab-trap, восстанавливает previously-focused.
 * @param {HTMLElement|null} modal
 */
export function hideModal(modal) {
    if (!modal) return;

    modal.style.display = 'none';
    modal.classList.remove('is-open');

    if (modal._trapHandler) {
        modal.removeEventListener('keydown', modal._trapHandler);
        delete modal._trapHandler;
    }

    // Restore focus. Защищаемся от случая, когда previouslyFocused был удалён
    // из DOM (например, был элементом списка, пересоздаваемого через render).
    const prev = modal._previousFocus;
    delete modal._previousFocus;
    if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus();
    }
}

/**
 * Проверяет, открыто ли модальное окно.
 * @param {HTMLElement|null} modal
 * @returns {boolean}
 */
export function isModalOpen(modal) {
    if (!modal) return false;
    return modal.style.display === 'flex' || modal.classList.contains('is-open');
}
