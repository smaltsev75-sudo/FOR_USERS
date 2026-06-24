// js/controllers/task/taskFormController.js

import { messageService } from '../../services/message.js';
import {
    validateTitle,
    validateJiraUrl,
    isTitleUnique,
    isJiraUrlUnique
} from '../../domain/validation.js';
import { createTask } from '../../domain/task.js';
import { resortTasksByPriority } from './taskOrderingActions.js';
import { showModal, hideModal } from '../../ui/modalManager.js';
import { TaskFormDomAdapter } from './taskForm/taskFormDomAdapter.js';
import {
    calculateDraftPriorityScore,
    taskFormDraftToCreateTaskInput,
    taskFormDraftToTaskPatch,
    taskToTaskFormDraft
} from './taskForm/taskFormDraft.js';

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
        const modal = document.getElementById('createTaskModal');
        if (!modal) return;
        this.editId = null;
        this.clearAddForm();
        this.populateCreateCriteriaSelects();
        this._wireSegmentedType(modal);
        this._setModalMode(modal, 'create');
        showModal(modal);
        this.form.focusFirstInput();
    }

    /**
     * Переключает текст заголовка/primary-кнопки между create и edit.
     * Обе подписи лежат в data-create-text / data-edit-text атрибутах
     * самой кнопки и заголовка — JS только копирует нужный вариант
     * в textContent. Это держит копирайтинг рядом с разметкой.
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
        const modal = document.getElementById('createTaskModal');
        if (modal) hideModal(modal);
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
        const title = this._validateTitleField('create');
        if (!title) return false;

        const jira = this._validateJiraField('create');
        if (!jira) return false;

        const draft = this.form.readDraft(this.store.getState().criteria);
        const input = taskFormDraftToCreateTaskInput({ ...draft, title, jira });

        const newTask = createTask(input);
        newTask.criteriaEvaluations = draft.criteriaEvaluations;

        this.store.addTask(newTask);
        this.store.updateState({ lastAddedTaskId: newTask.id });
        this._invalidateCaches();
        // v2 auto-sort: новая задача занимает позицию по Priority Score.
        // Синхронно с addTask → rAF-батчинг даёт один кадр (нет мерцания).
        resortTasksByPriority(this.store);
        this.clearAddForm();

        if (this._onTaskCreated) this._onTaskCreated(newTask);

        setTimeout(() => {
            if (this.store.getState().lastAddedTaskId === newTask.id) {
                this.store.updateState({ lastAddedTaskId: null });
            }
        }, 5000);

        return true;
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
        const el = document.getElementById(elementId);
        if (!el) {
            const err = `[TaskFormController] DOM-инвариант нарушен: элемент #${elementId} отсутствует в форме`;
            // v8.30.13: в тестовом окружении (jest jsdom: process.env.NODE_ENV === 'test')
            // явно бросаем — иначе пропавший элемент даёт «кнопка не работает в тишине».
            // В production показываем пользователю снэкбар и пишем в console.error
            // (console.warn недостаточно: warn часто отфильтрован в реальных консолях).
            // globalThis.process — присутствует в Node/jsdom (test env), undefined в браузере.
            // Без `globalThis.` ESLint в browser-окружении ругается no-undef.
            if (globalThis.process?.env?.NODE_ENV === 'test') {
                throw new Error(err);
            }
            console.error(err);
            messageService.showMessage('Не удалось обработать форму: внутренняя ошибка интерфейса. Перезагрузите страницу (Ctrl+Shift+R).');
            return null;
        }
        const value = el.value.trim();
        const result = validateFn(value);
        // v8.30.31: aria-invalid выставляется/снимается вместе с .error class.
        // Без этого screen reader пользователь не получает звукового сигнала
        // об ошибке валидации — он видит ТОЛЬКО visual error class.
        if (!result.valid) {
            el.classList.add('error');
            el.setAttribute('aria-invalid', 'true');
            messageService.showMessage(result.message);
            return null;
        }
        if (!uniqueFn(this.store.getState().tasks, value, excludeId)) {
            el.classList.add('error');
            el.setAttribute('aria-invalid', 'true');
            messageService.showMessage(uniqueErrorMsg);
            return null;
        }
        el.classList.remove('error');
        el.removeAttribute('aria-invalid');
        return value;
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
        return this._validateField(
            'newTitle',
            validateTitle,
            isTitleUnique,
            'Название должно быть уникальным',
            excludeId
        );
    }

    /**
     * Validates the Jira URL field. См. _validateTitleField — единый ID.
     * @param {'create'|'edit'} [_mode='create']
     * @param {number|null} [excludeId=null] - task id to exclude from uniqueness check
     * @returns {string|null}
     */
    _validateJiraField(_mode = 'create', excludeId = null) {
        return this._validateField(
            'newJira',
            validateJiraUrl,
            isJiraUrlUnique,
            'URL должен быть уникальным',
            excludeId
        );
    }

    // ── Edit modal ────────────────────────────────────────────────────────────

    openEditModal(taskId) {
        const state = this.store.getState();
        const task = state.tasks.find(t => t.id === taskId);
        if (!task) return;
        const modal = document.getElementById('createTaskModal');
        if (!modal) return;

        this.editId = taskId;
        this.clearAddForm();              // resets all create-form fields + clears errors
        this.populateCreateCriteriaSelects();
        this._wireSegmentedType(modal);

        const criteria = state.criteria || [];
        this.form.writeDraft(taskToTaskFormDraft(task, criteria), criteria);

        // Refresh derived Priority Score header from new values
        this.updateCreateFormPriorityScore();

        this._setModalMode(modal, 'edit');
        showModal(modal);
        setTimeout(() => {
            const titleEl = document.getElementById('newTitle');
            if (titleEl) titleEl.focus();
        }, 50);
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
        this.editId = null;
        const modal = document.getElementById('createTaskModal');
        if (modal) {
            this._setModalMode(modal, 'create');
            hideModal(modal);
        }
    }

    handleSaveEdit() {
        if (this.editId === null) return;
        const task = this.store.getState().tasks.find(t => t.id === this.editId);
        if (!task) return;

        // Edit-mode reuses the create form fields (newTitle/newJira/etc).
        // Validators historically used 'edit' DOM IDs; we point them to the
        // create-form IDs by mapping mode → IDs in _validateField.
        const title = this._validateTitleField('edit', this.editId);
        if (!title) return;

        const jira = this._validateJiraField('edit', this.editId);
        if (!jira) return;

        const draft = this.form.readDraft(this.store.getState().criteria);
        const patch = taskFormDraftToTaskPatch({ ...draft, title, jira });

        // Effort не редактируется в модалке задачи: часы меняются inline в
        // карточке, поэтому patch намеренно не содержит est.
        this.store.updateTask(this.editId, patch);
        this._invalidateCaches();
        // v2 auto-sort: правка оценок критериев меняет score → пересортировка.
        resortTasksByPriority(this.store);
        const editedId = this.editId;
        this.closeEditModal();

        if (this._onTaskEdited) {
            this._onTaskEdited(editedId, patch);
        }
    }
}
