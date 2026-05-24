import { getCommand } from '../config/commands.js';
import { APP_CONFIG } from '../utils/appConfig.js';
import { messageService } from '../services/message.js';
import { storageService } from '../services/storage.js';
import { inspectStorageHealth } from '../services/storageHealth.js';
import {
    buildRecoveryBackupFilename,
    buildRecoveryComparison,
    readRecoveryBackup,
    saveRecoveredState
} from '../services/recovery.js';
import { createStateReplaceConfirmModel } from '../ui/importIssues.js';
import { showModal, hideModal } from '../ui/modalManager.js';
import { showSnackbar } from '../ui/snackbar.js';
import {
    applyImportedState,
    createRuntimeSnapshot,
    restoreRuntimeSnapshot
} from './stateImportApplier.js';

export class RecoveryController {
    constructor(store, numberFormatService, criteriaManager) {
        this.store = store;
        this.nfs = numberFormatService;
        this.criteriaManager = criteriaManager;
        this.modal = null;
        this.contentEl = null;
        this.restoreBtn = null;
        this.downloadBtn = null;
        this.backup = null;
        this.health = null;
    }

    init() {
        this.modal = document.getElementById('recoveryModal');
        this.contentEl = document.getElementById('recoveryContent');
        this.restoreBtn = document.getElementById('restoreRecoveryBackupBtn');
        this.downloadBtn = document.getElementById('downloadRecoveryBackupBtn');

        document.getElementById(getCommand('recovery').buttonId)
            ?.addEventListener('click', () => this.open());
        document.getElementById('closeRecoveryModalBtn')
            ?.addEventListener('click', () => this.close());
        document.getElementById('closeRecoveryBtn')
            ?.addEventListener('click', () => this.close());
        this.restoreBtn?.addEventListener('click', () => this.confirmRestore());
        this.downloadBtn?.addEventListener('click', () => this.downloadBackup());
    }

    open() {
        this.backup = readRecoveryBackup();
        this.health = inspectStorageHealth({
            currentState: this.store.getState(),
            criteria: this.criteriaManager.getCriteria(),
            decimalSeparator: this.nfs.decimalSeparator
        });
        this.render();
        showModal(this.modal);
    }

    close() {
        hideModal(this.modal);
    }

    render() {
        if (!this.contentEl) return;
        this.contentEl.replaceChildren();

        const backup = this.backup;
        const canRecover = Boolean(backup?.recoverable);
        if (this.restoreBtn) this.restoreBtn.disabled = !canRecover;
        if (this.downloadBtn) this.downloadBtn.disabled = !canRecover;

        if (this.health) {
            this.contentEl.append(healthBlock(this.health));
        }

        if (!backup?.present) {
            this.contentEl.append(
                block('recovery-empty', [
                    title('Резервная копия не найдена'),
                    paragraph('PLANNER создаёт backup перед миграцией старого сохранения. Когда такой backup появится, здесь можно будет сравнить его с текущим состоянием и восстановить.')
                ])
            );
            return;
        }

        if (!backup.recoverable) {
            this.contentEl.append(
                block('recovery-empty', [
                    title('Backup есть, но его нельзя восстановить автоматически'),
                    paragraph(`Статус: ${backup.status}. Размер backup: ${formatBytes(backup.backupBytes)}.`),
                    paragraph('Скачайте диагностику или JSON backup вручную, если нужно разобрать повреждённые данные отдельно.')
                ])
            );
            return;
        }

        const comparison = buildRecoveryComparison({
            currentState: this.store.getState(),
            backupState: backup.state,
            criteria: this.criteriaManager.getCriteria(),
            decimalSeparator: this.nfs.decimalSeparator
        });

        this.contentEl.append(
            block('recovery-summary', [
                title('Найдена резервная копия'),
                metaRow('Создана', formatTimestamp(backup.ts)),
                metaRow('Схема данных', backup.fromVersion === null ? 'не определена' : String(backup.fromVersion)),
                metaRow('Размер данных', formatBytes(backup.dataBytes)),
                comparisonGrid(comparison),
                paragraph('Восстановление заменит текущие данные нормализованной версией backup и сразу сохранит результат в локальное хранилище.', 'recovery-note')
            ])
        );
    }

    confirmRestore() {
        const backup = this.backup;
        if (!backup?.recoverable) {
            messageService.showMessage('Резервная копия не найдена или повреждена.');
            return;
        }

        const rawVersion = Number(backup.state?.version);
        if (Number.isFinite(rawVersion) && rawVersion > APP_CONFIG.STORAGE_VERSION) {
            messageService.showMessage(
                `Backup сохранён более новой версией схемы (${rawVersion}). ` +
                `Текущая версия поддерживает схему ${APP_CONFIG.STORAGE_VERSION}.`
            );
            return;
        }

        const comparison = buildRecoveryComparison({
            currentState: this.store.getState(),
            backupState: backup.state,
            criteria: this.criteriaManager.getCriteria(),
            decimalSeparator: this.nfs.decimalSeparator
        });

        this.close();
        messageService.showConfirm(createStateReplaceConfirmModel({
            title: 'Восстановить резервную копию?',
            body: 'Текущие данные будут заменены содержимым backup.',
            preview: comparison.preview,
            footer: 'Перед восстановлением можно скачать backup отдельным JSON-файлом.'
        }), () => this.restoreBackup());
    }

    restoreBackup() {
        const backup = this.backup;
        if (!backup?.recoverable) return;

        const snapshot = createRuntimeSnapshot({
            store: this.store,
            criteriaManager: this.criteriaManager,
            nfs: this.nfs
        });

        try {
            const { migratedState, numberFormatSaveResult } = applyImportedState(backup.state, {
                store: this.store,
                criteriaManager: this.criteriaManager,
                nfs: this.nfs
            });

            const saveResult = saveRecoveredState(this.store.getState());
            if (saveResult && saveResult.ok === false) {
                throw new Error(`StorageSaveFailed:${saveResult.error}`);
            }

            if (numberFormatSaveResult && numberFormatSaveResult.ok === false) {
                messageService.showMessage(
                    `Данные восстановлены, но настройки формата чисел не удалось сохранить (${numberFormatSaveResult.error}).`
                );
            }

            this.close();
            showSnackbar(`Резервная копия восстановлена: ${migratedState.tasks.length} задач.`, { duration: 5000 });
        } catch (error) {
            try {
                restoreRuntimeSnapshot(snapshot, {
                    store: this.store,
                    criteriaManager: this.criteriaManager,
                    nfs: this.nfs
                });
            } catch { /* fallback уже невозможен, показываем исходную ошибку */ }
            messageService.showMessage('Не удалось восстановить backup: ' + error.message);
        }
    }

    downloadBackup() {
        const backup = this.backup;
        if (!backup?.recoverable) {
            messageService.showMessage('Резервная копия не найдена или повреждена.');
            return;
        }
        storageService.saveFile(backup.state, buildRecoveryBackupFilename());
        showSnackbar('Backup скачан JSON-файлом.', { duration: 4000 });
    }
}

function block(className, children) {
    const el = document.createElement('div');
    el.className = className;
    el.append(...children);
    return el;
}

function title(text) {
    const el = document.createElement('h4');
    el.className = 'recovery-title';
    el.textContent = text;
    return el;
}

function paragraph(text, className = '') {
    const el = document.createElement('p');
    el.className = className;
    el.textContent = text;
    return el;
}

function metaRow(label, value) {
    const el = document.createElement('div');
    el.className = 'recovery-meta-row';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    const valueEl = document.createElement('strong');
    valueEl.textContent = value;
    el.append(labelEl, valueEl);
    return el;
}

function comparisonGrid(comparison) {
    const grid = document.createElement('div');
    grid.className = 'recovery-grid';
    grid.append(
        metric('Задачи', comparison.current.counts.tasks, comparison.backup.counts.tasks, comparison.deltas.tasks),
        metric('В спринте', comparison.current.counts.includedTasks, comparison.backup.counts.includedTasks, comparison.deltas.includedTasks),
        metric('Исключено', comparison.current.counts.excludedTasks, comparison.backup.counts.excludedTasks, comparison.deltas.excludedTasks),
        metric('Критерии', comparison.current.counts.criteria, comparison.backup.counts.criteria, comparison.deltas.criteria)
    );
    return grid;
}

function healthBlock(health) {
    const status = healthStatusText(health.status);
    const currentCounts = health.current?.counts;
    const backup = health.backup || {};
    const details = document.createElement('details');
    details.className = 'recovery-health__details';

    const summary = document.createElement('summary');
    summary.textContent = 'Показать технические детали';
    details.append(summary);

    const list = document.createElement('ul');
    list.className = 'recovery-health__messages';
    const messages = Array.isArray(health.messages) && health.messages.length > 0
        ? health.messages
        : ['Подробные статусы не сформированы.'];
    for (const message of messages) {
        const item = document.createElement('li');
        item.textContent = message;
        list.append(item);
    }
    details.append(list);

    return block('recovery-health', [
        title('Состояние локальных данных'),
        metaRow('Текущее сохранение', status),
        metaRow('Схема', schemaText(health.current)),
        metaRow('Данные после миграции', countsText(currentCounts)),
        metaRow('Локальный backup', backupText(backup)),
        details
    ]);
}

function healthStatusText(status) {
    const labels = {
        ok: 'читается',
        empty: 'не создано',
        warning: 'требует внимания',
        error: 'повреждено',
        blocked: 'нужна новая версия приложения'
    };
    return labels[status] || 'неизвестно';
}

function schemaText(current) {
    if (!current?.present) return `поддерживается ${current?.supportedVersion ?? APP_CONFIG.STORAGE_VERSION}`;
    const source = current.sourceVersion === null || current.sourceVersion === undefined
        ? 'не определена'
        : String(current.sourceVersion);
    return `${source} / поддерживается ${current.supportedVersion}`;
}

function countsText(counts) {
    if (!counts) return 'нет данных';
    return `${counts.tasks} задач, ${counts.criteria} критериев, ${counts.roles} ролей`;
}

function backupText(backup) {
    if (!backup.present) return 'не найден';
    if (!backup.recoverable) return `есть, статус ${backup.status}`;
    const created = formatTimestamp(backup.createdAt);
    return `готов к восстановлению, создан ${created}`;
}

function metric(label, current, backup, delta) {
    const el = document.createElement('div');
    el.className = 'recovery-metric';
    const labelEl = document.createElement('span');
    labelEl.className = 'recovery-metric__label';
    labelEl.textContent = label;
    const valueEl = document.createElement('strong');
    valueEl.className = 'recovery-metric__value';
    valueEl.textContent = `${current} → ${backup}`;
    const deltaEl = document.createElement('span');
    deltaEl.className = 'recovery-metric__delta';
    deltaEl.textContent = delta === 0 ? 'без изменений' : `${delta > 0 ? '+' : ''}${delta}`;
    el.append(labelEl, valueEl, deltaEl);
    return el;
}

function formatTimestamp(ts) {
    if (!Number.isFinite(ts)) return 'не определено';
    return new Date(ts).toLocaleString('ru-RU');
}

function formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return '0 Б';
    if (value < 1024) return `${value} Б`;
    return `${Math.round(value / 1024)} КБ`;
}
