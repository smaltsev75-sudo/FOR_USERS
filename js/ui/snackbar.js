// js/ui/snackbar.js
// Компонент snackbar (toast) для уведомлений с кнопкой «Отменить».

/**
 * Показывает snackbar с сообщением и опциональной кнопкой «Отменить».
 *
 * @param {string} message — текст уведомления
 * @param {Object} [options] — настройки
 * @param {Function} [options.onUndo] — callback при нажатии «Отменить»
 * @param {number} [options.duration=5000] — время показа (мс)
 * @returns {{ dismiss: Function }} — объект для ручного скрытия
 */
export function showSnackbar(message, options = {}) {
    const { onUndo, duration = 5000 } = options;

    // Удаляем предыдущий snackbar, если есть
    const existing = document.getElementById('sp-snackbar');
    if (existing) existing.remove();

    const bar = document.createElement('div');
    bar.id = 'sp-snackbar';
    bar.className = 'sp-snackbar sp-snackbar--show';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');

    const text = document.createElement('span');
    text.className = 'sp-snackbar__text';
    text.textContent = message;
    bar.appendChild(text);

    let undone = false;

    if (onUndo) {
        const btn = document.createElement('button');
        btn.className = 'sp-snackbar__undo';
        btn.textContent = 'Отменить';
        btn.addEventListener('click', () => {
            if (undone) return;
            undone = true;
            onUndo();
            dismiss();
        });
        bar.appendChild(btn);
    }

    document.body.appendChild(bar);

    const timer = setTimeout(() => dismiss(), duration);

    function dismiss() {
        clearTimeout(timer);
        bar.classList.remove('sp-snackbar--show');
        bar.classList.add('sp-snackbar--hide');
        setTimeout(() => bar.remove(), 300);
    }

    return { dismiss };
}
