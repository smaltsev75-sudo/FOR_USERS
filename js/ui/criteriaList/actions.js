/**
 * Запоминает фокус и selectionRange активного weight-input перед re-render
 * (обходим потерю фокуса при перерисовке списка).
 * @returns {{ key: string|null, start: number, end: number }}
 */
export function snapshotWeightFocus() {
    const active = document.activeElement;
    if (!active || !active.classList?.contains('criteria-weight-input')) {
        return { key: null, start: 0, end: 0 };
    }
    return {
        key: active.getAttribute('data-focus-key'),
        start: active.selectionStart || 0,
        end: active.selectionEnd || 0
    };
}

export function restoreWeightFocus(snapshot, container) {
    if (!snapshot.key) return;
    const target = container.querySelector(`[data-focus-key="${CSS.escape(snapshot.key)}"]`);
    if (target) {
        target.focus();
        try {
            target.setSelectionRange(snapshot.start, snapshot.end);
        } catch (_) {
            // not all input types support selection range
        }
    }
}

export function attachScaleToggleHandlers(container) {
    container.querySelectorAll('.scale-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = toggle.dataset.id;
            const scaleEl = document.getElementById(`scale_${id}`);
            const iconEl = toggle.querySelector('.scale-toggle-icon');
            const textSpan = toggle.querySelector('.scale-toggle-text');
            if (!scaleEl) return;
            if (scaleEl.classList.contains('expanded')) {
                scaleEl.classList.remove('expanded');
                if (iconEl) {
                    iconEl.classList.add('collapsed');
                    iconEl.textContent = '▶';
                }
                if (textSpan) textSpan.textContent = 'Показать шкалу 1–10';
                toggle.setAttribute('aria-expanded', 'false');
            } else {
                scaleEl.classList.add('expanded');
                if (iconEl) {
                    iconEl.classList.remove('collapsed');
                    iconEl.textContent = '▼';
                }
                if (textSpan) textSpan.textContent = 'Скрыть шкалу';
                toggle.setAttribute('aria-expanded', 'true');
            }
        });
    });
}
