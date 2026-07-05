import { updateOverloadIndicators } from './overloadIndicators.js';
import { resolveDensity } from './viewState.js';

function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value)
        .sort()
        .reduce((acc, key) => {
            const item = value[key];
            if (typeof item !== 'function' && item !== undefined) {
                acc[key] = stableValue(item);
            }
            return acc;
        }, {});
}

function signature(value) {
    return JSON.stringify(stableValue(value));
}

function taskIdOf(task) {
    return String(task?.id ?? '');
}

function buildFilterSignature(taskFilter = {}) {
    return signature({
        search: taskFilter.search || '',
        type: taskFilter.type || ''
    });
}

function buildCriteriaSignature(criteria = []) {
    return signature(criteria.map(criterion => ({
        id: criterion?.id,
        name: criterion?.name,
        abbreviation: criterion?.abbreviation,
        weight: criterion?.weight
    })));
}

function buildRolesSignature(roles = []) {
    return signature(roles.map(role => ({
        id: role?.id,
        name: role?.name,
        fte: role?.fte,
        off: role?.off,
        offDays: role?.offDays
    })));
}

function buildNfsSignature(nfs = {}) {
    return signature({
        locale: nfs.locale,
        decimalSeparator: nfs.decimalSeparator,
        precision: nfs.precision
    });
}

export function buildTaskListSnapshot(state, filteredTasks, { nfs } = {}) {
    const tasks = Array.isArray(filteredTasks) ? filteredTasks : [];
    return {
        density: resolveDensity(state?.ui),
        viewMode: state?.ui?.viewMode || 'list',
        filterSignature: buildFilterSignature(state?.taskFilter),
        empty: tasks.length === 0,
        orderedIds: tasks.map(taskIdOf),
        criteriaSignature: buildCriteriaSignature(state?.criteria),
        rolesSignature: buildRolesSignature(state?.roles),
        configSignature: signature(state?.config || {}),
        nfsSignature: buildNfsSignature(nfs),
        taskSignatures: new Map(tasks.map(task => [taskIdOf(task), signature(task)]))
    };
}

export function shouldFullRebuildTaskList(prevSnapshot, nextSnapshot) {
    if (!prevSnapshot || !nextSnapshot) return true;

    const shapeKeys = [
        'density',
        'viewMode',
        'filterSignature',
        'empty',
        'criteriaSignature',
        'rolesSignature',
        'configSignature',
        'nfsSignature'
    ];
    if (shapeKeys.some(key => prevSnapshot[key] !== nextSnapshot[key])) return true;
    if (prevSnapshot.orderedIds.length !== nextSnapshot.orderedIds.length) return true;

    return prevSnapshot.orderedIds.some((id, index) => id !== nextSnapshot.orderedIds[index]);
}

export function applyTaskSelection(taskListEl, selectedTaskId) {
    const selected = selectedTaskId === null || selectedTaskId === undefined
        ? null
        : String(selectedTaskId);
    Array.from(taskListEl.children).forEach(child => {
        if (!child.classList?.contains('task-item')) return;
        child.classList.toggle('selected-task', selected !== null && child.dataset.id === selected);
    });
}

function getTaskElementsById(taskListEl) {
    return Array.from(taskListEl.children)
        .filter(child => child.classList?.contains('task-item') && child.dataset.id)
        .reduce((map, child) => map.set(child.dataset.id, child), new Map());
}

function copyElementAttributes(target, source) {
    Array.from(target.attributes).forEach(attr => {
        if (!source.hasAttribute(attr.name)) target.removeAttribute(attr.name);
    });
    Array.from(source.attributes).forEach(attr => {
        target.setAttribute(attr.name, attr.value);
    });
}

function restoreActiveSelection(element, selection) {
    if (!selection || typeof element.setSelectionRange !== 'function') return;
    const len = element.value.length;
    try {
        element.setSelectionRange(
            Math.min(selection.start, len),
            Math.min(selection.end, len)
        );
    } catch (_) { /* Some input types do not expose selection ranges. */ }
}

function syncFormControlState(target, source, activeEl) {
    const tag = target.tagName;
    const isActive = target === activeEl;
    const selection = isActive && typeof target.selectionStart === 'number'
        ? {
            start: target.selectionStart,
            end: typeof target.selectionEnd === 'number' ? target.selectionEnd : target.selectionStart
        }
        : null;

    if (tag === 'INPUT') {
        target.value = source.value;
        target.checked = source.checked;
        restoreActiveSelection(target, selection);
        return;
    }
    if (tag === 'TEXTAREA' || tag === 'SELECT') {
        target.value = source.value;
        restoreActiveSelection(target, selection);
    }
}

function patchElementPreservingActive(currentNode, freshNode, activeEl) {
    if (!currentNode || !freshNode || currentNode.nodeType !== freshNode.nodeType) return false;
    if (!(currentNode instanceof Element) || !(freshNode instanceof Element)) return false;
    if (currentNode.tagName !== freshNode.tagName) return false;

    copyElementAttributes(currentNode, freshNode);
    syncFormControlState(currentNode, freshNode, activeEl);

    let fullyPatched = true;
    const freshChildren = Array.from(freshNode.children);

    freshChildren.forEach((freshChild, index) => {
        const currentChild = currentNode.children[index];
        if (!currentChild) {
            currentNode.appendChild(freshChild);
            return;
        }
        if (currentChild.contains(activeEl)) {
            fullyPatched = patchElementPreservingActive(currentChild, freshChild, activeEl) && fullyPatched;
            return;
        }
        currentChild.replaceWith(freshChild);
    });

    while (currentNode.children.length > freshChildren.length) {
        currentNode.lastElementChild.remove();
    }

    return fullyPatched;
}

function patchTaskNodePreservingActive(currentNode, freshNode, activeEl) {
    const previousSignature = currentNode.dataset.renderSignature;
    const fullyPatched = patchElementPreservingActive(currentNode, freshNode, activeEl);
    if (!fullyPatched) currentNode.dataset.renderSignature = previousSignature;
    return fullyPatched;
}

export function reconcileTaskListDom({
    taskListEl,
    state,
    nfs,
    filteredTasks,
    renderTask,
    snapshot,
    overloadModel,
    selectedTaskId = null
}) {
    const existingById = getTaskElementsById(taskListEl);
    const activeEl = taskListEl.ownerDocument?.activeElement || null;
    const renderedIds = [];

    filteredTasks.forEach((task, index) => {
        const taskId = taskIdOf(task);
        const expectedSignature = snapshot.taskSignatures.get(taskId);
        let node = existingById.get(taskId);
        const previousNode = node;
        const canReuse = node && node.dataset.renderSignature === expectedSignature;

        if (!canReuse) {
            const keepActiveNode = Boolean(node && activeEl && node.contains(activeEl));
            if (!keepActiveNode) {
                node = renderTask(task, index);
                node.dataset.renderSignature = expectedSignature;
            } else {
                const freshNode = renderTask(task, index);
                freshNode.dataset.renderSignature = expectedSignature;
                const fullyPatched = patchTaskNodePreservingActive(node, freshNode, activeEl);
                if (fullyPatched) node.dataset.renderSignature = expectedSignature;
                node.dataset.index = String(index);
            }
        } else {
            node.dataset.index = String(index);
        }

        const currentAtIndex = taskListEl.children[index];
        if (currentAtIndex !== node) {
            taskListEl.insertBefore(node, currentAtIndex || null);
        }
        if (previousNode && previousNode !== node) {
            previousNode.remove();
        }

        existingById.delete(taskId);
        renderedIds.push(task.id);
    });

    existingById.forEach(node => node.remove());
    applyTaskSelection(taskListEl, selectedTaskId);

    if (overloadModel) {
        updateOverloadIndicators(state, nfs, {
            model: overloadModel,
            root: taskListEl,
            taskIds: renderedIds
        });
    }

    return { renderedIds };
}
