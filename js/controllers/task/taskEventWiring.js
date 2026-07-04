import { hideModal } from '../../ui/modalManager.js';
import {
    isInteractiveTaskTarget,
    isPrimaryTaskFormShortcut,
    readTaskListButtonAction,
    submitTaskFormAction
} from './taskFlowActions.js';

// DOM wiring only. Task behavior/state remains owned by TaskController and its
// task subcontrollers; listener registration order mirrors the former methods.
export function wireTaskControllerEvents(controller, { doc = document } = {}) {
    wireFormButtons(controller, doc);
    wireCreateCriteriaDelegation(controller, doc);
    wireListActions(controller, doc);
    wireTaskListDelegation(controller, doc);
    wireNoteModalAndDrag(controller, doc);
    wireGlobalDeselect(controller, doc);
    wireCommentAndShortcuts(controller, doc);
    wireFilters(controller, doc);
}

function byId(doc, id) {
    return doc.getElementById(id);
}

function wireFormButtons(controller, doc) {
    const addBtn = byId(doc, 'addTaskBtn');
    if (addBtn) addBtn.addEventListener('click', () => controller._form.openCreateModal());

    // v8.27: единый task-form modal — close/cancel/save диспатчат
    // по controller._form.editId (если != null → edit, иначе → create).
    const closeCreateBtn = byId(doc, 'closeCreateModalBtn');
    if (closeCreateBtn) closeCreateBtn.addEventListener('click', () => {
        if (controller._form.editId !== null) controller._form.closeEditModal();
        else controller._form.closeCreateModal();
    });

    const cancelCreateBtn = byId(doc, 'cancelCreateBtn');
    if (cancelCreateBtn) cancelCreateBtn.addEventListener('click', () => {
        if (controller._form.editId !== null) controller._form.closeEditModal();
        else controller._form.closeCreateModal();
    });

    const saveCreateBtn = byId(doc, 'saveCreateBtn');
    if (saveCreateBtn) {
        saveCreateBtn.addEventListener('click', () => {
            submitTaskFormAction(controller._form);
        });
    }
}

function wireCreateCriteriaDelegation(controller, doc) {
    const criteriaContainer = byId(doc, 'createCriteriaContainer');
    if (!criteriaContainer) return;

    criteriaContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('criteria-score-select')) {
            controller._form.updateCreateFormPriorityScore();
        }
    });

    criteriaContainer.addEventListener('click', (e) => {
        const tick = e.target.closest('.cf-scale__tick');
        if (!tick) return;
        const scale = tick.closest('.cf-scale');
        if (!scale) return;
        controller._form.setCriteriaScaleValue(scale.dataset.criterionId, Number(tick.dataset.value), { dispatch: true });
    });

    criteriaContainer.addEventListener('keydown', (e) => {
        const scale = e.target.closest && e.target.closest('.cf-scale');
        if (!scale) return;
        const cur = Number(scale.getAttribute('aria-valuenow')) || 0;
        let next;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = cur + 1;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = cur - 1;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = 10;
        else return;
        e.preventDefault();
        controller._form.setCriteriaScaleValue(scale.dataset.criterionId, next, { dispatch: true });
    });
}

function wireListActions(controller, doc) {
    const sortBtn = byId(doc, 'sortByPriorityBtn');
    if (sortBtn) sortBtn.addEventListener('click', () => controller.handleSortByPriority());

    const deleteAllBtn = byId(doc, 'deleteAllTasksBtn');
    if (deleteAllBtn) deleteAllBtn.addEventListener('click', () => controller.handleDeleteAll());
}

function wireTaskListDelegation(controller, doc) {
    const taskList = byId(doc, 'taskList');
    if (!taskList) return;

    taskList.addEventListener('click', (e) => {
        const taskItem = e.target.closest('.task-item');
        if (!taskItem) return;
        if (isInteractiveTaskTarget(e.target)) return;
        controller.selectTask(Number(taskItem.dataset.id));
    });

    taskList.addEventListener('focusin', (e) => {
        const taskItem = e.target.closest('.task-item');
        if (!taskItem) return;
        // Не вызываем selectTask при фокусе на интерактивных элементах,
        // чтобы scrollIntoView не сдвигал кнопку из-под курсора.
        if (isInteractiveTaskTarget(e.target)) return;
        controller.selectTask(Number(taskItem.dataset.id));
    });

    taskList.addEventListener('change', (e) => {
        if (e.target.dataset.action === 'updateEst') controller.handleUpdateEst(e);
        if (e.target.classList?.contains('criteria-score-input')
            || e.target.classList?.contains('criteria-score-select')) {
            controller.handleCriteriaScoreChange(e);
        }
    });

    // v8.30.24: live cap для inline est inputs через делегацию `input`.
    taskList.addEventListener('input', (e) => {
        if (e.target.dataset.action === 'updateEst') {
            controller.nfs.handleInput(e.target);
        }
    });

    taskList.addEventListener('click', (e) => {
        const buttonAction = readTaskListButtonAction(e.target);
        if (!buttonAction) return;
        const { action, id } = buttonAction;
        if (action === 'edit') controller._form.openEditModal(id);
        else if (action === 'moveUp') controller.handleMoveTask(id, 'up');
        else if (action === 'moveDown') controller.handleMoveTask(id, 'down');
        else if (action === 'toggleExclude') controller.handleToggleExclude(id);
        else if (action === 'delete') controller.handleDeleteTask(id);
        else if (action === 'openNote') controller.handleOpenNote(id);
    });
}

function wireNoteModalAndDrag(controller, doc) {
    const saveNoteBtn = byId(doc, 'saveNoteBtn');
    if (saveNoteBtn) saveNoteBtn.addEventListener('click', () => controller._saveNote());
    const closeNote = () => {
        const modal = byId(doc, 'noteModal');
        if (modal) hideModal(modal);
    };
    byId(doc, 'cancelNoteBtn')?.addEventListener('click', closeNote);
    byId(doc, 'closeNoteModalBtn')?.addEventListener('click', closeNote);
    byId(doc, 'noteModalInput')?.addEventListener('input', () => controller._updateNoteCounter());
    const taskList = byId(doc, 'taskList');
    if (taskList) {
        controller._drag.attachTo(taskList);
    }
}

function wireGlobalDeselect(controller, doc) {
    doc.addEventListener('click', (e) => {
        if (!controller.selectedTaskId) return;
        if (e.target.closest('.task-item')) return;
        controller.deselectTask();
    });
}

function wireCommentAndShortcuts(controller, doc) {
    const newCommentEl = byId(doc, 'newComment');
    if (newCommentEl) {
        newCommentEl.addEventListener('input', (e) => {
            controller._form.updateCommentCounter(e.target.value.length, 255);
        });
    }

    const taskFormModal = byId(doc, 'createTaskModal');
    if (taskFormModal) {
        taskFormModal.addEventListener('keydown', (e) => {
            if (isPrimaryTaskFormShortcut(e)) {
                e.preventDefault();
                submitTaskFormAction(controller._form);
            }
        });
    }
}

function wireFilters(controller, doc) {
    const searchInput = byId(doc, 'taskSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            controller.store.setTaskFilter({ search: searchInput.value });
        });
    }

    const typeFilter = byId(doc, 'taskTypeFilter');
    if (typeFilter) {
        typeFilter.addEventListener('change', () => {
            controller.store.setTaskFilter({ type: typeFilter.value });
        });
    }
}
