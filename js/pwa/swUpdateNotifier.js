// js/pwa/swUpdateNotifier.js
// Детекция обновления Service Worker и показ плашки «Доступна новая версия».
//
// Регистрация SW остаётся inline в index.html (чтобы `./sw.js` резолвился
// относительно документа и сохранялась поддержка подпапок GitHub Pages).
// Здесь живёт только тестируемая логика уведомления об обновлении.
//
// v8.31.11 fix: раньше условие проверяло состояние `'activated'`. Из-за
// `self.skipWaiting()` + `self.clients.claim()` в sw.js свежеустановленный SW
// сразу активируется и захватывает страницу, поэтому
// `navigator.serviceWorker.controller` становится не-null ДАЖЕ на первой
// установке — и старое условие `'activated' && controller` ложно показывало
// «Доступна новая версия» при первом запуске и после каждого
// Unregister + hard-reload. Корректный сигнал реального обновления —
// наличие контроллера НА МОМЕНТ `updatefound` (до того как новая версия
// активируется) в сочетании со стандартным состоянием `'installed'`.

/**
 * Чистое решение: показывать ли плашку обновления.
 *
 * @param {string} workerState — `newWorker.state` на момент события statechange.
 * @param {boolean} hadController — был ли `navigator.serviceWorker.controller`
 *   не-null на момент `updatefound` (т.е. страницу уже контролировала
 *   предыдущая версия SW). На первой установке контроллера нет → false.
 * @returns {boolean}
 */
export function shouldPromptUpdate(workerState, hadController) {
    return workerState === 'installed' && hadController === true;
}

/**
 * Рисует плашку «Доступна новая версия» с кнопкой перезагрузки.
 * Идемпотентна: повторный вызов заменяет предыдущую плашку.
 *
 * @param {Document} doc — документ (инъекция для тестируемости).
 * @returns {HTMLElement} созданный элемент плашки.
 */
export function renderUpdateSnackbar(doc) {
    const existing = doc.getElementById('sp-snackbar');
    if (existing) existing.remove();

    const snackbar = doc.createElement('div');
    snackbar.id = 'sp-snackbar';
    snackbar.className = 'sp-snackbar sp-snackbar--show';
    snackbar.setAttribute('role', 'status');
    snackbar.setAttribute('aria-live', 'polite');

    const msg = doc.createElement('span');
    msg.className = 'sp-snackbar__text';
    msg.textContent = 'Доступна новая версия.';

    const btn = doc.createElement('button');
    btn.className = 'sp-snackbar__undo';
    btn.textContent = 'Обновить';
    btn.addEventListener('click', () => {
        const win = doc.defaultView || (typeof window !== 'undefined' ? window : globalThis);
        win.location.reload();
    });

    snackbar.appendChild(msg);
    snackbar.appendChild(btn);
    doc.body.appendChild(snackbar);
    return snackbar;
}

/**
 * Подключает уведомление об обновлении к зарегистрированному SW.
 * Регистрация (`navigator.serviceWorker.register`) выполняется отдельно в
 * index.html; сюда передаётся её результат `reg`.
 *
 * @param {ServiceWorkerRegistration} reg — результат register().
 * @param {Navigator} [nav=navigator]
 * @param {Document} [doc=document]
 */
export function wireUpdateNotifications(reg, nav = navigator, doc = document) {
    if (!reg || typeof reg.addEventListener !== 'function') return;

    reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker || typeof newWorker.addEventListener !== 'function') return;

        // Фиксируем «была ли предыдущая версия» ДО активации новой —
        // иначе clients.claim() выставит контроллер и первая установка
        // ошибочно станет похожа на обновление.
        const hadController = !!(nav && nav.serviceWorker && nav.serviceWorker.controller);

        newWorker.addEventListener('statechange', () => {
            if (shouldPromptUpdate(newWorker.state, hadController)) {
                renderUpdateSnackbar(doc);
            }
        });
    });
}
