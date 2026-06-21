
import { APP_CONFIG } from '../utils/appConfig.js';
import { addWorkingDays, formatDate } from '../utils/date.js';

export function createDefaultConfig(now = new Date()) {
    const startDate = formatDate(now);
    const endDate = formatDate(addWorkingDays(now, APP_CONFIG.SPRINT.DEFAULT_DAYS - 1));
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
