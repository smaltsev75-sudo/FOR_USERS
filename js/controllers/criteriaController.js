// js/controllers/criteriaController.js
//
// v8.29 redesign:
//   - input event на .criteria-weight-input → instant sum-bar update (без commit)
//   - change event → commit в Store (фокус сохраняется снапшотом в render)
//   - click на «Авто-баланс» → CriteriaManager.autoBalance()
//   - click/keydown на .criteria-item-header → toggle expand/collapse (a11y)
//   - HTML5 DnD на .criteria-item через .criteria-item-grip → reorderCriteria
//   - SVG-иконки edit/delete (через делегирование data-action — без изменений)

import { messageService } from '../services/message.js';
import { CriteriaFormController } from './criteria/criteriaFormController.js';
import { updateSumBar } from '../ui/criteriaList.js';

export class CriteriaController {
    constructor(store, criteriaManager) {
        this.store = store;
        this.criteriaManager = criteriaManager;
        this._form = new CriteriaFormController(store, criteriaManager, null);

        // Drag state — храним в инстансе, не в DOM, чтобы переживать re-render.
        this._dragSourceId = null;
    }

    init() {
        this.attachEvents();
    }

    attachEvents() {
        const addBtn = document.getElementById('addCriteriaBtn');
        if (addBtn) addBtn.addEventListener('click', () => this._form.openEditCriteria());

        const resetBtn = document.getElementById('resetCriteriaBtn');
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetCriteria());

        const closeEditModalBtn = document.getElementById('closeEditCriteriaModalBtn');
        if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', () => this._form.closeEditCriteria());

        const cancelEditBtn = document.getElementById('cancelEditCriteriaBtn');
        if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => this._form.closeEditCriteria());

        const saveBtn = document.getElementById('saveCriteriaEditBtn');
        if (saveBtn) saveBtn.addEventListener('click', () => this._form.saveCriteria());

        this._form.attachNameInputHandler();

        const criteriaList = document.getElementById('criteriaList');
        if (!criteriaList) return;

        // ── Click-делегация: edit/delete/auto-balance/header-toggle ───────────
        criteriaList.addEventListener('click', (e) => this._handleListClick(e));

        // ── Keyboard: Enter/Space на header → toggle ─────────────────────────
        criteriaList.addEventListener('keydown', (e) => this._handleListKeydown(e));

        // ── Inline weight: input для UI-фидбека, change для commit ────────────
        criteriaList.addEventListener('input', (e) => this._handleInlineInput(e));
        criteriaList.addEventListener('change', (e) => this._handleInlineCommit(e));

        // ── Drag-and-drop: только когда mousedown на .criteria-item-grip ──────
        criteriaList.addEventListener('mousedown', (e) => this._handleDragMouseDown(e));
        criteriaList.addEventListener('dragstart', (e) => this._handleDragStart(e));
        criteriaList.addEventListener('dragend', (e) => this._handleDragEnd(e));
        criteriaList.addEventListener('dragover', (e) => this._handleDragOver(e));
        criteriaList.addEventListener('dragleave', (e) => this._handleDragLeave(e));
        criteriaList.addEventListener('drop', (e) => this._handleDrop(e));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Click + keyboard
    // ──────────────────────────────────────────────────────────────────────────

    _handleListClick(e) {
        // Auto-balance кнопка — отдельно (не имеет data-action)
        if (e.target.closest('#criteriaAutoBalanceBtn')) {
            this.autoBalanceWeights();
            return;
        }

        // Edit/Delete buttons (внутри hover-actions)
        const actionBtn = e.target.closest('button[data-action]');
        if (actionBtn) {
            const action = actionBtn.dataset.action;
            const id = +actionBtn.dataset.id;
            if (action === 'editCriteria') {
                this._form.openEditCriteria(id);
                return;
            }
            if (action === 'deleteCriteria') {
                this.deleteCriteria(id);
                return;
            }
        }

        // Toggle header — кликабельность всего header'а, кроме элементов
        // с `data-no-toggle="true"` (weight-input, action-buttons).
        const header = e.target.closest('.criteria-item-header[data-action="toggleExpand"]');
        if (!header) return;
        if (e.target.closest('[data-no-toggle="true"]')) return;
        // Drag-handle тоже не должен ловить клик-toggle (только mousedown→drag)
        if (e.target.closest('.criteria-item-grip')) return;

        this._toggleExpand(header);
    }

    _handleListKeydown(e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const header = e.target.closest('.criteria-item-header[data-action="toggleExpand"]');
        if (!header) return;
        // Не перехватываем space/enter внутри input'а — пользователь редактирует вес.
        if (e.target.matches('input, textarea, select, button')) return;
        e.preventDefault();
        this._toggleExpand(header);
    }

    _toggleExpand(headerEl) {
        const item = headerEl.closest('.criteria-item');
        if (!item) return;
        const body = item.querySelector('.criteria-body');
        if (!body) return;
        const expanded = item.dataset.expanded === 'true';
        if (expanded) {
            item.dataset.expanded = 'false';
            item.classList.remove('is-expanded');
            headerEl.setAttribute('aria-expanded', 'false');
            body.setAttribute('hidden', '');
        } else {
            item.dataset.expanded = 'true';
            item.classList.add('is-expanded');
            headerEl.setAttribute('aria-expanded', 'true');
            body.removeAttribute('hidden');
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Inline weight editing
    // ──────────────────────────────────────────────────────────────────────────

    _handleInlineInput(e) {
        const input = e.target.closest('.criteria-weight-input');
        if (!input) return;

        const raw = input.value;
        const parsed = parseInt(raw, 10);
        const isValid = Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
        input.classList.toggle('is-invalid', !isValid && raw !== '');

        // Промежуточная сумма (не комитим в Store) — для мгновенной реакции pill.
        // Читаем все weight-input на странице, считаем сумму.
        const list = input.closest('#criteriaList');
        if (!list) return;
        let total = 0;
        list.querySelectorAll('.criteria-weight-input').forEach(el => {
            const v = parseInt(el.value, 10);
            total += Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
        });
        updateSumBar(total);
    }

    _handleInlineCommit(e) {
        const input = e.target.closest('.criteria-weight-input');
        if (!input) return;
        const id = +input.dataset.id;
        const parsed = parseInt(input.value, 10);
        const valid = Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
        if (!valid) {
            // Откатываем к текущему значению из Store
            const c = this.criteriaManager.getCriteriaById(id);
            if (c) input.value = String(c.weight);
            input.classList.remove('is-invalid');
            return;
        }
        const cmgr = this.criteriaManager;
        const updated = cmgr.updateCriteriaWeight(id, parsed);
        if (updated) {
            this.store.setCriteria(cmgr.getCriteria());
        }
        input.classList.remove('is-invalid');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Auto-balance
    // ──────────────────────────────────────────────────────────────────────────

    autoBalanceWeights() {
        const cmgr = this.criteriaManager;
        if (!cmgr) return;
        if (cmgr.getCriteria().length === 0) return;

        messageService.showConfirm(
            'Распределить веса критериев так, чтобы их сумма была ровно 100%? Текущие пропорции сохранятся.',
            () => {
                if (cmgr.autoBalance()) {
                    this.store.setCriteria(cmgr.getCriteria());
                    messageService.showMessage('Веса распределены до 100%.');
                }
            }
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Drag-and-drop reorder
    // ──────────────────────────────────────────────────────────────────────────

    _handleDragMouseDown(e) {
        const grip = e.target.closest('.criteria-item-grip');
        if (!grip) return;
        const item = grip.closest('.criteria-item');
        if (item) item.setAttribute('draggable', 'true');
    }

    _handleDragStart(e) {
        const item = e.target.closest('.criteria-item');
        if (!item || !item.getAttribute('draggable')) return;
        this._dragSourceId = +item.dataset.id;
        item.classList.add('is-dragging');
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(this._dragSourceId));
        }
    }

    _handleDragOver(e) {
        if (this._dragSourceId === null) return;
        const targetItem = e.target.closest('.criteria-item');
        if (!targetItem) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        // Подсветим только текущую цель
        const list = e.target.closest('#criteriaList');
        if (list) {
            list.querySelectorAll('.criteria-item.is-drop-target').forEach(el => {
                if (el !== targetItem) el.classList.remove('is-drop-target');
            });
        }
        if (+targetItem.dataset.id !== this._dragSourceId) {
            targetItem.classList.add('is-drop-target');
        }
    }

    _handleDragLeave(e) {
        const targetItem = e.target.closest('.criteria-item');
        if (targetItem) targetItem.classList.remove('is-drop-target');
    }

    _handleDrop(e) {
        e.preventDefault();
        if (this._dragSourceId === null) return;

        const targetItem = e.target.closest('.criteria-item');
        const list = e.target.closest('#criteriaList');
        if (!targetItem || !list) {
            this._resetDragState();
            return;
        }
        const targetId = +targetItem.dataset.id;
        if (targetId === this._dragSourceId) {
            this._resetDragState();
            return;
        }

        const cmgr = this.criteriaManager;
        const ids = cmgr.getCriteria().map(c => c.id);
        const fromIdx = ids.indexOf(this._dragSourceId);
        const toIdx = ids.indexOf(targetId);
        if (fromIdx < 0 || toIdx < 0) {
            this._resetDragState();
            return;
        }
        const [moved] = ids.splice(fromIdx, 1);
        ids.splice(toIdx, 0, moved);

        if (cmgr.reorderCriteria(ids)) {
            this.store.setCriteria(cmgr.getCriteria());
        }
        this._resetDragState();
    }

    _handleDragEnd(_e) {
        this._resetDragState();
    }

    _resetDragState() {
        this._dragSourceId = null;
        const list = document.getElementById('criteriaList');
        if (list) {
            list.querySelectorAll('.criteria-item').forEach(el => {
                el.classList.remove('is-dragging', 'is-drop-target');
                el.removeAttribute('draggable');
            });
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Proxy methods for backward compatibility + delete/reset
    // ──────────────────────────────────────────────────────────────────────────

    openEditCriteria(id = null) { this._form.openEditCriteria(id); }
    closeEditCriteria() { this._form.closeEditCriteria(); }
    saveCriteria() { this._form.saveCriteria(); }
    renderScaleEditor(scale = {}) { this._form.renderScaleEditor(scale); }
    collectScaleFromEditor() { return this._form.collectScaleFromEditor(); }

    deleteCriteria(id) {
        const cmgr = this.criteriaManager;
        const store = this.store;
        if (!cmgr || !store) return;

        messageService.showConfirm(
            'Удалить критерий? Все оценки по этому критерию в задачах будут удалены.',
            () => {
                if (cmgr.deleteCriteria(id)) {
                    store.setCriteria(cmgr.getCriteria());
                    const tasks = store.getState().tasks.map(task => {
                        const criteriaEvaluations = { ...(task.criteriaEvaluations || {}) };
                        if (criteriaEvaluations[id]) {
                            delete criteriaEvaluations[id];
                        }
                        return { ...task, criteriaEvaluations };
                    });
                    store.setTasks(tasks);
                    messageService.showMessage('Критерий удален');
                }
            }
        );
    }

    resetCriteria() {
        const cmgr = this.criteriaManager;
        const store = this.store;
        if (!cmgr || !store) return;

        messageService.showConfirm(
            'Сбросить критерии к значениям по умолчанию? Все текущие критерии будут удалены.',
            () => {
                cmgr.loadDefaultCriteria();
                store.setCriteria(cmgr.getCriteria());
                const criteria = cmgr.getCriteria();
                const tasks = store.getState().tasks.map(task => {
                    const criteriaEvaluations = {};
                    criteria.forEach(criterion => {
                        criteriaEvaluations[criterion.id] = { score: 0, value: 0 };
                    });
                    return { ...task, criteriaEvaluations };
                });
                store.setTasks(tasks);
                messageService.showMessage('Критерии сброшены к значениям по умолчанию');
            }
        );
    }
}
