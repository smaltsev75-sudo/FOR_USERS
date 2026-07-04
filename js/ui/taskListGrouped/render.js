// js/ui/taskListGrouped/render.js
// DOM orchestration for Quadrants view.

import { QUADRANT_KEYS_WITH_EXCLUDED } from '../../domain/selection/quadrants.js';
import { resolveDensity, updateOverloadIndicators } from '../taskList.js';
import { createQuadrantGroupSection } from './groupSection.js';
import { buildGroupedTaskModel, getTasksForQuadrant } from './model.js';

export function renderGroupedTasks(state, nfs, taskController = null) {
    const taskListEl = document.getElementById('taskList');
    if (!taskListEl) return;
    taskListEl.replaceChildren();
    taskListEl.dataset.density = resolveDensity(state.ui);

    const model = buildGroupedTaskModel(state, taskController);
    if (model.filteredTasks.length === 0) {
        taskListEl.appendChild(createGroupedEmptyState(state));
        return;
    }

    const fragment = document.createDocumentFragment();
    QUADRANT_KEYS_WITH_EXCLUDED.forEach((quadrantKey) => {
        const section = createQuadrantGroupSection({
            quadrantKey,
            tasksInGroup: getTasksForQuadrant(model, quadrantKey),
            model,
            nfs,
            taskController
        });
        if (section) fragment.appendChild(section);
    });

    taskListEl.appendChild(fragment);
    updateOverloadIndicators(state, nfs);
}

function createGroupedEmptyState(state) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'task-list-empty';
    emptyMessage.textContent = (state.taskFilter?.search || state.taskFilter?.type)
        ? 'Нет задач, соответствующих поиску/фильтру'
        : 'В спринте нет задач. Добавьте первую задачу';
    return emptyMessage;
}
