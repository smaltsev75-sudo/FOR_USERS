const INTERACTIVE_TASK_TARGET_SELECTOR = 'button, a, select, input, textarea';

export function isInteractiveTaskTarget(target) {
    return Boolean(target?.closest?.(INTERACTIVE_TASK_TARGET_SELECTOR));
}

export function isPrimaryTaskFormShortcut(event) {
    if (!event || (!event.ctrlKey && !event.metaKey)) return false;
    return event.key === 'Enter' || String(event.key).toLowerCase() === 's';
}

export function submitTaskFormAction(form, { closeDelayMs = 1200, schedule = setTimeout } = {}) {
    if (form.editId !== null) {
        form.handleSaveEdit();
        return { mode: 'edit', saved: true, closeScheduled: false };
    }

    const saved = Boolean(form.handleAddTask());
    if (saved) {
        schedule(() => form.closeCreateModal(), closeDelayMs);
    }
    return { mode: 'create', saved, closeScheduled: saved };
}

export function readTaskListButtonAction(target) {
    const button = target?.closest?.('button');
    if (!button) return null;

    const action = button.dataset.action;
    const id = Number(button.dataset.id);
    if (!action || !Number.isFinite(id)) return null;
    return { action, id, button };
}
