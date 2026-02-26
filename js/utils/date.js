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

export function addDays(date, days) {
    const res = new Date(date);
    res.setDate(res.getDate() + days);
    return res;
}