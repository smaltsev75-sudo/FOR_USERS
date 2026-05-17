// js/version.js
// Single source of truth для версии приложения.
//
// Синхронизируется с тремя другими местами:
//   - package.json   "version" (без префикса 'v')
//   - sw.js          CACHE_VERSION ('sp-' + APP_VERSION + '-<slug>')
//   - docs/RELEASE_NOTES.md  (heading)
//
// Обновляется через scripts/bump-version.mjs (см. docs/RELEASE_PROCESS.md).
// Тест tests/unit/version.test.js проверяет, что все источники согласованы.

export const APP_VERSION = 'v8.30.2';
