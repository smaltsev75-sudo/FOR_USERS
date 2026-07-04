import { BLOCKED_SCREEN_ID, CLOSE_HINT_ID, HEADING_ID } from './constants.js';

export function createBlockedScreenOverlay(bodyHtml) {
    const overlay = document.createElement('div');
    overlay.id = BLOCKED_SCREEN_ID;
    overlay.className = 'blocked-screen';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', HEADING_ID);

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
            ${bodyHtml}
            <div class="blocked-screen__actions">
                <button type="button" class="export-btn" data-action="reload">Попробовать снова</button>
            </div>
            <p id="${CLOSE_HINT_ID}" class="blocked-screen__close-hint">
                Чтобы закрыть эту вкладку, нажмите <kbd>Ctrl</kbd>&nbsp;+&nbsp;<kbd>W</kbd>
                (или <kbd>⌘</kbd>&nbsp;+&nbsp;<kbd>W</kbd> на macOS) либо крестик на самой вкладке.
            </p>
        </div>
    `;

    return overlay;
}
