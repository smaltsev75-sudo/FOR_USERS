import { compareAlgorithms, getOptimizationRecommendations, selectTasks } from '../../../../js/domain/selection/analysis.js';
import { SELECTION_CONFIG } from '../../../../js/domain/selection/config.js';

describe('domain/selection/analysis', () => {
    const tasks = [
        { id: 1, title: 'A', priorityScore: 10, effort: 5, roleEffort: { fe: 3, qa: 2 } },
        { id: 2, title: 'B', priorityScore: 8, effort: 6, roleEffort: { fe: 3, qa: 3 } }
    ];
    const capacityByRole = { uiux: 100, ca: 100, fe: 10, be: 100, qa: 10 };

    test('selectTasks throws for unknown algorithm', () => {
        expect(() => selectTasks(tasks, capacityByRole, 'unknown')).toThrow('Неизвестный алгоритм');
    });

    test('selectTasks routes to matrix algorithm', () => {
        const r = selectTasks(tasks, capacityByRole, SELECTION_CONFIG.ALGORITHMS.MATRIX);
        expect(r.algorithmName).toBeTruthy();
        expect(r.algorithm).toBe('matrix');
    });

    test('selectTasks routes to value-density algorithm', () => {
        const r = selectTasks(tasks, capacityByRole, SELECTION_CONFIG.ALGORITHMS.VALUE_DENSITY);
        expect(r.algorithm).toBe('value-density');
    });

    test('selectTasks routes to hybrid algorithm', () => {
        const r = selectTasks(tasks, capacityByRole, SELECTION_CONFIG.ALGORITHMS.HYBRID);
        expect(r.algorithm).toBe('hybrid');
    });

    test('compareAlgorithms returns comparison per algorithm', () => {
        const output = compareAlgorithms(tasks, capacityByRole);
        const keys = Object.values(SELECTION_CONFIG.ALGORITHMS);

        keys.forEach((algorithm) => {
            expect(output.results[algorithm]).toBeDefined();
            expect(output.comparison[algorithm]).toBeDefined();
            expect(output.comparison[algorithm].algorithmName).toBeTruthy();
        });
    });

    test('compareAlgorithms handles algorithm error gracefully', () => {
        // Empty tasks might cause unusual comparison values
        const output = compareAlgorithms([], capacityByRole);
        const keys = Object.values(SELECTION_CONFIG.ALGORITHMS);
        keys.forEach((algo) => {
            expect(output.comparison[algo]).toBeDefined();
            expect(output.comparison[algo].selectedTasks).toBe(0);
        });
    });

    test('compareAlgorithms efficiency is 0 when no tasks selected', () => {
        const output = compareAlgorithms([], capacityByRole);
        Object.values(SELECTION_CONFIG.ALGORITHMS).forEach((algo) => {
            expect(output.comparison[algo].efficiency).toBe(0);
        });
    });

    // ── getOptimizationRecommendations ────────────────────────────────────────

    test('getOptimizationRecommendations reports overload and team overloading', () => {
        const selectionResult = {
            stats: {
                loadByRole: { uiux: 0, ca: 0, fe: 12, be: 0, qa: 5 },
                totalLoad: 49
            }
        };
        const capacity = { uiux: 10, ca: 10, fe: 10, be: 10, qa: 10 };

        const recs = getOptimizationRecommendations(selectionResult, capacity);

        expect(recs.some((r) => r.type === 'overload' && r.role === 'fe')).toBe(true);
        expect(recs.some((r) => r.type === 'team-overload')).toBe(true);
    });

    test('getOptimizationRecommendations returns empty for null inputs', () => {
        expect(getOptimizationRecommendations(null, null)).toEqual([]);
        expect(getOptimizationRecommendations(undefined, undefined)).toEqual([]);
    });

    test('getOptimizationRecommendations reports underload', () => {
        const selectionResult = {
            stats: { loadByRole: { uiux: 2, ca: 0, fe: 0, be: 0, qa: 0 }, totalLoad: 2 }
        };
        const capacity = { uiux: 100, ca: 100, fe: 100, be: 100, qa: 100 };

        const recs = getOptimizationRecommendations(selectionResult, capacity);
        expect(recs.some((r) => r.type === 'underload')).toBe(true);
        expect(recs.some((r) => r.type === 'team-underload')).toBe(true);
    });

    test('getOptimizationRecommendations reports warning (close to overload)', () => {
        const selectionResult = {
            stats: { loadByRole: { uiux: 97, ca: 0, fe: 0, be: 0, qa: 0 }, totalLoad: 97 }
        };
        const capacity = { uiux: 100, ca: 100, fe: 100, be: 100, qa: 100 };

        const recs = getOptimizationRecommendations(selectionResult, capacity);
        expect(recs.some((r) => r.type === 'warning' && r.role === 'uiux')).toBe(true);
    });

    test('getOptimizationRecommendations reports team-optimal (90-95%)', () => {
        const totalCap = 100;
        const selectionResult = {
            stats: { loadByRole: { uiux: 92, ca: 0, fe: 0, be: 0, qa: 0 }, totalLoad: 92 }
        };
        const capacity = { uiux: totalCap, ca: 0, fe: 0, be: 0, qa: 0 };

        const recs = getOptimizationRecommendations(selectionResult, capacity);
        expect(recs.some((r) => r.type === 'team-optimal')).toBe(true);
    });

    test('getOptimizationRecommendations skips roles with zero capacity', () => {
        const selectionResult = {
            stats: { loadByRole: { uiux: 0, ca: 0, fe: 0, be: 0, qa: 0 }, totalLoad: 0 }
        };
        const capacity = { uiux: 0, ca: 0, fe: 0, be: 0, qa: 0 };

        const recs = getOptimizationRecommendations(selectionResult, capacity);
        // Should not have role-level recommendations when capacity is 0
        expect(recs.filter((r) => r.role)).toHaveLength(0);
    });

    test('getOptimizationRecommendations falls back to loadByRole/totalLoad from top level', () => {
        const selectionResult = {
            loadByRole: { uiux: 12, ca: 0, fe: 0, be: 0, qa: 0 },
            totalLoad: 12
        };
        const capacity = { uiux: 10, ca: 10, fe: 10, be: 10, qa: 10 };

        const recs = getOptimizationRecommendations(selectionResult, capacity);
        expect(recs.some((r) => r.type === 'overload')).toBe(true);
    });

    test('getOptimizationRecommendations no team recommendation when moderate load', () => {
        const selectionResult = {
            stats: { loadByRole: { uiux: 80, ca: 0, fe: 0, be: 0, qa: 0 }, totalLoad: 80 }
        };
        const capacity = { uiux: 100, ca: 0, fe: 0, be: 0, qa: 0 };

        const recs = getOptimizationRecommendations(selectionResult, capacity);
        // 80% is between teamUnderload and optimal range, no team-level recommendation
        expect(recs.some((r) => r.type.startsWith('team-'))).toBe(false);
    });
});
