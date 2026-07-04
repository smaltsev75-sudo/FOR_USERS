import { messageService } from '../../services/message.js';
import { parseDate } from '../../utils/date.js';
import { parseStrictInteger } from '../../domain/strictInteger.js';
import {
    createEndDatePatch,
    createStartDatePatch
} from '../../domain/sprintSchedule.js';

export function handleConfigProductChange({ target, store }) {
    const newProduct = target.value.trim();
    const currentConfig = store.getState().config;
    if (newProduct.length < 3) {
        messageService.showMessage('Название продукта обязательно и должно содержать не менее 3 символов');
        target.value = currentConfig?.product ?? '';
        return;
    }
    if (currentConfig.product === newProduct) {
        target.value = newProduct;
        return;
    }
    target.value = newProduct;
    store.setConfig({ product: newProduct });
}

export function handleConfigDaysInput({ target, applyDays }) {
    const raw = target.value?.trim();
    if (!raw) {
        target.removeAttribute('aria-invalid');
        return;
    }
    const days = parseStrictInteger(raw);
    if (days === null || days < 1) {
        target.setAttribute('aria-invalid', 'true');
        return;
    }
    target.removeAttribute('aria-invalid');
    applyDays(days);
}

export function handleConfigDaysChange({ target, store, applyDays }) {
    const days = parseStrictInteger(target.value);
    if (days === null || days < 1) {
        target.setAttribute('aria-invalid', 'true');
        messageService.showMessage('Количество дней должно быть положительным целым числом');
        target.value = store.getState().config?.days ?? 10;
        target.removeAttribute('aria-invalid');
        return;
    }
    target.removeAttribute('aria-invalid');
    applyDays(days);
}

export function handleConfigStartDateChange({ target, store }) {
    const newStartDate = target.value;
    const currentConfig = store.getState().config ?? {};
    const { startDate: currentStart } = currentConfig;
    if (currentStart === newStartDate) return;
    if (newStartDate && !parseDate(newStartDate)) {
        messageService.showMessage('Дата начала должна быть в формате дд.мм.гггг');
        target.value = currentStart || '';
        return;
    }
    store.setConfig(createStartDatePatch(currentConfig, newStartDate));
}

export function handleConfigEndDateChange({ target, store }) {
    const newEndDate = target.value;
    const currentConfig = store.getState().config ?? {};
    const { endDate: currentEnd } = currentConfig;
    if (currentEnd === newEndDate) return;
    if (newEndDate && !parseDate(newEndDate)) {
        messageService.showMessage('Дата окончания должна быть в формате дд.мм.гггг');
        target.value = currentEnd || '';
        return;
    }
    const { startDate: currentStart } = currentConfig;
    if (newEndDate && currentStart) {
        const parsedEnd = parseDate(newEndDate);
        const parsedStart = parseDate(currentStart);
        if (parsedEnd && parsedStart && parsedEnd < parsedStart) {
            messageService.showMessage('Дата окончания не может быть раньше даты начала спринта');
            target.value = currentEnd || '';
            return;
        }
    }
    store.setConfig(createEndDatePatch(currentConfig, newEndDate));
}

export function handleConfigHolidaysInput({ target, applyHolidays }) {
    const raw = target.value?.trim();
    if (!raw) {
        target.removeAttribute('aria-invalid');
        return;
    }
    const holidays = parseStrictInteger(raw);
    if (holidays === null || holidays < 0) {
        target.setAttribute('aria-invalid', 'true');
        return;
    }
    target.removeAttribute('aria-invalid');
    applyHolidays(holidays);
}

export function handleConfigHolidaysChange({ target, store, applyHolidays }) {
    const holidays = parseStrictInteger(target.value);
    if (holidays === null || holidays < 0) {
        target.setAttribute('aria-invalid', 'true');
        messageService.showMessage('Количество праздничных дней должно быть неотрицательным целым числом');
        target.value = store.getState().config?.holidays ?? 0;
        target.removeAttribute('aria-invalid');
        return;
    }
    target.removeAttribute('aria-invalid');
    applyHolidays(holidays);
}

export function handleConfigAvailCoefInput({ target, nfs, applyAvailCoef }) {
    nfs.handleInput(target);
    const raw = target.value?.trim();
    if (!raw) return;

    const num = nfs.parseNumber(raw);
    if (num < 0 || num > 100) return;
    applyAvailCoef(num);
}

export function handleConfigAvailCoefChange({ target, store, nfs, applyAvailCoef }) {
    const num = nfs.parseNumber(target.value);
    if (num < 0 || num > 100) {
        messageService.showMessage('Коэффициент доступности должен быть числом от 0 до 100');
        target.value = nfs.formatNumber(store.getState().config?.availCoef ?? 93.5);
        return;
    }
    const availCoef = nfs.roundToDecimals(num, 2);
    target.value = nfs.formatNumber(availCoef);
    applyAvailCoef(availCoef);
}

export function handleConfigAlertChange({ target, store }) {
    const alert = parseStrictInteger(target.value);
    if (alert === null || alert < 0) {
        target.setAttribute('aria-invalid', 'true');
        messageService.showMessage('Порог предупреждения должен быть неотрицательным целым числом');
        target.value = store.getState().config?.alert ?? 3;
        target.removeAttribute('aria-invalid');
        return;
    }
    target.removeAttribute('aria-invalid');
    const { alert: currentAlert } = store.getState().config ?? {};
    if (currentAlert === alert) return;
    store.setConfig({ alert });
}

export function handleConfigReset({ store, resetConfig }) {
    resetConfig(store);
    messageService.showMessage('Конфигурация сброшена к значениям по умолчанию');
}
