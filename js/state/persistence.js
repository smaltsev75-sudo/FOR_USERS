// js/state/persistence.js
import { createDefaultConfig } from '../domain/config.js';
import { createDefaultRoles } from '../domain/role.js';
import { APP_CONFIG } from '../utils/appConfig.js';
import { collectRawCriterionIds, normalizeCriteria } from './persistence/criteriaNormalizers.js';
import { normalizeTasks } from './persistence/taskNormalizers.js';
import {
    normalizeConfig,
    normalizeNumberFormat,
    normalizeRoles,
    normalizeTaskFilter,
    normalizeTaskSort,
    normalizeUi,
    normalizeUiForStorage
} from './persistence/stateNormalizers.js';

export { analyzeImportIssues } from './persistence/importDiagnostics.js';

/**
 * Нормализует сохраненное состояние по актуальному контракту приложения.
 * @param {Object} rawState
 * @returns {Object}
 */
export function migratePersistedState(rawState = {}) {
    // v8.30.34: total function — любой non-object input превращается в пустой объект.
    const safe = (rawState && typeof rawState === 'object' && !Array.isArray(rawState))
        ? rawState
        : {};

    const defaultConfig = createDefaultConfig();
    const defaultRoles = createDefaultRoles();

    const config = normalizeConfig(safe.config, defaultConfig);
    const roles = normalizeRoles(safe.roles, defaultRoles);
    const criteria = normalizeCriteria(safe.criteria);
    // v8.30.37: raw criterion id view нужен для alignment с analyzeImportIssues.
    const rawCriterionIdSet = collectRawCriterionIds(safe.criteria);
    const criteriaContextProvided = safe.criteria !== undefined;
    const tasks = normalizeTasks(safe.tasks, {
        validCriterionIds: criteriaContextProvided ? rawCriterionIdSet : null
    });
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
    const normalizedCriteria = normalizeCriteria(criteria);
    const validCriterionIds = new Set(normalizedCriteria.map(c => c.id));
    return {
        version: APP_CONFIG.STORAGE_VERSION,
        config: normalizeConfig(state.config, createDefaultConfig()),
        roles: normalizeRoles(state.roles, createDefaultRoles()),
        tasks: normalizeTasks(state.tasks, { validCriterionIds }),
        criteria: normalizedCriteria,
        numberFormatSettings: normalizeNumberFormat({ decimalSeparator }),
        activeTab: state.activeTab === 'criteria' ? 'criteria' : 'planning',
        taskFilter: normalizeTaskFilter(state.taskFilter),
        taskSort: normalizeTaskSort(state.taskSort),
        ui: normalizeUiForStorage(state.ui)
    };
}
