import { jest } from '@jest/globals';

const messageServiceMock = { showMessage: jest.fn() };

jest.unstable_mockModule('../../../js/services/message.js', () => ({
    messageService: messageServiceMock
}));

const { ConfigController } = await import('../../../js/controllers/configController.js');

describe('controllers/configController', () => {
    let store;
    let nfs;
    let controller;

    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = `
            <input id="cfgDays" />
            <input id="cfgAvailCoef" />
            <input id="cfgProduct" />
            <input id="cfgStartDate" />
            <input id="cfgEndDate" />
            <input id="cfgAlert" />
            <button id="resetConfigBtn"></button>
        `;

        store = {
            state: {
                config: {
                    product: 'P',
                    days: 10,
                    startDate: '',
                    endDate: '',
                    availCoef: 93.5,
                    alert: 3
                }
            },
            getState: jest.fn(function getState() { return this.state; }),
            setConfig: jest.fn((next) => {
                store.state.config = { ...store.state.config, ...next };
            }),
            subscribe: jest.fn(() => () => { })
        };

        nfs = {
            parseInteger: (value) => Number.parseInt(value, 10) || 0,
            parseNumber: (value) => Number(String(value).replace(',', '.')),
            formatNumber: (value) => String(value).replace('.', ','),
            roundToDecimals: (value, decimals = 1) => {
                const factor = 10 ** decimals;
                return Math.round(value * factor) / factor;
            }
        };

        controller = new ConfigController(store, nfs);
        controller.init();
    });

    test('updates sprint days on input for realtime recalculation', () => {
        const daysInput = document.getElementById('cfgDays');
        daysInput.value = '12';
        daysInput.dispatchEvent(new Event('input', { bubbles: true }));

        expect(store.setConfig).toHaveBeenCalledWith({ days: 12 });
    });

    test('updates availability coefficient on input for realtime recalculation', () => {
        const availInput = document.getElementById('cfgAvailCoef');
        availInput.value = '95,5';
        availInput.dispatchEvent(new Event('input', { bubbles: true }));

        expect(store.setConfig).toHaveBeenCalledWith({ availCoef: 95.5 });
    });

    // ── handleProductChange ────────────────────────────────────────────────────

    test('updates product name on blur', () => {
        const productInput = document.getElementById('cfgProduct');
        productInput.value = 'NewProduct';
        productInput.dispatchEvent(new Event('blur', { bubbles: true }));

        expect(store.setConfig).toHaveBeenCalledWith({ product: 'NewProduct' });
    });

    test('does not update product when value unchanged', () => {
        store.state.config.product = 'P';
        const productInput = document.getElementById('cfgProduct');
        productInput.value = 'P';
        productInput.dispatchEvent(new Event('blur', { bubbles: true }));

        expect(store.setConfig).not.toHaveBeenCalled();
    });

    // ── handleAlertChange ──────────────────────────────────────────────────────

    test('updates alert threshold on blur', () => {
        const alertInput = document.getElementById('cfgAlert');
        alertInput.value = '5';
        alertInput.dispatchEvent(new Event('blur', { bubbles: true }));

        expect(store.setConfig).toHaveBeenCalledWith({ alert: 5 });
    });

    test('shows error for negative alert threshold', () => {
        const alertInput = document.getElementById('cfgAlert');
        alertInput.value = '-1';
        alertInput.dispatchEvent(new Event('blur', { bubbles: true }));

        expect(messageServiceMock.showMessage).toHaveBeenCalled();
        expect(store.setConfig).not.toHaveBeenCalled();
    });

    // ── handleStartDateChange ──────────────────────────────────────────────────

    test('updates start date on change', () => {
        const startInput = document.getElementById('cfgStartDate');
        startInput.value = '01.03.2026';
        startInput.dispatchEvent(new Event('change', { bubbles: true }));

        expect(store.setConfig).toHaveBeenCalledWith(expect.objectContaining({ startDate: '01.03.2026' }));
    });

    test('shows error for invalid start date format', () => {
        const startInput = document.getElementById('cfgStartDate');
        startInput.value = 'invalid-date';
        startInput.dispatchEvent(new Event('change', { bubbles: true }));

        expect(messageServiceMock.showMessage).toHaveBeenCalled();
        expect(store.setConfig).not.toHaveBeenCalled();
    });

    // ── handleEndDateChange ────────────────────────────────────────────────────

    test('updates end date on change', () => {
        const endInput = document.getElementById('cfgEndDate');
        endInput.value = '15.03.2026';
        endInput.dispatchEvent(new Event('change', { bubbles: true }));

        expect(store.setConfig).toHaveBeenCalledWith({ endDate: '15.03.2026' });
    });

    test('shows error for invalid end date format', () => {
        const endInput = document.getElementById('cfgEndDate');
        endInput.value = 'bad-date';
        endInput.dispatchEvent(new Event('change', { bubbles: true }));

        expect(messageServiceMock.showMessage).toHaveBeenCalled();
        expect(store.setConfig).not.toHaveBeenCalled();
    });

    // ── handleDaysChange (blur) ────────────────────────────────────────────────

    test('shows error for non-positive days on blur', () => {
        const daysInput = document.getElementById('cfgDays');
        daysInput.value = '0';
        daysInput.dispatchEvent(new Event('blur', { bubbles: true }));

        expect(messageServiceMock.showMessage).toHaveBeenCalled();
    });

    // ── handleAvailCoefChange (blur) ───────────────────────────────────────────

    test('shows error for out-of-range availCoef on blur', () => {
        const availInput = document.getElementById('cfgAvailCoef');
        availInput.value = '150';
        availInput.dispatchEvent(new Event('blur', { bubbles: true }));

        expect(messageServiceMock.showMessage).toHaveBeenCalled();
    });

    // ── handleResetConfig ──────────────────────────────────────────────────────

    test('resets config to defaults on button click', () => {
        const resetBtn = document.getElementById('resetConfigBtn');
        resetBtn.click();

        expect(store.setConfig).toHaveBeenCalled();
        expect(messageServiceMock.showMessage).toHaveBeenCalledWith(expect.stringContaining('сброшена'));
    });

    // ── applyDays deduplication ─────────────────────────────────────────────

    test('applyDays does not update when days unchanged', () => {
        store.state.config.days = 10;
        const daysInput = document.getElementById('cfgDays');
        daysInput.value = '10';
        daysInput.dispatchEvent(new Event('input', { bubbles: true }));

        expect(store.setConfig).not.toHaveBeenCalled();
    });

    test('applyDays recalculates endDate when startDate is set', () => {
        store.state.config.startDate = '01.01.2026';
        store.state.config.endDate = '10.01.2026';
        store.state.config.days = 10;
        const daysInput = document.getElementById('cfgDays');
        daysInput.value = '15';
        daysInput.dispatchEvent(new Event('input', { bubbles: true }));

        expect(store.setConfig).toHaveBeenCalledWith(expect.objectContaining({ days: 15 }));
    });

    // ── applyAvailCoef deduplication ────────────────────────────────────────

    test('applyAvailCoef does not update when unchanged', () => {
        store.state.config.availCoef = 93.5;
        const availInput = document.getElementById('cfgAvailCoef');
        availInput.value = '93,5';
        availInput.dispatchEvent(new Event('input', { bubbles: true }));

        expect(store.setConfig).not.toHaveBeenCalled();
    });

    // ── handleDaysInput empty ──────────────────────────────────────────────

    test('handleDaysInput ignores empty value', () => {
        const daysInput = document.getElementById('cfgDays');
        daysInput.value = '';
        daysInput.dispatchEvent(new Event('input', { bubbles: true }));

        expect(store.setConfig).not.toHaveBeenCalled();
    });

    test('handleDaysInput ignores zero or negative', () => {
        const daysInput = document.getElementById('cfgDays');
        daysInput.value = '-5';
        daysInput.dispatchEvent(new Event('input', { bubbles: true }));

        expect(store.setConfig).not.toHaveBeenCalled();
    });

    // ── handleDaysChange valid ─────────────────────────────────────────────

    test('handleDaysChange updates on blur with valid days', () => {
        const daysInput = document.getElementById('cfgDays');
        daysInput.value = '14';
        daysInput.dispatchEvent(new Event('blur', { bubbles: true }));

        expect(store.setConfig).toHaveBeenCalledWith(expect.objectContaining({ days: 14 }));
    });

    // ── handleAvailCoefInput edge ──────────────────────────────────────────

    test('handleAvailCoefInput ignores empty value', () => {
        const availInput = document.getElementById('cfgAvailCoef');
        availInput.value = '';
        availInput.dispatchEvent(new Event('input', { bubbles: true }));

        expect(store.setConfig).not.toHaveBeenCalled();
    });

    test('handleAvailCoefInput ignores NaN', () => {
        const availInput = document.getElementById('cfgAvailCoef');
        availInput.value = 'abc';
        availInput.dispatchEvent(new Event('input', { bubbles: true }));

        expect(store.setConfig).not.toHaveBeenCalled();
    });

    test('handleAvailCoefInput ignores negative value', () => {
        const availInput = document.getElementById('cfgAvailCoef');
        availInput.value = '-5';
        availInput.dispatchEvent(new Event('input', { bubbles: true }));

        expect(store.setConfig).not.toHaveBeenCalled();
    });

    // ── handleAvailCoefChange valid ────────────────────────────────────────

    test('handleAvailCoefChange updates on blur with valid value', () => {
        store.state.config.availCoef = 50;
        const availInput = document.getElementById('cfgAvailCoef');
        availInput.value = '85';
        availInput.dispatchEvent(new Event('blur', { bubbles: true }));

        expect(store.setConfig).toHaveBeenCalledWith({ availCoef: 85 });
    });

    // ── handleStartDateChange same date ────────────────────────────────────

    test('handleStartDateChange does not update when date unchanged', () => {
        store.state.config.startDate = '01.03.2026';
        const startInput = document.getElementById('cfgStartDate');
        startInput.value = '01.03.2026';
        startInput.dispatchEvent(new Event('change', { bubbles: true }));

        expect(store.setConfig).not.toHaveBeenCalled();
    });

    // ── handleEndDateChange same date ──────────────────────────────────────

    test('handleEndDateChange does not update when date unchanged', () => {
        store.state.config.endDate = '15.03.2026';
        const endInput = document.getElementById('cfgEndDate');
        endInput.value = '15.03.2026';
        endInput.dispatchEvent(new Event('change', { bubbles: true }));

        expect(store.setConfig).not.toHaveBeenCalled();
    });

    // ── handleAlertChange same value ───────────────────────────────────────

    test('handleAlertChange does not update when unchanged', () => {
        store.state.config.alert = 5;
        const alertInput = document.getElementById('cfgAlert');
        alertInput.value = '5';
        alertInput.dispatchEvent(new Event('blur', { bubbles: true }));

        expect(store.setConfig).not.toHaveBeenCalled();
    });

    // ── calculateEndDate ───────────────────────────────────────────────────

    test('calculateEndDate returns empty for missing startDate', () => {
        expect(controller.calculateEndDate('', 10)).toBe('');
    });

    test('calculateEndDate returns empty for missing days', () => {
        expect(controller.calculateEndDate('01.01.2026', 0)).toBe('');
    });

    test('calculateEndDate returns valid date for valid inputs', () => {
        const result = controller.calculateEndDate('01.01.2026', 10);
        expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    });

    // ── updateInputsFromState with null config ─────────────────────────────

    test('updateInputsFromState handles null config', () => {
        expect(() => controller.updateInputsFromState(null)).not.toThrow();
    });

    // ── destroy ────────────────────────────────────────────────────────────

    test('destroy unsubscribes from store', () => {
        controller.destroy();
        // Second destroy should not throw
        expect(() => controller.destroy()).not.toThrow();
    });
});
