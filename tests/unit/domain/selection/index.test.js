import * as selection from '../../../../js/domain/selection/index.js';

describe('domain/selection/index', () => {
    test('exports all public selector functions', () => {
        expect(typeof selection.selectTasksMatrix).toBe('function');
        expect(typeof selection.selectTasksValueDensity).toBe('function');
        expect(typeof selection.selectTasksHybrid).toBe('function');
        expect(typeof selection.selectTasks).toBe('function');
        expect(typeof selection.compareAlgorithms).toBe('function');
        expect(typeof selection.getOptimizationRecommendations).toBe('function');
        expect(selection.SELECTION_CONFIG).toBeDefined();
    });

    test('ALGORITHM_KEYS is exported', () => {
        expect(selection.SELECTION_CONFIG.ALGORITHMS).toBeDefined();
    });

    test('selectTasksMatrix is callable and returns result', () => {
        const tasks = [{ id: 1, priorityScore: 8, effort: 5, roleEffort: { fe: 5 }, excluded: 0 }];
        const capacity = { fe: 100 };
        const result = selection.selectTasksMatrix(tasks, capacity);
        expect(result).toBeDefined();
        expect(result.algorithm).toBe('matrix');
    });

    test('selectTasksHybrid is callable and returns result', () => {
        const tasks = [{ id: 1, priorityScore: 8, effort: 5, roleEffort: { fe: 5 }, excluded: 0 }];
        const capacity = { fe: 100 };
        const result = selection.selectTasksHybrid(tasks, capacity);
        expect(result).toBeDefined();
        expect(result.algorithm).toBe('hybrid');
    });

    test('selectTasksValueDensity is callable and returns result', () => {
        const tasks = [{ id: 1, priorityScore: 8, effort: 5, roleEffort: { fe: 5 }, excluded: 0 }];
        const capacity = { fe: 100 };
        const result = selection.selectTasksValueDensity(tasks, capacity);
        expect(result).toBeDefined();
        expect(result.algorithm).toBe('value-density');
    });

    test('compareAlgorithms returns results for all algorithms', () => {
        const tasks = [{ id: 1, priorityScore: 8, effort: 5, roleEffort: { fe: 5 }, excluded: 0 }];
        const capacity = { fe: 100 };
        const result = selection.compareAlgorithms(tasks, capacity);
        expect(result.results).toBeDefined();
        expect(result.results.matrix).toBeDefined();
        expect(result.results['value-density']).toBeDefined();
        expect(result.results.hybrid).toBeDefined();
    });

    test('getOptimizationRecommendations returns array', () => {
        const selectionResult = {
            selectedTasks: [],
            excludedTasks: [],
            loadByRole: { fe: 50 },
            stats: { totalLoad: 50, totalAvailable: 100 }
        };
        const capacity = { fe: 100 };
        const recs = selection.getOptimizationRecommendations(selectionResult, capacity);
        expect(Array.isArray(recs)).toBe(true);
    });
});
