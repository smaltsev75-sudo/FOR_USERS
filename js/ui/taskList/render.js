import { calculateAvailability } from '../../domain/role.js';
import { calculatePriorityScore } from '../../domain/criteria.js';
import { calculateTaskTotal } from '../../domain/task.js';
import { captureTaskListFocus, restoreTaskListFocus } from './focus.js';
import { createTaskElement } from './taskCard.js';
import { filterTasks } from './viewState.js';
import { createOverloadIndicatorModel, updateOverloadIndicators } from './overloadIndicators.js';
import {
    applyTaskSelection,
    buildTaskListSnapshot,
    reconcileTaskListDom,
    shouldFullRebuildTaskList
} from './reconcile.js';

let lastHandledAddedTaskId = null;
let lastTaskListSnapshot = null;
let lastTaskListDomComplete = false;

// v8.30.0: счётчик поколений рендера для отмены stale-batch'ей.
// Прогрессивный рендеринг (idle-callback батчи после первых 20 задач) держал
// closure на `remaining` от старого state. Если приходил новый renderTaskList()
// до завершения батчей, старый callback продолжал дозаливать stale-карточки
// в уже очищенный новый список. Каждый renderTaskList() инкрементирует
// generation; pending callback'и сверяются и абортируются если не совпадает.
let renderGeneration = 0;

/** @internal Тестовый хук — текущее поколение рендера. */
export function _getRenderGeneration() { return renderGeneration; }

function isPatchableTaskListDom(taskListEl) {
    const children = Array.from(taskListEl.children);
    return children.length === 0 || children.every(child => child.classList.contains('task-item'));
}

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

export function renderTaskList(state, nfs, taskController = null) {
    const taskListEl = document.getElementById('taskList');
    if (!taskListEl) return;

    // v8.30.0: новое поколение — pending idle-callback'и старого рендера
    // увидят расхождение и абортятся (см. renderNextBatch ниже).
    const myGeneration = ++renderGeneration;

    // Запоминаем focused editable control внутри #taskList, чтобы вернуть фокус
    // после full rebuild без прокрутки viewport.
    const focusedTaskListControl = captureTaskListFocus(taskListEl);
    const filteredTasks = filterTasks(state.tasks, state.taskFilter);
    const nextSnapshot = buildTaskListSnapshot(state, filteredTasks, { nfs });
    const needsFullRebuild = !isPatchableTaskListDom(taskListEl)
        || !lastTaskListDomComplete
        || shouldFullRebuildTaskList(lastTaskListSnapshot, nextSnapshot);
    const selectedTaskId = state.ui?.selectedTaskId ?? null;

    taskListEl.dataset.density = nextSnapshot.density;

    if (filteredTasks.length === 0) {
        if (needsFullRebuild || !taskListEl.querySelector('.task-list-empty')) {
            // v8.30.0: было inline `style.cssText` — перенесено в `.task-list-empty`.
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'task-list-empty';
            emptyMessage.textContent = (state.taskFilter?.search || state.taskFilter?.type)
                ? 'Нет задач, соответствующих поиску/фильтру'
                : 'В спринте нет задач. Добавьте первую задачу';
            taskListEl.replaceChildren(emptyMessage);
        }
        lastTaskListSnapshot = nextSnapshot;
        lastTaskListDomComplete = true;
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
        const taskEl = createTaskElement(
            task, taskEvaluations, index, roles, criteria,
            config, nfs, taskTotal, priorityScore, availMap, taskController, filteredTasks.length
        );
        taskEl.dataset.renderSignature = nextSnapshot.taskSignatures.get(String(task.id));
        if (selectedTaskId !== null && selectedTaskId !== undefined && String(task.id) === String(selectedTaskId)) {
            taskEl.classList.add('selected-task');
        }
        return taskEl;
    };

    if (!needsFullRebuild) {
        reconcileTaskListDom({
            taskListEl,
            state,
            nfs,
            filteredTasks,
            renderTask,
            snapshot: nextSnapshot,
            overloadModel,
            selectedTaskId
        });
        lastTaskListSnapshot = nextSnapshot;
        lastTaskListDomComplete = true;
        highlightNewTask(state, taskListEl);
        restoreTaskListFocus(taskListEl, focusedTaskListControl);
        return;
    }

    taskListEl.replaceChildren();
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
        const renderNextBatch = () => {
            if (myGeneration !== renderGeneration) return;
            const batchFragment = document.createDocumentFragment();
            const renderedIds = [];
            let renderedInBatch = 0;
            while (i < remaining.length && renderedInBatch < BATCH_SIZE) {
                const task = remaining[i];
                batchFragment.appendChild(renderTask(task, BATCH_SIZE + i));
                renderedIds.push(task.id);
                i++;
                renderedInBatch++;
            }
            taskListEl.appendChild(batchFragment);
            updateOverloadIndicators(state, nfs, {
                model: overloadModel,
                root: taskListEl,
                taskIds: renderedIds
            });
            if (i < remaining.length) {
                (window.requestIdleCallback || ((cb) => setTimeout(cb, 16)))(renderNextBatch);
            } else if (myGeneration === renderGeneration) {
                lastTaskListDomComplete = true;
            }
        };
        (window.requestIdleCallback || ((cb) => setTimeout(cb, 16)))(renderNextBatch);
    }

    applyTaskSelection(taskListEl, selectedTaskId);
    lastTaskListSnapshot = nextSnapshot;
    lastTaskListDomComplete = filteredTasks.length <= BATCH_SIZE;

    highlightNewTask(state, taskListEl);
    restoreTaskListFocus(taskListEl, focusedTaskListControl);
}
