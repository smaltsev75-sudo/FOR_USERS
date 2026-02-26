import { jest } from '@jest/globals';
import { RoleController } from '../../../js/controllers/roleController.js';

describe('controllers/roleController', () => {
    let store;
    let nfs;
    let controller;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="roleList">
                <input data-role="fe" data-field="fte" value="80" />
                <input data-role="fe" data-field="off" value="1" />
                <input data-role="be" data-field="fte" value="100" />
            </div>
        `;

        store = {
            getState: jest.fn(() => ({
                roles: [
                    { id: 'fe', fte: 70, off: 2 },
                    { id: 'be', fte: 100, off: 0 }
                ]
            })),
            updateRole: jest.fn()
        };
        nfs = {
            parseNumber: (value) => Number(String(value).replace(',', '.')),
            formatNumber: (value, decimals) => Number(value).toFixed(decimals ?? 0)
        };
        controller = new RoleController(store, nfs);
        controller.init();
    });

    // ── handleRoleInput ───────────────────────────────────────────────────────

    test('updates fte on input without waiting for blur', () => {
        const fte = document.querySelector('[data-role="fe"][data-field="fte"]');
        fte.value = '85';
        fte.dispatchEvent(new Event('input', { bubbles: true }));

        expect(store.updateRole).toHaveBeenCalledWith('fe', { fte: 85 });
    });

    test('updates off on input without waiting for blur', () => {
        const off = document.querySelector('[data-role="fe"][data-field="off"]');
        off.value = '3';
        off.dispatchEvent(new Event('input', { bubbles: true }));

        expect(store.updateRole).toHaveBeenCalledWith('fe', { off: 3 });
    });

    test('handleRoleInput ignores elements without role dataset', () => {
        const event = { target: { dataset: {}, value: '50' } };
        controller.handleRoleInput(event);

        expect(store.updateRole).not.toHaveBeenCalled();
    });

    test('handleRoleInput ignores elements without field dataset', () => {
        const event = { target: { dataset: { role: 'fe' }, value: '50' } };
        controller.handleRoleInput(event);

        expect(store.updateRole).not.toHaveBeenCalled();
    });

    test('handleRoleInput ignores NaN fte values', () => {
        const event = { target: { dataset: { role: 'fe', field: 'fte' }, value: 'abc' } };
        controller.handleRoleInput(event);

        expect(store.updateRole).not.toHaveBeenCalled();
    });

    test('handleRoleInput ignores NaN off values', () => {
        const event = { target: { dataset: { role: 'fe', field: 'off' }, value: 'abc' } };
        controller.handleRoleInput(event);

        expect(store.updateRole).not.toHaveBeenCalled();
    });

    // ── handleRoleUpdate ──────────────────────────────────────────────────────

    test('handleRoleUpdate updates role via change event', () => {
        const fte = document.querySelector('[data-role="fe"][data-field="fte"]');
        fte.value = '90';
        fte.dispatchEvent(new Event('change', { bubbles: true }));

        expect(store.updateRole).toHaveBeenCalledWith('fe', { fte: 90 });
    });

    test('handleRoleUpdate ignores elements without role dataset', () => {
        const event = { target: { dataset: {}, value: '50' } };
        controller.handleRoleUpdate(event);

        expect(store.updateRole).not.toHaveBeenCalled();
    });

    test('handleRoleUpdate ignores elements without field dataset', () => {
        const event = { target: { dataset: { role: 'fe' }, value: '50' } };
        controller.handleRoleUpdate(event);

        expect(store.updateRole).not.toHaveBeenCalled();
    });

    test('handleRoleUpdate ignores non-existent role', () => {
        const event = { target: { dataset: { role: 'nonexistent', field: 'fte' }, value: '50' } };
        controller.handleRoleUpdate(event);

        expect(store.updateRole).not.toHaveBeenCalled();
    });

    test('handleRoleUpdate ignores NaN values', () => {
        const event = { target: { dataset: { role: 'fe', field: 'fte' }, value: 'abc' } };
        controller.handleRoleUpdate(event);

        expect(store.updateRole).not.toHaveBeenCalled();
    });

    // ── handleRoleBlur ────────────────────────────────────────────────────────

    test('handleRoleBlur formats fte value on blur', () => {
        const fte = document.querySelector('[data-role="fe"][data-field="fte"]');
        fte.value = '85';
        fte.dispatchEvent(new Event('blur', { bubbles: true }));

        // Role state says fte=70, so it should format to "70"
        expect(fte.value).toBe('70');
    });

    test('handleRoleBlur formats off value on blur', () => {
        const off = document.querySelector('[data-role="fe"][data-field="off"]');
        off.value = '5';
        off.dispatchEvent(new Event('blur', { bubbles: true }));

        // Role state says off=2, so it should restore to "2"
        expect(off.value).toBe('2');
    });

    test('handleRoleBlur ignores elements without role dataset', () => {
        const event = { target: { dataset: {}, value: '50' } };
        controller.handleRoleBlur(event);

        // No assertion needed — we just check it doesn't throw
    });

    test('handleRoleBlur ignores elements without field dataset', () => {
        const event = { target: { dataset: { role: 'fe' }, value: '50' } };
        controller.handleRoleBlur(event);
    });

    test('handleRoleBlur ignores non-existent role', () => {
        const event = { target: { dataset: { role: 'nonexistent', field: 'fte' }, value: '50' } };
        controller.handleRoleBlur(event);
    });

    // ── _parseRoleFieldValue ──────────────────────────────────────────────────

    test('_parseRoleFieldValue parses valid off value', () => {
        expect(controller._parseRoleFieldValue('off', '5')).toBe(5);
    });

    test('_parseRoleFieldValue clamps negative off to 0', () => {
        expect(controller._parseRoleFieldValue('off', '-3')).toBe(0);
    });

    test('_parseRoleFieldValue returns null for NaN off', () => {
        expect(controller._parseRoleFieldValue('off', 'abc')).toBeNull();
    });

    test('_parseRoleFieldValue parses valid fte value', () => {
        expect(controller._parseRoleFieldValue('fte', '100')).toBe(100);
    });

    test('_parseRoleFieldValue parses comma-separated fte', () => {
        expect(controller._parseRoleFieldValue('fte', '93,5')).toBe(94); // rounds
    });

    test('_parseRoleFieldValue clamps negative fte to 0', () => {
        expect(controller._parseRoleFieldValue('fte', '-10')).toBe(0);
    });

    test('_parseRoleFieldValue returns null for NaN fte', () => {
        expect(controller._parseRoleFieldValue('fte', 'abc')).toBeNull();
    });

    test('_parseRoleFieldValue returns null for unknown field', () => {
        expect(controller._parseRoleFieldValue('unknown', '50')).toBeNull();
    });

    // ── init / attachEvents ──────────────────────────────────────────────────

    test('init attaches event listeners to roleList', () => {
        // Verify that events work end-to-end via init
        const be = document.querySelector('[data-role="be"][data-field="fte"]');
        be.value = '80';
        be.dispatchEvent(new Event('input', { bubbles: true }));

        expect(store.updateRole).toHaveBeenCalledWith('be', { fte: 80 });
    });

    test('init handles missing roleList element', () => {
        document.body.innerHTML = ''; // No roleList
        const ctrl = new RoleController(store, nfs);
        expect(() => ctrl.init()).not.toThrow();
    });
});
