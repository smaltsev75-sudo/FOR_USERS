// js/controllers/fileController.js
import { messageService } from '../services/message.js';
import { storageService } from '../services/storage.js';
import { migratePersistedState, serializeStateForStorage } from '../state/persistence.js';
import { showModal, hideModal } from '../ui/modalManager.js';

export class FileController {
    constructor(store, numberFormatService, criteriaManager) {
        this.store = store;
        this.nfs = numberFormatService;
        this.criteriaManager = criteriaManager;
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
        const saveBtn = document.getElementById('saveDataBtn');
        const loadBtn = document.getElementById('loadDataBtn');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveToFile();
            });
        } else {
            messageService.showMessage('Ошибка: кнопка «Сохранить» не найдена в DOM');
        }

        if (loadBtn) {
            loadBtn.addEventListener('click', () => {
                this.loadFromFile();
            });
        } else {
            messageService.showMessage('Ошибка: кнопка «Загрузить» не найдена в DOM');
        }
    }

    showProgress(message) {
        if (this.progressEl && this.progressMessageEl) {
            this.progressMessageEl.textContent = message;
            showModal(this.progressEl);
        }
    }

    hideProgress() {
        if (this.progressEl) {
            hideModal(this.progressEl);
        }
    }

    async saveToFile() {
        this.showProgress('Сохранение...');
        try {
            await new Promise(resolve => setTimeout(resolve, 100));
            const state = this.store.getState();
            const data = serializeStateForStorage(
                state,
                this.criteriaManager.getCriteria(),
                this.nfs.decimalSeparator
            );
            // v8.30.5: sanitize user-input product name для filename.
            // Запрещённые в Windows/macOS/Linux: / \ : * ? " < > | + control chars.
            // Длинные имена обрезаем до 60 символов чтобы не упереться в OS limits.
            const sanitizeForFilename = (s) => String(s || '')
                // eslint-disable-next-line no-control-regex
                .replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_')
                .replace(/[. ]+$/g, '')
                .slice(0, 60)
                .trim();
            const productSlug = sanitizeForFilename(state.config?.product);
            const productPrefix = productSlug ? productSlug + '-' : '';
            const filename = productPrefix + 'sprint-plan-' + new Date().toISOString().slice(0, 10) + '.json';
            storageService.saveFile(data, filename);
        } catch (error) {
            messageService.showMessage('Не удалось сохранить файл: ' + error.message);
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

            const taskCount = data.tasks ? data.tasks.length : 0;

            messageService.showConfirm(
                'Загрузить данные? Текущие данные будут потеряны.',
                async () => {
                    this.showProgress('Загрузка...');
                    // Snapshot для atomic rollback при ошибке во время импорта.
                    // Если внутри try что-то упадёт, восстанавливаем criteriaManager,
                    // nfs и store до состояния до импорта.
                    const snapshot = {
                        state: this.store.getState(),
                        criteria: this.criteriaManager.getCriteria().map(c => ({ ...c, scale: { ...(c.scale || {}) } })),
                        decimalSeparator: this.nfs.decimalSeparator
                    };
                    try {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        const migratedState = migratePersistedState(data);

                        if (migratedState.numberFormatSettings) {
                            this.nfs.decimalSeparator = migratedState.numberFormatSettings.decimalSeparator || ',';
                            this.nfs.saveSettings();
                        }

                        if (migratedState.criteria && migratedState.criteria.length > 0) {
                            this.criteriaManager.loadCriteria(migratedState.criteria);
                        } else {
                            this.criteriaManager.loadDefaultCriteria();
                        }

                        const criteria = this.criteriaManager.getCriteria();
                        const tasks = migratedState.tasks.map(task => {
                            const evaluations = { ...(task.criteriaEvaluations || {}) };
                            criteria.forEach((criterion) => {
                                if (!evaluations[criterion.id]) {
                                    evaluations[criterion.id] = { score: 0, value: 0 };
                                }
                            });
                            return { ...task, criteriaEvaluations: evaluations };
                        });

                        this.store.loadState({
                            ...migratedState,
                            criteria,
                            tasks
                        });

                        messageService.showMessage(`Данные успешно загружены! Загружено ${taskCount} задач`);
                    } catch (error) {
                        // Atomic rollback: возвращаем все три источника состояния
                        // в snapshot, чтобы пользователь не получил partial state.
                        try {
                            this.criteriaManager.loadCriteria(snapshot.criteria);
                            this.nfs.decimalSeparator = snapshot.decimalSeparator;
                            this.nfs.saveSettings();
                            this.store.loadState(snapshot.state);
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
