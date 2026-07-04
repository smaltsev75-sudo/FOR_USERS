export const HELP_MANUAL_PATHS = Object.freeze(['docs/UserManual.md', './docs/UserManual.md']);

const ESCAPE_MAP = Object.freeze({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;'
});

export function renderHelpLoading(contentEl) {
    if (!contentEl) return;
    contentEl.innerHTML = '<div class="help-loading-state"><div class="loading-spinner"></div><span>Загрузка руководства...</span></div>';
}

export function renderHelpMarkdown(contentEl, markdown, { marked, sanitize, doc = document } = {}) {
    if (!contentEl) return;
    if (!marked?.parse) throw new Error('Markdown parser unavailable');

    const rawHtml = marked.parse(markdown);
    const safeHtml = sanitize ? sanitize(rawHtml) : rawHtml;
    const temp = doc.createElement('div');
    temp.innerHTML = safeHtml;
    assignHeadingAnchors(temp);
    contentEl.innerHTML = `<div class="help-content">${temp.innerHTML}</div>`;
}

export function renderHelpError(contentEl, error) {
    if (!contentEl) return;
    const safeMessage = escapeHelpErrorMessage(error?.message || '');
    contentEl.innerHTML = `
        <div class="help-error-state">
            <p class="help-error-state__title">Не удалось загрузить руководство пользователя.</p>
            <p class="help-error-state__detail">${safeMessage}</p>
            <p>Убедитесь, что файл <strong>docs/UserManual.md</strong> существует в проекте.</p>
        </div>
    `;
}

export function slugifyHeading(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^\w\sа-яё-]/gi, '')
        .replace(/\s+/g, '-')
        .replace(/--+/g, '-')
        .replace(/^-|-$/g, '');
}

function assignHeadingAnchors(root) {
    const headers = root.querySelectorAll('h1, h2, h3, h4');
    headers.forEach(header => {
        const text = header.textContent.trim();
        let id = slugifyHeading(text);
        if (root.querySelector(`#${id}`)) {
            let counter = 1;
            while (root.querySelector(`#${id}-${counter}`)) counter++;
            id = `${id}-${counter}`;
        }
        header.id = id;
    });
}

function escapeHelpErrorMessage(message) {
    return String(message).replace(/[<>&"]/g, (s) => ESCAPE_MAP[s]);
}
