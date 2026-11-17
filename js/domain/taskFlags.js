export const TASK_FLAGS = Object.freeze([
    Object.freeze({ field: 'demoPlanned', filter: 'demo', label: 'ДЕМО', hint: 'Показ на ДЕМО', icon: 'presentation' }),
    Object.freeze({ field: 'releasePlanned', filter: 'release', label: 'Релиз', hint: 'Включить в поставку/релиз', icon: 'package' })
]);

export function buildTaskFlagUpdate(task, field) {
    if (!task || !TASK_FLAGS.some(flag => flag.field === field)) return null;
    return { [field]: task[field] !== true };
}

export function hasTaskFilters(filter = {}) {
    return Boolean(filter.search || filter.type || filter.demo || filter.release);
}

export function getIncludedTaskFlagCounts(tasks = []) {
    return tasks.reduce((counts, task) => {
        if (!task.excluded) {
            if (task.demoPlanned === true) counts.demo++;
            if (task.releasePlanned === true) counts.release++;
        }
        return counts;
    }, { demo: 0, release: 0 });
}
