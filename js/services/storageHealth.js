import { APP_CONFIG } from '../utils/appConfig.js';
import { BACKUP_STORAGE_KEY } from './storage.js';
import { readRecoveryBackup } from './recovery.js';
import { buildStatePreview } from './statePreview.js';

export const PLANNER_STORAGE_KEY = 'sprintPlannerData';

export function inspectStorageHealth({
    storage = globalThis.localStorage,
    currentState = null,
    criteria = undefined,
    decimalSeparator = undefined
} = {}) {
    const raw = safeStorageGet(storage, PLANNER_STORAGE_KEY);
    const backup = readRecoveryBackup({ storage });
    const backupRaw = safeStorageGet(storage, BACKUP_STORAGE_KEY);
    const backupSummary = summarizeBackup(backup, backupRaw);

    if (raw.error) {
        return buildHealth({
            status: 'error',
            current: {
                present: false,
                parseStatus: 'storage-unavailable',
                bytes: 0,
                supportedVersion: APP_CONFIG.STORAGE_VERSION
            },
            backup: backupSummary,
            messages: ['localStorage сейчас недоступен для чтения.']
        });
    }

    if (typeof raw.value !== 'string' || raw.value.length === 0) {
        return buildHealth({
            status: backup.recoverable ? 'warning' : 'empty',
            current: {
                present: false,
                parseStatus: 'missing',
                bytes: 0,
                supportedVersion: APP_CONFIG.STORAGE_VERSION
            },
            backup: backupSummary,
            messages: backup.recoverable
                ? ['Текущее сохранение отсутствует, но найден recoverable backup.']
                : ['Текущее локальное сохранение ещё не создано.']
        });
    }

    const parsed = parseJson(raw.value);
    if (!parsed.ok) {
        return buildHealth({
            status: 'error',
            current: {
                present: true,
                parseStatus: 'invalid-json',
                bytes: byteLength(raw.value),
                supportedVersion: APP_CONFIG.STORAGE_VERSION
            },
            backup: backupSummary,
            messages: ['Текущее сохранение повреждено: JSON не читается.']
        });
    }

    if (!parsed.value || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) {
        return buildHealth({
            status: 'error',
            current: {
                present: true,
                parseStatus: 'invalid-shape',
                bytes: byteLength(raw.value),
                supportedVersion: APP_CONFIG.STORAGE_VERSION
            },
            backup: backupSummary,
            messages: ['Текущее сохранение повреждено: ожидается объект состояния.']
        });
    }

    const preview = buildStatePreview(parsed.value, {
        currentState,
        criteria,
        decimalSeparator
    });

    const current = {
        present: true,
        parseStatus: 'ok',
        bytes: byteLength(raw.value),
        sourceVersion: preview.sourceVersion,
        supportedVersion: preview.supportedVersion,
        futureVersion: preview.futureVersion,
        issueCount: preview.issueCount,
        migrationError: preview.migrationError,
        counts: preview.migratedSummary?.counts || preview.rawSummary?.counts || null
    };

    if (preview.futureVersion) {
        return buildHealth({
            status: 'blocked',
            current,
            backup: backupSummary,
            messages: [
                `Сохранение создано более новой схемой ${preview.sourceVersion}; текущая поддерживает ${preview.supportedVersion}.`
            ]
        });
    }

    if (preview.migrationError) {
        return buildHealth({
            status: 'error',
            current,
            backup: backupSummary,
            messages: [`Сохранение читается, но миграция завершилась ошибкой: ${preview.migrationError}.`]
        });
    }

    if (preview.issueCount > 0) {
        return buildHealth({
            status: 'warning',
            current,
            backup: backupSummary,
            messages: [`Сохранение читается, но миграция применит fallback'и для ${preview.issueCount} полей.`]
        });
    }

    return buildHealth({
        status: 'ok',
        current,
        backup: backupSummary,
        messages: ['Текущее сохранение читается и соответствует поддерживаемой схеме.']
    });
}

function buildHealth({ status, current, backup, messages }) {
    return {
        status,
        checkedAt: new Date().toISOString(),
        current,
        backup,
        messages
    };
}

function summarizeBackup(backup, raw) {
    return {
        present: Boolean(backup?.present),
        recoverable: Boolean(backup?.recoverable),
        status: backup?.status || 'missing',
        bytes: byteLength(typeof raw?.value === 'string' ? raw.value : null),
        dataBytes: Number(backup?.dataBytes || 0),
        fromVersion: backup?.fromVersion ?? null,
        createdAt: Number.isFinite(backup?.ts) ? backup.ts : null,
        counts: backup?.summary?.counts || null
    };
}

function safeStorageGet(storage, key) {
    try {
        return { value: storage?.getItem?.(key) ?? null };
    } catch (error) {
        return { value: null, error: error?.name || 'StorageError' };
    }
}

function parseJson(raw) {
    try {
        return { ok: true, value: JSON.parse(raw) };
    } catch {
        return { ok: false, value: null };
    }
}

function byteLength(value) {
    if (typeof value !== 'string') return 0;
    if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(value).length;
    }
    return value.length;
}
