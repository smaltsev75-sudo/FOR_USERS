import { parseNonNegativeNumber, readCreateTaskEstimates, collectCriteriaEvaluations, calculateCreateFormTotal } from '../../../../js/controllers/task/formHelpers.js';

describe('controllers/task/formHelpers', () => {
    const nfs = {
        parseNumber: (v) => Number(String(v).replace(',', '.')) || 0,
        formatNumber: (v) => String(v)
    };

    // ── parseNonNegativeNumber ──────────────────────────────────────────────
    test('parseNonNegativeNumber returns parsed value for positive', () => {
        expect(parseNonNegativeNumber(nfs, '5')).toBe(5);
    });

    test('parseNonNegativeNumber clamps negative to 0', () => {
        expect(parseNonNegativeNumber(nfs, '-3')).toBe(0);
    });

    test('parseNonNegativeNumber returns 0 for NaN', () => {
        expect(parseNonNegativeNumber(nfs, 'abc')).toBe(0);
    });

    test('parseNonNegativeNumber returns 0 for undefined', () => {
        expect(parseNonNegativeNumber(nfs, undefined)).toBe(0);
    });

    // ── readCreateTaskEstimates ────────────────────────────────────────────
    test('readCreateTaskEstimates reads DOM values', () => {
        document.body.innerHTML = `
            <input id="h_uiux" value="1" />
            <input id="h_ca" value="2" />
            <input id="h_fe" value="3" />
            <input id="h_be" value="4" />
            <input id="h_qa" value="5" />
        `;
        const result = readCreateTaskEstimates(nfs);
        expect(result).toEqual({ uiux: 1, ca: 2, fe: 3, be: 4, qa: 5 });
    });

    test('readCreateTaskEstimates handles missing elements', () => {
        document.body.innerHTML = '';
        const result = readCreateTaskEstimates(nfs);
        expect(result).toEqual({ uiux: 0, ca: 0, fe: 0, be: 0, qa: 0 });
    });

    // ── collectCriteriaEvaluations ─────────────────────────────────────────
    test('collectCriteriaEvaluations reads select values', () => {
        document.body.innerHTML = `<select id="criteria_c1"><option value="7" selected>7</option></select>`;
        const result = collectCriteriaEvaluations([{ id: 'c1', weight: 10 }]);
        expect(result.c1.score).toBe(7);
        expect(result.c1.value).toBe(7); // (7 * 10) / 10
    });

    test('collectCriteriaEvaluations handles missing select', () => {
        document.body.innerHTML = '';
        const result = collectCriteriaEvaluations([{ id: 'missing', weight: 5 }]);
        expect(result.missing.score).toBe(0);
        expect(result.missing.value).toBe(0);
    });

    // ── calculateCreateFormTotal ───────────────────────────────────────────
    test('calculateCreateFormTotal sums all roles', () => {
        document.body.innerHTML = `
            <input id="h_uiux" value="1" />
            <input id="h_ca" value="2" />
            <input id="h_fe" value="3" />
            <input id="h_be" value="4" />
            <input id="h_qa" value="5" />
        `;
        expect(calculateCreateFormTotal(nfs)).toBe(15);
    });
});
