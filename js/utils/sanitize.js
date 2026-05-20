// js/utils/sanitize.js
// Универсальная санитизация HTML для защиты от XSS.
// Использует DOMPurify при наличии, иначе — консервативный regex-фолбэк.
//
// v8.30.21: P2 аудит — fallback ловил только литеральный /javascript\s*:/,
// но `java&#x73;cript:` (HTML-entity-encoded) проходил без изменений; браузер
// при рендере декодирует entity и исполняет JS-URL. Теперь fallback использует
// allow-list безопасных протоколов для атрибутов href/src — всё, что не
// (http|https|mailto|tel|relative|hash|query), переписывается на `about:blank`.
// Покрытие также для vbscript:, data:text/html, tab/newline-разделённых scheme.

const SAFE_URL_RE = /^(?:https?:|mailto:|tel:|\/|#|\?|[a-z0-9][a-z0-9._~+%-]*$)/i;

/**
 * Декодирует HTML-entity (hex, decimal), убирает control/whitespace chars
 * (tab/newline/CR/FF/VT/NUL) — браузер игнорирует их при resolve URL-scheme,
 * sanitizer должен судить по той же нормализованной форме.
 */
function decodeForUrlCheck(s) {
    return String(s)
        .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&#(\d+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
        .replace(/[\t\n\r\f\v\0]/g, '')
        .trim();
}

/**
 * Возвращает безопасное значение для href/src. Если decoded-URL начинается
 * с whitelist-протокола (или это относительная/якорная ссылка) — возвращает
 * исходное (raw, с сохранёнными entity для текстового рендера). Иначе
 * заменяет на 'about:blank' — рабочий no-op для пользователя, не исполняемый.
 */
function neutralizeUrl(rawValue) {
    const decoded = decodeForUrlCheck(rawValue);
    if (SAFE_URL_RE.test(decoded)) return rawValue;
    return 'about:blank';
}

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
    // Fallback: удаляет опасные теги, inline event-handlers и неразрешённые
    // схемы URL в href/src через allow-list.
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
        // href/src через allow-list (двойные кавычки)
        .replace(/(\s(?:href|src)\s*=\s*)"([^"]*)"/gi, (_, lead, val) => `${lead}"${neutralizeUrl(val)}"`)
        // href/src (одинарные кавычки)
        .replace(/(\s(?:href|src)\s*=\s*)'([^']*)'/gi, (_, lead, val) => `${lead}'${neutralizeUrl(val)}'`)
        // href/src (без кавычек) — реже, но возможен в кривом HTML
        .replace(/(\s(?:href|src)\s*=\s*)([^\s>]+)/gi, (_, lead, val) => `${lead}${neutralizeUrl(val)}`);
}
