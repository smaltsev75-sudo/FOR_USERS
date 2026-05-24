// js/ui/taskList.js
// Facade for the task-list rendering surface. Implementation lives in
// js/ui/taskList/* so rendering, card sections, focus restore and overload
// indicators can be tested independently.

export { buildCriteriaHtml, buildCriteriaScoreOptions, getCriteriaScoreLevel } from './taskList/criteriaSection.js';
export { buildEstimatesHtml } from './taskList/estimatesSection.js';
export { captureCriteriaScoreFocus, restoreCriteriaScoreFocus } from './taskList/focus.js';
export { updateOverloadIndicators } from './taskList/overloadIndicators.js';
export { _getRenderGeneration, renderTaskList } from './taskList/render.js';
export { createTaskElement } from './taskList/taskCard.js';
export { filterTasks, resolveDensity } from './taskList/viewState.js';
