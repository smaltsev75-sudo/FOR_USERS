import { summarizeState } from './diagnostics.js';
import { BACKUP_STORAGE_KEY, storageService } from './storage.js';
import { buildStatePreview } from './statePreview.js';

export function buildRecoveryBackupFilename(now = new Date()) {
    const stamp = now.toISOString().slice(0, 10);
    return `sprint-planner-backup-${stamp}.json`;
}

export function readRecoveryBackup({ storage = globalThis.localStorage } = {}) {
    const raw = safeStorageGet(storage, BACKUP_STORAGE_KEY);
    if (typeof raw !== 'string' || raw.length === 0) {
        return { present: false, status: 'missing' };
    }

    const payload = parseJson(raw);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return {
            present: true,
            recoverable: false,
            status: 'invalid-metadata',
            backupBytes: byteLength(raw)
        };
    }

    const rawData = typeof payload.data === 'string' ? payload.data : '';
    const state = parseJson(rawData);
    const base = {
        present: true,
        ts: finiteOrNull(payload.ts),
        fromVersion: finiteOrNull(payload.fromVersion),
        backupBytes: byteLength(raw),
        dataBytes: byteLength(rawData)
    };

    if (!state || typeof state !== 'object' || Array.isArray(state)) {
        return {
            ...base,
            recoverable: false,
            status: 'invalid-data'
        };
    }

    return {
        ...base,
        recoverable: true,
        status: 'ready',
        state,
        summary: summarizeState(state)
    };
}

export function buildRecoveryComparison({ currentState, backupState, criteria, decimalSeparator }) {
    const preview = buildStatePreview(backupState, { currentState, criteria, decimalSeparator });
    const current = preview.currentSummary || summarizeState(currentState, { criteria, decimalSeparator });
    const backup = preview.migratedSummary?.present
        ? preview.migratedSummary
        : summarizeState(backupState);
    return {
        current,
        backup,
        deltas: {
            tasks: count(backup, 'tasks') - count(current, 'tasks'),
            includedTasks: count(backup, 'includedTasks') - count(current, 'includedTasks'),
            excludedTasks: count(backup, 'excludedTasks') - count(current, 'excludedTasks'),
            criteria: count(backup, 'criteria') - count(current, 'criteria'),
            roles: count(backup, 'roles') - count(current, 'roles')
        },
        preview
    };
}

export function saveRecoveredState(state, { storage = storageService } = {}) {
    return storage.save(state);
}

function safeStorageGet(storage, key) {
    try {
        return storage?.getItem?.(key) ?? null;
    } catch {
        return null;
    }
}

function parseJson(raw) {
    if (typeof raw !== 'string' || raw.length === 0) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function byteLength(value) {
    if (typeof value !== 'string') return 0;
    if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(value).length;
    }
    return value.length;
}

function finiteOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function count(summary, key) {
    return Number(summary?.counts?.[key] || 0);
}
