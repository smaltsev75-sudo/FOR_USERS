import { TASK_FLAGS } from '../../domain/taskFlags.js';
import { icon } from '../../utils/icons.js';

export function buildDeliveryFlagsHtml(task) {
    const buttons = TASK_FLAGS.map(flag => {
        const enabled = task[flag.field] === true;
        return `<button type="button" class="task-action-btn task-flag-btn" data-action="${flag.field}" data-id="${task.id}" aria-label="${flag.hint}" aria-pressed="${enabled}" title="${flag.hint}">${icon(flag.icon)}<span class="task-flag-state" aria-hidden="true">${enabled ? icon('check') : '−'}</span></button>`;
    }).join('');
    return `<div class="task-delivery-flags" role="group" aria-label="ДЕМО и релиз">${buttons}</div>`;
}

export function buildDeliveryFlagsPrintHtml(task) {
    return `<div class="task-flags-print">${TASK_FLAGS.map(flag => `<span>${flag.label}: <strong>${task[flag.field] === true ? 'да' : 'нет'}</strong></span>`).join(' ')}</div>`;
}

export function syncTaskFilterControls(filter = {}, doc = document) {
    const controls = { taskSearchInput: 'search', taskTypeFilter: 'type', taskDemoFilter: 'demo', taskReleaseFilter: 'release' };
    for (const [id, field] of Object.entries(controls)) {
        const control = doc.getElementById(id);
        const value = filter[field] || '';
        if (control && control.value !== value) control.value = value;
    }
}
