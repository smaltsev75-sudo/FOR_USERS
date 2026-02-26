// js/controllers/criteriaController.js
import { messageService } from '../services/message.js';
import { CriteriaFormController } from './criteria/criteriaFormController.js';

export class CriteriaController {
    constructor(store, criteriaManager) {
        this.store = store;
        this.criteriaManager = criteriaManager;
        this._form = new CriteriaFormController(store, criteriaManager, null);
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

        // Делегирование событий для кнопок в списке критериев
        const criteriaList = document.getElementById('criteriaList');
        if (criteriaList) {
            criteriaList.addEventListener('click', (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;
                const action = btn.dataset.action;
                const id = +btn.dataset.id;
                if (action === 'editCriteria') {
                    this._form.openEditCriteria(id);
                } else if (action === 'deleteCriteria') {
                    this.deleteCriteria(id);
                }
            });
        }
    }

    // ── Proxy methods for backward compatibility ───────────────────────────────

    openEditCriteria(id = null) { this._form.openEditCriteria(id); }
    closeEditCriteria() { this._form.closeEditCriteria(); }
    saveCriteria() { this._form.saveCriteria(); }
    renderScaleEditor(scale = {}) { this._form.renderScaleEditor(scale); }
    collectScaleFromEditor() { return this._form.collectScaleFromEditor(); }

    // ── Delete / Reset ─────────────────────────────────────────────────────────

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
