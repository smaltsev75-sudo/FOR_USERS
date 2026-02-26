// tests/unit/controllers/themeController.test.js

import { jest } from '@jest/globals';
import { ThemeController } from '../../../js/controllers/themeController.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createThemeButton() {
    const btn = document.createElement('button');
    btn.id = 'themeToggleBtn';
    document.body.appendChild(btn);
    return btn;
}

/**
 * Устанавливает мок для window.matchMedia.
 * @param {boolean} prefersDark — true, если system prefers dark
 */
function mockMatchMedia(prefersDark) {
    window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: prefersDark && query === '(prefers-color-scheme: dark)',
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        onchange: null,
        dispatchEvent: jest.fn(),
    }));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ThemeController', () => {
    let controller;
    let originalMatchMedia;

    beforeEach(() => {
        document.body.innerHTML = '';
        document.documentElement.removeAttribute('data-theme');
        localStorage.clear();

        // Сохраняем оригинал и устанавливаем мок по умолчанию (prefers dark)
        originalMatchMedia = window.matchMedia;
        mockMatchMedia(true);

        controller = new ThemeController();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        document.documentElement.removeAttribute('data-theme');
        localStorage.clear();
        window.matchMedia = originalMatchMedia;
    });

    // ── 1. Инициализация ────────────────────────────────────────────────────

    describe('init', () => {
        test('не падает, если кнопки нет в DOM', () => {
            expect(() => controller.init()).not.toThrow();
        });

        test('применяет тему из localStorage, если она сохранена', () => {
            createThemeButton();
            localStorage.setItem('sprintPlannerTheme', 'light');

            controller.init();

            expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        });

        test('без localStorage использует системные предпочтения (prefers dark)', () => {
            createThemeButton();
            mockMatchMedia(true);

            controller.init();

            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        test('без localStorage использует системные предпочтения (prefers light)', () => {
            createThemeButton();
            mockMatchMedia(false);

            controller.init();

            expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        });
    });

    // ── 2. Переключение по клику ────────────────────────────────────────────

    describe('click toggle', () => {
        test('переключает dark → light по клику', () => {
            const btn = createThemeButton();
            localStorage.setItem('sprintPlannerTheme', 'dark');

            controller.init();
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

            btn.click();

            expect(document.documentElement.getAttribute('data-theme')).toBe('light');
        });

        test('переключает light → dark по клику', () => {
            const btn = createThemeButton();
            localStorage.setItem('sprintPlannerTheme', 'light');

            controller.init();
            expect(document.documentElement.getAttribute('data-theme')).toBe('light');

            btn.click();

            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });
    });

    // ── 3. _applyTheme ──────────────────────────────────────────────────────

    describe('_applyTheme', () => {
        test('устанавливает data-theme на <html>', () => {
            createThemeButton();
            controller.init();

            controller._applyTheme('light');
            expect(document.documentElement.getAttribute('data-theme')).toBe('light');

            controller._applyTheme('dark');
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        test('сохраняет тему в localStorage', () => {
            createThemeButton();
            controller.init();

            controller._applyTheme('light');
            expect(localStorage.getItem('sprintPlannerTheme')).toBe('light');

            controller._applyTheme('dark');
            expect(localStorage.getItem('sprintPlannerTheme')).toBe('dark');
        });

        test('устанавливает текст кнопки 🌙 Тема для light-темы', () => {
            const btn = createThemeButton();
            controller.init();

            controller._applyTheme('light');

            expect(btn.textContent).toBe('🌙 Тема');
        });

        test('устанавливает текст кнопки ☀️ Тема для dark-темы', () => {
            const btn = createThemeButton();
            controller.init();

            controller._applyTheme('dark');

            expect(btn.textContent).toBe('☀️ Тема');
        });

        test('устанавливает title кнопки в зависимости от темы', () => {
            const btn = createThemeButton();
            controller.init();

            controller._applyTheme('light');
            expect(btn.title).toBe('Переключить на тёмную тему');

            controller._applyTheme('dark');
            expect(btn.title).toBe('Переключить на светлую тему');
        });
    });

    // ── 4. getTheme ─────────────────────────────────────────────────────────

    describe('getTheme', () => {
        test('возвращает текущую тему из data-theme', () => {
            createThemeButton();
            controller.init();

            controller._applyTheme('light');
            expect(controller.getTheme()).toBe('light');

            controller._applyTheme('dark');
            expect(controller.getTheme()).toBe('dark');
        });

        test('возвращает "dark" по умолчанию, если data-theme не установлен', () => {
            // Не вызываем init — data-theme не задан
            expect(controller.getTheme()).toBe('dark');
        });
    });
});
