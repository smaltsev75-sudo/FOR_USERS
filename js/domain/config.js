
import { APP_CONFIG } from '../utils/appConfig.js';
import { addWorkingDays, countWorkingDays, formatDate, parseDate } from '../utils/date.js';

export function createDefaultConfig() {
    const today = new Date();
    const startDate = formatDate(today);
    const endDate = formatDate(addWorkingDays(today, APP_CONFIG.SPRINT.DEFAULT_DAYS - 1));
    return {
        product: APP_CONFIG.SPRINT.DEFAULT_PRODUCT,
        days: APP_CONFIG.SPRINT.DEFAULT_DAYS,
        holidays: APP_CONFIG.SPRINT.DEFAULT_HOLIDAYS,
        startDate,
        endDate,
        availCoef: APP_CONFIG.SPRINT.DEFAULT_AVAIL_COEF,
        alert: APP_CONFIG.SPRINT.DEFAULT_ALERT_THRESHOLD
    };
}

/**
 * Рассчитывает дату окончания спринта.
 * @param {string} startDateStr - дата начала в формате дд.мм.гггг
 * @param {number} days - эффективные рабочие дни (без праздников)
 * @param {number} [holidays=0] - количество праздничных дней в периоде
 * @returns {string} дата окончания в формате дд.мм.гггг
 */
export function calculateEndDateFromStartDateAndDays(startDateStr, days, holidays = 0) {
    const startDate = parseDate(startDateStr);
    if (!startDate) return '';
    const totalWorkingDays = days + holidays;
    if (totalWorkingDays <= 0) return '';
    return formatDate(addWorkingDays(startDate, totalWorkingDays - 1));
}

/**
 * Рассчитывает количество эффективных рабочих дней между датами.
 * @param {string} startDateStr - дата начала
 * @param {string} endDateStr - дата окончания
 * @param {number} [holidays=0] - количество праздничных дней в периоде
 * @returns {number} количество рабочих дней минус праздники (не менее 0)
 */
export function calculateDaysFromDates(startDateStr, endDateStr, holidays = 0) {
    const start = parseDate(startDateStr);
    const end = parseDate(endDateStr);
    if (!start || !end) return 0;
    return Math.max(0, countWorkingDays(start, end) - holidays);
}

export function validateDays(days) {
    return days > 0;
}
