// js/controllers/criteria/criteriaFormController.js

import { messageService } from '../../services/message.js';
import { validateAbbreviation, isAbbreviationUnique, generateAbbreviation } from '../../domain/validation.js';
import { generateScaleEditorHTML } from '../../ui/criteriaList.js';
import { showModal, hideModal } from '../../ui/modalManager.js';

/**
 * CriteriaFormController — контроллер модального окна добавления/редактирования критерия.
 * Извлечён из CriteriaController для разделения ответственности.
 *
 * Отвечает за:
 * - Открытие/закрытие модали редактирования критерия
 * - Рендеринг редактора шкалы оценок (1–10)
 * - Валидацию и сохранение критерия
 * - Автогенерацию аббревиатуры
 */
export class CriteriaFormController {
    /**
     * @param {Object} store
     * @param {Object} criteriaManager
     * @param {Function} onSaved - callback() called after successful save
     */
    constructor(store, criteriaManager, onSaved) {
        this.store = store;
        this.criteriaManager = criteriaManager;
        this._onSaved = onSaved;
    }

    // ── Scale editor ───────────────────────────────────────────────────────────

    renderScaleEditor(scale = {}) {
        const scaleEditor = document.getElementById('scaleEditor');
        if (!scaleEditor) return;
        scaleEditor.innerHTML = generateScaleEditorHTML(scale);
    }

    collectScaleFromEditor() {
        const scale = {};
        const modal = document.getElementById('editCriteriaModal');
        if (!modal) return scale;
        for (let i = 1; i <= 10; i++) {
            const textarea = modal.querySelector(`#scale_${i}`);
            scale[i] = textarea ? textarea.value.trim() : '';
        }
        return scale;
    }

    // ── Open / close ───────────────────────────────────────────────────────────

    openEditCriteria(id = null) {
        const cmgr = this.criteriaManager;
        if (!cmgr) return;

        const modalTitle = document.getElementById('criteriaModalTitle');
        const nameInput = document.getElementById('editCriteriaName');
        const abbreviationInput = document.getElementById('editCriteriaAbbreviation');
        const weightInput = document.getElementById('editCriteriaWeight');
        const rationaleInput = document.getElementById('editCriteriaRationale');
        const scaleEditor = document.getElementById('scaleEditor');
        const modal = document.getElementById('editCriteriaModal');

        if (!modal || !modalTitle || !nameInput || !abbreviationInput || !weightInput || !rationaleInput) {
            messageService.showMessage('Не найдены элементы модального окна редактирования критериев');
            return;
        }

        cmgr.editCriteriaId = id;

        if (id) {
            modalTitle.textContent = 'Редактировать критерий';
            const criteria = cmgr.getCriteriaById(id);
            if (criteria) {
                nameInput.value = criteria.name;
                abbreviationInput.value = criteria.abbreviation;
                weightInput.value = criteria.weight;
                rationaleInput.value = criteria.rationale;
                if (scaleEditor) this.renderScaleEditor(criteria.scale);
            }
        } else {
            modalTitle.textContent = 'Добавить критерий';
            nameInput.value = '';
            abbreviationInput.value = '';
            weightInput.value = '';
            rationaleInput.value = '';
            if (scaleEditor) this.renderScaleEditor({});
        }

        showModal(modal);
        setTimeout(() => {
            const firstInput = modal.querySelector('input:not([type="hidden"]), textarea');
            if (firstInput) firstInput.focus();
        }, 50);
    }

    closeEditCriteria() {
        const modal = document.getElementById('editCriteriaModal');
        if (modal) hideModal(modal);
    }

    // ── Save ───────────────────────────────────────────────────────────────────

    saveCriteria() {
        const cmgr = this.criteriaManager;
        const store = this.store;
        if (!cmgr || !store) return;

        const name = document.getElementById('editCriteriaName').value.trim();
        const abbreviation = document.getElementById('editCriteriaAbbreviation').value.trim().toUpperCase();
        const weight = parseInt(document.getElementById('editCriteriaWeight').value) || 0;
        const rationale = document.getElementById('editCriteriaRationale').value.trim();
        const scale = this.collectScaleFromEditor();

        if (!name) {
            messageService.showMessage('Название критерия обязательно для заполнения');
            return;
        }

        const aVal = validateAbbreviation(abbreviation);
        if (!aVal.valid) {
            messageService.showMessage(aVal.message);
            return;
        }

        if (!isAbbreviationUnique(cmgr.getCriteria(), abbreviation, cmgr.editCriteriaId)) {
            messageService.showMessage('Аббревиатура должна быть уникальной для каждого критерия');
            return;
        }

        if (weight <= 0 || weight > 100) {
            messageService.showMessage('Вес критерия должен быть от 1 до 100%');
            return;
        }

        if (!rationale) {
            messageService.showMessage('Обоснование веса обязательно для заполнения');
            return;
        }

        const criteriaData = { name, abbreviation, weight, rationale, scale };
        let success;
        let message;

        if (cmgr.editCriteriaId) {
            success = cmgr.updateCriteria(cmgr.editCriteriaId, criteriaData);
            message = success ? 'Критерий успешно обновлен!' : 'Ошибка обновления критерия';
        } else {
            cmgr.addCriteria(criteriaData);
            success = true;
            message = 'Критерий успешно добавлен!';
        }

        if (success) {
            store.setCriteria(cmgr.getCriteria());
            this.closeEditCriteria();

            const totalWeight = cmgr.getTotalWeight();
            if (totalWeight !== 100) {
                messageService.showMessage(`Критерий сохранен. Обратите внимание: сумма весов всех критериев (${totalWeight}%) не равна 100%. Рекомендуется скорректировать веса.`);
            } else {
                messageService.showMessage(message);
            }

            // Re-initialize evaluations for all tasks when a new criterion is added
            if (!cmgr.editCriteriaId) {
                const criteria = cmgr.getCriteria();
                const tasks = store.getState().tasks.map(task => {
                    const criteriaEvaluations = { ...(task.criteriaEvaluations || {}) };
                    criteria.forEach(criterion => {
                        if (!criteriaEvaluations[criterion.id]) {
                            criteriaEvaluations[criterion.id] = { score: 0, value: 0 };
                        }
                    });
                    return { ...task, criteriaEvaluations };
                });
                store.setTasks(tasks);
            }

            if (this._onSaved) this._onSaved();
        } else {
            messageService.showMessage(message);
        }
    }

    // ── Auto-generate abbreviation ─────────────────────────────────────────────

    /**
     * Attaches the auto-abbreviation handler to the name input.
     */
    attachNameInputHandler() {
        const nameInput = document.getElementById('editCriteriaName');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                const abbreviationField = document.getElementById('editCriteriaAbbreviation');
                if (abbreviationField && !abbreviationField.value.trim()) {
                    abbreviationField.value = generateAbbreviation(e.target.value);
                }
            });
        }
    }
}
