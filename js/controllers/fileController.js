// js/controllers/fileController.js
import { messageService } from '../services/message.js';
import { storageService } from '../services/storage.js';
import { serializeStateForStorage } from '../state/persistence.js';
import { showStatusOverlay, hideStatusOverlay } from '../ui/modalManager.js';
import { createImportConfirmModel, formatImportSuccessMessage } from '../ui/importIssues.js';
import { buildStatePreview } from '../services/statePreview.js';
import { APP_CONFIG } from '../utils/appConfig.js';
import { buildSprintPlanFilename } from '../utils/fileName.js';
import {
    applyImportedState,
    createRuntimeSnapshot,
    restoreRuntimeSnapshot
} from './stateImportApplier.js';
import {
    buildDiagnosticsFilename,
    collectDiagnosticsBundle
} from '../services/diagnostics.js';
import { showSnackbar } from '../ui/snackbar.js';
import { wireFileControllerEvents } from './file/fileEventWiring.js';

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

    async saveToFile() {
        this.showProgress('Сохранение...');
        try {
            await new Promise(resolve => setTimeout(resolve, 100));
            const state = this.store.getState();
            const data = serializeStateForStorage(
                state,
                state.criteria || [],
                this.nfs.decimalSeparator
            );
            const filename = buildSprintPlanFilename(state.config?.product);
            storageService.saveFile(data, filename);
        } catch (error) {
            messageService.showMessage('Не удалось сохранить файл: ' + error.message);
        } finally {
            this.hideProgress();
        }
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

    async loadFromFile() {
        try {
            const data = await storageService.loadFile();
            if (!data || !data.version || data.version < 2) {
                messageService.showMessage('Неверная версия файла');
                return;
            }
            // v8.30.21 P2 audit: импорт обходил downgrade-guard. bootstrapApp
            // защищён от savedVersion > STORAGE_VERSION (см. js/app.js),
            // но импорт через UI до этого фикса проверял только нижнюю
            // границу и сразу гнал данные в migratePersistedState — старый
            // нормализатор тихо терял неизвестные поля из файла будущей
            // версии. Симметричный guard здесь.
            if (Number.isFinite(data.version) && data.version > APP_CONFIG.STORAGE_VERSION) {
                messageService.showMessage(
                    `Файл сохранён более новой версией приложения (схема ${data.version}). ` +
                    `Текущая версия поддерживает схему ${APP_CONFIG.STORAGE_VERSION}. ` +
                    `Обновите приложение до актуальной версии или используйте файл из той же версии.`
                );
                return;
            }

            // v8.30.34: task count берётся ПОСЛЕ migrate (post-migration ground
            // truth), а не из raw data. Раньше data.tasks = {} давало
            // `(undefined).length` или {}.length=undefined в success message
            // → «Загружено undefined задач».
            const rawTaskCount = Array.isArray(data.tasks) ? data.tasks.length : 0;

            // v8.30.33: honest import — собираем list невалидных полей ДО
            // подтверждения, показываем пользователю явный отчёт. Success
            // message больше не маскирует потерю данных fallback-ом.
            const preview = buildStatePreview(data, {
                currentState: this.store.getState(),
                criteria: this.store.getState().criteria || [],
                decimalSeparator: this.nfs.decimalSeparator
            });
            const { issues } = preview;
            const confirmModel = createImportConfirmModel(preview);

            messageService.showConfirm(
                confirmModel,
                async () => {
                    this.showProgress('Загрузка...');
                    // Snapshot для atomic rollback при ошибке во время импорта.
                    // Если внутри try что-то упадёт, восстанавливаем nfs и store
                    // до состояния до импорта.
                    const snapshot = createRuntimeSnapshot({
                        store: this.store,
                        nfs: this.nfs
                    });
                    try {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        const { migratedState, numberFormatSaveResult } = applyImportedState(data, {
                            store: this.store,
                            nfs: this.nfs
                        });
                        if (numberFormatSaveResult && numberFormatSaveResult.ok === false) {
                            messageService.showMessage(
                                `Не удалось сохранить настройки формата чисел (${numberFormatSaveResult.error}). Импортированный разделитель действует до перезагрузки.`
                            );
                        }

                        // v8.30.34: ground truth — реально загруженное число задач
                        // ПОСЛЕ migrate (не из raw data). Раньше при tasks:{} мы
                        // печатали «Загружено 0 задач» хотя задачи теоретически
                        // могли быть в raw. Теперь сравниваем raw vs migrated.
                        const migratedCount = migratedState.tasks.length;
                        const dropped = rawTaskCount - migratedCount;
                        const successMsg = formatImportSuccessMessage({
                            migratedTaskCount: migratedCount,
                            droppedTaskCount: dropped,
                            rawTasksWereArray: Array.isArray(data.tasks),
                            issueCount: issues.length
                        });
                        messageService.showMessage(successMsg);
                    } catch (error) {
                        // Atomic rollback: возвращаем все три источника состояния
                        // в snapshot, чтобы пользователь не получил partial state.
                        try {
                            restoreRuntimeSnapshot(snapshot, {
                                store: this.store,
                                nfs: this.nfs
                            });
                        } catch { /* лучшее, что можем сделать после двойного сбоя */ }
                        messageService.showMessage('Ошибка при обработке данных (изменения откачены): ' + error.message);
                    } finally {
                        this.hideProgress();
                    }
                }
            );
        } catch (err) {
            // v8.30.5: различаем cancel/timeout (silent) от real errors
            // (parse/read — обязательно показать пользователю, иначе он не
            // поймёт, почему импорт не сработал).
            this.hideProgress();
            const code = err && err.code;
            if (code === 'cancel' || code === 'timeout') return;
            const reason = (err && err.message) || 'неизвестная ошибка';
            messageService.showMessage(`Не удалось загрузить файл: ${reason}`);
        }
    }
}
