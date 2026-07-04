// js/controllers/fileController.js
import { messageService } from '../services/message.js';
import { storageService } from '../services/storage.js';
import { showStatusOverlay, hideStatusOverlay } from '../ui/modalManager.js';
import {
    buildDiagnosticsFilename,
    collectDiagnosticsBundle
} from '../services/diagnostics.js';
import { showSnackbar } from '../ui/snackbar.js';
import { saveSprintPlanToFile } from './file/exportFlow.js';
import { wireFileControllerEvents } from './file/fileEventWiring.js';
import { loadSprintPlanFromFile } from './file/importFlow.js';

export class FileController {
    constructor(store, numberFormatService) {
        this.store = store;
        this.nfs = numberFormatService;
        this.progressEl = null;
        this.progressMessageEl = null;
    }

    init() {
        this.progressEl = document.getElementById('globalProgress');
        this.progressMessageEl = document.getElementById('progressMessage');
        this.hideProgress();
        this.attachEvents();
    }

    attachEvents() {
        wireFileControllerEvents(this);
    }

    showProgress(message) {
        if (this.progressEl && this.progressMessageEl) {
            this.progressMessageEl.textContent = message;
            // v8.30.27: status overlay БЕЗ focus-trap. Раньше шло через
            // showModal() — globalProgress (role="status") получал modal
            // behavior, что противоречит a11y-семантике live region.
            showStatusOverlay(this.progressEl);
        }
    }

    hideProgress() {
        if (this.progressEl) {
            hideStatusOverlay(this.progressEl);
        }
    }

    saveToFile() {
        return saveSprintPlanToFile({
            store: this.store,
            nfs: this.nfs,
            showProgress: (message) => this.showProgress(message),
            hideProgress: () => this.hideProgress()
        });
    }

    async downloadDiagnostics() {
        this.showProgress('Подготовка диагностики...');
        try {
            const bundle = await collectDiagnosticsBundle({
                state: this.store.getState(),
                criteria: this.store.getState().criteria || [],
                decimalSeparator: this.nfs.decimalSeparator
            });
            storageService.saveFile(bundle, buildDiagnosticsFilename());
            showSnackbar(
                'Диагностический пакет скачан. Файл не содержит тексты задач, JIRA-ссылки, комментарии и название продукта.',
                { duration: 6000 }
            );
        } catch (error) {
            messageService.showMessage('Не удалось подготовить диагностику: ' + error.message);
        } finally {
            this.hideProgress();
        }
    }

    loadFromFile() {
        return loadSprintPlanFromFile({
            store: this.store,
            nfs: this.nfs,
            showProgress: (message) => this.showProgress(message),
            hideProgress: () => this.hideProgress()
        });
    }
}
