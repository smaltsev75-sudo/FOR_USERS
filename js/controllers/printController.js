// js/controllers/printController.js
//
// Контроллер диалога параметров печати (owner).
// Перед печатью показывает модалку #printOptionsModal с чек-боксом
// «Выводить на печать исключённые из спринта задачи?» (по умолчанию выключен).
// По «Печать» проставляет на <html> атрибут data-print-excluded = 'show' | 'hide';
// print.css скрывает исключённые задачи / группу «excluded», когда 'hide'.

import { showModal, hideModal } from '../ui/modalManager.js';

export class PrintController {
    /**
     * @param {Function} [printFn] — фактический триггер печати (для тестов).
     */
    constructor(printFn = () => globalThis.print()) {
        this._printFn = printFn;
        this._modal = null;
        this._checkbox = null;
        this.requestPrint = this.requestPrint.bind(this);
    }

    init() {
        this._modal = document.getElementById('printOptionsModal');
        this._checkbox = document.getElementById('printIncludeExcluded');

        const confirmBtn = document.getElementById('printConfirmBtn');
        const cancelBtn = document.getElementById('printCancelBtn');
        const closeBtn = document.getElementById('closePrintOptionsModalBtn');

        if (confirmBtn) confirmBtn.addEventListener('click', () => this._confirm());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this._close());
        if (closeBtn) closeBtn.addEventListener('click', () => this._close());
    }

    /**
     * Открывает диалог параметров печати. Передаётся как printFn в
     * KeyboardController (клик по кнопке печати и Ctrl/Cmd+Alt+P).
     * Если модалки нет в разметке — печатает напрямую (graceful fallback).
     */
    requestPrint() {
        if (!this._modal) {
            this._applyExcludedFlag(false);
            this._printFn();
            return;
        }
        // Дефолт: чек-бокс выключен (исключённые НЕ печатаются).
        if (this._checkbox) this._checkbox.checked = false;
        showModal(this._modal);
    }

    _confirm() {
        const includeExcluded = !!(this._checkbox && this._checkbox.checked);
        this._applyExcludedFlag(includeExcluded);
        this._close();
        this._printFn();
    }

    /**
     * Проставляет на <html> data-print-excluded: 'show' (печатать исключённые)
     * или 'hide' (скрыть). print.css читает этот атрибут.
     * @param {boolean} includeExcluded
     */
    _applyExcludedFlag(includeExcluded) {
        const root = document.documentElement;
        if (root) root.dataset.printExcluded = includeExcluded ? 'show' : 'hide';
    }

    _close() {
        if (this._modal) hideModal(this._modal);
    }
}
