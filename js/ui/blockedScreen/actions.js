export function resolveBlockedScreenReloadHandler(onReload) {
    return typeof onReload === 'function'
        ? onReload
        : () => { if (typeof location !== 'undefined') location.reload(); };
}

export function wireBlockedScreenActions(overlay, onReload) {
    overlay
        .querySelector('[data-action="reload"]')
        .addEventListener('click', () => onReload());
}

export function focusBlockedScreenPrimaryAction(overlay) {
    const firstButton = overlay.querySelector('button');
    if (firstButton && typeof firstButton.focus === 'function') {
        try { firstButton.focus(); } catch { /* ignore — focus в jsdom может бросить */ }
    }
}
