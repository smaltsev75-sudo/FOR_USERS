// @ts-check
// js/domain/role.js

import { APP_CONFIG } from '../utils/appConfig.js';
import { ROLES } from '../utils/constants.js';

/**
 * Создаёт массив ролей со значениями по умолчанию.
 * @returns {Array} Массив ролей.
 */
export function createDefaultRoles() {
    return ROLES.map(role => ({ ...role }));
}

/**
 * Рассчитывает доступную ёмкость роли (в часах).
 * @param {Object} role - Объект роли.
 * @param {Object} config - Конфигурация спринта.
 * @returns {{useful: number}} Доступное время.
 */
export function calculateAvailability(role, config) {
    const availableDays = Math.max(0, config.days - role.off);
    const max = availableDays * APP_CONFIG.CAPACITY.HOURS_PER_DAY * (role.fte / 100);
    const actual = max * (config.availCoef / 100);
    const selfDev = actual * APP_CONFIG.CAPACITY.SELF_DEVELOPMENT_PERCENT;
    const meetingHours = APP_CONFIG.CAPACITY.MEETING_HOURS_BASE * (role.fte / 100);
    const useful = Math.max(APP_CONFIG.CAPACITY.MINIMUM_USEFUL_HOURS, actual - meetingHours - selfDev);
    return { useful };
}

/**
 * Возвращает суммарную загрузку роли по всем задачам.
 * @param {string} roleId - Идентификатор роли.
 * @param {Array} tasks - Массив задач.
 * @param {boolean} excludedFlag - Учитывать исключённые задачи (true) или включённые (false).
 * @returns {number} Суммарная загрузка в часах.
 */
export function calculateRoleLoad(roleId, tasks, excludedFlag = false) {
    return tasks.reduce((sum, task) => {
        if (Boolean(task.excluded) !== excludedFlag) return sum;
        return sum + (task.est?.[roleId] || 0);
    }, 0);
}

/**
 * Рассчитывает общую загрузку команды.
 * @param {Array} roles - Массив ролей.
 * @param {Array} tasks - Массив задач.
 * @param {Object} config - Конфигурация спринта.
 * @returns {{totalAvailable: number, totalUsed: number, percentage: number}} Загрузка.
 */
export function calculateTeamLoad(roles, tasks, config) {
    let totalAvailable = 0, totalUsed = 0;
    roles.forEach(role => {
        const avail = calculateAvailability(role, config);
        totalAvailable += avail.useful;
        const used = tasks.reduce((sum, t) => {
            if (t.excluded) return sum;
            return sum + (t.est[role.id] || 0);
        }, 0);
        totalUsed += used;
    });
    return {
        totalAvailable,
        totalUsed,
        percentage: totalAvailable > 0 ? (totalUsed / totalAvailable * 100) : 0
    };
}

/**
 * Возвращает объект ёмкости по каждой роли.
 * @param {Array} roles - Массив ролей.
 * @param {Object} config - Конфигурация спринта.
 * @returns {Object} Ёмкость вида { uiux: число, ca: число, ... }.
 */
export function calculateCapacityByRole(roles, config) {
    const capacityByRole = {};
    roles.forEach(role => {
        const avail = calculateAvailability(role, config);
        capacityByRole[role.id] = avail.useful;
    });
    return capacityByRole;
}

/**
 * Возвращает CSS-цвет для индикатора загрузки.
 * @param {number} pct - Процент загрузки.
 * @param {number} alertThreshold - Порог алерта.
 * @returns {string} CSS-переменная цвета.
 */
export function getRoleLoadColor(pct, alertThreshold) {
    if (pct > 100 + alertThreshold) return 'var(--danger)';
    if (pct > 95) return 'var(--warning)';
    return 'var(--success)';
}

/**
 * Возвращает «уровень» загрузки (success/warning/danger) для CSS-классов.
 * @param {number} pct - Процент загрузки.
 * @param {number} alertThreshold - Порог алерта.
 * @returns {'success'|'warning'|'danger'}
 */
export function getRoleLoadLevel(pct, alertThreshold) {
    if (pct > 100 + alertThreshold) return 'danger';
    if (pct > 95) return 'warning';
    return 'success';
}

/**
 * Чистая функция: вычисляет загрузку команды с учётом гипотетического добавления
 * или удаления одной задачи (preview during hover/drag).
 *
 * Возвращает по каждой роли: текущая нагрузка, прогноз (next), дельта в часах
 * и в процентах относительно ёмкости.
 *
 * @param {Object} params
 * @param {Array} params.roles - Массив ролей.
 * @param {Array} params.tasks - Массив текущих задач.
 * @param {Object} params.config - Конфигурация спринта.
 * @param {'add'|'remove'} [params.mode='add'] - Симулируем добавление или удаление.
 * @param {Object|null} [params.task] - Задача-кандидат. null = просто текущее состояние.
 * @returns {{
 *   byRole: Object<string, {
 *     current: number,
 *     next: number,
 *     delta: number,
 *     capacity: number,
 *     currentPercent: number,
 *     nextPercent: number,
 *     deltaPercent: number,
 *     currentOverload: boolean,
 *     nextOverload: boolean
 *   }>
 * }}
 */
export function simulateLoadDelta({ roles, tasks, config, mode = 'add', task = null } = {}) {
    const byRole = {};
    if (!Array.isArray(roles)) return { byRole };

    const alert = (config && typeof config.alert === 'number') ? config.alert : 0;
    const previewActive = task && !task.excluded;

    roles.forEach(role => {
        const capacity = calculateAvailability(role, config).useful;
        const current = calculateRoleLoad(role.id, tasks, false);
        let next = current;
        if (previewActive) {
            const taskHours = Number(task.est?.[role.id]) || 0;
            if (mode === 'add') {
                next = current + taskHours;
            } else if (mode === 'remove') {
                // when removing, current already includes the task — subtract.
                next = current - taskHours;
                if (next < 0) next = 0;
            }
        }
        const currentPercent = capacity > 0 ? (current / capacity) * 100 : 0;
        const nextPercent = capacity > 0 ? (next / capacity) * 100 : 0;
        byRole[role.id] = {
            current,
            next,
            delta: next - current,
            capacity,
            currentPercent,
            nextPercent,
            deltaPercent: nextPercent - currentPercent,
            currentOverload: currentPercent > 100 + alert,
            nextOverload: nextPercent > 100 + alert
        };
    });

    return { byRole };
}






