// js/ui/taskListGrouped.js
// Рендер списка задач в режиме группировки по приоритетным квадрантам.
// Альтернатива renderTaskList — переключается через state.ui.viewMode === 'quadrants'.
//
// Каждая группа — нативный <details><summary>, что даёт встроенную семантику
// сворачивания (aria-expanded автоматически) без JS-логики. Sticky-заголовки
// реализуются CSS (position: sticky на summary). Состояние раскрытия групп
// сохраняется через state.ui.expandedQuadrants.

import { escapeHtml } from '../utils/escapeHtml.js';
import { calculateAvailability } from '../domain/role.js';
import { calculateTaskTotal } from '../domain/task.js';
import { calculatePriorityScore } from '../domain/criteria.js';
import { assignQuadrants, QUADRANT_KEYS_WITH_EXCLUDED, getQuadrantLabel, getQuadrantDescription } from '../domain/selection/quadrants.js';
import { ICONS } from '../utils/icons.js';
import { formatUiPercent } from '../utils/percent.js';
import { filterTasks, createTaskElement, resolveDensity, updateOverloadIndicators } from './taskList.js';

/**
 * Маппинг ключа квадранта → имя иконки в ICONS.
 * Иконки добавляются в js/utils/icons.js (см. C6).
 * v8.29.1: + 'excluded' → eyeOff для отдельной группы исключённых задач.
 */
const QUADRANT_ICON_NAMES = {
    q1: 'quadrant1',
    q2: 'quadrant2',
    q3: 'quadrant3',
    q4: 'quadrant4',
    excluded: 'eyeOff'
};

/**
 * Рендерит список задач, сгруппированных по 4 квадрантам приоритетной матрицы.
 * Очищает контейнер `#taskList` и заменяет его содержимое.
 *
 * @param {Object} state — состояние приложения (Store.getState())
 * @param {Object} nfs — number-format сервис
 * @param {Object|null} [taskController] — контроллер для cached priorityScore (опционально)
 */
export function renderGroupedTasks(state, nfs, taskController = null) {
    const taskListEl = document.getElementById('taskList');
    if (!taskListEl) return;
    taskListEl.replaceChildren();

    // Density должен применяться независимо от viewMode (B/C integration fix).
    taskListEl.dataset.density = resolveDensity(state.ui);

    const filteredTasks = filterTasks(state.tasks || [], state.taskFilter);

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

    // Вычисляем priorityScore и группируем по квадрантам.
    // Источник истины (по приоритету): cached → calculated → существующее task.priorityScore → 0.
    // Если у задачи нет critereaEvaluations и нет криетриев — fallback на task.priorityScore.
    const tasksWithScore = filteredTasks.map((task) => {
        const cached = taskController?.getCachedPriorityScore?.(task);
        let priorityScore = (typeof cached === 'number' && cached > 0) ? cached : null;
        if (priorityScore === null) {
            const hasCriteria = Array.isArray(state.criteria) && state.criteria.length > 0;
            const hasEvaluations = task.criteriaEvaluations && Object.keys(task.criteriaEvaluations).length > 0;
            if (hasCriteria && hasEvaluations) {
                priorityScore = calculatePriorityScore(state.criteria, task.criteriaEvaluations);
            } else {
                priorityScore = Number(task.priorityScore) || 0;
            }
        }
        return { ...task, priorityScore };
    });

    const grouped = assignQuadrants(tasksWithScore);

    // Подготавливаем контекст для рендера карточек
    const roles = state.roles || [];
    const criteria = state.criteria || [];
    const config = state.config || {};
    const availMap = {};
    roles.forEach((r) => { availMap[r.id] = calculateAvailability(r, config).useful; });

    const expandedSet = new Set(
        Array.isArray(state.ui?.expandedQuadrants)
            ? state.ui.expandedQuadrants
            : QUADRANT_KEYS_WITH_EXCLUDED // по умолчанию все раскрыты, включая excluded
    );

    // Расчёт общей capacity для процента «N% от capacity» в summary
    const totalCapacity = roles.reduce((s, r) => s + (availMap[r.id] || 0), 0);

    // Глобальный индекс задачи (для drag&drop / order-number — независим от квадрантов)
    const orderById = new Map();
    filteredTasks.forEach((t, i) => orderById.set(t.id, i));

    const fragment = document.createDocumentFragment();
    QUADRANT_KEYS_WITH_EXCLUDED.forEach((quadrantKey) => {
        const tasksInGroup = grouped[quadrantKey] || [];
        // v8.29.1: пропускаем секцию excluded если в ней нет задач —
        // не показываем пустой блок «Исключённые из спринта» при чистом спринте.
        if (quadrantKey === 'excluded' && tasksInGroup.length === 0) return;

        const groupEffort = tasksInGroup.reduce((s, t) => s + calculateTaskTotal(t.rawTask, roles), 0);
        const groupCapacityPct = totalCapacity > 0 ? (groupEffort / totalCapacity) * 100 : 0;

        const detailsEl = document.createElement('details');
        detailsEl.className = 'quadrant-group';
        if (quadrantKey === 'excluded') {
            detailsEl.classList.add('quadrant-group--excluded');
        }
        detailsEl.dataset.quadrant = quadrantKey;
        detailsEl.open = expandedSet.has(quadrantKey);

        // Summary — sticky-заголовок группы
        const summaryEl = document.createElement('summary');
        summaryEl.className = 'quadrant-group-header';

        const iconWrap = document.createElement('span');
        iconWrap.className = 'quadrant-group-icon';
        iconWrap.setAttribute('aria-hidden', 'true');
        iconWrap.innerHTML = ICONS[QUADRANT_ICON_NAMES[quadrantKey]] || '';

        const titleEl = document.createElement('span');
        titleEl.className = 'quadrant-group-title';
        titleEl.textContent = getQuadrantLabel(quadrantKey);
        titleEl.title = getQuadrantDescription(quadrantKey);

        const summaryStats = document.createElement('span');
        summaryStats.className = 'quadrant-group-summary';
        summaryStats.innerHTML = formatGroupSummary(tasksInGroup.length, groupEffort, groupCapacityPct, nfs);

        summaryEl.appendChild(iconWrap);
        summaryEl.appendChild(titleEl);
        summaryEl.appendChild(summaryStats);
        detailsEl.appendChild(summaryEl);

        // Карточки задач внутри группы
        const groupBody = document.createElement('div');
        groupBody.className = 'quadrant-group-body';
        tasksInGroup.forEach((groupedTask) => {
            const rawTask = groupedTask.rawTask;
            const taskEvaluations = rawTask.criteriaEvaluations || {};
            const taskTotal = calculateTaskTotal(rawTask, roles);
            const priorityScore = groupedTask.priorityScore;
            const globalIndex = orderById.get(rawTask.id) ?? 0;
            const card = createTaskElement(
                rawTask, taskEvaluations, globalIndex, roles, criteria,
                config, nfs, taskTotal, priorityScore, availMap, taskController, filteredTasks.length
            );
            groupBody.appendChild(card);
        });
        detailsEl.appendChild(groupBody);

        fragment.appendChild(detailsEl);
    });

    taskListEl.appendChild(fragment);

    // v8.30.31: overload-теги в Quadrants view (раньше отсутствовали — баг
    // P2 внешнего аудита). Quadrants view не использует progressive render —
    // все задачи рендерятся sync. Один вызов после appendChild достаточен.
    updateOverloadIndicators(state, nfs);
}

/**
 * Формирует HTML inline-summary для заголовка группы.
 * Текст: «12 задач · 84ч · 38%». Числа экранированы через escapeHtml.
 * @param {number} count
 * @param {number} effort
 * @param {number} capacityPct
 * @param {Object} nfs
 * @returns {string} HTML-строка
 */
function formatGroupSummary(count, effort, capacityPct, nfs) {
    const safeNfs = nfs && typeof nfs.formatNumber === 'function'
        ? nfs
        : { formatNumber: (n, d = 0) => Number(n).toFixed(d) };

    const tasksText = formatTaskCount(count);
    const effortText = `${safeNfs.formatNumber(effort)}ч`;
    const pctText = `${formatUiPercent(capacityPct)}%`;

    return `
        <span class="quadrant-summary-tasks">${escapeHtml(String(count))} ${escapeHtml(tasksText)}</span>
        <span class="quadrant-summary-sep" aria-hidden="true">·</span>
        <span class="quadrant-summary-effort">${escapeHtml(effortText)}</span>
        <span class="quadrant-summary-sep" aria-hidden="true">·</span>
        <span class="quadrant-summary-capacity" title="Доля от общей ёмкости команды">${escapeHtml(pctText)}</span>
    `.trim();
}

/**
 * Возвращает русское склонение для слова «задача».
 * 1 задача / 2 задачи / 5 задач.
 */
function formatTaskCount(n) {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return 'задач';
    if (last === 1) return 'задача';
    if (last >= 2 && last <= 4) return 'задачи';
    return 'задач';
}
