import { migratePersistedState } from '../state/persistence.js';

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
    const tasks = alignTasksToCriteria(migratedState.tasks, criteria);
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

export function alignTasksToCriteria(tasks, criteria) {
    return tasks.map(task => {
        const sourceEvals = task.criteriaEvaluations || {};
        const evaluations = {};
        for (const c of criteria) {
            evaluations[c.id] = sourceEvals[c.id] || { score: 0, value: 0 };
        }
        return { ...task, criteriaEvaluations: evaluations };
    });
}
