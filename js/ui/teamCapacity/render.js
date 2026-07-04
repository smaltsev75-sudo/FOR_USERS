import {
    calculateTeamLoad,
    getRoleLoadLevel,
    simulateLoadDelta
} from '../../domain/role.js';
import { createTeamCapacityCardsGrid } from './card.js';
import { createTeamCapacityHeader } from './header.js';

/**
 * @param {Object} state
 * @param {{formatNumber: Function}} nfs
 * @param {{previewTask?: Object|null, previewMode?: 'add'|'remove'}} [opts]
 */
export function renderTeamCapacity(state, nfs, opts = {}) {
    const root = document.getElementById('capacityStrip');
    if (!root) return;

    const config = state.config || {};
    const alert = typeof config.alert === 'number' ? config.alert : 3;
    const previewTask = opts.previewTask || null;
    const previewMode = opts.previewMode || 'add';

    const sim = simulateLoadDelta({
        roles: state.roles,
        tasks: state.tasks,
        config,
        mode: previewMode,
        task: previewTask
    });

    root.classList.add('team-cap');

    const fragment = document.createDocumentFragment();
    const total = calculateTeamLoad(state.roles, state.tasks, config);
    const totalLevel = getRoleLoadLevel(total.percentage, alert);

    fragment.appendChild(createTeamCapacityHeader(total, totalLevel, nfs));
    fragment.appendChild(createTeamCapacityCardsGrid(state.roles, sim.byRole, { nfs, previewTask, alert }));

    const focusInfo = captureCapacityInputFocus(root);
    root.replaceChildren();
    root.appendChild(fragment);
    restoreCapacityInputFocus(root, focusInfo);
}

function captureCapacityInputFocus(root) {
    const active = document.activeElement;
    if (!(active && root.contains(active) && active.tagName === 'INPUT'
        && active.dataset.role && active.dataset.field)) {
        return null;
    }

    return {
        role: active.dataset.role,
        field: active.dataset.field,
        selectionStart: active.selectionStart,
        selectionEnd: active.selectionEnd
    };
}

function restoreCapacityInputFocus(root, focusInfo) {
    if (!focusInfo) return;

    const restored = root.querySelector(
        `input[data-role="${focusInfo.role}"][data-field="${focusInfo.field}"]`
    );
    if (!restored) return;

    restored.focus();
    const len = restored.value.length;
    const start = Number.isInteger(focusInfo.selectionStart)
        ? Math.min(focusInfo.selectionStart, len) : len;
    const end = Number.isInteger(focusInfo.selectionEnd)
        ? Math.min(focusInfo.selectionEnd, len) : len;
    try {
        restored.setSelectionRange(start, end);
    } catch (_) {
        // some input types do not support selection range
    }
}
