// js/ui/taskList.js
import { escapeHtml } from '../utils/escapeHtml.js';
import { calculateAvailability } from '../domain/role.js';
import { calculateTaskTotal } from '../domain/task.js';
import { calculatePriorityScore, parseCriteriaScore } from '../domain/criteria.js';
import { createTaskRowVM, getPriorityLevel, getPriorityLabel } from './createTaskRowVM.js';
import { icon } from '../utils/icons.js';
import { filterTasks, resolveDensity } from './taskList/viewState.js';
import { captureCriteriaScoreFocus, restoreCriteriaScoreFocus } from './taskList/focus.js';
import { updateOverloadIndicators } from './taskList/overloadIndicators.js';

export { filterTasks, resolveDensity, updateOverloadIndicators };

const ROLE_ICON_MAP = {
    uiux: 'rolePalette',
    ca: 'roleSearch',
    fe: 'roleCode',
    be: 'roleServer',
    qa: 'roleBugShield'
};

function buildTypeBadgeHtml(vm) {
    const typeIconMap = { us: 'bookOpen', bug: 'alertCircle', tech: 'roleCode' };
    const iconName = typeIconMap[vm.type] || 'bookOpen';
    return `<span class="task-type-badge type-${vm.type}" title="${escapeHtml(vm.typeLabel)}" aria-label="${escapeHtml(vm.typeLabel)}">${icon(iconName)}<span class="task-type-badge-text">${escapeHtml(vm.typeLabel)}</span></span>`;
}

function buildStatusBadgeHtml(vm) {
    if (vm.excluded) {
        return `<span class="task-status-badge status-excluded" title="Задача исключена из спринта">Исключена</span>`;
    }
    return `<span class="task-status-badge status-active" title="В работе">В работе</span>`;
}

function buildPriorityBadgeHtml(level, label, score) {
    return `<span class="task-priority-badge priority-${level}" title="Приоритет: ${escapeHtml(label)} (${score})" aria-label="Приоритет ${escapeHtml(label)}">${icon('alertCircle')}<span class="task-priority-badge-text">${escapeHtml(label)}</span></span>`;
}

let lastHandledAddedTaskId = null;

// v8.30.0: счётчик поколений рендера для отмены stale-batch'ей.
// Прогрессивный рендеринг (idle-callback батчи после первых 20 задач) держал
// closure на `remaining` от старого state. Если приходил новый renderTaskList()
// до завершения батчей, старый callback продолжал дозаливать stale-карточки
// в уже очищенный новый список. Каждый renderTaskList() инкрементирует
// generation; pending callback'и сверяются и абортируются если не совпадает.
let renderGeneration = 0;

/** @internal Тестовый хук — текущее поколение рендера. */
export function _getRenderGeneration() { return renderGeneration; }

function buildCriteriaScoreOptions(selectedScore) {
    let options = '';
    for (let score = 0; score <= 10; score++) {
        options += `<option value="${score}"${score === selectedScore ? ' selected' : ''}>${score}</option>`;
    }
    return options;
}

function highlightNewTask(state, taskListEl) {
    if (!state.lastAddedTaskId || state.lastAddedTaskId === lastHandledAddedTaskId) return;
    const addedTaskId = state.lastAddedTaskId;

    // v8.30.6: ограниченный retry. До v8.30.6 setTimeout(doHighlight, 100) без
    // лимита крутился вечно, если активный фильтр скрывал созданную задачу —
    // ресурсы расходовались даже после очистки lastAddedTaskId. Теперь:
    //  - максимум 20 попыток × 100ms = 2 секунды (более чем достаточно для
    //    прогрессивного рендера до 1000+ задач, см. progressive renderer в renderNextBatch).
    //  - перед каждой попыткой проверяем, не сменился ли lastAddedTaskId
    //    (новая задача создана) — тогда старый цикл сразу выходит.
    const MAX_HIGHLIGHT_ATTEMPTS = 20;
    let attempts = 0;
    const doHighlight = () => {
        const newTaskEl = taskListEl.querySelector(`.task-item[data-id="${addedTaskId}"]`);
        if (newTaskEl) {
            newTaskEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
            return;
        }
        attempts++;
        if (attempts >= MAX_HIGHLIGHT_ATTEMPTS) {
            // Задача скрыта фильтром или удалена. Маркируем как обработанную,
            // чтобы следующий render не зашёл сюда снова с тем же id.
            lastHandledAddedTaskId = addedTaskId;
            return;
        }
        setTimeout(doHighlight, 100);
    };

    doHighlight();
}

export function renderTaskList(state, nfs, taskController = null) {
    const taskListEl = document.getElementById('taskList');
    if (!taskListEl) return;

    // v8.30.0: новое поколение — pending idle-callback'и старого рендера
    // увидят расхождение и абортятся (см. renderNextBatch ниже).
    const myGeneration = ++renderGeneration;

    // v8.27.2: snapshot prior priority-score значений для pulse-анимации
    // изменившихся чисел после re-render. Хранится по task.id.
    const previousScores = new Map();
    taskListEl.querySelectorAll('.task-item').forEach((item) => {
        const valueEl = item.querySelector('.priority-score-value');
        const id = item.dataset.id;
        if (valueEl && id) previousScores.set(id, valueEl.textContent);
    });

    // v8.30.39: запоминаем focused criteria score input/stepper (если был
    // внутри #taskList), чтобы вернуть фокус после replaceChildren.
    const focusedCriteriaScoreKey = captureCriteriaScoreFocus(taskListEl);

    taskListEl.replaceChildren();

    // Density: устанавливаем data-density на контейнере для CSS-каскада
    taskListEl.dataset.density = resolveDensity(state.ui);

    const filteredTasks = filterTasks(state.tasks, state.taskFilter);

    if (filteredTasks.length === 0) {
        // v8.30.0: было inline `style.cssText` — перенесено в `.task-list-empty`.
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'task-list-empty';
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
            config, nfs, taskTotal, priorityScore, availMap, taskController, filteredTasks.length
        );
    };

    // Синхронный батч (первые 20)
    const firstBatch = filteredTasks.slice(0, BATCH_SIZE);
    const fragment = document.createDocumentFragment();
    firstBatch.forEach((task, index) => fragment.appendChild(renderTask(task, index)));
    taskListEl.appendChild(fragment);

    // Остальные задачи — асинхронно
    // v8.30.31: updateOverloadIndicators ВЫЗЫВАЕТСЯ ПОСЛЕ КАЖДОГО batch'а
    // (synchronous + async). Раньше — только один раз после sync-batch'а,
    // и для задач из async-batch'ей overload-placeholder оставался пустым.
    // Внешний аудит P2: «работает в обычном списке только до 20 задач».
    if (filteredTasks.length > BATCH_SIZE) {
        const remaining = filteredTasks.slice(BATCH_SIZE);
        let i = 0;
        const renderNextBatch = (deadline) => {
            // v8.30.0: abort если новый render() стартовал.
            if (myGeneration !== renderGeneration) return;
            const batchFragment = document.createDocumentFragment();
            while (i < remaining.length && (typeof deadline === 'undefined' || deadline.timeRemaining() > 5)) {
                batchFragment.appendChild(renderTask(remaining[i], BATCH_SIZE + i));
                i++;
            }
            taskListEl.appendChild(batchFragment);
            // v8.30.31: post-batch overload markup — обязателен после каждого
            // appendChild, иначе late-rendered задачи остаются без overload-тегов.
            updateOverloadIndicators(state, nfs);
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
    pulseChangedPriorityScores(taskListEl, previousScores);
    restoreCriteriaScoreFocus(taskListEl, focusedCriteriaScoreKey);
}

/**
 * v8.27.2: добавляет .priority-score-value--pulsed классу .priority-score-value
 * у задач, чьё значение изменилось с прошлого render'а. Класс снимается через
 * 350ms — соответствует CSS-transition в task-card.css.
 * @param {HTMLElement} taskListEl
 * @param {Map<string,string>} previousScores — map taskId → previous textContent
 */
function pulseChangedPriorityScores(taskListEl, previousScores) {
    if (previousScores.size === 0) return;
    taskListEl.querySelectorAll('.task-item').forEach((item) => {
        const id = item.dataset.id;
        const valueEl = item.querySelector('.priority-score-value');
        if (!id || !valueEl) return;
        const prev = previousScores.get(id);
        if (prev === undefined || prev === valueEl.textContent) return;
        valueEl.classList.add('priority-score-value--pulsed');
        setTimeout(() => valueEl.classList.remove('priority-score-value--pulsed'), 350);
    });
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
    const maxVal = Math.max(1, ...roles.map(r => Number(task.est[r.id]) || 0));
    let chips = '';
    roles.forEach(role => {
        const val = Number(task.est[role.id]) || 0;
        const barPct = maxVal > 0 ? Math.min(100, (val / maxVal) * 100) : 0;
        const iconName = ROLE_ICON_MAP[role.id] || 'rolePalette';
        const filled = val > 0 ? 'est-box--filled' : 'est-box--empty';
        chips += `
            <div class="est-box ${filled}">
                <div class="est-box-header">
                    <span class="est-role-icon" aria-hidden="true">${icon(iconName)}</span>
                    <span class="est-role-label">${escapeHtml(role.name)}</span>
                </div>
                <div class="est-box-bar" aria-hidden="true">
                    <span class="est-box-bar-fill" style="width: ${barPct}%"></span>
                </div>
                <div class="est-input-container">
                    <input type="text" class="number-input" value="${nfs.formatNumber(val)}"
                           data-action="updateEst" data-id="${task.id}" data-role="${role.id}"
                           aria-label="${escapeHtml(role.name)} часы" ${task.excluded ? 'disabled' : ''}>
                    <span class="est-box-suffix">ч</span>
                </div>
                <div class="overload-placeholder" data-role="${role.id}"></div>
            </div>
        `;
    });
    const totalHtml = `
        <div class="est-box est-box-total" data-effort="${nfs.formatNumber(taskTotal)}">
            <span class="est-box-total-icon" aria-hidden="true">${icon('gauge')}</span>
            <span class="est-box-total-label">Σ Effort</span>
            <span class="task-effort-value">${nfs.formatNumber(taskTotal)} ч</span>
            <div class="overload-placeholder" data-role="total"></div>
        </div>
    `;
    return `
        <div class="task-estimates-label">Оценка трудозатрат</div>
        <div class="task-estimates-grid">
            <div class="task-estimates-roles">${chips}</div>
            ${totalHtml}
        </div>
    `;
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
/**
 * v8.27.2: маппит score 0-10 в один из трёх уровней «силы» (low/mid/high).
 * Используется для цвета stepper'а, заливки contribution-бара, opacity бейджа.
 * Граница 0-3 / 4-7 / 8-10 — по брифу UX-редизайна.
 * @param {number} score
 * @returns {'low'|'mid'|'high'|'zero'}
 */
function getCriteriaScoreLevel(score) {
    if (score <= 0) return 'zero';
    if (score <= 3) return 'low';
    if (score <= 7) return 'mid';
    return 'high';
}

function buildCriteriaHtml(task, taskEvaluations, criteria, nfs, priorityScore) {
    if (criteria.length === 0) return '';

    // v8.30.10: для исключённых задач показываем компактный read-only Priority Score
    // без stepper'ов и chip'ов критериев — пользователь видит итоговый приоритет
    // и может верифицировать корректность сортировки по приоритету. Раньше для
    // excluded возвращалась пустая строка → priority в карточке не показывался,
    // и сортировка excluded-секции «выглядела случайной».
    if (task.excluded) {
        const lvl = getPriorityLevel(priorityScore);
        const lbl = getPriorityLabel(lvl);
        return `
            <div class="criteria-row criteria-row--excluded">
                <div class="criteria-section-label">Приоритет</div>
                <div class="criteria-row-body">
                    <div class="priority-score-container priority-score-${lvl}" title="Приоритет: ${escapeHtml(lbl)} (${nfs.formatNumber(priorityScore)})">
                        <span class="priority-score-icon" aria-hidden="true">${icon('barChart')}</span>
                        <span class="priority-score-meta">
                            <span class="priority-score-label">Priority Score</span>
                        </span>
                        <span class="priority-score-value" data-value="${nfs.formatNumber(priorityScore)}">${nfs.formatNumber(priorityScore)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // v8.30.40: быстрые [−]/[+] сохранены, само число editable input, а
    // dropdown — отдельный native select со всеми 0..10. Datalist не подходит:
    // браузер фильтрует options по текущему тексту и показывает один вариант.
    let criteriaRows = '';
    criteria.forEach((criterion, idx) => {
        const evaluation = taskEvaluations[criterion.id] || { score: 0, value: 0 };
        const score = parseCriteriaScore(evaluation.score);
        const value = (score * criterion.weight) / 10;
        const maxValue = criterion.weight; // максимальный вклад при score=10
        const contributionPct = maxValue > 0 ? (value / maxValue) * 100 : 0;
        const level = getCriteriaScoreLevel(score);
        const mobileAbbreviation = `k-${idx + 1}`;
        const minDisabled = score <= 0;
        const maxDisabled = score >= 10;
        const criterionNameSafe = escapeHtml(criterion.name);
        const scoreOptions = buildCriteriaScoreOptions(score);
        criteriaRows += `
            <div class="criteria-eval-item" data-criterion-id="${criterion.id}" data-score-level="${level}">
                <div class="criteria-eval-head">
                    <span class="criteria-eval-abbreviation" title="${criterionNameSafe}">${escapeHtml(criterion.abbreviation)}</span>
                    <span class="mobile-criteria-abbreviation" title="${criterionNameSafe}">${mobileAbbreviation}</span>
                    <span class="criteria-eval-weight" title="Вес критерия">${criterion.weight}%</span>
                    <span class="criteria-eval-contribution" title="Вклад в Priority Score (score × weight / 10)">+${nfs.formatNumber(value)}</span>
                </div>
                <div class="criteria-eval-stepper"
                     role="group"
                     aria-label="${criterionNameSafe} оценка от 0 до 10"
                     data-id="${task.id}"
                     data-criterion-id="${criterion.id}">
                    <button type="button" class="criteria-eval-step criteria-eval-step--minus"
                            data-action="decrement" aria-label="Уменьшить" tabindex="-1"
                            ${minDisabled ? 'disabled' : ''}>−</button>
                    <span class="criteria-eval-score">
                        <input type="number"
                               class="criteria-score-input"
                               data-id="${task.id}"
                               data-criterion-id="${criterion.id}"
                               value="${score}"
                               min="0"
                               max="10"
                               step="1"
                               inputmode="numeric"
                               autocomplete="off"
                               aria-label="${criterionNameSafe} ввод оценки от 0 до 10">
                        <span class="criteria-score-dropdown">
                            <select class="criteria-score-select"
                                    data-id="${task.id}"
                                    data-criterion-id="${criterion.id}"
                                    aria-label="${criterionNameSafe} выбрать оценку от 0 до 10">
                                ${scoreOptions}
                            </select>
                        </span>
                        <span class="criteria-score-print" aria-hidden="true">${score}</span>
                    </span>
                    <button type="button" class="criteria-eval-step criteria-eval-step--plus"
                            data-action="increment" aria-label="Увеличить" tabindex="-1"
                            ${maxDisabled ? 'disabled' : ''}>+</button>
                </div>
                <div class="criteria-eval-bar" aria-hidden="true">
                    <span class="criteria-eval-bar-fill" style="width: ${contributionPct.toFixed(1)}%"></span>
                </div>
            </div>
        `;
    });

    const level = getPriorityLevel(priorityScore);
    const label = getPriorityLabel(level);

    return `
        <div class="criteria-row">
            <div class="criteria-section-label">Метрики приоритета</div>
            <div class="criteria-row-body">
                <div class="criteria-evaluation">${criteriaRows}</div>
                <div class="priority-score-container priority-score-${level}" title="Приоритет: ${escapeHtml(label)} (${nfs.formatNumber(priorityScore)})">
                    <span class="priority-score-icon" aria-hidden="true">${icon('barChart')}</span>
                    <span class="priority-score-meta">
                        <span class="priority-score-label">Priority Score</span>
                    </span>
                    <span class="priority-score-value" data-value="${nfs.formatNumber(priorityScore)}">${nfs.formatNumber(priorityScore)}</span>
                </div>
            </div>
        </div>
    `;
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
    el.style.animation = 'fadeIn 0.3s ease-out';
    el.draggable = false; // управляется динамически через TaskDragController (mousedown на .drag-handle)
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
    const printEffort = `<span class="print-only-effort">Effort: ${nfs.formatNumber(taskTotal)}</span>`;
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
            <div class="task-order-number">${index + 1}</div>
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
    ` + printEffort;

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
        jiraLink.style.display = 'none';
    }

    const commentEl = el.querySelector('.task-comment');
    if (vm.comment) {
        commentEl.textContent = vm.comment;
        commentEl.title = vm.comment;
    } else {
        commentEl.style.display = 'none';
    }

    return el;
}

