# Архитектура PLANNER

> Техническая документация для разработчиков и технических специалистов.
> Пользовательская документация: `README.md` (в корне). Справка: `docs/UserManual.md`.
> История изменений: `docs/RELEASE_NOTES.md`.

## 1. Runtime / Точка входа

- Единственная точка входа: `index.html` → `js/app.js`.
- Все модули подключаются через ES imports от `app.js`.
- Для тестов: `window.__PLANNER_DISABLE_AUTOBOOT__` отключает автозапуск.

## 2. Слои приложения

```
index.html
  └─ js/app.js (orchestrator)
       ├─ js/state/store.js          — единое хранилище состояния (state.ui.density, viewMode, expandedQuadrants — v8.14)
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
       └─ js/utils/*                 — утилиты (debounce, escapeHtml, lruCache, sanitize, icons)
  └─ sw.js                      — Service Worker (Cache-First, оффлайн)
  └─ manifest.json              — PWA-манифест (установка на устройство)
```

### Правила слоёв

| Слой | Доступ к DOM | Доступ к Store | Бизнес-логика |
|------|:---:|:---:|:---:|
| `domain/` | ❌ | ❌ | ✅ |
| `controllers/` | ✅ | ✅ | оркестрация |
| `services/` | ✅ | ❌ | ❌ |
| `ui/` | ✅ | через параметры (не импортирует Store) | ❌ |
| `utils/` | ❌ | ❌ | ❌ |

### 2.1 Progressive rendering и generation token (v8.30.0)

`renderTaskList()` рендерит первые 20 задач синхронно, остальные — через
`requestIdleCallback` батчами. Каждый вызов `renderTaskList()` инкрементирует
module-level `renderGeneration`. Pending idle-callback'и старого рендера
сверяют `myGeneration` со счётчиком и абортятся, если их рендер устарел —
иначе stale-карточки дозалились бы в уже очищенный новый DOM при быстрой
смене state. Тестовый хук: `_getRenderGeneration()`.

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

Helper `safePlainObject(value)` в [persistence.js](../js/state/persistence.js):
plain object → passthrough; null/array/primitive → `{}`. Применяется к
`normalizeConfig` / `normalizeRoles` / `normalizeTaskFilter` / `normalizeTaskSort`
/ `normalizeUi` / `normalizeNumberFormat` / `normalizeCriteriaEvaluations`
/ `normalizeTaskEst` + `criteria.scale` spread.

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
1. Добавить поле в `DEFAULT_UI_STATE` в `js/state/persistence.js`.
2. Добавить нормализацию в `normalizeUi(ui)`.
3. Добавить setter в `Store` (типа `setX`).
4. Подключить controller, который слушает события и вызывает setter.

### Hover-preview re-render обходит Store (v8.14)

`CapacityStripController` при hover/drag вызывает `renderCapacityStrip()` **напрямую**, не через `store.update*()` — иначе каждое движение мыши триггерило бы `schedulePersist` + `requestRender` всего приложения. Это валидно: controllers могут писать в DOM напрямую, и preview — это эфемерное состояние, которое не должно попадать в state.

## 4. Алгоритмы автоматического отбора задач

Все три алгоритма используют общую базу (`domain/selection/base.js`):
- **prepareTasks** — нормализация данных, расчёт valueDensity
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

## 5. CSS стратегия

| Файл | Назначение |
|------|-----------|
| `base.css` | CSS-переменные тем (включая sandy light с v8.14), reset, типографика, `@layer` декларация |
| `a11y.css` | A11y-overrides: `:focus-visible`, touch-target ≥44px, `prefers-reduced-motion`, `aria-invalid`, `clamp()` typography, `@container` (v8.13) |
| `layout.css` | Сетки и компоновка |
| `buttons.css` | Стили кнопок |
| `forms.css` | Стили полей ввода |
| `modals.css` | Стили модальных окон |
| `components.css` | Общие компоненты, кнопки критериев, density-toggle (v8.14) |
| `criteria.css` | Критерии оценки: sticky sum-pill, inline weight input, hover-actions, collapsed-by-default body, drag-and-drop reorder (v8.29) |
| `selection-report.css` | Отчёт автоотбора: featured-баннер рекомендации, 3 алгоритм-карточки, метрик-бары, легаси `.comparison-table` (v8.28) |
| `task-card.css` | Карточка задачи: density tokens (`--task-row-*`), `.task-type-badge` (иконка + полное название типа), `.task-type-indicator` (скрытый, backward-compat e2e), hover-only actions, sticky-headers для quadrants (v8.14) |
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
npm run test:coverage        # unit + coverage (release gate)
npm run test:smoke           # быстрая проверка unit-подмножества
npm run test:e2e:smoke       # mobile-webkit smoke gate (быстрый indicator)
npm run test:e2e             # полный E2E (4 Playwright projects)
```

### Тестовые суиты (v8.30.31)

| Тип | Фреймворк | Команда | Release gate |
|-----|-----------|---------|--------------|
| Unit | Jest 30 + jsdom 30 | `npm test`, покрытие — `npm run test:coverage -- --runInBand` | **yes** (coverage exit 0) |
| Архитектурные | Jest (`tests/unit/architecture/`) | в составе unit | **yes** |
| E2E smoke | Playwright (mobile-webkit) | `npm run test:e2e:smoke` | **yes** (быстрый pre-release indicator) |
| E2E полный | Playwright (4 projects) | `npm run test:e2e` | **yes** |
| Accessibility | @axe-core/playwright | в составе e2e (`tests/e2e/accessibility.spec.js`) | в составе e2e |
| `npm audit` | npm | `npm audit --audit-level=moderate` | **yes** (0 moderate+) |

Все release gates обязательны (см. `docs/RELEASE_PROCESS.md`, чек-лист). Релиз с red gate — категорически нельзя; см. memory `feedback-release-with-red-tests-banned`.

### Playwright projects (`playwright.config.js`)

4 проекта запускаются параллельно (`fullyParallel: true`):

| project | viewport / engine | testMatch | Назначение |
|---|---|---|---|
| `chromium` | Desktop Chrome 1280×720 | все .spec.js, кроме mobile/webkit | основной desktop suite |
| `mobile-chromium` | Pixel 5 (393×851), Chromium | `mobile.spec.js` | mobile responsive invariants |
| `webkit` | Desktop Safari 1280×720 | `webkit.spec.js` | engine-specific smoke (sticky, focus-trap) |
| `mobile-webkit` | iPhone 13 (390×844), WebKit | `mobile.spec.js` | iOS Safari + mobile-webkit specific |

**Webserver** (`webServer` в playwright.config.js): `npx http-server . -p 8123 --silent --no-cache` на порту **8123**. Порт зафиксирован — `start-server.bat`, `start-server.sh`, README, UserManual, e2e-runner используют один и тот же 8123. Legacy-упоминания 8000/8080 в старых docs больше не отражают реальное поведение проекта.

### e2e-runner (`scripts/e2e-runner.mjs`)

Тонкий wrapper над Playwright CLI, обходит worker-shutdown race на Node 22+ Windows:

- Spawn'ит Playwright с `--reporter=list,json`. Ground truth для exit-кода — JSON-файл (`test-results/e2e-runner-results.json`, `stats.unexpected`), не stdout-парсинг.
- Stdout-monitor — секундарный watchdog, force-kill child tree после `N passed (M total)` summary + 3s, если child сам не завершился (WebKit hang race).
- **Port 8123 own-server detection (v8.30.33+):** если порт занят, runner делает HTTP GET на `/index.html` и ищет `<title>Sprint Planner` сигнатуру. Свой сервер — info, продолжаем (webServer.reuseExistingServer подхватит). Чужой listener — **fail fast** с явной ошибкой и инструкцией (taskkill/kill). Раньше: «reuseExistingServer всё подхватит» как fallback, давало мутную диагностику.
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
    persistence.js                 # миграции и сериализация
  types/
    contracts.js                   # типовые контракты (JSDoc)
  ui/
    index.js                       # реэкспорт рендер-функций
    createForm.js                  # рендер унифицированной create+edit формы (v8.27)
    createTaskRowVM.js             # ViewModel для строки задачи (v8.14, B5)
    criteriaList.js                # рендер списка критериев
    header.js                      # рендер шапки (счётчики задач)
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
| `taskListHandler.js` | Обработчики бизнес-логики списка задач |
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
