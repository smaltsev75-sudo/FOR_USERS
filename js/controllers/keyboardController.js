// js/controllers/keyboardController.js

import { hideModal } from '../ui/modalManager.js';
import { findCommandByHotkey } from '../config/commands.js';

export class KeyboardController {
    constructor(taskController, fileController, printFn = () => globalThis.print()) {
        this.taskController = taskController;
        this.fileController = fileController;
        this.printFn = printFn;
    }

    init() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e), { capture: true, passive: false });
        // v8.30.0: print button — раньше был inline `onclick="window.print()"`
        // в index.html, что блокировало строгий CSP `script-src 'self'`.
        const printBtn = document.getElementById('printBtn');
        if (printBtn) {
            printBtn.addEventListener('click', () => this.printFn());
        }
    }

    isModalOpen() {
        const openModal = document.querySelector('.modal-overlay[style*="display: flex"]') ||
            document.querySelector('.modal-overlay.is-open');
        return Boolean(openModal);
    }

    handleKeyDown(e) {
        const stopEvent = () => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        };

        const targetTag = e.target?.tagName?.toLowerCase() || '';
        const isInput = targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select';

        const command = findCommandByHotkey(e);
        if (command) {
            stopEvent();
            switch (command.id) {
                case 'save':
                    this.fileController?.saveToFile();
                    break;
                case 'load':
                    this.fileController?.loadFromFile();
                    break;
                case 'createTask':
                    this.taskController?.openCreateModal();
                    break;
                case 'focusSearch': {
                    const searchInput = document.getElementById('taskSearchInput');
                    if (searchInput) {
                        searchInput.focus();
                        searchInput.select();
                    }
                    break;
                }
                case 'print':
                    this.printFn();
                    break;
                case 'diagnostics':
                    this.fileController?.downloadDiagnostics?.();
                    break;
                default:
                    break;
            }
            return false;
        }

        // Delete – Удалить задачу
        if ((e.key === 'Delete' || e.key === 'Del') && !isInput && !this.isModalOpen()) {
            const taskId = this.taskController?.selectedTaskId;
            if (taskId) {
                stopEvent();
                this.taskController?.handleDeleteTask(taskId);
                return false;
            }
        }

        // Esc – Закрыть модальное окно
        if (e.key === 'Escape') {
            const modals = [
                'editModal',
                'editCriteriaModal',
                'selectionReportModal',
                'messageModal',
                'confirmModal',
                'recommendationsModal',
                'helpModal',
                'createTaskModal'
            ];
            for (const modalId of modals) {
                const modal = document.getElementById(modalId);
                if (modal && (modal.style.display === 'flex' || modal.classList.contains('is-open'))) {
                    stopEvent();
                    hideModal(modal);
                    return false;
                }
            }
        }
    }
}
