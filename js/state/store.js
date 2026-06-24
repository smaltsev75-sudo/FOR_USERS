// @ts-check
// js/state/store.js
import { ROLES } from '../utils/constants.js';
import { APP_CONFIG } from '../utils/appConfig.js';
/** @typedef {import('../types/contracts.js').AppState} AppState */

const VALID_VIEW_MODES = ['list', 'quadrants'];
// v8.29.1: 'excluded' — отдельная 5-я группа в Quadrants view для
// исключённых задач. Хранится наряду с q1..q4 в expandedQuadrants,
// чтобы сворачивание секции переживало F5.
const VALID_QUADRANT_KEYS = ['q1', 'q2', 'q3', 'q4', 'excluded'];
const DEFAULT_EXPANDED_QUADRANTS = [...VALID_QUADRANT_KEYS];

export class Store {
    /**
     * Создаёт хранилище с начальным состоянием.
     * @param {Partial<AppState>} initialState - Начальное состояние (опционально).
     */
    constructor(initialState = {}) {
        this.state = {
            // v8.31.12: дефолты читаются из APP_CONFIG.SPRINT (единый источник
            // правды, как createDefaultConfig в domain/config.js), а не дублируются
            // литералами. Добавлено отсутствовавшее поле holidays. startDate/endDate
            // остаются пустыми — production проставляет их через createInitialState.
            config: {
                product: APP_CONFIG.SPRINT.DEFAULT_PRODUCT,
                days: APP_CONFIG.SPRINT.DEFAULT_DAYS,
                holidays: APP_CONFIG.SPRINT.DEFAULT_HOLIDAYS,
                startDate: '',
                endDate: '',
                availCoef: APP_CONFIG.SPRINT.DEFAULT_AVAIL_COEF,
                alert: APP_CONFIG.SPRINT.DEFAULT_ALERT_THRESHOLD
            },
            roles: ROLES.map(role => ({ ...role })),
            tasks: [],
            criteria: [],
            numberFormatSettings: {
                decimalSeparator: ','
            },
            activeTab: 'planning',
            taskFilter: {
                search: '',
                type: ''
            },
            taskSort: {
                by: 'priority',
                order: 'desc'
            },
            ui: {
                activeAlgorithm: 'matrix',
                density: 'comfortable',
                viewMode: 'list',
                expandedQuadrants: [...DEFAULT_EXPANDED_QUADRANTS]
            },
            // STORE-2 (DEEP-REFAC 2026-06-21): runtime-поле объявлено в default,
            // чтобы `new Store()` был консистентен с migrate/createInitialState
            // (там оно ставится в null). Раньше отсутствовало → undefined.
            lastAddedTaskId: null,
            ...initialState
        };
        this.listeners = [];
    }

    /**
     * Возвращает текущее состояние.
     * Возвращает замороженную копию, чтобы предотвратить случайные мутации.
     * Для обновления состояния используйте методы Store (setConfig, setTasks и т.д.).
     * @returns {AppState}
     */
    getState() {
        return /** @type {AppState} */ (Object.freeze({ ...this.state }));
    }

    /**
     * Подписывает слушатель на изменения состояния.
     * @param {Function} listener - Функция, вызываемая при каждом обновлении.
     * @returns {Function} Функция отписки.
     */
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Уведомляет всех подписчиков об изменении состояния.
     * @private
     */
    notify() {
        // STORE-1 (DEEP-REFAC 2026-06-21): подписчики получают тот же frozen
        // snapshot, что и getState(), а не сырой this.state — иначе listener мог
        // бы мутировать живой Store снизу в обход freeze-контракта. Один freeze
        // на notify (не на каждого listener).
        const snapshot = this.getState();
        this.listeners.forEach(listener => listener(snapshot));
    }

    /**
     * Обновляет состояние с помощью функции-апдейтера.
     * @param {Function} updater - Функция, принимающая текущее состояние и возвращающая новое.
     */
    update(updater) {
        this.state = updater(this.state);
        this.notify();
    }

    /**
     * Устанавливает конфигурацию спринта.
     * @param {Object} config - Частичный объект конфигурации.
     */
    setConfig(config) {
        this.update(state => ({
            ...state,
            config: { ...state.config, ...config }
        }));
    }

    /**
     * Устанавливает массив ролей.
     * @param {Array} roles
     */
    setRoles(roles) {
        this.update(state => ({
            ...state,
            roles: roles.map(r => ({ ...r }))
        }));
    }

    /**
     * Обновляет конкретную роль.
     * @param {string} roleId
     * @param {Object} updates - Поля для обновления (fte, off).
     */
    updateRole(roleId, updates) {
        this.update(state => ({
            ...state,
            roles: state.roles.map(role =>
                role.id === roleId ? { ...role, ...updates } : role
            )
        }));
    }

    /**
     * Устанавливает массив задач.
     * @param {Array} tasks
     */
    setTasks(tasks) {
        this.update(state => ({
            ...state,
            tasks: tasks.map(t => ({ ...t }))
        }));
    }

    /**
     * Добавляет задачу в начало списка.
     * @param {Object} task
     */
    addTask(task) {
        this.update(state => ({
            ...state,
            tasks: [task, ...state.tasks]
        }));
    }

    /**
     * Обновляет задачу по ID.
     * @param {number} taskId
     * @param {Object} updates
     */
    updateTask(taskId, updates) {
        this.update(state => ({
            ...state,
            tasks: state.tasks.map(task =>
                task.id === taskId ? { ...task, ...updates } : task
            )
        }));
    }

    /**
     * Удаляет задачу по ID.
     * @param {number} taskId
     */
    deleteTask(taskId) {
        this.update(state => ({
            ...state,
            tasks: state.tasks.filter(task => task.id !== taskId)
        }));
    }

    /**
     * Переупорядочивает задачи (после drag&drop).
     * Семантический алиас для setTasks — поведение идентично.
     * @param {Array} tasks
     */
    reorderTasks(tasks) {
        this.setTasks(tasks);
    }

    updateState(newFields) {
        this.update(state => ({ ...state, ...newFields }));
    }

    /**
     * Устанавливает массив критериев.
     * @param {Array} criteria
     */
    setCriteria(criteria) {
        this.update(state => ({
            ...state,
            criteria: criteria.map(c => ({ ...c, scale: { ...c.scale } }))
        }));
    }

    /**
     * Устанавливает активную вкладку.
     * @param {string} tabId - 'planning' или 'criteria'
     */
    setActiveTab(tabId) {
        this.update(state => ({
            ...state,
            activeTab: tabId
        }));
    }

    /**
     * Устанавливает настройки форматирования чисел.
     * @param {Object} settings - { decimalSeparator: string }
     */
    setNumberFormatSettings(settings) {
        this.update(state => ({
            ...state,
            numberFormatSettings: { ...state.numberFormatSettings, ...settings }
        }));
    }

    /**
     * Полностью перезагружает состояние (при импорте/восстановлении).
     * @param {Partial<AppState>} newState
     */
    loadState(newState) {
        // STORE-3 (DEEP-REFAC 2026-06-21): config/numberFormatSettings/ui теперь
        // ЗАМЕНЯЮТСЯ (как roles/tasks/criteria), а не мержатся поверх живого state.
        // loadState документирован как «полная перезагрузка» — мерж давал
        // rollback-неполноту (импорт-added config-ключ не убирался при откате через
        // restoreRuntimeSnapshot). Behavior-preserving для прода: newState.config
        // приходит full-normalized (migratePersistedState / snapshot getState()),
        // поэтому replace ≡ merge по совпадающим наборам ключей.
        this.update(() => ({
            ...newState,
            roles: newState.roles || ROLES.map(r => ({ ...r })),
            tasks: newState.tasks || [],
            criteria: newState.criteria || [],
            config: newState.config || this.state.config,
            numberFormatSettings: newState.numberFormatSettings || this.state.numberFormatSettings,
            activeTab: newState.activeTab || 'planning',
            taskFilter: newState.taskFilter || { search: '', type: '' },
            taskSort: newState.taskSort || { by: 'priority', order: 'desc' },
            ui: newState.ui || this.state.ui || {}
        }));
    }

    /**
     * Устанавливает фильтр задач.
     * @param {Object} filter - { search?: string, type?: string }
     */
    setTaskFilter(filter) {
        this.update(state => ({
            ...state,
            taskFilter: { ...state.taskFilter, ...filter }
        }));
    }

    /**
     * Сбрасывает фильтр задач.
     */
    clearTaskFilter() {
        this.update(state => ({
            ...state,
            taskFilter: { search: '', type: '' }
        }));
    }

    /**
     * Устанавливает параметры сортировки задач.
     * @param {Object} sort - { by: string, order: 'asc'|'desc' }
     */
    setTaskSort(sort) {
        this.update(state => ({
            ...state,
            taskSort: { ...state.taskSort, ...sort }
        }));
    }

    /**
     * Обновляет UI-state, который persist'ится между сессиями (F5-стойкость).
     * Сейчас хранит активный алгоритм автоотбора, чтобы кнопка-action в модалке
     * показывала последний выбранный алгоритм.
     * @param {Object} partial - { activeAlgorithm?: string }
     */
    setUiState(partial) {
        this.update(state => ({
            ...state,
            ui: { ...(state.ui || {}), ...partial }
        }));
    }

    /**
     * Устанавливает плотность отображения списка задач (Compact/Comfortable).
     * Невалидные значения нормализуются в 'comfortable' (backward-compatible default).
     * @param {string} density - 'compact' | 'comfortable'
     */
    setDensity(density) {
        const valid = ['compact', 'comfortable'];
        const normalized = valid.includes(density) ? density : 'comfortable';
        // No-op, если значение не меняется: повторный клик по уже активной кнопке
        // не должен дёргать notify→re-render списка задач (owner). Сравниваем с
        // raw-значением, чтобы первый явный переход с дефолта всё же отрисовался.
        if ((this.getState().ui || {}).density === normalized) return;
        this.update(state => ({
            ...state,
            ui: { ...(state.ui || {}), density: normalized }
        }));
    }

    /**
     * Устанавливает режим списка задач: 'list' или 'quadrants'.
     * Невалидные значения нормализуются к 'list'.
     * @param {string} mode
     */
    setViewMode(mode) {
        const safeMode = VALID_VIEW_MODES.includes(mode) ? mode : 'list';
        // No-op при неизменном raw-значении (см. setDensity): повторный клик по
        // уже активной кнопке режима не должен перерисовывать список задач.
        if ((this.getState().ui || {}).viewMode === safeMode) return;
        this.update(state => ({
            ...state,
            ui: { ...(state.ui || {}), viewMode: safeMode }
        }));
    }

    /**
     * Переключает раскрытость одного квадранта в режиме группировки.
     * Невалидные ключи игнорируются.
     * @param {'q1'|'q2'|'q3'|'q4'} quadrantKey
     */
    toggleQuadrantExpanded(quadrantKey) {
        if (!VALID_QUADRANT_KEYS.includes(quadrantKey)) return;
        this.update(state => {
            const ui = state.ui || {};
            const current = Array.isArray(ui.expandedQuadrants)
                ? ui.expandedQuadrants
                : [...DEFAULT_EXPANDED_QUADRANTS];
            const next = current.includes(quadrantKey)
                ? current.filter(k => k !== quadrantKey)
                : [...current, quadrantKey];
            return { ...state, ui: { ...ui, expandedQuadrants: next } };
        });
    }

    /**
     * Полностью заменяет набор раскрытых квадрантов.
     * Невалидные ключи отфильтровываются.
     * @param {Array<string>} quadrantKeys
     */
    setExpandedQuadrants(quadrantKeys) {
        const safe = Array.isArray(quadrantKeys)
            ? quadrantKeys.filter(k => VALID_QUADRANT_KEYS.includes(k))
            : [...DEFAULT_EXPANDED_QUADRANTS];
        this.update(state => ({
            ...state,
            ui: { ...(state.ui || {}), expandedQuadrants: safe }
        }));
    }
}

