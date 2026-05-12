// js/utils/date.js
export function formatDate(date) {
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function parseDate(str) {
    if (!str || str.trim() === '') return null;
    const [d, m, y] = str.split('.').map(Number);
    if (isNaN(d) || isNaN(m) || isNaN(y) || d < 1 || d > 31 || m < 1 || m > 12 || y < 1000) return null;
    return new Date(y, m - 1, d);
}

/**
 * Проверяет, является ли дата рабочим днём (не суббота и не воскресенье).
 * @param {Date} date
 * @returns {boolean}
 */
export function isWorkingDay(date) {
    const day = date.getDay();
    return day !== 0 && day !== 6; // 0 = воскресенье, 6 = суббота
}

/**
 * Прибавляет указанное количество РАБОЧИХ дней к дате (пропуская выходные).
 * @param {Date} date - начальная дата
 * @param {number} days - количество рабочих дней для прибавления (может быть 0)
 * @returns {Date} результирующая дата
 */
export function addWorkingDays(date, days) {
    const res = new Date(date);
    let remaining = days;
    while (remaining > 0) {
        res.setDate(res.getDate() + 1);
        if (isWorkingDay(res)) {
            remaining--;
        }
    }
    return res;
}

/**
 * Считает количество рабочих дней между двумя датами (включительно).
 * @param {Date} startDate - дата начала
 * @param {Date} endDate - дата окончания
 * @returns {number} количество рабочих дней
 */
export function countWorkingDays(startDate, endDate) {
    if (endDate < startDate) return 0;
    let count = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
        if (isWorkingDay(current)) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
}

/**
 * @deprecated Используйте addWorkingDays для учёта выходных.
 * Прибавляет календарные дни к дате.
 */
export function addDays(date, days) {
    const res = new Date(date);
    res.setDate(res.getDate() + days);
    return res;
}