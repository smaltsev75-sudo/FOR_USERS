// js/utils/escapeHtml.js
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    // Экранируем также кавычки и апострофы для безопасного использования в атрибутах
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
