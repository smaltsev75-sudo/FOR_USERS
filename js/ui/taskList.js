// js/ui/taskList.js
import { escapeHtml } from '../utils/escapeHtml.js';
import { calculateAvailability } from '../domain/role.js';
import { calculateTaskTotal } from '../domain/task.js';
import { calculatePriorityScore } from '../domain/criteria.js';

let lastHandledAddedTaskId = null;

function filterTasks(tasks, taskFilter) {
    let filtered = [...tasks];
    const searchTerm = (taskFilter?.search || '').toLowerCase().trim();
    if (searchTerm) {
        filtered = filtered.filter(task =>
            task.title.toLowerCase().includes(searchTerm)
        );
    }
    const typeFilter = taskFilter?.type || '';
    if (typeFilter) {
        filtered = filtered.filter(task => task.type === typeFilter);
    }
    return filtered;
}

function highlightNewTask(state, taskListEl) {
    if (!state.lastAddedTaskId || state.lastAddedTaskId === lastHandledAddedTaskId) return;
    const addedTaskId = state.lastAddedTaskId;

    // Сначала делаем скролл, затем добавляем подсветку
    const doHighlight = () => {
        const newTaskEl = taskListEl.querySelector(`.task-item[data-id="${addedTaskId}"]`);
        if (newTaskEl) {
            newTaskEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Небольшая задержка чтобы скролл успел завершиться
            setTimeout(() => {
                newTaskEl.classList.add('task-item-highlight');
            }, 300);
            lastHandledAddedTaskId = addedTaskId;
            setTimeout(() => {
                const el = taskListEl.querySelector(`.task-item[data-id="${addedTaskId}"]`);
                if (el) {
                    el.classList.remove('task-item-highlight');
                }
            }, 5000);
        } else {
            // Если элемент не найден, пробуем ещё раз
            setTimeout(doHighlight, 100);
        }
    };

    doHighlight();
}

export function renderTaskList(state, nfs, taskController = null) {
    const taskListEl = document.getElementById('taskList');
    if (!taskListEl) return;
    taskListEl.replaceChildren();

    const filteredTasks = filterTasks(state.tasks, state.taskFilter);

    if (filteredTasks.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.style.cssText = 'text-align: center; padding: 20px; color: var(--text-muted); font-style: italic;';
        emptyMessage.textContent = (state.taskFilter?.search || state.taskFilter?.type)
            ? 'Нет задач, соответствующих поиску/фильтру'
            : 'В спринте нет задач. Добавьте первую задачу';
        taskListEl.appendChild(emptyMessage);
        return;
    }

    const roles = state.roles;
    const criteria = state.criteria;
    const config = state.config;
    const availMap = {};
    roles.forEach(r => availMap[r.id] = calculateAvailability(r, config).useful);

    // --- Progressive Rendering ---
    const BATCH_SIZE = 20;

    const renderTask = (task, index) => {
        const taskEvaluations = task.criteriaEvaluations || {};
        const taskTotal = calculateTaskTotal(task, roles);
        const priorityScore = taskController?.getCachedPriorityScore(task)
            || calculatePriorityScore(criteria, taskEvaluations);
        return createTaskElement(
            task, taskEvaluations, index, roles, criteria,
            config, nfs, taskTotal, priorityScore, availMap, taskController
        );
    };

    // Синхронный батч (первые 20)
    const firstBatch = filteredTasks.slice(0, BATCH_SIZE);
    const fragment = document.createDocumentFragment();
    firstBatch.forEach((task, index) => fragment.appendChild(renderTask(task, index)));
    taskListEl.appendChild(fragment);

    // Остальные задачи — асинхронно
    if (filteredTasks.length > BATCH_SIZE) {
        const remaining = filteredTasks.slice(BATCH_SIZE);
        let i = 0;
        const renderNextBatch = (deadline) => {
            const batchFragment = document.createDocumentFragment();
            while (i < remaining.length && (typeof deadline === 'undefined' || deadline.timeRemaining() > 5)) {
                batchFragment.appendChild(renderTask(remaining[i], BATCH_SIZE + i));
                i++;
            }
            taskListEl.appendChild(batchFragment);
            if (i < remaining.length) {
                (window.requestIdleCallback || ((cb) => setTimeout(cb, 16)))(renderNextBatch);
            }
        };
        (window.requestIdleCallback || ((cb) => setTimeout(cb, 16)))(renderNextBatch);
    }

    // Восстанавливаем выделение активной задачи после перерисовки
    if (taskController && taskController.selectedTaskId) {
        const selectedEl = taskListEl.querySelector(`.task-item[data-id="${taskController.selectedTaskId}"]`);
        if (selectedEl) {
            selectedEl.classList.add('selected-task');
        }
    }

    highlightNewTask(state, taskListEl);
    updateOverloadIndicators(state, nfs);
}

/**
 * Builds the estimates HTML for a task card.
 * @param {Object} task
 * @param {Array} roles
 * @param {Object} nfs
 * @param {number} taskTotal
 * @returns {string}
 */
function buildEstimatesHtml(task, roles, nfs, taskTotal) {
    let html = '';
    roles.forEach(role => {
        const val = task.est[role.id] || 0;
        html += `
            <div class="est-box">
                <div class="est-role-label">${escapeHtml(role.name)}</div>
                <div class="est-input-container">
                    <input type="text" class="number-input" value="${nfs.formatNumber(val)}" data-action="updateEst" data-id="${task.id}" data-role="${role.id}" ${task.excluded ? 'disabled' : ''}>
                </div>
                <div class="overload-placeholder" data-role="${role.id}"></div>
            </div>
        `;
    });
    html += `
        <div class="est-box est-box-total" data-effort="${nfs.formatNumber(taskTotal)}" style="text-align: right; padding-right: 5px;">
            <div class="task-effort-value">Effort: ${nfs.formatNumber(taskTotal)}</div>
            <div class="overload-placeholder" data-role="total"></div>
        </div>
    `;
    return html;
}

/**
 * Builds the criteria evaluation HTML for a task card.
 * @param {Object} task
 * @param {Object} taskEvaluations
 * @param {Array} criteria
 * @param {Object} nfs
 * @param {number} priorityScore
 * @returns {string}
 */
function buildCriteriaHtml(task, taskEvaluations, criteria, nfs, priorityScore) {
    if (criteria.length === 0 || task.excluded) return '';

    let criteriaRows = '';
    criteria.forEach((criterion, idx) => {
        const evaluation = taskEvaluations[criterion.id] || { score: 0, value: 0 };
        const score = parseInt(evaluation.score) || 0;
        const value = (score * criterion.weight) / 10;
        const mobileAbbreviation = `k-${idx + 1}`;
        criteriaRows += `
            <div class="criteria-eval-item" data-criterion-id="${criterion.id}">
                <div class="criteria-eval-abbreviation" title="${escapeHtml(criterion.name)}">${escapeHtml(criterion.abbreviation)}</div>
                <div class="mobile-criteria-abbreviation" title="${escapeHtml(criterion.name)}">${mobileAbbreviation}</div>
                <div class="criteria-eval-weight">${criterion.weight}%</div>
                <div class="criteria-eval-score">
                    <select class="criteria-score-select" data-id="${task.id}" data-criterion-id="${criterion.id}" aria-label="${escapeHtml(criterion.name)} оценка">
                        ${Array.from({ length: 11 }, (_, i) => `<option value="${i}" ${i === score ? 'selected' : ''}>${i}</option>`).join('')}
                    </select>
                </div>
                <div class="criteria-eval-value">${nfs.formatNumber(value, 1)}</div>
            </div>
        `;
    });

    return `
        <div class="criteria-row">
            <div class="criteria-evaluation">${criteriaRows}</div>
            <div class="priority-score-container">Priority Score: ${nfs.formatNumber(priorityScore, 1)}</div>
        </div>
    `;
}

/**
 * Creates a task card DOM element.
 */
function createTaskElement(task, taskEvaluations, index, roles, criteria, config, nfs, taskTotal, priorityScore, availMap, taskController) {
    const el = document.createElement('div');
    el.className = `task-item type-${task.type}${task.excluded ? ' excluded' : ''}`;
    el.style.animation = 'fadeIn 0.3s ease-out';
    el.draggable = false; // управляется динамически через TaskDragController (mousedown на .drag-handle)
    el.tabIndex = 0;
    el.dataset.index = index;
    el.dataset.id = task.id;

    const estimatesHtml = buildEstimatesHtml(task, roles, nfs, taskTotal);
    const criteriaEvaluationHtml = buildCriteriaHtml(task, taskEvaluations, criteria, nfs, priorityScore);

    const excludeIcon = task.excluded ? '🙈' : '👁';
    let excludeTitle = task.excluded ? 'Включить задачу в спринт' : 'Исключить задачу из спринта';
    if (task.excluded && task.exclusionReason) excludeTitle = ` ${task.exclusionReason}. Нажмите, чтобы включить`;
    const excludeClass = `task-action-btn btn-exclude ${task.excluded ? 'excluded' : ''}`;
    const printEffort = `<span class="print-only-effort" style="display:none;">Effort: ${nfs.formatNumber(taskTotal)}</span>`;

    const typeIndicator = task.type === 'us' ? 'U' : task.type === 'bug' ? 'B' : 'T';

    el.innerHTML = `
        <div class="task-row">
            <div class="drag-handle" aria-hidden="true">↕</div>
            <div class="task-order-number">${index + 1}</div>
            <div class="task-type-indicator type-${task.type}">${typeIndicator}</div>
            <div class="task-content">
                <div class="task-title-row">
                    <a class="task-jira-link" target="_blank" rel="noopener noreferrer"></a>
                    <div class="task-title"></div>
                </div>
                <div class="task-comment"></div>
            </div>
            <div class="task-estimates">${estimatesHtml}</div>
            <div class="task-btn-group">
                <button class="task-action-btn btn-edit" title="Редактировать задачу спринта" data-action="edit" data-id="${task.id}" aria-label="Редактировать">✎</button>
                <button class="${excludeClass}" title="${excludeTitle}" data-action="toggleExclude" data-id="${task.id}" aria-label="Включить или исключить">${excludeIcon}</button>
                <button class="task-action-btn btn-delete" title="Удалить задачу спринта" data-action="delete" data-id="${task.id}" aria-label="Удалить">🗑</button>
            </div>
        </div>
        ${criteriaEvaluationHtml}
    ` + printEffort;

    // Use textContent for XSS safety
    const titleEl = el.querySelector('.task-title');
    titleEl.textContent = task.title;
    titleEl.title = task.title;

    const jiraLink = el.querySelector('.task-jira-link');
    if (task.jira) {
        jiraLink.href = task.jira;
        // Извлекаем ключ задачи: всё после последнего "/"
        const jiraKey = task.jira.split('/').pop() || '🔗';
        jiraLink.textContent = jiraKey;
        jiraLink.title = task.jira;
    } else {
        jiraLink.style.display = 'none';
    }

    const commentEl = el.querySelector('.task-comment');
    if (task.comment) {
        commentEl.textContent = task.comment;
        commentEl.title = task.comment;
    } else {
        commentEl.style.display = 'none';
    }

    return el;
}

function updateOverloadIndicators(state, nfs) {
    const config = state.config;
    const roles = state.roles;
    const tasks = state.tasks;

    const availMap = {};
    roles.forEach(r => availMap[r.id] = calculateAvailability(r, config).useful);

    // Precompute cumulative effort per role in O(n) — keyed by task id
    const cumByRole = {}; // { roleId: Map<taskId, cumulativeSum> }
    roles.forEach(role => {
        const cumMap = new Map();
        let running = 0;
        for (const t of tasks) {
            if (t.excluded) continue;
            running += (t.est[role.id] || 0);
            cumMap.set(t.id, running);
        }
        cumByRole[role.id] = cumMap;
    });

    tasks.forEach(task => {
        const taskEl = document.querySelector(`.task-item[data-id="${task.id}"]`);
        if (!taskEl) return;
        if (task.excluded) {
            roles.forEach(role => {
                const container = taskEl.querySelector(`.overload-placeholder[data-role="${role.id}"]`);
                if (container) container.innerHTML = '<div style="height:12px"></div>';
            });
            return;
        }
        roles.forEach(role => {
            const container = taskEl.querySelector(`.overload-placeholder[data-role="${role.id}"]`);
            if (!container) return;
            const cumulativeTotal = cumByRole[role.id].get(task.id);
            if (cumulativeTotal === undefined) return;
            const cap = availMap[role.id];
            const diff = cumulativeTotal - cap;
            const pctOverload = cap > 0 ? (diff / cap * 100) : 0;
            if (cap > 0 && diff > 0 && pctOverload > config.alert) {
                const pct = (cumulativeTotal / cap * 100) - 100;
                container.innerHTML = `<div class="overload-tag" title="Перегрузка: +${nfs.formatNumber(diff)} ч (+${nfs.formatNumber(pctOverload)}%)">+${nfs.formatNumber(diff)} <span class="overload-percent">+${nfs.formatNumber(pct)}%</span></div>`;
            } else {
                container.innerHTML = '<div style="height:12px"></div>';
            }
        });
    });
}
