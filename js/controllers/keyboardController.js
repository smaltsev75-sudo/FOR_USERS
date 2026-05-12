// js/controllers/keyboardController.js

import { hideModal } from '../ui/modalManager.js';

export class KeyboardController {
    constructor(taskController, fileController, printFn = () => globalThis.print()) {
        this.taskController = taskController;
        this.fileController = fileController;
        this.printFn = printFn;
    }

    init() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e), { capture: true, passive: false });
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
        const hasPrimaryModifier = e.ctrlKey || e.metaKey;

        // Ctrl/Cmd+Alt+S – Сохранить
        if (hasPrimaryModifier && e.altKey && e.code === 'KeyS') {
            stopEvent();
            this.fileController?.saveToFile();
            return false;
        }

        // Ctrl/Cmd+Alt+O – Загрузить
        if (hasPrimaryModifier && e.altKey && e.code === 'KeyO') {
            stopEvent();
            this.fileController?.loadFromFile();
            return false;
        }

        // Ctrl/Cmd+Alt+N – Открыть модальное окно создания задачи
        if (hasPrimaryModifier && e.altKey && e.code === 'KeyN') {
            stopEvent();
            if (this.taskController) {
                this.taskController.openCreateModal();
            }
            return false;
        }

        // Ctrl/Cmd+Alt+F – Фокус на поиск
        if (hasPrimaryModifier && e.altKey && e.code === 'KeyF') {
            stopEvent();
            const searchInput = document.getElementById('taskSearchInput');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
            return false;
        }

        // Ctrl/Cmd+Alt+P – Печать
        if (hasPrimaryModifier && e.altKey && e.code === 'KeyP') {
            stopEvent();
            this.printFn();
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
