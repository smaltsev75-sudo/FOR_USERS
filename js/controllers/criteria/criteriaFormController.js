// js/controllers/criteria/criteriaFormController.js

import { messageService } from '../../services/message.js';
import { validateAbbreviation, isAbbreviationUnique, generateAbbreviation } from '../../domain/validation.js';
import { generateScaleEditorHTML } from '../../ui/criteriaList.js';
import { showModal, hideModal } from '../../ui/modalManager.js';
import { parseStrictIntegerInRange } from '../../domain/strictInteger.js';
import { fillMissingCriteriaEvaluations } from '../../domain/criteria.js';
import { getCriterionById, getTotalWeight } from '../../domain/criteriaOps.js';

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
     * @param {Function} onSaved - callback() called after successful save
     */
    constructor(store, onSaved) {
        this.store = store;
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
        const store = this.store;
        if (!store) return;

        const modalTitle = document.getElementById('editCriteriaModalTitle');
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

        store.setEditCriteriaId(id);

        if (id) {
            modalTitle.textContent = 'Редактировать критерий';
            const criteria = getCriterionById(store.getState().criteria || [], id);
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
        this.store?.setEditCriteriaId?.(null);
    }

    // ── Save ───────────────────────────────────────────────────────────────────

    saveCriteria() {
        const store = this.store;
        if (!store) return;

        const name = document.getElementById('editCriteriaName').value.trim();
        const abbreviation = document.getElementById('editCriteriaAbbreviation').value.trim().toUpperCase();
        // v8.30.33: strict integer 0..100. '50.5' / '50abc' → отклоняем ВЫШЕ
        // store, явное сообщение пользователю. Раньше `parseInt() || 0` тихо
        // превращал «50.5» → 50, «50abc» → 50, а пустую строку → 0.
        const weightEl = document.getElementById('editCriteriaWeight');
        const weight = parseStrictIntegerInRange(weightEl.value, 0, 100);
        const rationale = document.getElementById('editCriteriaRationale').value.trim();
        const scale = this.collectScaleFromEditor();

        if (!name) {
            messageService.showMessage('Название критерия обязательно для заполнения');
            return;
        }

        if (weight === null) {
            weightEl.setAttribute('aria-invalid', 'true');
            messageService.showMessage('Вес критерия должен быть целым числом от 0 до 100');
            return;
        }
        weightEl.removeAttribute('aria-invalid');

        const aVal = validateAbbreviation(abbreviation);
        if (!aVal.valid) {
            messageService.showMessage(aVal.message);
            return;
        }

        const state = store.getState();
        const editCriteriaId = state.ui?.editCriteriaId ?? null;
        if (!isAbbreviationUnique(state.criteria || [], abbreviation, editCriteriaId)) {
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
        const isNewCriterion = editCriteriaId === null;

        if (!isNewCriterion) {
            success = store.updateCriterion(editCriteriaId, criteriaData);
            message = success ? 'Критерий успешно обновлен!' : 'Ошибка обновления критерия';
        } else {
            store.addCriterion(criteriaData);
            success = true;
            message = 'Критерий успешно добавлен!';
        }

        if (success) {
            this.closeEditCriteria();

            const criteria = store.getState().criteria || [];
            const totalWeight = getTotalWeight(criteria);
            if (totalWeight !== 100) {
                messageService.showMessage(`Критерий сохранен. Обратите внимание: сумма весов всех критериев (${totalWeight}%) не равна 100%. Рекомендуется скорректировать веса.`);
            } else {
                messageService.showMessage(message);
            }

            // Fill evaluations for all tasks when a new criterion is added
            // (existing values preserved, orphans kept — CTRL-2 domain helper).
            if (isNewCriterion) {
                store.setTasks(fillMissingCriteriaEvaluations(store.getState().tasks, criteria));
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
