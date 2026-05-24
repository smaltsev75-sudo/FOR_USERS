# CODE_REVIEW_GUIDELINES.md

> Правила код-ревью и pre-commit чек-лист для PLANNER.
> Архитектура и слои — `docs/ARCHITECTURE.md`. Ловушки и накопленный опыт для LLM-ассистента — `CLAUDE.md`.
> Этот файл — единая точка входа для **разработчика**, готовящего изменения к ревью.

---

## 1. Стандарты кодирования

### 1.1 Форматирование

- **Отступы:** 4 пробела (как в существующем коде; ESLint flat config не enforce-ит, но конвенция стабильная).
- **Точки с запятой:** обязательны.
- **Кавычки:** одинарные `'` для строк, двойные `"` для HTML-атрибутов внутри template literals.
- **Trailing commas:** разрешены, но не обязательны — следуй стилю окружающего кода.
- **Длина строки:** ориентир ~120 символов, без жёсткого предела.
- **Кодировка:** UTF-8 без BOM, переводы строк LF.

### 1.2 Нейминг

| Сущность | Стиль | Пример |
|---|---|---|
| Файлы JS | camelCase | `taskController.js`, `priorityScore.js` |
| Файлы CSS | kebab-case | `task-card.css`, `capacity-strip.css` |
| Классы | PascalCase | `TaskController`, `Store` |
| Функции / методы | camelCase | `renderTaskList()`, `handleSortByPriority()` |
| Константы | UPPER_SNAKE_CASE | `ROLES`, `APP_CONFIG`, `STORAGE_KEYS` |
| Приватные поля / методы | префикс `_` | `_cache`, `_form`, `_parseRoleFieldValue` |
| Неиспользуемые args / catch | префикс `_` | `function f(_unused) {}`, `catch (_err)` |
| CSS-классы | kebab-case + BEM-modifier | `.task-item`, `.task-item--excluded`, `.cap-segment__label` |
| CSS-токены (custom props) | kebab-case с префиксом цели | `--space-md`, `--font-md`, `--color-danger` |
| ID элементов | camelCase | `#taskList`, `#capacityStrip`, `#configPanel` |
| Атрибуты данных | data-kebab-case | `data-task-id`, `data-focus-key`, `data-density` |

### 1.3 Структура файла JS

```javascript
// js/<layer>/<module>.js                             ← header-комментарий с путём

import { dep1 } from '...';                          ← импорты сгруппированы:
import { dep2 } from '../utils/...';                   1) external (нет здесь — vanilla)
import { Local } from './...';                         2) ../<other-layer>/
                                                       3) ./<same-layer>/
/**
 * Краткое назначение модуля. WHY, не WHAT.
 */
export class X { ... }
export function y() { ... }
```

### 1.4 Комментарии

- **WHY > WHAT.** Имена функций уже говорят, что код делает; комментируй только нетривиальное поведение, инвариант, тонкость браузера, причину workaround'а.
- **JSDoc** обязателен для публичных функций классов-контроллеров и domain-модулей (типы параметров, return).
- **Никаких `// удалено старое поведение` / `// добавлено для X`** — это для PR description / git log, а не кода.
- **TODO** допустим только с указанием контекста: `/* TODO: переехать на team-capacity, см. CODE_REVIEW_GUIDELINES §6 */`.

---

## 2. Архитектура (TL;DR из docs/ARCHITECTURE.md §2)

| Слой | DOM | Store | Бизнес-логика |
|---|:---:|:---:|:---:|
| `js/domain/` | ❌ | ❌ | ✅ |
| `js/controllers/` | ✅ | ✅ | оркестрация |
| `js/services/` | ✅ | ❌ | ❌ |
| `js/ui/` | ✅ | через параметры | ❌ |
| `js/utils/` | ❌ | ❌ | ❌ |

Поток событий: `event → controller → store.update*() → notify → schedulePersist + requestRender`.

**Запреты на границы:**

- `js/domain/**` не должен импортировать из `js/controllers/`, `js/ui/`, `js/services/`.
- `js/utils/**` не должен импортировать ни из чего проектного, кроме других `js/utils/`.
- `js/ui/**` принимает Store **только** через параметры функций — не через прямой импорт.
- Прямой `renderApp()` из контроллера — **запрещён**. Только `requestRender()` (батчится через rAF).

**Иммутабельность state:** `Store.getState()` возвращает `Object.freeze` верхнего уровня. Вложенные мутации не блокируются — для гарантии используй сеттеры Store. При добавлении нового поля в state — добавь сеттер.

---

## 3. JavaScript: требования

### 3.1 Обязательно

- **ES2022+, ESM.** `import` / `export`, `import.meta` где нужно, top-level `await` запрещён в браузерных модулях (нет загрузчика-bundler'а).
- **`const` по умолчанию, `let` для ре-ассайнментов.** `var` запрещён (`no-var: error`).
- **`===` / `!==`** — `eqeqeq: ['error', 'always']`.
- **Pure-функции в `domain/` и `utils/`.** Если функция мутирует input или читает globalThis — её место в `controllers/` или `services/`.
- **Throw `Error` или typed-class, не строки.** `throw new Error(msg)`, не `throw 'msg'`.
- **Try/catch по unite of work, не вокруг каждого вызова.** Не глотай ошибки — либо логируй (`console.error`), либо ре-throw.

### 3.2 Запрещённые паттерны

- `eval`, `new Function`, `setTimeout(stringExpression)` — критическая ошибка ревью.
- `innerHTML = userInput` без `DOMPurify.sanitize()` (`js/utils/sanitize.js`) или `escapeHtml()` (`js/utils/escapeHtml.js`).
- Прямой импорт из `js/state/store.js` в `js/ui/**` — UI получает state через параметры функций.
- `document.getElementById` в `js/domain/` или `js/utils/`.
- Глобальные мутируемые переменные в модулях (`let counter = 0` на топ-уровне с `++` снаружи).
- Неотвязанные `setInterval` / `setTimeout`, удерживающие ссылки на удалённые DOM-узлы.
- `addEventListener` на `document` или `window` без понимания lifecycle (одноразовая регистрация в init контроллера — OK; регистрация в render-функции — leak).
- `async function` без `await` внутри — это значит promise, который никто не ждёт (часто баг).
- `Object.assign(state, patch)` мимо Store-сеттеров.
- **Nested interactive controls (v8.30.0)** — `role="button"` / `tabindex="0"` на контейнере, внутри которого focusable `input` / `<button>`. Нарушает WCAG 4.1.2 (axe-core «serious»). Вариант фикса: вынести toggle в отдельную `<button>`, focusable элементы — как siblings. См. `criteriaList.js`/`criteriaController.js`.
- **`requestIdleCallback` / `setTimeout` для прогрессивного рендера без generation-token (v8.30.0).** Закрытие держит ссылку на старый `state` — после нового рендера старый callback дозаливает stale-DOM в новый список. Контракт: module-level counter + abort-check в callback (см. `taskList.js`).
- **`localStorage.setItem` / `sessionStorage.setItem` в try/catch без сигнала пользователю.** `QuotaExceededError`/`SecurityError` пользователь должен увидеть (snackbar + предложение скачать JSON). Контракт `{ok, error}` — см. `services/storage.js`.
- **`Date.now()` как fallback id в синхронном `map()` (v8.30.0).** Несколько элементов попадают в одну ms → одинаковые id → коллизии в Store. Использовать `createIdAllocator()` (см. `state/persistence/primitiveNormalizers.js`).

### 3.3 Обработка ошибок

- **Boundaries:** валидация на входах от пользователя (формы, импорт JSON), на ответах внешних API (нет в проекте), на parse-операциях (`JSON.parse`).
- **Внутренние вызовы:** доверяем guarantees типов. Лишнее `if (!arg) throw` в `domain/` — анти-паттерн.
- **Atomic rollback** для persistence — при падении после частичного сохранения откатывать всё (паттерн в `state/persistence.js`).

### 3.4 События и память

- `addEventListener` в `init()` контроллера — нормально, controllers — singleton'ы.
- `addEventListener` внутри `render*()` — leak. Используй делегирование на родителе или капчу при первом render'е.
- `setInterval` всегда парится с `clearInterval` в cleanup.
- Drag-handlers, document-level listeners — пары `mousedown→add document` / `mouseup→remove document`.

---

## 4. CSS: правила

### 4.1 Обязательно

- **Custom properties в `:root`** для всех цветов, отступов, размеров шрифтов (`css/base.css`). Темизация через `[data-theme]` + `var(--token)`.
- **`@layer`** для управления каскадом — не «cascade-через-порядок-импортов».
  Пока полный перенос старых файлов в layers не выполнен, держать явный
  stylesheet order и не оборачивать отдельный файл в `@layer` без visual pass.
- **`clamp()`** для fluid typography, `min()` / `max()` для адаптивных размеров.
- **`@container`** queries для компонентной адаптивности (task-card, criteria-list), не только `@media`.
- **`:focus-visible`** отдельно от `:focus` — keyboard-фокус с ring, mouse — без.
- **Touch-targets ≥ 44×44** на `(pointer: coarse)`.
- **`prefers-reduced-motion`** обнуляет `animation` / `transition`.
- **`tabular-nums`** на числовых колонках (effort, priority-score, denominator).
- **Контраст ≥ 4.5:1 для текста, ≥ 3:1 для UI** — в обеих темах.
- **Отображаемые проценты в UI** — только целые неотрицательные числа. Для текста,
  `title`, `aria-label`, snackbar/modal messages использовать `formatUiPercent`
  / `formatSignedUiPercent`; дробные `%` допустимы только как CSS-геометрия
  (`width`, `stroke-dasharray`, custom properties), не как видимое число.
- **Stepper-only для чисел** — UX smell. Если пользователь видит число и
  должен менять его часто, быстрые `−/+` могут быть рядом, но обязателен
  прямой ввод или нативный выбор (`input`/`select`/combobox). Контейнер с
  вложенными `input`/`button` не размечать как `role="spinbutton"`; семантика
  должна жить на нативном поле.
- **`datalist` ≠ гарантированный dropdown.** Для bounded диапазона вроде
  score 0..10 не использовать `input[list]` как единственный способ выбора:
  браузер фильтрует options по текущему значению и может показать только один
  вариант. Нужен отдельный native `select` или полноценный combobox.

### 4.1.bis Дизайн-система прежде всего (v8.28 lesson)

При редизайне любой модалки или JS-генерируемого экрана **сначала аудит существующих компонентов**:

- В проекте уже есть зрелые семейства: `.export-btn` (+ `.primary` / `--success`), `.modal-content` (+ `--wide` / `--column` / `--medium` / `--narrow` / `--padless`), `.modal-header` / `--padded`, `.modal-close-btn`, `.rec-card` (+ `--featured` / `--algo` / `--recommended` в v8.28), `.severity-high/medium/low/info`, `.best-value`, `.accordion-item/.accordion-header/.accordion-content`, `.modal-buttons-center`, `.confirm-btn` / `.confirm-yes` / `.confirm-no`, `.algo-card-marker`, `.metric-bar` (v8.28).
- **НЕ изобретать BEM-параллель** (`.btn--primary`, `.card--highlighted`, `.badge--success`) поверх существующего слоя — это второй несовместимый набор стилей и явное нарушение «100% идентично остальным формам».
- Расширять модификаторами уже существующих базовых классов: `.rec-card.rec-card--featured`, `.rec-card.rec-card--algo`, `.export-btn.primary`.
- **НЕ создавать `design-tokens.css` / `base-components.css` параллельно `base.css` / `buttons.css` / `modals.css`** — токены и компоненты централизованы там.
- При жалобе пользователя «выглядит инородно на фоне остальных форм» — реальные источники в legacy-рендерерах: ① inline-`style="..."` атрибуты, ② эмодзи вместо SVG, ③ прямые hex'ы вместо `var(--token)`, ④ отсутствие `escapeHtml()` для user-input. Лечатся очисткой, не новой системой.

### 4.2 Запрещённые паттерны

- **`outline: none`** на `:focus*` без замены через `box-shadow` / `border` — нарушение WCAG 2.4.7.
- **`overflow ≠ visible` на ancestor таблицы** со sticky-thead — ломает sticky (см. `CLAUDE.md` §12).
- **`table-layout: fixed`** без явного `<colgroup>` на широких таблицах.
- **`flex-wrap: wrap` + фиксированный `height`** — используй `min-height`.
- **Анимация на пересоздаваемом DOM-узле без класса-маркера «свежесть»** — flicker на каждом re-render.
- **Эмодзи в UI-тексте** — только inline-SVG из `js/utils/icons.js`.
- **Inline `style="..."` в HTML/JS** для не-вычисляемых значений (вычисляемая ширина прогресс-бара — OK; цвет — в CSS).
- **Vendor-префиксы** (`-webkit-`, `-moz-`) — autoprefixer не используется, modern browsers не нужны.
- **`!important`** — допустим **только** в `print.css` и в утилитах с осознанной перебивкой (`error`, `dragging`).
- **Task card CSS** — новые стили карточки класть в соответствующий subfile:
  shell/header в `task-card.css`, effort в `task-card-effort.css`, actions в
  `task-card-actions.css`, criteria controls в `task-card-criteria.css`, states
  в `task-card-states.css`, quadrants/view-toggle в `task-card-quadrants.css`.
- **Tailwind / Sass / CSS-in-JS / UI-библиотеки** — vanilla CSS3, точка.

### 4.3 Селекторы

- **Низкая специфичность** — предпочитай `.class` тегу + классу. `div.container ul li a` → `.link`.
- **BEM-подобный modifier** — `.block`, `.block__elem`, `.block--modifier`.
- **Не используй `>` каскады глубже 2 уровней** — реструктурируй DOM или добавь класс.
- **Не используй `[id="..."]`** — используй `#id`.

### 4.4 При удалении CSS

1. Grep класса по всему репо: `index.html`, `js/`, `tests/unit/`, `tests/e2e/`, других `css/` файлах (бывает кросс-ссылка).
2. Учитывай конкатенацию: `'type-' + value` → классы `.type-feature`, `.type-bug`, `.type-meeting` живые, даже если в HTML их нет.
3. Если найден только в e2e-тестах и в `roleController.js` fallback — это **двух-шаговый** рефактор: сначала актуализировать e2e, потом удалять CSS.

---

## 5. HTML: правила

- **Семантика:** `<section>`, `<article>`, `<nav>`, `<main>`, `<header>` — где смысловое значение, не layout-обёртки.
- **`<main id="main-content">`** один на страницу, обязателен skip-link.
- **`aria-*`** атрибуты — только если нужны: модалки `aria-labelledby`, поля с ошибкой `aria-invalid="true"` + `aria-describedby`.
- **Дубли `id`** запрещены — Lighthouse отметит.
- **`alt`** на `<img>` обязателен (если декоративная — `alt=""`).
- **`<button type="button">`** в формах — иначе submit; `<button type="submit">` явно для save.
- **Нет inline `style`** для не-вычисляемых стилей.
- **`<input>`** в модалках с draft-flow — обязателен `data-focus-key="..."` (иначе фокус слетает при `patchModal({draft})`).

---

## 6. Тесты

### 6.1 Unit (Jest + babel-jest)

- **Зеркальная структура:** `tests/unit/<layer>/<module>.test.js` ↔ `js/<layer>/<module>.js`.
- **Mock-паттерн:** `jest.mock()` сразу после `import { jest } from '@jest/globals'`. `jest.fn()` внутри factory мока, не во внешних переменных. Полный паттерн — `docs/ARCHITECTURE.md` §7.
- **Не используй** `jest.unstable_mockModule` (несовместим с babel-jest).
- **Source helpers** для regex по сорсу — в `tests/_helpers/source.js`: `stripCssComments`, `stripJsComments`, `ruleBody`. Без них тесты дают false-pass на литералах в комментариях.
- **Один тест по имени:** `npx jest -t "test name"`. **Один файл:** `npx jest path/to/file.test.js`.

### 6.2 e2e (Playwright + axe-core)

- Каждый тест изолирован: `localStorage.clear()` в `beforeEach`.
- Проверки `:hover`-классов: после `createTask()` / клика на save сделать `await page.mouse.move(0, 0)` + `body.click({position:{x:1,y:1}})` (см. `CLAUDE.md`).
- A11y-тесты через axe-core — в `tests/e2e/accessibility.spec.js`.
- Для видимых команд UI проверять actionability: реальный `page.click()`
  должен приводить к download, modal, snackbar/message или изменению состояния.
  Быстрый bucket: `npm run test:e2e:actionability`.
- Ассерты против DOM-структуры, не визуального снимка.
- При удалении/переименовании DOM-элемента — синхронно ревизуй `tests/e2e/**/*.spec.js`.

### 6.3 TDD для bug-fix

1. Воспроизводящий **тест** (фейлится без фикса).
2. **Минимальный фикс.**
3. **Проверка:** `npm test` + ручная browser-проверка для UI.
4. Обновление `docs/RELEASE_NOTES.md`.

---

## 7. Безопасность

| Контекст | Инструмент | Где |
|---|---|---|
| User input в DOM | `escapeHtml()` | `js/utils/escapeHtml.js` |
| Внешний markdown (help) | `DOMPurify.sanitize()` | `js/utils/sanitize.js` |
| State защита от мутаций | `Object.freeze` | `Store.getState()` |
| URL валидация | блокировка `javascript:` | `js/domain/validation.js` |

При новом UI-компоненте, принимающем user input, обязательно решить и задокументировать как санитизируется ввод.

---

## 8. Persist UI state

Любая UI-настройка, переживающая F5, — обязана сохраняться:
- активный таб
- активный алгоритм отбора
- свёрнутые/раскрытые секции
- режим темы (`data-theme`)
- фильтры списка задач
- density toggle, view-mode

Persist-обёртка — `js/services/storage.js` или `js/state/persistence.js`. Дефолт `null` = «не сохранено» (UI сам выбирает дефолт).

При добавлении нового toggle — сразу подключай persist. Иначе пользователь получит «настройки сбрасываются после F5».

---

## 9. Service Worker / PWA

- При правках `sw.js`, ассетов в precache, `index.html`, токенов CSS — **обязательно бампать `CACHE_VERSION`** в `sw.js`.
- При локальной разработке после критичных правок: DevTools → Application → Service Workers → **Unregister** + Ctrl+Shift+R.
- В Playwright SW может кэшировать ассеты между запусками. При флаки — проверь `serviceWorkers: 'block'` или `clearStorage` в `playwright.config.js`.

---

## 10. Pre-commit чек-лист (печатать здесь)

> Используй до `git commit`. ≤ 5 минут на задачу средней сложности.

```
[ ]  npm run lint              → 0 errors, 0 warnings
[ ]  npm test                  → все тесты PASS
[ ]  npm run test:e2e          → все e2e PASS (если правил DOM/CSS/контроллеры)
[ ]  Visual smoke в браузере   → создать задачу, отредактировать, переключить вид/тему
[ ]  Hard-reload тест          → Ctrl+Shift+R, F5 не сбрасывает UI-state
[ ]  Service Worker            → если правил sw.js/index.html/CSS — bump CACHE_VERSION
[ ]  Безопасность              → новый user-input → sanitize/escape; нет eval/innerHTML без санитизации
[ ]  Слои                      → нет нарушений границ (§2): domain не зовёт DOM, ui не импортирует Store
[ ]  Persist                   → новый toggle сохраняется в localStorage и восстанавливается после F5
[ ]  A11y                      → :focus-visible есть, контраст ≥ 4.5:1 в обеих темах, touch-target ≥44px
[ ]  Тесты соразмерны          → bug-fix → reproduce-тест; new feature → unit + e2e
[ ]  Документация              → docs/RELEASE_NOTES.md обновлён, ARCHITECTURE.md если менялась структура
[ ]  Git гигиена               → коммитим конкретные файлы (не git add .), без --no-verify, без force-push на main
```

---

## 11. Анти-паттерны (печать-лист — увидел = откати)

1. `var x = ...` (используй `const`/`let`).
2. `==` вместо `===`.
3. `innerHTML = templateLiteralWithUserData` без `escapeHtml()`.
4. `.error`, `.dragging`, `.fresh` — модификаторы дублируются по всем CSS-файлам вместо `@layer modifiers`.
5. `outline: none` в `:focus` без замены.
6. Эмодзи в UI-строках.
7. Inline `style="color: red"`, когда есть CSS-токен.
8. `setTimeout(() => render(), 0)` — используй `requestAnimationFrame` или `requestRender()` Store'а.
9. `try { ... } catch (e) { /* ничего */ }` — глотание ошибок.
10. `state.tasks.push(x)` мимо Store-сеттера.
11. Прямой `renderApp()` из контроллера.
12. `addEventListener` в `render*()`-функции для **долгоживущего** DOM (узел переживает следующий render). Для динамически генерируемого innerHTML, который заменяется при каждом render'е (модалки сравнения, рекомендации, hover-popover'ы) — listener-in-render допустим: GC автоматически собирает старые узлы вместе с listener'ами. Не дублируй такой listener делегацией на родителе — получишь double-fire через bubbling (см. v8.28 fix в `selectionReport.js`).
13. CSS-класс из 5 слов вложенности (`.container .panel .header .title-row span`).
14. `!important` без причины (только в `print.css` и редких модификаторах).
15. JSDoc, который повторяет имя функции (`/** Renders task list */ function renderTaskList()`).

---

## 12. Когда вы не уверены

1. **Прочитай `docs/ARCHITECTURE.md`** — есть ответ для 80% вопросов про слои и потоки.
2. **Запусти `npm test -- --coverage`** — увидишь, какие модули недопокрыты.
3. **Запусти `npm run lint`** — линтер скажет про unused, var, eqeqeq, no-undef.
4. **Не уверен в CSS-классе** — пометь `/* TODO: check usage — see CODE_REVIEW_GUIDELINES §4.4 */`, не удаляй.
5. **Не уверен в JS-экспорте** — grep по `from\s+['\"][^'\"]*<modulename>['\"]` по всему репо. Включи `tests/unit/` и `tests/e2e/`.

---

_Версия документа: v1.1 (2026-05-07). v8.28 — добавлены §4.1.bis (Design-system first) и уточнение §11.12 (listener-in-render для эфемерного DOM). При обновлении правил — фиксируй дату и кратко в `docs/RELEASE_NOTES.md`._
