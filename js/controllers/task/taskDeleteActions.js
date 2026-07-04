import { messageService } from '../../services/message.js';
import { showSnackbar } from '../../ui/snackbar.js';
import { restoreDeletedTask, restoreDeletedTasks } from './undoDeleteService.js';

export function handleDeleteTaskAction({
    taskId,
    store,
    cache,
    getSelectedTaskId,
    setSelectedTaskId,
    resortByPriority,
    documentRef = document,
    show = showSnackbar,
    schedule = setTimeout,
    cancelSchedule = clearTimeout
}) {
    const state = store.getState();
    const taskIndex = state.tasks.findIndex(task => task.id === taskId);
    if (taskIndex === -1) return false;
    const deletedTask = { ...state.tasks[taskIndex] };
    const originalIndex = taskIndex;

    let pendingTimer = null;
    let applied = false;

    const applyDelete = () => {
        if (applied) return;
        applied = true;
        store.deleteTask(taskId);
        if (getSelectedTaskId() === taskId) setSelectedTaskId(null);
        cache.invalidate();
        resortByPriority();
    };

    const taskElement = documentRef.querySelector(`.task-item[data-id="${taskId}"]`);
    if (taskElement) {
        taskElement.classList.add('removing');
        pendingTimer = schedule(() => {
            pendingTimer = null;
            applyDelete();
        }, 300);
    } else {
        applyDelete();
    }

    show(`Задача «${deletedTask.title}» удалена`, {
        onUndo: () => {
            if (pendingTimer !== null) {
                cancelSchedule(pendingTimer);
                pendingTimer = null;
                applied = true;
            }
            if (taskElement && taskElement.isConnected) {
                taskElement.classList.remove('removing');
            }
            const currentTasks = store.getState().tasks;
            const restored = restoreDeletedTask(currentTasks, deletedTask, originalIndex);
            if (restored) store.setTasks(restored);
            cache.invalidate();
            resortByPriority();
        }
    });

    return true;
}

export function handleDeleteAllTasksAction({
    store,
    cache,
    setSelectedTaskId,
    resortByPriority,
    confirm = (...args) => messageService.showConfirm(...args),
    show = showSnackbar
}) {
    confirm('Удалить все задачи?', () => {
        const deletedTasks = [...store.getState().tasks];
        if (deletedTasks.length === 0) return;

        store.setTasks([]);
        setSelectedTaskId(null);
        cache.invalidate();

        show(`Удалено ${deletedTasks.length} задач`, {
            onUndo: () => {
                const currentTasks = store.getState().tasks;
                store.setTasks(restoreDeletedTasks(currentTasks, deletedTasks));
                cache.invalidate();
                resortByPriority();
            }
        });
    });
}
