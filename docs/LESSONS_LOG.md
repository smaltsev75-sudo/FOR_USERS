# Lessons Log

> Исторический журнал PLANNER. Активные правила остаются в `CLAUDE.md`; сюда вынесены длинные war-stories и audit notes, чтобы не раздувать стартовый контекст AI-сессии.

## Ловушки v8.30.64 (Selection and JSON trust hardening)

- **Для ключевого алгоритма отчёт не равен безопасному применению.** Даже если `compareAlgorithms()` вернул корректный набор, к моменту клика «Применить» state мог измениться или результат мог быть stale. Apply-layer обязан повторно проверить role/team capacity по живым задачам и не записывать перегруз. Codified by: `buildCapacitySafeSelection()`, `selectionController.test.js`, `user-incidents.spec.js`.

- **UserManual алгоритма должен быть executable contract.** Если справка обещает Matrix Q1→Q2→Q3→Q4, Value Density по `priorityScore / effort`, Hybrid с VD в Q1/Q2, это должно проверяться тестами как публичный контракт, а не оставаться текстом. Codified by: `selectionManualContract.test.js`.

- **Служебные поля не должны перебивать видимые пользователю оценки.** `roleEffort` полезен как подготовленное поле, но при наличии `est` алгоритмы обязаны считать по текущим оценкам в карточке. Иначе отчёт может расходиться с UI. Codified by: `base.test.js`.

- **Actionability download не доказывает доверие к JSON save/load.** Кнопка «Сохранить» может скачивать файл, но ключевой пользовательский контракт — roundtrip: сохранить JSON, загрузить его обратно и восстановить тот же план с задачами, исключениями, причинами, зависимостями, критериями и настройками. Codified by: `user-incidents.spec.js`.

- **HTML5 drag у вложенных элементов ненадёжен.** Ручка может работать через native drag, а title/comment/body — нет или behave differently. Для тела карточки нужен собственный mouse-fallback, а интерактивные элементы должны оставаться обычными controls. Codified by: `taskDragController.test.js`, `user-incidents.spec.js`.

- **PDF-дубликаты надо проверять print-mode тестом.** Удаление/добавление print-only элементов нельзя считать безопасным без `emulateMedia('print')`: лишний `Effort: N` был виден только в PDF/печати. Codified by: `print-verify.spec.js`.

## Ловушки v8.30.63 (Node24-native GitHub Actions)

- **Workflow-level Node 24 opt-in не убирает annotation, если сам action major ещё таргетит старый runtime.** `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` переводит выполнение на Node 24, но GitHub продолжает показывать forced-runtime warning для `actions/checkout@v4` / `actions/setup-node@v4`. Для PLANNER CI надо использовать Node24-native official majors (`checkout@v6`, `setup-node@v6`) и guard'ить это тестом. Codified by: `ci-workflow-gates.test.js`.

## Ловушки v8.30.62 (Task-card CSS ownership, Node 24 runtime opt-in)

- **CSS split не завершён, пока старые selectors остаются в предыдущем owner-файле.** После v8.30.61 `components.css` всё ещё содержал stale `.task-item`, `.task-row`, `.criteria-eval-*`, `.priority-score-*` и похожие правила. Из-за специфичности они могли перебивать новые `task-card-*` файлы, хотя визуально казалось, что split завершён. Решение: удалить stale task-card block из `components.css` и добавить ownership guard. Codified by: `css-cascade-contract.test.js`, `taskCardCss.test.js`, visual/full e2e gates.

- **При удалении legacy CSS сначала отделять мусор от полезного контракта.** Удаление stale block выявило, что `task-jira-link` ellipsis был полезным layout-контрактом: без него print card выросла с ~205px до ~302px. Решение: перенести `white-space/overflow/text-overflow/max-width` в правильный owner `task-card.css`, а не возвращать весь block в `components.css`. Codified by: `taskCardCss.test.js`, visual baseline `print-a4-task-card`.

- **Node 24 rehearsal полезен, но предупреждения останутся в обычных jobs без workflow-level opt-in.** Если GitHub уже показывает Node 20 annotations в `Unit, lint, audit` и `Mobile WebKit smoke`, `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` должен жить на уровне workflow `env`, а не только в rehearsal job. Codified by: `ci-workflow-gates.test.js`.

## Ловушки v8.30.61 (Actionability, task-card CSS split, Node 24 rehearsal)

- **Критичные видимые команды должны иметь отдельный actionability gate.** Полный e2e может проходить, но не покрывать конкретный “кликнул и получил ответ” путь. Добавлен `test:e2e:actionability`: save/download, theme, help, create modal, auto-select feedback, diagnostics и recovery no-backup snackbar. Codified by: `tests/e2e/actionability.spec.js`, `scripts/e2eTaxonomy.js`.

- **Большой CSS-файл лучше сначала разделить без изменения cascade, а не сразу мигрировать в `@layer`.** `task-card.css` был механически разделён на subfiles с тем же порядком подключения: shell, effort, actions, criteria, states, quadrants. Codified by: `css-cascade-contract.test.js`, `precache-coverage.test.js`, visual/full e2e gates.

- **Node 24 GitHub Actions runtime надо репетировать до принудительного переключения.** CI получил лёгкий `Node 24 rehearsal` с `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`, чтобы будущий platform shift не пришёл как внезапный красный CI. Codified by: `ci-workflow-gates.test.js`.

## Ловушки v8.30.60 (Recovery copy click feedback)

- **Видимая `disabled`-кнопка без пояснения выглядит как сломанный клик.** В Recovery Center кнопка «Скачать копию до миграции» была disabled при отсутствии recoverable backup, поэтому браузер не отправлял click и пользователь не получал причину. Теперь кнопка остаётся кликабельной, помечается `data-recovery-available="false"` и показывает snackbar. Codified by: `recoveryController.test.js`, e2e `Recovery Center`.

- **`messageModal` из уже открытой модалки может быть формально visible, но недоступен.** При попытке показать сообщение поверх Recovery Center нижняя модалка перехватывала pointer events. Для короткого объяснения отсутствующей recovery-копии используется snackbar, который реально виден поверх модального окна. Codified by: `planner.spec.js` Recovery Center click path.

## Ловушки v8.30.59 (Mobile WebKit ready wait)

- **`networkidle` не является надёжным readiness-сигналом для PWA/WebKit smoke.** После v8.30.58 GitHub Actions дошёл до реальных mobile tests, но один `beforeEach` завис на `page.waitForLoadState('networkidle')`: DOM уже был загружен, а networkidle не наступил вовремя. Mobile setup теперь ждёт `domcontentloaded` и конкретные UI-сигналы (`#planningTabContent`, `#mobileMenuToggle`) до/после reload. Codified by: `mobile.spec.js`, `CI=true npm run test:e2e:smoke`.

## Ловушки v8.30.58 (CI webServer reuse, recovery copy wording)

- **CI `reuseExistingServer` нельзя оставлять только на `!process.env.CI`, если e2e orchestration уже поднял свой verified server.** `e2e-parallel.mjs` держит 8123, `e2e-runner.mjs` видит Sprint Planner signature, но GitHub Actions всё равно падал `port already used`, потому что Playwright config в CI запрещал reuse. Runner-owned server теперь передаётся явным `PLAYWRIGHT_REUSE_EXISTING_SERVER=1`. Codified by: `e2e-runner-must-not-pollute-node-options.test.js`, `CI=true npm run test:e2e:smoke`.

- **Recovery backup должен быть назван по пользовательскому смыслу, не по внутреннему ключу.** «Скачать backup» рядом с «Сохранить JSON» выглядит как дубль. Правильное разделение: «Сохранить JSON» = текущий план; «Скачать копию до миграции» = safety-снимок из `sprintPlannerData.backup` для проблем после обновления. Codified by: `docs/UserManual.md`, `docs:manual-check`.

## Ловушки v8.30.57 (storage health, large backlog perf, feedback package)

- **Project Doctor должен быть redacted по умолчанию.** Проверка localStorage полезна только если показывает схему, parse status, issue count, counts и backup metadata без названий продукта/задач. Общий preview вынесен в `statePreview.js`, Storage Health берёт из него только агрегаты. Codified by: `storageHealth.test.js`, `statePreview.test.js`, e2e `Recovery Center`.

- **Preview замены данных должен быть общим для import и recovery.** Иначе импорт покажет одни итоговые счётчики/fallback-и, а восстановление backup — другие. `statePreview.js` стал shared сервисом для `FileController` и `recovery.js`, а confirm-модели переиспользуют один UI helper. Codified by: `fileController.test.js`, `recovery.test.js`, `importIssues.test.js`.

- **Large backlog perf надо защищать от O(n²) batch-регрессий.** Первый запуск 600-task probe показал только ~260 карточек за 18 секунд: overload-индикаторы пересчитывали весь список после каждого idle-batch. Решение: один cumulative model и DOM-update только для rendered batch. Release-safe gate закреплён на 300 задачах, чтобы не превращать full e2e в resource-race. Codified by: `performance.spec.js`, `taskListSubmodules.test.js`.

- **User feedback loop должен просить сценарий и redacted diagnostics, а не полный project JSON.** `feedback:template` фиксирует, что пользователь описывает вкладку/тему/viewport/impact, а diagnostics прикладывает отдельным redacted JSON. Codified by: `userFeedbackPackage.test.js`, `docs/USER_FEEDBACK_PACKAGE.md`.

## Ловушки v8.30.56 (recovery, e2e taxonomy, diagnostics issue template)

- **Nested modal confirmation надо проверять реальным e2e-click, не только unit auto-confirm.** Recovery Center сначала открывал `confirmModal`, оставляя `recoveryModal` сверху в DOM/z-index. Unit с mocked `showConfirm()` проходил, а Playwright честно не мог нажать «Да»: overlay перехватывал pointer events. Решение: закрывать Recovery-модалку до `messageService.showConfirm()`. Codified by: `tests/e2e/planner.spec.js` → `Recovery Center`.

- **Восстановление backup не должно иметь отдельный state-apply path.** Если импорт JSON и recovery по-разному мигрируют criteria/tasks/number format, одна из веток начнёт терять alignment. Общий helper `stateImportApplier.js` стал shared path: migrate → number format → criteria → task criteria alignment → Store. Codified by: `recoveryController.test.js` и existing `fileController.test.js`.

- **Diagnostics issue template должен читать только агрегаты, а не весь bundle.** Даже redacted JSON может со временем получить новое поле. Шаблон issue рендерит allowlisted sections (`app/runtime/storage/currentState/persistedState/SW/cache`) и не проходит по неизвестным raw keys. Codified by: `diagnosticsIssueTemplate.test.js`.

- **E2E taxonomy ускоряет локальный цикл, но не заменяет full gate.** `test:e2e:critical|visual|a11y|mobile` должны жить в одном source of truth (`scripts/e2eTaxonomy.js`) и охраняться guard'ом, иначе package scripts сами станут новым drift-срезом. Codified by: `e2e-taxonomy-contract.test.js`.

- **Print CSS debt можно снижать безопасно, если оставить semantic overrides и снять только redundant importance.** v8.30.56 снял `!important` там, где print stylesheet order и specificity достаточно сильны (`display`/layout для print-only и toolbar/grid/task rows), не заходя в `@layer` rewrite. Budget `128 → 107`. Codified by: `css-cascade-contract.test.js` и `css:important-report`.

## Ловушки v8.30.55 (command registry, diagnostics e2e, CSS debt trend)

- **Hotkeys нельзя держать одновременно в контроллере, HTML title и UserManual.** До v8.30.55 таблица горячих клавиш была в `manual-contract.json`, а runtime-логика — в `KeyboardController`. Это создавало drift-риск: UI мог поменяться, а справка остаться старой. Решение: `js/config/commands.js` как source of truth, `KeyboardController` ищет command через `findCommandByHotkey()`, UserManual берёт `getManualHotkeys()`, а `command-registry-contract.test.js` запрещает вернуть ручной дубль.

- **Diagnostics support-flow надо проверять как пользовательский download, не только unit redaction.** Unit-тест доказывает форму JSON, но не доказывает, что кнопка реально скачивает файл и пользователь видит результат. v8.30.55 добавил e2e: seed с секретными product/task/JIRA/comment, download JSON, проверка отсутствия секретов и snackbar success. Это закрывает связку UI → FileController → Blob download → redacted bundle.

- **CSS `!important` debt лучше резать на дубликатах и специфичности, не через широкий cascade rewrite.** Безопасный выигрыш v8.30.55: удалить дублированный `.overload-tag` из `task-card.css` (тот же стиль уже в `components.css`) и заменить `create-task-modal.css` overrides на `.create-form .cf-role__input` / ID-specific selectors. Budget упал `167 → 128`, не затрагивая `print.css`.

- **Release metrics без истории дают только одноточечную честность.** `release:metrics` доказывает текущий релиз, но сравнение с прошлым релизом раньше приходилось читать из длинных release notes. `release:metrics-history` обновляет tracked `docs/release-metrics-history.json` с coverage/e2e/CSS trend. Это не gate, а память проекта в машинном виде.

## Ловушки v8.30.54 (release contract + diagnostics + generated docs)

- **Release automation не должна верить ручным notes/metrics перед push.** `release:public --execute` теперь проверяет release contract до sync/commit/push/release: metrics JSON текущей версии, latest `RELEASE_NOTES`, e2e smoke/full rows, `release:metrics` row и CSS budget должны совпасть. Codified by: `scripts/releaseContract.js`, `release-public-execute-guard.test.js`.

- **Diagnostics bundle полезен только пока он redacted.** Support JSON должен помогать разобрать runtime/storage/cache/state aggregates, но не утекать task titles, JIRA URL, комментариями или названием продукта. Codified by: `js/services/diagnostics.js`, `tests/unit/services/diagnostics.test.js`.

- **Visual baseline seed должен жить в DSL, а не в spec-local JSON.** Иначе один e2e-spec стареет отдельно от остальных сценариев, а screenshot может стать зелёным, но нерепрезентативным. Codified by: `buildVisualBaselineScenario()`, `e2e-support-dsl.test.js`.

- **CSS debt report должен быть артефактом, а не разовой цифрой в release notes.** Budget guard отвечает «можно ли релизить», а `docs/css-important-report.md` показывает селекторы/properties, где долг остаётся. Codified by: `scripts/cssImportantReporter.js`, `npm run css:important-report`.

- **UserManual generator должен покрывать справочные справочники, не только hotkeys.** Task types и алгоритмы отбора теперь живут в `docs/manual-contract.json`; ручной текст справки не должен расходиться с UI/доменной терминологией. Codified by: `scripts/generate-manual-contract.mjs`, `user-manual-drift.test.js`.

## Ловушки v8.30.53 (release metrics + state guards + seeded e2e)

- **Release metrics должны собираться из артефактов, а не из памяти исполнителя.** Coverage/e2e/CSS цифры теперь читаются из `coverage/coverage-summary.json`, `test-results/e2e-parallel-summary.json` и `docs/css-important-budgets.json`. Это снижает риск очередного «PASS по рассказу, не по последнему запуску». Codified by: `scripts/releaseMetricsCollector.js`, `npm run release:metrics`.

- **CSS debt budget должен быть per-file, иначе общий лимит маскирует перенос долга.** После снижения `!important` важно запрещать не только рост total, но и новый unbudgeted файл с `!important`. Codified by: `docs/css-important-budgets.json`, `tests/unit/architecture/css-cascade-contract.test.js`.

- **Store snapshot shallow-freeze не защищает вложенные мутации.** Прямой `state.tasks.push(...)` или `store.getState().config.x = ...` может обойти верхнеуровневый freeze и дать тихий drift. Codified by: `tests/unit/architecture/state-mutation-boundary.test.js`.

- **E2E seed — часть тестового контракта, а не служебная копипаста.** Общие сценарии basic/overload/quadrants/print/sticky должны жить в `plannerStates.js`; spec выбирает сценарий, а не собирает случайный localStorage JSON. Codified by: `tests/e2e/support/plannerStates.js`, `tests/unit/architecture/e2e-support-dsl.test.js`.

- **Release notes draft полезен только как черновик метрик.** Скрипт может подставить coverage/e2e/CSS строки, но не должен превращать changelog в автогенерированный TODO-текст без инженерного описания закрытых поверхностей. Codified by: `scripts/releaseNotesSectionGenerator.js`.

## Ловушки v8.30.52 (controller splits + manual generator + print debt)

- **Большой controller-split должен выносить бизнесовый mapping, а не просто строки.** `TaskFormController` был рискован не размером, а смешением DOM, `task.est`/form estimates и create/edit patch. Чистый `taskFormDraft.js` теперь доказывает create→`estimates`, edit→`est` и weighted score без jsdom. Codified by: `tests/unit/controllers/task/taskFormDraft.test.js`.

- **Config dates/holidays — доменная логика, не blur-handler.** `days/startDate/endDate/holidays` теперь считаются в `domain/sprintSchedule.js`; controller только валидирует ввод и применяет patch. Это снижает риск тихого расхождения live input и blur behavior. Codified by: `tests/unit/domain/sprintSchedule.test.js`.

- **UserManual guard лучше работает вместе с generator check.** Guard ловит drift, но source-of-truth должен жить отдельно. `docs/manual-contract.json` генерирует hotkeys/density/view blocks; `docs:manual-check` падает, если блоки правили руками или забыли обновить после изменения UI copy. Codified by: `scripts/generate-manual-contract.mjs`, `tests/unit/architecture/user-manual-drift.test.js`.

- **Print `!important` budget можно снижать только с реальным print/visual pass.** v8.30.52 снял типографические/spacing `!important` в `print.css` (`179 → 96`) без изменения display/background/border overrides. Обязательная проверка: `print-verify.spec.js` + visual `print A4 task card`. Codified by: `tests/unit/architecture/css-cascade-contract.test.js`, `tests/e2e/print-verify.spec.js`, `tests/e2e/visual.spec.js`.

- **Параллельность не должна сталкивать два Playwright webServer на один порт.** Jest/lint/audit/docs безопасно распараллеливать; прямые `playwright test ...` команды с config.webServer на `8123` запускать последовательно или через общий runner, иначе второй процесс падает `EADDRINUSE`. Codified by: `CLAUDE.md`, `planner-delivery` skill.

## Ловушки v8.30.51 (manual drift guards + CSS cascade pilot)

- **UserManual drift надо ловить как product contract, а не ручным grep после аудита.** Свежий пример: UI уже называл density-кнопку «Стандартный режим», а справка всё ещё писала Comfortable. Guard `user-manual-drift.test.js` фиксирует текущие UI labels, role glossary и hotkeys, включая `Ctrl+Enter`. Codified by: `tests/unit/architecture/user-manual-drift.test.js`, `npm run docs:manual-check`.

- **CSS `@layer` нельзя мигрировать частями поверх unlayered CSS.** Unlayered normal rules имеют больший cascade priority, поэтому частичное оборачивание `print.css` или `a11y.css` может сломать overrides. Безопасный первый шаг: manifest в `base.css`, explicit link-order guard, `print.css` last + `media="print"`, budget на рост `!important`. Codified by: `tests/unit/architecture/css-cascade-contract.test.js`.

## Ловушки v8.30.50 (UI facade forcing v2, meta guards, visual baseline expansion)

- **Visual baseline с нерепрезентативным seed — почти то же, что отсутствие baseline.** Первый overload seed для selection report давал `0 задач` во всех алгоритмах: screenshot был зелёный, но не защищал реальный сценарий выбора. Для visual regression seed должен показывать прикладное состояние: перегруз есть, но хотя бы один осмысленный вариант отбора остаётся доступен. Codified by: `tests/e2e/visual.spec.js`.

- **`[hidden]` лучше `style.display = 'none'` для optional DOM slots.** В task card JIRA/comment slots можно скрывать семантически через `hidden`; это уменьшает inline-style surface и упрощает architecture guard. Старые unit-тесты нужно проверять на `element.hidden`, не на `style.display`. Codified by: `tests/unit/ui/taskList.test.js`, `tests/unit/architecture/meta-helper-grep-discipline.test.js`.

- **Regex guard должен быть достаточно узким, чтобы не наказывать правильный код.** Проверка inline handler'ов сначала поймала переменную `onReload`. Правильный grep для CSP-инварианта — искать именно HTML attribute pattern (`<[^>]*\\son[a-z]+=...`), а не любые JS identifiers, начинающиеся с `on`. Codified by: `tests/unit/architecture/meta-helper-grep-discipline.test.js`.

- **Facade split без contract-test быстро деградирует.** Как только крупный UI-файл превращён в фасад, рядом нужен architecture test, который запрещает вернуть section builders/render helpers в корень. Иначе следующий удобный фикс опять начнёт наращивать фасад. Codified by: `task-list-facade-contract.test.js`, `selection-report-facade-contract.test.js`.

- **Playwright final summary может быть слишком поздним для WebKit shutdown race.** В full e2e `mobile-webkit` прошёл все 18 тестов, но затем ждал 300s worker stop timeout до summary. Для Windows `mobile-webkit` runner должен считать `Running N tests` + все `ok 1..N` строки и только после полного all-ok evidence делать pre-summary tree-kill с явным `[OVERRIDE]`. Нельзя превращать это в общий stdout-pass heuristic для всех browser projects.

- **Full coverage не обязан идти serial.** `npm run test:coverage -- --runInBand` занял ~130s; тот же полный coverage с `--maxWorkers=50%` прошёл за 14s с теми же `1779/1779` и 96.61% lines. Использовать `--runInBand` только как fallback для диагностики flaky isolation, а релизный gate держать параллельным.

## Ловушки v8.30.49 (глубокий split, architecture/property/visual gates)

- **Jest coverageThreshold с glob-ключом работает как per-file gate.** Для layer floor'ов вида `domain >= 95%` использовать directory keys (`./js/domain/`, `./js/state/`), иначе Jest начинает требовать порог от каждого отдельного файла под glob'ом и ломает gate на старых небольших модулях. Проверять результат только реальным `npm run test:coverage -- --maxWorkers=50%`, не по интуиции из конфига.

- **Visual regression PNG могут быть молча проигнорированы глобальным `*.png`.** Если проект игнорирует screenshot dumps, Playwright baselines надо явно unignore'ить: `!tests/e2e/visual.spec.js-snapshots/` и `!tests/e2e/visual.spec.js-snapshots/*.png`. После `--update-snapshots` обязательно `git status --ignored` по snapshot-папке: baseline, который не попал в git, не защищает релиз.

- **Full e2e runner очищает `test-results`, включая smoke summary.** Если нужно валидировать release metrics и для smoke, и для full e2e, запускать `verify:release-metrics` сразу после smoke или копировать smoke summary во временный файл вне `test-results` до запуска full. Потом временный файл удалить, чтобы не закоммитить служебный артефакт.

- **Mobile form fill во время Playwright action может быть flaky без value-assert.** В mobile smoke один прогон показал validation-modal «Название задачи обязательно» после `fill()`. Для критичных форм после `fill()` добавлять `toHaveValue()` и только потом нажимать submit, особенно перед `scrollIntoViewIfNeeded()` / mobile viewport / WebKit-подобными режимами.

## Ловушки v8.30.30 (девятый внешний аудит — npm-обёртка ломает Playwright workers, false EXIT-измерение, drag fake-asserts)

- **`$?` после bash pipe возвращает exit code последней команды pipe'а, не первой.** `cmd | tail -N; echo $?` ВСЕГДА выдаёт 0 (tail успешен), даже если `cmd` упал. Я v8.30.29 отчитался «EXIT=0» из этой кривой команды, в реальности `npm run test:e2e` exit был 1. Корректные способы: `cmd > /tmp/log 2>&1; echo $?` (без pipe) или `cmd | tail; echo "${PIPESTATUS[0]}"`. Любой PASS-метрик в RELEASE_NOTES рядом с `[EXIT=N]` — проверь как был получен exit-code. См. memory `feedback-exit-code-after-pipe-lies`.

- **Playwright workers с WebKit project на Node 22+ Windows зависают** (race в browser context close). Reporter показывает PASS, но Playwright ждёт `kWorkerStopTimeout = 300000ms = 5 min` на каждый worker, потом force-kill → wrapper exit 1. Race **flaky** — иногда 9s exit 0, иногда 309s exit 1 без изменения конфигурации. Не лечится: удалением wrapper, удалением html reporter, `reuseExistingServer: false`, `--workers=1`, изменением `script-shell`. Решение в PLANNER — `scripts/e2e-runner.mjs`: мониторит child.stdout, при detected `N passed (M total)` summary ждёт 3 сек, форсит SIGTERM/SIGKILL и exit'ит с counted результатом. Не маскирует failures (real test fail → exit 1). См. memory `feedback-playwright-webkit-worker-hang-on-node22-windows`.

- **Drag E2E с `mouse.move/down/up` или `dispatchEvent(new DragEvent(...))` НЕ trigger'ит HTML5 native dragstart** в Playwright. Для real drag используй `locator.dragTo()` (использует CDP под капотом, fires native dragstart). Или `mouse.down + mouse.move(steps=N≥5) + проверка во время drag'а + mouse.up`. v8.30.29 «drag and drop reorders tasks» имел `expect(typeof newFirstTitle).toBe('string')` — fake-assert (всегда true). Три preview-теста использовали synthetic dispatch. Аудитор поймал. v8.30.30 — replaced with real Playwright drag + assertion порядка/класса. **Никогда** не оставлять «may not work in all environments» как pass-condition.

- **Test:e2e:smoke gate** — pre-release smoke на mobile-webkit (исторически самый проблемный project). Запускать ДО написания RELEASE_NOTES метрик. Архитектурно: arch-test проверяет наличие `test:e2e:smoke` в package.json, прямой вызов через runner.

## Ловушки v8.30.29 (восьмой внешний аудит — npm run test:e2e exit-code, NODE_OPTIONS в workers)

- **`NODE_OPTIONS` через env spawn'a — НЕ передавать в Playwright workers.** Playwright spawn'ит worker'ов через `child_process` с `inherit env` — любой `--disable-warning=*` / `--no-deprecation` / иной debugging-флаг утекает в каждого worker'а. На Node 22+ это может ломать lifecycle (`worker process did not exit within 300000ms — force-killed it`). В v8.30.28 `scripts/run-e2e.mjs` ставил `NODE_OPTIONS=--disable-warning=DEP0205` → reporter показывал 211 PASS, но **exit code был 1**. RELEASE_NOTES v8.30.28 ложно заявлял «211 PASS» — это повтор паттерна v8.30.24. **Правильный способ передать Node CLI-флаг только main process'у — argv**: `spawn(node, ['--disable-warning=...', cliPath, ...args])`. Node парсит argv до запуска скрипта, child'ы наследуют env (не argv) → флаг не утекает. Архитектурный invariant: `tests/unit/architecture/e2e-runner-must-not-pollute-node-options.test.js` блокирует регрессию at-commit. См. memory `feedback-node-options-pollutes-playwright-workers`.

- **Exit code последнего реального запуска — единственный source-of-truth для RELEASE_NOTES.** Если reporter говорит «N PASS», но `echo $?` после команды даёт `1` — это **red** релиз, не PASS. v8.30.28 я полагался на reporter-вывод, не на exit code → 211 PASS + exit 1 в release заявлено как 211 PASS. Калибровка: ВСЕГДА после команды с PASS-цифрами в RELEASE_NOTES — `command; echo "[EXIT=$?]"` в выводе. Если exit≠0, цифры идут с пометкой «но wrapper exit failed: <reason>», не маскируются.

## Ловушки v8.30.28 (накоплены за седьмой внешний аудит — sticky root cause)

- **`body/html { overflow-x: hidden }` ломает sticky на ВСЕХ engines, не только WebKit.** В v8.30.27 я думал, что это WebKit-specific (потому что Chromium «прощает больше»). Real e2e тест с `boundingClientRect.top` before/after scroll показал — sticky сломан и на Chromium тоже. Раньше (v8.30.26) был visibility-only тест который проходил, RELEASE_NOTES ложно заявлял «Chromium sticky работает». В v8.30.28 root cause устранён: `html/body overflow-x` убран из `css/base.css`, точечно зафиксен `.toolbar__actions { flex-wrap: wrap }` на mobile, `.panel--matrix` сохраняет `overflow-x: auto` для wide-таблиц. Real тесты PASS на ОБОИХ engines (Chromium + WebKit). См. memory `feedback-body-overflow-breaks-sticky-on-all-engines`.

- **`test.fixme` / `test.skip` / `test.only` / `force:true` в e2e — zero tolerance, arch-test блокирует.** В v8.30.27 я пометил sticky-тесты `test.fixme` потому что они «не работают». В v8.30.28 — root cause закрыт, fixme убран. Защита: `tests/unit/architecture/no-e2e-fixme-skip-only-force.test.js` сканирует tests/e2e/*.spec.js статически, EXEMPT_FILES=[] по умолчанию. Любое появление этих паттернов — fail at commit-time. См. memory `arch-test-for-e2e-fixme-skip-only`.

- **Тест должен ДОКАЗЫВАТЬ behaviour, не проверять DOM presence.** Real sticky test: `bcr.top` before/after scroll + setup-check `maxScroll > absoluteTop`. Real focus-trap test: `dispatchEvent(Shift+Tab)` + assert `activeElement === lastFocusable` + `defaultPrevented === true`. `expect(el.toBeVisible())` не подходит — падает только при `display:none`, а сломанное sticky отлично visible. Правило для каждого `expect`: «если бы поведение было сломано, этот expect упал бы?». См. memory `feedback-test-must-prove-behaviour-not-dom-presence`.

- **«Known limitation» в RELEASE_NOTES — flag для следующего аудита, не отговорка.** Если касается заявленной функции релиза — починить, не накапливать. v8.30.21→28 (7 аудитов подряд) каждый раз накопленные «backlog» оказывались scope-violations в текущем. Audit known limitations КАЖДЫЙ release: `git log -p RELEASE_NOTES.md` за 3-5 релизов, выписать всё «Known / backlog / в v8.X.X+», проверить применимость к текущему scope. См. memory `feedback-known-limitations-audited-in-next-pass`.

## Ловушки v8.30.27 (накоплены за шестой внешний аудит — REAL sticky / status-vs-modal / selector / iOS Safari / honesty)

- **`role="status"`/`role="alert"`/`role="log"` НЕ должны идти через modal API.** Live region семантика — AT announces, focus НЕ перехватывается. Modal-API (focus-trap, save previously-focused) ломает это. v8.30.27 — `#globalProgress` (role="status") в `fileController.js` шёл через `showModal` → получал modal behavior. Разделение API: `showStatusOverlay`/`hideStatusOverlay` для status/live regions; `showModal`/`hideModal` только для `role="dialog"`/`role="alertdialog"`. Архитектурный invariant-тест в `tests/unit/architecture/modal-targets-must-be-dialog.test.js` ловит любые регрессии: парсит все `showModal(arg)` → target ID → проверяет `role="dialog"` в index.html. См. memory `feedback-status-vs-modal-api-split`.

- **Mobile Safari (iOS) ≠ Desktop Safari** в Playwright. Devices['Desktop Safari'] — это WebKit engine на 1280×720 viewport, mobile.spec.js там не применим (burger {display:none} на >600px). Для Mobile Safari coverage нужен **отдельный** project с `devices['iPhone 13']` (390×844). В v8.30.27 добавлен `mobile-webkit` project, запускает mobile.spec.js. 6/6 PASS.

- **`FOCUSABLE_SELECTOR` должен исключать hidden/aria-hidden/disabled-fieldset/tabindex=-1.** v8.30.26 selector включал `input[type="hidden"]` (служебное поле, никогда не получает focus в браузере). Это вело к ложному выбору первого focusable в `showModal` (focus на hidden input). Tightened selector: `input:not([disabled]):not([type="hidden"]):not([aria-hidden="true"])` + post-filter `closest('[hidden],fieldset:disabled,[aria-hidden="true"]')`. Post-filter работает в jsdom (нет computed style зависимости). Unit-тесты в `tests/unit/ui/modalManager.test.js` доказывают каждый случай.

- **Архитектурный invariant ловит drift лучше чем unit-тест.** Архитектурный тест парсит код статически + сверяет с другим артефактом (HTML, config, manifest). Если разработчик добавит `showModal(newToastEl)` где `#newToastEl` имеет `role="status"` — тест падёт **at commit**, без необходимости отдельного интеграционного теста. См. `modal-targets-must-be-dialog.test.js` как эталон.

- **Docs honesty = test-backed.** Каждое утверждение в RELEASE_NOTES должно иметь соответствующий test. «Подтверждено» рядом с тестом который ничего не проверяет — это маркетинг, не engineering. v8.30.26 RELEASE_NOTES заявлял «Safari sticky подтверждено» с visibility-only тестом → это была ложь. v8.30.27 RELEASE_NOTES честно говорит «Safari sticky НЕ работает, документировано как known engine limitation, test fixme с reason» — это test-backed honesty.

## Ловушки v8.30.26 (накоплены за пятый внешний аудит — mobile burger / ARIA tabs / focus-trap / Safari)

- **«Known limitation» НЕЛЬЗЯ использовать для P1/P2 нарушений ЗАЯВЛЕННОЙ функции релиза.** v8.30.25 я задокументировал mobile burger menu как Known limitation #1, потому что HTML-элемент `.mobile-menu-toggle` не существовал и `.tabs-container` на mobile (≤600px) был физически недоступен. Аудитор сразу указал: «релиз с заявкой mobile-a11y-audit не может иметь сломанной mobile navigation». Правило: перед записью в Known limitations — проверка «это ограничение внутри scope текущего релиза?» Если ДА → починить, не документировать. Калибровка: формула «можешь ли честно сказать "это работает" про заявленную функцию?» — если для X% пользователей ответ «нет» (mobile-юзеры ~ 30-50% PWA), это release blocker, не limitation. См. memory `feedback-known-limitations-not-for-scope-violations`.

- **ARIA tabs pattern имеет конкретный W3C spec.** `<button role="tab">` без `aria-selected`/`aria-controls`/`role="tabpanel"`/keyboard arrow navigation — **обещание screen-reader'у без выполнения**. Это **хуже** обычных `<button>`, потому что AT-пользователи слышат «таб» и ждут arrow-nav (W3C tabs pattern), а получают normal Tab focus. Полный обязательный паттерн: `aria-selected` sync при activate, `aria-controls="<panelId>"`, `role="tabpanel" aria-labelledby="<btnId>"` на каждой panel, roving tabindex (0 на активной, -1 на остальных), keydown handler ArrowLeft/Right/Home/End → `activateTab` + `nextBtn.focus()`. Эталон реализации — `tabController.js` после v8.30.26. См. memory `feedback-aria-tabs-pattern-complete`.

- **`aria-modal="true"` ОБЯЗЫВАЕТ JS-реализованный focus-trap + restore previously-focused.** ARIA-атрибут говорит screen-reader'у «фокус заперт в модалке», но если `showModal/hideModal` не делает Tab-trap — Tab выходит на background buttons. WCAG 2.1.2/2.4.3/3.2.1 fail. Полный универсальный паттерн в `modalManager.js` после v8.30.26: при `showModal` сохранить `document.activeElement` как `modal._previousFocus`, добавить keydown-handler для Tab/Shift+Tab wrap (focusable первый ↔ последний), focus на первый focusable через `requestAnimationFrame`. При `hideModal` снять handler, restore focus через `document.contains(prev)` (защита от удалённого узла). См. memory `feedback-modal-focus-trap-pattern`.

- **Cross-engine coverage обязателен при заявке cross-platform.** README/UserManual PLANNER обещают установку PWA на iOS Safari — `playwright.config.js` должен иметь `webkit` project. v8.30.25 имел только `chromium` + `mobile-chromium` (engine — Chromium). Известный Safari sticky-риск под `html { overflow-x: hidden }` (документирован в `css/base.css:223`) не покрывался. Engine-specific smoke suite (`webkit.spec.js`) проверяет конкретные quirks: page-load без console errors, sticky behaviour, focus-trap. **Не нужна** полная копия 193 тестов — это избыточно; нужен таргетированный smoke по известным engine-quirks. См. memory `feedback-cross-engine-coverage-required`.

- **Не маскировать P1 через test workaround.** `mobile.spec.js:67` в v8.30.25 переключал criteria tab через `page.evaluate()` синтетически (класс `.active` + `style.display`), потому что real user path (`click .tab-btn`) не работал на mobile (см. burger menu выше). Это давало зелёные 198/198, но **скрывало** что заявленная функция (переключение tab на mobile) сломана. Адверсарный аудитор поймал. Правило: если для реального user-path тест требует `page.evaluate()` обхода — починить user-path, не подгонять тест. Если временно нужно — явный `test.skip(reason)` или `test.fixme`, не зелёный test. См. memory `feedback-force-true-masks-prod-bug` (тот же класс ошибки в Playwright context).

- **`offsetParent !== null` filter ломает focus-trap в jsdom-тестах.** jsdom не делает layout → offsetParent всегда null → filter возвращает только activeElement → first === last → Tab всегда intercepted (false positive в test). В production браузере offsetParent корректно отражает visibility. **Решение**: в `getFocusableElements` не использовать offsetParent filter — положиться на `:not([disabled])` в selector. Hidden focusable дети открытой модалки редки (display:none CSS-rule убирает целые ветки из querySelectorAll). Если действительно нужна visibility-проверка для production — использовать `getComputedStyle(el).display !== 'none'` + walk parents, но только за пределами jsdom (env-check).

- **Bump-script перед commit не запускать «на финале» — он меняет HTML/sw/version.js, что может конфликтовать с e2e-тестом.** v8.30.26 после `npm run bump 8.30.26` — `sw.js CACHE_VERSION` обновился, `index.html` link cache-bust обновился. Если e2e-тест запущен ПАРАЛЛЕЛЬНО с bump — service worker может пытаться загрузить старый bundle. Правило: bump в самом конце pre-commit (после всех зелёных тестов), затем re-run unit+e2e для подтверждения что bump не сломал. v8.30.26 — re-run после bump = 1364/1364 unit + 199/199 e2e PASS.

## Ловушки v8.30.25 (накоплены за внешний аудит mobile/a11y/cache + adversarial-pass)

- **Релиз с red e2e — категорический нельзя.** v8.30.24 ушёл с 192/193 PASS, RELEASE_NOTES ложно отрапортовал «193 PASS». Источник: я доверял прошлому run'у, не запустив `npm run test:e2e` повторно после правок formatNumber (`5,0`→`5` контракт сломал тест на 256-й строке `tests/e2e/planner.spec.js`). Правило: **exit code последнего реального запуска** — единственный источник истины. Не «по тестам должно быть OK», не «суммирую логи». Хук как минимум: если в RELEASE_NOTES PASS-цифры — рядом stdout последнего запуска (или ссылка на CI-run). См. memory `feedback-release-with-red-tests-banned.md`.

- **Mobile E2E проект обязателен для PWA.** `playwright.config.js:17-22` имел только `Desktop Chrome`. Заявленная PWA-mobility (UserManual.md упоминает «работа на мобильных устройствах») не покрывалась тестами. На Pixel 5 viewport (393×851) `scrollWidth = 767px` — горизонтальный overflow от `.panel--matrix` capacity table (≈634px), `addTaskBtn` физически за viewport. Решение: новый project `mobile-chromium` с `testMatch: /mobile\.spec\.js$/` (5 invariant-тестов `documentElement.scrollWidth ≤ innerWidth`), desktop project через `testIgnore` чтобы не дублировать. **Инвариант для любого responsive проекта**: если в копи product'а есть слово mobile/PWA/responsive, нужен mobile E2E project с overflow-invariant'ом.

- **`<button>` для accordion-header — урок не применён в одном файле, хотя есть в соседнем.** `selectionReport.js:170-175` рендерил `<div class="accordion-header" title="...">` без `role`/`tabindex`. Listener только `click` (стр. 450) — Enter/Space не работали. Соседний `criteriaList.js:85-95` уже использовал native button после v8.30.2. Это **повтор того же класса ошибки в другом файле** — родственный поиск §5.bis не был выполнен на тот момент. Чинится: `<button type="button" class="accordion-header" aria-expanded="false" aria-controls="...">`, sync `aria-expanded` в click-handler. CSS-reset для button (`color:inherit; font:inherit; text-align:left; display:block`) лучше держать рядом с базовым правилом, не в media query.

- **Cache key обязан включать ВСЕ поля, влияющие на отбор.** `buildAlgorithmsCacheKey` (`selectionHelpers.js:31-37`) хешировал `id/excluded/est/priorityScore`, но **не** `dependencies`. `selectTasksUniform` (`base.js:159-166`) использует `task.dependencies` при отборе → смена deps без `est`/`excluded` отдавала stale-результат из кэша. **Алгоритмический инвариант**: cache key = функция от ВСЕХ полей, читаемых алгоритмом. Контролировать при code-review «какие поля прочитаны selectTasksUniform?» → все в ключе.

- **Symmetric guard на entry point данных, не в downstream.** `JSON.stringify(task.dependencies || [])` бросал `TypeError` на циклическом объекте из malicious import. Чинить НЕ в `selectionHelpers` (downstream), а в `normalizeTasks` в `persistence.js` (entry point). Контракт: `normalizeTaskDependencies(deps)` возвращает `Array<number|string≤63ch>`, max 100, не-массив → `[]`. См. §3.quat глобального CLAUDE.md «симметричные guard'ы на ВСЕХ entry points».

- **`html { overflow-x: hidden }` маскирует mobile overflow, ломает sticky на ВСЕХ engines** (устаревшее утверждение v8.30.25 «двойственное решение» обновлено в v8.30.28 после real test): «Chromium прощает» — это была lie от visibility-only теста. Real test показал sticky сломан и на Chromium. Решение в v8.30.28: убрать `html/body overflow-x: hidden`, точечно зафиксить КАЖДЫЙ источник horizontal overflow (`.toolbar__actions { flex-wrap: wrap }` на mobile, `.panel--matrix { overflow-x: auto }`). См. ловушки v8.30.28 выше.

- **`force: true` в Playwright = code smell, маскирует production-баги.** Применил `click({ force: true })` для `#addTaskBtn` на mobile, объяснив «residual hover-tooltip». Adversarial-аудит верно указал: реальные пользователи не могут «force»-кликнуть. Скрытие issue в тесте = баг в проде. Правило: если `click()` без `force` падает — починить источник (z-index, overflow, position). `force: true` допустим **только** если actionability-check имеет ложно-срабатывающую эвристику (доказано отдельным тестом).

- **Тест mobile invariant на `documentElement.scrollWidth`, не `body.scrollWidth`.** Я попробовал заменить на `body.scrollWidth` ради «честности» — получил false positives, потому что `body.scrollWidth = 634` показывал contentful overflow `.panel--matrix`, что **легитимно** для горизонтально-скроллируемых таблиц. Правильный visual invariant — **только** `documentElement.scrollWidth` (то, что видит пользователь). `body.scrollWidth` логировать как diagnostic, но не падать на нём.

- **Adversarial-pass субагентом ОБЯЗАТЕЛЕН после моего 8-осевого ручного self-audit.** 8 осей дают широту (организация/слои/state/DOM/persist/a11y/errors/практики), но **не** ловят P-level пункты класса: «нарушение собственного правила проекта» (sticky-spec, sym guard), «test masking» (force:true), «accumulated-experience violation» (соседний файл с тем же паттерном). Calibration: 4 P-level из adversarial — это **повторяющийся** паттерн, ровно как в v8.30.0 → v8.30.18 цикле. Тратится 4 минуты, экономит следующий внешний аудит.

- **«Recommend отдельным PATCH'ем» — антипаттерн (повтор v8.30.18).** Если в self-audit упомянул родственное «но решил отложить» — починить в той же волне. Adversarial-аудит P3 #9 поймал меня на этом: написал в `mobile.spec.js` комментарий «отслеживается» про `.mobile-menu-toggle` dead CSS, но не открыл явный TODO. Лечится: либо чинить, либо явно документировать в Known limitations в RELEASE_NOTES с конкретным file:line. Чисто-комментарий «отслеживается» — недопустимо.

## Ловушки v8.30.4 (накоплены за регрессию печати v8.30.3)

- **Print rendering верифицировать ТОЛЬКО на A4 viewport (794×1123 @ 96dpi).** Default Playwright viewport 1280×720 — на нём print layout выглядит хорошо, но реальная A4-печать с margin ≈ 700px эффективной ширины. Если flex-items не помещаются — `flex-wrap: wrap` раскладывает каждый на свою строку. **Третья регрессия подряд** именно из-за неверифицированной ширины: v8.30.1 grid auto-fit смещение, v8.30.3 flex-direction column, v8.30.3 (после моего фикса) flex-wrap. Решение: `await context.newPage({ viewport: { width: 794, height: 1123 } })` ОБЯЗАТЕЛЕН для любого print-verify.

- **`display: inline-flex` + `flex-wrap` для печати — анти-паттерн.** Лучше — flowing inline text: `display: inline-block` для chip'ов внутри `display: block` контейнера. Браузер wrap'ает как абзац, по словам/пробелам, давая 1-2 строки на длинный список вместо 7. Внутри chip'а: `display: inline` + `white-space: nowrap` (или `&nbsp;` через `content: ":\00a0"`) защищают от разрыва label↔value.

- **`<input>` без явной ширины при печати = 173px (size=20 default).** Между значением и суффиксом «ч» зияет огромный gap. Решение: `field-sizing: content` (Chrome 123+, Firefox 122+) — подгоняет под содержимое; fallback `width: 2.4em` для старых браузеров. Эта же ловушка дважды попадалась в v8.30.1/v8.30.3.

## Ловушки v8.30.3 (накоплены за третий code-review pass + жалоба на печать)

- **`String(x).replace(/"/g, '&quot;')` — это НЕ escapeHtml.** Это эскейп ДЛЯ АТРИБУТОВ (защита кавычек), но `<`, `>`, `&` остаются raw. В innerHTML тексте — XSS. Если один и тот же объект попадает И в `title="..."`, И в `${x}` тело тега — нужен `escapeHtml()` (он закрывает все четыре символа). v8.30.3: `taskFormController.populateCreateCriteriaSelects()` использовал «защиту атрибутов» для имени критерия, а аббревиатуру вставлял raw → malicious import `<img onerror=...>` исполнял JS. Test pattern: подать payload, проверить `container.querySelector('img,script')` === null + sentinel `window.__xss*` остаются undefined.

- **`localStorage.getItem` бросает SecurityError, не только setItem.** Safari private mode + заблокированный Storage Access блокируют ОБА. Если getItem не в try/catch и зовётся ДО рендера (FOUC head-script, init контроллера), приложение падает до первого пикселя. Решение: try/catch + fallback на `matchMedia('(prefers-color-scheme:dark)')` для темы, на `null` для остальных. До v8.30.3 я защитил только setItem (v8.30.0/8.30.2), get остался незащищён.

- **`cache.put(response)` в Service Worker без `response.ok` отравляет offline-cache.** Любой 4xx/5xx/opaque ответ попадает в кэш, Cache-First отдаёт его до ручного очищения. Особенно зло при temp-503 от CDN: после восстановления сети пользователь продолжает видеть error-page. Helper `isCacheableResponse(r) => r.ok && (r.type === 'basic' || r.type === 'cors')` + архитектурный инвариант `tests/unit/architecture/sw-cache-poisoning.test.js` (грепает каждый `cache.put` и требует guard в окне ±400 символов).

- **`HTMLAnchorElement.prototype.click()` в jsdom = console pollution.** jsdom не реализует navigation, поэтому `<a download>.click()` пишет «Not implemented: navigation» в console.error при каждом тесте. Решение: `jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})` + restore. Применимо ко всем `<a>.click()` / `<form>.submit()` / mutation `window.location` в jsdom-тестах.

- **`flex-direction: column` в base CSS побеждает `display: inline-flex` в print/responsive.** v8.30.3: я изменил `.criteria-eval-item { display: inline-flex }` в `print.css`, но НЕ сбросил `flex-direction: column` из `task-card.css:721`. В итоге каждый chip (abbreviation/weight/contribution/score) укладывался друг под другом — задача занимала 4 строки на КАЖДЫЙ критерий. Решение: явный `flex-direction: row !important` в print override. **Урок:** при изменении display в print/responsive обязательно grep base на `flex-direction` того же селектора — он наследуется и ломает inline layout. Test-инвариант сложен — визуальный регрешн ловится screenshot'ом через Read tool.

- **UserManual.md цитирует UI, которого больше нет.** v8.27 убрал emoji в кнопках (правило «эмодзи в UI запрещены»), но UserManual продолжал ссылаться на «🙈 закрытый глаз» и «🗑️ Удалить всё». Это вводит пользователя в заблуждение. При любой смене UI-иконки или копи кнопки — grep UserManual + README + helpController-fetch'ы. Идея для будущего инварианта: парсить `<button>` в index.html + цитаты в UserManual через regex.

## Ловушки v8.30.2 (накоплены за второй code-review pass)

- **Self-audit ДОЛЖЕН grep'нуть проект по правилам, ТОЛЬКО ЧТО применённым в текущей сессии.** Если ты починил `<div role="button">` в одном файле — grep'ни проект на `role="button"` ВСЕ места. То же для `localStorage.setItem` без try/catch, для inline `onclick`, для `Date.now()` fallback id. В v8.30.0 я починил 2 случая nested-interactive и storage swallowing, объявил «audit пройден», но пропустил scale-toggle (тот же файл что и criteria-header!) и numberFormat.saveSettings (сосед storage.js в services/). Ревьюер нашёл за 30 минут. См. memory `feedback_self_audit_must_apply_just_learned_rules.md`.

- **PWA precache contract — архитектурный инвариант.** Каждый `<link rel="stylesheet" href="css/X.css">` в index.html ДОЛЖЕН быть в `ASSETS_TO_CACHE` в sw.js. Иначе offline загружается без части оформления. Тест: `tests/unit/architecture/precache-coverage.test.js` — парсит index.html, сверяет с sw.js. Это «boring» инвариант, который ловит регрессии at-commit, а не at-user-complaint.

- **`localStorage.setItem` ВЕЗДЕ должен быть в try/catch, не только в одном service.** Если в проекте >1 persist-точки — каждая должна возвращать `{ok, error}`. App.saveToLS проверяет ВСЕ результаты, snackbar при любом fail'е. Инвариант: `tests/unit/architecture/persist-must-have-try-catch.test.js` — grep на каждый setItem в js/services/.

- **`manifest.json?v=...` cache-bust должен совпадать с APP_VERSION.** Установленные PWA читают manifest через старый URL, если `?v=` не обновился. `scripts/bump-version.mjs` теперь обновляет index.html. Инвариант в `pwa-icons.test.js`: cache-bust версия === `package.json.version` (не просто формат).

- **Grid `auto-fit` + `display:contents` на flex-children = сюрпризы при печати.** v8.30.1 print layout использовал `grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))` + `display:contents` на header-обёртке + `text-align: right` на input. В результате input первого grid-item визуально оказывался в начале следующей cell. Решение в v8.30.2: блочный layout (каждый item — отдельная строка `display: block`), фиксированная ширина input (`3.5em` вместо browser default ~173px). Применимо к любому print или narrow-column layout, где flex/grid и `display:contents` усложняют отладку.

- **Скриншот печати ОБЯЗАН быть просмотрен внимательно через `Read` tool, не просто «тесты passed».** В v8.30.1 первый скриншот через Playwright уже показывал «UI/UX: 0,0  ↩  c CA:» (символ `c` от `ч` UI/UX прилип к началу `CA:`). Я отметил как «минорный косяк суффикса» и доложил «работает». Это failure to read carefully. Теперь правило: при любом UI-фиксе с screenshot — открыть .png через Read и реально сравнить с описанием ожидаемого результата перед отчётом.

## Ловушки v8.30.0 (накоплены за code-review pass)

- **Nested interactive controls в expand/collapse паттернах.** `<div role="button" tabindex="0">` с focusable `input`/`<button>` внутри — axe-core «serious» (WCAG 4.1.2). Решение: native `<button class="...-toggle-btn">` рядом с input/actions, не вокруг. Native button сам обрабатывает Enter/Space — отдельный keydown listener больше не нужен (минус один источник ошибок). Эталон: `criteriaList.js` → `.criteria-item-toggle-btn`, контроллер ловит только click. CSS: header теряет `cursor: pointer`/`role`/`focus-visible`, всё переезжает на toggle-button.

- **Progressive rendering через `requestIdleCallback` без generation-token = stale-DOM при быстром re-render.** Async-callback держит closure на `remaining` от старого state. Если state меняется до завершения батчей, старый callback продолжает аппендить в уже очищенный новый DOM. Решение: module-level `let renderGeneration = 0`, инкремент в начале render, abort-check (`if (myGeneration !== renderGeneration) return`) в каждом async callback. Тестовый хук `_getRenderGeneration()` — обязателен, иначе unit-тест на гонку невозможен. Эталон: `taskList.js`.

- **`storageService.save()` НЕ должен глотать ошибки.** `try { ... } catch {}` без сигнала — пользователь теряет работу после F5, думая, что данные сохранены. Контракт: `{ok: true} | {ok: false, error: string}`. Caller (App.saveToLS) при `!ok` показывает throttled snackbar (≤1 в 30 сек чтобы не спамить при повторных fail'ах) с инструкцией скачать JSON через UI. Эталон: `js/services/storage.js` + `js/app.js::_notifyPersistFailure`.

- **`Date.now()` как fallback id в синхронном `map()` даёт коллизии.** Несколько элементов попадают в одну ms. `normalizeTasks` имел этот баг (`normalizeInteger(task.id, Date.now(), 1)` — все задачи без id получали одинаковый Date.now()). То же касалось `normalizeCriteria` с default `id=0` (все без id → 0). Решение: `createIdAllocator(existingIds, minBase)` — собирает уже использованные id, инкрементируется от `max(used)+1`. Эталон: `js/state/persistence.js`.

- **Coverage gate vs sourceMap в vendor.** Если `js/vendor/<lib>.min.js` имеет `//# sourceMappingURL=<lib>.min.js.map` и `.map` файла нет рядом, v8-coverage reporter упадёт. Решение: `jest.config.cjs.collectCoverageFrom` ИСКЛЮЧАЕТ `!js/vendor/**`. Это и так правильно — vendored библиотеки не нужно покрывать unit-тестами.

- **Vendored DOMPurify ≠ npm DOMPurify.** Runtime использует `js/vendor/purify.min.js@3.4.2` (закоммичен в репо), npm-зависимость `dompurify` — dev-only (не загружается браузером). При `npm audit` поднимать npm-pin (`^3.4.4+`), но не забывать про vendored — он живёт отдельно. Когда обновляется vendored, проверять что версии не расходятся слишком сильно.

- **«Эмодзи в UI запрещены» включает `messageService.showMessage()`.** Это не console.alert, это modal — UI. Эмодзи в тексте (📋 🔍 📌) — нарушение. Использовать «Общие рекомендации:» / «Алгоритм X:» как plain text заголовки. SVG-иконки — только в HTML-рендере.

- **`updateTabTitle(state)` через `textContent = '⚖️ ...'` стирает SVG из HTML.** Если index.html рендерит `<button><svg/>Tab</button>`, то `textContent = '⚖️ Tab (N)'` уберёт svg. Решение: `innerHTML = \`${icon('scale')}<span>...</span>\``. Если в шаблоне есть SVG-иконка — JS обязан её сохранить.

- **Inline `onclick="..."` в HTML блокирует строгий CSP.** Любой `onclick`/`onload`/`onchange` атрибут — `script-src 'unsafe-inline'`. Решение: id-handler + `addEventListener` в init контроллера. Для печати — `KeyboardController.init()` подцепляет `#printBtn`.
