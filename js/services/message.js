// js/services/message.js
// Сервис отображения сообщений и подтверждений пользователю.
// Использует три типа модалей: информация, HTML, подтверждение.

import { showModal, hideModal } from '../ui/modalManager.js';
import { sanitizeHtml } from '../utils/sanitize.js';

const DEFAULT_CONFIRM_TITLE = 'Подтверждение';

function appendTextElement(parent, tagName, className, text) {
    if (!text) return null;
    const el = document.createElement(tagName);
    if (className) el.className = className;
    el.textContent = text;
    parent.appendChild(el);
    return el;
}

function renderConfirmContent(textEl, content) {
    textEl.replaceChildren();

    if (!content || typeof content !== 'object') {
        textEl.textContent = String(content ?? '');
        return;
    }

    const root = document.createElement('div');
    root.className = 'confirm-content';
    appendTextElement(root, 'p', 'confirm-content__body', content.body);

    if (content.notice) {
        const notice = appendTextElement(root, 'div', 'confirm-content__notice', content.notice);
        if (notice && content.noticeVariant) {
            notice.classList.add(`confirm-content__notice--${content.noticeVariant}`);
        }
    }

    const detailItems = Array.isArray(content.detailsItems) ? content.detailsItems : [];
    if (detailItems.length > 0) {
        const details = document.createElement('details');
        details.className = 'confirm-details';

        const summary = document.createElement('summary');
        summary.className = 'confirm-details__summary';
        summary.textContent = content.detailsSummary || 'Показать детали';
        details.appendChild(summary);

        const list = document.createElement('ul');
        list.className = 'confirm-details__list';
        for (const item of detailItems) {
            appendTextElement(list, 'li', '', String(item));
        }
        details.appendChild(list);

        if (content.detailsOverflow > 0) {
            appendTextElement(
                details,
                'p',
                'confirm-details__overflow',
                `Ещё ${content.detailsOverflow} проблем(ы) скрыто.`
            );
        }

        root.appendChild(details);
    }

    appendTextElement(root, 'p', 'confirm-content__footer', content.footer);
    textEl.appendChild(root);
}

export const messageService = {
    /**
     * Показывает текстовое сообщение в модальном окне.
     * @param {string} msg — текст сообщения
     */
    showMessage(msg) {
        const modal = document.getElementById('messageModal');
        const textEl = document.getElementById('messageText');
        if (!modal || !textEl) return;
        textEl.textContent = msg;
        showModal(modal);

        const closeHandler = () => hideModal(modal);
        const closeBtn = document.getElementById('closeMessageModalBtn');
        const okBtn = document.getElementById('okMessageBtn');
        if (closeBtn) closeBtn.addEventListener('click', closeHandler, { once: true });
        if (okBtn) okBtn.addEventListener('click', closeHandler, { once: true });
    },

    /**
     * Показывает HTML-контент в модальном окне.
     * Вход санитизируется через DOMPurify (или regex-фолбэк) для защиты от XSS.
     * @param {string} html — HTML-строка
     */
    showHTML(html) {
        const modal = document.getElementById('messageModal');
        const textEl = document.getElementById('messageText');
        if (!modal || !textEl) return;
        textEl.innerHTML = sanitizeHtml(html);
        showModal(modal);

        const closeHandler = () => hideModal(modal);
        const closeBtn = document.getElementById('closeMessageModalBtn');
        const okBtn = document.getElementById('okMessageBtn');
        if (closeBtn) closeBtn.addEventListener('click', closeHandler, { once: true });
        if (okBtn) okBtn.addEventListener('click', closeHandler, { once: true });
    },

    /**
     * Показывает диалог подтверждения (Да/Нет).
     * @param {string} text — текст подтверждения
     * @param {Function} onConfirm — callback при подтверждении
     */
    showConfirm(text, onConfirm) {
        const modal = document.getElementById('confirmModal');
        const textEl = document.getElementById('confirmText');
        const titleEl = document.getElementById('confirmModalTitle');
        const yesBtn = document.getElementById('confirmYesBtn');
        const noBtn = document.getElementById('confirmNoBtn');
        const closeBtn = document.getElementById('closeConfirmModalBtn');
        if (!modal || !textEl || !yesBtn || !noBtn) return;

        if (titleEl) {
            titleEl.textContent = (text && typeof text === 'object' && text.title)
                ? text.title
                : DEFAULT_CONFIRM_TITLE;
        }
        renderConfirmContent(textEl, text);
        showModal(modal);

        const closeHandler = () => {
            hideModal(modal);
            yesBtn.removeEventListener('click', confirmHandler);
            noBtn.removeEventListener('click', closeHandler);
            if (closeBtn) closeBtn.removeEventListener('click', closeHandler);
        };

        const confirmHandler = () => {
            onConfirm();
            closeHandler();
        };

        yesBtn.addEventListener('click', confirmHandler, { once: true });
        noBtn.addEventListener('click', closeHandler, { once: true });
        if (closeBtn) {
            closeBtn.addEventListener('click', closeHandler, { once: true });
        }
    }
};
