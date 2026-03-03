# Release Notes

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
