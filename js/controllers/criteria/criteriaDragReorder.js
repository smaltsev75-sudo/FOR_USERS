export function handleCriteriaDragMouseDown(e) {
    const grip = e.target.closest('.criteria-item-grip');
    if (!grip) return;

    const item = grip.closest('.criteria-item');
    if (item) item.setAttribute('draggable', 'true');
}

export function handleCriteriaDragStart(controller, e) {
    const item = e.target.closest('.criteria-item');
    if (!item || !item.getAttribute('draggable')) return;

    controller._dragSourceId = +item.dataset.id;
    item.classList.add('is-dragging');
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(controller._dragSourceId));
    }
}

export function handleCriteriaDragOver(controller, e) {
    if (controller._dragSourceId === null) return;

    const targetItem = e.target.closest('.criteria-item');
    if (!targetItem) return;

    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

    const list = e.target.closest('#criteriaList');
    if (list) {
        list.querySelectorAll('.criteria-item.is-drop-target').forEach(el => {
            if (el !== targetItem) el.classList.remove('is-drop-target');
        });
    }
    if (+targetItem.dataset.id !== controller._dragSourceId) {
        targetItem.classList.add('is-drop-target');
    }
}

export function handleCriteriaDragLeave(e) {
    const targetItem = e.target.closest('.criteria-item');
    if (targetItem) targetItem.classList.remove('is-drop-target');
}

export function handleCriteriaDrop(controller, e) {
    e.preventDefault();
    if (controller._dragSourceId === null) return;

    const targetItem = e.target.closest('.criteria-item');
    const list = e.target.closest('#criteriaList');
    if (!targetItem || !list) {
        resetCriteriaDragState(controller);
        return;
    }

    const targetId = +targetItem.dataset.id;
    if (targetId === controller._dragSourceId) {
        resetCriteriaDragState(controller);
        return;
    }

    const ids = (controller.store.getState().criteria || []).map(c => c.id);
    const fromIdx = ids.indexOf(controller._dragSourceId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) {
        resetCriteriaDragState(controller);
        return;
    }

    const [moved] = ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, moved);

    controller.store.reorderCriteria(ids);
    resetCriteriaDragState(controller);
}

export function resetCriteriaDragState(controller) {
    controller._dragSourceId = null;
    const list = document.getElementById('criteriaList');
    if (list) {
        list.querySelectorAll('.criteria-item').forEach(el => {
            el.classList.remove('is-dragging', 'is-drop-target');
            el.removeAttribute('draggable');
        });
    }
}
