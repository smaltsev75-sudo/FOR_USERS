// js/ui/taskList/viewState.js

const VALID_DENSITIES = ['compact', 'comfortable'];
import { TASK_FLAGS } from '../../domain/taskFlags.js';

export function filterTasks(tasks, taskFilter) {
    let filtered = [...tasks];
    const searchTerm = (taskFilter?.search || '').toLowerCase().trim();
    if (searchTerm) {
        filtered = filtered.filter(task =>
            task.title.toLowerCase().includes(searchTerm)
        );
    }
    const typeFilter = taskFilter?.type || '';
    if (typeFilter) {
        filtered = filtered.filter(task => task.type === typeFilter);
    }
    for (const flag of TASK_FLAGS) {
        const value = taskFilter?.[flag.filter];
        if (value === 'yes' || value === 'no') {
            filtered = filtered.filter(task => (task[flag.field] === true) === (value === 'yes'));
        }
    }
    return filtered;
}

export function resolveDensity(uiState) {
    const value = uiState && uiState.density;
    return VALID_DENSITIES.includes(value) ? value : 'comfortable';
}
