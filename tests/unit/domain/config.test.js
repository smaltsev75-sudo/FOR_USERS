import { APP_CONFIG } from '../../../js/utils/appConfig.js';
import {
    calculateDaysFromDates,
    calculateEndDateFromStartDateAndDays,
    createDefaultConfig,
    validateDays
} from '../../../js/domain/config.js';

describe('domain/config', () => {
    test('createDefaultConfig returns expected defaults', () => {
        const config = createDefaultConfig();
        expect(config.product).toBe(APP_CONFIG.SPRINT.DEFAULT_PRODUCT);
        expect(config.days).toBe(APP_CONFIG.SPRINT.DEFAULT_DAYS);
        expect(config.availCoef).toBe(APP_CONFIG.SPRINT.DEFAULT_AVAIL_COEF);
        expect(config.alert).toBe(APP_CONFIG.SPRINT.DEFAULT_ALERT_THRESHOLD);
        expect(config.startDate).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
        expect(config.endDate).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    });

    test('calculateEndDateFromStartDateAndDays returns empty string for invalid date', () => {
        expect(calculateEndDateFromStartDateAndDays('', 10)).toBe('');
    });

    test('calculateEndDateFromStartDateAndDays returns valid date for valid input', () => {
        const result = calculateEndDateFromStartDateAndDays('01.01.2026', 10);
        expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
        expect(result).toBe('10.01.2026');
    });

    test('calculateDaysFromDates calculates inclusive span', () => {
        expect(calculateDaysFromDates('01.01.2026', '10.01.2026')).toBe(10);
    });

    test('calculateDaysFromDates returns 0 for invalid start date', () => {
        expect(calculateDaysFromDates('', '10.01.2026')).toBe(0);
    });

    test('calculateDaysFromDates returns 0 for invalid end date', () => {
        expect(calculateDaysFromDates('01.01.2026', '')).toBe(0);
    });

    test('calculateDaysFromDates returns 0 for both invalid dates', () => {
        expect(calculateDaysFromDates('', '')).toBe(0);
    });

    test('validateDays accepts only positive values', () => {
        expect(validateDays(1)).toBe(true);
        expect(validateDays(0)).toBe(false);
        expect(validateDays(-1)).toBe(false);
    });
});
