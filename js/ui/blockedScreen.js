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
 * v8.30.19: добавлен режим 'backup-failed' — рендерится, когда bootstrapApp
 * не смог записать pre-migration backup (storageService.saveBackup вернул
 * !ok). Запуск App блокируется, чтобы миграция не перештамповала raw без
 * recovery-точки. Пользователю предлагается скачать JSON вручную.
 *
 * @typedef {Object} BlockedScreenBackupFailedArgs
 * @property {'backup-failed'} mode
 * @property {{ version: string, storageVersion: number }} mine
 * @property {number} savedVersion
 * @property {string} error
 *
 * @typedef {BlockedScreenConflictArgs | BlockedScreenFutureArgs | BlockedScreenBackupFailedArgs} BlockedScreenArgs
 *
 * @typedef {Object} BlockedScreenOpts
 * @property {HTMLElement} [mount]   куда монтировать (default: document.body)
 * @property {() => void} [onReload]
 *
 * v8.30.18: опция onClose удалена. Кнопка «Закрыть вкладку» больше не
 * рендерится — браузер не позволяет программно закрыть вкладку, которую
 * пользователь открыл вручную (см. соответствующий комментарий в теле
 * renderBlockedScreen). Инструкция о Ctrl/Cmd+W отрисована текстом и
 * не нуждается в callback'е.
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
    // v8.30.18: кнопка «Закрыть вкладку» удалена. window.close() по спеке HTML
    // тихо игнорируется браузером для вкладок, открытых пользователем (Ctrl+T,
    // ссылка) — это правило безопасности нельзя обойти кодом. Любая кнопка
    // с таким лейблом на обычной вкладке обманывает пользователя; v8.30.17
    // hint после клика проблемы не решал — кнопка по-прежнему «не работала».
    // Теперь инструкция «Ctrl/Cmd + W» отрисована текстом, всегда видима, без
    // кнопочной семантики. См. memory feedback-button-must-fulfill-its-label.

    const existing = document.getElementById(BLOCKED_SCREEN_ID);
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = BLOCKED_SCREEN_ID;
    overlay.className = 'blocked-screen';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', HEADING_ID);

    let body;
    if (args.mode === 'future-storage') body = renderFutureStorageBody(args);
    else if (args.mode === 'backup-failed') body = renderBackupFailedBody(args);
    else body = renderConflictBody(args);

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
            </div>
            <p id="${CLOSE_HINT_ID}" class="blocked-screen__close-hint">
                Чтобы закрыть эту вкладку, нажмите <kbd>Ctrl</kbd>&nbsp;+&nbsp;<kbd>W</kbd>
                (или <kbd>⌘</kbd>&nbsp;+&nbsp;<kbd>W</kbd> на macOS) либо крестик на самой вкладке.
            </p>
        </div>
    `;

    overlay.querySelector('[data-action="reload"]').addEventListener('click', () => onReload());

    mount.appendChild(overlay);

    // v8.30.19: focus management для role="alertdialog" + aria-modal="true"
    // (P2 self-review v8.30.18). Без этого после монтирования focus оставался
    // в фоновом DOM, screen reader / Tab уходили в неинициализированный
    // app DOM. Переводим focus на единственную кнопку «Попробовать снова».
    const firstButton = overlay.querySelector('button');
    if (firstButton && typeof firstButton.focus === 'function') {
        try { firstButton.focus(); } catch { /* ignore — focus в jsdom может бросить */ }
    }
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

function renderBackupFailedBody(args) {
    const errorName = escapeHtml(String(args.error ?? 'StorageError'));
    const savedV = escapeHtml(String(args.savedVersion ?? ''));
    const currentV = escapeHtml(String(args.mine?.storageVersion ?? ''));
    return `
        <h1 id="${HEADING_ID}" class="blocked-screen__title">
            Не удалось создать резервную копию данных
        </h1>
        <p class="blocked-screen__lead">
            Перед миграцией формата приложение пытается сохранить копию исходного
            состояния в браузере, чтобы можно было откатиться, если что-то пойдёт
            не так. Сейчас сделать копию не получилось (${errorName}). Чтобы не
            потерять данные, приложение НЕ запускается. Откройте предыдущую
            версию или скачайте текущее сохранение через файл-менеджер браузера,
            затем очистите место в хранилище и попробуйте снова.
        </p>
        <dl class="blocked-screen__versions">
            <dt>Версия сохранения:</dt>
            <dd>${savedV}</dd>
            <dt>Версия приложения:</dt>
            <dd>${currentV}</dd>
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
