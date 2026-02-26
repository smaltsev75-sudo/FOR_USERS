import { jest } from '@jest/globals';
import { NumberFormatService } from '../../../js/services/numberFormat.js';
import { getNFS, updateTabTitle } from '../../../js/ui/utils.js';

describe('ui/utils', () => {
    test('getNFS returns provided instance', () => {
        const nfs = { parseNumber: () => 1 };
        expect(getNFS(nfs)).toBe(nfs);
    });

    test('getNFS creates NumberFormatService when missing', () => {
        Object.defineProperty(global, 'localStorage', {
            configurable: true,
            value: { getItem: jest.fn(() => null), setItem: jest.fn() }
        });
        const nfs = getNFS();
        expect(nfs instanceof NumberFormatService).toBe(true);
    });

    test('updateTabTitle updates criteria tab label', () => {
        document.body.innerHTML = '<button class="tab-btn" data-tab="criteria"></button>';
        updateTabTitle({ criteria: [{ id: 1 }, { id: 2 }] });
        const btn = document.querySelector('.tab-btn[data-tab="criteria"]');
        expect(btn.innerHTML).toContain('Критерии оценки (2)');
    });
});
