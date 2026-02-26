/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import { showSnackbar } from '../../../js/ui/snackbar.js';

describe('showSnackbar', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('создаёт snackbar в DOM', () => {
        showSnackbar('Hello');
        const el = document.getElementById('sp-snackbar');
        expect(el).not.toBeNull();
        expect(el.textContent).toContain('Hello');
    });

    test('добавляет класс sp-snackbar--show', () => {
        showSnackbar('Test');
        const el = document.getElementById('sp-snackbar');
        expect(el.classList.contains('sp-snackbar--show')).toBe(true);
    });

    test('автоматически скрывается через duration', () => {
        showSnackbar('Auto', { duration: 3000 });
        jest.advanceTimersByTime(3300);
        const el = document.getElementById('sp-snackbar');
        // элемент удаляется через 300мс после скрытия
        expect(el).toBeNull();
    });

    test('показывает кнопку Отменить при onUndo', () => {
        showSnackbar('Deleted', { onUndo: jest.fn() });
        const btn = document.querySelector('.sp-snackbar__undo');
        expect(btn).not.toBeNull();
        expect(btn.textContent).toBe('Отменить');
    });

    test('не показывает кнопку Отменить без onUndo', () => {
        showSnackbar('Info');
        const btn = document.querySelector('.sp-snackbar__undo');
        expect(btn).toBeNull();
    });

    test('вызывает onUndo при клике', () => {
        const undoFn = jest.fn();
        showSnackbar('Undo test', { onUndo: undoFn });
        const btn = document.querySelector('.sp-snackbar__undo');
        btn.click();
        expect(undoFn).toHaveBeenCalledTimes(1);
    });

    test('onUndo вызывается только один раз', () => {
        const undoFn = jest.fn();
        showSnackbar('Once', { onUndo: undoFn });
        const btn = document.querySelector('.sp-snackbar__undo');
        btn.click();
        btn.click();
        expect(undoFn).toHaveBeenCalledTimes(1);
    });

    test('dismiss() закрывает snackbar', () => {
        const { dismiss } = showSnackbar('Manual close');
        dismiss();
        jest.advanceTimersByTime(400);
        const el = document.getElementById('sp-snackbar');
        expect(el).toBeNull();
    });

    test('заменяет предыдущий snackbar', () => {
        showSnackbar('First');
        showSnackbar('Second');
        const els = document.querySelectorAll('#sp-snackbar');
        expect(els.length).toBe(1);
        expect(els[0].textContent).toContain('Second');
    });

    test('имеет атрибуты accessibility', () => {
        showSnackbar('A11y');
        const el = document.getElementById('sp-snackbar');
        expect(el.getAttribute('role')).toBe('status');
        expect(el.getAttribute('aria-live')).toBe('polite');
    });
});
