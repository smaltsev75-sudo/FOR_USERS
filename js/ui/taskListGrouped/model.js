// js/ui/taskListGrouped/model.js
// Data preparation for Quadrants view rendering.

import { calculateAvailability } from '../../domain/role.js';
import { calculatePriorityScore } from '../../domain/criteria.js';
import { assignQuadrants, QUADRANT_KEYS_WITH_EXCLUDED } from '../../domain/selection/quadrants.js';
import { filterTasks } from '../taskList.js';

export function buildGroupedTaskModel(state, taskController = null) {
    const filteredTasks = filterTasks(state.tasks || [], state.taskFilter);
    const tasksWithScore = filteredTasks.map((task) => ({
        ...task,
        priorityScore: resolvePriorityScore(task, state.criteria, taskController)
    }));

    const grouped = assignQuadrants(tasksWithScore);
    const roles = state.roles || [];
    const criteria = state.criteria || [];
    const config = state.config || {};
    const availMap = {};
    roles.forEach((role) => {
        availMap[role.id] = calculateAvailability(role, config).useful;
    });

    const expandedSet = new Set(
        Array.isArray(state.ui?.expandedQuadrants)
            ? state.ui.expandedQuadrants
            : QUADRANT_KEYS_WITH_EXCLUDED
    );
    const totalCapacity = roles.reduce((sum, role) => sum + (availMap[role.id] || 0), 0);
    const orderById = new Map();
    filteredTasks.forEach((task, index) => orderById.set(task.id, index));

    return {
        filteredTasks,
        grouped,
        roles,
        criteria,
        config,
        availMap,
        expandedSet,
        totalCapacity,
        orderById
    };
}

export function getTasksForQuadrant(model, quadrantKey) {
    return [...(model.grouped[quadrantKey] || [])].sort(
        (a, b) => (model.orderById.get(a.id) ?? 0) - (model.orderById.get(b.id) ?? 0)
    );
}

function resolvePriorityScore(task, criteria, taskController) {
    const cached = taskController?.getCachedPriorityScore?.(task);
    if (typeof cached === 'number' && cached > 0) return cached;

    const hasCriteria = Array.isArray(criteria) && criteria.length > 0;
    const hasEvaluations = task.criteriaEvaluations && Object.keys(task.criteriaEvaluations).length > 0;
    if (hasCriteria && hasEvaluations) {
        return calculatePriorityScore(criteria, task.criteriaEvaluations);
    }
    return Number(task.priorityScore) || 0;
}
