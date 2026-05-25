# Архитектура PLANNER

> Техническая документация для разработчиков и технических специалистов.
> Пользовательская документация: `README.md` (в корне). Справка: `docs/UserManual.md`.
> История изменений: `docs/RELEASE_NOTES.md`.

## 1. Runtime / Точка входа

- Единственная точка входа: `index.html` → `js/app.js`.
- Все модули подключаются через ES imports от `app.js`.
- Для тестов: `window.__PLANNER_DISABLE_AUTOBOOT__` отключает автозапуск.
- Навигационный индекс модулей генерируется командой `npm run docs:modules`
  в [docs/MODULE_MAP.md](MODULE_MAP.md). Табличные строки не редактировать руками.

## 2. Слои приложения

```
index.html
  └─ js/app.js (orchestrator)
       ├─ js/state/store.js          — единое хранилище состояния (state.ui.density, viewMode, expandedQuadrants — v8.14)
       ├─ js/state/persistence.js    — facade миграции/сериализации; детали в js/state/persistence/* (v8.30.46)
       ├─ js/config/commands.js      — единый registry UI-команд, hotkeys и manual actions (v8.30.55)
       ├─ js/controllers/*           — управление UI и сценариями
       │    ├─ task/                  — создание, редактирование, drag&drop, undo-delete
       │    ├─ criteria/              — управление критериями оценки
       │    ├─ selection/             — хелперы автоотбора
       │    ├─ capacityStripController.js  — drag preview для Team Capacity Dashboard (legacy file name; hover-preview убран в v8.21)
       │    ├─ densityController.js   — toggle Compact/Comfortable (v8.14, упрощён в v8.27.1)
       │    └─ viewModeController.js  — toggle List/Quadrants + collapse-state (v8.14)
       ├─ js/domain/*                — чистая бизнес-логика (без DOM)
       │    ├─ selection/             — 3 алгоритма автоотбора
       │    │    └─ quadrants.js     — assignQuadrants(tasks) для view-grouping (v8.14); excluded → отдельная 5-я группа, медиана считается без excluded (v8.29.1)
       │    └─ role.js               — simulateLoadDelta(), getRoleLoadLevel() (v8.14)
       ├─ js/services/*              — работа с браузерными API (storage, message)
       ├─ js/ui/*                    — рендер DOM из состояния (progressive rendering)
       │    ├─ teamCapacity.js       — Team Capacity Dashboard: header + 5 карточек ролей (v8.21)
       │    ├─ createTaskRowVM.js    — VM-builder для строки задачи (v8.14)
       │    ├─ taskList.js           — flat list рендер (3-block redesign в v8.22)
       │    └─ taskListGrouped.js    — quadrant-grouped рендер (v8.14)
       └─ js/utils/*                 — утилиты (debounce, escapeHtml, fileName, lruCache, sanitize, icons)
  └─ sw.js                      — Service Worker (Cache-First, оффлайн)
  └─ manifest.json              — PWA-манифест (установка на устройство)
```

### Правила слоёв

| Слой | Доступ к DOM | Доступ к Store | Бизнес-логика |
|------|:---:|:---:|:---:|
| `domain/` | ❌ | ❌ | ✅ |
| `controllers/` | ✅ | ✅ | оркестрация |
| `services/` | ✅ | ❌ | ❌ |
| `config/` | ❌ | ❌ | декларативные runtime-контракты |
| `ui/` | ✅ | через параметры (не импортирует Store) | ❌ |
| `utils/` | ❌ | ❌ | ❌ |

Guard: [layer-boundaries.test.js](../tests/unit/architecture/layer-boundaries.test.js)
статически проверяет ключевые зависимости: `domain/` не импортирует
`controllers/services/state/ui`, `state/` не импортирует `controllers/services/ui`,
`ui/` не импортирует `controllers/state/app`, а `utils/` не импортирует
продуктовые слои. Это превращает таблицу выше из договорённости в release gate.

Guard: [state-mutation-boundary.test.js](../tests/unit/architecture/state-mutation-boundary.test.js)
запрещает прямую мутацию snapshot'ов из `Store.getState()` и корневых полей
`state.*` вне `Store`. Новое изменение состояния должно идти через setter/update
метод Store или через чистый helper, который возвращает новый массив/patch.

### App coordinators (v8.30.49)

`App` остаётся bootstrap/orchestrator'ом: создание Store, контроллеров и wiring.
Runtime-ответственности вынесены в маленькие координаторы:

| Модуль | Ответственность | Guard/test |
|---|---|---|
| [renderScheduler.js](../js/app/renderScheduler.js) | `requestAnimationFrame` batching и queue-state | [renderScheduler.test.js](../tests/unit/app/renderScheduler.test.js) |
| [persistenceCoordinator.js](../js/app/persistenceCoordinator.js) | debounce persist, beforeunload flush, storage/nfs failure snackbar throttle | [persistenceCoordinator.test.js](../tests/unit/app/persistenceCoordinator.test.js) |

[meta-helper-grep-discipline.test.js](../tests/unit/architecture/meta-helper-grep-discipline.test.js)
дополнительно следит, что `app.js` не возвращает `persistTimeout`,
`renderQueued`, `_notifyPersistFailure`, direct `setTimeout` или Storage writes.
С v8.30.50 тот же guard закрепляет накопленные meta-helper правила:
`Storage.getItem` только в `try/catch`, новые `innerHTML` write-sites только
после явного allowlist review, `style=""` в render HTML только для geometry
(`width`, `stroke-dasharray`, CSS variables), inline handler attributes
запрещены, а каждое новое `Date.now()` требует review-причину.

### Command registry (v8.30.55)

[commands.js](../js/config/commands.js) — единый source of truth для header
actions, hotkeys и таблицы горячих клавиш в UserManual. Из него берут данные:

| Поверхность | Контракт |
|---|---|
| `KeyboardController` | `findCommandByHotkey()` вместо локального списка `Ctrl+Alt+...` |
| `FileController` | button ids для save/load/diagnostics берутся из registry |
| `RecoveryController` | button id центра восстановления берётся из registry |
| `ThemeController` | видимая метка темы берётся из `theme` command |
| `applyCommandMetadata()` | начальные `title`/`aria-label` header-кнопок применяются из registry |
| `generate-manual-contract.mjs` | таблица hotkeys генерируется из `getManualHotkeys()` |

Guard: [command-registry-contract.test.js](../tests/unit/architecture/command-registry-contract.test.js)
проверяет, что header-кнопки существуют в HTML, их initial titles совпадают с
registry, а `manual-contract.json` больше не дублирует hotkeys руками.

### 2.1 Progressive rendering и generation token (v8.30.0)

`renderTaskList()` рендерит первые 20 задач синхронно, остальные — через
`requestIdleCallback` батчами. Каждый вызов `renderTaskList()` инкрементирует
module-level `renderGeneration`. Pending idle-callback'и старого рендера
сверяют `myGeneration` со счётчиком и абортятся, если их рендер устарел —
иначе stale-карточки дозалились бы в уже очищенный новый DOM при быстрой
смене state. Тестовый хук: `_getRenderGeneration()`.

#### Task list facade split (v8.30.49 → v8.30.50)

[taskList.js](../js/ui/taskList.js) сохраняет публичный контракт для
`renderTaskList`, `createTaskElement`, `filterTasks`, `resolveDensity` и
`updateOverloadIndicators`, но runtime/rendering логика вынесена в подпапку:

| Модуль | Ответственность |
|---|---|
| [viewState.js](../js/ui/taskList/viewState.js) | search/type filter + density fallback |
| [focus.js](../js/ui/taskList/focus.js) | capture/restore focus для editable criteria score после `replaceChildren` |
| [overloadIndicators.js](../js/ui/taskList/overloadIndicators.js) | cumulative role overload model + batch-only DOM updates для large backlog |
| [render.js](../js/ui/taskList/render.js) | progressive rendering, generation-token, batch overload updates, highlight/pulse orchestration |
| [taskCard.js](../js/ui/taskList/taskCard.js) | DOM shell карточки, безопасные title/comment slots |
| [criteriaSection.js](../js/ui/taskList/criteriaSection.js) | criteria score controls + Priority Score block |
| [estimatesSection.js](../js/ui/taskList/estimatesSection.js) | role effort chips + total effort |

Guard: [task-list-facade-contract.test.js](../tests/unit/architecture/task-list-facade-contract.test.js)
запрещает возвращать эти helper'ы обратно в фасад.

#### Selection report facade split (v8.30.50)

[selectionReport.js](../js/ui/selectionReport.js) остаётся публичным API для
`renderSelectionReport`, `ALGORITHM_NAMES`, `METRIC_HINTS`,
`getSeverityClass()` и `getSeverityHint()`. Внутренние обязанности разнесены:

| Модуль | Ответственность |
|---|---|
| [constants.js](../js/ui/selectionReport/constants.js) | имена алгоритмов, иконки, hints, apply-button ids |
| [format.js](../js/ui/selectionReport/format.js) | severity classes/hints, numeric formatting, metric bar ratios |
| [sections.js](../js/ui/selectionReport/sections.js) | algorithm cards with embedded apply actions, recommendations entry point, descriptions/details accordions |
| [interactions.js](../js/ui/selectionReport/interactions.js) | recommended apply-button state + accordion toggle wiring |

Guard: [selection-report-facade-contract.test.js](../tests/unit/architecture/selection-report-facade-contract.test.js)
фиксирует фасадную форму и запрещает возвращать section builders в корневой файл.

#### Task form split (v8.30.52)

[taskFormController.js](../js/controllers/task/taskFormController.js) остаётся
публичным контроллером create/edit modal, но больше не смешивает DOM-ввод,
маппинг task↔form и доменные поля:

| Модуль | Ответственность |
|---|---|
| [taskFormDomAdapter.js](../js/controllers/task/taskForm/taskFormDomAdapter.js) | чтение/запись unified create/edit DOM, segmented type, preset chips, criteria selects, derived headers |
| [taskFormDraft.js](../js/controllers/task/taskForm/taskFormDraft.js) | чистый form draft: `task.est` → role inputs, create input, edit patch (`est`), weighted priority score |

Контракт закрыт unit-тестами [taskFormController.test.js](../tests/unit/controllers/task/taskFormController.test.js),
[taskFormDraft.test.js](../tests/unit/controllers/task/taskFormDraft.test.js) и XSS guard'ом
[taskFormController.xss.test.js](../tests/unit/controllers/taskFormController.xss.test.js).

#### Sprint config split (v8.30.52)

[configController.js](../js/controllers/configController.js) остаётся controller
фасадом для DOM events и store updates, но календарные правила и form-sync вынесены:

| Модуль | Ответственность |
|---|---|
| [sprintSchedule.js](../js/domain/sprintSchedule.js) | чистые расчёты `days/startDate/endDate/holidays`, working-days minus holidays |
| [configFormAdapter.js](../js/controllers/config/configFormAdapter.js) | DOM listeners и синхронизация inputs без доступа к Store |

Контракт закрыт [configController.test.js](../tests/unit/controllers/configController.test.js)
и [sprintSchedule.test.js](../tests/unit/domain/sprintSchedule.test.js).

### 2.2 Storage contract (v8.30.0)

`storageService.save(data) → { ok: true } | { ok: false, error: string }`.
Раньше `QuotaExceededError` / `SecurityError` проглатывались — данные не
сохранялись, а после F5 пользователь терял работу. Теперь `App.saveToLS()`
при `!ok` показывает throttled snackbar (раз в 30 сек) с инструкцией скачать
JSON. Тот же контракт применять для любых критичных persist-операций.

### 2.3 Unique-id allocator (v8.30.0)

`normalizeTasks` и `normalizeCriteria` используют `createIdAllocator()`
для генерации уникальных id у элементов с невалидным `id`. Раньше
`Date.now()` (для tasks) и `0` (для criteria) внутри синхронного `map()`
давали коллизии — несколько импортированных записей получали один id,
`Store.updateTask`/`updateCriteria` потом промахивались.

### 2.4 safePlainObject + total migration + alignment invariant (v8.30.34 → v8.30.36)

`migratePersistedState` и все nested-normalizers — total functions для
любого JSON-ish input. `function f(x = {})` ловит ТОЛЬКО `undefined`;
на `null`/`'string'`/`[]` default не срабатывает, downstream бросает
TypeError или загрязняется numeric/char ключами через spread.

Helper `safePlainObject(value)` в
[primitiveNormalizers.js](../js/state/persistence/primitiveNormalizers.js):
plain object → passthrough; null/array/primitive → `{}`. Применяется к
`normalizeConfig` / `normalizeRoles` / `normalizeTaskFilter` / `normalizeTaskSort`
/ `normalizeUi` / `normalizeNumberFormat` / `normalizeCriteriaEvaluations`
/ `normalizeTaskEst` + `criteria.scale` spread.

#### v8.30.46: persistence facade split

[persistence.js](../js/state/persistence.js) остаётся публичным API для
`migratePersistedState()`, `serializeStateForStorage()` и
`analyzeImportIssues()`, но больше не содержит всю нормализацию в одном файле.
Внутренние границы:

| Модуль | Ответственность |
|---|---|
| `constants.js` | persist-defaults и allow-lists UI-state |
| `primitiveNormalizers.js` | `safePlainObject`, strict integer/number helpers, id allocator |
| `stateNormalizers.js` | config, roles, numberFormat, taskFilter/taskSort, ui |
| `criteriaNormalizers.js` | criteria + raw criterion id view |
| `taskNormalizers.js` | task shape, jira guard, effort, cycle remediation |
| `dependencies.js` | strict dependency ids + DFS cycle participants |
| `criteriaEvaluations.js` | canonical evaluation keys + orphan filtering |
| `importDiagnostics.js` | orchestrator honest import diagnostics для FileController |
| `diagnostics/*` | scoped diagnostics для config/roles/criteria/tasks + shared collectors |

Guard: [persistence-facade-contract.test.js](../tests/unit/architecture/persistence-facade-contract.test.js)
запрещает возвращать `normalizeTasks`, `analyzeImportIssues`,
`safePlainObject` и dependency-normalizers обратно в фасад. С v8.30.47 тот же
guard проверяет, что `importDiagnostics.js` не тянет обратно парсеры/ROLES и
остаётся orchestrator над `diagnostics/*`.

**Alignment invariant (v8.30.36):** для КАЖДОГО issue в `analyzeImportIssues`
с формулировкой «отброшено / применён fallback», post-migration state физически
**не содержит junk**. Раньше UI говорил «cycle отброшено» а migrate сохранял
1→2→1. Сейчас:

- **cycle remediation**: DFS-detected cycle participants получают `dependencies=[]`.
  Policy «clear all participants», документирован как deterministic.
- **criteriaEvaluations context-aware**: invalid keys (non-strict int) и orphan
  keys (нет соответствующего criterion id) **выбрасываются** из state.
  `normalizeTasks` принимает `validCriterionIds`; nesting через `serializeStateForStorage`.
- **task.est strict**: `parseStrictDecimal` (finite, ≥0, max 2 decimals,
  `.` или `,`). `'5abc'`/`-3`/`1.234`/`Infinity`/`'1e10'` → 0 + issue,
  не silent corruption.

#### v8.30.37: canonical keys / raw views / deferred context

`criteriaEvaluations` — referential map, поэтому ключи нормализуются так же
строго, как id критериев:

- **Canonical key:** любой валидный numeric-id ключ сохраняется как
  `String(parseStrictIntegerInRange(key, 1, MAX_SAFE_INTEGER))`. Например,
  `"01"` → `"1"`. Runtime читает `evaluations[criterion.id]`, а JS приводит
  numeric key к строке; неканонический `"01"` раньше давал priority=0.
- **Collision policy:** если несколько raw-key попадают в один canonical key
  (`"1"` и `"01"`), применяется first-canonical-wins. `analyzeImportIssues`
  обязан сообщить collision, а `migratePersistedState` обязан физически оставить
  только первый canonical entry.
- **Raw criterion id view:** orphan-check для eval-key идёт по raw id из
  import payload до reallocation duplicate criteria. Иначе `normalizeCriteria`
  мог бы назначить duplicate criterion новый id и случайно reattach eval,
  который пользователь не импортировал как валидную ссылку. Helper:
  `collectRawCriterionIds(rawCriteria)`.
- **Deferred context:** `criteria` absent и `criteria: []` — разные состояния.
  Если поле `criteria` отсутствует, context неизвестен, валидные eval-key
  сохраняются: runtime подмешает `DEFAULT_CRITERIA`. Если передано явное
  `criteria: []`, context задан как пустой, и eval-key считаются orphan.

Регрессии закреплены в
[`tests/unit/state/persistence.alignmentV37.test.js`](../tests/unit/state/persistence.alignmentV37.test.js):
S1 default criteria data loss, S2 canonical keys, S3 raw-vs-normalized criterion
id mismatch, S4 unknown role effort keys.

`analyzeImportIssues` сообщает shape-distortion для **каждого** покрытого
поля (см. таблицу ниже). Тесты `tests/unit/state/persistence.alignmentInvariants.test.js`
проверяют для **каждого** issue, что junk физически отсутствует в migrated state.

#### Покрытие analyzeImportIssues (v8.30.36)

| Поле | Shape | Range/Type | Cycle/Orphan |
|---|:---:|:---:|:---:|
| `config` | ✅ | ✅ days/holidays/alert/availCoef | — |
| `roles` | ✅ array shape | ✅ fte (int≥0), off (decimal 1) | — |
| `criteria` | ✅ array shape | ✅ id strict, weight 0..100 | ✅ duplicate id |
| `criteria[i].scale` | ✅ | — | — |
| `tasks` | ✅ array shape | ✅ id strict | ✅ duplicate id |
| `tasks[i].est` | ✅ | ✅ strict decimal ≥0, ≤2 dec | — |
| `tasks[i].criteriaEvaluations` | ✅ | ✅ score 0..10 | ✅ invalid/orphan key |
| `tasks[i].dependencies` | ✅ array | ✅ strict positive int | ✅ self/unknown/cycle |
| `taskFilter` / `taskSort` / `ui` / `numberFormatSettings` | ✅ | (валидация в normalizers) | — |

### 2.5 Strict dependencies contract (v8.30.35)

`task.dependencies` — массив **strict positive integer task id**.
Принимается number-integer или строка из чистых цифр (`'2'` → `2`).
Отбрасывается без silent fallback:

- non-integer (`'JIRA-42'`, `1.9`, `NaN`, `Infinity`, `{}`) → invalid id;
- self-id (cycle of length 1);
- unknown id (нет такой задачи в импорте);
- duplicates → схлопываются.

`analyzeImportIssues` сообщает каждый случай отдельным issue. DFS cycle detection
(post-pass) сообщает циклы `A→B→A`, `A→B→C→A`. Cap 100 элементов сохранён —
защита от раздутия cache key в `buildAlgorithmsCacheKey`.

### 2.6 e2e-runner: pure decideExitCode + честные лимиты process-tree (v8.30.35)

`scripts/e2eRunnerDecision.js` — pure-функция, 14 unit-тестов. Условия:
stale JSON / interrupted / timedOut / 0 tests / unexpected>0 / clean pass
+ worker shutdown race override. Каждое condition покрывается отдельно,
inline-логика в `child.on('exit')` запрещена (arch-test).

`scripts/processTreeKill.js` — Windows `taskkill /F /T /PID` (T = tree),
Unix `process.kill(-pgid)`. Работает по pid, без `exitCode !== null` guard.

**Лимит документирован**: post-exit cleanup через original parent pid
**не работает на Windows** (taskkill /T не находит tree mortvo parent).
Pre-exit summary-watchdog — единственный реальный механизм. Подробности —
[docs/RELEASE_PROCESS.md#e2e-runner](RELEASE_PROCESS.md) + тест
[windows-post-exit-cleanup-lie.test.js](../tests/unit/architecture/windows-post-exit-cleanup-lie.test.js).

### 2.7 Import/export UI boundary

`FileController` отвечает за сценарий загрузки/сохранения, но не форматирует
пользовательские представления напрямую:

- имя JSON-экспорта собирает [fileName.js](../js/utils/fileName.js):
  `buildSprintPlanFilename(productName, date)`;
- диагностический пакет собирает [diagnostics.js](../js/services/diagnostics.js):
  `collectDiagnosticsBundle()` возвращает версию приложения/storage schema,
  browser/runtime, service worker/cache, localStorage size и агрегированную
  сводку state без названия продукта, task titles, JIRA URL и комментариев;
- модель подтверждения импорта и success-message собирает
  [importIssues.js](../js/ui/importIssues.js);
- `messageService.showConfirm()` умеет принимать строку для legacy-confirm или
  структурированную модель (`title`, `body`, `notice`, `detailsItems`).

Правило UX: длинный список проблем импорта не вставлять в основной текст
confirm-модалки. В основном тексте остаётся короткое предупреждение, детали
раскрываются через `<details>`. Guard:
[file-controller-import-ui-contract.test.js](../tests/unit/architecture/file-controller-import-ui-contract.test.js).

Кнопка `#downloadDiagnosticsBtn` и hotkey `Ctrl/Cmd+Alt+D` вызывают
`FileController.downloadDiagnostics()`: controller только собирает зависимости
из Store/services и отдаёт JSON в `StorageService.saveFile()`. Любые новые поля
diagnostics должны проходить redaction review и unit-тесты
[diagnostics.test.js](../tests/unit/services/diagnostics.test.js), чтобы support
bundle оставался полезным для разбора проблем, но не утекал содержимым backlog.

#### Recovery Center / Storage Health (v8.30.56 → v8.30.57)

`RecoveryController` даёт пользовательский доступ к pre-migration backup
`sprintPlannerData.backup`, который bootstrap создаёт до разрушительной миграции.
С v8.30.57 это же окно показывает Storage Health: состояние текущего
`localStorage['sprintPlannerData']`, future-schema guard, число fallback issues
и recoverable backup без product/task titles.
Runtime-границы:

| Модуль | Ответственность |
|---|---|
| [statePreview.js](../js/services/statePreview.js) | общий preview для JSON import и recovery: future schema, import issues, migrated summary, count deltas |
| [storageHealth.js](../js/services/storageHealth.js) | redacted Project Doctor для текущего localStorage и backup metadata |
| [recovery.js](../js/services/recovery.js) | безопасно читает backup metadata/data, строит redacted summary/comparison через общий preview, делегирует durable save |
| [recoveryController.js](../js/controllers/recoveryController.js) | открывает модалку, показывает Storage Health и сравнение «сейчас → backup», скачивает backup, подтверждает восстановление |
| [stateImportApplier.js](../js/controllers/stateImportApplier.js) | общий apply-path для `FileController` и `RecoveryController`: migrate → number format → criteria → task criteria alignment → Store |

Recovery UI не выводит product/task titles. Он показывает только counts,
версию схемы, timestamp и размер backup. Восстановление сначала проверяет
future-storage guard (`backup.version > APP_CONFIG.STORAGE_VERSION`), затем
идёт через тот же migration/apply path, что и загрузка JSON. Если durable save
в `localStorage` возвращает `!ok`, controller откатывает runtime snapshot и
показывает ошибку.

Guard/test: [recovery.test.js](../tests/unit/services/recovery.test.js),
[storageHealth.test.js](../tests/unit/services/storageHealth.test.js),
[statePreview.test.js](../tests/unit/services/statePreview.test.js),
[recoveryController.test.js](../tests/unit/controllers/recoveryController.test.js)
и e2e-сценарий `Recovery Center` в [planner.spec.js](../tests/e2e/planner.spec.js).

### 2.8 TaskListHandler boundary (v8.30.48)

`TaskListHandler` остаётся DOM/store-orchestrator'ом для строк задач, но больше
не держит inline-расчёты изменения state. Сценарные операции вынесены в
малые helper-модули рядом с контроллером:

| Модуль | Ответственность |
|---|---|
| `taskEstimateMutations.js` | округление и clamp `est[roleId]` через `NumberFormatService` |
| `criteriaScoreMutations.js` | strict score parse и weighted `criteriaEvaluations` update |
| `taskExcludeMutations.js` | update ручного исключения/возврата задачи |
| `undoDeleteService.js` | undo-восстановление single/delete-all без stale snapshot |
| `taskOrderingActions.js` | normalize/sort/move списка задач через `fixTaskOrder` |

Правило: новая логика изменения задач сначала получает pure/helper-тест, а
`TaskListHandler` только читает DOM event, вызывает helper, пишет через Store и
инвалидирует cache/snackbar.

## 3. State и Render Flow

```
store.update*() → notify() → listeners → schedulePersist() + requestRender()
                                                ↓                    ↓
                                          saveToLS()         renderApp() (batched via rAF)
```

- `Store.getState()` возвращает **замороженную копию** состояния (Object.freeze, верхний уровень).
- Для обновления используются методы Store: `setConfig`, `setTasks`, `updateTask`, `setUiState`, `setDensity`, `setViewMode`, `toggleQuadrantExpanded`, `setExpandedQuadrants` и др.
- Рендер batched через `requestAnimationFrame` — исключает дублирующие перерисовки.

### state.ui (UI-state)

Все UI-настройки, переживающие F5, лежат в `state.ui` и нормализуются в `migratePersistedState`:

| Поле | Тип | Default | Источник | Сеттер |
|---|---|:---:|---|---|
| `activeAlgorithm` | `'matrix'\|'value-density'\|'hybrid'` | `'matrix'` | v8.13 | `setUiState` / `selectionController` |
| `density` | `'compact'\|'comfortable'` | `'comfortable'` | v8.14 (B); `'cozy'` удалён в v8.30.0 (legacy → comfortable) | `setDensity()` |
| `viewMode` | `'list'\|'quadrants'` | `'list'` | v8.14 (C) | `setViewMode()` |
| `expandedQuadrants` | `Array<'q1'\|'q2'\|'q3'\|'q4'\|'excluded'>` | все 5 | v8.14 (C); ключ `'excluded'` добавлен в v8.29.1 | `toggleQuadrantExpanded()` / `setExpandedQuadrants()` |

Невалидные значения (включая старые версии storage) автоматически нормализуются к default'ам. При добавлении нового UI-toggle:
1. Добавить поле в `DEFAULT_UI_STATE` в `js/state/persistence/constants.js`.
2. Добавить нормализацию в `normalizeUi(ui)`.
3. Добавить setter в `Store` (типа `setX`).
4. Подключить controller, который слушает события и вызывает setter.

### Hover-preview re-render обходит Store (v8.14)

`CapacityStripController` при hover/drag вызывает `renderCapacityStrip()` **напрямую**, не через `store.update*()` — иначе каждое движение мыши триггерило бы `schedulePersist` + `requestRender` всего приложения. Это валидно: controllers могут писать в DOM напрямую, и preview — это эфемерное состояние, которое не должно попадать в state.

## 4. Алгоритмы автоматического отбора задач

Все три алгоритма используют общую базу (`domain/selection/base.js`):
- **prepareTasks** — нормализация данных, расчёт valueDensity; при наличии `est` берёт текущие оценки из задачи, а `roleEffort` использует только как fallback для уже подготовленных объектов
- **calculateMedians** — вычисление медиан приоритета и трудозатрат
- **categorizeIntoQuadrants** — распределение по 4 квадрантам
- **compareByValueDensity** — компаратор по valueDensity ↓ (Value Density, Hybrid Q1/Q2)
- **compareByPriority** — компаратор по priorityScore ↓ (Matrix Q1/Q3/Q4, Hybrid Q3/Q4)
- **selectTasksUniform** — жадный отбор с проверкой ёмкости по ролям
- **buildSelectionResult** — формирование стандартного результата алгоритма (quadrants, medians, stats)

### 4.1. Priority-Effort Matrix (`matrix.js`)

Задачи распределяются по 4 квадрантам относительно медиан приоритета и трудозатрат:

```
           Высокий приоритет
                │
    Q2          │          Q1
    Стратегич.  │     Лёгкие победы
    (↑effort)   │     (↓effort, ↑priority)
 ───────────────┼───────────────── Медиана effort
    Q4          │          Q3
    Откладывать │     Заполнители
    (↓priority) │     (↓priority, ↓effort)
                │
           Низкий приоритет
```

**Порядок отбора**: Q1 → Q2 → Q3 → Q4.

| Квадрант | Сортировка внутри | Стратегия |
|----------|------------------|-----------|
| Q1 | `priorityScore` ↓ | Самые ценные и лёгкие — первыми |
| Q2 | `effort` ↑, затем `priorityScore` ↓ | Среди важных берём менее тяжёлые |
| Q3 | `priorityScore` ↓ | Заполняют оставшуюся ёмкость |
| Q4 | `priorityScore` ↓ | Включаются, если ёмкость позволяет |

### 4.2. Value Density (`valueDensity.js`)

Максимизирует суммарную «отдачу» спринта.

**Ключевая метрика**: `valueDensity = priorityScore / effort` — сколько «приоритета» приходится на 1 час работы.

```
Задача A: Priority Score 8,0; трудозатраты 10ч → VD = 0,80  ← предпочтительнее
Задача B: Priority Score 9,0; трудозатраты 40ч → VD = 0,225
```

Priority Score рассчитывается как `Σ(score × weight) / Σ(weight)` (см. [domain/criteria.js](../js/domain/criteria.js)), диапазон 0..10.

**Порядок отбора**: единая сортировка по `valueDensity` ↓ → жадный отбор.

**Отличие от Matrix**: не использует квадранты для приоритизации (квадранты вычисляются только для отчёта).

### 4.3. Hybrid (`hybrid.js`)

Совмещает подходы Matrix и Value Density:

| Квадрант | Сортировка | Отличие от Matrix |
|----------|-----------|-------------------|
| Q1 | `valueDensity` ↓ | В Matrix: по `priorityScore` |
| Q2 | `valueDensity` ↓ | В Matrix: по `effort` ↑ |
| Q3 | `priorityScore` ↓ | Совпадает |
| Q4 | `priorityScore` ↓ | Совпадает |

**Идея**: для важных задач (Q1, Q2) оптимизирует эффективность использования ресурсов (valueDensity), а для менее важных (Q3, Q4) — просто берёт наиболее приоритетные.

### 4.4. Общий механизм отбора (`selectTasksUniform`)

Жадный алгоритм (greedy knapsack) с ограничениями по ролям:

1. Проход по задачам в порядке, определённом алгоритмом
2. Для каждой задачи проверяются 5 условий:
   - Не исключена вручную
   - Ненулевые трудозатраты
   - Общая ёмкость команды не превышена
   - Ёмкость каждой роли (UI/UX, CA, FE, BE, QA) не превышена
   - Все зависимости уже отобраны
3. Если все условия выполнены → задача включается в спринт
4. Если нет → задача исключается с указанием причины

### 4.5. Apply-time capacity guard (`selectionController.js`)

`SelectionController.applyAlgorithm()` не применяет `selectedTasks` из отчёта напрямую. Перед записью в store он вызывает `buildCapacitySafeSelection()` из `controllers/selection/selectionHelpers.js` и повторно набирает выбранные задачи по текущим `state.tasks`, `state.roles` и `capacityByRole`.

Инвариант: после применения алгоритма ни одна роль и команда целиком не должны превышать доступную ёмкость. Если результат отчёта устарел, кэш повреждён или будущая правка алгоритма вернёт небезопасный набор, apply-guard оставит переполняющие задачи исключёнными с причиной `Исключена алгоритмом: превышение ёмкости`.

Контракты UserManual закреплены тестами:
- `selectionManualContract.test.js` — порядок Matrix / Value Density / Hybrid ровно по описанию в UserManual.
- `selectionCapacity.property.test.js` — property-based invariant для всех трёх алгоритмов: selected load ≤ role/team capacity.
- `selectionController.test.js` — stale/unsafe result не может быть применён поверх живого состояния.
- `user-incidents.spec.js` — e2e после применения автоотбора проверяет отсутствие role/team overload.

## 5. CSS стратегия

| Файл | Назначение |
|------|-----------|
| `base.css` | CSS-переменные тем (включая sandy light с v8.14), reset, типографика, `@layer` декларация |
| `a11y.css` | A11y-overrides: `:focus-visible`, touch-target ≥44px, `prefers-reduced-motion`, `aria-invalid`, `clamp()` typography, `@container` (v8.13) |
| `layout.css` | Сетки и компоновка |
| `buttons.css` | Стили кнопок |
| `forms.css` | Стили полей ввода |
| `modals.css` | Стили модальных окон |
| `components.css` | Общие компоненты, кнопки критериев, density-toggle (v8.14); task-card selectors запрещены с v8.30.62 |
| `criteria.css` | Критерии оценки: sticky sum-pill, inline weight input, hover-actions, collapsed-by-default body, drag-and-drop reorder (v8.29) |
| `selection-report.css` | Отчёт автоотбора: 3 алгоритм-карточки с кнопками применения, выровненные ряды метрик и metric bars, блок «Рекомендации», аккордеоны описаний/детализации |
| `task-card.css` | Базовая оболочка карточки задачи: `.task-item`, header, `.task-type-badge`, `.task-type-indicator` (скрытый, backward-compat e2e), title/comment/links; единственный owner task-card base styles |
| `task-card-effort.css` | Блок трудозатрат карточки: роли, inline effort inputs, overload placeholder, total effort pill |
| `task-card-actions.css` | Hover/focus/touch actions карточки: edit/delete/exclude/reorder buttons |
| `task-card-criteria.css` | Блок критериев карточки: criteria chips, score stepper/input/select, contribution bar, priority score pill |
| `task-card-states.css` | Responsive, animation and drag states for task rows |
| `task-card-quadrants.css` | View toggle and Quadrants grouping styles, включая sticky group headers |
| `density.css` | Единая точка density-delta для `#taskList[data-density]`: `--task-row-*`, compact visibility и compact criteria stepper |
| `team-capacity.css` | Team Capacity Dashboard (v8.21): header с gauge, сетка карточек ролей с inputs FTE%/Отпуск внутри, levels success/warning/danger, preview overlay при drag, single-iteration overload pulse |
| `capacity-strip.css` | Legacy 5-сегментная Capacity Strip (v8.14): сохранён как dual-class hooks `cap-segment*` для backward-compat e2e/unit тестов; live UI рендерит `js/ui/teamCapacity.js` |
| `print.css` | Печать |
| `animations.css` | Keyframes, drag-состояния, highlight pulse |
| `accordion.css` | Аккордеоны сравнения алгоритмов |
| `help.css` | Стили справки, TOC-highlight |
| `snackbar.css` | Toast-уведомления с кнопкой «Отменить» |
| `progress.css` | Spinner, прогресс-бар, мобильные аббревиатуры |
| `responsive.css` | Все @media breakpoints (1200/900/768/600px) |
| `create-task-modal.css` | Модальное окно создания задачи |

- Темы управляются через `data-theme` атрибут на `<html>`.
- FOUC предотвращается inline-скриптом в `<head>`.
- Все цвета соответствуют **WCAG 2 AA** (контраст ≥ 4.5:1).
- CSS-переменная `--accent-text` обеспечивает контраст текста на accent-фоне в обеих темах.
- `base.css` объявляет порядок будущих cascade layers:
  `reset, tokens, layout, components, utilities, a11y, overrides`. Полный перенос
  существующих файлов в `@layer` откладывать до отдельного visual regression pass:
  unlayered rules сейчас имеют больший cascade priority, чем layered normal rules.
- [css-cascade-contract.test.js](../tests/unit/architecture/css-cascade-contract.test.js)
  закрепляет безопасный первый шаг CSS migration: только `base.css` объявляет
  manifest слоёв, порядок `<link rel="stylesheet">` в `index.html` остаётся
  явным, `print.css` грузится последним с `media="print"`, task-card subfiles
  грузятся в исходном порядке до `density.css`, а текущий бюджет
  `!important` не может расти без осознанного review (`90` всего, `61` в
  `print.css`). v8.30.52 снял лишние print-override'ы с типографики/отступов
  после `print-verify.spec.js` и visual baseline `print A4 task card`; v8.30.55
  убрал дублированный overload-блок из `task-card.css` и заменил modal-form
  overrides в `create-task-modal.css` на нормальную специфичность; v8.30.57
  убрал дублирующие print `black/white !important`, которые уже покрывает
  глобальное print-правило. v8.30.61 механически разделил `task-card.css` на
  concern-файлы без смены cascade-порядка и снял три безопасных non-print
  `!important`. v8.30.62 удалил stale task-card block из `components.css`,
  который из-за специфичности мог перебивать новые `task-card-*` правила, и
  закрепил ownership guard: task-card selectors не возвращаются в
  `components.css`.
- `npm run css:important-report` генерирует
  [docs/css-important-report.md](css-important-report.md) из реального CSS и
  [docs/css-important-budgets.json](css-important-budgets.json). В release
  gates использовать `node scripts/report-css-important.mjs --check`, чтобы
  документация по CSS debt не отставала от budget guard'а.
- [density-css-boundary.test.js](../tests/unit/architecture/density-css-boundary.test.js)
  фиксирует, что task density deltas живут в `density.css`, грузятся после
  task-card subfiles и попадают в PWA precache.

## 6. Безопасность

- Загрузка внешнего markdown (справка) санитизируется через **DOMPurify**.
- Пользовательский ввод экранируется через `escapeHtml()` перед вставкой в DOM.
- `Store.getState()` возвращает копию верхнего уровня через `Object.freeze` — **shallow freeze**. Прямые мутации полей корневого объекта (`state.tasks = ...`, `state.config = ...`) бросают `TypeError` в strict-mode. Мутации вложенных структур (`state.tasks[0].title = ...`, `state.config.days = ...`) **проходят молча** — это сознательный trade-off (deep-freeze дорог при каждом `getState()` в render-loop). Дисциплина инвариантности обеспечивается контролируемыми сеттерами `Store.setTasks/updateTask/setConfig/...`, а не deep-freeze. При добавлении нового поля state — добавлять сеттер, не позволять контроллерам править вложенные структуры.
- Валидация JIRA URL блокирует `javascript:` протокол.

## 7. Тестирование

### Запуск тестов

```bash
npm install                  # установка зависимостей (один раз)
npm test                     # unit-тесты (Jest + jsdom)
npm run test:coverage -- --maxWorkers=50%  # unit + coverage (parallel release gate)
npm run test:smoke           # быстрая проверка unit-подмножества
npm run docs:manual-check    # generated manual contract + guard от дрейфа справки
npm run css:important-report # обновить docs/css-important-report.md
npm run test:e2e:smoke       # mobile-webkit smoke gate (быстрый indicator)
npm run test:e2e             # полный E2E (4 Playwright projects)
npm run release:metrics-history -- --metrics test-results/release-metrics-v<X.Y.Z>.json
npm run docs:modules         # обновить docs/MODULE_MAP.md
```

### Тестовые суиты (v8.30.55)

| Тип | Фреймворк | Команда | Release gate |
|-----|-----------|---------|--------------|
| Unit | Jest 30 + jsdom 30 | `npm test`, покрытие — `npm run test:coverage -- --maxWorkers=50%` | **yes** (coverage exit 0) |
| Docs drift | generator check + Jest architecture guards | `npm run docs:manual-check` | **yes** при изменении UI-copy/UserManual |
| CSS debt report | Node scanner + budget JSON | `npm run css:important-report`, `node scripts/report-css-important.mjs --check` | **yes** при release/docs gate |
| Архитектурные | Jest (`tests/unit/architecture/`) | в составе unit | **yes** |
| E2E smoke | Playwright (mobile-webkit) | `npm run test:e2e:smoke` | **yes** (быстрый pre-release indicator) |
| E2E полный | Playwright (4 projects) | `npm run test:e2e` | **yes** |
| Accessibility | @axe-core/playwright | в составе e2e (`tests/e2e/accessibility.spec.js`) | в составе e2e |
| `npm audit` | npm | `npm audit --audit-level=moderate` | **yes** (0 moderate+) |

Все release gates обязательны (см. `docs/RELEASE_PROCESS.md`, чек-лист). Релиз с red gate — категорически нельзя; см. memory `feedback-release-with-red-tests-banned`.

### Release automation (v8.30.47 → v8.30.54)

`npm run release:public -- --version <X.Y.Z> ...` строит полный план доставки
PLANNER → `sprint-planner/FOR_USERS`. По умолчанию это **dry-run**: печатает
permissions, sync entries и команды commit/push/release. Опасные действия
выполняются только с `--execute`.

Script использует pure-plan слой [releasePublicPlan.js](../scripts/releasePublicPlan.js),
покрытый [releasePublicPlan.test.js](../tests/unit/scripts/releasePublicPlan.test.js).
Перед execute он проверяет release contract через
[releaseContract.js](../scripts/releaseContract.js): metrics JSON текущей
версии, latest `docs/RELEASE_NOTES.md`, строки coverage/smoke/full e2e,
`release:metrics` и отсутствие CSS budget violations должны совпасть до любых
мутаций. Затем проверяется `gh repo view --json viewerPermission` для PLANNER и
FOR_USERS, синхронизируется установленная public-shape (папки
`css/js/docs/icons/dev-tools`, root-файлы и root-документация), выполняются
отдельные commit/push и `gh release create`. С v8.30.48:

- флаг `--public-smoke` запускает [public-smoke.mjs](../scripts/public-smoke.mjs)
  по уже синхронизированному public root до commit/push/release;
- флаг `--notes-from-release-notes` читает latest release notes section и
  использует её как GitHub Release body после release contract validation;
- public worktree обязан быть clean до sync;
- после sync изменённые пути public-проекта проверяются против установленной
  public-shape, чтобы release-скрипт не утянул случайные `.github`, package
  или локальные файлы;
- architecture guard [release-public-execute-guard.test.js](../tests/unit/architecture/release-public-execute-guard.test.js)
  следит, что sync/commit/push/release остаются за явным `--execute`, release
  contract выполняется до sync, процесс документирует
  `release:public --execute --public-smoke --notes-from-release-notes`, а
  latest release notes не содержит placeholder'ов.

### Playwright projects (`playwright.config.js`)

4 проекта запускаются параллельно (`fullyParallel: true`):

| project | viewport / engine | testMatch | Назначение |
|---|---|---|---|
| `chromium` | Desktop Chrome 1280×720 | все .spec.js, кроме mobile/webkit | основной desktop suite |
| `mobile-chromium` | Pixel 5 (393×851), Chromium | `mobile.spec.js` | mobile responsive invariants |
| `webkit` | Desktop Safari 1280×720 | `webkit.spec.js` | engine-specific smoke (sticky, focus-trap) |
| `mobile-webkit` | iPhone 13 (390×844), WebKit | `mobile.spec.js` | iOS Safari + mobile-webkit specific |

`visual.spec.js` (v8.30.49 → v8.30.50) запускается в desktop `chromium` project
и хранит 10 baseline-снимков: light/dark planning shell, compact task list,
capacity overload, create-task modal, criteria tab, criteria modal, selection
report, mobile burger menu и print A4 task card. Состояния сидируются через
`localStorage`, version/timestamp скрыты CSS-маской, transitions/animations
выключены. Обновлять snapshots только после осознанного UI-изменения:
`npx playwright test tests/e2e/visual.spec.js --project=chromium --update-snapshots`.
После update обязательно открыть новые PNG глазами: зелёный snapshot с пустым
или нерепрезентативным seed не защищает UI.

E2E user workflow helpers живут в [tests/e2e/support/plannerApp.js](../tests/e2e/support/plannerApp.js).
`planner.spec.js` не должен заново объявлять локальные workflow helpers для
создания задач, сброса состояния, переключения вкладок или изменения sprint
config. Guard: [e2e-support-dsl.test.js](../tests/unit/architecture/e2e-support-dsl.test.js).
С v8.30.53 там же есть `seedState()`, а прикладные seed-сценарии вынесены в
[plannerStates.js](../tests/e2e/support/plannerStates.js): basic tasks,
overload, quadrants, print A4, sticky и visual baseline. Visual/e2e tests должны
переиспользовать эти builders вместо локального `localStorage` JSON, чтобы
baseline не стал зелёным снимком пустого состояния. Guard:
[e2e-support-dsl.test.js](../tests/unit/architecture/e2e-support-dsl.test.js)
запрещает возвращать локальный `BASE_STATE` и прямой `localStorage.setItem()`
в `visual.spec.js`.

### Coverage thresholds (v8.30.49)

`jest.config.cjs` использует не только global gate, но и per-layer thresholds:
`domain/` 95% statements/functions/lines, `state/` 95% statements/lines,
`controllers/` 85%, `ui/` 85% statements/lines и 70% branches. Цель — не дать
новым доменным/миграционным модулям провалить покрытие за счёт UI-среднего.
Coverage reporters включают `json-summary`, потому что release metrics collector
читает `coverage/coverage-summary.json`, а не парсит текстовый stdout.

Property-based persistence checks через `fast-check` живут в
[persistence.properties.test.js](../tests/unit/state/persistence.properties.test.js):
`migratePersistedState` должен быть total function для arbitrary JSON-ish input,
а цикл `migrate → serialize → migrate` стабилен для нормализованных state slices.

### Release metrics collector (v8.30.53)

`npm run release:metrics` собирает машинно-читаемый snapshot релиза из уже
полученных артефактов: `coverage/coverage-summary.json`, smoke/full
`test-results/e2e-parallel-summary.json` и CSS budget
[docs/css-important-budgets.json](css-important-budgets.json). Скрипт пишет
`test-results/release-metrics-v<version>.json`, печатает короткую сводку и
падает, если текущий `!important` count превысил общий или per-file budget.

`npm run release:metrics-history -- --metrics test-results/release-metrics-v<version>.json`
обновляет tracked trend artifact
[docs/release-metrics-history.json](release-metrics-history.json): coverage %,
smoke/full e2e, child exits/override и CSS `!important` total/budget. Это не
gate вместо `release:metrics`, а история для сравнения релизов без ручного
переноса цифр из старых release notes.

`npm run release:metrics-dashboard` генерирует
[docs/release-metrics-dashboard.md](release-metrics-dashboard.md): latest delta
между двумя последними релизами и таблицу истории. Dashboard не заменяет release
gate, а даёт быстрый обзор трендов coverage, e2e времени и CSS debt.

`npm run css:important-report` пишет человекочитаемый snapshot
[docs/css-important-report.md](css-important-report.md). Это companion-doc к
release metrics: guard запрещает рост budget, а report показывает, где именно
остаточный долг живёт сейчас.

`npm run release:notes-draft` строит Markdown-заготовку release section из того
же metrics JSON. Это не заменяет ручной changelog, но убирает повторяющийся
ручной перенос coverage/e2e/CSS цифр.

### E2E taxonomy (v8.30.56)

Полный `npm run test:e2e` остаётся release gate. Для быстрых локальных проверок
добавлены focused scripts:

| Script | Назначение |
|---|---|
| `npm run test:e2e:critical` | Chromium path: startup, diagnostics, Recovery Center, create task, persistence |
| `npm run test:e2e:visual` | Chromium visual baselines |
| `npm run test:e2e:a11y` | axe-core/focus accessibility specs |
| `npm run test:e2e:mobile` | mobile-webkit smoke через parallel runner |
| `npm run test:e2e:perf` | Chromium large-backlog gate: 300 задач, render + search filter |
| `npm run test:e2e:actionability` | Chromium click path: видимые команды должны выполнить действие или показать feedback |

Source of truth — [e2eTaxonomy.js](../scripts/e2eTaxonomy.js), runner —
[e2e-taxonomy.mjs](../scripts/e2e-taxonomy.mjs). Guard:
[e2e-taxonomy-contract.test.js](../tests/unit/architecture/e2e-taxonomy-contract.test.js)
проверяет, что package scripts не дрейфуют от taxonomy definitions и не
подменяют full e2e gate.

Perf taxonomy не заменяет профилирование. Это regression gate на уже найденный
класс деградации: overload-индикаторы не должны пересчитывать весь список после
каждого progressive-render batch.

Actionability taxonomy не заменяет full e2e. Это быстрый guard на класс ошибок
«кнопка видна, но клик не даёт наблюдаемого результата»: download, modal,
snackbar или сообщение.

### Diagnostics issue template (v8.30.56)

`npm run diagnostics:issue-template -- --diagnostics path/to/diagnostics.json --out issue.md`
рендерит Markdown issue template из redacted diagnostics bundle. Скрипт
[diagnosticsIssueTemplate.js](../scripts/diagnosticsIssueTemplate.js) читает
только агрегированные поля (`app`, `runtime`, `storage`, `currentState`,
`persistedState`, `serviceWorker`, `caches`) и не проходит по произвольным raw
полям bundle, чтобы случайный пользовательский текст не попал в issue.

### User feedback package (v8.30.57)

`npm run feedback:template` печатает Markdown-шаблон для реальной обратной
связи пользователей. Скрипт [userFeedbackPackage.js](../scripts/userFeedbackPackage.js)
не читает project JSON и не принимает произвольные данные: он просит описать
сценарий, ожидаемый/фактический результат, тему/viewport и приложить redacted
diagnostics JSON. Подробная операционная памятка — в
[docs/USER_FEEDBACK_PACKAGE.md](USER_FEEDBACK_PACKAGE.md).

**Webserver** (`webServer` в playwright.config.js): `npx http-server . -p 8123 --silent --no-cache` на порту **8123**. Порт зафиксирован — `start-server.bat`, `start-server.sh`, README, UserManual, e2e-runner используют один и тот же 8123. Legacy-упоминания 8000/8080 в старых docs больше не отражают реальное поведение проекта. Когда `e2e-parallel.mjs` уже держит verified Sprint Planner server на 8123, `e2e-runner.mjs` передаёт `PLAYWRIGHT_REUSE_EXISTING_SERVER=1`; это включает `reuseExistingServer` даже в GitHub Actions с `CI=true`.

### e2e-runner (`scripts/e2e-runner.mjs`)

Тонкий wrapper над Playwright CLI, обходит worker-shutdown race на Node 22+ Windows:

- Spawn'ит Playwright с `--reporter=list,json`. Ground truth для обычного exit-кода — per-process JSON-файл (`test-results/e2e-runner-results-${process.pid}.json`, `stats.unexpected`), не stdout-парсинг.
- Stdout-monitor — секундарный watchdog, force-kill child tree после `N passed (M total)` summary + 3s, если child сам не завершился (WebKit hang race).
- Windows `mobile-webkit` имеет дополнительный узкий all-ok watchdog: если list reporter уже напечатал все ожидаемые `ok N` строки, failures не было, а child не завершился за 3s, runner делает tree-kill до внутреннего 300s Playwright timeout. Этот путь всегда пишет `[OVERRIDE]` и `child exit=1`, чтобы release notes не называли его clean child exit.
- **Port 8123 own-server detection (v8.30.33+):** если порт занят, runner делает HTTP GET на `/index.html` и ищет `<title>Sprint Planner` сигнатуру. Свой сервер — info, продолжаем и ставим `PLAYWRIGHT_REUSE_EXISTING_SERVER=1`, чтобы Playwright не пытался поднять второй `webServer` в CI. Чужой listener — **fail fast** с явной ошибкой и инструкцией (taskkill/kill). Раньше: «reuseExistingServer всё подхватит» как fallback, давало мутную диагностику.
- **Process-tree cleanup (v8.30.33+):** Playwright spawn'ит worker'ов, worker'ы — браузеры. Простой `child.kill()` оставлял grandchildren orphan. Теперь:
  - **Windows:** `taskkill /F /T /PID <pid>` (T = tree).
  - **Unix:** `spawn(..., {detached:true})` → новая process group; `process.kill(-pid, signal)` кладёт всю группу.
  - Tree-kill вызывается из cleanupAndExit (SIGINT/SIGTERM/exit) и из force-kill watchdog'а.
- Orphan-cleanup: SIGINT/SIGTERM/exit propagate в process tree + SIGKILL после 1.5s timeout.
- НЕ модифицирует `NODE_OPTIONS` (см. memory `feedback-node-options-pollutes-child-workers`).
- Lifecycle invariant-тест: [tests/unit/architecture/e2e-runner-lifecycle.test.js](../tests/unit/architecture/e2e-runner-lifecycle.test.js) spawn'ит fake child → grandchild, проверяет что tree-kill убивает grandchild (а простой `kill` — нет).

### Диагностика тестов

| Симптом | Решение |
|---------|---------|
| `Cannot find module 'jest'` | `npm install` |
| `SyntaxError: Cannot use import statement` (Jest) | Проверьте `babel.config.cjs` |
| `ReferenceError: require is not defined` в `jest.mock` | Убедитесь, что в скрипте `npm test` **нет** `--experimental-vm-modules` |
| `ReferenceError` в фабрике мока | Определяйте моки **внутри** фабрики `jest.mock()` (см. паттерн ниже) |
| `jest.unstable_mockModule is not a function` | Замените на `jest.mock()` — проект использует `babel-jest` (CJS) |
| `connect ECONNREFUSED 127.0.0.1:8123` (E2E) | Playwright запускает сервер автоматически через `webServer` в playwright.config.js. Если ошибка остаётся — проверьте, что `http-server` установлен (`npx http-server --version`). |
| `port 8123 occupied by foreign process` (e2e-runner) | На порту 8123 уже сидит не-Sprint Planner процесс (другой проект, забытый dev-сервер). v8.30.33+ runner отличает свой сервер от чужого по `<title>` сигнатуре и не молча подхватывает чужой. Освободите порт: `netstat -ano \| findstr :8123` (Windows) или `lsof -i :8123` (Unix) → kill PID. |
| `browserType.launch: Executable doesn't exist` | `npx playwright install` |
| Тесты доступности падают | `npx playwright show-report` → исправьте нарушения |

### Паттерн моков (jest.mock)

Проект использует `babel-jest` для трансформации ESM → CJS. Babel **хойстит** вызовы `jest.mock()` выше всех импортов. Это создаёт ограничения:

**Единый паттерн для всех тестов с моками:**

```javascript
import { jest } from '@jest/globals';

// 1. Все jest.mock() — сразу после import { jest }
jest.mock('./path/to/module.js', () => ({
    myFunction: jest.fn()          // ✅ jest.fn() внутри фабрики
}));

// 2. Статические импорты — после jest.mock()
import { myFunction } from './path/to/module.js';  // получаем мок
import { TestedClass } from './path/to/tested.js';

// 3. В тестах используем импортированные моки
test('example', () => {
    myFunction.mockReturnValue(42);
    // ...
    expect(myFunction).toHaveBeenCalled();
});
```

**Запрещённые паттерны:**

```javascript
// ❌ Внешние переменные в фабрике — Babel хойстит jest.mock() выше,
//    переменная ещё undefined
const myMock = jest.fn();
jest.mock('./mod.js', () => ({ fn: myMock }));

// ❌ jest.unstable_mockModule — только для native ESM,
//    несовместим с babel-jest
jest.unstable_mockModule('./mod.js', () => ({ fn: jest.fn() }));

// ❌ /* global jest */ — Babel генерирует require('@jest/globals'),
//    который может не работать
/* global jest */
jest.mock('./mod.js', () => ({ fn: jest.fn() }));
```

## 8. Структура проекта

```text
index.html
manifest.json                      # PWA-манифест
sw.js                              # Service Worker (Cache-First)
icons/
  icon-192.svg                     # иконка PWA 192×192
  icon-512.svg                     # иконка PWA 512×512
css/
  base.css                         # CSS-переменные тем, reset
  layout.css                       # сетки и компоновка
  buttons.css                      # стили кнопок
  forms.css                        # стили полей ввода
  modals.css                       # стили модальных окон
  components.css                   # общие компоненты, кнопки критериев
  criteria.css                     # критерии оценки
  selection-report.css             # отчёт автоотбора
  task-card.css                    # карточка задачи
  print.css                        # печать
  animations.css                   # keyframes, drag, highlight
  accordion.css                    # аккордеоны алгоритмов
  help.css                         # стили справки
  snackbar.css                     # toast-уведомления
  progress.css                     # spinner, прогресс-бар
  responsive.css                   # @media breakpoints
  create-task-modal.css            # модальное окно создания задачи
js/
  app.js                           # точка входа, оркестрация
  controllers/
    capacityStripController.js     # drag-preview подсветка Team Capacity (v8.21)
    configController.js            # конфигурация спринта
    criteriaController.js          # управление критериями
    densityController.js           # density toggle (compact/comfortable, v8.14)
    fileController.js              # импорт/экспорт данных
    helpController.js              # справка (DOMPurify-санитизация)
    keyboardController.js          # горячие клавиши
    roleController.js              # управление ролями
    selectionController.js         # автоматический отбор задач
    tabController.js               # переключение вкладок
    taskController.js              # управление задачами (оркестратор)
    themeController.js             # переключение светлой/тёмной темы
    viewModeController.js          # List ↔ Quadrants toggle (Stream C, v8.14)
    criteria/
      criteriaFormController.js    # модаль критериев
    selection/
      selectionHelpers.js          # хелперы автоотбора
    task/
      taskFormController.js        # унифицированная create+edit форма (v8.27)
      taskDragController.js        # drag-and-drop
      taskFlowActions.js           # pure routing primary action / task-list buttons (v8.30.47)
      taskEstimateMutations.js     # update est[roleId] через NFS (v8.30.48)
      criteriaScoreMutations.js    # update criteriaEvaluations (v8.30.48)
      taskExcludeMutations.js      # ручное исключение/возврат (v8.30.48)
      taskOrderingActions.js       # normalize/sort/move списка задач (v8.30.48)
      undoDeleteService.js         # undo single/delete-all без stale snapshot (v8.30.48)
      taskCacheService.js          # кэширование priority-score
      taskListHandler.js           # обработчики бизнес-логики (вкл. undo-delete)
      formHelpers.js               # валидация полей форм
  domain/
    config.js                      # конфигурация по умолчанию
    criteria.js                    # расчёт приоритета
    criteriaManager.js             # CRUD-менеджер критериев
    role.js                        # расчёт загрузки ролей
    task.js                        # операции над задачами
    validation.js                  # валидация данных
    selection/
      index.js                     # реэкспорт алгоритмов
      base.js                      # общие функции (квадранты, медианы, компараторы, buildSelectionResult)
      matrix.js                    # Priority-Effort Matrix
      valueDensity.js              # Value Density
      hybrid.js                    # гибридный алгоритм
      analysis.js                  # сравнение алгоритмов
      config.js                    # SELECTION_CONFIG + ALGORITHM_KEYS + EXCLUSION_REASON_ALGORITHM
  services/
    message.js                     # уведомления пользователю
    numberFormat.js                # форматирование чисел
    storage.js                     # localStorage-обёртка
  state/
    store.js                       # единое хранилище (Object.freeze)
    persistence.js                 # публичный facade миграции и сериализации
    persistence/                   # нормализаторы, diagnostics и shared helpers
      diagnostics/                 # honest-import diagnostics по surfaces (v8.30.47)
  types/
    contracts.js                   # типовые контракты (JSDoc)
  ui/
    index.js                       # реэкспорт рендер-функций
    createForm.js                  # рендер унифицированной create+edit формы (v8.27)
    createTaskRowVM.js             # ViewModel для строки задачи (v8.14, B5)
    criteriaList.js                # рендер списка критериев
    header.js                      # рендер шапки (счётчики задач)
    importIssues.js                # VM подтверждения JSON-импорта + success-message
    matrix.js                      # рендер матрицы компетенций
    modalManager.js                # единый менеджер модальных окон
    teamCapacity.js                # Team Capacity Dashboard (v8.21, заменил roleList.js + capacityStrip.js)
    selectionReport.js             # рендер отчёта
    selectionRecommendations.js    # рендер рекомендаций
    snackbar.js                    # snackbar/toast (undo-delete)
    taskList.js                    # рендер плоского списка задач (progressive rendering)
    taskListGrouped.js             # рендер задач по квадрантам (Stream C, v8.14)
    utils.js                       # UI-хелперы
  utils/
    appConfig.js                   # конфигурация приложения
    constants.js                   # константы (ROLES, TASK_TYPES)
    date.js                        # работа с датами (addWorkingDays, countWorkingDays, isWorkingDay)
    debounce.js                    # debounce-обёртка
    escapeHtml.js                  # экранирование HTML (XSS)
    fileName.js                    # безопасные имена JSON-экспорта
    lruCache.js                    # LRU-кэш
tests/
  unit/                            # Jest unit тесты (актуальные счётчики — в docs/RELEASE_NOTES.md)
    controllers/
      criteria/                    # тесты критериев
      selection/                   # тесты автоотбора
      task/                        # тесты задач (form, drag, cache, list)
    domain/
      selection/                   # тесты алгоритмов (matrix, hybrid, ...)
    services/
    state/
    ui/
    utils/
  e2e/                             # Playwright + axe-core (актуальные счётчики — в docs/RELEASE_NOTES.md)
    planner.spec.js                # пользовательские сценарии
    theme.spec.js                  # тесты темы и доступности
    accessibility.spec.js          # WCAG 2 AA
    print-verify.spec.js           # инвариант print rendering (роли + критерии)
```

## 9. Вспомогательные модули

| Модуль | Назначение |
|--------|-----------|
| `snackbar.js` | Snackbar/toast с кнопкой «Отменить» (undo-delete) |
| `lruCache.js` | LRU-кэш для priority-score и алгоритмов |
| `taskCacheService.js` | Кэширование priority-score и role-load |
| `taskFormController.js` | Унифицированная форма create+edit задачи (v8.27, ранее были две раздельные модалки) |
| `viewModeController.js` | Переключатель List ↔ Quadrants (Stream C, v8.14) |
| `densityController.js` | Density toggle (Compact/Comfortable, v8.14, упрощён в v8.27.1) |
| `capacityStripController.js` | Drag-preview подсветка сегментов Team Capacity Dashboard |
| `taskDragController.js` | Drag-and-drop переупорядочивание |
| `taskFlowActions.js` | Pure helper для primary create/edit action, shortcut detection и task-list button routing |
| `taskEstimateMutations.js` / `criteriaScoreMutations.js` | Тестируемые update helpers для est и criteriaEvaluations |
| `taskExcludeMutations.js` / `taskOrderingActions.js` | Тестируемые helpers ручного исключения, нормализации, sort/move |
| `undoDeleteService.js` | Undo restore для single/delete-all без stale full snapshot |
| `taskListHandler.js` | Тонкий DOM/store-orchestrator списка задач |
| `criteriaFormController.js` | Модаль критериев |
| `modalManager.js` | Единый менеджер модальных окон |
| `themeController.js` | Переключение светлой/тёмной темы |
| `selectionReport.js` | Рендер отчёта сравнения алгоритмов |
| `selectionRecommendations.js` | Рендер рекомендаций оптимизации |
| `percent.js` | UI-контракт для отображаемых процентов: `formatUiPercent` / `formatSignedUiPercent` дают целые неотрицательные значения; CSS-геометрия зажимается через `clampPercentWidth` |

## 10. Политика изменений

- Новые модули обязаны следовать границам слоёв (см. §2).
- Типовые контракты зафиксированы в `js/types/contracts.js`.
- Изменения CSS-цветов проверяются через e2e accessibility-тесты.
