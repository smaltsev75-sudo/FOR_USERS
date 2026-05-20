// js/ui/blockedScreen.js
//
// v8.30.16: экран блокировки. Показывается ДО `new App()` через bootstrapApp,
// когда (a) другая версия активна в этом же origin или (b) сохранённый
// state.version > APP_CONFIG.STORAGE_VERSION (downgrade-guard).
//
// XSS-safety: версии (`v8.30.15`) и числа (storageVersion: 12) теоретически
// могут прийти из чужого реестра, потому всё пропускается через escapeHtml.
// См. feedback_attribute_escape_is_not_html_escape — innerHTML без escape был
// причиной P1 v8.30.3.

import { escapeHtml } from '../utils/escapeHtml.js';

export const BLOCKED_SCREEN_ID = 'blockedScreen';
const HEADING_ID = 'blockedScreenTitle';
const CLOSE_HINT_ID = 'blockedScreenCloseHint';

/**
 * @typedef {Object} BlockedScreenConflictArgs
 * @property {'conflict'} mode
 * @property {{ version: string, storageVersion: number }} mine
 * @property {{ version: string, storageVersion: number }} other
 *
 * @typedef {Object} BlockedScreenFutureArgs
 * @property {'future-storage'} mode
 * @property {{ version: string, storageVersion: number }} mine
 * @property {number} savedVersion
 *
 * @typedef {BlockedScreenConflictArgs | BlockedScreenFutureArgs} BlockedScreenArgs
 *
 * @typedef {Object} BlockedScreenOpts
 * @property {HTMLElement} [mount]   куда монтировать (default: document.body)
 * @property {() => void} [onReload]
 * @property {() => void} [onClose]
 */

/**
 * Рендерит full-screen overlay с инструкцией пользователю. Повторный вызов
 * заменяет существующий overlay (идемпотентный по id).
 *
 * @param {BlockedScreenArgs} args
 * @param {BlockedScreenOpts} [opts]
 */
export function renderBlockedScreen(args, opts = {}) {
    const mount = opts.mount || document.body;
    const onReload = typeof opts.onReload === 'function'
        ? opts.onReload
        : () => { if (typeof location !== 'undefined') location.reload(); };
    // v8.30.17: window.close() по спецификации HTML работает только для окон,
    // открытых скриптом (PWA standalone, window.open). На обычной вкладке
    // браузер тихо игнорирует — пользователь считает кнопку «сломанной».
    // Default onClose всё равно пытается close (для PWA-окна это работает),
    // и независимо от исхода раскрывает скрытую подсказку с shortcut.
    const onClose = typeof opts.onClose === 'function'
        ? opts.onClose
        : () => {
            try {
                if (typeof window !== 'undefined' && typeof window.close === 'function') {
                    window.close();
                }
            } catch { /* cross-origin/SecurityError — игнорируем, hint всё равно раскроем */ }
            const hint = document.getElementById(CLOSE_HINT_ID);
            if (hint) hint.removeAttribute('hidden');
        };

    const existing = document.getElementById(BLOCKED_SCREEN_ID);
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = BLOCKED_SCREEN_ID;
    overlay.className = 'blocked-screen';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', HEADING_ID);

    const body = (args.mode === 'future-storage')
        ? renderFutureStorageBody(args)
        : renderConflictBody(args);

    overlay.innerHTML = `
        <div class="blocked-screen__card">
            <div class="blocked-screen__icon" aria-hidden="true">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
            </div>
            ${body}
            <div class="blocked-screen__actions">
                <button type="button" class="export-btn" data-action="reload">Попробовать снова</button>
                <button type="button" class="export-btn" data-action="close">Закрыть вкладку</button>
            </div>
            <p id="${CLOSE_HINT_ID}" class="blocked-screen__close-hint" role="status" aria-live="polite" hidden>
                Если вкладка не закрылась — нажмите <kbd>Ctrl</kbd>&nbsp;+&nbsp;<kbd>W</kbd>
                (или <kbd>⌘</kbd>&nbsp;+&nbsp;<kbd>W</kbd> на macOS). Браузер запрещает закрывать
                вкладки, открытые вручную, программно.
            </p>
        </div>
    `;

    overlay.querySelector('[data-action="reload"]').addEventListener('click', () => onReload());
    overlay.querySelector('[data-action="close"]').addEventListener('click', () => onClose());

    mount.appendChild(overlay);
}

function renderConflictBody(args) {
    const myV = escapeHtml(String(args.mine?.version ?? ''));
    const otherV = escapeHtml(String(args.other?.version ?? ''));
    return `
        <h1 id="${HEADING_ID}" class="blocked-screen__title">
            Уже открыта другая вкладка приложения
        </h1>
        <p class="blocked-screen__lead">
            На этой машине уже работает экземпляр приложения. Одновременная работа двух
            вкладок может привести к потере расчётов: последнее сохранение перетирает
            предыдущее без слияния. Закройте эту вкладку и продолжайте работу в той,
            где уже открыто приложение, либо перезагрузите страницу,
            если другая вкладка уже закрыта.
        </p>
        <dl class="blocked-screen__versions">
            <dt>Эта вкладка:</dt>
            <dd>${myV}</dd>
            <dt>Уже активна:</dt>
            <dd>${otherV}</dd>
        </dl>
    `;
}

function renderFutureStorageBody(args) {
    const saved = escapeHtml(String(args.savedVersion ?? ''));
    const current = escapeHtml(String(args.mine?.storageVersion ?? ''));
    return `
        <h1 id="${HEADING_ID}" class="blocked-screen__title">
            Сохранение из более новой версии приложения
        </h1>
        <p class="blocked-screen__lead">
            Данные в браузере сохранены более новой версией приложения.
            Чтобы не повредить их, эта (старая) версия не будет запускаться.
            Откройте приложение в более новой вкладке или обновите страницу до актуальной версии.
        </p>
        <dl class="blocked-screen__versions">
            <dt>Версия хранилища у данных:</dt>
            <dd>${saved}</dd>
            <dt>Версия хранилища в этой вкладке:</dt>
            <dd>${current}</dd>
        </dl>
    `;
}
