// js/state/persistence.js
import { APP_CONFIG } from '../utils/appConfig.js';
import { createDefaultConfig } from '../domain/config.js';
import { createDefaultRoles } from '../domain/role.js';
import { fixTaskOrder } from '../domain/task.js';
import { ROLES } from '../utils/constants.js';

const DEFAULT_NUMBER_FORMAT_SETTINGS = { decimalSeparator: ',' };
const DEFAULT_TASK_FILTER = { search: '', type: '' };
const DEFAULT_TASK_SORT = { by: 'priority', order: 'desc' };
// v8.29.1: + 'excluded' — для persist состояния 5-й секции (см. store.js).
const VALID_QUADRANT_KEYS = ['q1', 'q2', 'q3', 'q4', 'excluded'];
const VALID_VIEW_MODES = ['list', 'quadrants'];
const DEFAULT_UI_STATE = {
    activeAlgorithm: 'matrix',
    density: 'comfortable',
    viewMode: 'list',
    expandedQuadrants: [...VALID_QUADRANT_KEYS]
};
const VALID_ALGORITHMS = ['matrix', 'value-density', 'hybrid'];
const VALID_DENSITIES = ['compact', 'comfortable', 'cozy'];

/**
 * Нормализует сохраненное состояние по актуальному контракту приложения.
 * @param {Object} rawState
 * @returns {Object}
 */
export function migratePersistedState(rawState = {}) {
    const defaultConfig = createDefaultConfig();
    const defaultRoles = createDefaultRoles();

    const config = normalizeConfig(rawState.config, defaultConfig);
    const roles = normalizeRoles(rawState.roles, defaultRoles);
    const tasks = normalizeTasks(rawState.tasks);
    const criteria = normalizeCriteria(rawState.criteria);
    const numberFormatSettings = normalizeNumberFormat(rawState.numberFormatSettings);

    return {
        version: APP_CONFIG.STORAGE_VERSION,
        config,
        roles,
        tasks,
        criteria,
        numberFormatSettings,
        activeTab: rawState.activeTab === 'criteria' ? 'criteria' : 'planning',
        taskFilter: normalizeTaskFilter(rawState.taskFilter),
        taskSort: normalizeTaskSort(rawState.taskSort),
        ui: normalizeUi(rawState.ui),
        lastAddedTaskId: null
    };
}

/**
 * Готовит состояние для безопасного сохранения в storage.
 * @param {Object} state
 * @param {Array} criteria
 * @param {string} decimalSeparator
 * @returns {Object}
 */
export function serializeStateForStorage(state, criteria, decimalSeparator) {
    return {
        version: APP_CONFIG.STORAGE_VERSION,
        config: normalizeConfig(state.config, createDefaultConfig()),
        roles: normalizeRoles(state.roles, createDefaultRoles()),
        tasks: normalizeTasks(state.tasks),
        criteria: normalizeCriteria(criteria),
        numberFormatSettings: normalizeNumberFormat({ decimalSeparator }),
        activeTab: state.activeTab === 'criteria' ? 'criteria' : 'planning',
        taskFilter: normalizeTaskFilter(state.taskFilter),
        taskSort: normalizeTaskSort(state.taskSort),
        ui: normalizeUi(state.ui)
    };
}

function normalizeConfig(config = {}, defaults) {
    return {
        ...defaults,
        ...config,
        days: normalizeInteger(config.days, defaults.days, 1),
        holidays: normalizeInteger(config.holidays, defaults.holidays ?? 0, 0),
        availCoef: normalizeNumber(config.availCoef, defaults.availCoef, 0, 100),
        alert: normalizeInteger(config.alert, defaults.alert, 0),
        product: String(config.product ?? defaults.product),
        startDate: String(config.startDate ?? defaults.startDate ?? ''),
        endDate: String(config.endDate ?? defaults.endDate ?? '')
    };
}

function normalizeRoles(roles = [], defaults) {
    const map = new Map((roles || []).map((role) => [role.id, role]));
    return defaults.map((defaultRole) => {
        const role = map.get(defaultRole.id) || {};
        return {
            ...defaultRole,
            ...role,
            fte: normalizeInteger(role.fte, defaultRole.fte, 0, 100),
            off: normalizeInteger(role.off, defaultRole.off, 0)
        };
    });
}

function normalizeTasks(tasks = []) {
    if (!Array.isArray(tasks)) return [];
    const normalized = tasks.map((task) => ({
        id: normalizeInteger(task.id, Date.now(), 1),
        title: String(task.title ?? '').trim(),
        jira: String(task.jira ?? '').trim(),
        type: normalizeTaskType(task.type),
        comment: String(task.comment ?? '').trim(),
        excluded: task.excluded ? 1 : 0,
        est: normalizeTaskEst(task.est),
        exclusionReason: String(task.exclusionReason ?? ''),
        criteriaEvaluations: normalizeCriteriaEvaluations(task.criteriaEvaluations),
        priorityScore: normalizeNumber(task.priorityScore, 0)
    }));
    return fixTaskOrder(normalized);
}

function normalizeTaskEst(est = {}) {
    return Object.fromEntries(
        ROLES.map(r => [r.id, normalizeNumber(est?.[r.id], 0, 0)])
    );
}

function normalizeCriteria(criteria = []) {
    if (!Array.isArray(criteria)) return [];
    return criteria.map((criterion) => ({
        ...criterion,
        id: normalizeInteger(criterion.id, 0, 0),
        name: String(criterion.name ?? ''),
        abbreviation: String(criterion.abbreviation ?? ''),
        weight: normalizeInteger(criterion.weight, 0, 0, 100),
        rationale: String(criterion.rationale ?? ''),
        scale: { ...(criterion.scale || {}) }
    }));
}

function normalizeCriteriaEvaluations(evaluations = {}) {
    if (!evaluations || typeof evaluations !== 'object') return {};
    const normalized = {};
    Object.keys(evaluations).forEach((key) => {
        const item = evaluations[key] || {};
        normalized[key] = {
            score: normalizeInteger(item.score, 0, 0, 10),
            value: normalizeNumber(item.value, 0, 0)
        };
    });
    return normalized;
}

function normalizeNumberFormat(settings = {}) {
    const separator = settings?.decimalSeparator === '.' ? '.' : ',';
    return { ...DEFAULT_NUMBER_FORMAT_SETTINGS, decimalSeparator: separator };
}

function normalizeTaskFilter(filter = {}) {
    return {
        ...DEFAULT_TASK_FILTER,
        search: String(filter?.search ?? ''),
        type: ['us', 'bug', 'tech', ''].includes(filter?.type) ? filter.type : ''
    };
}

function normalizeTaskSort(sort = {}) {
    return {
        ...DEFAULT_TASK_SORT,
        by: String(sort?.by || DEFAULT_TASK_SORT.by),
        order: sort?.order === 'asc' ? 'asc' : 'desc'
    };
}

function normalizeUi(ui = {}) {
    const algorithm = ui?.activeAlgorithm;
    const density = ui?.density;
    const viewMode = ui?.viewMode;
    const rawExpanded = ui?.expandedQuadrants;

    const expandedQuadrants = Array.isArray(rawExpanded)
        ? rawExpanded.filter((k) => VALID_QUADRANT_KEYS.includes(k))
        : [...DEFAULT_UI_STATE.expandedQuadrants];

    return {
        ...DEFAULT_UI_STATE,
        activeAlgorithm: VALID_ALGORITHMS.includes(algorithm) ? algorithm : DEFAULT_UI_STATE.activeAlgorithm,
        density: VALID_DENSITIES.includes(density) ? density : DEFAULT_UI_STATE.density,
        viewMode: VALID_VIEW_MODES.includes(viewMode) ? viewMode : DEFAULT_UI_STATE.viewMode,
        expandedQuadrants
    };
}

function normalizeTaskType(type) {
    return ['us', 'bug', 'tech'].includes(type) ? type : 'us';
}

function normalizeInteger(value, fallback, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

function normalizeNumber(value, fallback, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}
