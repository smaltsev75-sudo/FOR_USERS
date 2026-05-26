// js/ui/taskList/focus.js

/**
 * Captures the editable criteria score that currently owns focus inside taskList.
 *
 * @param {HTMLElement} taskListEl
 * @param {Element|null} [active]
 * @returns {string|null}
 */
export function captureCriteriaScoreFocus(taskListEl, active = document.activeElement) {
    if (!active || !taskListEl.contains(active)) return null;
    const input = active.closest?.('.criteria-score-input');
    const stepper = active.closest?.('.criteria-eval-stepper');
    const taskId = input?.dataset.id || stepper?.dataset.id;
    const criterionId = input?.dataset.criterionId || stepper?.dataset.criterionId;
    return taskId && criterionId ? `${taskId}::${criterionId}` : null;
}

function escapeSelectorValue(value) {
    return (globalThis.CSS?.escape || ((raw) => String(raw).replace(/["\\\]]/g, '\\$&')))(value);
}

function readSelection(input) {
    if (!input || typeof input.selectionStart !== 'number') {
        return { selectionStart: null, selectionEnd: null };
    }
    return {
        selectionStart: input.selectionStart,
        selectionEnd: typeof input.selectionEnd === 'number' ? input.selectionEnd : input.selectionStart
    };
}

function restoreSelection(input, focusInfo) {
    if (!input || typeof input.setSelectionRange !== 'function') return;
    const len = input.value.length;
    const start = Number.isInteger(focusInfo.selectionStart)
        ? Math.min(focusInfo.selectionStart, len)
        : len;
    const end = Number.isInteger(focusInfo.selectionEnd)
        ? Math.min(focusInfo.selectionEnd, len)
        : start;
    try {
        input.setSelectionRange(start, end);
    } catch (_) { /* Some input types do not expose selection ranges. */ }
}

function readScrollPosition() {
    if (typeof window === 'undefined') return { scrollX: null, scrollY: null };
    return {
        scrollX: Number.isFinite(window.scrollX) ? window.scrollX : null,
        scrollY: Number.isFinite(window.scrollY) ? window.scrollY : null
    };
}

function restoreScrollPosition(focusInfo) {
    if (typeof window === 'undefined' || typeof window.scrollTo !== 'function') return;
    if (!Number.isFinite(focusInfo?.scrollX) || !Number.isFinite(focusInfo?.scrollY)) return;
    try {
        window.scrollTo(focusInfo.scrollX, focusInfo.scrollY);
    } catch (_) { /* jsdom and older engines can reject programmatic scroll. */ }
}

/**
 * Captures the task-list control that currently owns focus before a full list
 * re-render replaces DOM nodes.
 *
 * @param {HTMLElement} taskListEl
 * @param {Element|null} [active]
 * @returns {Object|null}
 */
export function captureTaskListFocus(taskListEl, active = document.activeElement) {
    if (!active || !taskListEl.contains(active)) return null;
    const scrollPosition = readScrollPosition();

    const estimateInput = active.closest?.('input[data-action="updateEst"]');
    if (estimateInput && taskListEl.contains(estimateInput)) {
        const taskId = estimateInput.dataset.id;
        const roleId = estimateInput.dataset.role;
        return taskId && roleId
            ? { type: 'estimate', taskId, roleId, ...readSelection(estimateInput), ...scrollPosition }
            : null;
    }

    const criteriaKey = captureCriteriaScoreFocus(taskListEl, active);
    if (!criteriaKey) return null;
    const input = active.closest?.('.criteria-score-input');
    return {
        type: 'criteriaScore',
        key: criteriaKey,
        ...readSelection(input),
        ...scrollPosition
    };
}

/**
 * Restores focus after renderTaskList replaces the task-list children.
 *
 * @param {HTMLElement} taskListEl
 * @param {Object|null} focusInfo
 */
export function restoreTaskListFocus(taskListEl, focusInfo) {
    if (!focusInfo) return;
    if (focusInfo.type === 'estimate') {
        const input = taskListEl.querySelector(
            `input[data-action="updateEst"][data-id="${escapeSelectorValue(focusInfo.taskId)}"][data-role="${escapeSelectorValue(focusInfo.roleId)}"]`
        );
        if (input && typeof input.focus === 'function') {
            input.focus({ preventScroll: true });
            restoreSelection(input, focusInfo);
        }
        restoreScrollPosition(focusInfo);
        return;
    }

    if (focusInfo.type === 'criteriaScore') {
        restoreCriteriaScoreFocus(taskListEl, focusInfo.key, focusInfo);
        restoreScrollPosition(focusInfo);
    }
}

/**
 * Restores focus after renderTaskList replaces the task-list children.
 *
 * @param {HTMLElement} taskListEl
 * @param {string|null} key
 * @param {{selectionStart?: number|null, selectionEnd?: number|null}} [focusInfo]
 */
export function restoreCriteriaScoreFocus(taskListEl, key, focusInfo = {}) {
    if (!key) return;
    const [taskId, criterionId] = key.split('::');
    const stepper = taskListEl.querySelector(
        `.criteria-eval-stepper[data-id="${escapeSelectorValue(taskId)}"][data-criterion-id="${escapeSelectorValue(criterionId)}"]`
    );
    const input = stepper?.querySelector('.criteria-score-input');
    if (input && typeof input.focus === 'function') {
        input.focus({ preventScroll: true });
        restoreSelection(input, focusInfo);
    }
}
