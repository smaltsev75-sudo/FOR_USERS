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

Скрипт обновит синхронно (7 мест через regex + дополнительная синхронизация `package-lock.json` через `npm install --package-lock-only`, см. шапку `scripts/bump-version.mjs`):

| Файл | Что изменится |
|------|---------------|
| `package.json` | `"version": "X.Y.Z"` |
| `js/version.js` | `export const APP_VERSION = 'vX.Y.Z';` |
| `sw.js` | `const CACHE_VERSION = 'sp-vX.Y.Z-<slug>';` (slug опциональный) |
| `docs/UserManual.md` | строка с версией внизу `*Версия документа: X.Y.Z (<месяц год>)*` (italic, не bold) |
| `index.html` | cache-bust `<link rel="manifest" href="manifest.json?v=X.Y.Z">` (добавлено в v8.30.2 чтобы установленные PWA получали свежий manifest). |
| `index.html` | cache-bust `<script type="module" src="js/app.js?v=vX.Y.Z">` (добавлено в v8.30.11 — раньше ?v= застрял на v8.22.3-reorg-docs-folder 8 версий). |
| `index.html` | cache-bust ВСЕХ CSS-ссылок: `<link rel="stylesheet" href="css/X.css?v=vX.Y.Z">` (добавлено в v8.30.15 — раньше ?v= застрял на смеси `?v=3` / `?v=4` / `?v=1` / `?v=v8.22.2`). |
| `package-lock.json` | `root.version` и `packages[""].version` через `npm install --package-lock-only` после regex-шага (добавлено в v8.30.20 — lockfile дрейфовал второй раз; инвариант в `tests/unit/version.test.js`). |

Что **не** меняется автоматически:

- `docs/RELEASE_NOTES.md` — добавь раздел руками после bump'а.
- README — обновляй только если изменения видны пользователю.

## Полный чек-лист релиза (v8.30.31: e2e — обязательный release gate)

Все шаги обязательны. Релиз с red e2e / coverage / audit — категорически нельзя
(см. memory `feedback-release-with-red-tests-banned`). Exit codes измерять
БЕЗ pipe (`cmd > /tmp/log; echo $?`), иначе `$?` = exit-код `tail`'а, не `cmd`.

1. **Сделай и проверь правки в коде.**
2. **`npm run bump -- <X.Y.Z> [<slug>]`** — синхронизирует версию во всех
   7 местах (см. таблицу выше).
3. **Добавь раздел в `docs/RELEASE_NOTES.md`.** Формат заголовка:
   `## Версия: <месяц год> (обновление X.Y.Z) — <короткое описание>`.
   Метрики PASS обязательны с фактическими exit-кодами (`[EXIT=0]`).
4. **Release gates (все exit 0, источник истины — реальные команды):**

   | # | Команда | Exit gate | Что проверяется |
   |---|---|---|---|
   | a | `npm run lint` | 0 | ESLint clean (no stray edits) |
   | b | `npm run test:coverage -- --runInBand` | 0 | unit тесты + coverage threshold |
   | c | `npm run test:e2e:smoke` | 0 | mobile-webkit smoke gate (исторически самый проблемный project) |
   | d | `npm run test:e2e` | 0 | полный e2e suite (все 4 Playwright projects) |
   | e | `npm audit --audit-level=moderate` | 0 | 0 moderate+ vulnerabilities |
   | f | `npm outdated --long` | 0 | clean (или явно задокументированный outdated) |

5. **Коммит** с сообщением `vX.Y.Z: <короткое описание>`.

## Release gates: details

### Playwright projects (`playwright.config.js`, v8.30.31)

4 проекта; gate `e2e:smoke` запускает только mobile-webkit как fastest indicator
большинства реальных проблем (worker-shutdown race, mobile overflow, sticky).
`e2e` запускает все.

| project | viewport / engine | testMatch | testIgnore |
|---|---|---|---|
| `chromium` | Desktop Chrome 1280×720 | (все .spec.js по умолчанию) | mobile.spec.js, webkit.spec.js |
| `mobile-chromium` | Pixel 5 (393×851), Chromium | mobile.spec.js | — |
| `webkit` | Desktop Safari 1280×720 | webkit.spec.js | — |
| `mobile-webkit` | iPhone 13 (390×844), WebKit | mobile.spec.js | — |

### Webserver

`playwright.config.js → webServer`: `npx http-server . -p 8123 --silent --no-cache`.
**Порт 8123** — нестандартный, чтобы не конфликтовать с другими dev-серверами
проекта на 8000/8080. `reuseExistingServer: !process.env.CI`.

### e2e-runner (v8.30.31: ground truth = JSON reporter)

`scripts/e2e-runner.mjs`:
- Spawn'ит Playwright CLI с `--reporter=list,json`, JSON в `test-results/e2e-runner-results.json`.
- **Ground truth для exit-кода**: JSON-файл (`stats.unexpected`). НЕ stdout-парсинг.
- Stdout-monitor — секондарный watchdog для force-kill при WebKit worker hang race на Node 22+ Windows.
- EADDRINUSE на порт 8123 — info (не fatal), webServer reuse подхватит.
- Orphan cleanup: SIGINT/SIGTERM/exit propagate в child, force-SIGKILL после 1.5s.

### Измерение exit-кодов

Bash:
```bash
# Правильно (без pipe):
npm run test:e2e > /tmp/e2e.log 2>&1; echo "[EXIT=$?]"

# Правильно (с pipe + PIPESTATUS):
npm run test:e2e 2>&1 | tail; echo "[EXIT=${PIPESTATUS[0]}]"

# НЕПРАВИЛЬНО — $? после pipe = exit code tail (всегда 0):
npm run test:e2e 2>&1 | tail; echo "[EXIT=$?]"   # ← врёт
```

PowerShell: `$LASTEXITCODE` после команды (не подвержен pipe-trap).

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
