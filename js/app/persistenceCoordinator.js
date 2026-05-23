// @ts-check
// js/app/persistenceCoordinator.js

/**
 * Coordinates debounced persistence and persist-failure notifications.
 *
 * Runtime persistence stays out of App bootstrap so storage retry/throttle rules
 * can be tested independently from controller wiring.
 */
export class PersistenceCoordinator {
    /**
     * @param {object} deps
     * @param {import('../state/store.js').Store} deps.store
     * @param {{ getCriteria: () => Array<object> }} deps.criteriaManager
     * @param {{ decimalSeparator: string, saveSettings: () => ({ ok?: boolean, error?: string }|undefined) }} deps.nfs
     * @param {{ save: (data: object) => ({ ok?: boolean, error?: string }|undefined) }} deps.storage
     * @param {(state: object, criteria: Array<object>, decimalSeparator: string) => object} deps.serializeState
     * @param {(message: string, options?: object) => void} deps.showSnackbar
     * @param {number} [deps.delayMs]
     * @param {{ document?: Document, setTimeout?: typeof setTimeout, clearTimeout?: typeof clearTimeout, Date?: DateConstructor }} [deps.runtime]
     */
    constructor({
        store,
        criteriaManager,
        nfs,
        storage,
        serializeState,
        showSnackbar,
        delayMs = 200,
        runtime = globalThis
    }) {
        this._store = store;
        this._criteriaManager = criteriaManager;
        this._nfs = nfs;
        this._storage = storage;
        this._serializeState = serializeState;
        this._showSnackbar = showSnackbar;
        this._delayMs = delayMs;
        this._runtime = runtime;
        this._timeout = null;
        this._lastFailureNotify = 0;
        this.schedulePersist = this.schedulePersist.bind(this);
        this.flush = this.flush.bind(this);
    }

    get pending() {
        return this._timeout !== null;
    }

    schedulePersist() {
        if (this._timeout !== null) {
            this._runtime.clearTimeout?.(this._timeout);
        }
        this._timeout = this._runtime.setTimeout?.(() => {
            this._timeout = null;
            this.saveNow();
        }, this._delayMs) ?? null;
    }

    flush() {
        if (this._timeout !== null) {
            this._runtime.clearTimeout?.(this._timeout);
            this._timeout = null;
        }
        this.saveNow();
    }

    saveNow() {
        const state = this._store.getState();
        const data = this._serializeState(
            state,
            this._criteriaManager.getCriteria(),
            this._nfs.decimalSeparator
        );
        const stateResult = this._storage.save(data);
        // v8.30.2: nfs.saveSettings раньше делал localStorage.setItem БЕЗ
        // try/catch — при quota/security error прерывал autosave даже после
        // fix v8.30.0. Обе persist-точки возвращают {ok,error}; любой fail
        // триггерит snackbar.
        const nfsResult = this._nfs.saveSettings();
        const failed = (stateResult && !stateResult.ok)
            ? stateResult
            : (nfsResult && !nfsResult.ok ? nfsResult : null);
        if (failed) this._notifyPersistFailure(failed.error);
    }

    /**
     * @param {string|undefined} errorName
     * @private
     */
    _notifyPersistFailure(errorName) {
        const now = this._runtime.Date?.now?.() ?? Date.now();
        if (this._lastFailureNotify && now - this._lastFailureNotify < 30000) return;
        this._lastFailureNotify = now;
        const isQuota = /quota/i.test(String(errorName));
        const message = isQuota
            ? 'Не удалось сохранить: переполнено хранилище браузера. Скачайте JSON через «Сохранить» в правом верхнем углу.'
            : `Не удалось сохранить данные в браузере (${errorName}). Скачайте JSON через «Сохранить».`;
        const doc = this._runtime.document;
        if (typeof doc !== 'undefined' && doc.body) {
            this._showSnackbar(message, { duration: 8000 });
        }
    }
}
