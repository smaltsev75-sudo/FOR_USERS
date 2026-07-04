// js/controllers/task/taskFormController.js

import { TaskFormDomAdapter } from './taskForm/taskFormDomAdapter.js';
import { calculateDraftPriorityScore } from './taskForm/taskFormDraft.js';
import {
    closeTaskFormCreateModal,
    closeTaskFormEditModal,
    openTaskFormCreateModal,
    openTaskFormEditModal
} from './taskForm/taskFormModalActions.js';
import {
    handleTaskFormAddSubmit,
    handleTaskFormEditSubmit
} from './taskForm/taskFormSubmitActions.js';
import {
    validateTaskFormField,
    validateTaskJiraField,
    validateTaskTitleField
} from './taskForm/taskFormValidation.js';

/**
 * Handles create/edit modal logic for tasks.
 * Extracted from TaskController to keep it focused on orchestration.
 */
export class TaskFormController {
    /**
     * @param {import('../../state/store.js').Store} store
     * @param {Object} nfs - NumberFormatService instance
     * @param {Function} onTaskCreated - callback(newTask) called after successful creation
     * @param {Function} onTaskEdited - callback(taskId, updates) called after successful edit
     * @param {Function} invalidateCaches - callback to invalidate parent caches
     */
    constructor(store, nfs, onTaskCreated, onTaskEdited, invalidateCaches) {
        this.store = store;
        this.nfs = nfs;
        this.editId = null;
        this._onTaskCreated = onTaskCreated;
        this._onTaskEdited = onTaskEdited;
        this._invalidateCaches = invalidateCaches;
        this.form = new TaskFormDomAdapter(nfs);
    }

    // ── Create modal ──────────────────────────────────────────────────────────

    openCreateModal() {
        openTaskFormCreateModal({
            form: this.form,
            clearAddForm: this.clearAddForm.bind(this),
            populateCreateCriteriaSelects: this.populateCreateCriteriaSelects.bind(this),
            wireSegmentedType: this._wireSegmentedType.bind(this),
            setModalMode: this._setModalMode.bind(this),
            setEditId: (editId) => { this.editId = editId; }
        });
    }

    /**
     * Переключает заголовок и primary-кнопку между create и edit.
     * Текст режимов хранится в config/taskFormCopy.js.
     * @private
     */
    _setModalMode(_modal, mode) {
        this.form.setModalMode(mode);
    }

    /**
     * Idempotent: устанавливает делегированный click-listener на segmented
     * control «Тип задачи». Кнопки обновляют скрытый <input id="newType">,
     * чтобы существующий контракт чтения через getElementById('newType').value
     * сохранился (его читают и тесты, и handleAddTask).
     * @private
     */
    _wireSegmentedType(_modal) {
        this.form.wireSegmentedType();
    }

    _setTypeSegment(_seg, type) {
        this.form.setTypeSegment(type);
    }

    closeCreateModal() {
        closeTaskFormCreateModal({});
    }

    populateCreateCriteriaSelects() {
        this.form.populateCriteriaSelects(this.store.getState().criteria || []);
    }

    /** Passthrough к адаптеру: установить значение шкалы критерия (1-клик/клавиатура). */
    setCriteriaScaleValue(criterionId, value, opts) {
        this.form.setCriteriaScaleValue(criterionId, value, opts);
    }

    updateCreateFormPriorityScore() {
        const criteria = this.store.getState().criteria;
        if (!criteria || criteria.length === 0) return;
        const draft = this.form.readDraft(criteria);
        this.form.updatePriorityHeader(calculateDraftPriorityScore(criteria, draft.criteriaEvaluations));
    }

    clearAddForm() {
        this.form.clear(this.store.getState().criteria || []);
        this.updateCreateFormPriorityScore();
    }

    handleAddTask() {
        return handleTaskFormAddSubmit({
            store: this.store,
            form: this.form,
            validateTitleField: this._validateTitleField.bind(this),
            validateJiraField: this._validateJiraField.bind(this),
            clearAddForm: this.clearAddForm.bind(this),
            invalidateCaches: this._invalidateCaches,
            onTaskCreated: this._onTaskCreated
        });
    }

    /**
     * Generic field validator.
     * @param {string} elementId - DOM element id
     * @param {Function} validateFn - (value) => { valid: boolean, message: string }
     * @param {Function} uniqueFn - (tasks, value, excludeId?) => boolean
     * @param {string} uniqueErrorMsg - message shown when uniqueness check fails
     * @param {number|null} [excludeId=null] - task id to exclude from uniqueness check
     * @returns {string|null} trimmed value or null on failure
     */
    _validateField(elementId, validateFn, uniqueFn, uniqueErrorMsg, excludeId = null) {
        return validateTaskFormField({
            store: this.store,
            elementId,
            validateFn,
            uniqueFn,
            uniqueErrorMsg,
            excludeId
        });
    }

    /**
     * Validates the title field. v8.27: edit-mode также читает из newTitle —
     * единая форма, поле одно физически. Mode сохранён для совместимости
     * сигнатуры с прежним API.
     * @param {'create'|'edit'} [_mode='create']
     * @param {number|null} [excludeId=null] - task id to exclude from uniqueness check
     * @returns {string|null}
     */
    _validateTitleField(_mode = 'create', excludeId = null) {
        return validateTaskTitleField({
            store: this.store,
            excludeId
        });
    }

    /**
     * Validates the Jira URL field. См. _validateTitleField — единый ID.
     * @param {'create'|'edit'} [_mode='create']
     * @param {number|null} [excludeId=null] - task id to exclude from uniqueness check
     * @returns {string|null}
     */
    _validateJiraField(_mode = 'create', excludeId = null) {
        return validateTaskJiraField({
            store: this.store,
            excludeId
        });
    }

    // ── Edit modal ────────────────────────────────────────────────────────────

    openEditModal(taskId) {
        openTaskFormEditModal({
            taskId,
            store: this.store,
            form: this.form,
            clearAddForm: this.clearAddForm.bind(this),
            populateCreateCriteriaSelects: this.populateCreateCriteriaSelects.bind(this),
            wireSegmentedType: this._wireSegmentedType.bind(this),
            updateCreateFormPriorityScore: this.updateCreateFormPriorityScore.bind(this),
            setModalMode: this._setModalMode.bind(this),
            setEditId: (editId) => { this.editId = editId; }
        });
    }

    /**
     * Обновляет character counter под textarea: текст «Осталось: N» +
     * прогресс-бар, цвет которого плавно переходит зелёный → жёлтый →
     * красный по мере приближения к лимиту.
     * Единая форма create+edit использует один textarea newComment и один
     * counter pair: newCommentCounter / newCommentCounterBar.
     * @param {number} used - текущая длина текста
     * @param {number} max - максимум (255)
     */
    updateCommentCounter(used, max) {
        this.form.updateCommentCounter(used, max);
    }

    closeEditModal() {
        closeTaskFormEditModal({
            setEditId: (editId) => { this.editId = editId; },
            setModalMode: this._setModalMode.bind(this)
        });
    }

    handleSaveEdit() {
        return handleTaskFormEditSubmit({
            editId: this.editId,
            store: this.store,
            form: this.form,
            validateTitleField: this._validateTitleField.bind(this),
            validateJiraField: this._validateJiraField.bind(this),
            closeEditModal: this.closeEditModal.bind(this),
            invalidateCaches: this._invalidateCaches,
            onTaskEdited: this._onTaskEdited
        });
    }
}
