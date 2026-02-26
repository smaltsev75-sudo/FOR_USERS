import { APP_CONFIG } from '../../../js/utils/appConfig.js';

describe('utils/appConfig', () => {
    test('contains valid storage version', () => {
        expect(Number.isInteger(APP_CONFIG.STORAGE_VERSION)).toBe(true);
        expect(APP_CONFIG.STORAGE_VERSION).toBeGreaterThan(0);
    });

    test('contains valid sprint defaults', () => {
        expect(APP_CONFIG.SPRINT.DEFAULT_PRODUCT).toBeTruthy();
        expect(APP_CONFIG.SPRINT.DEFAULT_DAYS).toBeGreaterThan(0);
        expect(APP_CONFIG.SPRINT.DEFAULT_AVAIL_COEF).toBeGreaterThan(0);
        expect(APP_CONFIG.SPRINT.DEFAULT_ALERT_THRESHOLD).toBeGreaterThanOrEqual(0);
    });
});
