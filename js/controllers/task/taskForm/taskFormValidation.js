import { messageService } from '../../../services/message.js';
import {
    isJiraUrlUnique,
    isTitleUnique,
    validateJiraUrl,
    validateTitle
} from '../../../domain/validation.js';

export function validateTaskFormField({
    doc = document,
    store,
    elementId,
    validateFn,
    uniqueFn,
    uniqueErrorMsg,
    excludeId = null
}) {
    const el = doc.getElementById(elementId);
    if (!el) {
        const err = `[TaskFormController] DOM-инвариант нарушен: элемент #${elementId} отсутствует в форме`;
        if (globalThis.process?.env?.NODE_ENV === 'test') {
            throw new Error(err);
        }
        console.error(err);
        messageService.showMessage('Не удалось обработать форму: внутренняя ошибка интерфейса. Перезагрузите страницу (Ctrl+Shift+R).');
        return null;
    }

    const value = el.value.trim();
    const result = validateFn(value);
    if (!result.valid) {
        el.classList.add('error');
        el.setAttribute('aria-invalid', 'true');
        messageService.showMessage(result.message);
        return null;
    }

    if (!uniqueFn(store.getState().tasks, value, excludeId)) {
        el.classList.add('error');
        el.setAttribute('aria-invalid', 'true');
        messageService.showMessage(uniqueErrorMsg);
        return null;
    }

    el.classList.remove('error');
    el.removeAttribute('aria-invalid');
    return value;
}

export function validateTaskTitleField({ doc = document, store, excludeId = null }) {
    return validateTaskFormField({
        doc,
        store,
        elementId: 'newTitle',
        validateFn: validateTitle,
        uniqueFn: isTitleUnique,
        uniqueErrorMsg: 'Название должно быть уникальным',
        excludeId
    });
}

export function validateTaskJiraField({ doc = document, store, excludeId = null }) {
    return validateTaskFormField({
        doc,
        store,
        elementId: 'newJira',
        validateFn: validateJiraUrl,
        uniqueFn: isJiraUrlUnique,
        uniqueErrorMsg: 'URL должен быть уникальным',
        excludeId
    });
}
