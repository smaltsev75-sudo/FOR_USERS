import { createTaskRowVM, getPriorityLabel, getPriorityLevel } from '../createTaskRowVM.js';
import { escapeHtml } from '../../utils/escapeHtml.js';
import { icon } from '../../utils/icons.js';
import { buildEstimatesHtml } from './estimatesSection.js';

function buildTypeBadgeHtml(vm) {
    const typeIconMap = { us: 'bookOpen', bug: 'alertCircle', tech: 'roleCode' };
    const iconName = typeIconMap[vm.type] || 'bookOpen';
    return `<span class="task-type-badge type-${vm.type}" title="${escapeHtml(vm.typeLabel)}" aria-label="${escapeHtml(vm.typeLabel)}">${icon(iconName)}<span class="task-type-badge-text">${escapeHtml(vm.typeLabel)}</span></span>`;
}

function buildStatusBadgeHtml(vm) {
    if (vm.excluded) {
        return `<span class="task-status-badge status-excluded" title="Задача исключена из спринта" aria-label="Задача исключена из спринта">${icon('eyeOff')}<span class="task-status-badge-text">Исключена</span></span>`;
    }
    return `<span class="task-status-badge status-active" title="Задача в работе (в спринте)" aria-label="Задача в работе">${icon('check')}<span class="task-status-badge-text">В работе</span></span>`;
}

function buildPriorityBadgeHtml(level, label, score) {
    return `<span class="task-priority-badge priority-${level}" title="Приоритет: ${escapeHtml(label)} (${score})" aria-label="Приоритет ${escapeHtml(label)}">${icon('gauge')}<span class="task-priority-badge-text">${escapeHtml(label)}</span></span>`;
}

/**
 * v2 redesign (owner feedback #6): единый бейдж-карточка Priority Score + Effort
 * справа в шапке карточки. Одна bordered-карточка `.task-metrics` с двумя рядами
 * `.task-metric-row` (label слева приглушённый, value справа акцентный). Заменяет
 * строку criteria-степперов в теле — оценка по критериям остаётся только в
 * модалке. Значения форматируются через nfs, tabular-nums и акцентные токены
 * (--priority-score-color / --effort-color) задаются в CSS.
 * @param {string} priorityScoreText — уже отформатированный Priority Score
 * @param {string} effortText — уже отформатированный суммарный Effort (часы)
 * @param {string} priorityScoreTitle — title для Priority Score ряда
 * @returns {string}
 */
function buildTaskMetricsHtml(priorityScoreText, effortText, priorityScoreTitle) {
    return `
        <div class="task-metrics">
            <span class="task-metric-row task-metric--priority" title="${escapeHtml(priorityScoreTitle)}">
                <span class="task-metric-label">Priority Score</span>
                <span class="task-metric-value task-metric-value--priority">${priorityScoreText}</span>
            </span>
            <span class="task-metric-row task-metric--effort" title="Суммарные трудозатраты: ${effortText} ч">
                <span class="task-metric-label">Effort</span>
                <span class="task-metric-value task-metric-value--effort">${effortText} ч</span>
            </span>
        </div>
    `;
}

function buildWorkProfileHtml(effortRisk) {
    if (!effortRisk || !effortRisk.profile) return '';
    const severity = effortRisk.severity || 'low';
    const profileLabel = effortRisk.profile.label || 'Mixed';
    const summary = effortRisk.summary || '';
    if (!summary) return '';
    const tooltip = effortRisk.tooltip || `Профиль работ: ${profileLabel}`;
    return `
        <div class="task-work-profile task-work-profile--${severity}" tabindex="0" title="${escapeHtml(tooltip)}" aria-label="${escapeHtml(tooltip)}">
            <span class="task-role-risk-summary task-role-risk-summary--${severity}">${escapeHtml(summary)}</span>
        </div>
    `;
}

/**
 * Creates a task card DOM element using VM.
 * Exported for reuse by alternate views (e.g. quadrant-grouped view).
 */
export function createTaskElement(
    task, _taskEvaluations, index, roles, criteria, config, nfs, taskTotal,
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
    const priorityScoreText = nfs.formatNumber(priorityScore);
    const effortText = nfs.formatNumber(taskTotal);
    const priorityScoreTitle = `Приоритет: ${priorityLabel} (${priorityScoreText})`;
    const taskMetricsHtml = buildTaskMetricsHtml(priorityScoreText, effortText, priorityScoreTitle);
    const workProfileHtml = buildWorkProfileHtml(vm.effortRisk);

    // SM-комментарий: иконка в строке (filled-стиль если коммент есть), редактирование
    // в модалке #noteModal. В печать попадает только заполненный (.task-note-print).
    const noteFilled = !!(typeof task.note === 'string' && task.note.trim());
    const noteBtnHtml = `<button class="task-note-btn${noteFilled ? ' task-note-btn--filled' : ''}" data-action="openNote" data-id="${vm.id}" title="${noteFilled ? 'Комментарий SM — открыть/редактировать' : 'Добавить комментарий SM'}" aria-label="${noteFilled ? 'Комментарий SM добавлен — открыть' : 'Добавить комментарий SM'}">${icon('messageSquare')}</button>`;
    const notePrintHtml = noteFilled
        ? `<div class="task-note-print"><span class="task-note-print-label">Комментарий SM:</span> ${escapeHtml(task.note)}</div>`
        : '';

    if (vm.excluded) el.classList.add('excluded');
    el.classList.add(`priority-${priorityLevel}`);

    el.innerHTML = `
        <div class="task-row task-row--header">
            <div class="drag-handle" aria-hidden="true">${dragIconHtml}</div>
            <div class="task-order-number" title="Позиция задачи в текущем списке" aria-label="Позиция задачи в текущем списке">№${index + 1}</div>
            <div class="task-type-indicator type-${vm.type}" aria-hidden="true">${escapeHtml(vm.typeLetter)}</div>
            <div class="task-meta-badges task-meta-badges--icons">
                ${typeBadgeHtml}
                ${priorityBadgeHtml}
                ${statusBadgeHtml}
            </div>
            <div class="task-content">
                <div class="task-title-row">
                    <a class="task-jira-link" target="_blank" rel="noopener noreferrer"></a>
                    <div class="task-title"></div>
                </div>
                <div class="task-comment"></div>
            </div>
            ${workProfileHtml}
            ${noteBtnHtml}
            <div class="task-btn-group">
                <button class="task-action-btn btn-move-up" title="Переместить задачу выше" data-action="moveUp" data-id="${vm.id}" aria-label="Переместить выше"${moveUpDisabled}>${moveUpIconHtml}</button>
                <button class="task-action-btn btn-move-down" title="Переместить задачу ниже" data-action="moveDown" data-id="${vm.id}" aria-label="Переместить ниже"${moveDownDisabled}>${moveDownIconHtml}</button>
                <button class="task-action-btn btn-edit" title="Редактировать задачу спринта" data-action="edit" data-id="${vm.id}" aria-label="Редактировать">${editIconHtml}</button>
                <button class="${excludeClass}" title="${escapeHtml(excludeTitle)}" data-action="toggleExclude" data-id="${vm.id}" aria-label="Включить или исключить">${excludeIconHtml}</button>
                <button class="task-action-btn btn-delete" title="Удалить задачу спринта" data-action="delete" data-id="${vm.id}" aria-label="Удалить">${deleteIconHtml}</button>
            </div>
            ${taskMetricsHtml}
        </div>
        <div class="task-estimates">${estimatesHtml}</div>
        ${notePrintHtml}
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
