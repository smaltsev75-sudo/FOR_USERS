// js/services/instanceLock.js
//
// v8.30.16: запрет одновременной работы НЕСКОЛЬКИХ экземпляров приложения в
// одной origin. Две вкладки на http://localhost:8123/ делят localStorage, и
// каждая держит свой in-memory snapshot. Любая правка → save → last-writer-wins
// без merge'а: задачи/правки из «проигравшего» снапшота теряются. Касается
// одинаково (а) двух вкладок ОДНОЙ версии и (б) двух вкладок РАЗНЫХ версий —
// версия здесь только метаданные для UX-сообщения, не критерий допуска.
//
// v8.30.19: acquire переведён на Web Locks API (navigator.locks) как primary
// механизм. Закрывает TOCTOU race из P1 self-review v8.30.18 — localStorage
// setItem не атомарен между вкладками, и до этого фикса две вкладки,
// запускаемые почти одновременно, обе могли пройти проверку конфликта.
// Web Locks API реально атомарен (Chrome 69+/Firefox 96+/Safari 15.4+).
// Registry в localStorage остаётся для UI-меты — показать blocked screen
// с версией конфликтующей вкладки. Web Locks API сам по себе не сообщает
// «кто держит lock». BroadcastChannel hello/leave удалён как dead code.
//
// Политика: first-active-wins. Latecomer блокируется независимо от версии.
//
// Cross-origin (разные порты / handoff-папки на другом порту) браузером
// изолированы по same-origin policy: localStorage у них раздельный, конфликта
// данных нет в принципе → нечего детектировать. См. UserManual «Когда возникает
// экран блокировки».

const INSTANCE_LOCK_STORAGE_KEY = 'planner.instances';
const LOCK_RESOURCE_NAME = 'planner-instance';
const HEARTBEAT_MS = 2000;
const STALE_TIMEOUT_MS = 8000;

export { INSTANCE_LOCK_STORAGE_KEY };

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

function findConflictEntry(registry) {
    for (const entry of Object.values(registry)) {
        if (entry && typeof entry === 'object') return entry;
    }
    return null;
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

function defaultLocksApi() {
    if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
        return navigator.locks;
    }
    return null;
}

/**
 * Пытается захватить «активную вкладку» на этом origin.
 *
 * Primary: navigator.locks.request(LOCK_RESOURCE_NAME, {mode:'exclusive',
 * ifAvailable:true}, callback). Если callback получает `lock !== null`, мы
 * первая вкладка; держим lock через unresolved promise до release(). Если
 * lock === null — кто-то уже держит, мы заблокированы.
 *
 * Registry в localStorage — только UI-метаданные: версия конфликтующей
 * вкладки на blocked screen, heartbeat обновляет timestamp, чтобы запись
 * не считалась stale. Решение о допуске принимает Web Locks API, не registry.
 *
 * Fallback (locksApi === null): registry-only механизм с известным TOCTOU.
 * Используется только в jsdom-тестах и совсем старых браузерах (без Web
 * Locks). В проде современные браузеры предоставляют API с 2022 года.
 *
 * @param {Object} options
 * @param {string} options.version          APP_VERSION (попадает в registry для UI)
 * @param {number} options.storageVersion   APP_CONFIG.STORAGE_VERSION
 * @param {() => number} [options.now]
 * @param {() => string} [options.idGenerator]
 * @param {number} [options.heartbeatMs]
 * @param {number} [options.staleMs]
 * @param {(fn: () => void, ms: number) => any} [options.scheduleInterval]
 * @param {(handle: any) => void} [options.clearScheduledInterval]
 * @param {(handler: () => void) => () => void} [options.bindUnload]
 * @param {{ request: Function } | null} [options.locksApi] — мок navigator.locks
 *
 * @returns {Promise<
 *   { ok: true, instanceId: string, release: () => void }
 *   | { ok: false, conflict: { version: string, storageVersion: number } }
 *   | { ok: false, conflict: null, error: string }
 * >}
 */
export async function acquire({
    version,
    storageVersion,
    now = Date.now,
    idGenerator = defaultIdGenerator,
    heartbeatMs = HEARTBEAT_MS,
    staleMs = STALE_TIMEOUT_MS,
    scheduleInterval = setInterval,
    clearScheduledInterval = clearInterval,
    bindUnload = defaultBindUnload,
    locksApi = defaultLocksApi()
} = {}) {
    if (locksApi && typeof locksApi.request === 'function') {
        return acquireViaWebLocks({
            version, storageVersion, now, idGenerator, heartbeatMs, staleMs,
            scheduleInterval, clearScheduledInterval, bindUnload, locksApi
        });
    }
    return acquireViaRegistryFallback({
        version, storageVersion, now, idGenerator, heartbeatMs, staleMs,
        scheduleInterval, clearScheduledInterval, bindUnload
    });
}

async function acquireViaWebLocks(opts) {
    const { version, storageVersion, now, idGenerator, heartbeatMs, staleMs,
        scheduleInterval, clearScheduledInterval, bindUnload, locksApi } = opts;

    let releaseLock = null;
    let gotLock = false;
    const tellAcquireWeKnow = (() => {
        let resolveFn;
        const p = new Promise((res) => { resolveFn = res; });
        return { promise: p, signal: () => resolveFn() };
    })();

    // navigator.locks.request возвращает promise, который резолвится после
    // того, как callback завершится. Чтобы держать lock сколько хочется,
    // callback возвращает promise, который мы резолвим только в release().
    // Запускаем request параллельно: тот же текущий микротаск переходит к
    // ожиданию tellAcquireWeKnow.promise — она будет resolved либо изнутри
    // callback'а (got lock), либо если callback получил null (no lock).
    locksApi.request(LOCK_RESOURCE_NAME, { mode: 'exclusive', ifAvailable: true }, (lock) => {
        if (!lock) {
            gotLock = false;
            tellAcquireWeKnow.signal();
            return; // releases lock-callback promise — нам ничего не дали
        }
        gotLock = true;
        // Держим lock пока release() не вызвана.
        return new Promise((resolveLockHeld) => {
            releaseLock = resolveLockHeld;
            tellAcquireWeKnow.signal();
        });
    });

    await tellAcquireWeKnow.promise;

    const nowMs = now();
    // Прибрать stale-записи независимо от исхода (даже если не получили lock —
    // зачистим то, что осталось от давно закрытых вкладок).
    const prunedReg = pruneStale(readRegistry(), nowMs, staleMs);
    writeRegistry(prunedReg);

    if (!gotLock) {
        // Lock держит другая вкладка. Прочитаем registry для UI-инфо.
        const other = findConflictEntry(prunedReg);
        if (other) {
            return {
                ok: false,
                conflict: { version: other.version, storageVersion: other.storageVersion }
            };
        }
        return { ok: false, conflict: null, error: 'LockUnavailable' };
    }

    // Мы держим lock. Регистрируем себя в registry для UX-метаданных.
    const instanceId = idGenerator();
    const updated = {
        ...prunedReg,
        [instanceId]: {
            version,
            storageVersion,
            firstSeenAt: nowMs,
            lastHeartbeat: nowMs
        }
    };
    const writeResult = writeRegistry(updated);
    if (!writeResult.ok) {
        // Не смогли записать metadata. Освобождаем lock и возвращаем error.
        if (releaseLock) releaseLock();
        return { ok: false, conflict: null, error: writeResult.error };
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
        if (heartbeatHandle !== null) {
            try { clearScheduledInterval(heartbeatHandle); } catch { /* ignore */ }
            heartbeatHandle = null;
        }
        const reg = readRegistry();
        if (reg[instanceId]) {
            delete reg[instanceId];
            writeRegistry(reg);
        }
        if (releaseLock) {
            try { releaseLock(); } catch { /* ignore */ }
            releaseLock = null;
        }
        try { unbindUnload(); } catch { /* ignore */ }
    }

    return { ok: true, instanceId, release: releaseImpl };
}

/**
 * Fallback для окружений без navigator.locks (jsdom, очень старые браузеры).
 * Имеет известный TOCTOU race при одновременном acquire из двух процессов,
 * но это приемлемо для CI и edge-окружений; в проде Web Locks доступны.
 */
async function acquireViaRegistryFallback(opts) {
    const { version, storageVersion, now, idGenerator, heartbeatMs, staleMs,
        scheduleInterval, clearScheduledInterval, bindUnload } = opts;

    const nowMs = now();
    const registry = pruneStale(readRegistry(), nowMs, staleMs);
    writeRegistry(registry);

    const conflict = findConflictEntry(registry);
    if (conflict) {
        return {
            ok: false,
            conflict: { version: conflict.version, storageVersion: conflict.storageVersion }
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

    let released = false;
    let heartbeatHandle = scheduleInterval(() => {
        if (released) return;
        const live = pruneStale(readRegistry(), now(), staleMs);
        if (!live[instanceId]) return;
        live[instanceId].lastHeartbeat = now();
        writeRegistry(live);
    }, heartbeatMs);

    const unbindUnload = bindUnload(() => releaseImpl());

    function releaseImpl() {
        if (released) return;
        released = true;
        if (heartbeatHandle !== null) {
            try { clearScheduledInterval(heartbeatHandle); } catch { /* ignore */ }
            heartbeatHandle = null;
        }
        const reg = readRegistry();
        if (reg[instanceId]) {
            delete reg[instanceId];
            writeRegistry(reg);
        }
        try { unbindUnload(); } catch { /* ignore */ }
    }

    return { ok: true, instanceId, release: releaseImpl };
}
