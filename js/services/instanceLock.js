// js/services/instanceLock.js
//
// v8.30.16: запрет одновременной работы НЕСКОЛЬКИХ экземпляров приложения в
// одной origin. Две вкладки на http://localhost:8123/ делят localStorage, и
// каждая держит свой in-memory snapshot. Любая правка → save → last-writer-wins
// без merge'а: задачи/правки из «проигравшего» снапшота теряются. Касается
// одинаково (а) двух вкладок ОДНОЙ версии и (б) двух вкладок РАЗНЫХ версий —
// версия здесь только метаданные для UX-сообщения, не критерий допуска.
// См. docs/RELEASE_NOTES.md (v8.30.16) и feedback_storage_status_contract.
//
// Политика: first-active-wins. Latecomer блокируется независимо от версии.
//
// Cross-origin (разные порты / handoff-папки на другом порту) браузером
// изолированы по same-origin policy: localStorage у них раздельный, конфликта
// данных нет в принципе → нечего детектировать. См. UserManual «Когда возникает
// экран блокировки».

const INSTANCE_LOCK_STORAGE_KEY = 'planner.instances';
const CHANNEL_NAME = 'planner-instances';
const HEARTBEAT_MS = 2000;
const STALE_TIMEOUT_MS = 8000;

export { INSTANCE_LOCK_STORAGE_KEY, CHANNEL_NAME, HEARTBEAT_MS, STALE_TIMEOUT_MS };

function readRegistry() {
    try {
        const raw = localStorage.getItem(INSTANCE_LOCK_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch {
        return {};
    }
}

function writeRegistry(registry) {
    try {
        localStorage.setItem(INSTANCE_LOCK_STORAGE_KEY, JSON.stringify(registry));
        return { ok: true };
    } catch (err) {
        const name = (err && (err.name || err.message)) || 'StorageError';
        return { ok: false, error: String(name) };
    }
}

function pruneStale(registry, now, staleMs) {
    const result = {};
    for (const [id, entry] of Object.entries(registry)) {
        if (!entry || typeof entry !== 'object') continue;
        const lastHb = Number(entry.lastHeartbeat);
        if (!Number.isFinite(lastHb)) continue;
        if (now - lastHb <= staleMs) result[id] = entry;
    }
    return result;
}

/**
 * v8.30.16: возвращает ЛЮБУЮ живую запись (после prune-stale). Версия
 * сравнивается только для диагностики на blockedScreen, не для решения о
 * допуске — потому что даже две вкладки одной версии теряют данные через
 * last-writer-wins в localStorage.
 */
function findConflict(registry) {
    for (const entry of Object.values(registry)) {
        if (entry && typeof entry === 'object') return entry;
    }
    return null;
}

function defaultChannelFactory(name) {
    if (typeof BroadcastChannel === 'undefined') return null;
    try {
        return new BroadcastChannel(name);
    } catch {
        return null;
    }
}

function defaultIdGenerator() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try { return crypto.randomUUID(); } catch { /* fallthrough */ }
    }
    return `inst-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultBindUnload(handler) {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
}

/**
 * Пытается захватить «активную вкладку» на этом origin для пары
 * `{version, storageVersion}`.
 *
 * @param {Object} options
 * @param {string} options.version          APP_VERSION
 * @param {number} options.storageVersion   APP_CONFIG.STORAGE_VERSION
 * @param {() => number} [options.now]
 * @param {(name: string) => (BroadcastChannel|null)} [options.channelFactory]
 * @param {() => string} [options.idGenerator]
 * @param {number} [options.heartbeatMs]
 * @param {number} [options.staleMs]
 * @param {(fn: () => void, ms: number) => any} [options.scheduleInterval]
 * @param {(handle: any) => void} [options.clearScheduledInterval]
 * @param {(handler: () => void) => () => void} [options.bindUnload]
 *
 * @returns {
 *   { ok: true, instanceId: string, release: () => void }
 *   | { ok: false, conflict: { version: string, storageVersion: number } }
 *   | { ok: false, conflict: null, error: string }
 * }
 */
export function acquire({
    version,
    storageVersion,
    now = Date.now,
    channelFactory = defaultChannelFactory,
    idGenerator = defaultIdGenerator,
    heartbeatMs = HEARTBEAT_MS,
    staleMs = STALE_TIMEOUT_MS,
    scheduleInterval = setInterval,
    clearScheduledInterval = clearInterval,
    bindUnload = defaultBindUnload
} = {}) {
    const nowMs = now();
    const registry = pruneStale(readRegistry(), nowMs, staleMs);
    writeRegistry(registry); // прибрать stale-записи независимо от исхода

    const conflict = findConflict(registry);
    if (conflict) {
        return {
            ok: false,
            conflict: {
                version: conflict.version,
                storageVersion: conflict.storageVersion
            }
        };
    }

    const instanceId = idGenerator();
    registry[instanceId] = {
        version,
        storageVersion,
        firstSeenAt: nowMs,
        lastHeartbeat: nowMs
    };
    const writeResult = writeRegistry(registry);
    if (!writeResult.ok) {
        return { ok: false, conflict: null, error: writeResult.error };
    }

    const channel = channelFactory(CHANNEL_NAME);
    if (channel) {
        try {
            channel.postMessage({
                type: 'hello',
                instanceId,
                version,
                storageVersion,
                firstSeenAt: nowMs
            });
        } catch { /* BC closed/блокирован — игнорируем */ }
    }

    let released = false;
    let heartbeatHandle = scheduleInterval(() => {
        if (released) return;
        const live = pruneStale(readRegistry(), now(), staleMs);
        if (!live[instanceId]) return; // другой код уже удалил — не воскрешать
        live[instanceId].lastHeartbeat = now();
        writeRegistry(live);
    }, heartbeatMs);

    const unbindUnload = bindUnload(() => releaseImpl());

    function releaseImpl() {
        if (released) return;
        released = true;
        if (heartbeatHandle != null) {
            try { clearScheduledInterval(heartbeatHandle); } catch { /* ignore */ }
            heartbeatHandle = null;
        }
        const reg = readRegistry();
        if (reg[instanceId]) {
            delete reg[instanceId];
            writeRegistry(reg);
        }
        if (channel) {
            try { channel.postMessage({ type: 'leave', instanceId }); } catch { /* ignore */ }
            try { channel.close(); } catch { /* ignore */ }
        }
        try { unbindUnload(); } catch { /* ignore */ }
    }

    return { ok: true, instanceId, release: releaseImpl };
}
