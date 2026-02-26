import { jest } from '@jest/globals';
import {
    setSelectionLoadingState,
    buildTasksWithPriority,
    buildAlgorithmsCacheKey,
    buildComparisonDisplayData,
    computeComparisonBestValues,
    areNearlyEqual
} from '../../../../js/controllers/selection/selectionHelpers.js';

describe('controllers/selectionHelpers', () => {
    test('areNearlyEqual treats very close floating values as equal', () => {
        expect(areNearlyEqual(694.6, 694.6000000001)).toBe(true);
    });

    test('areNearlyEqual returns false for clearly different values', () => {
        expect(areNearlyEqual(694.6, 694.7)).toBe(false);
    });

    // ── setSelectionLoadingState ──────────────────────────────────────────────

    test('setSelectionLoadingState shows loading state', () => {
        const loadingEl = { style: { display: '' } };
        const actionBtn = { disabled: false };
        setSelectionLoadingState(loadingEl, actionBtn, true);
        expect(loadingEl.style.display).toBe('flex');
        expect(actionBtn.disabled).toBe(true);
    });

    test('setSelectionLoadingState hides loading state', () => {
        const loadingEl = { style: { display: 'flex' } };
        const actionBtn = { disabled: true };
        setSelectionLoadingState(loadingEl, actionBtn, false);
        expect(loadingEl.style.display).toBe('none');
        expect(actionBtn.disabled).toBe(false);
    });

    test('setSelectionLoadingState handles null elements', () => {
        expect(() => setSelectionLoadingState(null, null, true)).not.toThrow();
        expect(() => setSelectionLoadingState(null, null, false)).not.toThrow();
    });

    // ── buildTasksWithPriority ───────────────────────────────────────────────

    test('buildTasksWithPriority calculates priority and effort', () => {
        const tasks = [
            { id: 1, title: 'T1', est: { uiux: 5, fe: 3 }, criteriaEvaluations: {} }
        ];
        const criteriaManager = {
            calculatePriorityScore: jest.fn().mockReturnValue(42)
        };
        const roles = [{ id: 'uiux', fte: 1, off: 0 }, { id: 'fe', fte: 1, off: 0 }];

        const result = buildTasksWithPriority(tasks, criteriaManager, roles);
        expect(result).toHaveLength(1);
        expect(result[0].priorityScore).toBe(42);
        expect(result[0].effort).toBeGreaterThanOrEqual(0);
        expect(result[0].roleEffort).toBeDefined();
    });

    test('buildTasksWithPriority handles tasks without est', () => {
        const tasks = [{ id: 1, title: 'T1', criteriaEvaluations: {} }];
        const criteriaManager = { calculatePriorityScore: jest.fn().mockReturnValue(0) };
        const roles = [{ id: 'fe', fte: 1, off: 0 }];

        const result = buildTasksWithPriority(tasks, criteriaManager, roles);
        expect(result[0].roleEffort.fe).toBe(0);
    });

    test('buildTasksWithPriority handles tasks without criteriaEvaluations', () => {
        const tasks = [{ id: 1, title: 'T1', est: { fe: 5 } }];
        const criteriaManager = { calculatePriorityScore: jest.fn().mockReturnValue(10) };
        const roles = [{ id: 'fe', fte: 1, off: 0 }];

        const result = buildTasksWithPriority(tasks, criteriaManager, roles);
        expect(criteriaManager.calculatePriorityScore).toHaveBeenCalledWith({});
    });

    // ── buildAlgorithmsCacheKey ───────────────────────────────────────────────

    test('buildAlgorithmsCacheKey produces deterministic key', () => {
        const tasks = [{ id: 1, excluded: 0, est: { fe: 5 }, priorityScore: 10 }];
        const cap = { fe: 100 };
        const k1 = buildAlgorithmsCacheKey(tasks, cap);
        const k2 = buildAlgorithmsCacheKey(tasks, cap);
        expect(k1).toBe(k2);
    });

    test('buildAlgorithmsCacheKey handles tasks without priorityScore', () => {
        const tasks = [{ id: 1, excluded: 0, est: { fe: 5 } }];
        const cap = { fe: 100 };
        const key = buildAlgorithmsCacheKey(tasks, cap);
        expect(key).toContain('0'); // fallback to 0
    });

    // ── buildComparisonDisplayData ───────────────────────────────────────────

    test('buildComparisonDisplayData builds display data from results', () => {
        const results = {
            matrix: {
                selectedTasks: [
                    { id: 1, priorityScore: 10, valueDensity: 2 },
                    { id: 2, priorityScore: 8, valueDensity: 1.5 }
                ],
                totalLoad: 20
            }
        };
        const comparison = {
            matrix: { algorithmName: 'Матрица', selectedTasks: 2, loadPercentage: 80 }
        };

        const data = buildComparisonDisplayData(results, comparison, ['matrix']);
        expect(data).toHaveLength(1);
        expect(data[0].algo).toBe('matrix');
        expect(data[0].tasksCount).toBe(2);
        expect(data[0].totalPriority).toBe(18);
        expect(data[0].avgDensity).toBe(1.75);
    });

    test('buildComparisonDisplayData skips algorithms with errors', () => {
        const results = { matrix: { error: 'fail' } };
        const comparison = { matrix: { error: 'fail' } };

        const data = buildComparisonDisplayData(results, comparison, ['matrix']);
        expect(data).toHaveLength(0);
    });

    test('buildComparisonDisplayData skips missing results', () => {
        const data = buildComparisonDisplayData({}, {}, ['matrix']);
        expect(data).toHaveLength(0);
    });

    test('buildComparisonDisplayData handles tasks with rawTask fallback', () => {
        const results = {
            matrix: {
                selectedTasks: [
                    { id: 1, rawTask: { priorityScore: 15, valueDensity: 3 } }
                ],
                totalLoad: 10
            }
        };
        const comparison = {
            matrix: { algorithmName: 'M', selectedTasks: 1, loadPercentage: 50 }
        };

        const data = buildComparisonDisplayData(results, comparison, ['matrix']);
        expect(data[0].totalPriority).toBe(15);
        expect(data[0].avgDensity).toBe(3);
    });

    test('buildComparisonDisplayData handles tasks without any score', () => {
        const results = {
            matrix: {
                selectedTasks: [{ id: 1 }],
                totalLoad: 5
            }
        };
        const comparison = {
            matrix: { selectedTasks: 1, loadPercentage: 25 }
        };

        const data = buildComparisonDisplayData(results, comparison, ['matrix']);
        expect(data[0].totalPriority).toBe(0);
        expect(data[0].avgDensity).toBe(0);
    });

    test('buildComparisonDisplayData handles empty selectedTasks', () => {
        const results = {
            matrix: { selectedTasks: [], totalLoad: 0 }
        };
        const comparison = {
            matrix: { algorithmName: 'M', selectedTasks: 0, loadPercentage: 0 }
        };

        const data = buildComparisonDisplayData(results, comparison, ['matrix']);
        expect(data[0].avgDensity).toBe(0);
    });

    test('buildComparisonDisplayData uses default algorithms parameter', () => {
        const results = {
            matrix: { selectedTasks: [], totalLoad: 0 },
            'value-density': { selectedTasks: [], totalLoad: 0 },
            hybrid: { selectedTasks: [], totalLoad: 0 }
        };
        const comparison = {
            matrix: { algorithmName: 'M', selectedTasks: 0, loadPercentage: 0 },
            'value-density': { algorithmName: 'VD', selectedTasks: 0, loadPercentage: 0 },
            hybrid: { algorithmName: 'H', selectedTasks: 0, loadPercentage: 0 }
        };

        const data = buildComparisonDisplayData(results, comparison);
        expect(data).toHaveLength(3);
    });

    // ── computeComparisonBestValues ──────────────────────────────────────────

    test('computeComparisonBestValues computes best values', () => {
        const data = [
            { tasksCount: 3, displayLoad: 85, displayEffort: 30, displayPriority: 25, displayDensity: 2.1 },
            { tasksCount: 5, displayLoad: 95, displayEffort: 40, displayPriority: 35, displayDensity: 1.8 }
        ];
        const best = computeComparisonBestValues(data);
        expect(best.bestTasks).toBe(5);
        expect(best.bestEffort).toBe(40);
        expect(best.bestPriority).toBe(35);
        expect(best.bestDensity).toBe(2.1);
        expect(best.bestLoadDiff).toBe(5); // |95 - 100| = 5
    });
});
