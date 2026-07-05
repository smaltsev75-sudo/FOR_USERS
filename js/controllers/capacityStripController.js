// js/controllers/capacityStripController.js
//
// LEGACY file name: the live UI since v8.21 is the **Team Capacity Dashboard**
// (js/ui/teamCapacity.js). This controller drives drag-preview only and is
// re-used as-is by the Team Capacity Dashboard.
//
// Drives the live preview of the Team Capacity Dashboard during a DRAG only:
// - dragstart on .task-item → preview adding/removing that task
// - dragend / drop → clear preview
//
// Hover-preview (mouseover/mouseout) was removed: the full renderTeamCapacity
// rebuild on every passive cursor pass over a task title produced visible
// flicker on the role cards, and the preview info was rarely useful when not
// actively dragging. Drag preview stays — the user has clear intent there.
//
// The controller does NOT mutate Store — it triggers a targeted re-render
// of the strip with `previewTask` opts, leaving global state untouched.
//
// Layer: controllers/. Reads Store, writes DOM via renderCapacityStrip.

import { renderTeamCapacity } from '../ui/teamCapacity.js';
import { parseStrictIntegerInRange } from '../domain/strictInteger.js';

export class CapacityStripController {
    /**
     * @param {import('../state/store.js').Store} store
     * @param {{formatNumber: Function}} nfs
     */
    constructor(store, nfs) {
        this.store = store;
        this.nfs = nfs;
        this.taskListEl = null;
        this.activePreviewId = null;
        // Bind once for add/removeEventListener parity
        this._onTaskDragStart = this._onTaskDragStart.bind(this);
        this._onTaskDragEnd = this._onTaskDragEnd.bind(this);
    }

    init() {
        this.taskListEl = document.getElementById('taskList');
        if (!this.taskListEl) return;
        this.taskListEl.addEventListener('dragstart', this._onTaskDragStart);
        this.taskListEl.addEventListener('dragend', this._onTaskDragEnd);
        this.taskListEl.addEventListener('drop', this._onTaskDragEnd);
    }

    _onTaskDragStart(e) {
        const item = e.target.closest && e.target.closest('.task-item');
        if (!item) return;
        this._previewFromItem(item);
    }

    _onTaskDragEnd() {
        this._clearPreview();
    }

    _previewFromItem(item) {
        const id = parseStrictIntegerInRange(item.dataset.id, 1, Infinity);
        if (id === null) return;
        if (this.activePreviewId === id) return;
        const state = this.store.getState();
        const task = state.tasks.find(t => t.id === id);
        if (!task) return;
        // If task is currently included → preview "what if I removed it?"
        // If excluded → preview "what if I included it?"
        const mode = task.excluded ? 'add' : 'remove';
        this.activePreviewId = id;
        this._renderPreview(task, mode);
    }

    _clearPreview() {
        if (this.activePreviewId === null) return;
        this.activePreviewId = null;
        this._renderPreview(null, 'add');
    }

    _renderPreview(previewTask, previewMode) {
        const state = this.store.getState();
        renderTeamCapacity(state, this.nfs, { previewTask, previewMode });
    }
}
