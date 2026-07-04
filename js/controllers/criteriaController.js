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
import { showModal, hideModal } from '../ui/modalManager.js';
import { CriteriaFormController } from './criteria/criteriaFormController.js';
import { updateSumBar } from '../ui/criteriaList.js';
import { parseStrictIntegerInRange } from '../domain/strictInteger.js';
import { initializeCriteriaEvaluations, removeCriterionEvaluation } from '../domain/criteria.js';
import { getCriterionById, loadDefaultCriteria } from '../domain/criteriaOps.js';

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
        // v2: критерии — отдельное окно (#criteriaModal). Открытие из шапки/rail,
        // закрытие крестиком/кнопкой/Esc (Esc — общий обработчик modalManager).
        const criteriaModal = document.getElementById('criteriaModal');
        const openBtn = document.getElementById('openCriteriaBtn');
        if (openBtn && criteriaModal) openBtn.addEventListener('click', () => showModal(criteriaModal));
        const closeModalBtn = document.getElementById('closeCriteriaModalBtn');
        if (closeModalBtn && criteriaModal) closeModalBtn.addEventListener('click', () => hideModal(criteriaModal));
        const closeBtn = document.getElementById('closeCriteriaBtn');
        if (closeBtn && criteriaModal) closeBtn.addEventListener('click', () => hideModal(criteriaModal));

        // «Сбросить»/«Добавить» теперь рендерятся внутри #criteriaList (sum-bar)
        // и пересоздаются при каждом re-render — поэтому обрабатываются
        // делегированно в _handleListClick (как #criteriaAutoBalanceBtn), а не
        // прямым listener'ом по id (он бы отвалился после первого re-render).

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
        // v8.30.0: keydown-делегат удалён — toggle теперь native <button>,
        // браузер сам обрабатывает Enter/Space и диспатчит click.
        criteriaList.addEventListener('click', (e) => this._handleListClick(e));

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
        const input = e.target.closest('.criteria-weight-input');
        if (!input) return;

        const raw = input.value;
        // v8.30.33: strict integer 0..100. '50.5' / '50abc' / отрицательные → null.
        const parsed = parseStrictIntegerInRange(raw, 0, 100);
        const isValid = parsed !== null;
        input.classList.toggle('is-invalid', !isValid && raw !== '');
        if (isValid) {
            input.removeAttribute('aria-invalid');
        } else if (raw !== '') {
            input.setAttribute('aria-invalid', 'true');
        } else {
            input.removeAttribute('aria-invalid');
        }

        // Промежуточная сумма (не комитим в Store) — для мгновенной реакции pill.
        // Читаем все weight-input на странице, считаем сумму валидных значений.
        const list = input.closest('#criteriaList');
        if (!list) return;
        let total = 0;
        list.querySelectorAll('.criteria-weight-input').forEach(el => {
            const v = parseStrictIntegerInRange(el.value, 0, 100);
            if (v !== null) total += v;
        });
        updateSumBar(total);
    }

    _handleInlineCommit(e) {
        const input = e.target.closest('.criteria-weight-input');
        if (!input) return;
        const id = +input.dataset.id;
        const parsed = parseStrictIntegerInRange(input.value, 0, 100);
        if (parsed === null) {
            // Откатываем к текущему значению из Store
            const c = getCriterionById(this.store.getState().criteria || [], id);
            if (c) input.value = String(c.weight);
            input.classList.remove('is-invalid');
            input.removeAttribute('aria-invalid');
            return;
        }
        this.store.updateCriterionWeight(id, parsed);
        input.classList.remove('is-invalid');
        input.removeAttribute('aria-invalid');
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

        const ids = (this.store.getState().criteria || []).map(c => c.id);
        const fromIdx = ids.indexOf(this._dragSourceId);
        const toIdx = ids.indexOf(targetId);
        if (fromIdx < 0 || toIdx < 0) {
            this._resetDragState();
            return;
        }
        const [moved] = ids.splice(fromIdx, 1);
        ids.splice(toIdx, 0, moved);

        this.store.reorderCriteria(ids);
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
