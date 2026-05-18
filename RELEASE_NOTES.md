# Release Notes

## Версия: май 2026 (обновление 8.30.15) — review pass 11 + post-merge maintenance

### Findings внешнего ревью (review pass 11)

| # | Уровень | Где | Что |
|---|---|---|---|
| 1 | **P2** | `sw.js:93` ASSETS_TO_CACHE | `js/ui/appVersionBadge.js` и `js/version.js` импортируются на старте ([js/app.js:25](../js/app.js#L25) → ui/appVersionBadge.js → version.js), но НЕ в precache → offline-старт получал fetch-error. Конфликт с обещанием «полной оффлайн-работы». |
| 2 | P3 | `index.html:25-46` | CSS cache-bust query застрял на смеси `?v=3` / `?v=4` / `?v=1` / `?v=v8.22.2` при текущей версии 8.30.15. bump-скрипт обновлял только manifest и app.js, CSS не двигал. |
| 3 | P3 | `README.md:20` / `docs/ARCHITECTURE.md:32` / `docs/UserManual.md:247` / `index.html:221` / `js/ui/index.js:14` / `js/utils/icons.js:50` | Drift по версии появления Team Capacity Dashboard: называли v8.21 / v8.28+ / v8.14.1 / v8.14 в разных местах. Историческая правда (RELEASE_NOTES v8.21): introduced in v8.21. |
| 4 | P4 | `css/print.css:217-226` | Print-правило пытается показать legacy `.task-type-indicator` (`width: 40px; display: flex !important`), но не сбрасывает `clip` / `clip-path` / `position` / `overflow` из `task-card.css:194-205` → computed `clip-path: inset(50%)` остаётся, indicator невидим. `.task-type-badge` при этом виден — print-контракт вводил в заблуждение. |
| 5 | P4 | `css/capacity-strip.css:2` / `js/controllers/capacityStripController.js:3` / `tests/e2e/planner.spec.js:1014` | Legacy naming drift: «Unified Capacity Strip» / «Capacity Strip controller» / `describe('Capacity Strip')` для live Team Capacity Dashboard. Файлы намеренно сохранены под legacy именами как dual-class hooks, но описания вводили в заблуждение. |
| 6 | P4 | branch coverage | `taskListGrouped.js` 60%, `capacityStripController.js` 62.5%, `appVersionBadge.js` 62.5%, `utils.js` 60%. Informational — оставлено для следующего hardening-pass'а. |

### Что починено (review pass 11)

| # | Изменение |
|---|---|
| 1 | [`sw.js`](../sw.js) ASSETS_TO_CACHE: добавлены `./js/ui/appVersionBadge.js` и `./js/version.js`. Расширен [`tests/unit/architecture/precache-coverage.test.js`](../tests/unit/architecture/precache-coverage.test.js) — теперь транзитивно обходит ВСЕ relative-импорты из `js/app.js` и требует чтобы каждый достижимый JS-модуль был в precache. Плюс инвариант «JS-модули в ASSETS_TO_CACHE реально существуют на диске». Регрессия теперь падает at-commit. |
| 2 | Унифицированный CSS cache-bust: все 22 CSS-ссылки в [`index.html`](../index.html) получили `?v=v8.30.15`. [`scripts/bump-version.mjs`](../scripts/bump-version.mjs) расширен 7-м target'ом (global regex по `<link rel="stylesheet" href="css/*.css?v=...">`). Тест-инвариант в `precache-coverage.test.js` (CSS query === APP_VERSION) + [`bumpVersion.test.js`](../tests/unit/scripts/bumpVersion.test.js) (regex smoke). |
| 3 | Team Capacity Dashboard унифицирован на `v8.21` в 6 местах: README.md, docs/ARCHITECTURE.md, docs/UserManual.md (×3 — список разделов, «Индикаторы перегрузки», заключительный абзац), index.html, js/ui/index.js, js/utils/icons.js. |
| 4 | [`css/print.css`](../css/print.css): удалён мёртвый блок `.task-type-indicator { width: 40px; ... }` (clip/clip-path/position не сбрасывал) + child-rules `.task-type-indicator i / .fas / .fa { display: none }` (родительский элемент visually-hidden, дети мёртвые). |
| 5 | Legacy naming в комментариях обновлён: «Team Capacity Dashboard legacy hooks» в `css/capacity-strip.css`, `js/controllers/capacityStripController.js`. В `tests/e2e/planner.spec.js:1012` добавлен комментарий поясняющий, что `describe('Capacity Strip')` сохранён для backward-compat истории прогонов. |

### Метрики (review pass 11)

| Метрика | До pass 11 | После pass 11 |
|---|---|---|
| Unit-suites | 77 PASS / 1195 tests | 77 PASS / **1199 tests** (+4 invariants: транзитивный JS-precache, JS-exists-on-disk, CSS-cache-bust=APP_VERSION, bump-script 7-й target) |
| E2E | 191 PASS | 191 PASS |
| Lint | clean | clean |
| audit | 0 vulns | 0 vulns |
| PWA precache JS-modules | 26 (минус 2 импортируемых) | 28 (все импортируемые покрыты) |
| CSS cache-bust drift | 4 разных группы (`3`/`4`/`1`/`v8.22.2`) | unified `v8.30.15` (двигается через bump) |

### Hard-reload

DevTools → Application → Service Workers → **Unregister** + **Ctrl+Shift+R**. CACHE_VERSION → `sp-v8.30.15-maintenance`. После pass 11 кэш браузера получит свежие CSS благодаря унифицированному `?v=v8.30.15`.

---

## Версия: май 2026 (обновление 8.30.15) — post-merge maintenance: DOMPurify 3.4.5 + lock sync + coverage uplift + doc drift

### Findings внешнего ревью

| # | Уровень | Где | Что |
|---|---|---|---|
| 1 | P2 | `js/vendor/purify.min.js` vs `package-lock.json` | Vendored DOMPurify 3.4.2 дрейфовал от audited npm-зависимости (lock 3.4.4, upstream 3.4.5). `npm audit` контролирует только npm-pin, не vendored copy → security-библиотека могла устаревать незаметно. |
| 2 | P3 | `package-lock.json` line 3, 9 | `version: 8.30.7` против `package.json: 8.30.14` — release/metadata drift. |
| 3 | P3 | `docs/RELEASE_NOTES.md` line 25 | Указано «76 PASS», фактический прогон после coverage-uplift коммита `2d74162` — 77 suites / 1195 tests. |
| 4 | P3 | `docs/UserManual.md` lines 241, 248 | Описан старый Capacity Strip + отдельная строка FTE/отпуск; реальный UI — Team Capacity Dashboard, inputs внутри карточек ролей. |
| 5 | P3 | `docs/UserManual.md` line 259 | «dot-индикатор (8px кружок)» — устарел; реальный видимый UI рендерит `.task-type-badge` (иконка + полное название типа), а буквенный `.task-type-indicator` скрыт CSS-ом для backward-compat e2e тестов ([css/task-card.css:196](../css/task-card.css#L196)). |

### Что починено

| # | Изменение |
|---|---|
| 1 | DOMPurify обновлён: npm-зависимость `^3.4.4 → ^3.4.5`, vendored [`js/vendor/purify.min.js`](../js/vendor/purify.min.js) пересобран из `node_modules/dompurify/dist/`. Версия в header'е jar'а проверена (`DOMPurify 3.4.5`). Sourcemap [`purify.min.js.map`](../js/vendor/purify.min.js.map) добавлен. |
| 2 | `package-lock.json` resynced: version 8.30.7 → 8.30.15 (бывший lock drift). |
| 3 | Coverage-uplift коммит `2d74162` добавил +48 unit-тестов в 4 модуля (app.js, taskListGrouped, teamCapacity, selectionReport). Branch coverage по этим модулям: 60.77% → 85.9%. Метрики в таблице ниже отражают фактический прогон (77 suites / 1195 tests). |
| 4 | [`docs/UserManual.md`](UserManual.md) §«Планирование спринта»: блок «Capacity Strip» переписан как «Team Capacity Dashboard» (карточки ролей с inputs внутри), убрана отдельная строка FTE/отпуск под полосой. |
| 5 | [`docs/UserManual.md`](UserManual.md) описание карточки задачи: «dot-индикатор (8px кружок)» → бейдж типа `.task-type-badge` (иконка + полное название: User Story / Bug / Tech). Скрытый `.task-type-indicator` упомянут отдельно как backward-compat для e2e. |

### Метрики

| Метрика | v8.30.14 | v8.30.15 |
|---|---|---|
| Unit-suites | 76 PASS | 77 PASS (+1 — coverage uplift) |
| Unit-tests | ≈1147 | 1195 (+48) |
| E2E | 191 PASS | 191 PASS |
| Lint | clean | clean |
| audit | 0 vulns | 0 vulns (DOMPurify vendored синхрон с npm 3.4.5) |
| Branch coverage (4 модуля) | 60.77% | 85.9% |

### Hard-reload

DevTools → Application → Service Workers → **Unregister** + **Ctrl+Shift+R**. CACHE_VERSION → `sp-v8.30.15-maintenance`.

---

## Версия: май 2026 (обновление 8.30.14) — десятый review-pass: selective warning suppression + count fix

### Findings внешнего ревью

| # | Уровень | Где | Что |
|---|---|---|---|
| 1 | P3 | RELEASE_NOTES v8.30.13 секция | Указано «1147 PASS», ревьюер видел «1146». Doc drift — точное число unit'ов env-чувствительно (на моём окружении стабильно 1147 в 3+ прогонах, расхождение неустановлено). Принимаем замечание: исключаем точные test-counts из release-notes как нестабильный источник истины — оставляем «76 suites passing». |
| 2 | P3 | `package.json` + `scripts/run-e2e.mjs` (v8.30.13) | Глобальный `NODE_NO_WARNINGS=1` + `node --no-warnings` глушил **все** Node deprecation warnings от Playwright-процесса, включая будущие потенциально важные. |

### Что починено

| # | Изменение |
|---|---|
| 1 | Секция v8.30.13 ниже: «1146 → 1147» заменено на «76 suites passing» — стабильная характеристика, не флаки-зависимая. |
| 2 | [`scripts/run-e2e.mjs`](../scripts/run-e2e.mjs) переписан: `NODE_NO_WARNINGS=1` → точечный `NODE_OPTIONS=--disable-warning=DEP0205`. Будущие Node-warning'и от Playwright (DEP0NNN, кроме DEP0205) **остаются видны**. |
| 2 | Wrapper больше **не** использует `shell: true` + npx-шим: запускает `node node_modules/playwright/cli.js test ...` напрямую. Это устраняет паразитный DEP0190 (security warning от `shell: true`) — `node --no-warnings` в npm script больше не нужен. |
| 2 | [`package.json`](../package.json): добавлен новый script `"test:e2e:trace": "npx playwright test"` — periodic-trace прогон без suppression, чтобы вовремя заметить новые upstream-warning'и. |

### Метрики

| Метрика | v8.30.13 | v8.30.14 |
|---|---|---|
| Unit-suites | 76 PASS | 76 PASS |
| E2E | 191 PASS (0 deprecation warnings в логе) | 191 PASS (0 deprecation warnings в логе при `test:e2e`, DEP0205 виден при `test:e2e:trace`) |
| Lint | clean | clean |
| audit | 0 vulns | 0 vulns |

### Hard-reload

DevTools → Application → Service Workers → **Unregister** + **Ctrl+Shift+R**. CACHE_VERSION → `sp-v8.30.14-review-pass-10`.

---

## Версия: май 2026 (обновление 8.30.13) — девятый review-pass: strict DOM invariant + e2e clean log

### Findings внешнего ревью

| # | Уровень | Источник | Что |
|---|---|---|---|
| 1 | P3 | [taskFormController.js:304](../js/controllers/task/taskFormController.js#L304) | `console.warn` + silent return null на нарушенный DOM-инвариант. В production: «кнопка не работает в тишине». В test/CI: warning могут пропустить, баг доезжает до прода. |
| 2 | P3 | npm run test:e2e | Node DEP0205 deprecation warning продолжал шуметь в CI-логах (источник — Playwright runtime). |

### Что починено

| # | Файл | Изменение |
|---|---|---|
| 1 | [taskFormController.js:301-318](../js/controllers/task/taskFormController.js#L301) | DOM-инвариант теперь обрабатывается строго: в `NODE_ENV === 'test'` — `throw new Error(...)` с elementId в сообщении (баг падает в jest сразу); в production — `console.error` + `messageService.showMessage('Не удалось обработать форму: внутренняя ошибка интерфейса. Перезагрузите страницу.')` + return null. |
| 1 | [taskFormController.test.js:265-307](../tests/unit/controllers/task/taskFormController.test.js#L265) | Старый тест на `console.warn` заменён на 2 теста — verify throw в test-env и production behaviour (мутация `NODE_ENV='production'`). |
| 2 | [scripts/run-e2e.mjs](../scripts/run-e2e.mjs) (новый) | Мини-wrapper над `playwright test`: запускает Playwright с `NODE_NO_WARNINGS=1` в env, кросс-платформенно (Windows / Unix). |
| 2 | [package.json scripts.test:e2e](../package.json) | `"test:e2e": "node --no-warnings scripts/run-e2e.mjs"`. Флаг `--no-warnings` на wrapper-процессе гасит и собственный DEP0190 от `shell: true` spawn. |

### Self-audit

`grep console.warn` по `js/` — только vendored DOMPurify (не наш код) и собственный комментарий в taskFormController. Других silent-null+warn паттернов в production-коде нет.

### Метрики

| Метрика | v8.30.12 | v8.30.13 |
|---|---|---|
| Unit-suites | 76 PASS | 76 PASS (один тест переписан: −1 старый warn-тест, +2 throw + production-snackbar; точное число тестов env-чувствительно, см. v8.30.14 doc-fix) |
| E2E | 191 PASS | 191 PASS, **0 deprecation warnings в логе** |
| Lint | clean | clean |
| audit | 0 | 0 |

### Hard-reload

DevTools → Application → Service Workers → **Unregister** + **Ctrl+Shift+R**. CACHE_VERSION → `sp-v8.30.13-review-pass-9`.

---

## Версия: май 2026 (обновление 8.30.12) — восьмой review-pass: doc/test drift cleanup

### Findings внешнего ревью (после v8.30.11)

P1/P2 нет. 4 P3 drift'а — все ловятся правилами, которые уже были применены в v8.30.11, но не распространены на смежные места.

| # | Уровень | Источник | Что |
|---|---|---|---|
| A | P3 | [UserManual.md:512](UserManual.md#L512) | FAQ «без сети встроенная справка откроется в **упрощённом формате**» — устарело после v8.30.11 precache UserManual.md. |
| B | P3 | [helpController.js:21-22](../js/controllers/helpController.js#L21) | JSDoc «marked и DOMPurify загружаются лениво через **CDN**» — реальность с v8.20-х: локальные `./js/vendor/*.min.js`. |
| C | P3 | [RELEASE_PROCESS.md:27-35](RELEASE_PROCESS.md#L27) | Перечислены только 5 мест синхронизации (без `app.js?v=`), хотя bump-script с v8.30.11 обновляет 6. |
| D | P3 | [bumpVersion.test.js:18-34](../tests/unit/scripts/bumpVersion.test.js#L18) | Smoke-тест regex'ов покрывал 4 target'а — оба `index.html` target'а (manifest + app.js) НЕ тестировались. |

### Что починено

| # | Файл | Изменение |
|---|---|---|
| A | [UserManual.md (FAQ)](UserManual.md) | «работает оффлайн... включая **полную** встроенную справку, закэшированную Service Worker'ом наравне с остальными ассетами». |
| B | [helpController.js JSDoc](../js/controllers/helpController.js) | «загружаются лениво из локального `./js/vendor/marked.min.js` и `./js/vendor/purify.min.js` — оба ассета precache'ятся Service Worker'ом». |
| C | [RELEASE_PROCESS.md синхронизационная таблица](RELEASE_PROCESS.md) | Добавлена строка про `app.js?v=vX.Y.Z` cache-bust (v8.30.11). |
| D | [bumpVersion.test.js](../tests/unit/scripts/bumpVersion.test.js) | Smoke-тест покрывает **все 6 target'ов**, плюс новый тест-инвариант: шапка bump-script упоминает корректное N == count(targets). |

### Метрики

| Метрика | v8.30.11 | v8.30.12 |
|---|---|---|
| Unit-тесты | 1143 PASS | **1146 PASS** (+3 — 2 новых regex target'а + 1 invariant на шапку bump-script) |
| E2E | 191 PASS | 191 PASS |
| Lint | clean | clean |
| audit | 0 | 0 |

### Hard-reload предупреждение

⚠ **Ctrl+Shift+R** перед запуском. DevTools → Application → Service Workers → **Unregister**. Изменён CACHE_VERSION (`sp-v8.30.12-review-pass-8-doc-drift`).

---

## Версия: май 2026 (обновление 8.30.11) — седьмой review-pass: PWA offline-справка + drift-фиксы

### Findings внешнего ревью

| # | Уровень | Источник | Что |
|---|---|---|---|
| 1 | **P2** | [helpController.js:62](../js/controllers/helpController.js#L62) ↔ [sw.js:10](../sw.js#L10) | `docs/UserManual.md` отсутствовал в `ASSETS_TO_CACHE` → если пользователь установил PWA и ушёл offline до первого открытия справки (F1), markdown не в кэше → справка ломается. README обещает «полную оффлайн-работу включая справку». |
| 2 | P3 | [RELEASE_NOTES.md:99 (v8.30.8)](#) | DEP0205 warning атрибутирован babel-jest, реальный источник — `node_modules/playwright/lib/common/index.js`. |
| 3 | P3 | [ARCHITECTURE.md:224](ARCHITECTURE.md#L224) ↔ [store.js:60](../js/state/store.js#L60) | «Защита от мутаций» переоценивала контракт: реально shallow freeze, вложенные структуры остаются мутабельными. |
| 4 | P3 | [index.html:688](../index.html#L688) ↔ [bump-version.mjs:49](../scripts/bump-version.mjs#L49) | `app.js?v=v8.22.3-reorg-docs-folder` — 8 версий назад. Bump-script обновлял только `manifest.json?v=`. |

### Что починено

| # | Файл | Изменение |
|---|---|---|
| 1 | [sw.js:117-118](../sw.js#L117) | Добавлен `./docs/UserManual.md` в `ASSETS_TO_CACHE`. CACHE_VERSION → `sp-v8.30.11-review-pass-7`. |
| 1 | [tests/unit/architecture/precache-coverage.test.js:66-75](../tests/unit/architecture/precache-coverage.test.js#L66) | Новый invariant-тест: `docs/UserManual.md` обязан быть в precache (offline-справка F1). |
| 2 | [docs/RELEASE_NOTES.md (v8.30.8 секция)](#) | Атрибуция DEP0205 исправлена: Playwright, не babel-jest. |
| 3 | [docs/ARCHITECTURE.md:224](ARCHITECTURE.md#L224) | Контракт `Store.getState()` теперь явно описывает shallow-freeze, мутации вложенных структур, дисциплину через сеттеры. |
| 4 | [scripts/bump-version.mjs:73-79](../scripts/bump-version.mjs#L73) | Bump-script теперь обновляет 6 мест: добавлен `app.js?v=vX.Y.Z` в index.html. После запуска bump → app.js cache-bust автоматически синхронен с релизом. |

### Метрики

| Метрика | v8.30.10 | v8.30.11 |
|---|---|---|
| Unit-тесты | 1142 PASS | **1143 PASS** (+1 invariant — UserManual в precache) |
| E2E | 191 PASS | 191 PASS |
| Lint | clean | clean |
| audit | 0 | 0 |
| Bump-script targets | 5 мест | **6 мест** (добавлен app.js?v=) |

### Hard-reload предупреждение

⚠ **Ctrl+Shift+R** перед запуском (Cmd+Shift+R на macOS).
DevTools → Application → Service Workers → **Unregister** (изменён CACHE_VERSION в sw.js, добавлен новый ассет в precache).

---

## Версия: май 2026 (обновление 8.30.10) — Priority Score в карточках исключённых задач

### Жалоба пользователя

«Почему для исключенных из спринта задач ты не выводишь Priority Score в карточке задачи?» — без него сортировка по приоритету «выглядит случайной», т.к. пользователь не может визуально проверить порядок excluded-секции.

### Что починено

| Было | Стало |
|---|---|
| `buildCriteriaHtml` в [taskList.js](../js/ui/taskList.js) возвращал пустую строку для `task.excluded === 1` → строка метрик приоритета вообще не отображалась. | Для excluded рендерится компактная строка `criteria-row criteria-row--excluded`: метка «Приоритет» + `priority-score-container` с финальным Priority Score. Stepper'ы и chip'ы критериев скрыты (бессмысленны для excluded — оценки нельзя менять без возврата задачи в спринт). |

### Sort by Priority — проверено отдельно

После репорта пользователя «обрати внимание на сортировку для исключённых» я (Claude) проверил алгоритм через unit-тесты с контролируемыми входами ([sortExcludedPriority.test.js](../tests/unit/controllers/sortExcludedPriority.test.js)):

- Активные задачи → отсортированы по priority DESC.
- Исключённые задачи → отсортированы по priority DESC внутри своей секции.
- При равном priority — стабильность сортировки сохраняется.

Все 2 теста pass. Сортировка алгоритмически корректна. Видимое «несоответствие» в Playwright debug-сессии было артефактом не-фиксации части кликов на stepper'ах — реальные cached значения priority были близки, но не равны ожидаемым.

### Метрики

| Метрика | v8.30.9 | v8.30.10 |
|---|---|---|
| Unit-тесты | 1140 PASS | **1142 PASS** (+2 sort regression guards) |
| E2E | 191 PASS | 191 PASS |
| Lint | clean | clean |
| audit | 0 | 0 |

---

## Версия: май 2026 (обновление 8.30.9) — «Отбор задач»: info-message когда план уже сбалансирован

### Запрос пользователя

Кнопка «Отбор задач» доступна всегда, но запуск алгоритмов не имеет смысла если ни одна роль не перегружена — нечего перераспределять. Раньше пользователь получал отчёт с пустыми рекомендациями. Теперь:

- **Перед запуском алгоритмов** контроллер проверяет: есть ли роль, у которой `Σ effort активных задач > capacity роли`. Сравнение строгое (`>`), без alert-порога (порог влияет только на UI-подсветку capacity-strip).
- **Если ни одна роль не перегружена** — модалка отчёта НЕ открывается. Показывается info-сообщение: **«Текущий состав спринта уже сбалансирован, корректировка не требуется»**.
- **Если хотя бы одна перегружена** — поведение прежнее, открывается отчёт сравнения алгоритмов.

Реализация: [selectionController.js:114-127](../js/controllers/selectionController.js#L114) использует существующую `calculateRoleLoad(roleId, tasks, excludedFlag=false)` из [domain/role.js](../js/domain/role.js) — считает только активные (не-исключённые) задачи. Исключённые задачи с большим effort не провоцируют запуск (это специально проверено отдельным unit-тестом).

### Тесты

| Что | Где |
|---|---|
| Гард пропускает запуск при отсутствии перегрузки + показывает info-msg | [selectionController.test.js](../tests/unit/controllers/selectionController.test.js) — новый тест `runMultiSelection skips when no role is overloaded` |
| Исключённые задачи с большим effort НЕ провоцируют запуск | Тот же файл — `skips when excluded tasks would overload but active ones do not` |
| E2E — клик при отсутствии перегрузки показывает info-modal | [planner.spec.js](../tests/e2e/planner.spec.js) — `v8.30.9 shows info message when no role is overloaded` |

Существующие тесты, использовавшие baseline-данные без перегрузки, обновлены: добавлен «тяжёлый» FE-input в `beforeEach`, чтобы гард пропускал запуск.

### Метрики

| Метрика | v8.30.8 | v8.30.9 |
|---|---|---|
| Unit-тесты | 1138 PASS | **1140 PASS** (+2 selection guard) |
| E2E | 190 PASS | **191 PASS** (+1 balanced-info) |
| Lint | clean | clean |
| audit | 0 | 0 |

---

## Версия: май 2026 (обновление 8.30.8) — Tooling refresh + UserManual.md cleanup

Закрытие двух ранее отложенных P3 debts (см. v8.30.5 и v8.30.6 release notes).

### UserManual.md cleanup

| Что | Как |
|---|---|
| Inline `<style>` блок (60 строк CSS в начале файла) | **Удалён.** DOMPurify USE_PROFILES html=true всё равно strip'ал `<style>` в in-app help → стили никогда не применялись там. На github страница рендерится без inline CSS-блоков. Эквивалентные правила (`.formula`, `.help-content table` и т.д.) уже живут в [css/help.css](../css/help.css) с актуальной темизацией через `var(--*)`. |
| `<div class="user-manual">` обёртка | Удалена (рудимент inline-style, без CSS не имела смысла). |
| Dead classes `.note`, `emoji-icon` | Удалены — в markdown не использовались. |

**Верификация:** временный e2e-тест проверил: in-app help-модалка открывается, headings/tables/`.formula` рендерятся со стилями из `css/help.css`, в DOM нет `<style>` элемента. Скриншот просмотрен через Read tool — визуально идентично pre-v8.30.8.

### Tooling refresh

| Пакет | Было | Стало |
|---|---|---|
| `@playwright/test` | 1.58.2 | **1.60.0** (minor) |
| `@axe-core/playwright` | 4.11.1 | **4.11.3** (patch) |
| `@babel/preset-env` | 7.29.0 | **7.29.5** (patch) |
| `eslint` | 10.0.2 | **10.4.0** (minor) |
| `globals` | 17.3.0 | **17.6.0** (minor) |
| `babel-plugin-istanbul` | 6.1.1 | **удалён** (dead dep — jest использует `coverageProvider: 'v8'`, istanbul не вызывался) |
| `c8` | 10.1.3 | **удалён** (dead dep — coverage делает jest, c8 не было ни в одном скрипте) |

**Новая хромиум-сборка** для Playwright 1.60: `Chrome Headless Shell 148.0.7778.96` (`chromium-headless-shell v1223`).

Полный прогон после upgrade: **unit 1138 PASS, e2e 190 PASS, lint clean, npm audit 0 vulns, npm outdated пусто.**

**Note**: `Node DEP0205 module.register() is deprecated` warning остался. Источник — `node_modules/playwright/lib/common/index.js` (виден в stack-trace e2e-прогона), не babel-jest, как было ошибочно атрибутировано ранее. Фикс ожидает обновления самим Playwright. Не блокер.

### Метрики

| Метрика | v8.30.7 | v8.30.8 |
|---|---|---|
| Unit | 1138 PASS | 1138 PASS |
| E2E | 190 PASS | 190 PASS |
| Lint | clean | clean |
| audit | 0 | 0 |
| `npm outdated` | 7 deps | **пусто** |
| UserManual.md размер | 580 строк (60 dead CSS) | 521 строка |
| Dead devDependencies | 2 (`babel-plugin-istanbul`, `c8`) | **0** |

---

## Версия: май 2026 (обновление 8.30.7) — Hot-fix: print timestamp protruded в UI + doc-comment drift

### Hot-fix (жалоба пользователя)

В v8.30.6 я (Claude) добавил `<span id="printTimestamp">` и rule `.print-only-timestamp { display: none }` в [css/print.css](../css/print.css). Промах: `print.css` подключён в [index.html](../index.html) с `media="print"` — он загружается ТОЛЬКО при печати, поэтому правило `display:none` не применялось в screen-режиме. Пользователь видел строку «(дата печати ДД.ММ.ГГГГ ЧЧ:ММ)» прямо в шапке UI рядом с версией.

**Fix:** правило скрытия перенесено в [css/base.css](../css/base.css) (загружается всегда). В `print.css` остаётся только override `display: inline !important` внутри `@media print`. Регрессия-инвариант: e2e `print-timestamp` (timestamp скрыт в screen, виден в print) — проверял локально, временный test-файл удалён после приёмки.

**Урок:** проверять `media`-атрибут CSS-link'а ПЕРЕД написанием default-rule. Если файл media-scoped — default rule живёт в base, не в этом файле. Записано в память.

### Дополнительно — doc-comment drift (P3 ревью)

| Файл | Было | Стало |
|---|---|---|
| [js/version.js](../js/version.js) | Комментарий «синхронизируется с 3 другими местами», включал RELEASE_NOTES. Реально bump обновляет 5 файлов и НЕ трогает RELEASE_NOTES. | Перечислены все 5 авто-обновляемых мест (package.json, version.js, sw.js, UserManual.md, index.html). Явно оговорено, что RELEASE_NOTES — manual. |
| [scripts/bump-version.mjs](../scripts/bump-version.mjs) | Header: «синхронной правки в 4 местах». Реально targets 5. | Header обновлён, пятая запись (index.html `?v=`) добавлена с поясняющим комментарием. |
| [docs/RELEASE_PROCESS.md](RELEASE_PROCESS.md) | «`**Версия: X.Y.Z** ...`» (bold) — не соответствует реальной строке UserManual. | Скорректировано на `*Версия документа: X.Y.Z (<месяц год>)*` (italic). |
| [README.md](../README.md) | «Работает полностью в браузере, не требует сервера...» — противоречит секции «Запуск», где сказано про локальный HTTP-сервер. | Уточнено: «не требует backend, БД или внешних сервисов; запуск требует локальный HTTP-сервер для ES-модулей». |

### Метрики

| Метрика | v8.30.6 | v8.30.7 |
|---|---|---|
| Unit | 1138 PASS | 1138 PASS |
| E2E | 190 PASS | 190 PASS |
| Lint | clean | clean |
| audit | 0 | 0 |
| Timestamp в screen UI | **виден (баг)** | **скрыт** |
| Timestamp в print | виден | виден |

---

## Версия: май 2026 (обновление 8.30.6) — Print finalize + Review pass 5: PWA offline, jira XSS, edit estimates, retry bound

Пользовательские запросы по печати + пятый проход независимого ревью с 3 P1 и 2 P2 находками.

### Запросы по печати

| Что | Как |
|---|---|
| Не выводить «Вклад в Priority Score» (`+5,0` и т.п.) на печати | `.criteria-eval-contribution { display: none }` в [print.css](../css/print.css). В UI остаётся, на печати скрыто. |
| Добавить дату-время печати после версии в заголовке | Новый `#printTimestamp` рядом с `#appVersion`. `bindPrintTimestamp()` в [appVersionBadge.js](../js/ui/appVersionBadge.js) слушает `beforeprint` и пишет «(дата печати ДД.ММ.ГГГГ ЧЧ:ММ)». Скрыт в обычном UI (`display: none`), виден только при печати. |

### Review pass 5

| Пункт | Было | Стало |
|---|---|---|
| **P1 PWA offline ломался на CSS/JS с `?v=` query** | `index.html` подключает CSS через `?v=8.30.5`, но precache хранит чистые пути `./css/base.css`. После offline-перехода `caches.match(event.request)` промахивался по `./css/base.css?v=...` → PWA загружалась без стилей и без `app.js`. | [sw.js](../sw.js): `caches.match(event.request, { ignoreSearch: true })` для same-origin. Cache-bust query больше не ломает offline. |
| **P1 jira href XSS из импортированного JSON** | `validateJiraUrl` срабатывала только в форме создания/edit; импорт через File → JSON сохранял `task.jira` как сырую строку. `jira: 'javascript:alert(1)'` рендерился в `<a href="...">` напрямую. | [persistence.js](../js/state/persistence.js): `sanitizeJiraUrl()` фильтр на import-boundary — http/https и relative пропускаются, любая другая схема → пустая строка. Unit-тесты в [persistence.jiraSanitize.test.js](../tests/unit/state/persistence.jiraSanitize.test.js) покрывают javascript:/data:/vbscript:/case-insensitive. |
| **P1/P2 Edit-modal не сохраняет оценки трудозатрат** | `handleSaveEdit()` читал `readCreateTaskEstimates()` в `estimates`, и писал `{ estimates }` в `store.updateTask`. Доменное поле задачи — `task.est` (см. `domain/task.js:42`, `persistence.js:146`). Поле `estimates` сохранялось в state, но при следующем persist'е терялось — `normalizeTasks` читал `est`, а `estimates` молча уходил. | [taskFormController.js](../js/controllers/task/taskFormController.js): `updateTask(id, { est: estimates })` + симметрично в `_onTaskEdited`. Изменения часов через edit modal теперь живут после F5. |
| **P2 `highlightNewTask` мог крутить retry бесконечно** | `setTimeout(doHighlight, 100)` без лимита. Если активный фильтр скрывал созданную задачу, цикл крутился вечно. | [taskList.js](../js/ui/taskList.js): `MAX_HIGHLIGHT_ATTEMPTS = 20` (2 секунды × 100ms). После лимита `lastHandledAddedTaskId = addedTaskId` — отмечаем как обработанный, чтобы render не зашёл сюда снова. |
| **P2 ARCHITECTURE.md устарел** | Line 154: «приоритет 80», «приоритет 90» — старая шкала. Line 421: «186 тестов (v8.29.2)» — устаревший счётчик. | Шкала скорректирована (Priority Score 8,0 / 9,0 → VD 0,80 / 0,225). Счётчики тестов убраны, ссылка на RELEASE_NOTES. Добавлено упоминание `print-verify.spec.js`. |
| **P2 RELEASE_NOTES.md битые относительные ссылки** | 14 ссылок `]( js/`, `]( css/`, `]( tests/` указывали на путь относительно репо-корня, но RELEASE_NOTES.md лежит в `docs/` — github рендерил их как `docs/js/...` → 404. | Bulk fix через perl: `]( js/` → `]( ../js/` и т.д. Все 14 → 52 ссылки с корректным `../`. |

### Метрики

| Метрика | v8.30.5 | v8.30.6 |
|---|---|---|
| Unit-тесты | 1130 PASS | **1138 PASS** (+8: jira sanitize) |
| E2E | 190 PASS | 190 PASS |
| Lint | clean | clean |
| npm audit | 0 vulns | 0 vulns |
| Print: «Вклад» в строке метрик | да | **скрыт** |
| Print заголовок | без timestamp | **с timestamp** «v8.30.6 (дата печати ДД.ММ.ГГГГ ЧЧ:ММ)» |
| PWA offline после v8.30.6 | CSS/JS не загружались с cache-bust query | **полная загрузка** благодаря `ignoreSearch: true` |

### P3 (отложено)

- Tooling dependency refresh: `npm outdated` показывает старые Playwright, ESLint, Babel, axe-core, c8. Требует отдельной задачи с полным прогоном e2e после каждого мажорного апа.
- UserManual.md inline `<style>` блок (60 строк): dead code (DOMPurify strip'ает в in-app, github игнорирует). Удалить безопасно, но требует визуальной верификации.

---

## Версия: май 2026 (обновление 8.30.5) — Code-review pass 4: error UX, sanitize unification, filename guard, docs sync

Четвёртый проход ревью обнаружил 4 неблокирующих, но реальных пропуска + 4 расхождения документации с реализацией.

### Что починено

| Пункт | Было | Стало |
|---|---|---|
| **P2 Импорт JSON ест ошибки молча** | `storageService.loadFile()` rejected с generic Error для 4 разных причин (cancel/timeout/read/parse). `FileController.loadFromFile` ловил всё в одном `catch (_err)` и только скрывал прогресс. Битый JSON → пользователь видит «ничего не произошло». | `loadFile` возвращает Error с `.code: 'cancel'/'timeout'/'read'/'parse'`. Контроллер silent'ит cancel/timeout и показывает `messageService.showMessage('Не удалось загрузить файл: ...')` для real errors. Парсер JSON теперь включает detail сообщение SyntaxError. |
| **P2 HelpController fallback sanitizer слабее общего** | Локальный `_sanitize` удалял только `<script>` и `on*=`. Если DOMPurify не загрузится, в HTML остаются `<iframe>`, `<object>`, `<embed>`, `<link>`, `<meta>`, `javascript:` URL — общий `sanitizeHtml()` в [utils/sanitize.js](../js/utils/sanitize.js) уже умеет всё это блокировать. | `HelpController._sanitize` теперь делегирует в общий `sanitizeHtml()`. Один defense-in-depth путь, fail-closed одинаково везде. |
| **P3 Имя экспортируемого файла без filename-sanitize** | `state.config.product` вставлялся в `download` filename как есть. Символы `/ \ : * ? " < > |` и >255 символов давали странное поведение в Win/macOS/Linux. | `sanitizeForFilename(s)` заменяет запрещённые символы на `_`, обрезает trailing dots/spaces, slice(0, 60). Кейс «product = `../../etc/passwd`» больше не проблема. |
| **P3 Coverage 0% на JSDoc-only `js/types/contracts.js`** | Файл попадал в `collectCoverageFrom`, был typedef-only без исполняемого кода → постоянный 0% портил статистику. | `!js/types/**` добавлено в `jest.config.cjs`. Coverage стал чище. |

### Документация (по жалобе ревьюера на расхождения с кодом)

| Файл | Что | Как |
|---|---|---|
| `docs/UserManual.md` line 116 | Формула Priority Score была `Σ(score × weight) / 100` и диапазон 1..10 | Исправлена на `Σ(score × weight) / Σ(weight)` и диапазон 0..10 (соответствует [domain/criteria.js:17](../js/domain/criteria.js#L17)). |
| `docs/UserManual.md` line 210 | Пример VD: «приоритет 80» (целое число вне диапазона 0..10) | Скорректирован: Priority Score 8,0; VD 0,80. |
| `docs/UserManual.md` lines 495, 565, etc. | Кнопки описывались как «💾 Сохранить», «📂 Загрузить», «🖨️ Печать», «🤖 Отбор задач» | Emoji убраны — описание SVG-иконок и подписей (реальный UI с v8.27). |
| `docs/RELEASE_PROCESS.md` line 35 | «index.html не меняется автоматически» — устарело (с v8.30.2 bump обновляет `manifest.json?v=` в index.html). | Добавлен index.html и UserManual.md в список авто-обновляемых файлов. |
| `docs/ARCHITECTURE.md` lines 241, 408 | Зафиксированы устаревшие счётчики тестов (807/145, 1028/186). | Числа убраны, ссылка на RELEASE_NOTES как source of truth. |
| `docs/CODE_REVIEW_GUIDELINES.md` line 205 | Ссылка на несуществующий `tests/e2e/a11y.spec.js` | Исправлено на реальный `tests/e2e/accessibility.spec.js`. |

### Метрики

| Метрика | v8.30.4 | v8.30.5 |
|---|---|---|
| Unit-тесты | 1130 PASS | 1130 PASS |
| E2E | 190 PASS | 190 PASS |
| Lint | clean | clean |
| npm audit | 0 vulns | 0 vulns |
| Coverage | 94.05% (с шумом от types/) | чище: types/ исключён |

### Что НЕ сделано в этом релизе (документировано)

- **P3 UserManual.md inline `<style>` блок (60 строк):** удалить безопасно (DOMPurify USE_PROFILES html=true в HelpController всё равно strip'ает `<style>` — в in-app help стили не работают; в github-rendering — тоже игнорируются). Но `<div class="user-manual">` обёртка нужна для `.user-manual *` правил в `css/help.css`. Откладываем на отдельный refactor, чтобы не ломать визуально in-app help.

---

## Версия: май 2026 (обновление 8.30.4) — Print A4 hot-fix: flowing inline text

Регрессия v8.30.3 при печати. Я (Claude) верифицировал layout на Playwright-screenshot шириной 1280px и доложил «3 строки на задачу». Реальная A4-печать (~700px эффективной ширины после margin) показала **каждую роль и каждый критерий на отдельной строке** — flex-wrap раскладывал 7 flex-items (label + 5 ролей + Σ) на 7 разных строк, потому что они не помещались в одну. **Корень ошибки — верификация на широком viewport вместо реального A4.**

### Что починено

| Что | Было (v8.30.3) | Стало (v8.30.4) |
|---|---|---|
| Layout строк | `display: inline-flex` + `flex-wrap: wrap` — каждый chip имел собственную ширину и при нехватке места переносился на свою строку. | `display: inline-block` для chip'ов внутри `display: block` контейнера — текст flow'ит как абзац, wrap по словам. Pre-wrap'ed `&nbsp;` между label/value/suffix защищает от разрыва внутри одного chip'а. |
| Ширина `<input>` | `width: 2.4em` фиксированная (или 3.5em — менялась между версиями). | `field-sizing: content` для Chrome 123+ (подгоняет под содержимое) + fallback `width: 2.4em` для остальных. Между значением и «ч» нет лишнего пустого пространства. |
| Высота карточки задачи на A4 | ~12 строк (после регрессии v8.30.3) | **2-3 строки**: оценка трудозатрат укладывается в одну строку, метрики приоритета — в 1-2 строки. |
| Метод верификации | Playwright screenshot на default viewport (1280×720) — НЕ репрезентативно для печати. | Playwright с `viewport: { width: 794, height: 1123 }` (A4 @ 96dpi). Скриншот открывается через Read tool и сравнивается с пользовательским скрином. |

### Метрики

| Метрика | v8.30.3 | v8.30.4 |
|---|---|---|
| Unit-тесты | 1130 PASS | **1130 PASS** |
| E2E | 190 PASS | 190 PASS |
| Lint | clean | clean |
| npm audit | 0 vulns | 0 vulns |
| Print task на A4 | ~12 строк (регрессия) | **2-3 строки** |

### Урок (добавлен в CLAUDE.md)

**Print rendering верифицируется ТОЛЬКО на A4 viewport (794×1123 @ 96dpi).** Screenshot на 1280px показывает «всё хорошо» — пользователь видит реальную регрессию. Третий раз подряд я (Claude) ломаю print: v8.30.1 grid auto-fit смещение, v8.30.3 flex-direction column, v8.30.3 (вторая регрессия) flex-wrap на узкой ширине. Памятка теперь в проектном CLAUDE.md §«Ловушки v8.30.4».

---

## Версия: май 2026 (обновление 8.30.3) — Code-review pass 3: XSS guard, theme private-mode, SW cache-poisoning, jest 30, print compact, UserManual fix

Третий проход ревью + жалоба на печать выявили **6 пропусков** (включая 1 P1 security + 2 P1/P2 reliability) и устаревший раздел UserManual.

### Что починено

| Пункт | Было | Стало |
|---|---|---|
| **P1 XSS в форме создания задачи (impact: critical, vector: импорт JSON с malicious критериями)** | `taskFormController.populateCreateCriteriaSelects()` вставлял `${c.abbreviation}` raw в innerHTML, а `c.name` экранировал только кавычки. Импорт критерия с abbreviation `<img src=x onerror=...>` исполнял JS при открытии формы. | Все три поля (`name`, `abbreviation`, числовые `id`/`weight`) проходят через `escapeHtml()` / `parseInt`. Regression-тест [`tests/unit/controllers/taskFormController.xss.test.js`](../tests/unit/controllers/taskFormController.xss.test.js) подаёт malicious payload и проверяет, что в DOM нет `<img>`/`<script>`-узлов и `window.__xss*` sentinel-переменные не установлены. |
| **P1/P2 Тема ломала старт приложения в Safari private mode** | Head-script в [index.html](../index.html) и `ThemeController.init()` вызывали `localStorage.getItem()` без try/catch. В private/заблокированном Storage Access `getItem` бросает SecurityError ДО загрузки CSS — приложение падало до первого render'а. | Обе точки обёрнуты в try/catch с fallback'ом на `matchMedia('(prefers-color-scheme:dark)')`. Симметрично setItem в `_applyTheme`, который уже был в try/catch с v8.30.2. |
| **P2 SW кэшировал 404/500 (cache-poisoning)** | `sw.js` клал в кэш ЛЮБОЙ ответ из `fetch()` — включая 4xx/5xx и opaque. Временный сбой CDN → пользователь продолжал видеть error-page до ручного сброса кэша. | Добавлен helper `isCacheableResponse(response)` (`response.ok` + `type === 'basic'/'cors'`). Архитектурный инвариант [`tests/unit/architecture/sw-cache-poisoning.test.js`](../tests/unit/architecture/sw-cache-poisoning.test.js) парсит sw.js и проверяет, что каждый `cache.put` обёрнут guard'ом. |
| **P2 jsdom warning «Not implemented: navigation» в storage.test.js** | `storage.saveFile()` создавал реальный `<a>` и вызывал `.click()` — jsdom не реализует navigation, поэтому при каждом прогоне теста выводился console.error. | `HTMLAnchorElement.prototype.click` мокается на уровне prototype в обоих тестах `saveFile`. Console чист. |
| **P3 Tooling drift: jest 29.7 vs jest-environment-jsdom 30.2** | Major-mismatch в Jest-стеке: DEP0205 warning, риск API-расхождений. | Весь стек (jest, babel-jest, jest-environment-jsdom) выровнен на 30.x. Deprecated alias `toBeCalled*` заменён на `toHaveBeenCalled*` в `tests/unit/utils/debounce.test.js`. `npm audit` остался clean. |
| **Print rendering: огромная высота строки задачи (жалоба пользователя)** | v8.30.2 положил роли и критерии каждый на отдельную строку — задача с 5 ролями + 4 критериями занимала ~12 строк. Пользователь: «почему нельзя как в списке задач — с минимальным размером высоты?». | Переписано на inline-flex: все ролевые оценки в одну строку с `Σ EFFORT` в конце, все критерии в одну строку с `PRIORITY SCORE` в конце. Карточка задачи стала **3 строки** (заголовок + оценки + метрики) вместо 12. Корневая причина высоты — `flex-direction: column` в base CSS `.criteria-eval-item`; в print явно сбрасывается в `row !important`. Верификация: screenshot прогнан через Playwright + Read tool, layout проверен глазами. |
| **UserManual.md устаревший текст про emoji-иконку** | Раздел «Исключение задачи» описывал переключение иконки на 🙈 (закрытый глаз), хотя реальный UI использует Lucide SVG `eye` / `eye-off` (v8.27+). Кнопка «Удалить всё» описана как «🗑️ Удалить всё» — реально SVG trash. | Оба раздела обновлены: упоминания emoji удалены, описана динамика SVG-иконки и dynamic tooltip с причиной исключения от алгоритма автоотбора. |

### Метрики до/после

| Метрика | Было (v8.30.2) | Стало (v8.30.3) |
|---|---|---|
| Unit-тесты | 1125 PASS | **1130 PASS** (+5: XSS regression x2, SW cache invariant x3) |
| E2E | 190 PASS | **190 PASS** |
| ESLint | clean | clean |
| npm audit | 0 vulnerabilities | **0 vulnerabilities** |
| Jest stack | 29.7 + jsdom 30.2 (mismatch) | **30.4 + 30.4 (aligned)** |
| Print task card высота | ~12 строк/задача | **3 строки/задача** |

---

## Версия: май 2026 (обновление 8.30.2) — Code-review pass 2: PWA precache, persist completeness, scale-toggle keyboard, manifest cache-bust + print layout regression-fix

Второй проход независимого ревью обнаружил **5 пропусков** моего self-audit'а
после v8.30.0 — те же классы ошибок, которые v8.30.0 чинил в одних местах,
но я не сделал grep на родственные. Плюс **визуальная регрессия** v8.30.1
print rendering (числа смещались на колонку вправо относительно labels).

### Что починено

| Пункт | Было | Стало |
|---|---|---|
| **P1.1 PWA precache неполный** | `css/toolbar.css` и `css/config-panel.css` подключены в `index.html`, но отсутствовали в `ASSETS_TO_CACHE` в `sw.js`. Offline-режим загружался без верхней панели и панели конфигурации спринта. | Добавлены в precache. Новый архитектурный инвариант [`tests/unit/architecture/precache-coverage.test.js`](../tests/unit/architecture/precache-coverage.test.js) парсит `<link rel="stylesheet">` из index.html и сверяет с `ASSETS_TO_CACHE`. |
| **P1.2 Silent persist в numberFormat** | `numberFormat.saveSettings()` делал `localStorage.setItem` БЕЗ try/catch — при QuotaExceededError/SecurityError приложение крашилось на autosave. Это саботировало мой же v8.30.0 fix П.5 (storage status), потому что `App.saveToLS` вызывал `nfs.saveSettings()` ПОСЛЕ `storageService.save()`. | `saveSettings()` возвращает `{ok, error}` (тот же контракт что storage.save). `App.saveToLS` проверяет оба результата, snackbar показывается при любом fail'е. Новый архитектурный инвариант [`persist-must-have-try-catch.test.js`](../tests/unit/architecture/persist-must-have-try-catch.test.js) ловит этот класс регрессий во всех services. |
| **P2.1 scale-toggle не работает с клавиатуры** | `<div class="scale-toggle" role="button" tabindex="0">` с только-click handler — Enter/Space нативно не работали. Тот же a11y-баг что `.criteria-item-header` в v8.30.0 (П.1), но я пропустил scale-toggle в audit'е. | Переведён на native `<button type="button" aria-expanded aria-controls>`. Native button сам обрабатывает Enter/Space. Reset CSS + `:focus-visible` outline. |
| **P2.2 manifest cache-bust устарел** | `index.html: manifest.json?v=8.29.6` после bump'ов до 8.30.0/8.30.1 — установленные PWA продолжали читать старый manifest. | `scripts/bump-version.mjs` теперь обновляет `?v=` в index.html синхронно. Тест в `pwa-icons.test.js` усилен: проверяет совпадение версии с `package.json`, не только формат. |
| **P3 Inline-styles в HelpController + TaskFormController** | Loading/error states и create-criteria grid имели множественные `style="..."` атрибуты. Мешало строгому CSP и противоречило design-system правилу. | Перенесены в [css/help.css](../css/help.css) (`.help-loading-state`, `.help-error-state`) и [css/create-task-modal.css](../css/create-task-modal.css) (`.create-criteria-empty`, `.create-criteria-grid`, `.create-criteria-label`, `.create-criteria-weight-badge`). Number of columns остаётся через CSS-property `--n` (единственное оправданное runtime-значение). |

### Print rendering hot-fix (регрессия v8.30.1)

В v8.30.1 я использовал `grid auto-fit` + `display:contents` на `.est-box-header` —
это давало визуальное смещение: input первого бокса вылезал в начало следующей
grid-cell. Пользователь видел `UI/UX:   CA:1 ч   0,FE:   5,BE:   2,QA:   3,0 ч`
вместо нормальной разбивки.

Переписано на **блочный layout**: каждая роль и каждый критерий на отдельной
строке, никаких grid-cell сюрпризов. Input получил фиксированную ширину `3.5em`
вместо browser default ~173px.

### Урок (зафиксирован в проектную память Claude)

Когда фиксишь определённый класс ошибки в одном месте (например, `role="button"`
на div без keyboard, или silent `localStorage.setItem`), **обязательно grep'нуть
проект по этому же паттерну** до того, как объявить self-audit пройденным. В
v8.30.0 я починил 2 случая (nested-interactive header + storage.save) и
пропустил 2 родственных (scale-toggle + numberFormat) — ревьюер нашёл их за 30
минут. Новый feedback-файл в memory + усиление skill `review` §2.

### Метрики

- unit-тесты: 1093 → **1105** (+12, включая 3 архитектурных инварианта).
- e2e: 186 → **190** (+4 print-verify, сохранены с v8.30.1).
- lint: clean.
- npm audit: 0 vulnerabilities.

---

## Версия: май 2026 (обновление 8.30.1) — Print rendering: детальные оценки трудозатрат и метрики приоритета

**Hot-fix регрессии печати.** В v8.29.x и ранее CSS-правило `@media print`
скрывало `.est-box:not(.est-box-total)` и `.criteria-eval-item` одним
`display: none` — на распечатке оставались только итоговое effort и
priority score, без разбивки по ролям и без оценок по каждому критерию.

### Что изменилось в 8.30.1

- **[css/print.css](../css/print.css)** — снято скрытие ролевых est-боксов
  и criteria-eval-item; добавлены печатные стили для читаемого layout
  (grid auto-fit, inputs без рамок как plain text, скрыты только бары и
  stepper-кнопки).
- **На распечатке теперь видно:**
  - Каждую роль: UI/UX: 5 ч, CA: 3 ч, FE: 8 ч, BE: 2 ч, QA: 4 ч.
  - Σ Effort (итог).
  - Каждый критерий: abbreviation + weight + оценка (0–10) + contribution.
  - Priority Score (итог).
- **Скрыты на печати:** progress-бары (`.est-box-bar`, `.criteria-eval-bar`),
  +/- кнопки stepper'а, иконки ролей, mobile-only abbreviation, overload-placeholder.
- **[tests/e2e/print-verify.spec.js](../tests/e2e/print-verify.spec.js)** —
  новый файл с 4 e2e-тестами через `emulateMedia('print')`. Защищает
  инвариант от регрессий.

### Регрессии и совместимость

- Только CSS-изменения, runtime-логика не затронута.
- После обновления — **Ctrl+Shift+R** для перезагрузки CSS.

---

## Версия: май 2026 (обновление 8.30.0) — Code-review pass: a11y, security audit, persist correctness

Большой системный pass по отчёту независимого code-review (8 пунктов).
Все правки сопровождены тестами; общий счёт unit-тестов: 1074 → **1093**
(+19 тестов с учётом удалённого Enter/Space-on-div теста — он больше не нужен,
native button сам обрабатывает клавиатуру), e2e nested-interactive должен теперь
проходить axe-core, `npm audit` — **0 vulnerabilities**, coverage gate починен.

### Что изменилось

| # | Категория | Что было | Что стало |
|---|-----------|----------|-----------|
| 1 | A11y (axe-core nested-interactive) | `.criteria-item-header` имел `role="button"` + `tabindex="0"`, внутри лежали focusable `input` (вес) и две `<button>` (edit/delete) — нарушение WCAG 4.1.2 | Toggle вынесен в отдельный `<button class="criteria-item-toggle-btn">`; grip, weight-input и actions — siblings, не children. Native `<button>` обрабатывает Enter/Space без отдельного keydown-listener'а. |
| 2 | Security (npm audit) | 6 vulnerabilities (4 high, 2 moderate). `dompurify ^3.3.1` — уязвимая версия в `devDependencies`. Vendored runtime `js/vendor/purify.min.js@3.4.2` — уже не уязвим, но npm-зависимость держала старый pin. | `dompurify` поднят до `^3.4.4` + `npm audit fix` для transitive babel/picomatch/brace-expansion → **0 vulnerabilities**. |
| 3 | Render correctness | Progressive rendering после первых 20 задач шёл батчами через `requestIdleCallback`, **без cancel-токена** — старый callback от предыдущего рендера дозаливал stale-карточки в уже очищенный новый DOM при быстрой смене state. | Введён module-level `renderGeneration` counter. Каждый `renderTaskList()` инкрементирует поколение; pending callback'и проверяют совпадение и абортятся, если их рендер устарел. |
| 4 | Coverage gate | `npm run test:coverage` падал на отсутствующем `js/vendor/purify.min.js.map` (sourceMap comment без `.map`-файла рядом). | `jest.config.cjs.collectCoverageFrom` исключает `!js/vendor/**`. Coverage proходит, 1106/1106 тестов. |
| 5 | Persist UX | `storageService.save()` глотал `QuotaExceededError` / `SecurityError` без сигнала — пользователь думал, что данные сохранены, а после F5 терял всю работу. | `save()` возвращает `{ok, error}`. `App.saveToLS()` при `!ok` показывает throttled snackbar (раз в 30 сек) с инструкцией скачать JSON. |
| 6 | Import correctness | `normalizeTasks` использовал `Date.now()` как default для невалидных `id` — синхронный `map()` укладывался в <1ms, и несколько битых задач получали ОДИН и ТОТ ЖЕ id. `Store.updateTask()` потом промахивался при правке. Та же проблема — в `normalizeCriteria` с default `id=0`. | Unified `createIdAllocator()` + `collectValidIds()`. Аллокатор стартует с `max(existingIds, minBase)+1` и инкрементируется; все импортированные id гарантированно уникальны и не конфликтуют с уже валидными. |
| 7 | Контракт density | `'cozy'` density был удалён из UI в v8.27, но `VALID_DENSITIES = ['compact','comfortable','cozy']` оставался в `Store.setDensity`, `DensityController`, `taskList.js`, `persistence.js` + CSS-блок `#taskList[data-density="cozy"]` + legacy clamp в `app.js`. | Везде `['compact','comfortable']`. Сохранённый `'cozy'` мигрируется в `'comfortable'` через `normalizeUi`. CSS-блок и иконка `densityCozy` удалены. |
| 8 | CSP-readiness | `index.html:61` имел inline `onclick="window.print()"` — блокировка строгого `script-src 'self'`. `selectionRecommendations.js` рендерил эмодзи 📌 💡 🔍 (нарушение «эмодзи в UI запрещены» из CLAUDE.md), плюс множественные inline `style="..."`. `js/ui/utils.js` затирал SVG-иконку таба «Критерии оценки» эмодзи ⚖️. | `printBtn` подключён через `KeyboardController.init()`. Эмодзи заменены на SVG (новые иконки `pin`, `lightbulb`; `search` для алгоритмов). Inline-styles перенесены в `selection-report.css`, `task-card.css`, `criteria.css`. `escapeHtml()` добавлен в `buildRecCardHtml` (XSS-защита user-input `rec.message` / `rec.suggestion`). |

### Дополнительно (сопутствующая чистка)

- `densityCozy` иконка удалена из `icons.js` (dead code после v8.27).
- `app.js` legacy-clamp `if (ui.density === 'cozy')` удалён — теперь миграция выполняется на уровне `persistence.normalizeUi`.
- Удалён keydown-listener в `CriteriaController` (был для имитации button-поведения на role=button div — теперь не нужен, native `<button>` сам обрабатывает Enter/Space).
- Layer hygiene audit: `js/domain/` не содержит DOM-API (clean), нет `eval` / `new Function` / `setTimeout(string)`, нет `console.log` / `debugger` / `TODO` / `FIXME`-меток в production-коде.

### Архитектурный hardening

- Новый паттерн «generation token» для прогрессивного рендеринга — применим везде, где async-batches могут пережить state change. Контракт: `let renderGeneration = 0;` в module scope, инкремент в начале render, abort-check в каждом async-callback.
- `storageService.save()` теперь имеет explicit `{ok, error}` контракт. При добавлении новых persist-точек — следовать тому же паттерну (никаких silent-fail при критичных операциях).

### Возможные регрессии (для ручной проверки)

- Криteria header — после обновления **Ctrl+Shift+R** (новый DOM-layout). Если пользователь имеет старую expand-state, она восстановится через `data-expanded` snapshot.
- `localStorage`, в котором лежал `ui.density === 'cozy'`, автоматически нормализуется в `'comfortable'` при первой загрузке.

---

## Версия: май 2026 (обновление 8.29.6) — PWA desktop icon: документация OneDrive Folder Backup

**Только документация.** В коде PLANNER изменений нет — иконки и PNG-инфраструктура остаются от 8.29.5.

Жалоба пользователя «иконка PWA пустая на рабочем столе» после v8.29.5 оказалась
вызвана **не кодом приложения**, а конфликтом **OneDrive Folder Backup ↔
Windows shell**. Реальная диагностика (PowerShell + System.Drawing + извлечение
bitmap'ов из `.ico`):

- Chrome корректно собрал `.ico` со всеми 13 размерами (8 — 256 px, все bpp=32,
  все содержат нашу иконку).
- `chrome://apps` отображает иконку корректно.
- `.ico` лежит на месте: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Web
  Applications\_crx_<app-id>\Sprint Planner.ico` (159632 bytes).
- `.lnk` на рабочем столе имеет правильный `IconLocation` на этот `.ico`.
- **Но** Windows shell для `.lnk` в OneDrive-синхронизируемой папке (Desktop
  переадресован в `C:\Users\<user>\OneDrive\Рабочий стол\`) **не подгружает
  кастомный `IconLocation`** и отрисовывает дефолтную иконку документа.
- Тест-подтверждение: тот же `.lnk` в `%APPDATA%\Microsoft\Windows\Start
  Menu\Programs\` (НЕ OneDrive) → иконка отрисовалась. В `~\Documents\` (тоже
  OneDrive backup у пользователя) → дефолт.

Это **известный конфликт OneDrive** с custom-icons `.lnk` в синхронизируемых
папках. **Не баг PNG, не баг manifest, не баг Service Worker'а.** Никакая
правка кода PLANNER не решит эту проблему — нужно изменение на стороне
Windows / OneDrive у пользователя.

### Что изменилось в 8.29.6

- **[docs/UserManual.md](../docs/UserManual.md)** → раздел «Установка как
  приложение (PWA)»: добавлен расширенный troubleshooting блок про OneDrive
  Folder Backup. Объяснён симптом, признаки (путь Desktop через OneDrive),
  3 обходных пути:
  - **A.** Закрепить PWA на панели задач (через меню «Пуск» — оно не в
    OneDrive). Самый практичный, ничего не ломает.
  - **B.** Закрепить на начальном экране (плитки Пуска).
  - **C.** Отключить OneDrive Folder Backup для Desktop/Documents (Settings →
    OneDrive → Manage backup → uncheck Desktop). Радикально, но возвращает
    локальный рабочий стол.
- **[CLAUDE.md](../CLAUDE.md)** → раздел «PWA-иконки» дополнен пунктом 10:
  при жалобе «пустая иконка PWA» **сначала проверить chrome://apps и `.ico` в
  `_crx_<app-id>` folder**. Если там иконка корректная — проблема НЕ в коде,
  а в OneDrive sync, и решается на стороне пользователя.
- **`~/.claude/projects/<planner-hash>/memory/feedback_pwa_icon_onedrive_block.md`** —
  урок сохранён в проектную память, чтобы будущие сессии Claude не начинали
  опять переписывать PNG, когда симптом окажется у нового пользователя с
  OneDrive backup.

### Что НЕ изменилось

- Иконки PNG/SVG, manifest.json, sw.js, generate-pwa-icons.mjs, тесты
  pwa-icons.test.js — всё от 8.29.5, работают корректно.
- Только bump версии (`package.json`, `js/version.js`, `sw.js CACHE_VERSION
  → sp-v8.29.6-onedrive-docs`, `manifest.json?v=8.29.6` в index.html) +
  синхронный апдейт «Версия документа» в UserManual.

### Эффект для пользователя

- Если у тебя иконка PWA пустая на рабочем столе **и** твой Desktop
  переадресован в OneDrive — теперь UserManual чётко объясняет почему и как
  обойти. Самый быстрый путь: Pin to Taskbar.
- Если Desktop НЕ в OneDrive — иконка от 8.29.5 уже работает.

### Метрики

- Tests: 1074/1074 (без изменений).

---

## Версия: май 2026 (обновление 8.29.5) — PWA desktop icon fix (продолжение) — opaque PNG

**Регрессия v8.29.4:** после фикса PNG primary иконка на desktop у пользователя
всё равно осталась пустой плиткой. Корень — найден через прямую проверку
байтов PNG (System.Drawing.GetPixel): primary `icon-192.png` и `icon-512.png`
имели `Format32bppArgb` с **alpha=0 в углах**. Причины две, в связке:

1. **SVG-исходник содержал `<rect width="512" height="512" rx="64">`** —
   rounded corners на самой иконке делали 4 угла прозрачными.
2. **`omitBackground: true` в `scripts/generate-pwa-icons.mjs`** — Playwright
   сохранял прозрачный фон вокруг скруглений.

Windows при создании desktop-shortcut'а растеризует иконку в bitmap.
Если в PNG есть прозрачные пиксели, ярлык на тёмном фоне рабочего стола
выглядит как пустая или почти пустая плитка — ОС не подкладывает свой фон
под существующую альфу. В Chrome DevTools → Application → Manifest такая
иконка выглядит нормально, потому что превью рендерится с фоном страницы.

### Что изменилось

- **SVG-исходники без `rx`** ([icons/icon-512.svg](../icons/icon-512.svg),
  [icons/icon-192.svg](../icons/icon-192.svg)): убран `rx="64"` с внешнего
  `<rect>`. Теперь это square с фоном `#0f172a` до самого края. ОС/браузер
  сами накладывают rounded-маску для shortcut'а по правилам платформы.
  Maskable SVG уже был square — не менялся.
- **PNG-генератор**
  ([scripts/generate-pwa-icons.mjs](../scripts/generate-pwa-icons.mjs)):
  `omitBackground: false` + `body { background: #0f172a }` гарантирует
  отсутствие прозрачности. Все 3 PNG теперь **Format24bppRgb** (без
  альфа-канала вообще — невозможно сделать прозрачным).
- **Архитектурный тест** усилен
  ([tests/unit/architecture/pwa-icons.test.js](../tests/unit/architecture/pwa-icons.test.js)):
  для каждой PNG проверяется PNG color type (byte 25 в IHDR) — должен
  быть 0/2/3 (без альфа-канала), не 4/6 (с альфой). Этот тест ловит ровно
  ту регрессию v8.29.4: если кто-то снова поставит `omitBackground:true`
  или добавит `rx` в исходник → color type станет 6 (RGBA) → тест падает.
- **manifest cache-bust** ([index.html:40](../index.html#L40)):
  `manifest.json?v=8.29.5`.
- **SW** ([sw.js:5](../sw.js#L5)): `CACHE_VERSION =
  'sp-v8.29.5-pwa-icons-opaque'`.

### Почему так

**Принцип:** PWA-иконка с `purpose: any` должна быть **полностью
непрозрачным square** с фоном до краёв. ОС сама делает rounded mask
для ярлыка по правилам платформы (Windows tile, macOS squircle,
Android adaptive). Если иконка уже содержит свои rounded corners и
прозрачность, ОС не «исправляет» это — она просто рисует поверх
рабочего стола с прозрачными углами, выглядит пустым.

`purpose: maskable` — другая история: фон ОБЯЗАН быть до краёв, потому
что маска ОС обрежет внешние 20% по своим правилам. Полезный контент в
центральных 60-80%. Maskable-иконка тоже непрозрачна.

### Эффект для пользователя

- Свежая установка PWA на Chrome/Edge desktop → видимая иконка с
  карточкой и галочкой.
- **Уже установленная PWA 8.29.4 или раньше — требует переустановки**,
  потому что Windows кэширует `.ico` ярлыка отдельно от browser-cache
  и не перерисует его автоматически даже после обновления manifest'а:

  ```
  1. Закрыть приложение, если открыто.
  2. Удалить ярлык с рабочего стола / Start Menu / taskbar вручную.
  3. chrome://apps → правый клик на Sprint Planner → «Удалить из Chrome».
  4. DevTools → Application → Storage → «Clear site data».
  5. Открыть приложение заново → «Установить».
  ```

### Метрики

- Unit: 1071 → **1074** (+3 проверки color type в каждой PNG).
- E2E: без изменений.

---

## Версия: май 2026 (обновление 8.29.4) — PWA desktop icon fix (PNG primary)

**Фикс по жалобе пользователя:** после установки приложения как PWA на
рабочий стол (Windows / macOS) иконка ярлыка отображалась пустой или
почти пустой плиткой. Корень — в `manifest.json` лежали только
SVG-иконки с `<text>SP</text>`, а Chromium при создании
desktop-shortcut'а растеризует иконку через offscreen-renderer, который
не подгружает системные шрифты → текст не отрисовывался, на выходе
получался пустой bitmap.

### Что изменилось

- **PNG-иконки primary в manifest** ([manifest.json](../manifest.json)):
  - `icons/icon-192.png` (192×192, `purpose: any`).
  - `icons/icon-512.png` (512×512, `purpose: any`).
  - `icons/icon-maskable-512.png` (512×512, `purpose: maskable`,
    safe-zone в центральных 64% — маска ОС обрезает фон, не контент).
  - SVG оставлены после PNG как fallback с `purpose: any` (без
    слитного `any maskable`, который ломал отрисовку).
- **SVG-иконки переписаны без `<text>`** ([icons/icon-512.svg](../icons/icon-512.svg),
  [icons/icon-192.svg](../icons/icon-192.svg),
  [icons/icon-maskable-512.svg](../icons/icon-maskable-512.svg)):
  - Старый `<text x="256" y="340">SP</text>` заменён на vector paths
    (карточка + точки статусов + галочка). Тот же визуальный мотив, что
    у favicon в [index.html:9](../index.html#L9), но в виде чистой
    геометрии без зависимости от системных шрифтов.
- **`apple-touch-icon` → PNG** ([index.html:42](../index.html#L42)):
  Safari/iOS игнорирует SVG для apple-touch-icon. Теперь
  `icons/icon-192.png`.
- **Cache-busting manifest-ссылки** ([index.html:40](../index.html#L40)):
  `<link rel="manifest" href="manifest.json?v=8.29.4">` — заставляет
  уже установленные PWA перечитать manifest и забрать новые иконки.
- **SW precache PNG** ([sw.js](../sw.js)):
  все три PNG плюс новые maskable-SVG добавлены в `ASSETS_TO_CACHE`.
  `CACHE_VERSION` поднят до `sp-v8.29.4-pwa-icons-png` — старые
  установки получат свежий cache при следующем визите.
- **Генератор иконок** ([scripts/generate-pwa-icons.mjs](../scripts/generate-pwa-icons.mjs)):
  Node-скрипт, растеризующий SVG → PNG через Playwright Chromium
  (уже в devDependencies, новые зависимости не появились). Запускается
  вручную при изменении SVG-исходников (`node scripts/generate-pwa-icons.mjs`).
  Обычный пользователь скрипт не запускает — готовые PNG лежат в репо.
- **Архитектурный тест** ([tests/unit/architecture/pwa-icons.test.js](../tests/unit/architecture/pwa-icons.test.js)):
  25 проверок — PNG в manifest, raздельные `purpose`, apple-touch-icon →
  `.png`, manifest cache-bust, PNG в SW-precache, PNG-signature валидна,
  SVG без `<text>`. Защищает от регрессии при будущих правках.

### Эффект для пользователя

- После установки PWA на desktop / Start Menu / Dock иконка приложения
  отображается корректно (карточка задачи с галочкой), не пустой.
- Уже установленные пользователи получат новую иконку после первого
  открытия приложения (SW обновится, manifest перечитается через
  cache-bust query).
- Для гарантированного обновления при сильно залипшем кэше: удалить
  установленную PWA → очистить site data → установить заново.

### Hard-reload note

После pull / обновления:
- `Ctrl+Shift+R` (или `Cmd+Shift+R` на macOS).
- Если ранее устанавливали PWA — DevTools → Application → Service
  Workers → **Unregister**, затем reload. Можно также воспользоваться
  `dev-tools/_clear-sw.html`.

### Метрики

- Unit: 1043 → **1068** (+25 архитектурных проверок).
- E2E: без изменений.
- Зависимости: без изменений (Playwright уже был в devDeps).
- Новые файлы: `icons/icon-192.png`, `icons/icon-512.png`,
  `icons/icon-maskable-512.png`, `icons/icon-maskable-512.svg`,
  `scripts/generate-pwa-icons.mjs`,
  `tests/unit/architecture/pwa-icons.test.js`.

---

## Версия: май 2026 (обновление 8.29.3) — PWA portable paths + offline help + version display

**Фикс по аудиту пользователя:** приложение не запускалось как PWA, если
развернуто в подпапке (например `github.io/<repo>/`), и заявление «работает
без интернета» противоречило ленивой загрузке `marked`/`DOMPurify` с CDN.

### Что изменилось

- **Относительные пути PWA** ([index.html](../index.html#L685),
  [manifest.json](../manifest.json), [sw.js](../sw.js)):
  - `navigator.serviceWorker.register('./sw.js', { scope: './' })` —
    раньше `'/sw.js'` ломался под `/<repo>/`.
  - `manifest.json`: `"start_url": "./index.html"` + `"scope": "./"`.
  - `sw.js`: весь `ASSETS_TO_CACHE` переведён на `./...`.
  - Теперь один код одинаково работает в корне домена, в подпапке
    GitHub Pages и через локальный `start-server`.
- **Локальный vendor для справки** ([js/vendor/](../js/vendor/),
  [helpController.js](../js/controllers/helpController.js)):
  - `marked@15.0.12` (39 KB) и `DOMPurify@3.4.2` (24 KB) лежат в
    `js/vendor/`, попадают в SW-кэш при install.
  - `helpController` грузит `./js/vendor/marked.min.js` и
    `./js/vendor/purify.min.js` вместо `cdn.jsdelivr.net`.
  - Справка теперь работает офлайн с первого открытия, без supply-chain
    рисков и breaking-change'й latest-pointer'а.
- **Номер версии в UI** ([index.html](../index.html#L51),
  [js/version.js](../js/version.js),
  [js/ui/appVersionBadge.js](../js/ui/appVersionBadge.js)):
  - Версия показывается мутным бейджем рядом с h1 в шапке.
  - Источник истины — `APP_VERSION` в `js/version.js`. Дублируется в
    `package.json` и `sw.js`; синхронность гарантирована тестом
    [tests/unit/version.test.js](../tests/unit/version.test.js).
- **Процесс bump'а** ([scripts/bump-version.mjs](../scripts/bump-version.mjs),
  [docs/RELEASE_PROCESS.md](RELEASE_PROCESS.md)):
  - `npm run bump -- 8.30.0 my-slug` — синхронно обновляет 3 файла.
  - Регрессионный тест
    [tests/unit/scripts/bumpVersion.test.js](../tests/unit/scripts/bumpVersion.test.js)
    ловит ситуацию, когда regex скрипта перестаёт матчить (например,
    после рефакторинга строки версии).

### Эффект для пользователя

- PWA можно деплоить в любую подпапку GitHub Pages без правки кода.
- «Интернет не требуется» в README — теперь действительно правда.
- В шапке видно текущую версию (полезно при поддержке и багрепортах).
- Обновление версии — одной командой, без риска забыть про
  `sw.js`/`package.json`.

### Метрики

- Unit-тесты: 1028 → 1043 (PASS). +15 новых на версионность.
- ESLint: clean (js/vendor/ добавлен в ignores).
- Размер репозитория: +64 KB (vendor marked + DOMPurify).

---

## Версия: май 2026 (обновление 8.29.2) — Recommendations dedupe by type

**Фикс по жалобе пользователя на дубли в «Рекомендации по оптимизации
спринта».** В блоке «Общие рекомендации» три одинаковых сообщения
«Общая загрузка команды низкая (60.7%/66.4%/65.7%)» от трёх алгоритмов
(Matrix, Value Density, Hybrid) показывались тремя отдельными карточками.

### Что изменилось

- `getOptimizationRecommendations` ([analysis.js](../js/domain/selection/analysis.js))
  теперь добавляет сырое поле `percentage: <number>` ко всем `team-*`
  рекомендациям (`team-underload`, `team-overload`, `team-optimal`) —
  чтобы UI мог группировать дубли по `type` и склеивать проценты.
- В [selectionRecommendations.js](../js/ui/selectionRecommendations.js)
  старый dedup по `message` (ломался из-за разных процентов в строке)
  заменён на новый helper `aggregateGeneralRecommendations()`:
  - Группировка по `rec.type`
  - Если несколько алгоритмов дали один тип — собирает все `percentage`
    в массив, заменяет одиночное `(NN.N%)` в исходном сообщении на
    диапазон `(min%–max%)`.
  - Если все проценты одинаковые — диапазон не строится, оставляется
    одно значение.
  - Разные типы (`team-underload` + `team-overload`) обрабатываются
    независимо, не схлопываются.
- Helper экспортирован отдельно — для unit-тестируемости.

### Эффект для пользователя

До: три карточки подряд
- «Общая загрузка команды низкая (60.7%). Рекомендуется добавить больше задач.»
- «Общая загрузка команды низкая (66.4%). Рекомендуется добавить больше задач.»
- «Общая загрузка команды низкая (65.7%). Рекомендуется добавить больше задач.»

После: одна карточка
- «Общая загрузка команды низкая (60.7%–66.4%). Рекомендуется добавить больше задач.»

### Тесты

- **+8 unit-тестов** (3 в `buildRecommendationsHtml` + 5 в новом
  `aggregateGeneralRecommendations`):
  - Склеивание процентов в диапазон при разных значениях
  - Без склеивания при одинаковых процентах
  - Разные types НЕ склеиваются
  - Severity / suggestion / type сохраняются после склеивания
  - Graceful fallback на recs без поля `percentage`
- **1028 unit PASS** (было 1020). Lint clean.

### Service Worker

- `CACHE_VERSION` → `sp-v8.29.2-recommendations-dedupe`.
  Hard-reload (Ctrl+Shift+R) или `/dev-tools/_clear-sw.html`.

### Изменённые файлы

| Файл | Что |
|------|-----|
| `js/domain/selection/analysis.js` | + `percentage` в team-* recs |
| `js/ui/selectionRecommendations.js` | + `aggregateGeneralRecommendations()` (экспорт), dedup по type вместо message |
| `tests/unit/ui/selectionRecommendations.test.js` | +8 тестов |
| `sw.js` | `CACHE_VERSION` bump |

---

## Версия: май 2026 (обновление 8.29.1) — Quadrants excluded-section

**Re-fix к багу из v8.29: исключённые задачи в Quadrants view.** Первая
попытка (партиция «исключённые в конец своего квадранта») не соответствовала
UX-ожиданию пользователя. По уточнению — исключённая задача должна уйти
**в самый низ списка**, а не оставаться в Q1/Q2 рядом с приоритетными
активными задачами.

### Что изменилось

- `assignQuadrants()` теперь возвращает 5 групп: `q1`, `q2`, `q3`, `q4`,
  **`excluded`**. Q1..Q4 содержат ТОЛЬКО не-исключённые задачи. Все
  исключённые задачи (независимо от priority/effort) — в отдельной
  группе `excluded`, отсортированы по priority desc.
- **Медиана priority/effort** теперь считается ТОЛЬКО по не-исключённым
  задачам. До правки outlier'ы в excluded (старые задачи с высоким
  priority) перекашивали классификацию активных — приоритеты «прыгали»
  между квадрантами при каждом исключении.
- В UI (`taskListGrouped.js`) добавлена 5-я секция «Исключённые из спринта»
  под Q4. Иконка — `eyeOff`, заголовок и иконка приглушены через
  `--text-muted` (не `--accent` как у Q1..Q4) — визуальный отрыв от
  активного контента. Отступ `margin-top: 16px` от Q4. Секция не
  показывается, если ни одной исключённой задачи нет.
- **Persist**: ключ `'excluded'` добавлен в `VALID_QUADRANT_KEYS` (store
  + persistence). Свернёте/раскроете секцию — переживёт F5 наряду с Q1..Q4.
- **Кнопка exclude** в карточке задачи: визуальный flow не изменился —
  `taskListHandler.handleToggleExclude` по-прежнему делает opacity-fade
  300ms + `setTasks(fixTaskOrder(...))`. В **List view** задача после
  exclude уезжает в конец массива (как и раньше). В **Quadrants view**
  следующий рендер автоматически перенесёт её в новую секцию `excluded`.

### Тесты

- **+6 unit-тестов** в `quadrants.test.js`:
  - excluded в отдельной группе (single + multiple tasks)
  - медиана считается без excluded
  - `stats.excluded` корректный
  - пустая группа excluded когда нет excluded
  - все задачи excluded → q1..q4 пусты
- **2 теста в `persistence.test.js`** обновлены под новый дефолт
  `expandedQuadrants` (5 ключей вместо 4).
- **1020 unit PASS** (было 1018). 186 e2e PASS (без изменений).
- Lint clean.

### Service Worker

- `CACHE_VERSION` → `sp-v8.29.1-quadrants-excluded-section`.
  Hard-reload (Ctrl+Shift+R) или `/dev-tools/_clear-sw.html`.

### Изменённые файлы

| Файл | Что |
|------|-----|
| `js/domain/selection/quadrants.js` | + `QUADRANT_KEYS_WITH_EXCLUDED`; `assignQuadrants` выносит excluded в отдельную группу + считает медиану по non-excluded |
| `js/ui/taskListGrouped.js` | + рендер 5-й секции `excluded`; пропуск секции если она пуста |
| `js/state/store.js` | `VALID_QUADRANT_KEYS` += `'excluded'` |
| `js/state/persistence.js` | то же — для миграции localStorage |
| `css/task-card.css` | + `.quadrant-group--excluded` (приглушённый заголовок, отступ от Q4) |
| `tests/unit/domain/selection/quadrants.test.js` | старые v8.29 тесты «excluded в конце квадранта» заменены на «excluded в отдельной группе» |
| `tests/unit/state/persistence.test.js` | дефолт `expandedQuadrants` обновлён до 5 ключей |
| `sw.js` | `CACHE_VERSION` bump |

---

## Версия: май 2026 (обновление 8.29) — Criteria management redesign + 2 UX fixes

**Большой UX-проход по разделу «Критерии оценки» + два мелких фикса по
жалобам.** Все правки внутри существующей дизайн-системы (без новых
BEM-параллелей или дублирующих токен-файлов — урок v8.28).

### 1) Управление критериями — полный редизайн

- **Sticky-bar** с pill «Сумма весов: 100%» / «Осталось распределить: N%» /
  «Превышение на N%» — три цветовых состояния (success / warning / danger),
  всегда видна на скролле. Дублирование top+bottom total убрано.
- **Кнопка «Авто-баланс»** в sticky-bar появляется, когда сумма ≠ 100.
  Распределяет веса к 100% методом наибольших остатков (целочисленные
  значения, точная сумма): пропорционально для ненулевых, равномерно для
  нулевых. Confirm перед применением.
- **Карточки критериев collapsed-by-default** — header всегда видим,
  body (rationale + scale) раскрывается кликом. Aria-controls + Enter/Space
  работают через клавиатуру.
- **Inline-редактирование веса**: `<input type="number">` в header'е каждого
  критерия. `input` событие → instant-обновление sum-pill (без commit).
  `change` (blur/Enter) → commit в Store. Tab между inputs не теряет фокус
  (snapshot/restore через `data-focus-key`).
- **Hover-actions**: edit (pencil SVG) и delete (trash SVG) скрыты по
  `opacity:0`, появляются на hover/focus-within. Тише визуальный шум —
  паттерн v8.14 task-row hover-only-actions.
- **Drag-and-drop reorder**: grip-handle (gripVertical SVG) слева, mousedown
  на нём включает `draggable="true"` на родителе. Drop меняет порядок через
  новый `criteriaManager.reorderCriteria(orderedIds)`. Защита от потери
  данных: метод возвращает false, если orderedIds не покрывает все ID.
- **Эмодзи → SVG**: ✎ → `pencil`, 🗑 → `trash`, добавлены SVG для grip,
  rotate, check, alert. Соответствует проектному правилу (no emoji in UI).
- **Удалены 7×`!important`** из `.criteria-rationale` (анти-паттерн из
  старой версии — overrode `display:none` в legacy-патче, более не нужны).

#### Domain (criteriaManager.js)

- + `updateCriteriaWeight(id, weight)` — лёгкое обновление только веса
  (clamp 0..100, round). Используется inline-редактором.
- + `autoBalance()` — приведение к сумме 100 с целочисленными весами
  (largest-remainder method для распределения остатков).
- + `reorderCriteria(orderedIds)` — переупорядочивание с защитой от
  потери критериев.

### 2) Team Capacity Dashboard — фикс дублирования единиц

Жалоба: «у тебя в виджете Загрузка команды информация о единицах расчета
дублируется как для FTE, так и для Отпуск: ты выводишь "%" и "д", как для
названия поля, так и в самом поле».

- Удалён suffix `<span class="team-cap__card-control-suffix">%</span>` после
  input'а FTE.
- Удалён suffix `<span class="team-cap__card-control-suffix">д</span>`
  после input'а Отпуск.
- Единицы остаются в label'ах сверху pill: «FTE %» и «Отпуск (д)».

### 3) Quadrants view — исключённые задачи теперь в конце квадранта

Жалоба: «в режиме Квадранты приоритета исключённая из спринта задача не
перемещается в конец списка».

До фикса: `assignQuadrants()` сортировал tasks внутри каждого квадранта
только по `priorityScore ↓`, игнорируя `excluded`. Высокоприоритетная
исключённая задача торчала вверху квадранта, выше включённых с меньшим
приоритетом.

- В `js/domain/selection/quadrants.js` после сортировки по priority внутри
  каждого квадранта добавлена партиция: included → excluded. Внутри обеих
  секций сохраняется priority-порядок.
- Изменение изолировано в `assignQuadrants` (используется только UI-режимом
  Quadrants). Алгоритмы Matrix/Hybrid/Value Density используют
  `selectTasksUniform`, который уже исключает excluded из выбора — на них
  правка не влияет.

### Тесты

- **1018 unit PASS** (было 972 в v8.28.1 → +46 новых):
  - 16 на `criteriaManager` (autoBalance × 5, updateCriteriaWeight × 5,
    reorderCriteria × 3, регрессии × 3)
  - 17 на `criteriaList` (sticky bar, sum pill states × 3, inline weight,
    collapsed body × 2, SVG icons, hover-actions, drag handle, helpers ×6,
    XSS guard, no bottom-total)
  - 10 на `criteriaController` (inline weight delegation × 4, auto-balance × 2,
    expand toggle × 3, drag-and-drop × 3)
  - 3 на `quadrants` (excluded-last в одном квадранте, несколько excluded,
    only-excluded quadrant)
- **186 e2e PASS** — без изменений (DOM IDs сохранены, e2e-зависимости целы).
- Lint clean.

### Service Worker

- `CACHE_VERSION` → `sp-v8.29-criteria-management-redesign`.
  Hard-reload (Ctrl+Shift+R) или `/dev-tools/_clear-sw.html`.

### Изменённые файлы

| Файл | Что |
|------|-----|
| `js/ui/criteriaList.js` | Полная перезапись: sticky-bar, inline weight, collapsed body, SVG icons, focus-key snapshot/restore |
| `js/controllers/criteriaController.js` | + делегации: input/change weight, click auto-balance, click/keyboard expand, mousedown→drag, dragstart/over/leave/drop reorder |
| `js/domain/criteriaManager.js` | + updateCriteriaWeight + autoBalance + reorderCriteria |
| `js/domain/selection/quadrants.js` | excluded-last sort внутри каждого квадранта |
| `js/ui/teamCapacity.js` | удалён `team-cap__card-control-suffix` для FTE и Отпуск |
| `css/criteria.css` | sticky-bar, sum-pill 3 состояния, inline weight input, hover-actions, collapsed body, drag states; убраны 7×!important |
| `tests/unit/domain/criteriaManager.test.js` | +16 |
| `tests/unit/ui/criteriaList.test.js` | переписан под новый DOM (+17) |
| `tests/unit/controllers/criteriaController.test.js` | +10 на новые делегации |
| `tests/unit/domain/selection/quadrants.test.js` | +3 на partition excluded |
| `sw.js` | CACHE_VERSION bump |

### Out of scope (отдельные задачи)

- Quadrants view на тёмной теме — пока не аудировал, может содержать схожие
  с v8.28.1 проблемы избыточного контраста.
- Модалка `#editCriteriaModal` (открывается edit-кнопкой) сохранила старый
  layout. Inline-редактирование веса покрывает 80% случаев правки, но
  rationale/scale всё ещё через модалку.

---

## Версия: май 2026 (обновление 8.28.1) — Hints + contrast pass

**Дополнение к v8.28 — UX-полировка модалки сравнения алгоритмов.**
Добавлены детальные подсказки на каждый параметр и снижен зрительный
контраст ярких акцентов на тёмной теме.

### Хинты «что это и зачем»

- **Каждая метрика в карточках алгоритмов** (Выбрано задач, Загрузка,
  Сумм. Effort, Сумм. Priority Score, Ср. плотность) получила
  `title="..."` с пояснением: что измеряется + как интерпретировать
  значение. Hover на любой строке метрики на десктопе, long-press на
  сенсорных устройствах. Тексты — в новой экспортной константе
  [`METRIC_HINTS`](../js/ui/selectionReport.js).
- **Бейджи в featured-баннере «Рекомендация»** (4 шт.) — те же тексты,
  чтобы при наведении на сжатый бейдж пользователь видел ту же
  расшифровку, что и в развёрнутой карточке ниже.
- **Заголовки аккордеонов** «Об алгоритмах отбора» и «Детализация
  по…» (3 шт.) получили хинты с описанием, что внутри и зачем
  раскрывать.

### Снижение контраста (тёмная тема)

- **Featured-карточка**: цвет заголовка изменён с `var(--accent)`
  (яркий cyan #00d9ff) на `var(--text)` — акцентный цвет несёт только
  иконка слева. Раньше cyan title + cyan icon + cyan border + cyan glow
  создавали «cyan-перенасыщение».
- **Карточка рекомендованного алгоритма**: убрана внутренняя обводка
  `0 0 0 1px var(--accent)` из `box-shadow` — оставлены только
  `border-color: var(--accent)` и мягкое внешнее свечение
  `var(--accent-shadow)`. До правки получалась «двойная линия» обводки.
- **Прогресс-бары метрик** (`.metric-bar__fill`): `opacity: 0.7` для
  всех вариантов (default cyan, success/warning/danger). Полосы стали
  читаемыми, но перестали резать глаза при просмотре нескольких
  карточек одновременно. На `:hover` строки метрики полоса временно
  возвращается к 100% opacity — interactive feedback.
- `prefers-reduced-motion` отключает opacity-transition.

### Тесты

- **+6 unit-тестов** в `tests/unit/ui/selectionReport.test.js`:
  блок `METRIC_HINTS` (экспорт со всеми 5 ключами + длина каждого
  хинта > 40 символов с interpretation-guidance) + блок tooltips
  (наличие `title=` на каждом `.algo-card-metric`, на каждом badge
  featured-карточки, на каждом `.accordion-header`, корректный
  HTML-escape атрибутов).
- **972 unit PASS** (было 966 в v8.28).
- 186 e2e PASS — без изменений.
- Lint clean.

### Service Worker

- `CACHE_VERSION` → `sp-v8.28.1-hints-and-contrast-fix`. Hard-reload
  (Ctrl+Shift+R) или открыть `/dev-tools/_clear-sw.html`.

### Изменённые файлы

| Файл | Что |
|------|-----|
| `js/ui/selectionReport.js` | + экспорт `METRIC_HINTS` + `SECTION_HINTS` + `algoDetailHint()`; `title=` на metric-rows, badges, accordion headers |
| `css/selection-report.css` | featured-title color → text; убран double-ring у recommended; metric-bar opacity 0.7 + hover→1 + prefers-reduced-motion |
| `tests/unit/ui/selectionReport.test.js` | + 5 тестов hint-coverage |
| `sw.js` | `CACHE_VERSION` bump |

---

## Версия: май 2026 (обновление 8.28) — Selection report UI redesign

**Полный UI-редизайн модалки «Сравнение алгоритмов автоматического отбора»**
с приведением к общей дизайн-системе приложения, без введения параллельного
BEM-слоя поверх существующих компонентных классов.

### Главное

- **Featured-баннер «Рекомендация»** в шапке отчёта. Подсвечивает лучший
  алгоритм (новый helper `pickRecommendedAlgorithm()`: максимум суммарного
  Priority Score среди алгоритмов с загрузкой ≤ 100%, тай-брейки —
  близость к 100% и плотность ценности).
- **Таблица сравнения → 3 карточки** (`.rec-card.rec-card--algo`).
  Каждая карточка показывает: название (+ SVG-иконка алгоритма),
  «Рекомендовано» — бейдж на лучшей, 5 метрик с компактным
  `.metric-bar` (загрузка цветится через `success/warning/danger` от
  процента, остальные — нормированы относительно лучшего значения).
- **Динамическая primary-подсветка** apply-кнопки рекомендованного
  алгоритма (`.export-btn.primary`), остальные — нейтральные ghost.
  IDs кнопок (`applyMatrixBtn`, `applyValueDensityBtn`, `applyHybridBtn`)
  сохранены — e2e-зависимости не сломаны.
- **Эмодзи (📘 📊 📈 📉 📌 ❌ 📋) → inline-SVG** из существующего набора
  `js/utils/icons.js` (`bookOpen`, `quadrant1`–`quadrant4`, `alertCircle`,
  `clipboardList`, `check`, `layoutGrid`, `gauge`, `scale`).
  Соответствует проектному правилу «эмодзи в UI запрещены».
- **Inline-`style="..."` (~30 мест в `selectionReport.js`) → классы**
  в `css/selection-report.css`. Все цвета — через `var(--token)`,
  обе темы (warm sandy / dark espresso) работают без дополнительных правок.

### Безопасность (XSS fix)

- Все user-derived строки (`task.title`, `task.reason`, `algorithmName`)
  теперь проходят через `escapeHtml()`. Старый код использовал
  `${task.title}` напрямую — латентная XSS-дыра, если в заголовок задачи
  попадал HTML.
- Регрессионный тест: `<img src=x onerror=alert(1)>` в title оказывается
  в DOM как `&lt;img...&gt;`, не как тег.

### Архитектурная очистка

- **Удалён дублирующий делегированный обработчик аккордеонов**
  из `selectionController.js`. Клик по `.accordion-header` обрабатывался
  одновременно локальным listener'ом (внутри render) и делегированным
  на модалке — двойной toggle через bubble. Теперь listener живёт там же,
  где создаётся DOM. Покрытие переехало в `tests/unit/ui/selectionReport.test.js`.
- **`pickRecommendedAlgorithm()`** вынесен в `selectionHelpers.js` рядом
  с `buildComparisonDisplayData` и `computeComparisonBestValues` — это
  чистая бизнес-логика, не UI.

### Адаптивность

- `@media (max-width: 720px)`: `.algo-cards-grid` и `.algo-info-grid`
  сворачиваются в одну колонку (стандартный паттерн приложения).

### Тесты

- **+11 unit-тестов**, минус 1 устаревший = **966 unit PASS** (было 955).
  Новые: 6 на `pickRecommendedAlgorithm` (порядок выбора, тай-брейки,
  поведение при перегрузе всех алгоритмов), 5 на render
  (featured-баннер, `rec-card--recommended` маркер, primary-подсветка
  apply-кнопки, XSS-эскейп, отсутствие эмодзи в выводе).
- **186 e2e PASS** — без изменений (apply-кнопки сохранили IDs).
- Lint clean.

### Service Worker

- `CACHE_VERSION` бамплен на `sp-v8.28-selection-report-redesign`. После
  обновления коллегам — Ctrl+Shift+R или открыть `/dev-tools/_clear-sw.html`.

### Изменённые файлы

| Файл | Что |
|------|-----|
| `js/ui/selectionReport.js` | Полная перезапись: featured-card + 3 algo-card вместо таблицы; SVG-иконки; `escapeHtml`; нет inline-стилей |
| `js/controllers/selection/selectionHelpers.js` | + `pickRecommendedAlgorithm()` |
| `js/controllers/selectionController.js` | − делегированный accordion-toggle (дублирование с in-render listener) |
| `css/selection-report.css` | + `.rec-card--featured/--algo/--recommended`, `.algo-cards-grid`, `.algo-card-metric`, `.metric-bar`, `.algo-info-card`, `.algo-detail-*` |
| `tests/unit/ui/selectionReport.test.js` | Покрытие нового DOM + XSS + no-emoji регрессии |
| `tests/unit/controllers/selection/selectionHelpers.test.js` | + 6 тестов на `pickRecommendedAlgorithm` |
| `tests/unit/controllers/selectionController.test.js` | − accordion test (логика переехала в render) |
| `sw.js` | `CACHE_VERSION` bump |

### Out of scope

- Модалка `#recommendationsModal` (открывается кнопкой «Рекомендации»
  из основного отчёта) — пока сохраняет старую раскладку и эмодзи 📌🔍.
  Будет отдельной задачей: применить те же принципы (классы вместо
  inline-стилей, SVG-иконки, escapeHtml).

---

## Версия: май 2026 (обновление 8.27.2) — Criteria evaluation redesign

**Полный UX-редизайн блока «Оценка по критериям» в карточке задачи.**
`<select>` 0-10 заменён на stepper [−] N [+] с клавиатурным spinbutton-фокусом;
введён цветовой уровень (zero/low/mid/high) с warm-sandy палитрой; добавлен
contribution bar и pulse-анимация Priority Score при изменении.

### Главное

- **Stepper вместо `<select>`**. Один клик — ±1, без открытия dropdown.
  Кнопки `−` / `+` авто-disabled на границах (0 и 10). Spinbutton-обёртка
  фокусируется по Tab; ↑/→/PgUp = +1, ↓/←/PgDn = −1, Home = 0, End = 10.
- **Цветовой уровень score** — атрибут `data-score-level` на пилюле:
  `zero` (muted), `low` (1-3, тёплая охра warning), `mid` (4-7, фирменный
  accent), `high` (8-10, насыщенная терракота print). Цвет растекается на
  абревиатуру, число, бар и контрибьюшн-чип.
- **Contribution bar** под stepper'ом — ширина = `(score / 10) × 100%`,
  цвет — `var(--eval-accent)`, плавное `transition: width 0.3s ease,
  background-color 0.3s ease`.
- **Contribution chip** в шапке (`+N.N`) — мгновенно показывает вклад
  критерия в Priority Score (формула `score × weight / 10`).
- **Weight-бейдж** отделён от score визуально — теперь это статичный chip
  с серым фоном `--overlay-faint`, не конкурирует со значением оценки.
- **Pulse-анимация Priority Score** — при изменении любого score
  значение `.priority-score-value` получает класс
  `.priority-score-value--pulsed` на 350мс (transform scale 1.12 +
  text-shadow с accent-glow). Под `prefers-reduced-motion` отключается.

### Доступность (WCAG 2.1 AA)

- `role="spinbutton"` на корне stepper'а с `aria-valuemin/max/now/label`.
- Touch-устройства (`pointer: coarse`): кнопки ±1 увеличиваются до 32×32.
- Polyfilled `prefers-reduced-motion`: все transition обнуляются.
- `:focus-visible` на stepper и кнопках — отчётливый ring через
  `box-shadow` без `outline: none`.

### Сохранение фокуса при re-render

- Введён `restoreStepperFocus()` в `renderTaskList()`: snapshot текущего
  фокусированного stepper'а (по `data-id::data-criterion-id`) до
  `replaceChildren`, восстановление после render. Без этого подряд нажатия
  `↑/↓` теряли фокус после первого изменения (Store→render сбрасывал
  активный узел).

### Контракт событий

- `<select>` change-event заменён на click/keydown через `event.target.closest(...)`.
- В контроллере новый helper `_dispatchCriteriaScore(stepper, score)` строит
  fake-event и переиспользует существующий `taskListHandler.handleCriteriaScoreChange()`.
  Бизнес-логика (`store.updateTask` + `cache.invalidate`) без изменений.

### Density mode

- В Compact density carded-stepper остаётся, contribution bar и chip
  скрываются — экономим вертикаль.
- В Comfortable density полный layout: stepper + bar + contribution chip.

### Out of scope (отдельная задача)

- Создание задачи (`#createTaskModal`) и create modal в edit-mode всё ещё
  используют `<select>` 0-10 — там пользователь проводит секунды, ROI ниже.
  Будет отдельным PR при востребованности.

### Тесты

- **+5 unit-тестов** на новый render: stepper-структура, `data-score-level`,
  contribution chip, disabled-состояния `[−]`/`[+]` на границах.
  Всего **955 unit PASS** (было 950).
- **+3 e2e-теста** на интерактив: click `[+]` инкрементит aria-valuenow,
  `[−]` disabled при score=0, ArrowUp/End/Home через клавиатуру.
  **186 e2e PASS** (было 184).
- Lint clean.

---

## Версия: май 2026 (обновление 8.27.1) — Tech-debt sweep & code-review baseline

**Полная очистка технического долга и фиксация стандартов ревью.** Аудит
64 JS- и 22 CSS-файлов выполнен в два прохода: ① безопасные правки и dead-code
sweep; ② синхронизация e2e-suite c v8.25/v8.27 DOM-рефакторами + фикс
WCAG-нарушений. После двух проходов: lint clean, 949 unit PASS, **183 e2e PASS**
(было 143/40-fail до начала работы).

### Удалено

- **`js/ui/domUtils.js`** + соответствующий unit-тест — 0 импортеров в продакшене,
  его `escapeHtml()` дублирует `js/utils/escapeHtml.js` (5 импортеров).
  Прочие хелперы (`createElement`, `addClass`, `removeClass`, `setHTML`, `append`)
  — однострочные обёртки над DOM API без вызовов.
- **`export const CONTRACTS = {}`** в `js/types/contracts.js` — пустой
  объект-сентинел, оставленный после миграции на JSDoc-typedef. Файл сохраняется
  ради `@typedef`-импортов (`store.js` ссылается на `AppState`).
- **`/js/ui/domUtils.js`** убран из precache-листа `sw.js`, `CACHE_VERSION`
  бамплен на `sp-v8.27.1-cleanup-deadcode`.

### Починено

- **9 ESLint warnings → 0.** Удалены unused imports в `taskController.js`
  (`messageService`, `fixTaskOrder`), `domain/task.js` (`initializeCriteriaEvaluations`).
  Catch-переменные `(err)` без использования переименованы в `(_err)`. Unused
  args в `criteriaList.js` / `taskList.js` / `teamCapacity.js` приведены к
  префиксу `_`.
- **ESLint-конфиг** обновлён: `caughtErrors: 'all'` + `caughtErrorsIgnorePattern: '^_'`
  — теперь паттерн «префикс `_` = осознанно неиспользуемая» работает и для
  `catch (_err)`, и для function-args.
- **Jest-конфиг** получил `testPathIgnorePatterns: ['/\\.claude/']` —
  worktree-копии от subagent-а больше не сканируются. До этого 18 test suites
  «падали» из-за syntax-mismatch'а в worktree-копиях, не относящихся к
  исходникам.

### Документация

- Создан **`docs/CODE_REVIEW_GUIDELINES.md`** (12 разделов, ~400 строк):
  стандарты нейминга, требования к JS/CSS/HTML, тестирование, безопасность,
  persist-правила, SW-гигиена, pre-commit чек-лист на 13 пунктов и список из
  15 анти-паттернов.
- README.md дополнен ссылкой на новый документ.
- `docs/ARCHITECTURE.md` — убраны упоминания удалённого `domUtils.js`.

### Удалены 6 dead `.role-*` CSS-классов (второй проход)

- `.res-grid-header`, `.role-res-row`, `.role-total-row`, `.role-load-numbers`,
  `.role-name-cell`, `.role-inline-stats`, `.role-input-cell`,
  `.role-total-numbers`, `.role-total-numbers-row`, `.role-total-numbers--bold`,
  `.progress-bg--spaced`, `.res-grid-header--inputs` — реликты старого roleList,
  заменённого на `team-cap__card` в Stream A v8.21. Очищены пять CSS-файлов
  ([css/components.css](../css/components.css), [css/forms.css](../css/forms.css),
  [css/layout.css](../css/layout.css), [css/responsive.css](../css/responsive.css),
  [css/print.css](../css/print.css), [css/a11y.css](../css/a11y.css),
  [css/capacity-strip.css](../css/capacity-strip.css)).
- BC-fallback в [js/controllers/roleController.js](../js/controllers/roleController.js)
  удалён (`getElementById('capacityStrip') || getElementById('roleList')` →
  `getElementById('capacityStrip')`). Юнит-тест [tests/unit/controllers/roleController.test.js](../tests/unit/controllers/roleController.test.js)
  обновлён на новый fixture.

### Возвращён View toggle в toolbar

- [js/app.js:111-118](../js/app.js#L111-L118) явно сбрасывал
  `state.ui.viewMode` к `'list'` при старте — защитный clamp от UI-orphan'а,
  потому что после v8.25 toolbar refactor кнопок в DOM не было. Это убивало
  персистентность viewMode при F5 (даже когда пользователь явно выбирал
  «Квадранты»).
- Восстановлена пара кнопок `#viewModeListBtn` / `#viewModeQuadrantsBtn` в
  [index.html](../index.html) toolbar; CSS уже существовал
  ([css/task-card.css:1023+](../css/task-card.css#L1023)). Clamp снят. Density
  «cozy» по-прежнему клампится — DOM поддерживает только `compact/comfortable`.

### Фикс WCAG color-contrast (axe-core, 5 нарушений → 0)

- `.matrix-total[data-type="bug|tech"]` percent-цифра — введены усиленные
  токены `--bug-color-strong`, `--tech-color-strong` для **обеих** тем
  ([css/base.css](../css/base.css)), используются только в `.matrix-total*`.
  Контраст с фоном `.total-row` теперь ≥ 4.5:1 (было 2.85–4.26).
- `.matrix-total__value` (часы) — переключён на `--text-muted-strong` (4.5+:1
  на `.total-row`, было 4.3–4.4).
- `.cf-section-hint` в create-modal — убран `opacity: 0.8`, который занижал
  эффективный контраст до 3.38:1.

### Синхронизирован e2e-suite с v8.25/v8.27 DOM (40 fail → 0)

- **`createTask` helper** в [tests/e2e/planner.spec.js](../tests/e2e/planner.spec.js)
  — `selectOption('#newType', type)` → `click('.cf-seg-btn[data-type="..."]')`
  (v8.27 unified form: type стал segmented `<button role="radio">`, не `<select>`).
  Чинит 18 тестов.
- **#roleList → #capacityStrip** в `planner.spec.js:62` и двух тестах
  `theme.spec.js`.
- **Density toggle**: тест на 3 кнопки `compact/comfortable/cozy` обновлён до
  2 (`compact/comfortable`), отдельный «cozy click» переписан на двунаправленный
  `compact ↔ comfortable`.
- **View toggle (Stream C)**: 13 тестов теперь проходят, т.к. кнопки вернулись
  в toolbar и persistence не клампится.
- **Capacity Strip total**: `.cap-strip__total` → `.team-cap__header` (Stream A
  v8.21 переименование).
- **Capacity Strip preview**: hover-preview был убран в v8.21 (flicker), остался
  только drag-preview. Тесты на hover переписаны на симуляцию `dragstart`/
  `dragend` через `el.dispatchEvent(new DragEvent(...))`.
- **Edit task modal**: 7 тестов, ожидавшие отдельный `#editModal`/`#editTitle`
  / `#saveTaskEditBtn` etc. Переключены на unified `#createTaskModal` /
  `#newTitle` / `#saveCreateBtn` (v8.27 commit `fad43ff` слил create+edit).
- **Persist таймер**: добавлены `waitForTimeout(400)` перед reload в тестах,
  где persist дебаунс 200мс мог не успеть.

### Тесты после двух проходов

- **Lint:** 0 errors / 0 warnings ✓
- **Unit:** 949 / 949 PASS (64 test suites) ✓
- **E2E:** **183 / 183 PASS** ✓ (Playwright + axe-core, 1.3 min, fully parallel)

---

## Версия: май 2026 (обновление 8.22) — Task Card Redesign

Премиум-дизайн карточки задачи с тремя логическими блоками + компактный
1-row layout. Карточка теперь занимает ~120px высоты вместо ~500px (4×
компактнее), сохраняя ту же информационную плотность.

### Структура карточки

1. **Header**: drag-handle • # позиции • dot типа • статус-badge
   (В работе / Исключена) • тип-badge (Bug / User Story / Tech) •
   приоритет-badge (Критический / Высокий / Средний / Низкий) •
   JIRA-ссылка • title • action-buttons (hover-only).
2. **Estimates**: section label «Оценка трудозатрат» inline → 5 чипов
   ролей (иконка + label + input + suffix «ч») → Σ Effort badge.
3. **Metrics**: section label «Метрики приоритета» inline → 4 critеria
   pills (abbr + ×weight + select + value) → Priority Score badge с
   цветовой кодировкой по уровню (critical/high/medium/low).

### Sandy palette

Никакого чистого `#FFFFFF` — все элементы в тёплых песочных/кремовых тонах
(`--bg-card #faf6ec`, `--bg-main #ede4ce`, `--button-bg #e7dcc4`). Контраст
в обеих темах ≥ 4.5:1 (WCAG 2.1 AA).

### Багфиксы

- **Реверс цифр в FTE/Отпуск (v8.22.2)** — после re-render Team Capacity
  курсор уходил в начало input'а и следующий keystroke вставлялся ПЕРЕД
  введёнными цифрами («12» → «21»). Корень: `<input type="number">` не
  поддерживает `setSelectionRange`. Фикс: type="text" inputmode="numeric"
  + явный fallback курсора на `value.length` при невалидном
  `selectionStart`.
- **Service Worker отдавал старые ассеты после bump CACHE_VERSION** —
  install использовал HTTP-cache. Фикс: `Request(url, {cache:'reload'})`
  в `cache.addAll()`.
- **Legacy CSS перекрывал новый task-card.css** — правила из `layout.css`,
  `components.css`, `responsive.css` ставили `flex-direction:column` и
  `max-width:55px` на `.est-box`. Удалены — task-card.css теперь
  единственный источник правды.

### Реорганизация структуры проекта

- `docs/` — пользовательская и техническая документация
  (`UserManual.md`, `ARCHITECTURE.md`, `RELEASE_NOTES.md`).
- `dev-tools/` — `_clear-sw.html` (утилита сброса SW).
- Корень — только entry-points, конфиги и обзорная документация
  (README, CLAUDE.md, HANDOFF.md).

### Файлы

- `js/ui/createTaskRowVM.js` — добавлены `getPriorityLevel`,
  `getPriorityLabel`, `typeLabel`.
- `js/ui/taskList.js` — переписаны `buildEstimatesHtml`, `buildCriteriaHtml`,
  `createTaskElement` под 3-block структуру.
- `js/ui/teamCapacity.js` — focus-preservation через re-render +
  type=text для off-input.
- `css/task-card.css` — полный переписанный визуал.
- `css/layout.css`, `css/components.css`, `css/responsive.css` — удалены
  legacy `.est-box` правила.

---

## Версия: май 2026 (обновление 8.21) — Team Capacity Dashboard

Премиум-карточки ролей вместо двух дублирующих блоков (Capacity Strip +
role-list table). Header с общей загрузкой (gauge SVG) + 5 карточек ролей
с иконками, прогресс-bar, FTE/Отпуск-инпутами в одном виджете.

### Изменения

- **Заменён** двойной блок (горизонтальная strip из v8.14 + role-list
  table) на **единый Team Capacity Dashboard** из 5 карточек ролей.
- **Каждая карточка**: иконка роли (palette/search/code/server/shield) +
  процент загрузки + bar + numbers + FTE/Отпуск inputs.
- **Header**: общая загрузка команды + gauge SVG (semi-circular,
  заполняется по проценту) + numbers (used / available ч).
- **Sandy palette везде** — никаких `#FFFFFF` даже в overload stripes
  (используется `rgba(45, 36, 25, 0.25)` тёмно-коричневый).
- **5 карточек в одну строку** на десктопе (`grid-template-columns:
  repeat(5, minmax(0, 1fr))`), 1 колонка на mobile.
- **Stacked inputs**: label сверху, input + suffix внутри pill (`grid:
  1fr auto`) — input всегда получает свободное место, цифра видна даже
  на узких карточках 110px.

### Багфиксы итераций (v8.21.1 → v8.21.4)

- v8.21.1: aggressive cache-bust через `?v=` queries для всех ESM/CSS.
- v8.21.2: layout overflow fixed (% перенесён на отдельную строку);
  убран pure-white в overload stripes.
- v8.21.3: 5 карточек в одну строку (`repeat(5, minmax(0, 1fr))`).
- v8.21.4: inputs стали читаемыми — label НАД pill (stacked layout),
  input full-width внутри pill через `grid: 1fr auto`.

---

## Версия: май 2026 (обновление 8.14) — Sprint Board Redesign

Большой UX/UI редизайн, выполненный в 4 параллельных потоках. Цель — превратить
интерфейс из «стены текста с метриками сверху» в **сканируемый, контекстно-
чувствительный** sprint board: метрики capacity теперь отвечают на ховер
по задаче, типы задач кодируются точкой а не толстой полосой, появилась
группировка по приоритетным квадрантам, а светлая тема стала тёплой
(песочной) вместо холодного офисного бело-голубого.

---

### Поток A — Capacity Strip + Drag-preview
- **Заменён блок «Загрузка команды»** (5 progress-bar + numbers row)
  на единую горизонтальную **Capacity Strip** из 5 сегментов по ролям
  (UI/UX, CA, FE, BE, QA). Цвет сегмента кодирует уровень нагрузки:
  `success` (≤80%), `warning` (80-100%), `danger` (>100%).
- **Hover задачи** подсвечивает соответствующие сегменты strip'а
  и показывает дельту нагрузки (+8% FE и т.п.) — больше не нужно
  смотреть на 800px вверх, чтобы понять «как эта задача повлияет
  на capacity».
- **Drag-preview** — strip обновляется в реальном времени во время
  перетаскивания задачи между статусами (включить/исключить).
- **Overload pulse** проигрывается **один цикл**
  (`animation-iteration-count: 1`), не отвлекая постоянно.
  `prefers-reduced-motion` отключает анимацию полностью.
- **Новые модули:** `js/ui/capacityStrip.js`,
  `js/controllers/capacityStripController.js`,
  `js/domain/role.js: simulateLoadDelta()/getRoleLoadLevel()`,
  `css/capacity-strip.css`.

### Поток B — Task Row Refactor + Density toggle
- **Density toggle** (Compact / Comfortable / Cozy) в шапке списка
  задач. Default = **Comfortable** (backward-compatible). Compact mode
  умещает >2× больше задач на тот же экран (42px против 108px высоты
  строки). Persist через `state.ui.density` + localStorage — F5 не
  сбрасывает выбор.
- **VM-слой** `createTaskRowVM(task, criteria, capacityByRole)` —
  отделяет данные от рендера, упрощает тестирование density-вариантов.
- **Type-индикатор**: убран `border-left: 6px`, заменён на dot 8px
  (`.task-type-dot`). Освобождено 6px ширины каждой строки и убран
  один из 4 источников типа задачи (border + dot + bg + indicator).
- **Hover-only actions**: edit/delete/exclude скрыты по умолчанию
  (`opacity: 0`), показываются на `:hover` или `:focus-within`
  (для клавиатурной навигации). Минус визуальный шум на 90% времени.
- **Inline-collapsing критериев**: компактный chip + раскрытие
  на `:focus-within` или клику.
- **Сжатие role-cells**: top-3 chip с ненулевой нагрузкой + tooltip
  «+N» для остальных. Не показывать пустые ячейки.
- **Новые модули:** `js/ui/createTaskRowVM.js`,
  `js/controllers/densityController.js`, `tests/_helpers/source.js`
  (helpers для regex по CSS/JS source — `stripCssComments`/`ruleBody`).

### Поток C — Quadrant Grouping View
- **Toggle `[List | Quadrants]`** в шапке списка задач, default = **List**
  (backward-compatible). Persist через `state.ui.viewMode`.
- **Quadrants режим** группирует задачи по приоритетным квадрантам:
  Q1 «лёгкие победы» (high-impact / low-effort), Q2 «стратегические»,
  Q3 «заполнители», Q4 «откладывать» (low-impact / high-effort).
- **Sticky group headers** показывают inline-summary
  (`12 задач · 84ч · 38% capacity`) при scroll'е.
- **Сворачивание квадранта** через `<details>`; persist через
  `state.ui.expandedQuadrants` — F5 не сбрасывает collapsed-состояние.
- **Иконки квадрантов** — inline-SVG (молния/мишень/галочка/часы),
  никаких эмодзи.
- **Новые модули:** `js/domain/selection/quadrants.js: assignQuadrants()`,
  `js/ui/taskListGrouped.js`, `js/controllers/viewModeController.js`.

### Поток D — Песочная светлая тема (без белого)
- **Светлая тема переведена на тёплую песочную палитру.** Холодный сине-серый
  фон `#f1f5f9` и чисто-белые карточки `#ffffff` заменены на «sandy»-тон:
  `#ede4ce` (фон), `#faf6ec` (карточки), `#2d2419` (текст-шоколад). В палитре
  больше нет ни одного чисто-белого `#ffffff` как самостоятельного значения —
  это исключает «офисное» холодное впечатление.

### Изменённые токены `[data-theme="light"]`
| Токен | Было | Стало | Контраст к bg-main |
|---|:---:|:---:|:---:|
| `--bg-main` | `#f1f5f9` | `#ede4ce` | — |
| `--bg-card` | `#ffffff` | `#faf6ec` | — |
| `--text` | `#0f172a` | `#2d2419` | 12.04:1 |
| `--text-muted` | `#475569` | `#6b5b47` | 5.16:1 |
| `--accent` | `#0369a1` | `#03568a` | 6.14:1 |
| `--accent-text` | `#ffffff` | `#fdfaf2` | 7.45:1 vs accent |
| `--accent-hover` | `#075985` | `#024976` | — |
| `--button-bg` | `#e2e8f0` | `#e7dcc4` | — |
| `--button-hover` | `#cbd5e1` | `#d9cdb6` | — |
| `--border` | `#cbd5e1` | `#c9b896` | — (декоративный) |
| `--border-light` | `#94a3b8` | `#8a7858` | 3.38:1 |
| `--success` | `#0f766e` | `#0d6258` | 5.71:1 |
| `--warning` | `#d97706` | `#955100` | 4.80:1 |
| `--print` | `#c2410c` | `#9a3408` | 5.78:1 |
| `--bug-color` | `#dc2626` | `#b91c1c` | 5.11:1 |
| `--us-color` | `#0f766e` | `#0d6258` | 5.71:1 |
| `--priority-score-color` | `#0369a1` | `#03568a` | 6.14:1 |

Полупрозрачные `--accent-bg-faint/subtle/light/medium` пересчитаны на тёплые
песочные fill'ы (старые холодные `#f0f9ff`/`#e0f2fe` смотрелись «грязно» на
песке). Серии `--overlay-*`, `--shadow-*`, `--scale-item-*` переведены на
коричневый базовый тон `rgba(45, 36, 25, X)` вместо `rgba(0, 0, 0, X)` —
тинты теперь сочетаются с песочным фоном.

### Acceptance — WCAG 2.1 AA
Все ключевые пары проверены `axe-core` и runtime-тестом (10 контраст-кейсов
в `theme.spec.js`):
- text/bg-main 12.04:1, text/bg-card 14.12:1
- text-muted/bg-main 5.16:1, /bg-card 6.06:1
- accent/bg-main 6.14:1 (с запасом на overlay-light effective `#e5dcc7` — 5.70:1)
- accent-text/accent 7.45:1
- danger/success/warning/tech на bg-main ≥ 4.5:1
- border-light/bg-main 3.38:1 (UI-component threshold)

### Затронутые файлы (поток D)
- `css/base.css` — секция `[data-theme="light"]` полностью переработана.
- `tests/e2e/theme.spec.js` — обновлены ассерты под новые значения, добавлено
  10 runtime-контраст-инвариантов (`Theme: Sandy light palette (v8.14)
  invariants`).
- `tests/unit/css/sandyLightTheme.test.js` — новый файл, 17 unit-инвариантов
  (никакого чистого `#ffffff` в light-секции, ожидаемые hex-значения,
  WCAG-расчёт контраста по hex-токенам).

---

### Тестирование (общее по v8.14)
- **Unit**: 824 → **985** (+161 тестов): A=+34, B=+51, C=+61, D=+17,
  плюс новые `tests/_helpers/source.js` и `tests/unit/css/sandyLightTheme.test.js`.
  0 провалов на интегрированном main.
- **E2E**: 145 → **183** (+38 тестов): Capacity Strip +8, Density toggle +6,
  Task row +3, View toggle +11, Sandy theme +10. 0 провалов.
- **Lint**: 0 errors, 8 warnings (без регрессии относительно v8.13).

### State / persistence (новые поля)
В `state.ui` добавлены и нормализуются через `migratePersistedState`:
- `density: 'compact' | 'comfortable' | 'cozy'` (default `'comfortable'`)
- `viewMode: 'list' | 'quadrants'` (default `'list'`)
- `expandedQuadrants: Array<'q1'|'q2'|'q3'|'q4'>` (default — все 4)

Все три поля переживают F5 через localStorage. Невалидные значения
(включая старые версии storage) автоматически нормализуются к default'ам.

### Hard-reload note (важно)
Изменены: ESM-импорты (`ui/index.js`, `app.js`), persistence-схема
(`state.ui.density/viewMode/expandedQuadrants`), CSS-токены
`[data-theme="light"]`, sw.js (CACHE_VERSION='sp-v8.20-cap-strip').

Перед запуском после обновления:
1. **Ctrl+Shift+R** (или `Cmd+Shift+R` на macOS).
2. DevTools → Application → Service Workers → **Unregister** (старый SW
   кэширует прежнюю разметку без `#capacityStrip` и без view-toggle).

---

## Версия: март 2026 (обновление 8.12) — Праздничные дни, исправление расчёта рабочих дней, именование файла

### Новая функциональность
- **Праздники (дн)**: новое поле в параметрах спринта. Позволяет указать количество нерабочих праздничных дней в периоде. Вычитаются из рабочих дней (Дни спринта = рабочие дни без выходных − праздники). При изменении праздников автоматически пересчитываются «Дни спринта»; при изменении «Дни спринта» — пересчитывается «Окончание» с учётом выходных и праздников.

### Исправленные баги
- **Баг #24**: `addDays` в `date.js` прибавлял **календарные дни** вместо **рабочих** — выходные (сб, вс) не пропускались. При вводе 10 рабочих дней от 03.03.2026 дата окончания рассчитывалась как 12.03 (8 рабочих дней) вместо 16.03 (10 рабочих дней). Исправлено: добавлены `addWorkingDays`, `countWorkingDays`, `isWorkingDay` в `date.js`.
- **Баг #25**: `calculateDaysFromDates` в `config.js` считал **календарные дни** между датами. Исправлено: использует `countWorkingDays` (только будни).
- **Баг #26**: `handleEndDateChange` в `configController.js` не пересчитывал поле «Дни спринта» при ручном изменении даты окончания. Исправлено: автоматический пересчёт рабочих дней.

### Улучшения
- Имя сохраняемого файла теперь включает название продукта: `{Продукт}-sprint-plan-ГГГГ-ММ-ДД.json`. Если продукт не задан — `sprint-plan-ГГГГ-ММ-ДД.json`.
- **JIRA-ключ в списке задач**: слева от названия задачи теперь отображается JIRA-ключ (последний сегмент URL после `/`), а не иконка 🔗.
- **Двухстрочная панель параметров**: поля «Коэфф.доступности %» и «Порог алерта %» перенесены на вторую строку для лучшей читаемости.

### Затронутые файлы
- `index.html` — новое поле `cfgHolidays`.
- `js/utils/appConfig.js` — `DEFAULT_HOLIDAYS: 0`.
- `js/utils/date.js` — новые функции: `addWorkingDays`, `countWorkingDays`, `isWorkingDay`; `addDays` помечена `@deprecated`.
- `js/domain/config.js` — holidays-параметр в `calculateEndDateFromStartDateAndDays`, `calculateDaysFromDates`, `createDefaultConfig`.
- `js/controllers/configController.js` — обработчики holidays, пересчёт дней с учётом праздников.
- `js/controllers/fileController.js` — добавлен префикс продукта в имя файла.
- `js/ui/taskList.js` — отображение JIRA-ключа вместо иконки 🔗.
- `js/state/persistence.js` — нормализация holidays при миграции.
- `css/layout.css` — двухстрочная раскладка панели параметров спринта.

### Тестирование
- **Unit-тесты**: 789 → **807** (+18 тестов). Новые тесты: holidays в config.js и configController.js, JIRA-ключ edge cases в taskList.js.
- **E2E-тесты**: 134 → **145** (+11 тестов), 0 провалов. Новые: holidays (3), JIRA key (1).

### Документация
- `UserManual.md`: добавлено описание поля «Праздники (дн)».
- `ARCHITECTURE.md`: актуализированы счётчики тестов.

---

## Версия: март 2026 (обновление 8.10) — Исправление тестов, SW кэш

### Исправление тестовой инфраструктуры
- **13 тестовых файлов** переведены с `jest.unstable_mockModule()` на `jest.mock()`.
- Причина: `jest.unstable_mockModule()` несовместим с `babel-jest` (CJS-трансформация).
- `beforeAll(async () => await import())` → статические `import`.
- Все моки определяются внутри фабрик `jest.mock()` (ограничение хойстинга Babel).
- `app.integration.test.js` полностью переписан с inline-классами в фабриках.
- Убран `--experimental-vm-modules` из скриптов `npm test` — флаг конфликтовал с `jest.mock()`.
- **Результат**: 789/789 тестов, 55/55 сьютов проходят.

### Документация
- `ARCHITECTURE.md`: добавлен раздел «Паттерн моков» и расширена таблица диагностики.

### PWA
- Добавлен `/js/ui/snackbar.js` в `ASSETS_TO_CACHE` (`sw.js`).
- `sw.js` cache: sp-v8.17 → **sp-v8.18**.

---

## Версия: февраль 2026 (обновление 8.9) — DRY-рефакторинг selection-модуля

### Рефакторинг domain/selection
- **`base.js`**: извлечены общие компараторы `compareByValueDensity` и `compareByPriority`, а также хелпер `buildSelectionResult` — устранено дублирование кода в трёх алгоритмах.
- **`matrix.js`** — inline-компараторы Q1/Q3/Q4 заменены на `compareByPriority`, return-блок — на `buildSelectionResult`.
- **`hybrid.js`** — Q1/Q2 используют `compareByValueDensity`, Q3/Q4 — `compareByPriority`, return — `buildSelectionResult`.
- **`valueDensity.js`** — sort использует `compareByValueDensity`, return — `buildSelectionResult`.
- **`config.js`**: добавлена константа `EXCLUSION_REASON_ALGORITHM` (`'Исключена алгоритмом'`).
- **`selectionController.js`**: magic string заменён на `EXCLUSION_REASON_ALGORITHM`.

### Тестирование
- **Юнит-тесты**: 780 → **789** (+9 тестов).
- `base.test.js`: добавлены тесты для `compareByValueDensity` (3), `compareByPriority` (3), `buildSelectionResult` (3).

---

## Версия: февраль 2026 (обновление 8.8) — ESLint, доступность, PWA

### ESLint
- Настроен ESLint 9 (flat config) для всего проекта: `eslint.config.js`.
- Отдельные конфигурации для browser (js/), service worker (sw.js), tests, CJS.
- Правила: `eqeqeq`, `no-var`, `prefer-const`, `no-implicit-globals`.
- **0 ошибок**, 8 предупреждений (`no-unused-vars`).
- Скрипты: `npm run lint`, `npm run lint:fix`.
- Исправлены ESLint-ошибки: `criteriaFormController.js` (no-useless-assignment), `criteria.js` (`!=` → `!==`).

### Увеличение тестового покрытия
- **Юнит-тесты**: 772 → **780** (+8 тестов).
- **Branch coverage**: 89.6% → **90.3%**.
- `ui/matrix.test.js`: 1 → **4 теста** — null DOM, zero availability, missing role estimates.
- `ui/criteriaList.test.js`: 2 → **7 тестов** — null DOM, empty criteria, invalid weight, >3 criteria, generateScaleEditorHTML, toggle collapse.

### Доступность
- **E2E-тесты a11y**: 5 → **12** (+7 тестов):
  - Tab navigation, Escape modal close.
  - Help modal a11y, edit task modal a11y.
  - Color contrast (WCAG AA), dark theme a11y.

### PWA-улучшения
- **SW update notification**: при обновлении версии кэша появляется snackbar «Доступна новая версия» с кнопкой «Обновить».
- `sw.js` cache: sp-v8.15 → **sp-v8.16**.

### .gitignore
- Добавлены `coverage_output.txt`, `coverage_report.txt`, `desktop.ini`, `.idea/`, `.vscode/`.

---

## Версия: февраль 2026 (обновление 8.7) — CSS-модуляризация, тесты, очистка

### CSS-модуляризация
- `components.css` (1565 строк → 893 строки) декомпозирован на 7 модулей:
  - `animations.css` — keyframes fadeIn/slideOut, drag states, highlight pulse
  - `accordion.css` — аккордеоны сравнения алгоритмов
  - `help.css` — стили справки (.help-content, .toc-highlight)
  - `snackbar.css` — toast-уведомления с кнопкой «Отменить»
  - `progress.css` — spinner, глобальный прогресс, мобильные аббревиатуры
  - `responsive.css` — все @media breakpoints (1200/900/768/600px)
  - `create-task-modal.css` — модальное окно создания задачи, кнопка OK, selected-task
- Обновлены `index.html` (версия CSS v3→v4) и `sw.js` (кэш sp-v8.15).

### Увеличение тестового покрытия
- **Юнит-тесты**: 671 → **772** (+101 тест, все проходят).
- **Branch coverage**: 72.4% → **89.6%** (переключено на `coverageProvider: 'v8'`).
- `analysis.js`: 3 → **15 тестов** — selectTasks routing, compareAlgorithms error/empty, getOptimizationRecommendations (overload, underload, warning, optimal, null, fallback).
- `selectionHelpers.js`: 2 → **20 тестов** — setSelectionLoadingState, buildTasksWithPriority, buildAlgorithmsCacheKey, buildComparisonDisplayData (errors, rawTask fallback, empty), computeComparisonBestValues.
- `persistence.js`: 2 → **20 тестов** — migratePersistedState defaults, null inputs, type normalization, criteria evaluations, NaN fallbacks, serialization.
- `configController.js`: 12 → **28 тестов** — applyDays/applyAvailCoef дедупликация, handleDaysInput/handleAvailCoefInput edge cases, calculateEndDate, destroy.
- `tabController.js`: 1 → **8 тестов** — activateTab с DOM, click-events, nonexistent tab.
- `config.js`: 4 → **8 тестов** — calculateDaysFromDates invalid dates, calculateEndDateFromStartDateAndDays valid case.
- `createForm.js`: 1 → **4 теста** — missing DOM elements, NaN values.
- `valueDensity.js`: 1 → **3 теста** — tiebreaker, empty tasks.
- `matrix.js`: +9 тестов — tiebreakers Q1-Q4, even median, zero capacity.
- `hybrid.js`: +4 теста — sort branches Q1-Q4.
- **Новый**: `formHelpers.test.js` — 11 тестов (parseNonNegativeNumber, readCreateTaskEstimates, collectCriteriaEvaluations, calculateCreateFormTotal).

### Очистка зависимостей
- Удалён `@babel/preset-react` из devDependencies (React удалён в v8.0).

---

## Версия: февраль 2026 (обновление 8.6) — Наведение порядка и тестовое покрытие

### Организация проекта
- Тестовые файлы контроллеров перемещены в подпапки, зеркалирующие структуру `js/controllers/`:
  - `taskCacheService.test.js`, `taskDragController.test.js`, `taskFormController.test.js` → `tests/unit/controllers/task/`
  - `criteriaFormController.test.js` → `tests/unit/controllers/criteria/`
  - `selectionHelpers.test.js` → `tests/unit/controllers/selection/`
- Исправлены все относительные пути импортов в перемещённых тестах.
- Обновлён путь в `npm run test:smoke`.
- Добавлены метаданные в `package.json` (`name`, `version`, `description`, `private`).
- Убраны лишние пустые строки в `index.html`.

### Увеличение тестового покрытия
- **Общее покрытие**: Statements 82.2% → **88.5%**, Branches 67.3% → **72.4%**.
- `roleController.js`: 2 → **26 тестов** — `handleRoleUpdate`, `handleRoleBlur`, `_parseRoleFieldValue` (все ветки).
- `taskController.js`: 24 → **56 тестов** — `attachEvents`, proxy-методы, кеширование, `selectTask` DOM, `_onTaskCreated`.
- `selectionController.js`: 12 → **31 тест** — `attachEvents` (все кнопки модального окна, accordion), `showMultiSelectionReport`, `applyAlgorithm` edge cases.
- `matrix.js`: +8 тестов — tiebreakers Q1/Q2/Q3/Q4, single task, all-identical, multi-role.
- `hybrid.js`: +11 тестов — valueDensity sorting, tiebreakers, excluded tasks, multi-role.

### Тестирование (итого по v8.6)
- **Unit-тесты**: **671 тестов** (было 580), 0 провалов.
- **E2E-тесты**: **134 теста**, 0 провалов.

### Документация
- Обновлены `ARCHITECTURE.md` и `RELEASE_NOTES.md` — актуализированы счётчики тестов, структура тестовых директорий, данные покрытия.

---

## Версия: февраль 2026 (обновление 8.0–8.5) — Комплексный рефакторинг, PWA и безопасность

### Обновление 8.5 — PWA, Undo-Delete, Progressive Rendering

#### PWA (Progressive Web App)
- Добавлен `manifest.json` — приложение устанавливается на рабочий стол и мобильные устройства.
- Добавлен `sw.js` (Service Worker, Cache-First) — полная оффлайн-работа.
- Добавлены SVG-иконки (`icons/icon-192.svg`, `icons/icon-512.svg`).
- Мета-теги PWA в `index.html`: `theme-color`, `apple-mobile-web-app-capable`.

#### Undo-Delete (отмена удаления)
- Удаление задачи теперь **без confirm-диалога** — задача удаляется сразу с анимацией.
- Появляется **snackbar** с сообщением и кнопкой **«Отменить»** (5 секунд).
- Undo полностью восстанавливает задачу и все данные.
- Новый модуль `js/ui/snackbar.js`.

#### Progressive Rendering
- Первые 20 задач рендерятся синхронно для быстрого first paint.
- Остальные задачи — через `requestIdleCallback` (батчи по 10).
- Устранено мерцание при рендеринге больших списков.

#### Исправления
- **Drag-and-drop**: инициализация только по `mousedown` на `.drag-handle` — устранено перехватывание кликов по кнопкам задач.
- **Включение/исключение задач**: `MutationObserver` для надёжного отслеживания появления задачи в DOM после рендера → автовыделение + scrollIntoView.
- **Клик по кнопкам**: исправлена проблема с `focusin` на карточке задачи — кнопки действий (edit, exclude, delete) работают корректно.

### Обновление 8.4 — Декомпозиция TaskController
- Выделен `TaskListHandler` (155 строк, 6 методов): `handleUpdateEst`, `handleCriteriaScoreChange`, `handleToggleExclude`, `handleDeleteTask`, `handleDeleteAll`, `handleSortByPriority`.
- `TaskController` уменьшен с 392 до 293 строк (4 подконтроллера: Form, Drag, Cache, List).

### Обновление 8.3 — XSS-защита innerHTML
- `escapeHtml()` и `clearChildren()` добавлены в `domUtils.js`.
- `createElement()` поддерживает `options.text` (безопасный `textContent`).
- `innerHTML = ''` заменён на `replaceChildren()` в `header.js`, `taskList.js`, `roleList.js`.
- 9 новых unit-тестов (escapeHtml, clearChildren, text option).

### Обновление 8.2 — CSS-модуляризация
- `components.css` уменьшен с 2006 до 1491 строк (−515).
- 5 CSS-модулей заполнены реальными стилями: `buttons.css`, `forms.css`, `modals.css`, `criteria.css`, `selection-report.css`.
- Добавлены русские JSDoc к `criteriaFormController.js`, `selectionController.js`.

### Обновление 8.1 — modalManager и JSDoc
- Создан `modalManager.js` — единый менеджер модальных окон (`showModal`/`hideModal`/`isModalVisible`).
- 32 замены `style.display` в 10 контроллерах на вызовы `modalManager`.
- Добавлены подробные русские JSDoc-комментарии к `taskController.js`.

### Обновление 8.0 — Безопасность и архитектура
- Удалены неиспользуемые зависимости `react`, `react-dom`, `@babel/preset-react` из проекта (vanilla JS).
- Исправлен FOUC (Flash of Unstyled Content) — тема теперь применяется inline-скриптом в `<head>` до загрузки CSS.
- Добавлена санитизация HTML через **DOMPurify** в `HelpController` — защита от XSS при рендеринге markdown.
- `Store.getState()` теперь возвращает замороженную копию (`Object.freeze`) — предотвращает случайные мутации.
- **ARCHITECTURE.md** — полностью переписан: подробное описание 3 алгоритмов отбора (Matrix, Value Density, Hybrid).

### Тестирование (итого по v8.0–8.5)
- **Unit-тесты**: **580 тестов**, 0 провалов.
- **E2E-тесты**: **134 теста**, 0 провалов.


---

## Версия: февраль 2026 (обновление 7) — Исправление гонки фокуса в модальном окне создания задачи

### Исправленные баги
- **Баг #23**: `TaskFormController.openCreateModal` — `setTimeout(() => firstInput.focus(), 50)` создавал гонку с Playwright: таймер срабатывал в момент, когда автотест уже заполнял поле `#newJira`, перехватывал фокус обратно на `#newTitle` и JIRA-URL оказывался в поле названия. Следствие — валидационная ошибка «Ссылка JIRA обязательна» и незакрывающееся модальное окно. Исправлено: `setTimeout` заменён на синхронный вызов `firstInput.focus()`.

### Тестирование
- **E2E-тесты**: **86 тестов**, 0 провалов (ранее 1 нестабильный провал в «Multiple tasks workflow › creates 3 tasks and shows correct counters»).

---

## Версия: февраль 2026 (обновление 6) — Исправление коллизий ID и нормализации чисел

### Исправленные баги
- **Баг #21**: `CriteriaManager.addCriteria` — генерация ID через `Math.max(...ids) + 1` приводила к коллизиям при повторном добавлении критерия после удаления. Исправлено: монотонный счётчик `_nextCriteriaId` (аналогично `_nextTaskId` в `task.js`).
- **Баг #22**: `NumberFormatService.parseNumber` — двойная замена разделителя (`replace(separator, '.').replace(',', '.')`) была неявной и могла давать неожиданные результаты при смешанном вводе. Исправлено: явная логика с `replaceAll` для настроенного разделителя.

### Тестирование
- **Unit-тесты**: **521 тест** (было 515), 0 провалов.
  - Новые тесты: `_resetCriteriaIdCounter` (2), коллизии ID критериев (1), `parseNumber` с перекрёстными разделителями (5).
- **E2E-тесты**: **90 тестов**, 0 провалов (без изменений).

---

## Версия: февраль 2026 (обновление 5) — Рефакторинг качества кода и исправление багов

### Исправленные баги
- **Баг #17**: `_validateTitleField` / `_validateJiraField` в `TaskFormController` — выбор ID DOM-элемента был завязан на `excludeId !== null`, что смешивало два ортогональных понятия. Исправлено: добавлен явный параметр `mode: 'create' | 'edit'`.
- **Баг #18**: `isTitleUnique`, `isJiraUrlUnique`, `isAbbreviationUnique` — условие `if (excludeId && ...)` ломалось при `excludeId = 0`. Исправлено на `excludeId !== null`.
- **Баг #19**: `FileController` — при ошибке сохранения/загрузки вызывался `showMessage` дважды подряд. Объединено в одно информативное сообщение.
- **Баг #20**: `FileController` — `progressEl` инициализировался в конструкторе до вызова `init()`, что могло приводить к `null` при тестировании. Перенесено в `init()`.

### Рефакторинг
- **`LruCache`** (`js/utils/lruCache.js`) — реализована настоящая LRU-семантика: `get()` продвигает запись в позицию MRU, `set()` на существующий ключ тоже продвигает. Ранее кэш работал как FIFO.
- **`generateScaleEditorHTML`** перенесена из `js/domain/criteria.js` в `js/ui/criteriaList.js` — доменный слой освобождён от HTML-генерации.
- **`getTaskStats`** добавлена в `js/domain/task.js` — логика подсчёта включённых/исключённых задач вынесена из `header.js`.
- **`normalizeTaskEst`** в `persistence.js` — хардкод ролей заменён на `ROLES.map(...)`.
- **`buildTasksWithPriority`** в `selectionHelpers.js` — хардкод ролей заменён на `ROLES.map(...)`.
- **`prepareTaskForSelection`** в `task.js` — хардкод ролей заменён на `ROLES.map(...)`.
- **`reorderTasks`** в `Store` — алиас для `setTasks`, дублирующая логика устранена.
- **`ConfigController`** — class fields (стрелочные методы) заменены на обычные методы с явным `bind` в конструкторе (совместимость с Babel/Jest).
- **`RoleController`** — извлечён `_parseRoleFieldValue()` для устранения дублирования в `handleRoleInput` / `handleRoleUpdate`.
- **`TaskFormController`** — извлечён `_validateField()` — обобщённый валидатор полей формы.
- **`HelpController`** — `slugify` вынесен в метод `_slugify()`, стили справки перенесены из inline `<style>` в CSS-класс `.help-content` (`components.css`), подсветка якоря использует CSS-класс `.toc-highlight`.
- **`HelpController`** — список путей поиска `UserManual.md` сокращён до 2 (убраны нерабочие варианты), убран лишний HEAD-запрос.
- **`SelectionController`** — кэш алгоритмов использует новую LRU-семантику (`get()` возвращает `undefined` при промахе).
- **`TaskCacheService`** — добавлен метод `isReady()`, кэш-проверки используют `!== undefined` вместо `has()`.
- **`TaskController`** — `handleSortByPriority` использует `_cache.isReady()` вместо прямого доступа к приватному полю.
- **`taskList.js`** — индикаторы перегрузки: предвычисление накопленных трудозатрат в O(n) вместо O(n²).
- **`taskList.js`** — подсветка новой задачи использует только CSS-класс `.task-item-highlight` без inline-стилей.
- **`task.js`** — ID задач генерируются монотонным счётчиком `_nextTaskId` (сид `Date.now()`) вместо `Date.now()` напрямую — устраняет коллизии при быстром создании задач.
- **`NumberFormatService`** — конструктор принимает опциональный `initialSeparator` для инъекции без `localStorage`.

### Тестирование
- **Unit-тесты**: **515 тестов** (было 503), 0 провалов. Покрытие: **82.2%** statements, **84.9%** lines.
  - Новые тесты: `_resetTaskIdCounter` (2), `_validateField` с отсутствующим DOM (1), явный `mode` в `_validateTitleField`/`_validateJiraField` (5), `isReady()` в `TaskCacheService` (2), LRU-семантика `get()`/`set()` (2).
  - Обновлены: `fileController.test.js` (2 теста под новое поведение).
- **E2E-тесты**: **90 тестов** (было 66), 0 провалов.
  - Новые группы: «Task highlight on creation» (2), «Help modal content» (2), «Overload indicators» (1), «Sprint dates» (2), «Availability coefficient» (2), «Task selection» (2), «Edit task validation» (2), «Criteria evaluation in task» (2), «Edit criteria» (3), «Apply auto-selection algorithm» (4), «Drag and drop» (2).

---

## Версия: февраль 2026 (обновление 4) — Расширенный рефакторинг и тестирование

### Рефакторинг
- **`CriteriaFormController`** (`js/controllers/criteria/criteriaFormController.js`) — модальное окно добавления/редактирования критерия вынесено из `CriteriaController`.
- **`selectionReport.js`** (`js/ui/selectionReport.js`) — рендер отчёта сравнения алгоритмов вынесен из `SelectionController` (200+ строк).
- **`selectionRecommendations.js`** (`js/ui/selectionRecommendations.js`) — рендер рекомендаций вынесен из `SelectionController` (180+ строк).
- **`ALGORITHM_KEYS`** добавлен в `js/domain/selection/config.js` — устранён хардкод массива алгоритмов.
- **`createTaskElement()`** в `taskList.js` разбит на `buildEstimatesHtml()` + `buildCriteriaHtml()`.
- **`SelectionController`** сокращён с 519 до ~180 строк.

### Доступность (a11y)
- Добавлены `for`/`id` связи для всех `<label>` в формах.
- Добавлены `aria-label` для всех интерактивных элементов без видимых меток.
- Исправлен контраст: `--excluded` (#94a3b8), `--danger` (#ff8080), бейдж критерия (#7c3aed).

### Тестирование
- **Unit-тесты**: 503 тестов (было 211), 0 провалов. Покрытие: **81%** statements.
- **E2E-тесты (Playwright)**: 66 тестов, 0 провалов.
- Новые тест-файлы: `criteriaFormController.test.js`, `selectionReport.test.js`, `selectionRecommendations.test.js`, `criteriaFormController.test.js`.
- Расширены: `taskController.test.js`, `configController.test.js`, `helpController.test.js`, `selectionController.test.js`, `hybrid.test.js`, `index.test.js`.

---

## Версия: февраль 2026 (обновление 3) — Рефакторинг и тестирование

### Исправленные баги
- **Баг #15**: Исправлена иконка кнопки исключения задачи — для исключённых задач теперь отображается ✅, для включённых 👁 (ранее обе иконки были одинаковыми).
- **Баг #16**: Исправлен метод `updateState` в `Store` — теперь использует `update()` для консистентности с остальными методами.

### Рефакторинг
- **`TaskController`** разбит на три специализированных класса:
  - `TaskFormController` (`js/controllers/task/taskFormController.js`) — модальные окна создания/редактирования задач.
  - `TaskDragController` (`js/controllers/task/taskDragController.js`) — drag-and-drop переупорядочивание.
  - `TaskCacheService` (`js/controllers/task/taskCacheService.js`) — кэширование priority-score и role-load.
- **`LruCache`** (`js/utils/lruCache.js`) — новый универсальный LRU-кэш, используется в `TaskCacheService` и `SelectionController`.
- **`SelectionController`** — ручная LRU-логика заменена на `LruCache(5)`.
- **`header.js`** — дублирующийся блок included/excluded заменён вспомогательной функцией `renderCounterEl()`.
- **`taskController.js`** — хардкод `['h_uiux','h_ca',...]` заменён на `ROLES.map(r => 'h_'+r.id)`.
- **`taskController.js`** — цепочка из 3 `setTimeout` заменена на `MutationObserver` для надёжного ожидания DOM.

### Доступность (a11y)
- Добавлены `for`/`id` связи для всех `<label>` в формах конфигурации спринта, создания и редактирования задач.
- Добавлены `aria-label` для `#taskTypeFilter`, `#taskSearchInput`, полей FTE/off ролей, select-ов критериев.
- Исправлен контраст цвета `--excluded` (`#64748b` → `#94a3b8`, соответствует WCAG AA).
- Исправлен контраст цвета `--danger` (`#ff4d4d` → `#ff8080`, соответствует WCAG AA).
- Исправлен контраст бейджа аббревиатуры критерия (`#a855f7` → `#7c3aed`).

### Тестирование
- **Unit-тесты**: 373 тестов (было 211), 0 провалов.
  - Новые тест-файлы: `taskController.test.js`, `taskFormController.test.js`, `taskDragController.test.js`, `criteriaController.test.js`, `taskCacheService.test.js`, `lruCache.test.js`, `domUtils.test.js`, `roleList.test.js` (расширен).
- **E2E-тесты (Playwright)**: 66 тестов, 0 провалов.
  - Покрыты все пользовательские сценарии: создание/редактирование/удаление задач, фильтрация, исключение, автоотбор, критерии, роли, клавиатурные сокращения, персистентность.
  - Добавлены тесты доступности (WCAG 2 AA) через `@axe-core/playwright`.

---

## Версия: февраль 2026 (обновление 2)

### Исправленные баги

- **Баг #7**: Устранено мигание аккордеона при наведении в окне "Сравнение алгоритмов" — переход с изменения `border-color` на `box-shadow: inset`, что исключает layout reflow.
- **Баг #8**: Устранён горизонтальный скроллинг в окне "Сравнение алгоритмов" — добавлен `overflow-x: hidden` к контейнеру контента и исправлена CSS-сетка аккордеона (`minmax(0, 1fr)`).
- **Баг #9**: Исправлена потеря выделения активной задачи при редактировании трудозатрат или оценок по критериям — после перерисовки DOM класс `selected-task` теперь восстанавливается.
- **Баг #10**: Добавлено снятие выделения задачи при клике вне её области (новый метод `deselectTask`).
- **Баг #11**: Исправлена валидация суммы весов критериев перед запуском алгоритмов — теперь проверяется точное равенство 100% (ранее проверялось только превышение).
- **Баг #12**: Исправлена логическая ошибка в `calculatePriorityScore` — нулевые оценки критериев (`score=0`) теперь корректно учитываются в расчёте (ранее пропускались из-за falsy-проверки).
- **Баг #13**: Исправлен расчёт Priority Score в форме создания задачи — деление на сумму весов вместо константы 100.
- **Баг #14**: В алгоритмах отбора `priorityScore` теперь всегда пересчитывается по актуальным весам критериев (ранее мог использоваться устаревший кешированный результат).

### Улучшения кода

- Все комментарии в JS-файлах переведены на русский язык.
- Устранены дублирующиеся JSDoc-комментарии в `configController.js`.

---

## Версия: февраль 2026

### Исправленные баги UI
- **Баг #1**: Исправлена кнопка Показать/Скрыть на вкладке критериев - добавлен класс для текстового span и исправлен селектор
- **Баг #2**: Исправлена проблема с отображением даты окончания спринта - оптимизирован пересчёт при вводе количества дней
- **Баг #3**: Исправлена подсветка новой задачи - задача теперь выделяется голубой рамкой с эффектом свечения после создания
- **Баг #4**: Добавлена иконка перечеркнутого глаза для исключенных из спринта задач
- **Баг #5**: Исправлен расчёт алгоритмов сравнения - добавлен расчёт effort для каждой задачи перед передачей в алгоритмы
- **Баг #6**: Добавлен фокус на первый элемент ввода при открытии модальных окон (создание/редактирование задачи, критерии)

### Дополнительные улучшения UI
- Добавлены стили для аккордеонов в разделе "Сравнение алгоритмов" - эффекты при наведении курсора

### Что улучшено
- Проведен крупный рефакторинг runtime-архитектуры и точек входа (`index.html -> js/app.js`).
- Усилено разделение слоев: domain / controllers / services / ui / state.
- Добавлен единый контракт миграции и сохранения состояния (`js/state/persistence.js`).
- Обновлен поток рендера: централизованный `store -> requestRender`.
- Улучшена управляемость контроллеров через DI и уменьшены скрытые зависимости.
- Добавлены helper-модули:
  - `js/controllers/selection/selectionHelpers.js`
  - `js/controllers/task/formHelpers.js`
- Добавлены типовые JSDoc-контракты данных:
  - `js/types/contracts.js`

### UI/UX и поведение
- Исправлены проблемы с автопересчетом в блоках конфигурации и загрузки команды.
- Исправлены ошибки подсветки лучших значений в сравнении алгоритмов.
- Доработаны hotkeys и поведение отдельных полей ввода.
- Уточнены стили и выравнивание в ключевых таблицах/формах.
- Добавлены fallback-иконки без зависимости от CDN (кнопки задач/критериев и вкладка критериев).

### Тестирование
- Удалены устаревшие и дублирующиеся тестовые каталоги (`tests/domain`, `tests/__tests__`, старые `fixtures/setup`).
- Добавлены/переписаны тесты критичного функционала:
  - интеграционный поток `App` (store/render/persist),
  - контроллеры `TaskController`, `SelectionController`, `KeyboardController`, `ConfigController`, `RoleController`,
  - `state/persistence`,
  - UI-модули `createForm`, `criteriaList`, `matrix`, `header`, `index`, `utils`.
- Добавлен быстрый smoke-сценарий: `npm run test:smoke`.
- Текущий статус: все тесты проходят (`npm test`).

### Документация
- Разделены роли документации:
  - `README.md` — обзор приложения, установка, запуск и решение проблем;
  - `UserManual.md` — пользовательская справка (используется внутри приложения);
  - `ARCHITECTURE.md` — техническая документация для разработчиков.
- Актуализирован `ARCHITECTURE.md`.

### Пакет для передачи
- Папка `sprint-planning` синхронизирована с актуальным runtime-кодом и документацией.
