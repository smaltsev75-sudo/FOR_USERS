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
import { PersistenceCoordinator } from './app/persistenceCoordinator.js';
import { RenderScheduler } from './app/renderScheduler.js';

export class App {
    /**
     * Корневой orchestrator приложения.
     * Инициализирует store, контроллеры и единый цикл render/persist.
     */
    constructor() {
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
        this.renderScheduler = new RenderScheduler(() => this.render());
        this.persistenceCoordinator = new PersistenceCoordinator({
            store: this.store,
            criteriaManager: this.criteriaManager,
            nfs: this.nfs,
            storage: storageService,
            serializeState: serializeStateForStorage,
            showSnackbar
        });
        this.requestRender = this.renderScheduler.requestRender;
        this.schedulePersist = this.persistenceCoordinator.schedulePersist;
        this.saveToLS = this.persistenceCoordinator.saveNow.bind(this.persistenceCoordinator);

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
            this.persistenceCoordinator.flush();
        });
        this.keyboardController.init();
        this.requestRender();
    }

    render() {
        renderApp(this.store.getState(), {
            nfs: this.nfs,
            taskController: this.taskController
        });
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
        // v8.30.20 P2 #5 self-review: до фикса ЛЮБОЙ !lock.ok рендерился как
        // mode='conflict'. Для QuotaExceededError / SecurityError из instanceLock
        // metadata-записи это давало ложное «уже открыта другая вкладка»,
        // хотя реальная причина — проблема со storage. Различаем:
        //   - lock.conflict !== null → другая вкладка реально активна → 'conflict'
        //   - lock.error === 'LockUnavailable' → Web Locks вернул null, но
        //     registry ещё пуст (race window, другая вкладка пока не успела
        //     записать metadata) → всё равно 'conflict' с заглушкой версии
        //   - lock.error любой другой (Storage*) → 'lock-storage-error'
        const isStorageError = lock.conflict === null
            && lock.error
            && lock.error !== 'LockUnavailable';
        if (isStorageError) {
            renderBlockedScreen({ mode: 'lock-storage-error', mine, error: lock.error });
        } else {
            renderBlockedScreen({
                mode: 'conflict',
                mine,
                other: lock.conflict || {
                    version: '(неизвестно)',
                    storageVersion: APP_CONFIG.STORAGE_VERSION
                }
            });
        }
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

        // v8.30.20 P2 #6 self-review: до фикса backup создавался ТОЛЬКО при
        // `Number.isFinite(savedVersion) && savedVersion < STORAGE_VERSION`.
        // Legacy JSON без `version` поля или с NaN/null/нечисловой версией
        // НЕ бэкапился, но миграция (migratePersistedState) всё равно
        // нормализовала state и при первом save перештамповывала raw →
        // исходное состояние терялось. Теперь backup срабатывает на любой
        // нетекущей версии (включая NaN — fromVersion=0 как legacy-marker).
        // Также corrupt JSON бэкапим — пользователь может захотеть посмотреть
        // raw для recovery.
        const needsBackup = (parsed === null)
            || (!Number.isFinite(savedVersion))
            || (savedVersion !== APP_CONFIG.STORAGE_VERSION);
        if (needsBackup) {
            const fromVersion = Number.isFinite(savedVersion) ? savedVersion : 0;
            const backupResult = storageService.saveBackup(rawSaved, fromVersion);
            if (backupResult && !backupResult.ok) {
                renderBlockedScreen({
                    mode: 'backup-failed',
                    mine,
                    savedVersion: fromVersion,
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
        // bootstrap failure нельзя проглатывать (no-console уже off в eslint.config)
        console.error('[bootstrapApp] неперехваченная ошибка:', err);
    });
}
