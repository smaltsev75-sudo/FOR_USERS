
import { APP_CONFIG } from '../utils/appConfig.js';
import { addDays, formatDate, parseDate } from '../utils/date.js';

export function createDefaultConfig() {
    const today = new Date();
    const startDate = formatDate(today);
    const endDate = formatDate(addDays(today, APP_CONFIG.SPRINT.DEFAULT_DAYS - 1));
    return {
        product: APP_CONFIG.SPRINT.DEFAULT_PRODUCT,
        days: APP_CONFIG.SPRINT.DEFAULT_DAYS,
        startDate,
        endDate,
        availCoef: APP_CONFIG.SPRINT.DEFAULT_AVAIL_COEF,
        alert: APP_CONFIG.SPRINT.DEFAULT_ALERT_THRESHOLD
    };
}

export function calculateEndDateFromStartDateAndDays(startDateStr, days) {
    const startDate = parseDate(startDateStr);
    if (!startDate) return '';
    return formatDate(addDays(startDate, days - 1));
}

export function calculateDaysFromDates(startDateStr, endDateStr) {
    const start = parseDate(startDateStr);
    const end = parseDate(endDateStr);
    if (!start || !end) return 0;
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

export function validateDays(days) {
    return days > 0;
}
