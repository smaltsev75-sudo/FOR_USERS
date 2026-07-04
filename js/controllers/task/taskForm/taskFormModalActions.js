import { showModal, hideModal } from '../../../ui/modalManager.js';
import { taskToTaskFormDraft } from './taskFormDraft.js';

export function openTaskFormCreateModal({
    documentRef = document,
    form,
    clearAddForm,
    populateCreateCriteriaSelects,
    wireSegmentedType,
    setModalMode,
    setEditId,
    show = showModal
}) {
    const modal = documentRef.getElementById('createTaskModal');
    if (!modal) return false;

    setEditId(null);
    clearAddForm();
    populateCreateCriteriaSelects();
    wireSegmentedType(modal);
    setModalMode(modal, 'create');
    show(modal);
    form.focusFirstInput();
    return true;
}

export function closeTaskFormCreateModal({
    documentRef = document,
    hide = hideModal
}) {
    const modal = documentRef.getElementById('createTaskModal');
    if (!modal) return false;
    hide(modal);
    return true;
}

export function openTaskFormEditModal({
    taskId,
    store,
    documentRef = document,
    form,
    clearAddForm,
    populateCreateCriteriaSelects,
    wireSegmentedType,
    updateCreateFormPriorityScore,
    setModalMode,
    setEditId,
    show = showModal,
    schedule = setTimeout
}) {
    const state = store.getState();
    const task = state.tasks.find(item => item.id === taskId);
    if (!task) return false;

    const modal = documentRef.getElementById('createTaskModal');
    if (!modal) return false;

    setEditId(taskId);
    clearAddForm();
    populateCreateCriteriaSelects();
    wireSegmentedType(modal);

    const criteria = state.criteria || [];
    form.writeDraft(taskToTaskFormDraft(task, criteria), criteria);

    updateCreateFormPriorityScore();

    setModalMode(modal, 'edit');
    show(modal);
    schedule(() => {
        const titleEl = documentRef.getElementById('newTitle');
        if (titleEl) titleEl.focus();
    }, 50);
    return true;
}

export function closeTaskFormEditModal({
    documentRef = document,
    setEditId,
    setModalMode,
    hide = hideModal
}) {
    setEditId(null);
    const modal = documentRef.getElementById('createTaskModal');
    if (!modal) return false;
    setModalMode(modal, 'create');
    hide(modal);
    return true;
}
