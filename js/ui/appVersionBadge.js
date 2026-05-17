// js/ui/appVersionBadge.js
// Рендерит номер версии приложения в шапке (элемент #appVersion).
// Источник истины — js/version.js (APP_VERSION). Вызывается один раз
// при инициализации; не зависит от Store и не перерисовывается.

import { APP_VERSION } from '../version.js';

/**
 * @param {Document | HTMLElement} root — корень для поиска (default: document).
 * @returns {HTMLElement | null} — заполненный элемент или null, если не найден.
 */
export function renderAppVersionBadge(root = document) {
    const el = root.getElementById ? root.getElementById('appVersion') : root.querySelector('#appVersion');
    if (!el) return null;
    el.textContent = APP_VERSION;
    el.title = `Sprint Planner ${APP_VERSION}`;
    return el;
}

/**
 * v8.30.6: print-only timestamp рядом с версией приложения.
 * Заполняем актуальной датой/временем в `beforeprint` (Ctrl+P / window.print()).
 * Печатаемый отчёт получает строку «v8.30.6 (дата печати 17.05.2026 23:05)».
 * @param {Window} win — окружение (для тестов: окно с document и addEventListener)
 */
export function bindPrintTimestamp(win = window) {
    if (!win || typeof win.addEventListener !== 'function') return;
    const doc = win.document;
    const format = (d) => {
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const update = () => {
        const el = doc.getElementById && doc.getElementById('printTimestamp');
        if (!el) return;
        el.textContent = `(дата печати ${format(new Date())})`;
    };
    win.addEventListener('beforeprint', update);
    // Pre-fill для emulateMedia('print') в Playwright и для CSS-only print preview
    update();
}
