// js/state/persistence.js
import { APP_CONFIG } from '../utils/appConfig.js';
import { createDefaultConfig } from '../domain/config.js';
import { createDefaultRoles } from '../domain/role.js';
import { fixTaskOrder } from '../domain/task.js';
import { ROLES } from '../utils/constants.js';
import { normalizeRoleFieldForPersistence, parseRoleField } from '../domain/roleFieldContract.js';
import { parseStrictIntegerInRange } from '../domain/strictInteger.js';

const DEFAULT_NUMBER_FORMAT_SETTINGS = { decimalSeparator: ',' };

/**
 * v8.30.6: defense-at-load для jira URL.
 * Форма при создании/edit задачи валидирует URL через validateJiraUrl (только http/https),
 * но импорт JSON просто `String(task.jira)` — malicious файл с
 * `jira: 'javascript:alert(1)'` попадал в task.jira, затем рендерился в
 * `<a href="${jira}">` напрямую. Фильтр здесь снимает риск, оставляя только
 * http://… / https://… или пустую строку.
 */
function sanitizeJiraUrl(raw) {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return '';
    // Разрешаем относительные пути (без схемы) и http/https. Всё остальное —
    // javascript:, data:, vbscript:, file: и т.д. — обнуляем.
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return ''; // любая другая схема
    return trimmed; // относительный URL — допустим (без схемы → нельзя сделать XSS)
}
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
// v8.30.0: 'cozy' удалён из публичного контракта (UI v8.27+ двухрежимный).
// Сохранённые состояния с density='cozy' мигрируются в 'comfortable' через
// VALID_DENSITIES.includes() в normalizeUi() — несовместимое значение
// заменяется на DEFAULT_UI_STATE.density.
const VALID_DENSITIES = ['compact', 'comfortable'];

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
        availCoef: normalizeNumber(config.availCoef, defaults.availCoef, 0, 100, 2),
        alert: normalizeInteger(config.alert, defaults.alert, 0),
        product: String(config.product ?? defaults.product),
        startDate: String(config.startDate ?? defaults.startDate ?? ''),
        endDate: String(config.endDate ?? defaults.endDate ?? '')
    };
}

function normalizeRoles(roles = [], defaults) {
    const map = new Map((roles || []).map((role) => [role.id, role]));
    // v8.30.31: единый контракт через domain/roleFieldContract.js. parseInt-мусор
    // (12abc), дроби (12.5), отрицательные → fallback на default из createDefaultRoles().
    return defaults.map((defaultRole) => {
        const role = map.get(defaultRole.id) || {};
        return {
            ...defaultRole,
            ...role,
            fte: normalizeRoleFieldForPersistence('fte', role.fte, defaultRole.fte),
            off: normalizeRoleFieldForPersistence('off', role.off, defaultRole.off)
        };
    });
}

// v8.30.0: unique-id allocator. Раньше `normalizeInteger(task.id, Date.now(), 1)`
// в синхронном map() возвращал одинаковый Date.now() для нескольких задач
// без валидного id → коллизии после импорта (Store.updateTask промахивался).
// Allocator собирает уже использованные id и выдаёт следующий свободный.
function createIdAllocator(existingIds, minBase = 1) {
    const used = new Set(existingIds);
    let next = Math.max(minBase, used.size ? Math.max(...used) + 1 : minBase);
    return () => {
        while (used.has(next)) next++;
        const id = next;
        used.add(id);
        next++;
        return id;
    };
}

function collectValidIds(items, minValue = 1) {
    const ids = [];
    for (const item of items) {
        const parsed = Number.parseInt(item?.id, 10);
        if (!Number.isNaN(parsed) && parsed >= minValue) ids.push(parsed);
    }
    return ids;
}

/**
 * Нормализует массив `task.dependencies` к плоскому массиву валидных id.
 *
 * v8.30.25: внешний adversarial-аудит P2 — `selectionHelpers.buildAlgorithmsCacheKey`
 * делает `JSON.stringify(task.dependencies || [])`, что:
 *   1) бросает `TypeError` на циклическом объекте из malicious JSON импорта;
 *   2) для не-массива даёт мусорный hash → cache stale.
 * Symmetric guard на entry point (§3.quat): нормализуем при load, не пытаемся
 * лечить в downstream.
 *
 * Контракт: только массив примитивных id (number/string), max 100 элементов
 * чтобы не раздувать ключ при злоупотреблении.
 */
function normalizeTaskDependencies(deps) {
    if (!Array.isArray(deps)) return [];
    const filtered = [];
    for (const dep of deps) {
        if (typeof dep === 'number' && Number.isFinite(dep)) filtered.push(dep);
        else if (typeof dep === 'string' && dep.length > 0 && dep.length < 64) filtered.push(dep);
        if (filtered.length >= 100) break;
    }
    return filtered;
}

function normalizeTasks(tasks = []) {
    if (!Array.isArray(tasks)) return [];
    const validIds = collectValidIds(tasks, 1);
    // База Date.now() сохраняет существующий контракт: новые id выглядят как timestamp.
    const allocate = createIdAllocator(validIds, Date.now());
    const normalized = tasks.map((task) => {
        const parsed = Number.parseInt(task?.id, 10);
        const id = (!Number.isNaN(parsed) && parsed >= 1) ? parsed : allocate();
        return {
            id,
            title: String(task.title ?? '').trim(),
            jira: sanitizeJiraUrl(task.jira),
            type: normalizeTaskType(task.type),
            comment: String(task.comment ?? '').trim(),
            excluded: task.excluded ? 1 : 0,
            est: normalizeTaskEst(task.est),
            exclusionReason: String(task.exclusionReason ?? ''),
            criteriaEvaluations: normalizeCriteriaEvaluations(task.criteriaEvaluations),
            priorityScore: normalizeNumber(task.priorityScore, 0, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, 2),
            dependencies: normalizeTaskDependencies(task.dependencies)
        };
    });
    return fixTaskOrder(normalized);
}

function normalizeTaskEst(est = {}) {
    return Object.fromEntries(
        ROLES.map(r => [r.id, normalizeNumber(est?.[r.id], 0, 0, Number.POSITIVE_INFINITY, 2)])
    );
}

function normalizeCriteria(criteria = []) {
    if (!Array.isArray(criteria)) return [];
    // v8.30.0: тот же allocator-паттерн что и для tasks — раньше default id=0
    // приводил к коллизиям если в импорте было >1 критерия без валидного id.
    const validIds = collectValidIds(criteria, 1);
    const allocate = createIdAllocator(validIds, 1);
    return criteria.map((criterion) => {
        const parsed = Number.parseInt(criterion?.id, 10);
        const id = (!Number.isNaN(parsed) && parsed >= 1) ? parsed : allocate();
        return {
            ...criterion,
            id,
            name: String(criterion.name ?? ''),
            abbreviation: String(criterion.abbreviation ?? ''),
            weight: normalizeInteger(criterion.weight, 0, 0, 100),
            rationale: String(criterion.rationale ?? ''),
            scale: { ...(criterion.scale || {}) }
        };
    });
}

function normalizeCriteriaEvaluations(evaluations = {}) {
    if (!evaluations || typeof evaluations !== 'object') return {};
    const normalized = {};
    Object.keys(evaluations).forEach((key) => {
        const item = evaluations[key] || {};
        normalized[key] = {
            score: normalizeInteger(item.score, 0, 0, 10),
            value: normalizeNumber(item.value, 0, 0, Number.POSITIVE_INFINITY, 2)
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

/**
 * v8.30.33 — honest import: analyzeImportIssues возвращает список «потерь
 * данных» которые будут применены при migratePersistedState. Используется
 * fileController перед import, чтобы показать пользователю явное
 * подтверждение «N полей будет отброшено в fallback».
 *
 * Поведение: walk по rawState, найти поля, которые **присутствуют, но
 * невалидны** относительно текущего контракта. Отсутствие поля — НЕ issue
 * (default применится молча). Только distortion.
 *
 * @param {*} rawState
 * @returns {{issues: string[]}}
 */
export function analyzeImportIssues(rawState) {
    const issues = [];
    if (!rawState || typeof rawState !== 'object') {
        return { issues };
    }

    // config: days ≥1, holidays ≥0, alert ≥0 (целые)
    const cfg = rawState.config;
    if (cfg && typeof cfg === 'object') {
        checkIntegerField(issues, 'config.days', cfg.days, 1, Number.MAX_SAFE_INTEGER);
        checkIntegerField(issues, 'config.holidays', cfg.holidays, 0, Number.MAX_SAFE_INTEGER);
        checkIntegerField(issues, 'config.alert', cfg.alert, 0, Number.MAX_SAFE_INTEGER);
        if (cfg.availCoef !== undefined && cfg.availCoef !== null) {
            const n = Number(cfg.availCoef);
            if (!Number.isFinite(n) || n < 0 || n > 100) {
                issues.push(`config.availCoef = ${JSON.stringify(cfg.availCoef)} отвергнуто (требуется число 0..100); применён fallback`);
            }
        }
    }

    // roles: fte (integer ≥0), off (decimal ≥0, 1 знак)
    if (Array.isArray(rawState.roles)) {
        rawState.roles.forEach((role, i) => {
            if (role && typeof role === 'object') {
                if (role.fte !== undefined && parseRoleField('fte', role.fte) === null) {
                    issues.push(`roles[${i}].fte = ${JSON.stringify(role.fte)} отвергнуто (требуется целое ≥0); применён fallback`);
                }
                if (role.off !== undefined && parseRoleField('off', role.off) === null) {
                    issues.push(`roles[${i}].off = ${JSON.stringify(role.off)} отвергнуто (требуется ≥0, точность 1 знак); применён fallback`);
                }
            }
        });
    }

    // criteria: weight (integer 0..100), score в evaluations (integer 0..10)
    if (Array.isArray(rawState.criteria)) {
        rawState.criteria.forEach((c, i) => {
            if (c && typeof c === 'object') {
                if (c.weight !== undefined && parseStrictIntegerInRange(c.weight, 0, 100) === null) {
                    issues.push(`criteria[${i}].weight = ${JSON.stringify(c.weight)} отвергнуто (требуется целое 0..100); применён fallback`);
                }
            }
        });
    }

    // tasks: criteriaEvaluations.score (integer 0..10), priorityScore (число),
    // dependencies (массив), excluded (0/1) — мягкие, без warning'а на каждый
    // (слишком многословно). Документируем только score-distortion.
    if (Array.isArray(rawState.tasks)) {
        rawState.tasks.forEach((t, i) => {
            if (t && typeof t === 'object' && t.criteriaEvaluations) {
                Object.entries(t.criteriaEvaluations).forEach(([critId, ev]) => {
                    if (ev && ev.score !== undefined && parseStrictIntegerInRange(ev.score, 0, 10) === null) {
                        issues.push(`tasks[${i}].criteriaEvaluations[${critId}].score = ${JSON.stringify(ev.score)} отвергнуто (требуется целое 0..10); применён fallback`);
                    }
                });
            }
        });
    }

    return { issues };
}

function checkIntegerField(issues, fieldName, value, min, max) {
    if (value === undefined || value === null) return; // отсутствие — норма
    if (parseStrictIntegerInRange(value, min, max) === null) {
        issues.push(`${fieldName} = ${JSON.stringify(value)} отвергнуто (требуется целое в [${min}, ${max}]); применён fallback`);
    }
}

/**
 * v8.30.33: strict integer для persistence/import. Раньше:
 *   parseInt('1.9', 10) → 1 (мусор, дробь усечена → принята)
 *   parseInt('1abc', 10) → 1 (мусор)
 * Теперь:
 *   '1.9' / '1abc' / NaN / Infinity → fallback (явный отказ).
 * Чистые integer (number или string из чистых цифр) принимаются и clamp'ятся
 * в [min, max]. Значение вне диапазона → fallback (clamp удалён по audit
 * фидбеку «не маскировать distortion тихим clamp'ом»).
 */
function normalizeInteger(value, fallback, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
    const parsed = parseStrictIntegerInRange(value, min, max);
    return parsed === null ? fallback : parsed;
}

/**
 * Нормализует число для persistence.
 * v8.30.23: добавлен optional `decimals` параметр и защита от non-finite.
 * Внешний аудит (P1): UI cap не работал symmetrically — JSON-import и
 * migrate пропускали raw 1.234567. Теперь все floating-point поля при
 * load прогоняются через decimals=2.
 *
 * @param {*} value
 * @param {number} fallback
 * @param {number} [min]
 * @param {number} [max]
 * @param {number|null} [decimals] — если задан, результат округляется до
 *   стольких знаков после запятой (используется для floating-point полей,
 *   которые должны соответствовать UI-инварианту ≤ 2 знаков).
 */
function normalizeNumber(value, fallback, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY, decimals = null) {
    const parsed = Number(value);
    // Defense-at-load: Infinity / NaN из импорта (например деление на 0
    // в исходной версии) НЕ должны попадать в state. Возвращаем fallback,
    // чтобы Math.max/Math.min не растягивал бесконечность до max.
    if (!Number.isFinite(parsed)) return fallback;
    let result = Math.max(min, Math.min(max, parsed));
    if (decimals !== null && Number.isFinite(decimals) && decimals >= 0) {
        const factor = 10 ** Math.floor(decimals);
        result = Math.round(result * factor) / factor;
    }
    return result;
}
