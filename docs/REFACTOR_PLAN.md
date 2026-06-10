# REFACTOR_PLAN.md — Дисциплинированный рефакторинг PLANNER v2 (solo audit-trail)

> Audit-trail solo-режима (`docs/COLLAB.md` §0.1 — для dual). Baseline · findings ·
> waves · approvals · gates · final report. Production-код не трогается до `GO W<n>`.
> Dual-инфраструктура (`AGENTS.md`, `docs/COLLAB*.md`) создана и готова к переключению.

## Контекст запуска

| Поле | Значение |
|---|---|
| AGENT_MODE | solo (Claude) |
| Branch | `refactor/planner-v2-discipline` |
| Base commit | `2d518d2` (v8.30.68) |
| Date | 2026-06-09 |
| Scope | PLANNER-only (js/css/docs/tests/scripts/конфиги/CI) |
| OUT OF SCOPE | sprint-planner · FOR_USERS · GitHub Release · tag · downstream sync · новые фичи · смена стека |

## Фаза 0 — Baseline gates (реальный прогон, honest exit)

| Gate | EXIT | Результат | Лог |
|---|:---:|---|---|
| `npm run lint` | 0 | clean (eslint js/ sw.js) | `d:/tmp/bl-lint.log` |
| `npm run test:coverage -- --maxWorkers=50%` | 0 | **157 suites / 1933 tests PASS**; lines 96.19% · branch 86.56% · funcs 97.05% | `d:/tmp/bl-cov.log` |
| `npm audit` | 0 | 0 vulnerabilities | `d:/tmp/bl-audit.log` |
| `npm run docs:manual-check` | 0 | PASS (user-manual drift + auto-selection) | `d:/tmp/bl-manual.log` |
| `node scripts/report-css-important.mjs --check` | 0 | up to date (90/90) | `d:/tmp/bl-css.log` |
| `npm run test:e2e:critical` | 0 | 22 passed (13.8s, chromium critical) | `d:/tmp/bl-e2ecrit.log` |
| **DEFERRED:** full `npm run test:e2e` + webkit smoke | — | отложено в финальную верификацию (§6.2) | — |

> **§6.2 обоснование deferred full e2e:** chromium critical path (22 PASS) взят как
> baseline e2e-сигнал; full Playwright + mobile-webkit имеют известный WebKit
> worker-hang на Node22/Windows (см. CLAUDE.md / LESSONS_LOG) → запускаются через
> project-level runner в финальной верификации (Фаза 5), не как baseline-gate.

## Фаза 0 — Baseline-метрики (числа «до»)

| Метрика | До | Источник |
|---|---:|---|
| coverage lines | 96.19% | bl-cov.log |
| coverage branches | 86.56% | bl-cov.log |
| coverage funcs | 97.05% | bl-cov.log |
| unit test suites / tests | 157 / 1933 | bl-cov.log |
| e2e critical tests | 22 | bl-e2ecrit.log |
| architecture guard suites / tests | 34 / 209 | прошлый прогон |
| js modules (excl vendor) | 117 | find/wc |
| js LOC (excl vendor) | 13 624 | find/wc |
| top-5 LOC модулей | taskController 462 · selection/base 361 · recoveryController 357 · criteriaController 349 · store 347 | wc |
| CSS `!important` (report) | 90 | bl-css.log |
| inline `style=` в js (rough) | ~12 | grep |
| inline `on*=` в index.html (rough) | ~5 | grep |
| sw.js precache asset refs (rough) | ~157 | grep |
| npm vulnerabilities | 0 | bl-audit.log |
| dist/build size | _TBD (Фаза 4)_ | — |

## Фаза 1 — Read-only аудит (findings)

Фан-аут 8 анализаторов (1.5M токенов, 254 tool-use) → 27 кандидатов. Каждый лично
верифицирован (§7.9). Легенда Verified: **det** = детерминированно подтверждён мной
(grep/read); **evid** = принят по file:line-доказательству агента, полная верификация
при TDD-реализации.

| ID | file:line | Ось | Sev | Класс | Verified | Wave | Суть |
|---|---|---|:--:|---|:--:|:--:|---|
| DUP-1 | animations.css ↔ task-card-states.css:102-157 | дубли | P2 | behavior-preserving | det | W1 | байт-идентичные @keyframes fadeIn/slideOut + .dragging/.drag-over в 2 загружаемых файлах |
| SVC-2 | services/numberFormat.js:90 | service | P3 | behavior-preserving | det | W1 | no-op self-replace в NaN-ветке; 0 prod-вызовов trimTrailingZeros:false |
| TRASH-1 | ui/createTaskRowVM.js:156 | мусор | P3 | behavior-preserving | det | W1 | мёртвый export VM_CONSTANTS (0 импортёров) |
| TRASH-2 | css/components.css:105-109 | мусор | P3 | behavior-preserving | det | W1 | мёртвые .header-color-* (0 эмиттеров), stale-комментарий |
| TRASH-3 | css/components.css:115-125 + print.css:148-157 | мусор | P3 | behavior-preserving | det | W1 | мёртвые .progress-bg/.progress-fill (+2 print !important в budget) |
| TRASH-4 | css/responsive.css:182-189 | мусор | P3 | behavior-preserving | det | W1 | дубль .priority-score-container (600px копирует 900px) |
| TRASH-6 | js/config/commands.js:142,151,179 | мусор | P3 | behavior-preserving | det | W1 | 3 needless export (чисто-внутренние) |
| TRASH-7 | services/instanceLock.js:31-36; ui/selectionReport/sections.js:175 | мусор | P3 | behavior-preserving | det | W1 | 4 needless export |
| T1 | controllers/recoveryController.js:180-202 | тесты | P2 | test-only | det | W4 | atomic-rollback ветка не покрыта тестом |
| T2 | controllers/fileController.js:198-211 | тесты | P2 | test-only | det | W4 | sibling T1: rollback импорта + restoreRuntimeSnapshot без теста |
| T3 | domain/config.js:6 | тесты | P3 | behavior-preserving | det | W4 | hardcoded new Date(); siblings инъектируют now |
| T4 | ui/appVersionBadge.js:36 | тесты | P3 | behavior-preserving | evid | W4 | hardcoded new Date() в замыкании (low value) |
| DUP-3 | domain/task.js:88,131 | дубли | P3 | behavior-preserving | det | W4 | мёртвые export prepareTaskForSelection/sortTasksByPriorityScore (только тест) |
| COH-1 | controllers/criteria*+stateImportApplier; domain/criteria.js:26 | связность | P2 | behavior-preserving | det | W3 | eval↔criteria sync дублирован inline ×4; initializeCriteriaEvaluations мёртв; alignTasksToCriteria → в domain |
| SVC-1 | services/diagnostics/recovery/statePreview/storageHealth | service | P3 | behavior-preserving | det | W3 | finiteOrNull/byteLength дублированы (pure → utils; parseJson/safeStorageGet НЕ сливать) |
| SVC-3 | services/storageHealth.js:15-17 | service | P3 | bug fix | evid | W3 | backup storage-error репортится как 'missing' (асимметрия с главным ключом) |
| DUP-2 | domain/selection/quadrants.js:67-75 | дубли | P3 | behavior-preserving | evid | W3 | resolveEffort дублирует calculateTaskTotal (debatable) |
| L1 | tests/unit/architecture/layer-boundaries.test.js:50-71 | слои | P2 | architecture-only | det | W2 | нет правила from:'services' → services→Store/controllers пройдёт молча (gap, не активное нарушение) |
| L2 | layer-boundaries.test.js:61-65 | слои | P3 | architecture-only | det | W2 | ui→services неохраняем; selectionRecommendations→message — orchestration-утечка (debatable) |
| DOC-1 | docs/MODULE_MAP.md:42,145 | docs | P2 | docs-only | det | W6 | generated-doc устарел (2 строки расходятся с docs:modules) |
| DOC-2 | docs/ARCHITECTURE.md §5 | docs | P2 | docs-only | evid | W6 | CSS-таблица без toolbar/config-panel/blocked-screen.css (все linked в index.html) |
| DOC-3 | CLAUDE.md:431-432 | docs | P2 | docs-only | det | W6 | !important budget 167/128 ложь; факт 90/61 (budget JSON + ARCH §5) |
| DOC-4 | docs/ARCHITECTURE.md §8 | docs | P3 | docs-only | evid | W6 | structure-tree отстал (services 3/8, utils 7/10, нет recoveryController/stateImportApplier) |
| DELIVERY-1 | js/vendor/*.min.js; package.json | delivery | P3 | architecture-only | det | W7 | vendored purify 3.4.5 vs npm 3.4.7; marked 15.0.12 без npm-pin/audit; нет drift-guard |

### Debatable / intentional — рекомендация DEFER / SKIP (не FP, но не делать вслепую)
| ID | Решение | Обоснование |
|---|---|---|
| DUP-4 (matrix/hybrid/valueDensity преамбула) | **SKIP** | simplicity gate §2.4: −10 строк, но helper скроет намеренно-явный excluded-median инвариант (v8.30.68). Малая отдача. |
| DUP-5 (DFS dedup analyze↔migrate) | **DEFER** | намеренное разделение reporting/enforcing (CLAUDE.md §5.bis-2); согласованность охраняется alignment-invariant arch-тестом. Слияние свяжет слои. |
| TRASH-5 (addDays @deprecated) | **DEFER** | намеренная задокументированная deprecation, не случайный мусор. Удаление = решение владельца о backward-compat. |

### False-positives (личная верификация кандидатов)
**0 чистых false-positives.** Constrained-промпт (file:line обязателен, grep до claim,
запрет смены стека/фич) дал 0 фабрикаций — совпадает с эталоном 0/7 FP. Единственный
кандидат, который я подозревал как FP — **L1** — при чтении файла оказался реальным gap
(правило from:'services' отсутствует), а не ошибкой. Verdict: верифицирован как real.

## Фаза 2 — План по волнам

Все волны независимы. Каждая правка — TDD-first (§2.3), один classification-тег на
коммит, свежие gates per-commit (§9.6). **STOP-GATE: production-код не трогаю до `GO W<n>`.**

| Волна | Findings | Класс | Тест-стратегия | Gates | Метрика | Риск |
|---|---|---|---|---|---|---|
| **W1 cleanup** | DUP-1, SVC-2, TRASH-1/2/3/4/6/7 | behavior-preserving | characterization (SVC-2); visual baseline task-card/mobile/print (DUP-1, TRASH-2/3/4); dead-export remove + suite | lint·test·visual·css:important `--check` (+ budget JSON для TRASH-3: 90→88)·precache | −~80 LOC dead/dup, −2 !important, −5 export | низкий |
| **W4 testability** | T1, T2, T3, T4, DUP-3 | test-only / behavior-preserving | T1/T2: мок storage.save→{ok:false} → assert state откачен + showMessage; T3/T4: inject now → детерминир. тест; DUP-3 remove dead+test | coverage (ожидаем +branch) | покрыта atomic-rollback ветка ×2, −2 dead export | низкий |
| **W6 docs** | DOC-1, DOC-2, DOC-3, DOC-4 | docs-only | docs:manual-check; опц. arch-test MODULE_MAP==generator | docs:manual-check | 3 источника budget/structure согласованы | очень низкий |
| **W3 service/domain** | COH-1, SVC-1, SVC-3, DUP-2 | behavior-preserving (+SVC-3 bug fix) | per-finding TDD: COH-1 фиксирует delete/reset/add семантику до рефактора; SVC-1 unit нового utils-хелпера; SVC-3 мок throw на BACKUP_KEY | lint·test·coverage·layer-boundaries (COH-1 переносит alignTasksToCriteria→domain) | −4 inline eval-дубля, −~24 LOC service-дубля, +cohesion | низк-средний |
| **W2 guards** | L1, L2 | architecture-only | arch-test зелёный на текущем коде (0 нарушений), ловит будущий drift | новый arch-test | guard 4/6 → 5/6 слоёв | низкий (нужно design-решение по форме правила) |
| **W7 delivery** | DELIVERY-1 | architecture-only | arch-test читает `/*! license */` баннер vendor → сверка с pinned версией | новый arch-test·audit | drift vendored↔npm авто-детект | низкий |

**Рекомендация старта:** `W1 + W4 + W6` (наибольшая отдача / наименьший риск:
очистка мусора, закрытие непротестированной atomic-rollback safety-гарантии, фикс
дезинформирующего budget в CLAUDE.md). Затем `W3` (COH-1 — реальный cohesion-выигрыш).
`W2`/`W7` (guards) — ниже по срочности, требуют мелкого design-решения.
**DEFER/SKIP:** DUP-4 (skip), DUP-5 (defer), TRASH-5 (defer) — см. таблицу выше.

## Approvals log
| Дата | Решение владельца | Область |
|---|---|---|
| 2026-06-09 | **GO все 6 волн** (W1→W4→W6→W3→W2→W7), отчёт между волнами; DUP-4/DUP-5/TRASH-5 = defer/skip | Фаза 3 execution |

## Gates log (per-wave)
| Дата | Волна | Gate | EXIT | Note |
|---|---|---|---|---|
| 2026-06-09 | Фаза 0 | baseline (6 gates) | 0×6 | all green |
| 2026-06-09 | W1 | lint·test·css-check·visual(chromium) | 0,0,0,0 | 157 suites / **1937** tests (+4 char); CSS budget **88/88** (−2 print !important); visual 10/10 |
| 2026-06-09 | W4/T4 | focused red→green·lint·test | 1→0,0,0 | appVersionBadge print timestamp clock injection; full Jest **1938** tests |
| 2026-06-09 | W4 (Claude) | lint·coverage | 0,0 | T1/T2 rollback covered, T3 clock injected, DUP-3 dead exports removed; lines **96.39%↑** branch **86.69%↑**; 157 suites / 1938 tests |
| 2026-06-09 | W6 | docs:manual-check·arch-guards | 0,0 | DOC-1 MODULE_MAP regen; DOC-2 §5 +3 css; DOC-3 budget 167/128→88/59 (CLAUDE+ARCH §5); DOC-4 §8 +10 модулей; 34 suites / 209 arch PASS |
| 2026-06-09 | W4/W6 acceptance (Codex) | focused W4·docs:manual-check·css-check·arch·lint·docs:modules | 0×6 | 4 suites / 43 W4 tests; manual 27; CSS **88/88**; arch 34 suites / 209; MODULE_MAP regen clean; removed exports grep clean |
| 2026-06-09 | W3/COH-1 acceptance (Codex) | focused COH-1·layer/precache·lint·coverage | 0×4 | focused 3 suites / 54; layer/precache 2 suites / 8; coverage 157 suites / **1938** tests, lines **96.41%**, branch **86.69%** |
| 2026-06-09 | W3 SVC-1/SVC-3 (Claude) | focused·precache·lint·full | 0,0,0,0 | SVC-1 measure.js extraction (+1 suite / +7 char); SVC-3 'unreadable' symmetry (+3 tests); full **158 suites / 1948** tests; DUP-2 deferred (see below) |
| 2026-06-09 | W2 (Claude) | layer-arch·lint | 0,0 | L1 services→app/controllers/store + L2 ui→services allowlist; +2 non-vacuity tests; 34→34 suites / 209→211 arch; код уже respect'ил границы (0 import cleanup) |
| 2026-06-09 | W7 (Claude) | arch·lint·full | 0,0,0 | DELIVERY-1 vendored marked/DOMPurify drift guard + manifest (+1 suite / +8); marked pinned via manifest, DOMPurify cross-checked vs dompurify npm-pin; no new devDep |
| 2026-06-09 | Фаза 5 (Claude) | lint·full·coverage·manual·css·audit | 0×6 | **159 suites / 1958** tests; coverage lines **96.43%** branch **86.73%** funcs **97.18%**; manual 2/27; CSS **88/88**; audit **0 vulns** |
| 2026-06-09 | Full e2e (Claude, взял роль Codex) | playwright all projects + buckets | 0 | **260 PASS** — chromium 220 / webkit 4 / mobile-chromium 18 / mobile-webkit 18 (runner clean, без WebKit-hang); buckets a11y 13 / visual 10 (baseline без регрессий) / actionability 1 |
| 2026-06-09 | Round-2 audit + fixes (Claude) | finder×5·lint·full·coverage | 0,0,0,0 | 7 находок (1 P2 — audit-артефакт concurrent-агентов, non-reproducible 3×cold 1958→теперь 1962; 6 fixed test/docs-only); `ff19632`; full **159 / 1962**; coverage 96.43/86.73/97.18; arch 35/219 |

### W1 commits
- `d9be406` docs: collaboration protocol + audit-trail [docs-only]
- `c77f993` test: characterize formatNumber non-finite [test-only]
- `f58b3c0` services: drop no-op self-replace [behavior-preserving] (SVC-2)
- `9b9ebcc` css: remove dead/duplicated rules [behavior-preserving] (DUP-1, TRASH-2/3/4)
- `27333a0` refactor: drop dead/needless exports [behavior-preserving] (TRASH-1/6/7)
- `373242e` test: deterministic print timestamp clock [behavior-preserving] (T4) — **владелец, параллельно**

### W4 commits (Claude)
- `3eabdd1` test: cover atomic-rollback branches in recovery/file controllers (T1, T2) [test-only]
- `c8a5c9f` domain: inject clock into createDefaultConfig + deterministic test (T3) [behavior-preserving]
- `84f10a1` domain: remove dead prepareTaskForSelection/sortTasksByPriorityScore (DUP-3) [behavior-preserving]

**T4 reconciliation:** T4 — РЕАЛЬНАЯ находка (код имел hardcoded `new Date()` в
`bindPrintTimestamp`), закрыта владельцем коммитом `373242e` параллельно с моей работой.
НЕ false-positive: моя in-session оценка «FP» была ошибочна — я прочитал уже-исправленное
дерево. Аудит T4 был корректен. Итог по false-positives остаётся **0**.

**Фактически dual:** владелец коммитит в то же дерево (`373242e`, `d1bbb27`). История
линейна, конфликтов нет. При продолжении co-working — координация через
`COLLAB_BOARD.md` + правило shared-tree (§3.5): контракт-изменения коммитить первыми.

### W6 commits (docs-only)
- `6be78c1` regenerate MODULE_MAP (DOC-1)
- `1ef47e1` css important budget baseline — CLAUDE.md 167/128→88/59 (DOC-3)
- `d5bba61` align ARCHITECTURE css table + structure tree (DOC-2, DOC-4) + §5 budget 90/61→88/59

### W4/W6 acceptance review (Codex)
- ✅ ACCEPT W4 (`3eabdd1`, `c8a5c9f`, `84f10a1`): test-only rollback coverage
  exercises the import/recovery atomic rollback branches; clock injection keeps
  `createDefaultConfig()` default behavior; removed task exports have no live
  references (`rg prepareTaskForSelection|sortTasksByPriorityScore` clean).
- ✅ ACCEPT W6 (`6be78c1`, `1ef47e1`, `d5bba61`): regenerated `MODULE_MAP` is stable,
  architecture/UserManual/CSS budget guards are green, and docs-only scope matches
  DOC-1..DOC-4.
- Follow-up remains unchanged: proceed with W3 → W2 → W7. These are Claude/infra
  zones under `COLLAB.md`; Codex stays on read-only acceptance and final UI/e2e
  verification unless explicitly assigned otherwise.

### W3 commits / acceptance
- `eef3889` domain: consolidate criteria-eval sync into domain (COH-1)
  [behavior-preserving].
- ✅ ACCEPT COH-1 (Codex + subagent): `alignTasksToCriteria` keeps the legacy
  controller import path via re-export, old characterization tests still import that
  path, and moved domain helpers preserve orphan-drop / missing-zero / no-mutation
  behavior.
- `2a4c152` refactor: extract finiteOrNull/byteLength to utils/measure (SVC-1)
  [behavior-preserving]. 3 byte-identical `finiteOrNull` + 3 `byteLength` copies
  (2 TextEncoder, diagnostics Blob) → one shared `js/utils/measure.js`. byteLength
  TextEncoder→Blob→fallback keeps UTF-8 in jsdom (no TextEncoder global) matching
  diagnostics' Blob original; production identical for all three. Characterization
  tests pin Number()-coercion quirks + prove `byteLength === Blob([s]).size`.
  Registered in sw.js precache. `parseJson`/`safeStorageGet` left per-service
  (different return shapes) by design.
- `0383fd3` fix: surface backup storage-read errors as 'unreadable', not 'missing'
  (SVC-3) [bug fix]. recovery `safeStorageGet` swallowed exceptions to null, so a
  backup key that threw (SecurityError/private mode) was reported as
  `status:'missing'` — indistinguishable from "no backup", while the primary key
  surfaced 'storage-unavailable'. Now `{value, error}`; `readRecoveryBackup`
  returns `status:'unreadable'`; Recovery Center render() + `backupText` + Storage
  Health panel surface it honestly. TDD: model + storageHealth symmetry (primary
  OK + backup throws) + Recovery render.
- ⚠️ **DUP-2 deferred — not a clean behavior-preserving dedup.** The audit framed
  `resolveEffort` (quadrants.js:67) as duplicating `calculateTaskTotal`
  (task.js:25), but on inspection they have distinct contracts: `resolveEffort`
  has an explicit-`effort`-field short-circuit **and** `Number(task.est[id]) || 0`
  coercion that `calculateTaskTotal` lacks (`task.est?.[id] || 0` → string-concat
  on string est). A forced merge would either change selection behavior (drop the
  effort short-circuit / drop coercion) or change `calculateTaskTotal`'s **4 other
  call-sites** (selectionHelpers ×2, taskListGrouped ×2, render) — both are
  behavior changes, out of W3's behavior-preserving scope. Same oversimplification
  class as COH-1. **Recommendation:** if unification is wanted, do it as a separate
  `[intentional behavior change]` — add `Number()` coercion to `calculateTaskTotal`
  (after confirming est is numeric post-normalization), then delegate. Left distinct
  per §2.4 simplicity gate.

### W2 commits (Claude)
- `fa4f0af` test: codify services + ui→services layer boundaries (L1/L2)
  [architecture-only]. Rule format расширен `forbiddenModules` (отдельный модуль,
  не весь слой) + `allow` (явный allowlist). L1: services ⊅ app/controllers/
  `state/store.js` (persistence разрешён). L2: ui ⊅ services кроме leaf-
  презентационных `numberFormat`/`message`. Код уже respect'ил обе границы —
  чистая надстройка, 0 import cleanup. +2 synthetic non-vacuity теста.
- `c9b7753` docs: document W2 services/ui layer rules + allowlist in CLAUDE.md
  [docs-only].

### W7 commits (Claude)
- `11158d1` test: guard vendored marked/DOMPurify against version+npm drift
  (DELIVERY-1) [architecture-only]. `js/vendor/vendor-manifest.json` — source of
  truth (version + source); `vendored-libs-drift.test.js` сверяет banner↔manifest,
  precache в sw.js, и для DOMPurify — vendored↔`dompurify` npm-pin (marked
  npm-pin'а не имеет → manifest единственный источник). Guard-only: без нового
  devDependency и без правки lockfile.

## Final report

**Итог:** 6 волн рефакторинга выполнены дисциплинированно (W1·W4·W6·W3·W2·W7).
Code/test/arch-коммиты перечислены в Classification ledger ниже (источник
истины — `git log main..HEAD`). Абсолютный total здесь **намеренно не
хардкодится**: docs-only-коммиты (ledger / acceptance / MODULE_MAP / budget)
растут с каждым обновлением документации (классический self-count decay — round-2
поймал устаревшее «26»). Свежий счёт — в merge-ready checkpoint. Все gate'ы
зелёные. **0 false-positives** (T4 reconciled как реальная находка, не FP).
Поведение приложения сохранено везде, кроме одного явного **bug fix** (SVC-3) —
каждый коммит несёт ровно один classification-тег.

### Classification ledger (per-commit)
| Commit | Wave | Class | Что |
|---|---|---|---|
| `c77f993` | W1 | test-only | характеризация formatNumber non-finite |
| `f58b3c0` | W1 | behavior-preserving | SVC-2 no-op self-replace убран |
| `9b9ebcc` | W1 | behavior-preserving | DUP-1/TRASH-2/3/4 мёртвый/дублированный CSS |
| `27333a0` | W1 | behavior-preserving | TRASH-1/6/7 мёртвые exports |
| `3eabdd1` | W4 | test-only | T1/T2 rollback-ветки recovery/file |
| `c8a5c9f` | W4 | behavior-preserving | T3 clock injection в createDefaultConfig |
| `84f10a1` | W4 | behavior-preserving | DUP-3 мёртвые task-функции |
| `6be78c1`,`1ef47e1`,`d5bba61` | W6 | docs-only | DOC-1..4 (MODULE_MAP, budget, ARCH) |
| `eef3889` | W3 | behavior-preserving | COH-1 criteria-eval sync → domain |
| `2a4c152` | W3 | behavior-preserving | SVC-1 finiteOrNull/byteLength → utils/measure |
| `0383fd3` | W3 | **bug fix** | SVC-3 backup storage-error → 'unreadable' |
| `fa4f0af` | W2 | architecture-only | L1/L2 layer guards |
| `c9b7753` | W2 | docs-only | CLAUDE.md layer-rules sync |
| `11158d1` | W7 | architecture-only | DELIVERY-1 vendored drift guard |
| `ff19632` | round-2 | test-only | harden measure byteLength suite + domain align tests (round-2 P2-artifact/P3) |

(T4 `373242e` — owner-коммит, behavior-preserving; учтён в acceptance.)

### Метрики до/после
| Метрика | Baseline (Фаза 0) | После Фазы 5 | Δ |
|---|---|---|---|
| Jest suites / tests | 157 / 1933* | **159 / 1962** | +2 suites / +29 tests |
| Coverage lines | 96.19% | **96.43%** | +0.24 |
| Coverage branch | 86.56% | **86.73%** | +0.17 |
| Coverage funcs | — | **97.18%** | — |
| CSS !important budget | 90/61 | **88/59** (factual 88/88) | −2 (W1) |
| npm audit | 0 vulns | **0 vulns** | = |
| lint | clean | **clean** | = |
| Архитектурные guard'ы (tests) | 209 | **219** | +10 (L1/L2 +2, vendored-drift +8 в новом suite); 34→35 suites |

*baseline 157/1933 — из Фазы-0 baseline-строки (стр. с baseline-метриками);
после = последний реальный прогон round-2 (1962). +2 suites = ровно 2 новых
файла (`measure.test.js` SVC-1, `vendored-libs-drift.test.js` W7), подтверждено
`git diff main..HEAD --name-status` (Added). Arch 209→219 подтверждено
`npx jest tests/unit/architecture` = 35 suites / 219.

### False-positive table
| Находка | Вердикт | Обоснование |
|---|---|---|
| (нет) | — | Все 27 верифицированных находок реальны; T4 ошибочно помечена мной «FP» в моменте, reconciled как реальная (owner-fix `373242e`). Итог FP = **0**. |

### Deferred / skipped (с обоснованием)
- **DUP-2** (quadrants.js:67) — **deferred (accepted by owner 2026-06-09)**:
  `resolveEffort` vs `calculateTaskTotal` не чистый dedup (effort-short-circuit +
  Number-coercion расходятся). Полное слияние = behavior change (selection или
  4 call-site'а). Не блокирует merge. Follow-up для отдельного owner decision:

  > DUP-2 follow-up: potential unification requires intentional behavior change
  > approval because current paths differ in effort short-circuit and
  > Number-coercion semantics.
- **DUP-4** — skip (по решению owner от 2026-06-09).
- **DUP-5**, **TRASH-5** — defer (по решению owner от 2026-06-09).

### Per-line gates (последний реальный прогон — после round-2 fixes)
`lint` clean (EXIT 0) · `npx jest` **159 suites / 1962 PASS** (EXIT 0) ·
`test:coverage --maxWorkers=50%` lines **96.43** / branch **86.73** / funcs
**97.18** ≥ gate (EXIT 0) · `docs:manual-check` 2 suites / 27 (EXIT 0) ·
`report-css-important --check` up to date **88/88** (EXIT 0) · `npm audit`
**0 vulnerabilities** (EXIT 0) · full `npm run test:e2e` **260 PASS** all 4
projects (EXIT 0).

### Acceptance (Codex offline → усиленный self-review)

Codex отключился по тех. причинам; его задачи (acceptance + final e2e/visual)
взял Claude. Формальный Codex-acceptance заменён по owner-решению на:

```
accepted-by-self-review
Codex external acceptance unavailable; substituted by parallel skeptical
subagent review + owner-visible evidence.
```

- **W4 / W6 / COH-1** — остаются `accepted-by-Codex` (приняты, пока Codex был
  online; `b83c457`, `e84faa2` — факт верен, не переписывается).
- **W3 SVC-1 / SVC-3, W2 L1/L2, W7 DELIVERY-1** — `accepted-by-self-review`
  (см. формулировку выше).

Доказательная база self-review:
1. **Round-1** (7 параллельных claim-refuter агентов): `refutedCount=0` — SVC-1
   (Blob↔TextEncoder эквивалентность доказана brute-force по всему BMP), SVC-3
   (ровно 2 consumer'а, не-error пути byte-identical), COH-1, PERSIST, W2, W7,
   SCOPE — все держатся; перепроверено лично (grep consumer'ов, git scope).
2. **Round-2** (5 open-ended finder агентов, заменитель внешнего аудита): 7
   находок, ни одной поведенческой регрессии (таблица ниже).
3. **Full e2e**: 260 PASS (chromium 220 / webkit 4 / mobile-chromium 18 /
   mobile-webkit 18) + a11y 13 / visual 10 / actionability 1.
4. **Scope/delivery** перепроверено через git: 0 изменений deps/lockfile/
   version/manifest, 0 downstream, нет тега.

#### Round-2 находки и резолюция
| # | Severity | Находка (file:line) | Резолюция |
|---|---|---|---|
| 1 | P2→artifact | measure.test.js flaky «Expected 6 Received 3» 2/1958 | **Не дефект ветки**: non-reproducible (3× cold 1958/1958), ни один тест не засоряет `TextEncoder` (grep) — cross-contamination между concurrent-агентами round-2. Латентную хрупкость всё равно закрыл (`ff19632`). |
| 2 | P3 | measure.test.js equivalence = Blob-vs-Blob tautology в jsdom | Fixed `ff19632`: per-branch pin `globalThis.TextEncoder` (NodeTextEncoder vs deleted→Blob) + genuine TextEncoder-vs-Blob cross-check. |
| 3 | P2-doc | Final report «26/13 docs-only» stale | Fixed: убран self-decaying total; источник истины — Classification ledger + `git log`. |
| 4 | P2-doc | Метрика arch «207/211/+4» | Fixed: 209→219, Δ+10 (измерено `npx jest tests/unit/architecture` = 35/219). |
| 5 | P3-doc | baseline suites 157 vs 156 | Fixed: сведено к 157 (+2 новых suite-файла подтверждены git). |
| 6 | P3 | `alignCriteriaEvaluations` — export без consumer'а | Fixed `ff19632`: добавлен прямой domain-тест-consumer. |
| 7 | P3 | align* покрыты только через re-export | Fixed `ff19632`: domain-тест импортирует align* напрямую из `domain/criteria.js`. |

Round-2 fixes — строго **test-only** (`ff19632`) + **docs-only** (этот ledger):
ноль изменений production/CSS/persistence/deps; gates перезапущены зелёными
(159/1962, coverage 96.43/86.73/97.18, lint clean).

### Out of scope (соблюдено)
sprint-planner / FOR_USERS не трогались · GitHub Release/tag не создавались ·
downstream не синхронизировался · новых фич нет · стек не менялся · новых runtime/
dev-зависимостей не добавлено (W7 guard-only) · бизнес-поведение не менялось
(единственное изменение поведения — SVC-3 bug fix, по явному owner-решению).

---

## ФИНАЛЬНЫЙ ОТЧЁТ — Redesign v2 / v8.31.0 (2026-06-10, закрыто)

> Работа фактически шла на ветке **`redesign/sage-shadcn-v2`** (не
> `refactor/planner-v2-discipline` из контекста запуска): owner расширил scope с
> «дисциплинированного рефакторинга» до полного редизайна v2 + сопутствующего
> рефакторинга. Этот файл — закрытый audit-trail; источник истины по релизу —
> `docs/RELEASE_NOTES.md` (секция 8.31.0) и `git log` ветки (W1–W42).

### Итог по волнам

| Блок | Волны | Содержание |
|---|---|---|
| Редизайн UI | W1–W26 | sage shadcn light + navy dark, левый icon-rail, критерии-окно, шкалы-полосы в форме, иконки-бейджи, единый бейдж метрик, SM-пояснение, print-диалог, бренд-иконки |
| Поведение | W22, W27, W37 | no-op тогглы, авто-сортировка по Priority Score (один кадр), render-hold во время drag |
| Desktop-only чистка | W28, W31, W36 | mobile-инфраструктура, tabController, Recovery Center (owner-решения) |
| E2E reconcile | W33–W35 | 59 красных → 0; 2 реальных a11y-фикса; visual-бейзлайны (9) перегенерированы и просмотрены |
| Валидация/печать | W38, W40 | print sticky-overlap; порядок дат (+import-guard), продукт ≥3 после trim, числовые guard'ы закреплены |
| Доки/версия/релиз-гейты | W39, W41, W42 | UserManual/README/ARCHITECTURE/MODULE_MAP/CLAUDE/HANDOFF; v8.31.0, STORAGE_VERSION 13; metrics+verify |

### Метрики «до → после»

| Метрика | Baseline (2026-06-09) | Final (v8.31.0) |
|---|---:|---:|
| unit suites / tests | 157 / 1933 | 156 / 1961 |
| coverage lines / branches | 96.19% / 86.56% | 96.47% / 86.63% |
| full e2e | deferred (critical 22) | **222/222** (chromium 218 + webkit 4, clean child exit) |
| CSS `!important` | 90/90 | 85/88 |
| npm vulnerabilities / outdated | 0 / — | 0 / 0 (dompurify 3.4.9) |

### Открытые решения owner (на момент закрытия)

- merge в main + релиз-чейн — ждёт named `GO:`;
- Inter с Google Fonts CDN — рекомендация выдана (self-host woff2), решение за owner;
- режим SM/PO — отменён owner'ом (cancel, 2026-06-10).
