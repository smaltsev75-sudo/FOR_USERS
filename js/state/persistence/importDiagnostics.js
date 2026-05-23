import {
    addConfigIssues,
    addNestedPlainShapeIssues,
    addTopLevelShapeIssues
} from './diagnostics/configDiagnostics.js';
import { addCriteriaIssues, collectValidCriterionIds } from './diagnostics/criteriaDiagnostics.js';
import { addRoleIssues } from './diagnostics/roleDiagnostics.js';
import { addTaskIssues, collectValidTaskIds } from './diagnostics/taskDiagnostics.js';

/**
 * v8.30.33 — honest import: сообщает потери данных, которые будут применены
 * при migratePersistedState. Отсутствие поля не является issue; distortion —
 * является.
 *
 * @param {*} rawState
 * @returns {{issues: string[]}}
 */
export function analyzeImportIssues(rawState) {
    const issues = [];
    if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
        return { issues };
    }

    addConfigIssues(issues, rawState);
    addTopLevelShapeIssues(issues, rawState);
    addNestedPlainShapeIssues(issues, rawState);
    addRoleIssues(issues, rawState);
    addCriteriaIssues(issues, rawState);
    addTaskIssues(issues, rawState, {
        validCritIds: collectValidCriterionIds(rawState),
        validTaskIds: collectValidTaskIds(rawState)
    });

    return { issues };
}
