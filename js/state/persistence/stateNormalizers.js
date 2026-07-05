import { normalizeRoleFieldForPersistence } from '../../domain/roleFieldContract.js';
import { calculateSprintEndDate } from '../../domain/sprintSchedule.js';
import { parseDate } from '../../utils/date.js';
import {
    DEFAULT_NUMBER_FORMAT_SETTINGS,
    DEFAULT_TASK_FILTER,
    DEFAULT_TASK_SORT,
    DEFAULT_UI_STATE,
    VALID_ALGORITHMS,
    VALID_DENSITIES,
    VALID_QUADRANT_KEYS,
    VALID_VIEW_MODES
} from './constants.js';
import { normalizeInteger, normalizeNumber, safePlainObject } from './primitiveNormalizers.js';

export function normalizeConfig(config, defaults) {
    const safe = safePlainObject(config);
    const normalized = {
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
    // W40 (owner): инвариант «окончание не раньше начала» на импорт-входе —
    // UI-guard в configController этот entry point не покрывает (§3.quat,
    // симметричные guard'ы). Невалидный порядок → endDate пересчитывается
    // из startDate + days + holidays (как делает createStartDatePatch).
    const parsedStart = parseDate(normalized.startDate);
    const parsedEnd = parseDate(normalized.endDate);
    if (parsedStart && parsedEnd && parsedEnd < parsedStart) {
        normalized.endDate = calculateSprintEndDate(
            normalized.startDate,
            normalized.days + normalized.holidays
        );
    }
    return normalized;
}

export function normalizeRoles(roles, defaults) {
    const safeArray = Array.isArray(roles) ? roles : [];
    const map = new Map();
    for (const role of safeArray) {
        if (role && typeof role === 'object' && role.id !== undefined && role.id !== null) {
            map.set(role.id, role);
        }
    }

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

export function normalizeNumberFormat(settings) {
    const safe = safePlainObject(settings);
    const separator = safe.decimalSeparator === '.' ? '.' : ',';
    return { ...DEFAULT_NUMBER_FORMAT_SETTINGS, decimalSeparator: separator };
}

export function normalizeTaskFilter(filter) {
    const safe = safePlainObject(filter);
    return {
        ...DEFAULT_TASK_FILTER,
        search: String(safe.search ?? ''),
        type: ['us', 'bug', 'tech', ''].includes(safe.type) ? safe.type : ''
    };
}

export function normalizeTaskSort(sort) {
    const safe = safePlainObject(sort);
    return {
        ...DEFAULT_TASK_SORT,
        by: String(safe.by || DEFAULT_TASK_SORT.by),
        order: safe.order === 'asc' ? 'asc' : 'desc'
    };
}

export function normalizeUi(ui) {
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
        selectedTaskId: null,
        expandedQuadrants
    };
}

export function normalizeUiForStorage(ui) {
    const persistedUi = normalizeUi(ui);
    delete persistedUi.selectedTaskId;
    return persistedUi;
}
