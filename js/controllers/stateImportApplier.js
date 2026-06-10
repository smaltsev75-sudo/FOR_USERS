import { migratePersistedState } from '../state/persistence.js';
import { alignTasksToCriteria, calculatePriorityScore } from '../domain/criteria.js';
import { sortTasksByPriority } from './task/taskOrderingActions.js';

export function createRuntimeSnapshot({ store, criteriaManager, nfs }) {
    return {
        state: store.getState(),
        criteria: criteriaManager.getCriteria().map(c => ({ ...c, scale: { ...(c.scale || {}) } })),
        decimalSeparator: nfs.decimalSeparator
    };
}

export function restoreRuntimeSnapshot(snapshot, { store, criteriaManager, nfs }) {
    criteriaManager.loadCriteria(snapshot.criteria);
    nfs.decimalSeparator = snapshot.decimalSeparator;
    nfs.saveSettings();
    store.loadState(snapshot.state);
}

export function applyImportedState(rawState, { store, criteriaManager, nfs }) {
    const migratedState = migratePersistedState(rawState);
    let numberFormatSaveResult = null;

    if (migratedState.numberFormatSettings) {
        nfs.decimalSeparator = migratedState.numberFormatSettings.decimalSeparator || ',';
        numberFormatSaveResult = nfs.saveSettings();
    }

    if (migratedState.criteria && migratedState.criteria.length > 0) {
        criteriaManager.loadCriteria(migratedState.criteria);
    } else {
        criteriaManager.loadDefaultCriteria();
    }

    const criteria = criteriaManager.getCriteria();
    // v2 auto-sort (owner): импортированные задачи попадают в store УЖЕ
    // отсортированными DESC по Priority Score (excluded — в конец). Сортировка
    // ДО loadState → один store.update → один кадр рендера (нет мерцания).
    const tasks = sortTasksByPriority(
        alignTasksToCriteria(migratedState.tasks, criteria),
        criteria,
        (task, taskCriteria) => calculatePriorityScore(taskCriteria, task.criteriaEvaluations)
    );
    store.loadState({
        ...migratedState,
        criteria,
        tasks
    });

    return {
        migratedState,
        criteria,
        tasks,
        numberFormatSaveResult
    };
}

// alignTasksToCriteria перенесён в domain/criteria.js (cohesion); ре-экспорт для
// существующих потребителей stateImportApplier (импорт-флоу + тесты).
export { alignTasksToCriteria };
