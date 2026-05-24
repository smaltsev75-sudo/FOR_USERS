import { createTaskRowVM, getPriorityLabel, getPriorityLevel } from '../createTaskRowVM.js';
import { escapeHtml } from '../../utils/escapeHtml.js';
import { icon } from '../../utils/icons.js';
import { buildCriteriaHtml } from './criteriaSection.js';
import { buildEstimatesHtml } from './estimatesSection.js';

function buildTypeBadgeHtml(vm) {
    const typeIconMap = { us: 'bookOpen', bug: 'alertCircle', tech: 'roleCode' };
    const iconName = typeIconMap[vm.type] || 'bookOpen';
    return `<span class="task-type-badge type-${vm.type}" title="${escapeHtml(vm.typeLabel)}" aria-label="${escapeHtml(vm.typeLabel)}">${icon(iconName)}<span class="task-type-badge-text">${escapeHtml(vm.typeLabel)}</span></span>`;
}

function buildStatusBadgeHtml(vm) {
    if (vm.excluded) {
        return '<span class="task-status-badge status-excluded" title="Задача исключена из спринта">Исключена</span>';
    }
    return '<span class="task-status-badge status-active" title="В работе">В работе</span>';
}

function buildPriorityBadgeHtml(level, label, score) {
    return `<span class="task-priority-badge priority-${level}" title="Приоритет: ${escapeHtml(label)} (${score})" aria-label="Приоритет ${escapeHtml(label)}">${icon('alertCircle')}<span class="task-priority-badge-text">${escapeHtml(label)}</span></span>`;
}

/**
 * Creates a task card DOM element using VM.
 * Exported for reuse by alternate views (e.g. quadrant-grouped view).
 */
export function createTaskElement(
    task, taskEvaluations, index, roles, criteria, config, nfs, taskTotal,
    priorityScore, _availMap, _taskController, taskCount = 0
) {
    const vm = createTaskRowVM(task, criteria, roles);

    const el = document.createElement('div');
    el.className = `task-item type-${vm.type}${vm.excluded ? ' excluded' : ''}`;
    el.draggable = false; // native drag включается на ручке; тело карточки использует mouse-fallback
    el.tabIndex = 0;
    el.dataset.index = index;
    el.dataset.id = vm.id;

    const estimatesHtml = buildEstimatesHtml(task, roles, nfs, taskTotal);
    const criteriaEvaluationHtml = buildCriteriaHtml(task, taskEvaluations, criteria, nfs, priorityScore);

    let excludeTitle = vm.excluded ? 'Включить задачу в спринт' : 'Исключить задачу из спринта';
    if (vm.excluded && vm.exclusionReason) excludeTitle = ` ${vm.exclusionReason}. Нажмите, чтобы включить`;
    const excludeClass = `task-action-btn btn-exclude ${vm.excluded ? 'excluded' : ''}`;
    const excludeIconHtml = vm.excluded ? icon('eyeOff') : icon('eye');
    const editIconHtml = icon('pencil');
    const deleteIconHtml = icon('trash');
    const dragIconHtml = icon('gripVertical');
    const moveUpIconHtml = icon('chevronUp');
    const moveDownIconHtml = icon('chevronDown');
    const isFirstTask = index <= 0;
    const isLastTask = taskCount > 0 && index >= taskCount - 1;
    const moveUpDisabled = isFirstTask ? ' disabled' : '';
    const moveDownDisabled = isLastTask ? ' disabled' : '';

    const priorityLevel = getPriorityLevel(priorityScore);
    const priorityLabel = getPriorityLabel(priorityLevel);
    const typeBadgeHtml = buildTypeBadgeHtml(vm);
    const statusBadgeHtml = buildStatusBadgeHtml(vm);
    const priorityBadgeHtml = buildPriorityBadgeHtml(priorityLevel, priorityLabel, nfs.formatNumber(priorityScore));

    if (vm.excluded) el.classList.add('excluded');
    el.classList.add(`priority-${priorityLevel}`);

    el.innerHTML = `
        <div class="task-row task-row--header">
            <div class="drag-handle" aria-hidden="true">${dragIconHtml}</div>
            <div class="task-order-number" title="Позиция задачи в текущем списке" aria-label="Позиция задачи в текущем списке">№${index + 1}</div>
            <div class="task-type-indicator type-${vm.type}" aria-hidden="true">${escapeHtml(vm.typeLetter)}</div>
            <div class="task-meta-badges">
                ${statusBadgeHtml}
                ${typeBadgeHtml}
                ${priorityBadgeHtml}
            </div>
            <div class="task-content">
                <div class="task-title-row">
                    <a class="task-jira-link" target="_blank" rel="noopener noreferrer"></a>
                    <div class="task-title"></div>
                </div>
                <div class="task-comment"></div>
            </div>
            <div class="task-btn-group">
                <button class="task-action-btn btn-move-up" title="Переместить задачу выше" data-action="moveUp" data-id="${vm.id}" aria-label="Переместить выше"${moveUpDisabled}>${moveUpIconHtml}</button>
                <button class="task-action-btn btn-move-down" title="Переместить задачу ниже" data-action="moveDown" data-id="${vm.id}" aria-label="Переместить ниже"${moveDownDisabled}>${moveDownIconHtml}</button>
                <button class="task-action-btn btn-edit" title="Редактировать задачу спринта" data-action="edit" data-id="${vm.id}" aria-label="Редактировать">${editIconHtml}</button>
                <button class="${excludeClass}" title="${escapeHtml(excludeTitle)}" data-action="toggleExclude" data-id="${vm.id}" aria-label="Включить или исключить">${excludeIconHtml}</button>
                <button class="task-action-btn btn-delete" title="Удалить задачу спринта" data-action="delete" data-id="${vm.id}" aria-label="Удалить">${deleteIconHtml}</button>
            </div>
        </div>
        <div class="task-estimates">${estimatesHtml}</div>
        ${criteriaEvaluationHtml}
    `;

    // Use textContent for XSS safety
    const titleEl = el.querySelector('.task-title');
    titleEl.textContent = vm.title;
    titleEl.title = vm.title;

    const jiraLink = el.querySelector('.task-jira-link');
    if (vm.jira && vm.jiraKey) {
        jiraLink.href = vm.jira;
        jiraLink.textContent = vm.jiraKey;
        jiraLink.title = vm.jira;
    } else {
        jiraLink.hidden = true;
    }

    const commentEl = el.querySelector('.task-comment');
    if (vm.comment) {
        commentEl.textContent = vm.comment;
        commentEl.title = vm.comment;
    } else {
        commentEl.hidden = true;
    }

    return el;
}
