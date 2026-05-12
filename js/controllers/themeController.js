// js/controllers/themeController.js

import { ICONS } from '../utils/icons.js';

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
        if (!this._btn) return;
        const iconEl = this._btn.querySelector('.theme-toggle-icon');
        const labelEl = this._btn.querySelector('.theme-toggle-label');
        // В тёмной теме показываем иконку «солнце» (для перехода в светлую),
        // в светлой — «луна» (для перехода в тёмную).
        const iconKey = theme === LIGHT ? 'moon' : 'sun';
        if (iconEl) {
            iconEl.innerHTML = ICONS[iconKey] || '';
        }
        if (labelEl) {
            labelEl.textContent = 'Тема';
        }
        this._btn.dataset.themeIcon = iconKey;
        this._btn.title = theme === LIGHT
            ? 'Переключить на тёмную тему'
            : 'Переключить на светлую тему';
        this._btn.setAttribute('aria-label', this._btn.title);
    }

    /**
     * Возвращает текущую тему.
     * @returns {'dark'|'light'}
     */
    getTheme() {
        return document.documentElement.getAttribute('data-theme') || DARK;
    }
}
