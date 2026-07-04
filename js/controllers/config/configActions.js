import { createDefaultConfig } from '../../domain/config.js';
import {
    calculateSprintEndDate,
    createDaysPatch,
    createHolidaysPatch
} from '../../domain/sprintSchedule.js';

export function getConfigSignature(config = {}) {
    return [
        config.product ?? '',
        config.days ?? '',
        config.holidays ?? '',
        config.startDate ?? '',
        config.endDate ?? '',
        config.availCoef ?? '',
        config.alert ?? ''
    ].join('|');
}

export function applyDays(store, days) {
    const currentConfig = store.getState().config ?? {};
    if (currentConfig.days === days) return false;

    store.setConfig(createDaysPatch(currentConfig, days));
    return true;
}

export function applyAvailCoef(store, nfs, availCoef) {
    const normalized = nfs.roundToDecimals(availCoef, 1);
    const currentConfig = store.getState().config ?? {};
    if (currentConfig.availCoef === normalized) return false;

    store.setConfig({ availCoef: normalized });
    return true;
}

export function applyHolidays(store, holidays) {
    const currentConfig = store.getState().config ?? {};
    if (currentConfig.holidays === holidays) return false;

    store.setConfig(createHolidaysPatch(currentConfig, holidays));
    return true;
}

export function resetConfig(store, now) {
    const defaultConfig = createDefaultConfig(now);
    store.setConfig(defaultConfig);
    return defaultConfig;
}

export function calculateEndDate(startDate, days) {
    return calculateSprintEndDate(startDate, days);
}
