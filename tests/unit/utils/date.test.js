import { addDays, formatDate, parseDate } from '../../../js/utils/date.js';

describe('utils/date', () => {
    test('parseDate handles valid and invalid strings', () => {
        expect(parseDate('01.02.2026')).toBeInstanceOf(Date);
        expect(parseDate('')).toBeNull();
        expect(parseDate('32.01.2026')).toBeNull();
    });

    test('addDays shifts date by expected number of days', () => {
        const start = new Date(2026, 0, 1);
        const result = addDays(start, 9);
        expect(result.getDate()).toBe(10);
    });

    test('formatDate returns dd.mm.yyyy for ru-RU locale', () => {
        const value = formatDate(new Date(2026, 0, 5));
        expect(value).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    });
});
