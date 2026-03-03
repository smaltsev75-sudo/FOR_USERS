# Архитектура PLANNER

> Техническая документация для разработчиков и технических специалистов.
> Пользовательская документация: `README.md`. Справка: `UserManual.md`.

## 1. Runtime / Точка входа

- Единственная точка входа: `index.html` → `js/app.js`.
- Все модули подключаются через ES imports от `app.js`.
- Для тестов: `window.__PLANNER_DISABLE_AUTOBOOT__` отключает автозапуск.

## 2. Слои приложения

```
index.html
  └─ js/app.js (orchestrator)
       ├─ js/state/store.js          — единое хранилище состояния
       ├─ js/controllers/*           — управление UI и сценариями
       │    ├─ task/                  — создание, редактирование, drag&drop, undo-delete
       │    ├─ criteria/              — управление критериями оценки
       │    └─ selection/             — хелперы автоотбора
       ├─ js/domain/*                — чистая бизнес-логика (без DOM)
       │    └─ selection/             — 3 алгоритма автоотбора
       ├─ js/services/*              — работа с браузерными API (storage, message)
       ├─ js/ui/*                    — рендер DOM из состояния (progressive rendering)
       └─ js/utils/*                 — утилиты (debounce, escapeHtml, lruCache)
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

## 3. State и Render Flow

```
store.update*() → notify() → listeners → schedulePersist() + requestRender()
                                                ↓                    ↓
                                          saveToLS()         renderApp() (batched via rAF)
```

- `Store.getState()` возвращает **замороженную копию** состояния (Object.freeze).
- Для обновления используются методы Store: `setConfig`, `setTasks`, `updateTask` и др.
- Рендер batched через `requestAnimationFrame` — исключает дублирующие перерисовки.

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
Задача A: приоритет 80, трудозатраты 10ч → VD = 8.0  ← предпочтительнее
Задача B: приоритет 90, трудозатраты 40ч → VD = 2.25
```

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
| `base.css` | CSS-переменные тем, reset, типографика |
| `layout.css` | Сетки и компоновка |
| `buttons.css` | Стили кнопок |
| `forms.css` | Стили полей ввода |
| `modals.css` | Стили модальных окон |
| `components.css` | Общие компоненты, кнопки критериев |
| `criteria.css` | Критерии оценки |
| `selection-report.css` | Отчёт автоотбора |
| `task-card.css` | Карточка задачи |
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
- `Store.getState()` возвращает замороженную копию — защита от мутаций.
- Валидация JIRA URL блокирует `javascript:` протокол.

## 7. Тестирование

### Запуск тестов

```bash
npm install             # установка зависимостей (один раз)
npm test                # unit-тесты (Jest + jsdom)
npm run test:smoke      # быстрая проверка
npm run test:e2e        # E2E (Playwright + Chromium)
npm test && npm run test:e2e   # все тесты
```

### Текущий счёт

| Тип | Фреймворк | Количество | Покрытие | Команда |
|-----|-----------|:---:|:---:|---------|
| Unit | Jest + jsdom | 807 | 88.5% statements, 90.3% branches | `npm test -- --coverage` |
| E2E | Playwright + Chromium | 145 | — | `npm run test:e2e` |
| Accessibility | @axe-core/playwright | включены в e2e | — | |

- E2E запускаются параллельно (`fullyParallel: true`, workers = auto) — каждый тест изолирован (localStorage.clear в beforeEach).
- Конфигурация: `jest.config.cjs` (`coverageProvider: 'v8'`), `playwright.config.js`.
- Линтинг: `eslint.config.js` (ESLint 9 flat config), `npm run lint` / `npm run lint:fix`.

### Диагностика тестов

| Симптом | Решение |
|---------|---------|
| `Cannot find module 'jest'` | `npm install` |
| `SyntaxError: Cannot use import statement` (Jest) | Проверьте `babel.config.cjs` |
| `ReferenceError: require is not defined` в `jest.mock` | Убедитесь, что в скрипте `npm test` **нет** `--experimental-vm-modules` |
| `ReferenceError` в фабрике мока | Определяйте моки **внутри** фабрики `jest.mock()` (см. паттерн ниже) |
| `jest.unstable_mockModule is not a function` | Замените на `jest.mock()` — проект использует `babel-jest` (CJS) |
| `connect ECONNREFUSED 127.0.0.1:8080` (E2E) | Playwright запускает сервер автоматически |
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
    configController.js            # конфигурация спринта
    criteriaController.js          # управление критериями
    fileController.js              # импорт/экспорт данных
    helpController.js              # справка (DOMPurify-санитизация)
    keyboardController.js          # горячие клавиши
    roleController.js              # управление ролями
    selectionController.js         # автоматический отбор задач
    tabController.js               # переключение вкладок
    taskController.js              # управление задачами (оркестратор)
    themeController.js             # переключение светлой/тёмной темы
    criteria/
      criteriaFormController.js    # модаль критериев
    selection/
      selectionHelpers.js          # хелперы автоотбора
    task/
      taskFormController.js        # модали создания/редактирования
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
    createForm.js                  # рендер формы создания
    criteriaList.js                # рендер списка критериев
    domUtils.js                    # createElement, escapeHtml, clearChildren
    header.js                      # рендер шапки (счётчики задач)
    matrix.js                      # рендер матрицы компетенций
    modalManager.js                # единый менеджер модальных окон
    roleList.js                    # рендер списка ролей
    selectionReport.js             # рендер отчёта
    selectionRecommendations.js    # рендер рекомендаций
    snackbar.js                    # snackbar/toast (undo-delete)
    taskList.js                    # рендер списка задач (progressive rendering)
    utils.js                       # UI-хелперы
  utils/
    appConfig.js                   # конфигурация приложения
    constants.js                   # константы (ROLES, TASK_TYPES)
    date.js                        # работа с датами (addWorkingDays, countWorkingDays, isWorkingDay)
    debounce.js                    # debounce-обёртка
    escapeHtml.js                  # экранирование HTML (XSS)
    lruCache.js                    # LRU-кэш
tests/
  unit/                            # Jest: 797 тестов
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
  e2e/                             # Playwright: 141 тест
    planner.spec.js                # пользовательские сценарии
    theme.spec.js                  # тесты темы и доступности
    accessibility.spec.js          # WCAG 2 AA
```

## 9. Вспомогательные модули

| Модуль | Назначение |
|--------|-----------|
| `snackbar.js` | Snackbar/toast с кнопкой «Отменить» (undo-delete) |
| `lruCache.js` | LRU-кэш для priority-score и алгоритмов |
| `taskCacheService.js` | Кэширование priority-score и role-load |
| `taskFormController.js` | Модали создания/редактирования задач |
| `taskDragController.js` | Drag-and-drop переупорядочивание |
| `taskListHandler.js` | Обработчики бизнес-логики списка задач |
| `criteriaFormController.js` | Модаль критериев |
| `modalManager.js` | Единый менеджер модальных окон |
| `domUtils.js` | createElement, escapeHtml, clearChildren |
| `themeController.js` | Переключение светлой/тёмной темы |
| `selectionReport.js` | Рендер отчёта сравнения алгоритмов |
| `selectionRecommendations.js` | Рендер рекомендаций оптимизации |

## 10. Политика изменений

- Новые модули обязаны следовать границам слоёв (см. §2).
- Типовые контракты зафиксированы в `js/types/contracts.js`.
- Изменения CSS-цветов проверяются через e2e accessibility-тесты.
