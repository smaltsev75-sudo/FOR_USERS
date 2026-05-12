// js/utils/sanitize.js
// Универсальная санитизация HTML для защиты от XSS.
// Использует DOMPurify при наличии, иначе — консервативный regex-фолбэк.

/**
 * Санитизирует HTML-строку перед вставкой в innerHTML.
 * @param {string} html — потенциально небезопасная HTML-строка.
 * @param {Object} [globalApi=globalThis] — окружение, в котором ищется DOMPurify.
 * @returns {string} безопасная HTML-строка.
 */
export function sanitizeHtml(html, globalApi = globalThis) {
    const input = String(html ?? '');
    if (globalApi && globalApi.DOMPurify && typeof globalApi.DOMPurify.sanitize === 'function') {
        return globalApi.DOMPurify.sanitize(input, {
            USE_PROFILES: { html: true },
            ADD_ATTR: ['target']
        });
    }
    // Fallback: удаляет опасные теги, inline event-handlers и javascript:-URL.
    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
        .replace(/<embed\b[^>]*>/gi, '')
        .replace(/<link\b[^>]*>/gi, '')
        .replace(/<meta\b[^>]*>/gi, '')
        .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
        .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
        .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
        .replace(/javascript\s*:/gi, '');
}
