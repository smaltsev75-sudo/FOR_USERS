// @ts-check
// js/state/store.js
import { ROLES } from '../utils/constants.js';
/** @typedef {import('../types/contracts.js').AppState} AppState */

export class Store {
    /**
     * Создаёт хранилище с начальным состоянием.
     * @param {Partial<AppState>} initialState - Начальное состояние (опционально).
     */
    constructor(initialState = {}) {
        this.state = {
            config: {
                product: 'SberUnity',
                days: 10,
                startDate: '',
                endDate: '',
                availCoef: 93.5,
                alert: 3
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
        this.listeners.forEach(listener => listener(this.state));
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
        this.update(() => ({
            ...newState,
            roles: newState.roles || ROLES.map(r => ({ ...r })),
            tasks: newState.tasks || [],
            criteria: newState.criteria || [],
            config: { ...this.state.config, ...newState.config },
            numberFormatSettings: { ...this.state.numberFormatSettings, ...newState.numberFormatSettings },
            activeTab: newState.activeTab || 'planning',
            taskFilter: newState.taskFilter || { search: '', type: '' },
            taskSort: newState.taskSort || { by: 'priority', order: 'desc' }
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
}

