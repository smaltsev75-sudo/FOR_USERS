// js/controllers/helpController.js
// Контроллер модального окна справки.
// Загружает docs/UserManual.md, парсит через marked.js и санитизирует через DOMPurify.

import { messageService } from '../services/message.js';
import { showModal, hideModal } from '../ui/modalManager.js';
import { sanitizeHtml } from '../utils/sanitize.js';
import {
    HELP_MANUAL_PATHS,
    renderHelpError,
    renderHelpLoading,
    renderHelpMarkdown
} from './help/helpContent.js';
import { setupHelpTocLinks } from './help/helpTocLinks.js';

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
     *   доступа к marked и DOMPurify (загружаются лениво из локального
     *   ./js/vendor/marked.min.js и ./js/vendor/purify.min.js — оба ассета
     *   precache'ятся Service Worker'ом, см. sw.js ASSETS_TO_CACHE).
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
        renderHelpLoading(this.content);
        showModal(this.modal);

        try {
            // Загружаем marked.js и DOMPurify параллельно (если ещё не загружены)
            await Promise.all([this.ensureMarked(), this.ensureDOMPurify()]);

            // Ищем файл по нескольким путям (для совместимости)
            let response = null;
            for (const path of HELP_MANUAL_PATHS) {
                try {
                    response = await fetch(path);
                    if (response.ok) break;
                } catch { /* игнорируем ошибку конкретного пути */ }
            }
            if (!response || !response.ok) throw new Error('Файл не найден');

            const markdown = await response.text();
            renderHelpMarkdown(this.content, markdown, {
                marked: this.globalApi.marked,
                sanitize: (html) => this._sanitize(html)
            });

            // Навешиваем обработчики на ссылки оглавления для плавной прокрутки
            this.setupTocLinks();

        } catch (error) {
            messageService.showMessage('Ошибка загрузки справки: ' + error.message);
            renderHelpError(this.content, error);
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
     * Настраивает плавную прокрутку для ссылок оглавления.
     * Декодирует URL-encoded символы для поддержки кириллических якорей.
     */
    setupTocLinks() {
        setupHelpTocLinks(this.content);
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
