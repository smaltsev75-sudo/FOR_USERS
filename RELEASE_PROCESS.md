# Release process

Версия приложения хранится одной строкой в [`js/version.js`](../js/version.js)
и продублирована в `package.json` и `sw.js`. Все три должны быть согласованы —
тест [`tests/unit/version.test.js`](../tests/unit/version.test.js) это проверяет.

В UI версия выводится в шапке справа от заголовка (`#appVersion`, заполняется
из `APP_VERSION` через [`js/ui/appVersionBadge.js`](../js/ui/appVersionBadge.js)).

## Bump

Используй `npm run bump`:

```bash
npm run bump -- 8.29.4 selection-fix
npm run bump -- 8.30.0 task-card-redesign
npm run bump -- 9.0.0
```

Аргументы:

| Позиция | Что | Формат | Пример |
|---------|-----|--------|--------|
| 1 (обязательный) | semver-версия без префикса `v` | `X.Y.Z` | `8.29.4` |
| 2 (опциональный) | slug — короткий человекочитаемый код для `CACHE_VERSION` | `[a-z0-9-]+` | `pwa-paths` |

Скрипт обновит синхронно:

| Файл | Что изменится |
|------|---------------|
| `package.json` | `"version": "X.Y.Z"` |
| `js/version.js` | `export const APP_VERSION = 'vX.Y.Z';` |
| `sw.js` | `const CACHE_VERSION = 'sp-vX.Y.Z-<slug>';` (slug опциональный) |
| `docs/UserManual.md` | строка с версией внизу `*Версия документа: X.Y.Z (<месяц год>)*` (italic, не bold) |
| `index.html` | cache-bust `<link rel="manifest" href="manifest.json?v=X.Y.Z">` (добавлено в v8.30.2 чтобы установленные PWA получали свежий manifest). |
| `index.html` | cache-bust `<script type="module" src="js/app.js?v=vX.Y.Z">` (добавлено в v8.30.11 — раньше ?v= застрял на v8.22.3-reorg-docs-folder 8 версий). |

Что **не** меняется автоматически:

- `docs/RELEASE_NOTES.md` — добавь раздел руками после bump'а.
- README — обновляй только если изменения видны пользователю.

## Полный чек-лист релиза

1. Сделай и проверь правки в коде.
2. `npm run bump -- <X.Y.Z> [<slug>]`.
3. Добавь раздел `## vX.Y.Z (YYYY-MM-DD)` в `docs/RELEASE_NOTES.md` с описанием изменений.
4. `npm test` — особенно `tests/unit/version.test.js`: он сразу зафейлится,
   если ты что-то забыл или раccинхронизировал источники.
5. `npm run lint` — на случай stray-edit'ов.
6. Коммит с сообщением вида `vX.Y.Z: <короткое описание>` — формат уже
   используется в проекте.

## Почему такая схема

- **Single source of truth** в UI и тестах — `js/version.js`. ESM-импорт,
  тестируется напрямую, не нужны build-step'ы.
- **`package.json` зеркалит** — это стандарт npm, нужен для tooling
  (`npm version`, gh actions, `npm publish` в будущем).
- **`sw.js` отдельный** — Service Worker не может import'ить обычные ESM
  модули в Service Worker scope без `type: 'module'` и дополнительных
  ограничений. Простая дублирующая константа + проверка тестом — дешевле,
  чем переводить SW на module-режим.
- **`CACHE_VERSION` со slug'ом** — даёт человеку диагностику в DevTools
  (видно «sp-v8.29.3-pwa-portable-paths»), не только числовую версию.
