// js/ui/index.js
import { getNFS, updateTabTitle } from './utils.js';
import { renderHeader } from './header.js';
import { renderRoleList, renderTeamTotal } from './roleList.js';
import { renderMatrix } from './matrix.js';
import { renderTaskList } from './taskList.js';
import { renderCriteriaList } from './criteriaList.js';
import { updateCreateFormTotal } from './createForm.js';

export function renderApp(state, deps = {}) {
    const nfs = getNFS(deps.nfs);
    renderHeader(state);
    renderRoleList(state, nfs);
    renderTeamTotal(state, nfs);
    renderMatrix(state, nfs);
    renderTaskList(state, nfs, deps.taskController);
    renderCriteriaList(state, nfs);
    updateTabTitle(state);
    updateCreateFormTotal(nfs);
}
