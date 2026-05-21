// sw.js — Service Worker для Sprint Planner PWA
// Стратегия: Cache-First с fallback на сеть.
// При обновлении версии старый кэш удаляется.

const CACHE_VERSION = 'sp-v8.30.43-task-reorder-buttons';

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
    './css/components.css',
    './css/animations.css',
    './css/progress.css',
    './css/accordion.css',
    './css/help.css',
    './css/snackbar.css',
    './css/create-task-modal.css',
    './css/responsive.css',
    './css/criteria.css',
    './css/selection-report.css',
    './css/task-card.css',
    './css/capacity-strip.css',
    './css/team-capacity.css',
    './css/toolbar.css',
    './css/config-panel.css',
    './css/a11y.css',
    './css/blocked-screen.css',
    './css/print.css',
    // JS — app entry
    './js/app.js',
    // JS — vendor (offline-готовый marked + DOMPurify для справки)
    './js/vendor/marked.min.js',
    './js/vendor/purify.min.js',
    // JS — controllers
    './js/controllers/capacityStripController.js',
    './js/controllers/configController.js',
    './js/controllers/densityController.js',
    './js/controllers/viewModeController.js',
    './js/controllers/criteria/criteriaFormController.js',
    './js/controllers/criteriaController.js',
    './js/controllers/fileController.js',
    './js/controllers/helpController.js',
    './js/controllers/keyboardController.js',
    './js/controllers/roleController.js',
    './js/controllers/selection/selectionHelpers.js',
    './js/controllers/selectionController.js',
    './js/controllers/tabController.js',
    './js/controllers/task/formHelpers.js',
    './js/controllers/task/taskCacheService.js',
    './js/controllers/task/taskDragController.js',
    './js/controllers/task/taskFormController.js',
    './js/controllers/task/taskListHandler.js',
    './js/controllers/taskController.js',
    './js/controllers/themeController.js',
    // JS — domain
    './js/domain/config.js',
    './js/domain/criteria.js',
    './js/domain/criteriaManager.js',
    './js/domain/role.js',
    './js/domain/roleFieldContract.js',
    './js/domain/strictInteger.js',
    './js/domain/selection/analysis.js',
    './js/domain/selection/base.js',
    './js/domain/selection/config.js',
    './js/domain/selection/hybrid.js',
    './js/domain/selection/index.js',
    './js/domain/selection/matrix.js',
    './js/domain/selection/quadrants.js',
    './js/domain/selection/valueDensity.js',
    './js/domain/task.js',
    './js/domain/validation.js',
    // JS — services
    './js/services/instanceLock.js',
    './js/services/message.js',
    './js/services/numberFormat.js',
    './js/services/storage.js',
    // JS — state
    './js/state/persistence.js',
    './js/state/store.js',
    // JS — types
    './js/types/contracts.js',
    // JS — ui
    './js/ui/appVersionBadge.js',
    './js/ui/blockedScreen.js',
    './js/ui/createForm.js',
    './js/ui/criteriaList.js',
    './js/ui/header.js',
    './js/ui/index.js',
    './js/ui/matrix.js',
    './js/ui/modalManager.js',
    './js/ui/teamCapacity.js',
    './js/ui/taskListGrouped.js',
    './js/ui/createTaskRowVM.js',
    './js/ui/selectionRecommendations.js',
    './js/ui/selectionReport.js',
    './js/ui/snackbar.js',
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
    './js/utils/icons.js',
    './js/utils/lruCache.js',
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

    // Локальные ресурсы — Cache-First
    // v8.30.6: { ignoreSearch: true } для same-origin static assets.
    // index.html подключает CSS/JS с cache-bust query ?v=X.Y.Z, но precache
    // хранит чистые пути './css/base.css'. Без ignoreSearch offline-запуск
    // получает index.html из кэша, но промахивается по './css/base.css?v=...'
    // и './js/app.js?v=...' → PWA offline без стилей и без логики.
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true })
            .then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    if (isCacheableResponse(response)) {
                        const clone = response.clone();
                        caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
    );
});
