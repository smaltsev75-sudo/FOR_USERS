// js/ui/taskListGrouped/groupSection.js
// DOM section builder for one quadrant group.

import { calculateTaskTotal } from '../../domain/task.js';
import { getQuadrantLabel, getQuadrantDescription } from '../../domain/selection/quadrants.js';
import { ICONS } from '../../utils/icons.js';
import { createTaskElement } from '../taskList.js';
import { formatGroupSummary } from './summary.js';

const QUADRANT_ICON_NAMES = {
    q1: 'quadrant1',
    q2: 'quadrant2',
    q3: 'quadrant3',
    q4: 'quadrant4',
    excluded: 'eyeOff'
};

export function createQuadrantGroupSection({
    quadrantKey,
    tasksInGroup,
    model,
    nfs,
    taskController
}) {
    if (quadrantKey === 'excluded' && tasksInGroup.length === 0) return null;

    const groupEffort = tasksInGroup.reduce(
        (sum, task) => sum + calculateTaskTotal(task.rawTask, model.roles),
        0
    );
    const groupCapacityPct = model.totalCapacity > 0
        ? (groupEffort / model.totalCapacity) * 100
        : 0;

    const detailsEl = document.createElement('details');
    detailsEl.className = 'quadrant-group';
    if (quadrantKey === 'excluded') {
        detailsEl.classList.add('quadrant-group--excluded');
    }
    if (tasksInGroup.length === 0) {
        detailsEl.classList.add('quadrant-group--empty');
    }
    detailsEl.dataset.quadrant = quadrantKey;
    detailsEl.open = model.expandedSet.has(quadrantKey);

    detailsEl.appendChild(createQuadrantGroupHeader({
        quadrantKey,
        count: tasksInGroup.length,
        groupEffort,
        groupCapacityPct,
        nfs
    }));
    detailsEl.appendChild(createQuadrantGroupBody({
        tasksInGroup,
        model,
        nfs,
        taskController
    }));

    return detailsEl;
}

function createQuadrantGroupHeader({ quadrantKey, count, groupEffort, groupCapacityPct, nfs }) {
    const summaryEl = document.createElement('summary');
    summaryEl.className = 'quadrant-group-header';

    const iconWrap = document.createElement('span');
    iconWrap.className = 'quadrant-group-icon';
    iconWrap.setAttribute('aria-hidden', 'true');
    iconWrap.innerHTML = ICONS[QUADRANT_ICON_NAMES[quadrantKey]] || '';

    const titleEl = document.createElement('span');
    titleEl.className = 'quadrant-group-title';
    titleEl.textContent = getQuadrantLabel(quadrantKey);
    titleEl.title = getQuadrantDescription(quadrantKey);

    const summaryStats = document.createElement('span');
    summaryStats.className = 'quadrant-group-summary';
    summaryStats.innerHTML = formatGroupSummary(count, groupEffort, groupCapacityPct, nfs);

    summaryEl.appendChild(iconWrap);
    summaryEl.appendChild(titleEl);
    summaryEl.appendChild(summaryStats);
    return summaryEl;
}

function createQuadrantGroupBody({ tasksInGroup, model, nfs, taskController }) {
    const groupBody = document.createElement('div');
    groupBody.className = 'quadrant-group-body';
    tasksInGroup.forEach((groupedTask) => {
        const rawTask = groupedTask.rawTask;
        const taskEvaluations = rawTask.criteriaEvaluations || {};
        const taskTotal = calculateTaskTotal(rawTask, model.roles);
        const priorityScore = groupedTask.priorityScore;
        const globalIndex = model.orderById.get(rawTask.id) ?? 0;
        const card = createTaskElement(
            rawTask,
            taskEvaluations,
            globalIndex,
            model.roles,
            model.criteria,
            model.config,
            nfs,
            taskTotal,
            priorityScore,
            model.availMap,
            taskController,
            model.filteredTasks.length
        );
        groupBody.appendChild(card);
    });
    return groupBody;
}
