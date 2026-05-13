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
