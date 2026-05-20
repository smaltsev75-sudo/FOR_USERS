// js/version.js
// Single source of truth для версии приложения.
//
// Авто-синхронизация через scripts/bump-version.mjs обновляет 7 мест:
//   - package.json            "version" (без префикса 'v')
//   - js/version.js           APP_VERSION (этот файл)
//   - sw.js                   CACHE_VERSION ('sp-v' + APP_VERSION + '-<slug>')
//   - docs/UserManual.md      строка «*Версия документа: X.Y.Z ...*» в конце файла
//   - index.html              <link rel="manifest" href="manifest.json?v=X.Y.Z">
//   - index.html              <script type="module" src="js/app.js?v=vX.Y.Z">
//                             (cache-bust app.js при первом online-запуске и без SW;
//                             добавлено в v8.30.11)
//   - index.html              ВСЕ <link rel="stylesheet" href="css/X.css?v=vX.Y.Z">
//                             (unified CSS cache-bust для non-SW сценариев;
//                             добавлено в v8.30.15)
//
// docs/RELEASE_NOTES.md — НЕ обновляется автоматически, заполняется руками
// после bump'а с описанием изменений (см. docs/RELEASE_PROCESS.md).
//
// Тест tests/unit/version.test.js проверяет согласованность auto-updated мест.
// Тест tests/unit/scripts/bumpVersion.test.js проверяет, что эта шапка
// упоминает корректное N мест — синхронно с шапкой bump-version.mjs.

export const APP_VERSION = 'v8.30.18';
