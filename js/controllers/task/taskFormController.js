// js/controllers/task/taskFormController.js

import { messageService } from '../../services/message.js';
import {
    validateTitle,
    validateJiraUrl,
    isTitleUnique,
    isJiraUrlUnique
} from '../../domain/validation.js';
import { createTask } from '../../domain/task.js';
import {
    calculateCreateFormTotal,
    collectCriteriaEvaluations,
    readCreateTaskEstimates
} from './formHelpers.js';
import { showModal, hideModal } from '../../ui/modalManager.js';
import { ROLES } from '../../utils/constants.js';

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
    }

    // ── Create modal ──────────────────────────────────────────────────────────

    openCreateModal() {
        const modal = document.getElementById('createTaskModal');
        if (modal) {
            this.clearAddForm();
            this.populateCreateCriteriaSelects();
            showModal(modal);
            const firstInput = modal.querySelector('input:not([type="hidden"]), select');
            if (firstInput) {
                firstInput.focus();
            }
        }
    }

    closeCreateModal() {
        const modal = document.getElementById('createTaskModal');
        if (modal) hideModal(modal);
    }

    populateCreateCriteriaSelects() {
        const container = document.getElementById('createCriteriaContainer');
        if (!container) return;
        const criteria = this.store.getState().criteria;
        if (!criteria || criteria.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:8px;">Нет критериев оценки</div>';
            return;
        }

        const n = criteria.length;
        let labelsHtml = '';
        let selectsHtml = '';

        criteria.forEach(c => {
            labelsHtml += `
                <div style="text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${c.name}">
                    <span style="font-size:0.7rem; color:var(--text); background-color:var(--bg-card); display:inline-block; padding:2px 6px; border-radius:4px; margin-right:4px; font-weight:700; border:1px solid var(--accent);">${c.weight}%</span>
                    ${c.abbreviation}
                </div>
            `;
            selectsHtml += `
                <div>
                    <select id="criteria_${c.id}" class="criteria-score-select" data-criterion-id="${c.id}" aria-label="${c.name} оценка" style="width:100%; min-width:50px; padding:4px 2px; background:var(--bg-main); border:1px solid var(--border); color:var(--text); border-radius:6px; font-size:0.7rem; text-align:left; box-sizing:border-box;">
                        ${Array.from({ length: 11 }, (_, i) => `<option value="${i}">${i}</option>`).join('')}
                    </select>
                </div>
            `;
        });

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(${n}, 1fr); gap: 8px;">
                ${labelsHtml}
            </div>
            <div style="display: grid; grid-template-columns: repeat(${n}, 1fr); gap: 8px; margin-top: 4px;">
                ${selectsHtml}
            </div>
        `;
    }

    updateCreateFormPriorityScore() {
        const criteria = this.store.getState().criteria;
        if (!criteria || criteria.length === 0) return;
        let totalScore = 0;
        const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
        criteria.forEach(c => {
            const select = document.getElementById(`criteria_${c.id}`);
            if (select) {
                const score = parseInt(select.value) || 0;
                totalScore += score * c.weight;
            }
        });
        const priorityScore = totalWeight > 0 ? totalScore / totalWeight : 0;
        const el = document.getElementById('createPriorityScoreHeader');
        if (el) {
            el.textContent = `Priority Score: ${this.nfs.formatNumber(priorityScore, 1)}`;
        }
    }

    updateCreateFormTotal() {
        const total = calculateCreateFormTotal(this.nfs);
        const headerEl = document.getElementById('createEffortHeader');
        if (headerEl) {
            headerEl.textContent = `Effort: ${this.nfs.formatNumber(total)}`;
        }
    }

    clearAddForm() {
        const ids = ['newTitle', 'newJira', 'newComment', ...ROLES.map(r => `h_${r.id}`)];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const typeEl = document.getElementById('newType');
        if (typeEl) typeEl.value = 'us';

        const criteria = this.store.getState().criteria;
        criteria.forEach(c => {
            const select = document.getElementById(`criteria_${c.id}`);
            if (select) select.value = '0';
        });
        this.updateCreateFormPriorityScore();
        this.updateCreateFormTotal();
    }

    handleAddTask() {
        const title = this._validateTitleField('create');
        if (!title) return false;

        const jira = this._validateJiraField('create');
        if (!jira) return false;

        const typeEl = document.getElementById('newType');
        const commentEl = document.getElementById('newComment');
        const type = typeEl ? typeEl.value : 'us';
        const comment = commentEl ? commentEl.value.trim() : '';
        const estimates = readCreateTaskEstimates(this.nfs);

        const newTask = createTask({ title, jira, type, comment, estimates });
        newTask.criteriaEvaluations = collectCriteriaEvaluations(this.store.getState().criteria);

        this.store.addTask(newTask);
        this.store.updateState({ lastAddedTaskId: newTask.id });
        this._invalidateCaches();
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
            console.warn(`[TaskFormController] Элемент #${elementId} не найден`);
            return null;
        }
        const value = el.value.trim();
        const result = validateFn(value);
        if (!result.valid) {
            el.classList.add('error');
            messageService.showMessage(result.message);
            return null;
        }
        if (!uniqueFn(this.store.getState().tasks, value, excludeId)) {
            el.classList.add('error');
            messageService.showMessage(uniqueErrorMsg);
            return null;
        }
        el.classList.remove('error');
        return value;
    }

    /**
     * Validates the title field.
     * @param {'create'|'edit'} [mode='create'] - which form is active
     * @param {number|null} [excludeId=null] - task id to exclude from uniqueness check
     * @returns {string|null}
     */
    _validateTitleField(mode = 'create', excludeId = null) {
        return this._validateField(
            mode === 'edit' ? 'editTitle' : 'newTitle',
            validateTitle,
            isTitleUnique,
            'Название должно быть уникальным',
            excludeId
        );
    }

    /**
     * Validates the Jira URL field.
     * @param {'create'|'edit'} [mode='create'] - which form is active
     * @param {number|null} [excludeId=null] - task id to exclude from uniqueness check
     * @returns {string|null}
     */
    _validateJiraField(mode = 'create', excludeId = null) {
        return this._validateField(
            mode === 'edit' ? 'editJira' : 'newJira',
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
        this.editId = taskId;
        document.getElementById('editTitle').value = task.title;
        document.getElementById('editJira').value = task.jira || '';
        document.getElementById('editType').value = task.type;
        document.getElementById('editComment').value = task.comment || '';
        document.getElementById('editCommentCounter').textContent = (task.comment ? task.comment.length : 0) + '/255';
        const modal = document.getElementById('editModal');
        showModal(modal);
        setTimeout(() => {
            const titleInput = document.getElementById('editTitle');
            if (titleInput) titleInput.focus();
        }, 50);
    }

    closeEditModal() {
        this.editId = null;
        const modal = document.getElementById('editModal');
        if (modal) hideModal(modal);
    }

    handleSaveEdit() {
        if (this.editId === null) return;
        const task = this.store.getState().tasks.find(t => t.id === this.editId);
        if (!task) return;

        const title = this._validateTitleField('edit', this.editId);
        if (!title) return;

        const jira = this._validateJiraField('edit', this.editId);
        if (!jira) return;

        const type = document.getElementById('editType').value;
        const comment = document.getElementById('editComment').value.trim();

        this.store.updateTask(this.editId, { title, jira, type, comment });
        this._invalidateCaches();
        this.closeEditModal();

        if (this._onTaskEdited) this._onTaskEdited(this.editId, { title, jira, type, comment });
    }
}
