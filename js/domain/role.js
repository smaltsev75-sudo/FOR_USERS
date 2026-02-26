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






