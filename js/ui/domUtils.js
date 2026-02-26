// js/ui/domUtils.js

/**
 * Создать элемент с классами и атрибутами
 * @param {string} tag - тег элемента
 * @param {Object} [options] - { classes: [], attrs: {}, html: '' }
 * @returns {HTMLElement}
 */
export function createElement(tag, options = {}) {
    const el = document.createElement(tag);
    if (options.classes) el.className = options.classes.join(' ');
    if (options.attrs) {
        Object.entries(options.attrs).forEach(([k, v]) => el.setAttribute(k, v));
    }
    if (options.text) el.textContent = options.text;
    if (options.html) el.innerHTML = options.html;
    return el;
}

/**
 * Экранирует HTML-спецсимволы для безопасной вставки пользовательских данных.
 * Предотвращает XSS при использовании шаблонных строк с innerHTML.
 * @param {string} str — строка для экранирования
 * @returns {string}
 */
export function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Безопасная очистка содержимого элемента (замена innerHTML = '').
 * Использует replaceChildren() — не создаёт промежуточный HTML-парсинг.
 * @param {HTMLElement} el
 */
export function clearChildren(el) {
    if (el) el.replaceChildren();
}


/**
 * Добавить класс к элементу
 */
export function addClass(el, className) {
    if (el && className) el.classList.add(className);
}

/**
 * Удалить класс у элемента
 */
export function removeClass(el, className) {
    if (el && className) el.classList.remove(className);
}

/**
 * Безопасно установить innerHTML
 */
export function setHTML(el, html) {
    if (el) el.innerHTML = html;
}

/**
 * Безопасно добавить дочерний элемент
 */
export function append(el, child) {
    if (el && child) el.appendChild(child);
}
