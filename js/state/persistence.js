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
    // v8.30.34: total function — любой non-object input (null, undefined,
    // примитив, массив верхнего уровня) превращается в пустой объект.
    // Раньше rawState.config / .tasks бросали TypeError при rawState=null
    // потому что Node не вызывал default-параметр (null !== undefined).
    const safe = (rawState && typeof rawState === 'object' && !Array.isArray(rawState))
        ? rawState
        : {};

    const defaultConfig = createDefaultConfig();
    const defaultRoles = createDefaultRoles();

    const config = normalizeConfig(safe.config, defaultConfig);
    const roles = normalizeRoles(safe.roles, defaultRoles);
    const tasks = normalizeTasks(safe.tasks);
    const criteria = normalizeCriteria(safe.criteria);
    const numberFormatSettings = normalizeNumberFormat(safe.numberFormatSettings);

    return {
        version: APP_CONFIG.STORAGE_VERSION,
        config,
        roles,
        tasks,
        criteria,
        numberFormatSettings,
        activeTab: safe.activeTab === 'criteria' ? 'criteria' : 'planning',
        taskFilter: normalizeTaskFilter(safe.taskFilter),
        taskSort: normalizeTaskSort(safe.taskSort),
        ui: normalizeUi(safe.ui),
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

// v8.30.35: safePlainObject — единый helper для всех nested JSON-ish shapes.
// Раньше каждый normalize*-функция использовала `function f(x = {})` default-
// параметр который ловил ТОЛЬКО undefined. На `null`/`'string'`/`[1,2,3]`:
//   - normalizeConfig(null, def) → `null.days` → TypeError.
//   - normalizeConfig([1,2,3], def) → `{...def, ...[1,2,3]}` загрязняет
//     config numeric keys 0/1/2. Скрытый distortion.
//   - normalizeConfig('abc', def) → `{...def, ..."abc"}` загрязняет char-keys.
// Этот helper: всё что не plain-object (null/array/primitive) → {}.
function safePlainObject(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    return {};
}

function normalizeConfig(config, defaults) {
    const safe = safePlainObject(config);
    return {
        ...defaults,
        ...safe,
        days: normalizeInteger(safe.days, defaults.days, 1),
        holidays: normalizeInteger(safe.holidays, defaults.holidays ?? 0, 0),
        availCoef: normalizeNumber(safe.availCoef, defaults.availCoef, 0, 100, 2),
        alert: normalizeInteger(safe.alert, defaults.alert, 0),
        product: String(safe.product ?? defaults.product),
        startDate: String(safe.startDate ?? defaults.startDate ?? ''),
        endDate: String(safe.endDate ?? defaults.endDate ?? '')
    };
}

function normalizeRoles(roles, defaults) {
    // v8.30.34: total — non-array (включая {}) трактуется как пустой массив,
    // дефолты применяются. null-элементы внутри массива skip'аются.
    // Раньше `({}).map(...)` бросал TypeError на load corrupt JSON.
    const safeArray = Array.isArray(roles) ? roles : [];
    const map = new Map();
    for (const role of safeArray) {
        if (role && typeof role === 'object' && role.id !== undefined && role.id !== null) {
            map.set(role.id, role);
        }
    }
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

// v8.30.34: strict ID контракт. Раньше collectValidIds использовал
// Number.parseInt('1abc', 10) === 1 → принимал parseInt-мусор и создавал
// коллизии (id "1abc" и id 1 оба становились 1, allocate ничего не делал).
// Теперь только number-integer или строка из чистых цифр; всё остальное —
// требует allocate() при последующей нормализации.
function collectValidIds(items, minValue = 1) {
    const ids = [];
    if (!Array.isArray(items)) return ids;
    for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const parsed = parseStrictIntegerInRange(item.id, minValue, Number.MAX_SAFE_INTEGER);
        if (parsed !== null) ids.push(parsed);
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
 *
 * v8.30.35: контракт ужесточён. Раньше принимали любую string ≤64ch, что
 * позволяло хранить '2abc' / '1.9' / 'self' и тащить их в selection
 * (где они не матчились ни с одной task id, тихо игнорировались). Теперь:
 *   - только strict positive integer (number или string из чистых цифр);
 *   - string из чистых цифр → number (remap "2" → 2);
 *   - дубли убираются (Set);
 *   - self-id игнорируется;
 *   - всё что не валидный id → отбрасывается (warnings собирает analyzeImportIssues).
 *
 * @param {*} deps
 * @param {number} [selfId] — id текущей задачи, для self-cycle фильтра
 */
function normalizeTaskDependencies(deps, selfId = null) {
    if (!Array.isArray(deps)) return [];
    const seen = new Set();
    const result = [];
    for (const dep of deps) {
        const parsed = parseStrictIntegerInRange(dep, 1, Number.MAX_SAFE_INTEGER);
        if (parsed === null) continue;       // invalid → skip
        if (parsed === selfId) continue;     // self-cycle → skip
        if (seen.has(parsed)) continue;       // duplicate → skip
        seen.add(parsed);
        result.push(parsed);
        if (result.length >= 100) break;
    }
    return result;
}

function normalizeTasks(tasks) {
    // v8.30.34: total — non-array (включая {}) → []. Non-object элементы (null,
    // undefined, скаляры) skip'аются полностью, не превращаются в blank-задачи.
    if (!Array.isArray(tasks)) return [];
    const objectTasks = tasks.filter((t) => t && typeof t === 'object' && !Array.isArray(t));
    const validIds = collectValidIds(objectTasks, 1);
    // База Date.now() сохраняет существующий контракт: новые id выглядят как timestamp.
    const allocate = createIdAllocator(validIds, Date.now());
    // First-owner-wins: первая задача с конкретным id сохраняет его, последующие
    // дубликаты получают allocate(). Защищает Store.updateTask от попадания
    // в несколько задач.
    const seenIds = new Set();
    const normalized = objectTasks.map((task) => {
        // Strict id: только number-integer ≥1 ИЛИ строка из чистых цифр ≥1.
        // parseInt-мусор '1abc'/'1.9'/1.9/'' → allocate новый уникальный id.
        let id = parseStrictIntegerInRange(task.id, 1, Number.MAX_SAFE_INTEGER);
        if (id === null || seenIds.has(id)) {
            id = allocate();
        }
        seenIds.add(id);
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
            // v8.30.35: dependencies нормализуются ПОСЛЕ resolution id, с
            // selfId-фильтром (self-cycle отбрасывается). Unknown id (нет
            // соответствующей task) фильтруются во втором проходе ниже,
            // где есть полный список validTaskIds.
            dependencies: normalizeTaskDependencies(task.dependencies, id)
        };
    });
    // v8.30.35: второй проход — отфильтровать unknown id из dependencies.
    // Это симметричный guard на entry point: cache key и selection алгоритмы
    // полагаются что dependencies — это array of valid existing task ids.
    const validTaskIds = new Set(normalized.map(t => t.id));
    for (const t of normalized) {
        t.dependencies = t.dependencies.filter(d => validTaskIds.has(d));
    }
    return fixTaskOrder(normalized);
}

function normalizeTaskEst(est = {}) {
    return Object.fromEntries(
        ROLES.map(r => [r.id, normalizeNumber(est?.[r.id], 0, 0, Number.POSITIVE_INFINITY, 2)])
    );
}

function normalizeCriteria(criteria) {
    // v8.30.34: total — non-array (включая {}) → []. Non-object элементы skip'аются.
    if (!Array.isArray(criteria)) return [];
    const objectCriteria = criteria.filter((c) => c && typeof c === 'object' && !Array.isArray(c));
    // v8.30.34: strict id + first-owner-wins. Раньше Number.parseInt('2abc') = 2
    // приводил к коллизии с реальным id=2.
    const validIds = collectValidIds(objectCriteria, 1);
    const allocate = createIdAllocator(validIds, 1);
    const seenIds = new Set();
    return objectCriteria.map((criterion) => {
        let id = parseStrictIntegerInRange(criterion.id, 1, Number.MAX_SAFE_INTEGER);
        if (id === null || seenIds.has(id)) {
            id = allocate();
        }
        seenIds.add(id);
        return {
            ...criterion,
            id,
            name: String(criterion.name ?? ''),
            abbreviation: String(criterion.abbreviation ?? ''),
            weight: normalizeInteger(criterion.weight, 0, 0, 100),
            rationale: String(criterion.rationale ?? ''),
            // v8.30.35: safePlainObject — раньше `{...(criterion.scale || {})}`
            // на array принимал numeric-key spread (`{...[1,2,3]}` → {0:1,1:2,2:3}),
            // на string — char-key spread. Теперь только plain object → spread,
            // иначе пустой объект.
            scale: { ...safePlainObject(criterion.scale) }
        };
    });
}

function normalizeCriteriaEvaluations(evaluations) {
    // v8.30.35: safePlainObject. Раньше {1: 'string'} ловил `'string' || {}` →
    // truthy, потом `'string'.score` = undefined → silent fallback 0 без issue.
    const safe = safePlainObject(evaluations);
    const normalized = {};
    Object.keys(safe).forEach((key) => {
        const item = safe[key];
        // v8.30.35: только plain-object item считается valid; примитивы/array → defaults.
        const safeItem = (item && typeof item === 'object' && !Array.isArray(item)) ? item : {};
        normalized[key] = {
            score: normalizeInteger(safeItem.score, 0, 0, 10),
            value: normalizeNumber(safeItem.value, 0, 0, Number.POSITIVE_INFINITY, 2)
        };
    });
    return normalized;
}

function normalizeNumberFormat(settings) {
    const safe = safePlainObject(settings);
    const separator = safe.decimalSeparator === '.' ? '.' : ',';
    return { ...DEFAULT_NUMBER_FORMAT_SETTINGS, decimalSeparator: separator };
}

function normalizeTaskFilter(filter) {
    const safe = safePlainObject(filter);
    return {
        ...DEFAULT_TASK_FILTER,
        search: String(safe.search ?? ''),
        type: ['us', 'bug', 'tech', ''].includes(safe.type) ? safe.type : ''
    };
}

function normalizeTaskSort(sort) {
    const safe = safePlainObject(sort);
    return {
        ...DEFAULT_TASK_SORT,
        by: String(safe.by || DEFAULT_TASK_SORT.by),
        order: safe.order === 'asc' ? 'asc' : 'desc'
    };
}

function normalizeUi(ui) {
    const safe = safePlainObject(ui);
    const algorithm = safe.activeAlgorithm;
    const density = safe.density;
    const viewMode = safe.viewMode;
    const rawExpanded = safe.expandedQuadrants;

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
    if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
        return { issues };
    }

    // v8.30.35: config shape — раньше null/[]/"abc" silently fell back в
    // defaults без issue. Теперь report'им любое отклонение от plain-object.
    if (rawState.config !== undefined && (rawState.config === null
        || typeof rawState.config !== 'object'
        || Array.isArray(rawState.config))) {
        const sample = JSON.stringify(rawState.config) || String(rawState.config);
        issues.push(`config = ${sample.slice(0, 80)} отвергнуто (требуется plain object); применены defaults`);
    }

    // config: days ≥1, holidays ≥0, alert ≥0 (целые) — только если config plain object
    const cfg = rawState.config;
    if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
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

    // v8.30.34: top-level shape. roles/tasks/criteria должны быть массивами;
    // объект-вместо-массива → defaults применятся, но это distortion.
    if (rawState.roles !== undefined && !Array.isArray(rawState.roles)) {
        issues.push(`roles = ${JSON.stringify(rawState.roles).slice(0, 80)} отвергнуто (требуется array); применены defaults`);
    }
    if (rawState.tasks !== undefined && !Array.isArray(rawState.tasks)) {
        issues.push(`tasks = ${JSON.stringify(rawState.tasks).slice(0, 80)} отвергнуто (требуется array); пустой список`);
    }
    if (rawState.criteria !== undefined && !Array.isArray(rawState.criteria)) {
        issues.push(`criteria = ${JSON.stringify(rawState.criteria).slice(0, 80)} отвергнуто (требуется array); пустой список`);
    }

    // roles: fte (integer ≥0), off (decimal ≥0, 1 знак)
    if (Array.isArray(rawState.roles)) {
        rawState.roles.forEach((role, i) => {
            if (role && typeof role === 'object' && !Array.isArray(role)) {
                if (role.fte !== undefined && parseRoleField('fte', role.fte) === null) {
                    issues.push(`roles[${i}].fte = ${JSON.stringify(role.fte)} отвергнуто (требуется целое ≥0); применён fallback`);
                }
                if (role.off !== undefined && parseRoleField('off', role.off) === null) {
                    issues.push(`roles[${i}].off = ${JSON.stringify(role.off)} отвергнуто (требуется ≥0, точность 1 знак); применён fallback`);
                }
            } else if (role !== undefined) {
                issues.push(`roles[${i}] = ${JSON.stringify(role)} отвергнуто (требуется object); пропущено`);
            }
        });
    }

    // criteria: id (strict positive int), weight (integer 0..100), score в evaluations
    if (Array.isArray(rawState.criteria)) {
        const seenCritIds = new Set();
        rawState.criteria.forEach((c, i) => {
            if (c && typeof c === 'object' && !Array.isArray(c)) {
                if (c.id !== undefined && parseStrictIntegerInRange(c.id, 1, Number.MAX_SAFE_INTEGER) === null) {
                    issues.push(`criteria[${i}].id = ${JSON.stringify(c.id)} отвергнуто (требуется целое ≥1); назначен новый id`);
                } else if (c.id !== undefined) {
                    const sid = parseStrictIntegerInRange(c.id, 1, Number.MAX_SAFE_INTEGER);
                    if (seenCritIds.has(sid)) {
                        issues.push(`criteria[${i}].id = ${sid} — duplicate criterion id; назначен новый`);
                    } else {
                        seenCritIds.add(sid);
                    }
                }
                if (c.weight !== undefined && parseStrictIntegerInRange(c.weight, 0, 100) === null) {
                    issues.push(`criteria[${i}].weight = ${JSON.stringify(c.weight)} отвергнуто (требуется целое 0..100); применён fallback`);
                }
            } else if (c !== undefined) {
                issues.push(`criteria[${i}] = ${JSON.stringify(c)} отвергнуто (требуется object); пропущено`);
            }
        });
    }

    // v8.30.35: pre-compute valid criterion ids ДЛЯ orphan detection в evaluations
    const validCritIds = new Set();
    if (Array.isArray(rawState.criteria)) {
        for (const c of rawState.criteria) {
            if (c && typeof c === 'object' && !Array.isArray(c)) {
                const cid = parseStrictIntegerInRange(c.id, 1, Number.MAX_SAFE_INTEGER);
                if (cid !== null) validCritIds.add(cid);
            }
        }
    }
    // v8.30.35: pre-compute valid task ids ДЛЯ unknown-dependency detection
    const validTaskIds = new Set();
    if (Array.isArray(rawState.tasks)) {
        for (const t of rawState.tasks) {
            if (t && typeof t === 'object' && !Array.isArray(t)) {
                const tid = parseStrictIntegerInRange(t.id, 1, Number.MAX_SAFE_INTEGER);
                if (tid !== null) validTaskIds.add(tid);
            }
        }
    }

    // tasks: id (strict positive int), criteriaEvaluations.score (integer 0..10),
    // dependencies (strict integer, no self, no unknown, no cycle).
    if (Array.isArray(rawState.tasks)) {
        const seenTaskIds = new Set();
        rawState.tasks.forEach((t, i) => {
            if (t && typeof t === 'object' && !Array.isArray(t)) {
                const taskId = parseStrictIntegerInRange(t.id, 1, Number.MAX_SAFE_INTEGER);
                if (t.id !== undefined && taskId === null) {
                    issues.push(`tasks[${i}].id = ${JSON.stringify(t.id)} отвергнуто (требуется целое ≥1); назначен новый id`);
                } else if (taskId !== null) {
                    if (seenTaskIds.has(taskId)) {
                        issues.push(`tasks[${i}].id = ${taskId} — duplicate task id; назначен новый (risk: update/delete мог попасть в несколько задач)`);
                    } else {
                        seenTaskIds.add(taskId);
                    }
                }

                // v8.30.35: criteriaEvaluations — расширенная проверка.
                if (t.criteriaEvaluations !== undefined) {
                    if (t.criteriaEvaluations === null
                        || typeof t.criteriaEvaluations !== 'object'
                        || Array.isArray(t.criteriaEvaluations)) {
                        const sample = JSON.stringify(t.criteriaEvaluations) || String(t.criteriaEvaluations);
                        issues.push(`tasks[${i}].criteriaEvaluations = ${sample.slice(0, 80)} отвергнуто (требуется plain object); применён пустой`);
                    } else {
                        Object.entries(t.criteriaEvaluations).forEach(([critKey, ev]) => {
                            // Key должен быть strict positive integer
                            const parsedKey = parseStrictIntegerInRange(critKey, 1, Number.MAX_SAFE_INTEGER);
                            if (parsedKey === null) {
                                issues.push(`tasks[${i}].criteriaEvaluations[${JSON.stringify(critKey)}] — invalid key (требуется целое ≥1)`);
                                return;
                            }
                            // Orphan: ключ не соответствует ни одному criterion id
                            if (validCritIds.size > 0 && !validCritIds.has(parsedKey)) {
                                issues.push(`tasks[${i}].criteriaEvaluations[${critKey}] — orphaned key (нет criterion с id=${parsedKey})`);
                            }
                            // Item должен быть plain-object
                            if (ev === null || typeof ev !== 'object' || Array.isArray(ev)) {
                                const sample = JSON.stringify(ev) || String(ev);
                                issues.push(`tasks[${i}].criteriaEvaluations[${critKey}] = ${sample.slice(0, 60)} отвергнуто (требуется object); применён {score:0,value:0}`);
                                return;
                            }
                            // score должен быть целое 0..10
                            if (ev.score !== undefined && parseStrictIntegerInRange(ev.score, 0, 10) === null) {
                                issues.push(`tasks[${i}].criteriaEvaluations[${critKey}].score = ${JSON.stringify(ev.score)} отвергнуто (требуется целое 0..10); применён fallback`);
                            }
                        });
                    }
                }

                // v8.30.35: dependencies — детальная проверка контракта.
                if (t.dependencies !== undefined) {
                    if (!Array.isArray(t.dependencies)) {
                        issues.push(`tasks[${i}].dependencies = ${JSON.stringify(t.dependencies).slice(0, 80)} отвергнуто (требуется array); применён []`);
                    } else {
                        const normalized = [];
                        t.dependencies.forEach((dep, j) => {
                            const parsed = parseStrictIntegerInRange(dep, 1, Number.MAX_SAFE_INTEGER);
                            if (parsed === null) {
                                issues.push(`tasks[${i}].dependencies[${j}] = ${JSON.stringify(dep)} — invalid id (требуется целое ≥1); отброшено`);
                                return;
                            }
                            if (taskId !== null && parsed === taskId) {
                                issues.push(`tasks[${i}].dependencies[${j}] = ${parsed} — self-dependency (cycle of length 1); отброшено`);
                                return;
                            }
                            if (validTaskIds.size > 0 && !validTaskIds.has(parsed)) {
                                issues.push(`tasks[${i}].dependencies[${j}] = ${parsed} — unknown task id (нет такой задачи); отброшено`);
                                return;
                            }
                            normalized.push(parsed);
                        });
                    }
                }
            } else if (t !== undefined) {
                issues.push(`tasks[${i}] = ${JSON.stringify(t)} отвергнуто (требуется object); пропущено`);
            }
        });

        // v8.30.35: detect cycles (A→B→A, A→B→C→A) поверх валидных id.
        // Используем normalized depencies = только valid in-range integer-ids
        // (без junk и self).
        const adj = new Map();
        rawState.tasks.forEach((t) => {
            if (!t || typeof t !== 'object' || Array.isArray(t)) return;
            const tid = parseStrictIntegerInRange(t.id, 1, Number.MAX_SAFE_INTEGER);
            if (tid === null) return;
            if (!Array.isArray(t.dependencies)) return;
            const deps = [];
            for (const d of t.dependencies) {
                const dn = parseStrictIntegerInRange(d, 1, Number.MAX_SAFE_INTEGER);
                if (dn === null || dn === tid) continue;
                if (validTaskIds.has(dn)) deps.push(dn);
            }
            adj.set(tid, deps);
        });
        const WHITE = 0, GRAY = 1, BLACK = 2;
        const color = new Map();
        const cycles = new Set(); // canonical-key для дедупа
        function dfs(u, path) {
            color.set(u, GRAY);
            for (const v of (adj.get(u) || [])) {
                if (color.get(v) === GRAY) {
                    const cyclePath = [...path.slice(path.indexOf(v)), v];
                    cycles.add(cyclePath.slice().sort((a, b) => a - b).join('→'));
                } else if ((color.get(v) || WHITE) === WHITE) {
                    dfs(v, [...path, v]);
                }
            }
            color.set(u, BLACK);
        }
        for (const node of adj.keys()) {
            if ((color.get(node) || WHITE) === WHITE) dfs(node, [node]);
        }
        cycles.forEach(c => {
            issues.push(`tasks.dependencies cycle detected: ${c.replace(/→/g, ' → ')}; зависимости отброшены`);
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
