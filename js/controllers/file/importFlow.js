import { messageService } from '../../services/message.js';
import { storageService } from '../../services/storage.js';
import { buildStatePreview } from '../../services/statePreview.js';
import { createImportConfirmModel, formatImportSuccessMessage } from '../../ui/importIssues.js';
import { APP_CONFIG } from '../../utils/appConfig.js';
import {
    applyImportedState,
    createRuntimeSnapshot,
    restoreRuntimeSnapshot
} from '../stateImportApplier.js';

export async function loadSprintPlanFromFile({
    store,
    nfs,
    showProgress = () => {},
    hideProgress = () => {}
}) {
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
            currentState: store.getState(),
            criteria: store.getState().criteria || [],
            decimalSeparator: nfs.decimalSeparator
        });
        const { issues } = preview;
        const confirmModel = createImportConfirmModel(preview);

        messageService.showConfirm(
            confirmModel,
            async () => {
                showProgress('Загрузка...');
                // Snapshot для atomic rollback при ошибке во время импорта.
                // Если внутри try что-то упадёт, восстанавливаем nfs и store
                // до состояния до импорта.
                const snapshot = createRuntimeSnapshot({ store, nfs });
                try {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    const { migratedState, numberFormatSaveResult } = applyImportedState(data, { store, nfs });
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
                        restoreRuntimeSnapshot(snapshot, { store, nfs });
                    } catch { /* лучшее, что можем сделать после двойного сбоя */ }
                    messageService.showMessage('Ошибка при обработке данных (изменения откачены): ' + error.message);
                } finally {
                    hideProgress();
                }
            }
        );
    } catch (err) {
        // v8.30.5: различаем cancel/timeout (silent) от real errors
        // (parse/read — обязательно показать пользователю, иначе он не
        // поймёт, почему импорт не сработал).
        hideProgress();
        const code = err && err.code;
        if (code === 'cancel' || code === 'timeout') return;
        const reason = (err && err.message) || 'неизвестная ошибка';
        messageService.showMessage(`Не удалось загрузить файл: ${reason}`);
    }
}
