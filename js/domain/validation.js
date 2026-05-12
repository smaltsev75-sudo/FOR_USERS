
// js/domain/validation.js

import { APP_CONFIG } from '../utils/appConfig.js';

/**
 * Проверяет корректность названия задачи.
 * @param {string} title - Название задачи.
 * @returns {{valid: boolean, message?: string}} Объект с результатом валидации.
 */
export function validateTitle(title) {
    if (!title || !title.trim()) return { valid: false, message: 'Название задачи обязательно для заполнения' };
    if (title.length < APP_CONFIG.VALIDATION.TITLE_MIN_LENGTH) return { valid: false, message: 'Название задачи должно содержать не менее 5 символов' };
    if (title.length > APP_CONFIG.VALIDATION.TITLE_MAX_LENGTH) return { valid: false, message: 'Название задачи должно содержать не более 150 символов' };
    return { valid: true };
}

/**
 * Проверяет корректность ссылки JIRA.
 * @param {string} url - Ссылка JIRA.
 * @returns {{valid: boolean, message?: string}} Объект с результатом валидации.
 */
export function validateJiraUrl(url) {
    if (!url || !url.trim()) return { valid: false, message: 'Ссылка JIRA обязательна для заполнения' };
    if (url.length < APP_CONFIG.VALIDATION.JIRA_URL_MIN_LENGTH) return { valid: false, message: 'Ссылка JIRA должна содержать не менее 10 символов' };
    if (!url.toLowerCase().startsWith('https://') && !url.toLowerCase().startsWith('http://')) {
        return { valid: false, message: 'Ссылка JIRA должна начинаться с https:// или http://' };
    }
    if (url.toLowerCase().includes('javascript:')) return { valid: false, message: 'Недопустимый формат ссылки' };
    return { valid: true };
}

/**
 * Проверяет уникальность названия задачи.
 * @param {Array} tasks - Массив всех задач.
 * @param {string} title - Проверяемое название.
 * @param {number|null} excludeTaskId - ID задачи, которую нужно исключить из проверки (при редактировании).
 * @returns {boolean} Уникально ли название.
 */
export function isTitleUnique(tasks, title, excludeTaskId = null) {
    if (!title) return true;
    return !tasks.some(task => {
        if (excludeTaskId !== null && task.id === excludeTaskId) return false;
        return task.title.toLowerCase() === title.toLowerCase();
    });
}

/**
 * Проверяет уникальность ссылки JIRA.
 * @param {Array} tasks - Массив всех задач.
 * @param {string} url - Проверяемая ссылка.
 * @param {number|null} excludeTaskId - ID задачи, которую нужно исключить из проверки (при редактировании).
 * @returns {boolean} Уникальна ли ссылка.
 */
export function isJiraUrlUnique(tasks, url, excludeTaskId = null) {
    if (!url) return true;
    return !tasks.some(task => {
        if (excludeTaskId !== null && task.id === excludeTaskId) return false;
        return task.jira.toLowerCase() === url.toLowerCase();
    });
}

/**
 * Проверяет корректность аббревиатуры критерия.
 * @param {string} abbreviation - Аббревиатура.
 * @returns {{valid: boolean, message?: string}} Объект с результатом валидации.
 */
export function validateAbbreviation(abbreviation) {
    if (!abbreviation || !abbreviation.trim()) return { valid: false, message: 'Аббревиатура обязательна для заполнения' };
    const trimmed = abbreviation.trim();
    if (trimmed.length < APP_CONFIG.VALIDATION.ABBREVIATION_MIN_LENGTH || trimmed.length > APP_CONFIG.VALIDATION.ABBREVIATION_MAX_LENGTH) return { valid: false, message: 'Аббревиатура должна содержать от 1 до 5 символов' };
    if (abbreviation.includes(' ')) return { valid: false, message: 'Аббревиатура не должна содержать пробелов' };
    const firstChar = trimmed[0];
    if (!/^[A-ZА-Я0-9]$/i.test(firstChar)) return { valid: false, message: 'Первый символ аббревиатуры должен быть буквой или цифрой' };
    return { valid: true };
}

/**
 * Проверяет уникальность аббревиатуры критерия.
 * @param {Array} criteria - Массив всех критериев.
 * @param {string} abbreviation - Проверяемая аббревиатура.
 * @param {number|null} excludeCriteriaId - ID критерия для исключения.
 * @returns {boolean} Уникальна ли аббревиатура.
 */
export function isAbbreviationUnique(criteria, abbreviation, excludeCriteriaId = null) {
    if (!abbreviation) return true;
    const normalized = abbreviation.toUpperCase();
    return !criteria.some(criterion => {
        if (excludeCriteriaId !== null && criterion.id === excludeCriteriaId) return false;
        return criterion.abbreviation.toUpperCase() === normalized;
    });
}

/**
 * Генерирует аббревиатуру из названия критерия.
 * @param {string} name - Название критерия.
 * @returns {string} Аббревиатура (до 5 символов, в верхнем регистре).
 */
export function generateAbbreviation(name) {
    if (!name || name.length < 1) return 'CRT';
    const withoutSpaces = name.replace(/\s+/g, '');
    const firstLetterOrDigit = withoutSpaces.match(/[A-ZА-Я0-9]/i);
    if (!firstLetterOrDigit) return 'CRT';
    const startIndex = withoutSpaces.indexOf(firstLetterOrDigit[0]);
    const abbreviation = withoutSpaces.substring(startIndex, startIndex + 5);
    return abbreviation.toUpperCase();
}






