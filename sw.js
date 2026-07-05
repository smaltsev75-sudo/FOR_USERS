// sw.js — Service Worker для Sprint Planner PWA
// Стратегия: Cache-First с fallback на сеть.
// При обновлении версии старый кэш удаляется.

const CACHE_VERSION = 'sp-v8.32.33-task-list-reconcile';

// Относительные пути ('./...') критичны для развёртывания в подпапке
// GitHub Pages (например /<repo>/) и одновременной работы в корне домена
// и из локального start-server. См. fix v8.29.3.
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './icons/icon-192.svg',
    './icons/icon-512.svg',
    './icons/icon-maskable-512.svg',
    // CSS
    './css/base.css',
    './css/layout.css',
    './css/buttons.css',
    './css/forms.css',
    './css/modals.css',
    './css/modal-feedback.css',
    './css/modal-print.css',
    './css/components.css',
    './css/matrix.css',
    './css/animations.css',
    './css/progress.css',
    './css/accordion.css',
    './css/help.css',
    './css/snackbar.css',
    './css/create-task-modal.css',
    './css/create-task-form-fields.css',
    './css/create-task-type.css',
    './css/create-task-criteria.css',
    './css/create-task-actions.css',
    './css/create-task-states.css',
    './css/criteria.css',
    './css/criteria-sumbar.css',
    './css/criteria-list.css',
    './css/criteria-scale.css',
    './css/criteria-form.css',
    './css/criteria-states.css',
    './css/selection-report.css',
    './css/selection-report-recommendations.css',
    './css/selection-report-algorithms.css',
    './css/selection-report-details.css',
    './css/selection-report-states.css',
    './css/task-card.css',
    './css/task-card-effort.css',
    './css/task-card-actions.css',
    './css/task-card-criteria.css',
    './css/task-card-states.css',
    './css/task-card-quadrants.css',
    './css/density.css',
    './css/team-capacity.css',
    './css/team-capacity-header.css',
    './css/team-capacity-card.css',
    './css/team-capacity-controls.css',
    './css/team-capacity-preview.css',
    './css/team-capacity-states.css',
    './css/toolbar.css',
    './css/toolbar-status.css',
    './css/toolbar-controls.css',
    './css/toolbar-actions.css',
    './css/toolbar-states.css',
    './css/config-panel.css',
    './css/config-panel-fields.css',
    './css/config-panel-controls.css',
    './css/config-panel-states.css',
    './css/a11y.css',
    './css/blocked-screen.css',
    './css/app-rail.css',
    './css/print.css',
    // JS — app entry
    './js/app.js',
    './js/app/persistenceCoordinator.js',
    './js/app/renderScheduler.js',
    './js/config/commands.js',
    './js/config/taskFormCopy.js',
    // JS — PWA (детекция обновления SW; импортируется inline-модулем index.html)
    './js/pwa/swUpdateNotifier.js',
    // JS — vendor (offline-готовый marked + DOMPurify для справки)
    './js/vendor/marked.min.js',
    './js/vendor/purify.min.js',
    // JS — controllers
    './js/controllers/capacityStripController.js',
    './js/controllers/config/configActions.js',
    './js/controllers/config/configEventWiring.js',
    './js/controllers/config/configFieldActions.js',
    './js/controllers/config/configFormAdapter.js',
    './js/controllers/configController.js',
    './js/controllers/densityController.js',
    './js/controllers/viewModeController.js',
    './js/controllers/criteria/criteriaDragReorder.js',
    './js/controllers/criteria/criteriaFormController.js',
    './js/controllers/criteria/criteriaInlineWeights.js',
    './js/controllers/criteria/criteriaListEvents.js',
    './js/controllers/criteriaController.js',
    './js/controllers/file/exportFlow.js',
    './js/controllers/file/fileEventWiring.js',
    './js/controllers/file/importFlow.js',
    './js/controllers/fileController.js',
    './js/controllers/help/helpContent.js',
    './js/controllers/help/helpTocLinks.js',
    './js/controllers/helpController.js',
    './js/controllers/keyboardController.js',
    './js/controllers/printController.js',
    './js/controllers/role/roleInputActions.js',
    './js/controllers/roleController.js',
    './js/controllers/selection/selectionApplyFlow.js',
    './js/controllers/selection/selectionEventWiring.js',
    './js/controllers/selection/selectionHelpers.js',
    './js/controllers/selection/selectionRunFlow.js',
    './js/controllers/selectionController.js',
    './js/controllers/task/formHelpers.js',
    './js/controllers/task/criteriaScoreMutations.js',
    './js/controllers/task/taskDeleteActions.js',
    './js/controllers/task/taskEstimateMutations.js',
    './js/controllers/task/taskExcludeActions.js',
    './js/controllers/task/taskExcludeMutations.js',
    './js/controllers/task/taskOrderingActions.js',
    './js/controllers/task/taskSortActions.js',
    './js/controllers/task/taskCacheService.js',
    './js/controllers/task/taskDragController.js',
    './js/controllers/task/taskEventWiring.js',
    './js/controllers/task/taskFlowActions.js',
    './js/controllers/task/taskFormController.js',
    './js/controllers/task/taskForm/taskFormDomAdapter.js',
    './js/controllers/task/taskForm/taskFormDraft.js',
    './js/controllers/task/taskForm/taskFormModalActions.js',
    './js/controllers/task/taskForm/taskFormSubmitActions.js',
    './js/controllers/task/taskForm/taskFormValidation.js',
    './js/controllers/task/taskListHandler.js',
    './js/controllers/task/undoDeleteService.js',
    './js/controllers/taskController.js',
    './js/controllers/stateImportApplier.js',
    './js/controllers/themeController.js',
    // JS — domain
    './js/domain/config.js',
    './js/domain/criteria.js',
    './js/domain/criteriaOps.js',
    './js/domain/effortRisk.js',
    './js/domain/role.js',
    './js/domain/roleFieldContract.js',
    './js/domain/sprintSchedule.js',
    './js/domain/strictInteger.js',
    './js/domain/selection/analysis.js',
    './js/domain/selection/base.js',
    './js/domain/selection/config.js',
    './js/domain/selection/comparisonDisplay.js',
    './js/domain/selection/hybrid.js',
    './js/domain/selection/index.js',
    './js/domain/selection/matrix.js',
    './js/domain/selection/quadrants.js',
    './js/domain/selection/valueDensity.js',
    './js/domain/task.js',
    './js/domain/validation.js',
    // JS — services
    './js/services/diagnostics.js',
    './js/services/instanceLock.js',
    './js/services/message.js',
    './js/services/numberFormat.js',
    './js/services/statePreview.js',
    './js/services/storage.js',
    // JS — state
    './js/state/persistence.js',
    './js/state/persistence/constants.js',
    './js/state/persistence/criteriaEvaluations.js',
    './js/state/persistence/criteriaNormalizers.js',
    './js/state/persistence/diagnostics/configDiagnostics.js',
    './js/state/persistence/diagnostics/criteriaDiagnostics.js',
    './js/state/persistence/diagnostics/roleDiagnostics.js',
    './js/state/persistence/diagnostics/shared.js',
    './js/state/persistence/diagnostics/taskDiagnostics.js',
    './js/state/persistence/dependencies.js',
    './js/state/persistence/importDiagnostics.js',
    './js/state/persistence/primitiveNormalizers.js',
    './js/state/persistence/stateNormalizers.js',
    './js/state/persistence/taskNormalizers.js',
    './js/state/store.js',
    // JS — types
    './js/types/contracts.js',
    // JS — ui
    './js/ui/appVersionBadge.js',
    './js/ui/blockedScreen/actions.js',
    './js/ui/blockedScreen/constants.js',
    './js/ui/blockedScreen/content.js',
    './js/ui/blockedScreen/shell.js',
    './js/ui/blockedScreen.js',
    './js/ui/commandMetadata.js',
    './js/ui/criteriaList.js',
    './js/ui/criteriaList/actions.js',
    './js/ui/criteriaList/render.js',
    './js/ui/criteriaList/row.js',
    './js/ui/criteriaList/sumBar.js',
    './js/ui/header.js',
    './js/ui/importIssues.js',
    './js/ui/index.js',
    './js/ui/matrix.js',
    './js/ui/modalManager/focusable.js',
    './js/ui/modalManager/focusTrap.js',
    './js/ui/modalManager/stack.js',
    './js/ui/modalManager/statusOverlay.js',
    './js/ui/modalManager.js',
    './js/ui/teamCapacity.js',
    './js/ui/teamCapacity/card.js',
    './js/ui/teamCapacity/gauge.js',
    './js/ui/teamCapacity/header.js',
    './js/ui/teamCapacity/render.js',
    './js/ui/taskListGrouped/groupSection.js',
    './js/ui/taskListGrouped/model.js',
    './js/ui/taskListGrouped/render.js',
    './js/ui/taskListGrouped/summary.js',
    './js/ui/taskListGrouped.js',
    './js/ui/createTaskRowVM.js',
    './js/ui/selectionRecommendations.js',
    './js/ui/selectionRecommendations/constants.js',
    './js/ui/selectionRecommendations/render.js',
    './js/ui/selectionRecommendations/sections.js',
    './js/ui/selectionReport.js',
    './js/ui/selectionReport/constants.js',
    './js/ui/selectionReport/format.js',
    './js/ui/selectionReport/interactions.js',
    './js/ui/selectionReport/sections.js',
    './js/ui/selectionReport/sections/cards.js',
    './js/ui/selectionReport/sections/descriptions.js',
    './js/ui/selectionReport/sections/details.js',
    './js/ui/selectionReport/sections/insight.js',
    './js/ui/snackbar.js',
    './js/ui/taskList/criteriaSection.js',
    './js/ui/taskList/estimatesSection.js',
    './js/ui/taskList/focus.js',
    './js/ui/taskList/overloadIndicators.js',
    './js/ui/taskList/reconcile.js',
    './js/ui/taskList/render.js',
    './js/ui/taskList/taskCard.js',
    './js/ui/taskList/viewState.js',
    './js/ui/taskList.js',
    './js/ui/utils.js',
    // JS — version (single source of truth, imported by ui/appVersionBadge.js)
    './js/version.js',
    // JS — utils
    './js/utils/appConfig.js',
    './js/utils/constants.js',
    './js/utils/date.js',
    './js/utils/debounce.js',
    './js/utils/escapeHtml.js',
    './js/utils/fileName.js',
    './js/utils/icons.js',
    './js/utils/lruCache.js',
    './js/utils/measure.js',
    './js/utils/percent.js',
    './js/utils/sanitize.js',
    // Документация (offline-справка F1 — v8.30.11)
    './docs/UserManual.md'
];

// Установка: кэшируем все статические ресурсы.
// ВАЖНО: используем `Request` с `cache:'reload'`, чтобы install не подхватил
// устаревшие файлы из HTTP-cache браузера. Без этого после правки assets
// и bump CACHE_VERSION пользователь продолжает видеть старую версию.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => {
                const requests = ASSETS_TO_CACHE.map(url =>
                    new Request(url, { cache: 'reload' })
                );
                return cache.addAll(requests);
            })
            .then(() => self.skipWaiting())
    );
});

// Активация: удаляем старые кэши
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(key => key !== CACHE_VERSION)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// Fetch: Cache-First, затем сеть
self.addEventListener('fetch', (event) => {
    // Пропускаем non-GET запросы и запросы к CDN (DOMPurify и т.д.)
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // v8.30.3: cache-poisoning fix — не складывать в cache 404/500/opaque-error
    // ответы. До v8.30.3 любой неудачный fetch отравлял offline-cache: после
    // временной 503 от CDN или 404 на новом ассете пользователь видел ошибку
    // даже после восстановления сети, пока кэш не сбрасывался руками.
    // Условие cacheable:
    //   - response.ok (2xx)
    //   - response.type === 'basic' (same-origin) или 'cors' (явный CORS).
    //     'opaque' (no-cors) кэшируем только если это известный whitelist —
    //     для PLANNER нет таких ресурсов, потому опускаем.
    const isCacheableResponse = (response) =>
        response &&
        response.ok &&
        (response.type === 'basic' || response.type === 'cors');

    // Внешние ресурсы (CDN) — Network-First
    if (url.origin !== self.location.origin) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (isCacheableResponse(response)) {
                        const clone = response.clone();
                        caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Локальные ресурсы — Network-First (redesign v2).
    // РАНЬШЕ был Cache-First: после правок CSS/JS/HTML пользователь продолжал
    // видеть устаревший билд, пока вручную не снёс Service Worker — это создавало
    // ложное ощущение «изменения не применились». Теперь онлайн ВСЕГДА отдаёт
    // свежее с сервера, а кэш — только offline-fallback.
    //   - isCacheableResponse-guard сохраняет защиту от cache-poisoning (v8.30.3):
    //     в кэш кладём только ok + basic/cors ответы.
    //   - { cache: 'reload' }: ES-модули импортируются без cache-bust query
    //     (bare relative import'ы), поэтому браузерный HTTP-cache мог отдавать
    //     устаревший .js даже при network-first. reload обходит HTTP-cache и
    //     всегда берёт свежее с сервера. Запрос по URL (а не event.request),
    //     чтобы не падать на navigation-request с mode:'navigate'.
    //   - { ignoreSearch: true } для offline-fallback: index.html подключает
    //     CSS/JS с ?v=X.Y.Z, а precache хранит чистые пути './css/base.css'.
    event.respondWith(
        fetch(event.request.url, { cache: 'reload', credentials: 'same-origin' })
            .then(response => {
                if (isCacheableResponse(response)) {
                    const clone = response.clone();
                    caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
});
