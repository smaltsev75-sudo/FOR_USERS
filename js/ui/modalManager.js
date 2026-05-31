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

// v8.30.27: внешний аудит P3 — selector был слишком широким:
//   - включал `input[type="hidden"]` (служебное поле → невозможно получить focus в браузере)
//   - не исключал `[aria-hidden="true"]` (явное скрытие от AT и от tab order)
//   - не исключал `[hidden]` HTML attribute (display:none equivalent)
//   - не исключал descendants of `fieldset:disabled` (тоже не focusable)
// Теперь selector + post-filter покрывают все эти случаи.
const FOCUSABLE_SELECTOR = [
    'a[href]:not([aria-hidden="true"])',
    'button:not([disabled]):not([aria-hidden="true"])',
    'input:not([disabled]):not([type="hidden"]):not([aria-hidden="true"])',
    'textarea:not([disabled]):not([aria-hidden="true"])',
    'select:not([disabled]):not([aria-hidden="true"])',
    '[tabindex]:not([tabindex="-1"]):not([aria-hidden="true"])'
].join(', ');

function getFocusableElements(modal) {
    // 1. Selector уже исключает: disabled / hidden-input / aria-hidden / tabindex=-1.
    // 2. Post-filter (cheap, без layout): исключаем элементы, у которых
    //    ANY ancestor имеет `[hidden]` или находится внутри disabled <fieldset>.
    //    Это HTML-семантика, доступная без computed style — работает в jsdom.
    return Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
        if (el.closest('[hidden]')) return false;
        if (el.closest('[aria-hidden="true"]')) return false;
        if (el.closest('fieldset:disabled')) return false;
        return true;
    });
}

// v8.30.68: стек открытых модальных окон в порядке открытия (LIFO).
// Нужен, чтобы Escape (keyboardController) закрывал ВЕРХНЕЕ открытое окно,
// а не первое по фиксированному индексу массива. Все модали имеют одинаковый
// z-index, поэтому «верхнее» определяется именно порядком открытия.
const openModalStack = [];

function pushModalToStack(modal) {
    const idx = openModalStack.indexOf(modal);
    if (idx !== -1) openModalStack.splice(idx, 1);
    openModalStack.push(modal);
}

function removeModalFromStack(modal) {
    const idx = openModalStack.indexOf(modal);
    if (idx !== -1) openModalStack.splice(idx, 1);
}

/**
 * Возвращает последнее (верхнее) реально открытое модальное окно из стека
 * открытия, либо null. Закрытые/удалённые элементы пропускаются.
 * @returns {HTMLElement|null}
 */
export function getTopmostOpenModal() {
    for (let i = openModalStack.length - 1; i >= 0; i--) {
        const modal = openModalStack[i];
        if (modal && isModalOpen(modal) && document.contains(modal)) return modal;
    }
    return null;
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
    pushModalToStack(modal);

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
    removeModalFromStack(modal);

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

/**
 * Открывает non-modal status/progress overlay БЕЗ focus-trap и БЕЗ изменения
 * focus. Применять к элементам с `role="status"` / `aria-live`, которые не
 * являются диалогами и не должны перехватывать клавиатуру.
 *
 * v8.30.27: внешний аудит P2 — `#globalProgress` (role="status") ошибочно
 * проходил через `showModal()`, что давало ему: (1) Tab-trap, (2) перехват
 * фокуса, (3) сохранение previously-focused. Это противоречит a11y-семантике
 * live region — status сообщения озвучиваются AT, но НЕ забирают focus.
 *
 * Использовать ВМЕСТО `showModal()` для:
 *   - `role="status"` / `role="alert"` (live regions)
 *   - non-dialog progress overlays
 *   - notification toasts
 *
 * @param {HTMLElement|null} el
 */
export function showStatusOverlay(el) {
    if (!el) return;
    el.style.display = 'flex';
    el.classList.add('is-open');
    // НЕ сохраняем previously-focused (status не забирает focus).
    // НЕ добавляем Tab-trap (Tab должен работать нормально по странице).
    // НЕ переводим focus — let AT announce через aria-live.
}

/**
 * Закрывает non-modal status/progress overlay. Контрпарный к showStatusOverlay.
 * НЕ восстанавливает focus (его и не сохраняли).
 *
 * @param {HTMLElement|null} el
 */
export function hideStatusOverlay(el) {
    if (!el) return;
    el.style.display = 'none';
    el.classList.remove('is-open');
}
