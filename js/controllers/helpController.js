// js/controllers/helpController.js
// Контроллер модального окна справки.
// Загружает docs/UserManual.md, парсит через marked.js и санитизирует через DOMPurify.

import { messageService } from '../services/message.js';
import { showModal, hideModal } from '../ui/modalManager.js';
import { sanitizeHtml } from '../utils/sanitize.js';

/**
 * HelpController — управляет модальным окном справки.
 *
 * Отвечает за:
 * - Загрузку docs/UserManual.md с сервера
 * - Парсинг Markdown → HTML через библиотеку marked
 * - Санитизацию HTML через DOMPurify (защита от XSS)
 * - Генерацию якорей для оглавления
 * - Плавную навигацию по разделам
 */
export class HelpController {
    /**
     * @param {Object} globalApi — глобальный объект (window), используется для
     *   доступа к marked и DOMPurify (загружаются лениво через CDN).
     */
    constructor(globalApi = globalThis) {
        this.globalApi = globalApi;
        // DOM-элементы модального окна справки
        this.modal = document.getElementById('helpModal');
        this.content = document.getElementById('helpContent');
        this.btn = document.getElementById('helpBtn');
        this.closeBtn = document.getElementById('closeHelpModalBtn');
        this.closeAltBtn = document.getElementById('closeHelpBtn');
    }

    /** Подключение обработчиков событий. */
    init() {
        this.btn?.addEventListener('click', () => this.open());
        this.closeBtn?.addEventListener('click', () => this.close());
        this.closeAltBtn?.addEventListener('click', () => this.close());
        // Закрытие по клику на backdrop (оверлей)
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });
    }

    /**
     * Открывает модальное окно справки.
     * Загружает markdown, парсит в HTML, санитизирует и рендерит.
     */
    async open() {
        if (!this.modal || !this.content) return;

        // Показываем индикатор загрузки (v8.30.2: inline-styles → .help-loading-state)
        this.content.innerHTML = '<div class="help-loading-state"><div class="loading-spinner"></div><span>Загрузка руководства...</span></div>';
        showModal(this.modal);

        try {
            // Загружаем marked.js и DOMPurify параллельно (если ещё не загружены)
            await Promise.all([this.ensureMarked(), this.ensureDOMPurify()]);

            // Ищем файл по нескольким путям (для совместимости)
            let response = null;
            for (const path of ['docs/UserManual.md', './docs/UserManual.md']) {
                try {
                    response = await fetch(path);
                    if (response.ok) break;
                } catch { /* игнорируем ошибку конкретного пути */ }
            }
            if (!response || !response.ok) throw new Error('Файл не найден');

            const markdown = await response.text();
            // Парсим Markdown в HTML
            let html = this.globalApi.marked.parse(markdown);

            // Санитизация: удаляем опасные теги (script, iframe, onerror и т.д.)
            html = this._sanitize(html);

            // Временный контейнер для обработки DOM (генерация якорей заголовков)
            const temp = document.createElement('div');
            temp.innerHTML = html;

            // Присваиваем уникальные ID всем заголовкам для навигации по оглавлению
            const headers = temp.querySelectorAll('h1, h2, h3, h4');
            headers.forEach(header => {
                const text = header.textContent.trim();
                let id = this._slugify(text);
                // Обеспечиваем уникальность ID (дубли получают суффикс -1, -2, ...)
                if (temp.querySelector(`#${id}`)) {
                    let counter = 1;
                    while (temp.querySelector(`#${id}-${counter}`)) counter++;
                    id = `${id}-${counter}`;
                }
                header.id = id;
            });

            html = temp.innerHTML;

            // Оборачиваем в стилизованный контейнер (стили в css/components.css → .help-content)
            this.content.innerHTML = `<div class="help-content">${html}</div>`;

            // Навешиваем обработчики на ссылки оглавления для плавной прокрутки
            this.setupTocLinks();

        } catch (error) {
            messageService.showMessage('Ошибка загрузки справки: ' + error.message);
            // v8.30.2: inline-styles → .help-error-state. Эмодзи ❌ убран
            // (правило проекта «эмодзи в UI запрещены»). Текст ошибки
            // эскейпируется через textContent после insertHtml — но безопаснее
            // через template-литерал + escapeHtml. Здесь error.message —
            // строка от error.constructor, в основном internal — но всё равно
            // escape для безопасности.
            const safeMessage = String(error.message || '').replace(/[<>&"]/g, s => (
                { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[s]
            ));
            this.content.innerHTML = `
                <div class="help-error-state">
                    <p class="help-error-state__title">Не удалось загрузить руководство пользователя.</p>
                    <p class="help-error-state__detail">${safeMessage}</p>
                    <p>Убедитесь, что файл <strong>docs/UserManual.md</strong> существует в проекте.</p>
                </div>
            `;
        }
    }

    /**
     * Санитизирует HTML-строку через общий sanitizeHtml() из utils/sanitize.js.
     * v8.30.5: раньше HelpController имел собственный fallback, который чистил
     * только <script> и on*=, но НЕ удалял `<iframe>`, `<object>`, `<embed>`,
     * `<link>`, `<meta>` и `javascript:` URL. При отсутствии DOMPurify это
     * давало weaker защиту, чем sanitizeHtml() из utils/. Унифицировано.
     * @param {string} html — «грязный» HTML
     * @returns {string} — безопасный HTML
     */
    _sanitize(html) {
        return sanitizeHtml(html, this.globalApi);
    }

    /**
     * Генерирует slug из текста заголовка (сохраняет кириллицу).
     * @param {string} text — текст заголовка
     * @returns {string} — slug для использования как HTML id
     */
    _slugify(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\sа-яё-]/gi, '') // разрешаем русские буквы и дефисы
            .replace(/\s+/g, '-')
            .replace(/--+/g, '-')
            .replace(/^-|-$/g, '');
    }

    /**
     * Настраивает плавную прокрутку для ссылок оглавления.
     * Декодирует URL-encoded символы для поддержки кириллических якорей.
     */
    setupTocLinks() {
        const links = this.content.querySelectorAll('a[href^="#"]');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const rawTargetId = link.getAttribute('href').substring(1);
                const targetId = decodeURIComponent(rawTargetId);
                const target = this.content.querySelector(`#${targetId}`);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    target.classList.add('toc-highlight');
                    setTimeout(() => target.classList.remove('toc-highlight'), 1000);
                } else {
                    messageService.showMessage(`Якорь #${targetId} не найден`);
                }
            });
        });
    }

    /** Закрывает модальное окно справки. */
    close() {
        hideModal(this.modal);
    }

    /**
     * Ленивая загрузка локальной копии marked.js из js/vendor/.
     * Vendor-файл закэширован SW при install, поэтому работает офлайн
     * после первого открытия страницы (см. sw.js ASSETS_TO_CACHE).
     * @returns {Promise<void>}
     */
    ensureMarked() {
        return new Promise((resolve) => {
            if (this.globalApi.marked) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = './js/vendor/marked.min.js';
            script.onload = resolve;
            script.onerror = () => {
                this.globalApi.marked = { parse: (text) => `<pre>${text.replace(/</g, '&lt;')}</pre>` };
                resolve();
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Ленивая загрузка локальной копии DOMPurify из js/vendor/.
     * Если загрузка не удалась — продолжаем без санитизации (fallback в _sanitize).
     * @returns {Promise<void>}
     */
    ensureDOMPurify() {
        return new Promise((resolve) => {
            if (this.globalApi.DOMPurify) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = './js/vendor/purify.min.js';
            script.onload = resolve;
            script.onerror = () => resolve(); // Без DOMPurify используем fallback
            document.head.appendChild(script);
        });
    }
}
