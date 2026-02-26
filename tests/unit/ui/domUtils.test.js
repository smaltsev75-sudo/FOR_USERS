/**
 * @jest-environment jsdom
 */
import { createElement, addClass, removeClass, setHTML, append, escapeHtml, clearChildren } from '../../../js/ui/domUtils.js';

describe('ui/domUtils', () => {
    // ── createElement ─────────────────────────────────────────────────────

    describe('createElement', () => {
        test('creates element with given tag', () => {
            const el = createElement('div');
            expect(el.tagName).toBe('DIV');
        });

        test('sets className from classes array', () => {
            const el = createElement('span', { classes: ['foo', 'bar'] });
            expect(el.className).toBe('foo bar');
        });

        test('sets attributes from attrs object', () => {
            const el = createElement('input', { attrs: { type: 'text', placeholder: 'Enter' } });
            expect(el.getAttribute('type')).toBe('text');
            expect(el.getAttribute('placeholder')).toBe('Enter');
        });

        test('sets innerHTML from html option', () => {
            const el = createElement('div', { html: '<b>Hello</b>' });
            expect(el.innerHTML).toBe('<b>Hello</b>');
        });

        test('works with no options', () => {
            const el = createElement('p');
            expect(el.tagName).toBe('P');
            expect(el.className).toBe('');
        });

        test('works with empty options object', () => {
            const el = createElement('section', {});
            expect(el.tagName).toBe('SECTION');
        });
    });

    // ── addClass ──────────────────────────────────────────────────────────

    describe('addClass', () => {
        test('adds class to element', () => {
            const el = document.createElement('div');
            addClass(el, 'active');
            expect(el.classList.contains('active')).toBe(true);
        });

        test('does nothing when el is null', () => {
            expect(() => addClass(null, 'active')).not.toThrow();
        });

        test('does nothing when className is empty string', () => {
            const el = document.createElement('div');
            expect(() => addClass(el, '')).not.toThrow();
        });
    });

    // ── removeClass ───────────────────────────────────────────────────────

    describe('removeClass', () => {
        test('removes class from element', () => {
            const el = document.createElement('div');
            el.classList.add('active');
            removeClass(el, 'active');
            expect(el.classList.contains('active')).toBe(false);
        });

        test('does nothing when el is null', () => {
            expect(() => removeClass(null, 'active')).not.toThrow();
        });

        test('does nothing when className is empty string', () => {
            const el = document.createElement('div');
            el.classList.add('foo');
            expect(() => removeClass(el, '')).not.toThrow();
            expect(el.classList.contains('foo')).toBe(true);
        });
    });

    // ── setHTML ───────────────────────────────────────────────────────────

    describe('setHTML', () => {
        test('sets innerHTML on element', () => {
            const el = document.createElement('div');
            setHTML(el, '<span>test</span>');
            expect(el.innerHTML).toBe('<span>test</span>');
        });

        test('does nothing when el is null', () => {
            expect(() => setHTML(null, '<b>x</b>')).not.toThrow();
        });

        test('clears content when html is empty string', () => {
            const el = document.createElement('div');
            el.innerHTML = '<b>old</b>';
            setHTML(el, '');
            expect(el.innerHTML).toBe('');
        });
    });

    // ── append ────────────────────────────────────────────────────────────

    describe('append', () => {
        test('appends child to parent', () => {
            const parent = document.createElement('div');
            const child = document.createElement('span');
            append(parent, child);
            expect(parent.firstChild).toBe(child);
        });

        test('does nothing when parent is null', () => {
            const child = document.createElement('span');
            expect(() => append(null, child)).not.toThrow();
        });

        test('does nothing when child is null', () => {
            const parent = document.createElement('div');
            expect(() => append(parent, null)).not.toThrow();
            expect(parent.childNodes.length).toBe(0);
        });
    });

    // ── escapeHtml ────────────────────────────────────────────────────────

    describe('escapeHtml', () => {
        test('экранирует HTML-спецсимволы', () => {
            expect(escapeHtml('<script>alert("xss")</script>'))
                .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
        });

        test('экранирует амперсанд', () => {
            expect(escapeHtml('A & B')).toBe('A &amp; B');
        });

        test('экранирует одинарные кавычки', () => {
            expect(escapeHtml("it's")).toBe("it&#039;s");
        });

        test('возвращает пустую строку для null/undefined/пустой строки', () => {
            expect(escapeHtml(null)).toBe('');
            expect(escapeHtml(undefined)).toBe('');
            expect(escapeHtml('')).toBe('');
        });

        test('преобразует числа в строку', () => {
            expect(escapeHtml(42)).toBe('42');
        });

        test('не меняет безопасный текст', () => {
            expect(escapeHtml('Hello World')).toBe('Hello World');
        });
    });

    // ── clearChildren ─────────────────────────────────────────────────────

    describe('clearChildren', () => {
        test('удаляет все дочерние элементы', () => {
            const div = document.createElement('div');
            div.innerHTML = '<span>1</span><span>2</span>';
            expect(div.children.length).toBe(2);
            clearChildren(div);
            expect(div.children.length).toBe(0);
        });

        test('безопасен для null', () => {
            expect(() => clearChildren(null)).not.toThrow();
        });
    });

    // ── createElement с text ──────────────────────────────────────────────

    describe('createElement (text option)', () => {
        test('устанавливает textContent через options.text', () => {
            const el = createElement('span', { text: 'Hello' });
            expect(el.textContent).toBe('Hello');
        });
    });
});
