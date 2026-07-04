// js/controllers/criteriaController.js
//
// v8.29 redesign:
//   - input event на .criteria-weight-input → instant sum-bar update (без commit)
//   - change event → commit в Store (фокус сохраняется снапшотом в render)
//   - click на «Авто-баланс» → Store.autoBalanceCriteria()
//   - click на .criteria-item-toggle-btn → toggle expand/collapse (a11y: native button)
//   - HTML5 DnD на .criteria-item через .criteria-item-grip → reorderCriteria
//   - SVG-иконки edit/delete (через делегирование data-action — без изменений)

import { messageService } from '../services/message.js';
import { CriteriaFormController } from './criteria/criteriaFormController.js';
import { initializeCriteriaEvaluations, removeCriterionEvaluation } from '../domain/criteria.js';
import { loadDefaultCriteria } from '../domain/criteriaOps.js';
import { wireCriteriaControllerEvents } from './criteria/criteriaListEvents.js';
import {
    handleCriteriaInlineCommit,
    handleCriteriaInlineInput
} from './criteria/criteriaInlineWeights.js';
import {
    handleCriteriaDragLeave,
    handleCriteriaDragMouseDown,
    handleCriteriaDragOver,
    handleCriteriaDragStart,
    handleCriteriaDrop,
    resetCriteriaDragState
} from './criteria/criteriaDragReorder.js';

export class CriteriaController {
    constructor(store) {
        this.store = store;
        this._form = new CriteriaFormController(store, null);

        // Drag state — храним в инстансе, не в DOM, чтобы переживать re-render.
        this._dragSourceId = null;
    }

    init() {
        this.attachEvents();
    }

    attachEvents() {
        wireCriteriaControllerEvents(this);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Click + keyboard
    // ──────────────────────────────────────────────────────────────────────────

    _handleListClick(e) {
        // Кнопки sum-bar (без data-action) — делегированно, переживают re-render.
        if (e.target.closest('#criteriaAutoBalanceBtn')) {
            this.autoBalanceWeights();
            return;
        }
        if (e.target.closest('#addCriteriaBtn')) {
            this._form.openEditCriteria();
            return;
        }
        if (e.target.closest('#resetCriteriaBtn')) {
            this.resetCriteria();
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

        // v8.30.0: toggle перенесён с .criteria-item-header (role=button) на
        // отдельную <button class="criteria-item-toggle-btn"> — устранение
        // nested-interactive нарушения axe-core. Браузер сам даёт native click
        // и keyboard handling для <button>, отдельный keydown-listener больше
        // не нужен.
        const toggleBtn = e.target.closest('.criteria-item-toggle-btn[data-action="toggleExpand"]');
        if (!toggleBtn) return;
        this._toggleExpand(toggleBtn);
    }

    _toggleExpand(toggleBtn) {
        const item = toggleBtn.closest('.criteria-item');
        if (!item) return;
        const body = item.querySelector('.criteria-body');
        if (!body) return;
        const expanded = item.dataset.expanded === 'true';
        if (expanded) {
            item.dataset.expanded = 'false';
            item.classList.remove('is-expanded');
            toggleBtn.setAttribute('aria-expanded', 'false');
            body.setAttribute('hidden', '');
        } else {
            item.dataset.expanded = 'true';
            item.classList.add('is-expanded');
            toggleBtn.setAttribute('aria-expanded', 'true');
            body.removeAttribute('hidden');
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Inline weight editing
    // ──────────────────────────────────────────────────────────────────────────

    _handleInlineInput(e) {
        handleCriteriaInlineInput(e);
    }

    _handleInlineCommit(e) {
        handleCriteriaInlineCommit(this.store, e);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Auto-balance
    // ──────────────────────────────────────────────────────────────────────────

    autoBalanceWeights() {
        if ((this.store.getState().criteria || []).length === 0) return;

        messageService.showConfirm(
            'Распределить веса критериев так, чтобы их сумма была ровно 100%? Текущие пропорции сохранятся.',
            () => {
                if (this.store.autoBalanceCriteria()) {
                    messageService.showMessage('Веса распределены до 100%.');
                }
            }
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Drag-and-drop reorder
    // ──────────────────────────────────────────────────────────────────────────

    _handleDragMouseDown(e) {
        handleCriteriaDragMouseDown(e);
    }

    _handleDragStart(e) {
        handleCriteriaDragStart(this, e);
    }

    _handleDragOver(e) {
        handleCriteriaDragOver(this, e);
    }

    _handleDragLeave(e) {
        handleCriteriaDragLeave(e);
    }

    _handleDrop(e) {
        handleCriteriaDrop(this, e);
    }

    _handleDragEnd(_e) {
        this._resetDragState();
    }

    _resetDragState() {
        resetCriteriaDragState(this);
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
        const store = this.store;
        if (!store) return;

        messageService.showConfirm(
            'Удалить критерий? Все оценки по этому критерию в задачах будут удалены.',
            () => {
                if (store.deleteCriterion(id)) {
                    store.setTasks(removeCriterionEvaluation(store.getState().tasks, id));
                    messageService.showMessage('Критерий удален');
                }
            }
        );
    }

    resetCriteria() {
        const store = this.store;
        if (!store) return;

        messageService.showConfirm(
            'Сбросить критерии к значениям по умолчанию? Все текущие критерии будут удалены.',
            () => {
                const criteria = loadDefaultCriteria();
                store.setCriteria(criteria);
                const tasks = store.getState().tasks.map(task => ({
                    ...task,
                    criteriaEvaluations: initializeCriteriaEvaluations(criteria)
                }));
                store.setTasks(tasks);
                messageService.showMessage('Критерии сброшены к значениям по умолчанию');
            }
        );
    }
}
