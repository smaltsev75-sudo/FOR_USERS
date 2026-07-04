import { createTask } from '../../../domain/task.js';
import { resortTasksByPriority } from '../taskOrderingActions.js';
import {
    taskFormDraftToCreateTaskInput,
    taskFormDraftToTaskPatch
} from './taskFormDraft.js';

export function handleTaskFormAddSubmit({
    store,
    form,
    validateTitleField,
    validateJiraField,
    clearAddForm,
    invalidateCaches,
    onTaskCreated,
    schedule = setTimeout
}) {
    const title = validateTitleField('create');
    if (!title) return false;

    const jira = validateJiraField('create');
    if (!jira) return false;

    const draft = form.readDraft(store.getState().criteria);
    const input = taskFormDraftToCreateTaskInput({ ...draft, title, jira });

    const newTask = createTask(input);
    newTask.criteriaEvaluations = draft.criteriaEvaluations;

    store.addTask(newTask);
    store.updateState({ lastAddedTaskId: newTask.id });
    invalidateCaches();
    // v2 auto-sort: новая задача занимает позицию по Priority Score.
    // Синхронно с addTask → rAF-батчинг даёт один кадр (нет мерцания).
    resortTasksByPriority(store);
    clearAddForm();

    if (onTaskCreated) onTaskCreated(newTask);

    schedule(() => {
        if (store.getState().lastAddedTaskId === newTask.id) {
            store.updateState({ lastAddedTaskId: null });
        }
    }, 5000);

    return true;
}

export function handleTaskFormEditSubmit({
    editId,
    store,
    form,
    validateTitleField,
    validateJiraField,
    closeEditModal,
    invalidateCaches,
    onTaskEdited
}) {
    if (editId === null) return;
    const task = store.getState().tasks.find(item => item.id === editId);
    if (!task) return;

    const title = validateTitleField('edit', editId);
    if (!title) return;

    const jira = validateJiraField('edit', editId);
    if (!jira) return;

    const draft = form.readDraft(store.getState().criteria);
    const patch = taskFormDraftToTaskPatch({ ...draft, title, jira });

    // Effort не редактируется в модалке задачи: часы меняются inline в
    // карточке, поэтому patch намеренно не содержит est.
    store.updateTask(editId, patch);
    invalidateCaches();
    // v2 auto-sort: правка оценок критериев меняет score → пересортировка.
    resortTasksByPriority(store);
    closeEditModal();

    if (onTaskEdited) {
        onTaskEdited(editId, patch);
    }
}
