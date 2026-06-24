// js/ui/index.js
import { getNFS } from './utils.js';
import { renderHeader } from './header.js';
import { renderTeamCapacity } from './teamCapacity.js';
import { renderMatrix } from './matrix.js';
import { renderTaskList } from './taskList.js';
import { renderGroupedTasks } from './taskListGrouped.js';
import { renderCriteriaList } from './criteriaList.js';
import { updateCreateFormTotal } from './createForm.js';

export function renderApp(state, deps = {}) {
    const nfs = getNFS(deps.nfs);
    renderHeader(state);
    // Team Capacity Dashboard (v8.21) — premium-карточки, объединяющие
    // gauge + 5 cards (иконка+bar+inputs). Заменяет capacityStrip + roleList.
    renderTeamCapacity(state, nfs, deps.capacityPreview || {});
    renderMatrix(state, nfs);
    // ── view-toggle (stream C) ─────────────────────────────────
    // Поток B при добавлении density выбирает режим внутри своей карточки;
    // ветка по viewMode делается ЗДЕСЬ, чтобы оба контроллера работали независимо.
    const viewMode = state.ui?.viewMode || 'list';
    if (viewMode === 'quadrants') {
        renderGroupedTasks(state, nfs, deps.taskController);
    } else {
        renderTaskList(state, nfs, deps.taskController);
    }
    renderCriteriaList(state, nfs);
    updateCreateFormTotal(nfs);
}
