// js/version.js
// Single source of truth для версии приложения.
//
// Авто-синхронизация через scripts/bump-version.mjs обновляет 9 мест через
// regex-замены + дополнительная синхронизация package-lock.json через
// `npm install --package-lock-only` (добавлено в v8.30.20):
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
//   - manifest.json           ВСЕ icons[].src "icons/X?v=X.Y.Z"
//   - index.html              <link rel="apple-touch-icon" href="icons/X?v=X.Y.Z">
//                             (cache-bust иконок: смена бренда должна доходить до
//                             установленных PWA / favicon-кэша; добавлено в v8.31.12)
//   + package-lock.json       root.version и packages[""].version
//                             (через npm install --package-lock-only после regex-шага;
//                             добавлено в v8.30.20 — lockfile дрейфовал второй раз)
//
// docs/RELEASE_NOTES.md — НЕ обновляется автоматически, заполняется руками
// после bump'а с описанием изменений (см. docs/RELEASE_PROCESS.md).
//
// Тест tests/unit/version.test.js проверяет согласованность auto-updated мест
// (включая инвариант lockfile == package.json).
// Тест tests/unit/scripts/bumpVersion.test.js проверяет, что эта шапка
// упоминает корректное N regex-мест (9) — синхронно с шапкой bump-version.mjs.

export const APP_VERSION = 'v8.32.0';
