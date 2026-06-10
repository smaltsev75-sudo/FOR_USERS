import { summarizeState } from './diagnostics.js';
import { analyzeImportIssues, migratePersistedState } from '../state/persistence.js';
import { APP_CONFIG } from '../utils/appConfig.js';
import { finiteOrNull } from '../utils/measure.js';

const COUNT_KEYS = ['tasks', 'includedTasks', 'excludedTasks', 'criteria', 'roles'];

export function buildStatePreview(rawState, {
    currentState = null,
    criteria = undefined,
    decimalSeparator = undefined,
    supportedVersion = APP_CONFIG.STORAGE_VERSION
} = {}) {
    const sourceVersion = finiteOrNull(rawState?.version);
    const futureVersion = Number.isFinite(sourceVersion) && sourceVersion > supportedVersion;
    const issues = normalizeIssues(analyzeImportIssues(rawState)?.issues);
    const rawSummary = summarizeState(rawState);
    const currentSummary = currentState
        ? summarizeState(currentState, { criteria, decimalSeparator })
        : null;

    let migratedState = null;
    let migratedSummary = { present: false };
    let migrationError = null;

    if (!futureVersion) {
        try {
            migratedState = migratePersistedState(rawState);
            migratedSummary = summarizeState(migratedState);
        } catch (error) {
            migrationError = error?.message || 'MigrationError';
        }
    }

    return {
        sourceVersion,
        supportedVersion,
        futureVersion,
        issueCount: issues.length,
        issues,
        rawSummary,
        currentSummary,
        migratedState,
        migratedSummary,
        migrationError,
        deltas: buildCountDeltas(currentSummary, migratedSummary)
    };
}

function buildCountDeltas(currentSummary, targetSummary) {
    if (!currentSummary || !targetSummary?.present) return null;
    return Object.fromEntries(COUNT_KEYS.map(key => [
        key,
        count(targetSummary, key) - count(currentSummary, key)
    ]));
}

function normalizeIssues(issues) {
    if (!Array.isArray(issues)) return [];
    return issues
        .map(issue => String(issue ?? '').trim())
        .filter(Boolean);
}

function count(summary, key) {
    return Number(summary?.counts?.[key] || 0);
}
