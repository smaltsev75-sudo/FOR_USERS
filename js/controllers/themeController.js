// js/controllers/themeController.js

import { ICONS } from '../utils/icons.js';
import { getCommand } from '../config/commands.js';

const THEME_KEY = 'sprintPlannerTheme';
const DARK = 'dark';
const LIGHT = 'light';
const THEME_COMMAND = getCommand('theme');

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

        // v8.30.3: try/catch вокруг getItem — Safari private mode и заблокированный
        // Storage Access бросают SecurityError. Без обёртки init() падал и тогглер
        // не подключался. Симметрично _applyTheme, где setItem уже в try/catch.
        let saved = null;
        try { saved = localStorage.getItem(THEME_KEY); } catch { /* SecurityError → fallback */ }
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
        // v8.30.2: try/catch вокруг setItem — quota/security error не должен
        // ломать смену темы (UI важнее persist'а темы; в худшем случае тема
        // не сохранится между сессиями, но текущая работа продолжится).
        // Тот же класс ошибки, что я починил в storage.save и numberFormat.saveSettings.
        try {
            localStorage.setItem(THEME_KEY, theme);
        } catch { /* SecurityError / QuotaExceededError — тема применена в DOM, persist optional */ }
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
            labelEl.textContent = THEME_COMMAND.label;
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
