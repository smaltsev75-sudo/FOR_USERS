// js/ui/teamCapacity.js
//
// Thin facade for the Team Capacity Dashboard. Rendering internals are split
// under js/ui/teamCapacity/* while the public imports stay backward-compatible.

export {
    renderTeamCapacity,
    renderTeamCapacity as renderCapacityStrip
} from './teamCapacity/render.js';
