// Shared persistence defaults and allow-lists.

export const DEFAULT_NUMBER_FORMAT_SETTINGS = { decimalSeparator: ',' };
export const DEFAULT_TASK_FILTER = { search: '', type: '' };
export const DEFAULT_TASK_SORT = { by: 'priority', order: 'desc' };

// v8.29.1: + 'excluded' — для persist состояния 5-й секции (см. store.js).
export const VALID_QUADRANT_KEYS = ['q1', 'q2', 'q3', 'q4', 'excluded'];
export const VALID_VIEW_MODES = ['list', 'quadrants'];

export const DEFAULT_UI_STATE = {
    activeAlgorithm: 'matrix',
    density: 'comfortable',
    viewMode: 'list',
    expandedQuadrants: [...VALID_QUADRANT_KEYS]
};

export const VALID_ALGORITHMS = ['matrix', 'value-density', 'hybrid'];
// v8.30.0: 'cozy' удалён из публичного контракта; legacy мигрирует в default.
export const VALID_DENSITIES = ['compact', 'comfortable'];
