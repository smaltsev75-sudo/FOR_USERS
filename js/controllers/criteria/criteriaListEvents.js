import { showModal, hideModal } from '../../ui/modalManager.js';

export function wireCriteriaControllerEvents(controller) {
    const criteriaModal = document.getElementById('criteriaModal');
    const openBtn = document.getElementById('openCriteriaBtn');
    if (openBtn && criteriaModal) openBtn.addEventListener('click', () => showModal(criteriaModal));

    const closeModalBtn = document.getElementById('closeCriteriaModalBtn');
    if (closeModalBtn && criteriaModal) closeModalBtn.addEventListener('click', () => hideModal(criteriaModal));

    const closeBtn = document.getElementById('closeCriteriaBtn');
    if (closeBtn && criteriaModal) closeBtn.addEventListener('click', () => hideModal(criteriaModal));

    const closeEditModalBtn = document.getElementById('closeEditCriteriaModalBtn');
    if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', () => controller._form.closeEditCriteria());

    const cancelEditBtn = document.getElementById('cancelEditCriteriaBtn');
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => controller._form.closeEditCriteria());

    const saveBtn = document.getElementById('saveCriteriaEditBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => controller._form.saveCriteria());

    controller._form.attachNameInputHandler();

    const criteriaList = document.getElementById('criteriaList');
    if (!criteriaList) return;

    criteriaList.addEventListener('click', (e) => controller._handleListClick(e));
    criteriaList.addEventListener('input', (e) => controller._handleInlineInput(e));
    criteriaList.addEventListener('change', (e) => controller._handleInlineCommit(e));
    criteriaList.addEventListener('mousedown', (e) => controller._handleDragMouseDown(e));
    criteriaList.addEventListener('dragstart', (e) => controller._handleDragStart(e));
    criteriaList.addEventListener('dragend', (e) => controller._handleDragEnd(e));
    criteriaList.addEventListener('dragover', (e) => controller._handleDragOver(e));
    criteriaList.addEventListener('dragleave', (e) => controller._handleDragLeave(e));
    criteriaList.addEventListener('drop', (e) => controller._handleDrop(e));
}
