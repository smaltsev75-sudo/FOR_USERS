// js/services/message.js
// Сервис отображения сообщений и подтверждений пользователю.
// Использует три типа модалей: информация, HTML, подтверждение.

import { showModal, hideModal } from '../ui/modalManager.js';
import { sanitizeHtml } from '../utils/sanitize.js';

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
        const yesBtn = document.getElementById('confirmYesBtn');
        const noBtn = document.getElementById('confirmNoBtn');
        const closeBtn = document.getElementById('closeConfirmModalBtn');
        if (!modal || !textEl || !yesBtn || !noBtn) return;

        textEl.textContent = text;
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
