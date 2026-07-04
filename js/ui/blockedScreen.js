// js/ui/blockedScreen.js
//
// v8.30.16: экран блокировки. Показывается ДО `new App()` через bootstrapApp,
// когда (a) другая версия активна в этом же origin или (b) сохранённый
// state.version > APP_CONFIG.STORAGE_VERSION (downgrade-guard).
//
// Фасад оставляет публичный render API, а mode-copy, overlay shell, reload/focus
// wiring живут в js/ui/blockedScreen/*.

import { BLOCKED_SCREEN_ID } from './blockedScreen/constants.js';
import { renderBlockedScreenBody } from './blockedScreen/content.js';
import { createBlockedScreenOverlay } from './blockedScreen/shell.js';
import {
    focusBlockedScreenPrimaryAction,
    resolveBlockedScreenReloadHandler,
    wireBlockedScreenActions
} from './blockedScreen/actions.js';

export { BLOCKED_SCREEN_ID } from './blockedScreen/constants.js';

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
 * v8.30.19/20: добавлен mode 'lock-storage-error' — рендерится, когда
 * instanceLock не смог записать metadata в localStorage из-за Storage*Error
 * (Quota/Security). До v8.30.21 этот mode не был отражён в JSDoc-контракте.
 *
 * @typedef {Object} BlockedScreenLockStorageErrorArgs
 * @property {'lock-storage-error'} mode
 * @property {{ version: string, storageVersion: number }} mine
 * @property {string} error
 *
 * @typedef {BlockedScreenConflictArgs | BlockedScreenFutureArgs | BlockedScreenBackupFailedArgs | BlockedScreenLockStorageErrorArgs} BlockedScreenArgs
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
    const onReload = resolveBlockedScreenReloadHandler(opts.onReload);
    // v8.30.18: кнопка «Закрыть вкладку» удалена. window.close() по спеке HTML
    // тихо игнорируется браузером для вкладок, открытых пользователем (Ctrl+T,
    // ссылка) — это правило безопасности нельзя обойти кодом. Любая кнопка
    // с таким лейблом на обычной вкладке обманывает пользователя; v8.30.17
    // hint после клика проблемы не решал — кнопка по-прежнему «не работала».
    // Теперь инструкция «Ctrl/Cmd + W» отрисована текстом, всегда видима, без
    // кнопочной семантики. См. memory feedback-button-must-fulfill-its-label.

    const existing = document.getElementById(BLOCKED_SCREEN_ID);
    if (existing) existing.remove();

    const overlay = createBlockedScreenOverlay(renderBlockedScreenBody(args));
    wireBlockedScreenActions(overlay, onReload);

    mount.appendChild(overlay);

    // v8.30.19: focus management для role="alertdialog" + aria-modal="true"
    // (P2 self-review v8.30.18). Без этого после монтирования focus оставался
    // в фоновом DOM, screen reader / Tab уходили в неинициализированный
    // app DOM. Переводим focus на единственную кнопку «Попробовать снова».
    focusBlockedScreenPrimaryAction(overlay);
}
