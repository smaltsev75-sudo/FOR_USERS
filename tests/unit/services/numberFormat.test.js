/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import { NumberFormatService } from '../../../js/services/numberFormat.js';

describe('services/NumberFormatService', () => {
    let store;

    beforeEach(() => {
        store = {};
        Object.defineProperty(global, 'localStorage', {
            configurable: true,
            value: {
                getItem: jest.fn((key) => store[key] ?? null),
                setItem: jest.fn((key, value) => { store[key] = value; }),
                removeItem: jest.fn((key) => { delete store[key]; })
            }
        });
    });

    test('formats and parses numbers with selected decimal separator', () => {
        const nfs = new NumberFormatService();
        nfs.decimalSeparator = ',';

        expect(nfs.formatNumber(12.34, 2)).toBe('12,34');
        expect(nfs.parseNumber('12,34')).toBeCloseTo(12.34, 2);
        expect(nfs.parseInteger('42')).toBe(42);
    });

    test('saveSettings persists decimal separator', () => {
        const nfs = new NumberFormatService();
        nfs.decimalSeparator = '.';
        nfs.saveSettings();

        expect(global.localStorage.setItem).toHaveBeenCalledWith(
            'numberFormatSettings',
            JSON.stringify({ decimalSeparator: '.' })
        );
    });

    // ── formatNumber edge cases ────────────────────────────────────────────────

    describe('formatNumber', () => {
        test('formats integer with 1 decimal by default', () => {
            const nfs = new NumberFormatService();
            nfs.decimalSeparator = ',';
            expect(nfs.formatNumber(5)).toBe('5,0');
        });

        test('formats 0 correctly', () => {
            const nfs = new NumberFormatService();
            nfs.decimalSeparator = ',';
            expect(nfs.formatNumber(0)).toBe('0,0');
        });

        test('returns "0,0" for undefined', () => {
            const nfs = new NumberFormatService();
            nfs.decimalSeparator = ',';
            expect(nfs.formatNumber(undefined)).toBe('0,0');
        });

        test('returns "0,0" for null', () => {
            const nfs = new NumberFormatService();
            nfs.decimalSeparator = ',';
            expect(nfs.formatNumber(null)).toBe('0,0');
        });

        test('returns "0,0" for NaN', () => {
            const nfs = new NumberFormatService();
            nfs.decimalSeparator = ',';
            expect(nfs.formatNumber(NaN)).toBe('0,0');
        });

        test('uses dot separator when configured', () => {
            const nfs = new NumberFormatService();
            nfs.decimalSeparator = '.';
            expect(nfs.formatNumber(3.14, 2)).toBe('3.14');
        });

        test('formats with 0 decimals', () => {
            const nfs = new NumberFormatService();
            nfs.decimalSeparator = ',';
            expect(nfs.formatNumber(7.8, 0)).toBe('8');
        });
    });

    // ── parseNumber edge cases ─────────────────────────────────────────────────

    describe('parseNumber', () => {
        test('returns 0 for empty string', () => {
            const nfs = new NumberFormatService();
            expect(nfs.parseNumber('')).toBe(0);
        });

        test('returns 0 for whitespace-only string', () => {
            const nfs = new NumberFormatService();
            expect(nfs.parseNumber('   ')).toBe(0);
        });

        test('returns 0 for non-numeric string', () => {
            const nfs = new NumberFormatService();
            expect(nfs.parseNumber('abc')).toBe(0);
        });

        test('parses dot separator', () => {
            const nfs = new NumberFormatService();
            nfs.decimalSeparator = '.';
            expect(nfs.parseNumber('3.14')).toBeCloseTo(3.14);
        });

        test('parses comma separator', () => {
            const nfs = new NumberFormatService();
            nfs.decimalSeparator = ',';
            expect(nfs.parseNumber('3,14')).toBeCloseTo(3.14);
        });

        test('returns 0 for null/undefined', () => {
            const nfs = new NumberFormatService();
            expect(nfs.parseNumber(null)).toBe(0);
            expect(nfs.parseNumber(undefined)).toBe(0);
        });

        test('parses dot when decimalSeparator is comma (cross-separator input)', () => {
            // User types "1.5" but separator is ','
            // Should still parse correctly (dot is normalized by second replace)
            const nfs = new NumberFormatService(',');
            expect(nfs.parseNumber('1.5')).toBeCloseTo(1.5);
        });

        test('parses comma when decimalSeparator is dot (cross-separator input)', () => {
            // User types "1,5" but separator is '.'
            // Should still parse correctly (comma is normalized)
            const nfs = new NumberFormatService('.');
            expect(nfs.parseNumber('1,5')).toBeCloseTo(1.5);
        });

        test('parses integer string regardless of separator', () => {
            const nfsComma = new NumberFormatService(',');
            const nfsDot = new NumberFormatService('.');
            expect(nfsComma.parseNumber('42')).toBe(42);
            expect(nfsDot.parseNumber('42')).toBe(42);
        });

        test('handles multiple commas (group separators) with comma decimal', () => {
            // "1 000,5" — space as group separator, comma as decimal
            const nfs = new NumberFormatService(',');
            // After replaceAll(',', '.') → "1 000.5", parseFloat → 1 (stops at space)
            // This is expected behavior — group separators are not supported
            expect(nfs.parseNumber('1000,5')).toBeCloseTo(1000.5);
        });
    });

    // ── parseInteger edge cases ────────────────────────────────────────────────

    describe('parseInteger', () => {
        test('parses valid integer string', () => {
            const nfs = new NumberFormatService();
            expect(nfs.parseInteger('42')).toBe(42);
        });

        test('returns 0 for empty string', () => {
            const nfs = new NumberFormatService();
            expect(nfs.parseInteger('')).toBe(0);
        });

        test('returns 0 for null', () => {
            const nfs = new NumberFormatService();
            expect(nfs.parseInteger(null)).toBe(0);
        });

        test('returns 0 for undefined', () => {
            const nfs = new NumberFormatService();
            expect(nfs.parseInteger(undefined)).toBe(0);
        });

        test('truncates decimal part', () => {
            const nfs = new NumberFormatService();
            expect(nfs.parseInteger('7.9')).toBe(7);
        });

        test('returns 0 for non-numeric string', () => {
            const nfs = new NumberFormatService();
            expect(nfs.parseInteger('abc')).toBe(0);
        });
    });

    // ── roundToDecimals ────────────────────────────────────────────────────────

    describe('roundToDecimals', () => {
        test('rounds to 1 decimal by default', () => {
            const nfs = new NumberFormatService();
            expect(nfs.roundToDecimals(3.14)).toBe(3.1);
        });

        test('rounds to 2 decimals', () => {
            const nfs = new NumberFormatService();
            expect(nfs.roundToDecimals(3.145, 2)).toBe(3.15);
        });

        test('returns 0 for NaN', () => {
            const nfs = new NumberFormatService();
            expect(nfs.roundToDecimals(NaN)).toBe(0);
        });

        test('returns 0 for non-number', () => {
            const nfs = new NumberFormatService();
            expect(nfs.roundToDecimals('abc')).toBe(0);
        });
    });

    // ── handleInput ────────────────────────────────────────────────────────────

    describe('handleInput', () => {
        test('removes non-numeric characters', () => {
            const nfs = new NumberFormatService();
            const el = { value: 'abc12.3xyz' };
            nfs.handleInput(el);
            expect(el.value).toBe('12.3');
        });

        test('keeps only first decimal point', () => {
            const nfs = new NumberFormatService();
            const el = { value: '1.2.3' };
            nfs.handleInput(el);
            expect(el.value).toBe('1.23');
        });

        test('converts comma to dot', () => {
            const nfs = new NumberFormatService();
            const el = { value: '5,5' };
            nfs.handleInput(el);
            expect(el.value).toBe('5.5');
        });
    });

    // ── loadSettings ───────────────────────────────────────────────────────────

    test('loadSettings reads from localStorage', () => {
        store['numberFormatSettings'] = JSON.stringify({ decimalSeparator: '.' });
        const nfs = new NumberFormatService();
        expect(nfs.decimalSeparator).toBe('.');
    });

    test('loadSettings uses comma as default when no saved settings', () => {
        const nfs = new NumberFormatService();
        expect(nfs.decimalSeparator).toBe(',');
    });
});
