import { calculateAvailability } from '../../domain/role.js';
import { calculatePriorityScore } from '../../domain/criteria.js';
import { calculateTaskTotal } from '../../domain/task.js';
import { captureCriteriaScoreFocus, restoreCriteriaScoreFocus } from './focus.js';
import { createTaskElement } from './taskCard.js';
import { filterTasks, resolveDensity } from './viewState.js';
import { createOverloadIndicatorModel, updateOverloadIndicators } from './overloadIndicators.js';

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

function highlightNewTask(state, taskListEl) {
    if (!state.lastAddedTaskId || state.lastAddedTaskId === lastHandledAddedTaskId) return;
    const addedTaskId = state.lastAddedTaskId;

    // v8.30.6: ограниченный retry. До v8.30.6 setTimeout(doHighlight, 100) без
    // лимита крутился вечно, если активный фильтр скрывал созданную задачу.
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
            lastHandledAddedTaskId = addedTaskId;
            return;
        }
        setTimeout(doHighlight, 100);
    };

    doHighlight();
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
    const overloadModel = createOverloadIndicatorModel(state, nfs);

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

    const firstBatch = filteredTasks.slice(0, BATCH_SIZE);
    const fragment = document.createDocumentFragment();
    firstBatch.forEach((task, index) => fragment.appendChild(renderTask(task, index)));
    taskListEl.appendChild(fragment);
    updateOverloadIndicators(state, nfs, {
        model: overloadModel,
        root: taskListEl,
        taskIds: firstBatch.map(task => task.id)
    });

    // v8.30.31: updateOverloadIndicators вызывается после каждого batch'а,
    // иначе late-rendered задачи остаются без overload-тегов.
    if (filteredTasks.length > BATCH_SIZE) {
        const remaining = filteredTasks.slice(BATCH_SIZE);
        let i = 0;
        const renderNextBatch = (deadline) => {
            if (myGeneration !== renderGeneration) return;
            const batchFragment = document.createDocumentFragment();
            const renderedIds = [];
            while (i < remaining.length && (typeof deadline === 'undefined' || deadline.timeRemaining() > 5)) {
                const task = remaining[i];
                batchFragment.appendChild(renderTask(task, BATCH_SIZE + i));
                renderedIds.push(task.id);
                i++;
            }
            taskListEl.appendChild(batchFragment);
            updateOverloadIndicators(state, nfs, {
                model: overloadModel,
                root: taskListEl,
                taskIds: renderedIds
            });
            if (i < remaining.length) {
                (window.requestIdleCallback || ((cb) => setTimeout(cb, 16)))(renderNextBatch);
            }
        };
        (window.requestIdleCallback || ((cb) => setTimeout(cb, 16)))(renderNextBatch);
    }

    if (taskController && taskController.selectedTaskId) {
        const selectedEl = taskListEl.querySelector(`.task-item[data-id="${taskController.selectedTaskId}"]`);
        if (selectedEl) {
            selectedEl.classList.add('selected-task');
        }
    }

    highlightNewTask(state, taskListEl);
    pulseChangedPriorityScores(taskListEl, previousScores);
    restoreCriteriaScoreFocus(taskListEl, focusedCriteriaScoreKey);
}
