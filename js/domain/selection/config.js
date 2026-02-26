// js/domain/selection/config.js

export const SELECTION_CONFIG = {
    TARGET_MIN_LOAD: 0.95,
    TARGET_MAX_LOAD: 1.00,
    UNDERLOAD_THRESHOLD: 0.70,
    TEAM_UNDERLOAD_THRESHOLD: 0.80,
    TEAM_OVERLOAD_THRESHOLD: 0.95,
    ROLES: ['uiux', 'ca', 'fe', 'be', 'qa'],
    ALGORITHMS: {
        MATRIX: 'matrix',
        VALUE_DENSITY: 'value-density',
        HYBRID: 'hybrid'
    },
    ALGORITHM_NAMES: {
        'matrix': 'Матрица приоритетов (Priority-Effort Matrix)',
        'value-density': 'Алгоритм плотности ценности',
        'hybrid': 'Гибридный алгоритм'
    }
};

/** Ordered list of algorithm keys used throughout the app. */
export const ALGORITHM_KEYS = [
    SELECTION_CONFIG.ALGORITHMS.MATRIX,
    SELECTION_CONFIG.ALGORITHMS.VALUE_DENSITY,
    SELECTION_CONFIG.ALGORITHMS.HYBRID
];

/** Причина исключения задачи алгоритмом автоотбора. */
export const EXCLUSION_REASON_ALGORITHM = 'Исключена алгоритмом';
