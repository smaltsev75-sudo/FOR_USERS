# Доска / план работ — Claude ⇄ Codex (PLANNER)

> **Это файл ДОСКИ И ПЛАНА ЗАДАЧ** (волатильный). Сюда пишем задачи, статусы,
> состояние, locks, Q&A и арх-решения. **Правила работы → `docs/COLLAB.md`.
> Накопленный опыт → `docs/COLLAB_LESSONS.md`.** Оба агента читают этот файл в
> начале каждого действия и обновляют по ходу.
>
> Инициализирован на v8.30.68, чистое дерево. Завершённые задачи после merge
> переносить в `docs/COLLAB_BOARD_ARCHIVE_<date>.md` (чистку делает RELEASE OWNER).

## Состояние

- **FREEZE: OFF.** **RELEASE OWNER: none.** Merge/tag/публикация — только по
  поимённому GO пользователя (`COLLAB.md` §4).
- **⚠ Codex OFFLINE (2026-06-09, тех. причины).** Его задачи (acceptance + final
  e2e/visual) взял Claude. Acceptance-модель — `accepted-by-self-review` (Codex
  external acceptance unavailable; substituted by parallel skeptical subagent
  review + owner-visible evidence). W4/W6/COH-1 — историч. `accepted-by-Codex`.
- **Файлы-lock:** none.
- **Scope:** глубокий рефакторинг PLANNER (код+UI+архитектура+доки+тесты+delivery).
  ⚠ **OUT OF SCOPE:** `sprint-planner` / `FOR_USERS` / GitHub Release не трогаем.
- **Последний зелёный gate (после round-2 fixes, 2026-06-09):** lint clean ·
  `npx jest` **159 suites / 1962 PASS** · coverage lines **96.43%** / branch
  **86.73%** / funcs **97.18%** · docs:manual-check 2/27 · css **88/88** ·
  `npm audit` **0 vulns** · full `npm run test:e2e` **260 PASS** (all 4 projects) —
  все `[EXIT=0]`.

## Активные задачи / follow-ups

| ID | Владелец | Задача | Статус | Обновлено |
|----|----------|--------|--------|-----------|
| ACC-W3svc | Claude (self-review) | SVC-1 (`2a4c152`) + SVC-3 (`0383fd3`). | **accepted-by-self-review** — round-1 refute (0 refuted, Blob↔TextEncoder brute-force; 2 consumer'а), round-2 finders, e2e recovery path PASS, лично перепроверено | 2026-06-09 |
| ACC-W2 | Claude (self-review) | L1/L2 guards (`fa4f0af`). | **accepted-by-self-review** — 0 нарушений на реальном коде, synthetic non-vacuity, allowlist обоснован | 2026-06-09 |
| ACC-W7 | Claude (self-review) | DELIVERY-1 (`11158d1`). | **accepted-by-self-review** — guard ловит drift (round-2 mutation-proof), без devDep/lockfile | 2026-06-09 |
| E2E-final | Claude (взял роль Codex) | Final e2e/visual/mobile/a11y. | **DONE — 260 PASS** (chromium 220/webkit 4/mobile-chromium 18/mobile-webkit 18) + a11y 13/visual 10/actionability 1. SVC-3 `unreadable` покрыт unit (e2e не может бросить реальный localStorage) | 2026-06-09 |

## Очередь (по приоритету: HIGH → med → low)

| Приоритет | ID | Для кого | Задача | Зависит от |
|-----------|----|----------|--------|------------|
| med | MERGE | Пользователь | Merge `refactor/planner-v2-discipline` → main (code/test/arch-коммиты — см. Classification ledger) | **только поимённый GO** (acceptance закрыт self-review, e2e 260 PASS, round-2 fixes зелёные) |
| low | DUP-2 | Пользователь | Решить, нужна ли унификация resolveEffort↔calculateTaskTotal как `[intentional behavior change]` (детали → REFACTOR_PLAN «DUP-2 deferred») | owner decision |

## Q&A (вопросы агентов друг другу)

| # | От → Кому | Вопрос | Ответ | Статус |
|---|-----------|--------|-------|--------|
| _нет_ | — | — | — | — |

## Арх-решения (согласовать ДО реализации, `COLLAB.md` §7)

| # | Автор | Решение (контракт/persist/слой/split) | Вердикт партнёра | Дата |
|---|-------|----------------------------------------|------------------|------|
| _нет_ | — | — | — | — |

## Состояние / snapshot при «стоп»

_(сюда агент при паузе пишет: что сделано / что незакоммичено / какие lock держит /
следующий шаг)_

- **Claude, 2026-06-09 (после round-2 + Codex takeover):** все 6 волн выполнены;
  Codex offline → acceptance взят на себя (round-1 0 refuted + round-2 finders +
  e2e 260 + личная верификация) = `accepted-by-self-review`. Round-2 нашёл 7
  находок: 1 P2 = audit-артефакт concurrent-агентов (non-reproducible, не дефект
  ветки), 6 fixed строго test-only (`ff19632`) + docs-only. Дерево **чистое**,
  locks не держу. Gates: 159/1962, coverage 96.43/86.73/97.18, e2e 260, lint/css/
  audit зелёные. DUP-2 deferred (owner-accepted). Следующий шаг — **merge-ready
  checkpoint → ожидание named GO пользователя**. Полный отчёт →
  `docs/REFACTOR_PLAN.md` §Final report / §Acceptance.
