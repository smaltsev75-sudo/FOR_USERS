import { APP_VERSION } from '../version.js';
import { APP_CONFIG } from '../utils/appConfig.js';

const STORAGE_KEY = 'sprintPlannerData';
const BACKUP_KEY = 'sprintPlannerData.backup';

export function buildDiagnosticsFilename(now = new Date()) {
    const stamp = now.toISOString().slice(0, 10);
    return `sprint-planner-diagnostics-${stamp}.json`;
}

export async function collectDiagnosticsBundle({
    state = null,
    criteria = [],
    decimalSeparator = ',',
    env = globalThis,
    now = () => new Date().toISOString()
} = {}) {
    const navigatorRef = env.navigator || {};
    const localStorageRef = env.localStorage || null;
    const rawState = safeStorageGet(localStorageRef, STORAGE_KEY);
    const rawBackup = safeStorageGet(localStorageRef, BACKUP_KEY);
    const parsedState = parseJson(rawState);

    return {
        schemaVersion: 1,
        generatedAt: now(),
        app: {
            version: APP_VERSION,
            storageVersion: APP_CONFIG.STORAGE_VERSION
        },
        runtime: {
            userAgent: navigatorRef.userAgent || '',
            platform: navigatorRef.platform || '',
            language: navigatorRef.language || '',
            online: typeof navigatorRef.onLine === 'boolean' ? navigatorRef.onLine : null,
            timeZone: safeTimeZone(env)
        },
        serviceWorker: serviceWorkerSummary(navigatorRef),
        caches: await cachesSummary(env.caches),
        storage: {
            plannerDataPresent: typeof rawState === 'string',
            plannerDataBytes: byteLength(rawState),
            backupPresent: typeof rawBackup === 'string',
            backupBytes: byteLength(rawBackup),
            estimate: await storageEstimate(navigatorRef)
        },
        currentState: summarizeState(state, { criteria, decimalSeparator }),
        persistedState: summarizeState(parsedState)
    };
}

export function summarizeState(state, { criteria = state?.criteria || [], decimalSeparator = state?.numberFormatSettings?.decimalSeparator } = {}) {
    if (!state || typeof state !== 'object') {
        return { present: false };
    }
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const roles = Array.isArray(state.roles) ? state.roles : [];
    const criteriaList = Array.isArray(criteria) ? criteria : [];
    const config = state.config || {};
    return {
        present: true,
        version: state.version ?? null,
        activeTab: state.activeTab || null,
        ui: {
            activeAlgorithm: state.ui?.activeAlgorithm || null,
            density: state.ui?.density || null,
            viewMode: state.ui?.viewMode || null,
            expandedQuadrantsCount: Array.isArray(state.ui?.expandedQuadrants) ? state.ui.expandedQuadrants.length : 0
        },
        config: {
            productLength: typeof config.product === 'string' ? config.product.length : 0,
            days: finiteOrNull(config.days),
            startDatePresent: Boolean(config.startDate),
            endDatePresent: Boolean(config.endDate),
            holidays: finiteOrNull(config.holidays),
            availCoef: finiteOrNull(config.availCoef),
            alert: finiteOrNull(config.alert)
        },
        counts: {
            tasks: tasks.length,
            includedTasks: tasks.filter(task => !task.excluded).length,
            excludedTasks: tasks.filter(task => task.excluded).length,
            roles: roles.length,
            criteria: criteriaList.length
        },
        taskTypes: countBy(tasks, task => task.type || 'unknown'),
        roleIds: roles.map(role => role.id).filter(Boolean),
        criteriaWeights: criteriaList.map(item => ({
            id: item.id,
            abbreviation: item.abbreviation || '',
            weight: finiteOrNull(item.weight)
        })),
        numberFormat: {
            decimalSeparator: decimalSeparator || ','
        }
    };
}

function countBy(items, keyFn) {
    const counts = {};
    for (const item of items) {
        const key = keyFn(item);
        counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
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
    return new Blob([value]).size;
}

function finiteOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function safeTimeZone(env) {
    try {
        return env.Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || '';
    } catch {
        return '';
    }
}

function serviceWorkerSummary(navigatorRef) {
    const serviceWorker = navigatorRef.serviceWorker;
    return {
        supported: Boolean(serviceWorker),
        controlled: Boolean(serviceWorker?.controller),
        controllerScriptURL: serviceWorker?.controller?.scriptURL || ''
    };
}

async function cachesSummary(cachesRef) {
    if (!cachesRef?.keys) {
        return { supported: false, keys: [] };
    }
    try {
        return { supported: true, keys: await cachesRef.keys() };
    } catch (err) {
        return { supported: true, keys: [], error: err?.name || 'CacheError' };
    }
}

async function storageEstimate(navigatorRef) {
    try {
        const estimate = await navigatorRef.storage?.estimate?.();
        if (!estimate) return null;
        return {
            usage: finiteOrNull(estimate.usage),
            quota: finiteOrNull(estimate.quota)
        };
    } catch {
        return null;
    }
}
