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
   | b | `npm run test:coverage -- --maxWorkers=50%` | 0 | unit тесты + coverage threshold |
   | c | `npm run test:e2e:smoke` | 0 | mobile-webkit smoke gate (исторически самый проблемный project) |
   | d | `npm run test:e2e` | 0 | полный e2e suite (все 4 Playwright projects) |
   | e | `npm audit --audit-level=moderate` | 0 | 0 moderate+ vulnerabilities |
   | f | `npm outdated --long` | 0 | clean (или явно задокументированный outdated) |

5. **После e2e запуска сверить RELEASE_NOTES с summary artifact:**

   ```bash
   npm run verify:release-metrics -- --command="npm run test:e2e"
   ```

   Для smoke-only проверки:

   ```bash
   npm run verify:release-metrics -- --command="npm run test:e2e:smoke"
   ```

   Скрипт читает latest section `docs/RELEASE_NOTES.md` и
   `test-results/e2e-parallel-summary.json`. Он должен подтвердить, что
   `Wrapper exit`, `Playwright child exit`, `Override` и PASS-count совпадают
   с реальным e2e summary artifact.

6. **Коммит** с сообщением `vX.Y.Z: <короткое описание>`.

## Public release automation (v8.30.47 → v8.30.48)

Для стандартной доставки PLANNER → `sprint-planner/FOR_USERS` есть dry-run-first
скрипт:

```bash
npm run release:public -- --version 8.30.47 \
  --title "v8.30.47 — short title" \
  --planner-commit "v8.30.47: short title" \
  --public-commit "v8.30.47 sync short title" \
  --notes "release notes text" \
  --public-smoke
```

Без `--execute` он только печатает план: permissions, sync entries, commit/push
и `gh release create`. С `--execute` выполняет полный chain. Флаг
`--public-smoke` добавляет реальную проверку синхронизированного public root
через локальный static server и Playwright Pixel 5: версия `#appVersion`,
наличие `#taskList`, отсутствие мобильного horizontal overflow, browser
console/page errors и 4xx/5xx ответов.

Перед execute всё равно обязательны gates выше: script не заменяет
lint/coverage/e2e/audit, он автоматизирует только механическую доставку и
GitHub-публикацию. Execute-chain дополнительно:

- требует clean worktree в `sprint-planner` до sync, чтобы не затереть чужие
  локальные изменения;
- проверяет, что после sync public repo изменился только внутри установленной
  public-shape (`css/js/docs/icons/dev-tools`, root-файлы, root-документация,
  `version.js`);
- не выполняет sync/commit/push/release без явного `--execute`.

## CI safety net (v8.30.42)

`.github/workflows/ci.yml` запускается на `push`, `pull_request` в `main` и
`workflow_dispatch`.

| Job | Команды | Назначение |
|---|---|---|
| `unit-and-lint` | `npm ci`, `npm run lint`, `npm run test:coverage -- --maxWorkers=50%`, `npm audit --audit-level=moderate`, `npm outdated --long` | Быстрые gates без браузеров |
| `e2e-smoke` | `npm ci`, `npx playwright install --with-deps`, `npm run test:e2e:smoke` | Mobile WebKit smoke на Ubuntu |

Полный `npm run test:e2e` остаётся обязательным локальным release gate по
чек-листу выше: CI smoke ловит самый проблемный browser path, но не заменяет
full release verification. `verify:release-metrics` намеренно остаётся
локальным release-step: child exit / override зависят от платформы, и CI на
Ubuntu не должен падать из-за честно задокументированного Windows override в
верхней секции `RELEASE_NOTES.md`.

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
**Порт 8123** зафиксирован — `start-server.bat`, `start-server.sh`, playwright.config.js, e2e-runner, README используют один и тот же 8123. Legacy-упоминания 8000/8080 в старых docs больше не отражают реальное поведение проекта. `reuseExistingServer: !process.env.CI`.

### e2e-runner (v8.30.50: pure decideExitCode + all-ok watchdog + честные лимиты process-tree)

`scripts/e2e-runner.mjs`:
- Spawn'ит Playwright CLI с `--reporter=list,json`, JSON в per-process `test-results/e2e-runner-results-${process.pid}.json`, `detached: !IS_WINDOWS`. Arch-test `windows-post-exit-cleanup-lie.test.js` стережёт invariant `/detached:\s*!IS_WINDOWS/` — без него `process.kill(-pgid)` на Unix не сработает.
- **Pure decision helper** [scripts/e2eRunnerDecision.js](../scripts/e2eRunnerDecision.js), покрыт unit-тестами. Каждое condition выводится отдельно:
  - `report.stale === true` (mtime < CHILD_START_MS - 200ms) → exit 1
  - `report.status === 'interrupted' || 'timedOut'` → exit 1
  - `report.expected === 0 && unexpected === 0` (0 tests ran) → exit 1
  - `report.unexpected > 0` → exit 1 (даже при child exit=0)
  - `wasForceKilled && status==='passed' && expected>0 && unexpected===0` → exit 0 (legitimate worker shutdown race override)
  - `wasForceKilled && stdoutCompletion.status==='passed' && expected>0 && unexpected===0` → exit 0 только для pre-summary Windows `mobile-webkit` all-ok watchdog; release summary обязан показать child exit 1 + override
  - clean child exit=0 + passed → exit 0
  - **Иначе** child exit code as-is (без blind override)
- **`decision.reason` всегда в stderr** перед `process.exit(N)`: будущий аудитор должен видеть ПОЧЕМУ runner вышел так как вышел.
- **Port 8123 own-server detection (v8.30.33+):** HTTP GET на `/index.html`, app title signature (`Sprint Planner` или текущий `Планирование спринта`). Чужой listener — fail fast.
- **Pre-exit process-tree cleanup (summary watchdog):** через 3 сек после summary в stdout — `killProcessTree(child.pid)` пока child ещё жив. Windows `taskkill /F /T /PID`, Unix `process.kill(-pgid)`. Закрывает класс «grandchild leak».
- **Pre-summary all-ok watchdog (v8.30.50):** на Windows `mobile-webkit` final summary иногда появляется только после внутреннего `kWorkerStopTimeout = 300000ms`. Runner считает `Running N tests` + все `ok 1..N` строки; если failures не было и child не завершился за 3s после последнего `ok`, tree-kill происходит сразу. Это ускоряет flaky shutdown path, но остаётся честным `[OVERRIDE]`, не clean child exit.

#### Известные лимиты process-tree cleanup (v8.30.35 — честно документировано)

**Windows post-exit cleanup НЕ работает через original parent pid.**

После exit'а direct child связь parent→descendants в OS process-tree разорвана. `taskkill /F /T /PID <dead_pid>` не найдёт grandchildren. На Unix process group работает иначе (kill -pgid доходит пока есть members), но это inconsistent поведение.

**Что есть и что НЕТ:**

| Сценарий | Работает? |
|---|---|
| Pre-exit: `summary detected → killProcessTree(child.pid)` пока child живой | ✅ Да, и Windows и Unix |
| Pre-exit: SIGINT/SIGTERM forward → `cleanupAndExit('SIGINT')` пока child живой | ✅ Да |
| Pre-exit: `process.on('exit')` (наш процесс exit'ит) → `killChildTree('SIGKILL')` если child ещё жив | ✅ Да |
| Post-exit: child уже мёртв, `killProcessTree(child.pid)` для cleanup descendants | ❌ Нет на Windows (taskkill /T не находит tree dead pid). Эта попытка УБРАНА из v8.30.35 как ложная |

**Тест `windows-post-exit-cleanup-lie.test.js`** явно документирует: после exit'а fakeChild, `killProcessTree(fakeChild.pid)` НЕ убивает grandchild → `expect(stillAlive).toBe(true)`. Это not bug — это inherent Windows OS limit.

**Реальные механизмы cleanup** — pre-exit summary-watchdog и all-ok watchdog. Если worker exit'ит ДО summary, но после всех `ok` строк, `mobile-webkit` больше не ждёт 300 секунд. Если нет ни summary, ни полного all-ok evidence, override запрещён и runner должен падать/ждать штатный failure path.

### e2e-parallel summary artifact (v8.30.41)

`scripts/e2e-parallel.mjs` запускает project-level `e2e-runner.mjs` процессы
параллельно, но обязан сохранять честную картину child-exit'ов. После каждого
запуска он пишет `test-results/e2e-parallel-summary.json`:

```json
{
  "projects": [
    {
      "project": "mobile-webkit",
      "wrapperExit": 0,
      "decisionExit": 0,
      "childExit": 1,
      "override": true,
      "reason": "child exit=1 but JSON status=passed expected=17 unexpected=0 -> exit 0"
    }
  ]
}
```

Для `RELEASE_NOTES.md` это источник истины по full e2e: `wrapperExit` отвечает
за npm gate, `childExit` показывает реальный Playwright/runner child status,
`override=true` означает documented worker-shutdown race override. Нельзя
подменять эти значения только строкой `npm run test:e2e` exit=0.

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
