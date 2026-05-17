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
        if (!modal) return;
        this.editId = null;
        this.clearAddForm();
        this.populateCreateCriteriaSelects();
        this._wireSegmentedType(modal);
        this._wirePresetChips(modal);
        this._setModalMode(modal, 'create');
        showModal(modal);
        const firstInput = modal.querySelector('input:not([type="hidden"]), select');
        if (firstInput) {
            firstInput.focus();
        }
    }

    /**
     * Переключает текст заголовка/primary-кнопки между create и edit.
     * Обе подписи лежат в data-create-text / data-edit-text атрибутах
     * самой кнопки и заголовка — JS только копирует нужный вариант
     * в textContent. Это держит копирайтинг рядом с разметкой.
     * @private
     */
    _setModalMode(modal, mode) {
        const title = modal.querySelector('#createTaskModalTitle');
        const saveBtn = modal.querySelector('#saveCreateBtn');
        const attr = mode === 'edit' ? 'data-edit-text' : 'data-create-text';
        if (title && title.getAttribute(attr)) {
            title.textContent = title.getAttribute(attr);
        }
        if (saveBtn && saveBtn.getAttribute(attr)) {
            saveBtn.textContent = saveBtn.getAttribute(attr);
            // Обновляем title/aria-label под текущий режим
            if (mode === 'edit') {
                saveBtn.setAttribute('title', 'Сохранить — Ctrl+S');
                saveBtn.setAttribute('aria-label', 'Сохранить (горячая клавиша Ctrl+S)');
            } else {
                saveBtn.setAttribute('title', 'Создать задачу — Ctrl+Enter');
                saveBtn.setAttribute('aria-label', 'Создать задачу (горячая клавиша Ctrl+Enter)');
            }
        }
        modal.dataset.mode = mode;
    }

    /**
     * Idempotent: устанавливает делегированный click-listener на segmented
     * control «Тип задачи». Кнопки обновляют скрытый <input id="newType">,
     * чтобы существующий контракт чтения через getElementById('newType').value
     * сохранился (его читают и тесты, и handleAddTask).
     * @private
     */
    _wireSegmentedType(modal) {
        const seg = modal.querySelector('#newTypeSegmented');
        if (!seg || seg.dataset.wired === '1') return;
        seg.dataset.wired = '1';
        seg.addEventListener('click', (e) => {
            const btn = e.target.closest('.cf-seg-btn[data-type]');
            if (!btn || !seg.contains(btn)) return;
            this._setTypeSegment(seg, btn.dataset.type);
        });
        // Клавиатурная навигация: ←/→ перемещают активную кнопку.
        seg.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            const buttons = Array.from(seg.querySelectorAll('.cf-seg-btn[data-type]'));
            const current = buttons.findIndex(b => b.getAttribute('aria-checked') === 'true');
            const dir = e.key === 'ArrowRight' ? 1 : -1;
            const next = (current + dir + buttons.length) % buttons.length;
            this._setTypeSegment(seg, buttons[next].dataset.type);
            buttons[next].focus();
            e.preventDefault();
        });
    }

    _setTypeSegment(seg, type) {
        const buttons = seg.querySelectorAll('.cf-seg-btn[data-type]');
        buttons.forEach(b => {
            const active = b.dataset.type === type;
            b.setAttribute('aria-checked', active ? 'true' : 'false');
            b.dataset.active = active ? 'true' : 'false';
        });
        const hidden = document.getElementById('newType');
        if (hidden) hidden.value = type;
    }

    /**
     * Idempotent: вешает делегированные click-listeners на preset-чипы
     * в карточках ролей. Клик по «4» → input.value = «4», dispatch input
     * event, чтобы updateCreateFormTotal пересчитал Effort.
     * @private
     */
    _wirePresetChips(modal) {
        const roots = modal.querySelectorAll('.cf-role__presets[data-target]');
        roots.forEach(root => {
            if (root.dataset.wired === '1') return;
            root.dataset.wired = '1';
            root.addEventListener('click', (e) => {
                const chip = e.target.closest('.cf-preset[data-value]');
                if (!chip || !root.contains(chip)) return;
                const targetId = root.dataset.target;
                const input = document.getElementById(targetId);
                if (!input) return;
                input.value = chip.dataset.value;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.focus();
            });
        });
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
            // v8.30.2: inline-styles → .create-criteria-empty
            container.innerHTML = '<div class="create-criteria-empty">Нет критериев оценки</div>';
            return;
        }

        const n = criteria.length;
        let labelsHtml = '';
        let selectsHtml = '';

        // v8.30.2: inline-styles в labels/selects/grid → CSS-классы.
        // Grid columns задаются через CSS-property --n (динамическое значение,
        // оправдывает inline-style — единственный element с runtime value).
        criteria.forEach(c => {
            const safeName = String(c.name).replace(/"/g, '&quot;');
            labelsHtml += `
                <div class="create-criteria-label" title="${safeName}">
                    <span class="create-criteria-weight-badge">${c.weight}%</span>
                    ${c.abbreviation}
                </div>
            `;
            selectsHtml += `
                <div>
                    <select id="criteria_${c.id}" class="criteria-score-select" data-criterion-id="${c.id}" aria-label="${safeName} оценка">
                        ${Array.from({ length: 11 }, (_, i) => `<option value="${i}">${i}</option>`).join('')}
                    </select>
                </div>
            `;
        });

        container.innerHTML = `
            <div class="create-criteria-grid create-criteria-grid--labels" style="--n: ${n};">
                ${labelsHtml}
            </div>
            <div class="create-criteria-grid create-criteria-grid--selects" style="--n: ${n};">
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
            if (el) {
                el.value = '';
                el.classList.remove('error');
                el.removeAttribute('aria-invalid');
            }
        });
        const typeEl = document.getElementById('newType');
        if (typeEl) typeEl.value = 'us';
        // Sync visible segmented control with the reset hidden input value.
        const seg = document.getElementById('newTypeSegmented');
        if (seg) this._setTypeSegment(seg, 'us');

        const criteria = this.store.getState().criteria;
        criteria.forEach(c => {
            const select = document.getElementById(`criteria_${c.id}`);
            if (select) select.value = '0';
        });
        this.updateCreateFormPriorityScore();
        this.updateCreateFormTotal();
        this.updateCommentCounter(0, 255);
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
        this._wirePresetChips(modal);

        // Populate create-form fields from the task — reusing every input
        // means there's no field-by-field divergence to maintain.
        const titleEl = document.getElementById('newTitle');
        const jiraEl = document.getElementById('newJira');
        const typeEl = document.getElementById('newType');
        const commentEl = document.getElementById('newComment');
        if (titleEl) titleEl.value = task.title || '';
        if (jiraEl) jiraEl.value = task.jira || '';
        if (typeEl) typeEl.value = task.type || 'us';

        const seg = document.getElementById('newTypeSegmented');
        if (seg) this._setTypeSegment(seg, task.type || 'us');

        if (commentEl) commentEl.value = task.comment || '';
        this.updateCommentCounter((task.comment || '').length, 255);

        // Hours estimates → h_* inputs.
        // Domain хранит трудозатраты в task.est (см. js/domain/task.js:50).
        // Раньше читалось task.estimates — несоответствие появилось при v8.27
        // unified form refactor; поля оставались пусты при редактировании.
        const estimates = task.est || {};
        ROLES.forEach(role => {
            const input = document.getElementById(`h_${role.id}`);
            if (input) {
                const v = estimates[role.id];
                input.value = (v !== null && v !== undefined && v !== 0) ? this.nfs.formatNumber(v, 1) : '';
            }
        });

        // Criteria evaluations → criteria_${id} selects
        const criteria = state.criteria || [];
        const evals = task.criteriaEvaluations || {};
        criteria.forEach(c => {
            const select = document.getElementById(`criteria_${c.id}`);
            if (select) {
                const score = evals[c.id]?.score;
                select.value = String(Number.isFinite(score) ? score : 0);
            }
        });

        // Refresh derived headers (Priority Score / Effort) from new values
        this.updateCreateFormPriorityScore();
        this.updateCreateFormTotal();

        this._setModalMode(modal, 'edit');
        showModal(modal);
        setTimeout(() => {
            if (titleEl) titleEl.focus();
        }, 50);
    }

    /**
     * Обновляет character counter под textarea: текст «Осталось: N» +
     * прогресс-бар, цвет которого плавно переходит зелёный → жёлтый →
     * красный по мере приближения к лимиту.
     * v8.27: единая форма create+edit → counter навешен на newComment'е
     * (id newCommentCounter / newCommentCounterBar). Старый editCommentCounter
     * поддержан как fallback для тестовых mock'ов.
     * @param {number} used - текущая длина текста
     * @param {number} max - максимум (255)
     */
    updateCommentCounter(used, max) {
        const counterText = document.getElementById('newCommentCounter')
            || document.getElementById('editCommentCounter');
        const bar = document.getElementById('newCommentCounterBar')
            || document.getElementById('editCommentCounterBar');
        const remaining = Math.max(0, max - used);
        const pct = Math.min(100, Math.max(0, (used / max) * 100));
        if (counterText) counterText.textContent = `Осталось: ${remaining}`;
        if (bar) {
            bar.style.setProperty('--fill', `${pct.toFixed(1)}%`);
            // Цвет: зелёный <70% → жёлтый 70-90% → красный >90%
            let color = 'var(--success)';
            if (pct >= 90) color = 'var(--danger)';
            else if (pct >= 70) color = 'var(--warning)';
            bar.style.setProperty('--color', color);
        }
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

        const typeEl = document.getElementById('newType');
        const commentEl = document.getElementById('newComment');
        const type = typeEl ? typeEl.value : 'us';
        const comment = commentEl ? commentEl.value.trim() : '';
        const estimates = readCreateTaskEstimates(this.nfs);
        const criteriaEvaluations = collectCriteriaEvaluations(
            this.store.getState().criteria
        );

        this.store.updateTask(this.editId, {
            title, jira, type, comment, estimates, criteriaEvaluations
        });
        this._invalidateCaches();
        const editedId = this.editId;
        this.closeEditModal();

        if (this._onTaskEdited) {
            this._onTaskEdited(editedId, { title, jira, type, comment, estimates, criteriaEvaluations });
        }
    }
}
