import { updateSumBar } from '../../ui/criteriaList.js';
import { parseStrictIntegerInRange } from '../../domain/strictInteger.js';
import { getCriterionById } from '../../domain/criteriaOps.js';

export function handleCriteriaInlineInput(e) {
    const input = e.target.closest('.criteria-weight-input');
    if (!input) return;

    const raw = input.value;
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

    const list = input.closest('#criteriaList');
    if (!list) return;
    let total = 0;
    list.querySelectorAll('.criteria-weight-input').forEach(el => {
        const value = parseStrictIntegerInRange(el.value, 0, 100);
        if (value !== null) total += value;
    });
    updateSumBar(total);
}

export function handleCriteriaInlineCommit(store, e) {
    const input = e.target.closest('.criteria-weight-input');
    if (!input) return;

    const id = +input.dataset.id;
    const parsed = parseStrictIntegerInRange(input.value, 0, 100);
    if (parsed === null) {
        const criterion = getCriterionById(store.getState().criteria || [], id);
        if (criterion) input.value = String(criterion.weight);
        input.classList.remove('is-invalid');
        input.removeAttribute('aria-invalid');
        return;
    }

    store.updateCriterionWeight(id, parsed);
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
}
