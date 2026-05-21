// js/controllers/fileController.js
import { messageService } from '../services/message.js';
import { storageService } from '../services/storage.js';
import { migratePersistedState, serializeStateForStorage, analyzeImportIssues } from '../state/persistence.js';
import { showStatusOverlay, hideStatusOverlay } from '../ui/modalManager.js';
import { APP_CONFIG } from '../utils/appConfig.js';

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
            const { issues } = analyzeImportIssues(data);
            const previewLines = issues.slice(0, 8).map(s => '• ' + s);
            if (issues.length > 8) previewLines.push(`… ещё ${issues.length - 8} проблем(ы)`);
            const issuePreview = issues.length > 0
                ? `\n\nОбнаружены проблемы в файле:\n${previewLines.join('\n')}\n\nЭти значения будут заменены fallback'ами.`
                : '';

            const confirmText = `Загрузить данные? Текущие данные будут потеряны.${issuePreview}`;

            messageService.showConfirm(
                confirmText,
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
                            // v8.30.24 (P3.7): проверяем status; raньше игнор
                            // приводил к «импорт показывает успех, но separator
                            // не сохранился». Контракт уже выработан в App.saveToLS.
                            const saveResult = this.nfs.saveSettings();
                            if (saveResult && saveResult.ok === false) {
                                messageService.showMessage(
                                    `Не удалось сохранить настройки формата чисел (${saveResult.error}). Импортированный разделитель действует до перезагрузки.`
                                );
                            }
                        }

                        if (migratedState.criteria && migratedState.criteria.length > 0) {
                            this.criteriaManager.loadCriteria(migratedState.criteria);
                        } else {
                            this.criteriaManager.loadDefaultCriteria();
                        }

                        const criteria = this.criteriaManager.getCriteria();
                        // v8.30.36: добавляем defaults ТОЛЬКО для текущих valid criteria.
                        // Раньше spread `...task.criteriaEvaluations` reintroduce'ил
                        // orphan/invalid keys которые migrate уже выбросил —
                        // alignment fail. Теперь rebuilding from valid set only.
                        const validCritIds = new Set(criteria.map(c => c.id));
                        const tasks = migratedState.tasks.map(task => {
                            const sourceEvals = task.criteriaEvaluations || {};
                            const evaluations = {};
                            for (const c of criteria) {
                                evaluations[c.id] = sourceEvals[c.id] || { score: 0, value: 0 };
                            }
                            // Защита от gap: какие-то migrated evaluations с valid
                            // ids которые НЕ в текущем criteria? — sourceEvals уже
                            // отфильтрованы migrate'ом до validCritIds на момент
                            // импорта. Если criteria поменялись после migrate
                            // (loadDefaultCriteria), orphans отсеиваются здесь.
                            for (const k of Object.keys(sourceEvals)) {
                                const kid = Number(k);
                                if (!validCritIds.has(kid) && !validCritIds.has(k)) {
                                    // Silently drop (уже в issues от migrate, повторно
                                    // показывать не нужно).
                                    continue;
                                }
                            }
                            return { ...task, criteriaEvaluations: evaluations };
                        });

                        this.store.loadState({
                            ...migratedState,
                            criteria,
                            tasks
                        });

                        // v8.30.34: ground truth — реально загруженное число задач
                        // ПОСЛЕ migrate (не из raw data). Раньше при tasks:{} мы
                        // печатали «Загружено 0 задач» хотя задачи теоретически
                        // могли быть в raw. Теперь сравниваем raw vs migrated.
                        const migratedCount = migratedState.tasks.length;
                        const dropped = rawTaskCount - migratedCount;
                        const droppedNote = (Array.isArray(data.tasks) && dropped > 0)
                            ? ` (${dropped} элементов отвергнуто)` : '';
                        // v8.30.33: honest success message — не скрываем
                        // потерю данных. Если были issues, добавляем счётчик.
                        const successMsg = issues.length > 0
                            ? `Данные загружены: ${migratedCount} задач${droppedNote}. Применены fallback'и для ${issues.length} невалидных полей (см. подтверждение перед импортом).`
                            : `Данные успешно загружены! Загружено ${migratedCount} задач${droppedNote}`;
                        messageService.showMessage(successMsg);
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
