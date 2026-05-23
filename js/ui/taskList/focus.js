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

/**
 * Restores focus after renderTaskList replaces the task-list children.
 *
 * @param {HTMLElement} taskListEl
 * @param {string|null} key
 */
export function restoreCriteriaScoreFocus(taskListEl, key) {
    if (!key) return;
    const [taskId, criterionId] = key.split('::');
    const escapeSelectorValue = globalThis.CSS?.escape || ((value) => String(value).replace(/["\\\]]/g, '\\$&'));
    const stepper = taskListEl.querySelector(
        `.criteria-eval-stepper[data-id="${escapeSelectorValue(taskId)}"][data-criterion-id="${escapeSelectorValue(criterionId)}"]`
    );
    const input = stepper?.querySelector('.criteria-score-input');
    if (input && typeof input.focus === 'function') {
        input.focus({ preventScroll: true });
    }
}
