// js/controllers/themeController.js

const THEME_KEY = 'sprintPlannerTheme';
const DARK = 'dark';
const LIGHT = 'light';

/**
 * Контроллер переключения светлой/тёмной темы.
 * Сохраняет выбор в localStorage, применяет data-theme на <html>.
 */
export class ThemeController {
    constructor() {
        this._btn = null;
    }

    init() {
        this._btn = document.getElementById('themeToggleBtn');
        if (!this._btn) return;

        // Восстанавливаем тему из localStorage (или системные предпочтения)
        const saved = localStorage.getItem(THEME_KEY);
        const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
        const initial = saved || (prefersDark ? DARK : LIGHT);
        this._applyTheme(initial);

        this._btn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || DARK;
            this._applyTheme(current === DARK ? LIGHT : DARK);
        });
    }

    _applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);
        if (this._btn) {
            this._btn.textContent = theme === LIGHT ? '🌙 Тема' : '☀️ Тема';
            this._btn.title = theme === LIGHT
                ? 'Переключить на тёмную тему'
                : 'Переключить на светлую тему';
        }
    }

    /**
     * Возвращает текущую тему.
     * @returns {'dark'|'light'}
     */
    getTheme() {
        return document.documentElement.getAttribute('data-theme') || DARK;
    }
}
