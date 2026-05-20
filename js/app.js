// js/app.js

import { Store } from './state/store.js';
import { NumberFormatService } from './services/numberFormat.js';
import { storageService } from './services/storage.js';
import { CriteriaManager } from './domain/criteriaManager.js';
import { ConfigController } from './controllers/configController.js';
import { RoleController } from './controllers/roleController.js';
import { CapacityStripController } from './controllers/capacityStripController.js';
import { TaskController } from './controllers/taskController.js';
import { CriteriaController } from './controllers/criteriaController.js';
import { SelectionController } from './controllers/selectionController.js';
import { FileController } from './controllers/fileController.js';
import { TabController } from './controllers/tabController.js';
import { ViewModeController } from './controllers/viewModeController.js';
import { renderApp } from './ui/index.js';
import { calculatePriorityScore } from './domain/criteria.js';
import { createDefaultConfig } from './domain/config.js';
import { createDefaultRoles } from './domain/role.js';
import { HelpController } from './controllers/helpController.js';
import { KeyboardController } from './controllers/keyboardController.js';
import { migratePersistedState, serializeStateForStorage } from './state/persistence.js';
import { ThemeController } from './controllers/themeController.js';
import { DensityController } from './controllers/densityController.js';
import { renderAppVersionBadge, bindPrintTimestamp } from './ui/appVersionBadge.js';
import { showSnackbar } from './ui/snackbar.js';
import { acquire as acquireInstanceLock } from './services/instanceLock.js';
import { renderBlockedScreen } from './ui/blockedScreen.js';
import { APP_VERSION } from './version.js';
import { APP_CONFIG } from './utils/appConfig.js';

export class App {
    /**
     * Корневой orchestrator приложения.
     * Инициализирует store, контроллеры и единый цикл render/persist.
     */
    constructor() {
        this.renderQueued = false;
        this.persistTimeout = null;
        this.persistDelayMs = 200;
        this.requestRender = this.requestRender.bind(this);
        this.schedulePersist = this.schedulePersist.bind(this);
        this.nfs = new NumberFormatService();

        const savedState = storageService.load();
        const initialState = savedState ? migratePersistedState(savedState) : this.createInitialState();
        this.store = new Store(initialState);

        this.criteriaManager = new CriteriaManager();
        if (initialState.criteria && initialState.criteria.length > 0) {
            this.criteriaManager.loadCriteria(initialState.criteria);
        }
        this.store.setCriteria(this.criteriaManager.getCriteria());
        this.nfs.decimalSeparator = initialState.numberFormatSettings?.decimalSeparator || this.nfs.decimalSeparator;

        this.configController = new ConfigController(this.store, this.nfs);
        this.roleController = new RoleController(this.store, this.nfs);
        this.capacityStripController = new CapacityStripController(this.store, this.nfs);
        this.taskController = new TaskController(this.store, this.nfs);
        this.criteriaController = new CriteriaController(this.store, this.criteriaManager);
        this.selectionController = new SelectionController(this.store, this.criteriaManager, this.nfs);
        this.fileController = new FileController(this.store, this.nfs, this.criteriaManager);
        this.tabController = new TabController(this.store);
        this.viewModeController = new ViewModeController(this.store);
        this.helpController = new HelpController();
        this.keyboardController = new KeyboardController(this.taskController, this.fileController);
        this.themeController = new ThemeController();
        this.densityController = new DensityController(this.store);

        this.taskController.setPriorityScoreCalculator((task) => {
            return calculatePriorityScore(this.criteriaManager.getCriteria(), task.criteriaEvaluations);
        });

        this.init();
    }

    createInitialState() {
        const config = createDefaultConfig();
        const roles = createDefaultRoles();
        return {
            config,
            roles,
            tasks: [],
            criteria: [],
            numberFormatSettings: { decimalSeparator: ',' },
            activeTab: 'planning',
            lastAddedTaskId: null
        };
    }

    init() {
        renderAppVersionBadge();
        bindPrintTimestamp();
        this.themeController.init();
        this.densityController.init();
        this.configController.init();
        this.roleController.init();
        this.capacityStripController.init();
        this.taskController.init();
        this.criteriaController.init();
        this.selectionController.init();
        this.fileController.init();
        this.tabController.init();
        this.viewModeController.init();
        this.helpController.init();
        this.store.subscribe(() => {
            this.schedulePersist();
            this.requestRender();
        });
        window.addEventListener('beforeunload', () => {
            if (this.persistTimeout) {
                clearTimeout(this.persistTimeout);
                this.persistTimeout = null;
            }
            this.saveToLS();
        });
        this.keyboardController.init();
        this.requestRender();
    }

    requestRender() {
        if (this.renderQueued) return;
        this.renderQueued = true;
        requestAnimationFrame(() => {
            this.renderQueued = false;
            this.render();
        });
    }

    render() {
        renderApp(this.store.getState(), {
            nfs: this.nfs,
            taskController: this.taskController
        });
    }

    schedulePersist() {
        if (this.persistTimeout) {
            clearTimeout(this.persistTimeout);
        }
        this.persistTimeout = setTimeout(() => {
            this.persistTimeout = null;
            this.saveToLS();
        }, this.persistDelayMs);
    }

    saveToLS() {
        const state = this.store.getState();
        const data = serializeStateForStorage(
            state,
            this.criteriaManager.getCriteria(),
            this.nfs.decimalSeparator
        );
        const stateResult = storageService.save(data);
        // v8.30.2: nfs.saveSettings раньше делал localStorage.setItem БЕЗ
        // try/catch — при quota/security error прерывал autosave даже после
        // fix v8.30.0 (там я починил только storageService.save, забыв
        // соседнюю persist-точку). Теперь обе возвращают {ok,error}, любой
        // fail триггерит snackbar.
        const nfsResult = this.nfs.saveSettings();
        const failed = (stateResult && !stateResult.ok)
            ? stateResult
            : (nfsResult && !nfsResult.ok ? nfsResult : null);
        if (failed) this._notifyPersistFailure(failed.error);
    }

    /**
     * v8.30.0: показать snackbar при провале localStorage.setItem. Раньше
     * QuotaExceededError / SecurityError проглатывались — пользователь терял
     * рабочий день после F5. Throttle 30 сек: не спамим при повторных fail'ах.
     * @param {string} errorName
     * @private
     */
    _notifyPersistFailure(errorName) {
        const now = Date.now();
        if (this._lastPersistFailureNotify && now - this._lastPersistFailureNotify < 30000) return;
        this._lastPersistFailureNotify = now;
        const isQuota = /quota/i.test(String(errorName));
        const message = isQuota
            ? 'Не удалось сохранить: переполнено хранилище браузера. Скачайте JSON через «Сохранить» в правом верхнем углу.'
            : `Не удалось сохранить данные в браузере (${errorName}). Скачайте JSON через «Сохранить».`;
        // showSnackbar безопасно вызывать вне DOM — guard на document.
        if (typeof document !== 'undefined' && document.body) {
            showSnackbar(message, { duration: 8000 });
        }
    }

}

/**
 * v8.30.16: bootstrap-фаза, которая обязана отработать ДО `new App()`.
 *
 * 1. instanceLock.acquire — защищает от одновременной работы нескольких
 *    экземпляров (даже одной версии): два экземпляра с общим localStorage
 *    теряют расчёты через last-writer-wins, см. js/services/instanceLock.js.
 * 2. Downgrade-guard — если в storage сохранение из БОЛЕЕ НОВОЙ версии
 *    (savedVersion > APP_CONFIG.STORAGE_VERSION), не запускаемся, чтобы старый
 *    нормализатор не выбросил неизвестные поля. См. js/state/persistence.js.
 * 3. Backup ДО миграции — если savedVersion < APP_CONFIG.STORAGE_VERSION,
 *    raw-snapshot сохраняется в `sprintPlannerData.backup` ДО разрушительной
 *    миграции (нормализаторы перештампуют version поверх raw).
 *
 * Возвращает `App` при успешном запуске или `null` при заблокированном.
 * Async чтобы (а) явно показать порядок «acquire → check → new App», (б)
 * оставить расширение для будущих async-проверок без ломания API.
 *
 * @returns {Promise<App|null>}
 */
export async function bootstrapApp() {
    const mine = {
        version: APP_VERSION,
        storageVersion: APP_CONFIG.STORAGE_VERSION
    };

    // v8.30.19: acquire async (Web Locks API внутри) — обязательно await.
    const lock = await acquireInstanceLock(mine);
    if (!lock.ok) {
        renderBlockedScreen({
            mode: 'conflict',
            mine,
            other: lock.conflict || {
                version: '(неизвестно)',
                storageVersion: APP_CONFIG.STORAGE_VERSION
            }
        });
        return null;
    }

    const rawSaved = storageService.loadRaw();
    if (rawSaved) {
        let parsed = null;
        try { parsed = JSON.parse(rawSaved); } catch { /* corrupt JSON — App.createInitialState fallback */ }
        const savedVersion = (parsed && typeof parsed === 'object') ? Number(parsed.version) : NaN;

        if (Number.isFinite(savedVersion) && savedVersion > APP_CONFIG.STORAGE_VERSION) {
            renderBlockedScreen({
                mode: 'future-storage',
                mine,
                savedVersion
            });
            lock.release();
            return null;
        }

        if (Number.isFinite(savedVersion) && savedVersion < APP_CONFIG.STORAGE_VERSION) {
            // v8.30.19: P1 self-review v8.30.18 — раньше результат saveBackup
            // не проверялся. При quota/SecurityError backup не записывался,
            // миграция всё равно шла и перештамповывала version поверх raw
            // → исходное состояние теряется без шанса recovery. Теперь при
            // !ok рендерится отдельный mode='backup-failed' с инструкцией
            // скачать JSON вручную, а App НЕ запускается.
            const backupResult = storageService.saveBackup(rawSaved, savedVersion);
            if (backupResult && !backupResult.ok) {
                renderBlockedScreen({
                    mode: 'backup-failed',
                    mine,
                    savedVersion,
                    error: backupResult.error || 'StorageError'
                });
                lock.release();
                return null;
            }
        }
    }

    return new App();
}

if (typeof window !== 'undefined' && !window.__PLANNER_DISABLE_AUTOBOOT__) {
    bootstrapApp().catch((err) => {
        // eslint-disable-next-line no-console -- bootstrap failure нельзя проглатывать
        console.error('[bootstrapApp] неперехваченная ошибка:', err);
    });
}
