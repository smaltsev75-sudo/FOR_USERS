// js/ui/taskList/overloadIndicators.js

import { calculateAvailability } from '../../domain/role.js';
import { formatUiPercent } from '../../utils/percent.js';

export function createOverloadIndicatorModel(state, nfs) {
    const config = state.config;
    const roles = state.roles;
    const tasks = state.tasks;

    const availMap = {};
    roles.forEach(r => availMap[r.id] = calculateAvailability(r, config).useful);

    // Precompute cumulative effort per role in O(n) — keyed by task id
    const cumByRole = {}; // { roleId: Map<taskId, cumulativeSum> }
    roles.forEach(role => {
        const cumMap = new Map();
        let running = 0;
        for (const t of tasks) {
            if (t.excluded) continue;
            running += (t.est[role.id] || 0);
            cumMap.set(t.id, running);
        }
        cumByRole[role.id] = cumMap;
    });

    return {
        config,
        roles,
        tasks,
        tasksById: new Map(tasks.map(task => [String(task.id), task])),
        availMap,
        cumByRole,
        nfs
    };
}

export function updateOverloadIndicators(state, nfs, {
    model = null,
    root = document,
    taskIds = null
} = {}) {
    const indicatorModel = model || createOverloadIndicatorModel(state, nfs);
    const tasks = Array.isArray(taskIds)
        ? taskIds.map(id => indicatorModel.tasksById.get(String(id))).filter(Boolean)
        : indicatorModel.tasks;
    applyOverloadIndicators(indicatorModel, tasks, root);
}

function applyOverloadIndicators(model, tasks, root) {
    const { roles, config, availMap, cumByRole, nfs } = model;
    tasks.forEach(task => {
        const taskEl = root.querySelector(`.task-item[data-id="${task.id}"]`);
        if (!taskEl) return;
        if (task.excluded) {
            roles.forEach(role => {
                const container = taskEl.querySelector(`.overload-placeholder[data-role="${role.id}"]`);
                if (container) container.innerHTML = '<div class="overload-placeholder-spacer"></div>';
            });
            return;
        }
        roles.forEach(role => {
            const container = taskEl.querySelector(`.overload-placeholder[data-role="${role.id}"]`);
            if (!container) return;
            const cumulativeTotal = cumByRole[role.id].get(task.id);
            if (cumulativeTotal === undefined) return;
            const cap = availMap[role.id];
            const diff = cumulativeTotal - cap;
            const pctOverload = cap > 0 ? (diff / cap * 100) : 0;
            if (cap > 0 && diff > 0 && pctOverload > config.alert) {
                const pct = (cumulativeTotal / cap * 100) - 100;
                container.innerHTML = `<div class="overload-tag" title="Перегрузка: +${nfs.formatNumber(diff)} ч (+${formatUiPercent(pctOverload)}%)">+${nfs.formatNumber(diff)} <span class="overload-percent">+${formatUiPercent(pct)}%</span></div>`;
            } else {
                container.innerHTML = '<div class="overload-placeholder-spacer"></div>';
            }
        });
    });
}
