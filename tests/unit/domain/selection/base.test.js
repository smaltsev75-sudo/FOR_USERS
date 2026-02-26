import { jest } from '@jest/globals';
import {
    prepareTasks,
    calculateMedians,
    categorizeIntoQuadrants,
    selectTasksUniform,
    compareByValueDensity,
    compareByPriority,
    buildSelectionResult
} from '../../../../js/domain/selection/base.js';

describe('selection/base', () => {
    const mockTasks = [
        { id: 1, priorityScore: 9, effort: 5, roleEffort: { uiux: 5 }, excluded: false },
        { id: 2, priorityScore: 8, effort: 10, roleEffort: { be: 10 }, excluded: false },
        { id: 3, priorityScore: 7, effort: 15, roleEffort: { fe: 15 }, excluded: false },
        { id: 4, priorityScore: 6, effort: 3, roleEffort: { qa: 3 }, excluded: false },
        { id: 5, priorityScore: 5, effort: 8, roleEffort: { ca: 8 }, excluded: false }
    ];

    describe('prepareTasks', () => {
        test('should add valueDensity field', () => {
            const tasks = [{ id: 1, priorityScore: 10, effort: 5, roleEffort: {}, excluded: false }];
            const result = prepareTasks(tasks);
            expect(result[0].valueDensity).toBe(2); // 10/5 = 2
        });

        test('should handle zero effort', () => {
            const tasks = [{ id: 1, priorityScore: 10, effort: 0, roleEffort: {}, excluded: false }];
            const result = prepareTasks(tasks);
            expect(result[0].valueDensity).toBe(10);
        });

        test('should preserve all fields', () => {
            const task = { id: 1, priorityScore: 8, effort: 4, roleEffort: { uiux: 4 }, excluded: false, type: 'us' };
            const result = prepareTasks([task]);
            expect(result[0]).toMatchObject({
                id: 1,
                priorityScore: 8,
                effort: 4,
                roleEffort: { uiux: 4 },
                excluded: false,
                type: 'us'
            });
        });
    });

    describe('calculateMedians', () => {
        test('should calculate medians correctly for odd number of tasks', () => {
            const tasks = [
                { priorityScore: 1, effort: 10 },
                { priorityScore: 2, effort: 20 },
                { priorityScore: 3, effort: 30 },
                { priorityScore: 4, effort: 40 },
                { priorityScore: 5, effort: 50 }
            ];
            const result = calculateMedians(tasks);
            expect(result.medianPriority).toBe(3);
            expect(result.medianEffort).toBe(30);
        });

        test('should calculate medians correctly for even number of tasks', () => {
            const tasks = [
                { priorityScore: 1, effort: 10 },
                { priorityScore: 2, effort: 20 },
                { priorityScore: 3, effort: 30 },
                { priorityScore: 4, effort: 40 }
            ];
            const result = calculateMedians(tasks);
            expect(result.medianPriority).toBe(2.5);
            expect(result.medianEffort).toBe(25);
        });

        test('should return 0 for empty tasks', () => {
            const result = calculateMedians([]);
            expect(result.medianPriority).toBe(0);
            expect(result.medianEffort).toBe(0);
        });
    });

    describe('categorizeIntoQuadrants', () => {
        const tasks = [
            { priorityScore: 10, effort: 5 },  // Q1
            { priorityScore: 10, effort: 15 }, // Q2
            { priorityScore: 3, effort: 5 },   // Q3
            { priorityScore: 3, effort: 15 }   // Q4
        ];
        const medianPriority = 5;
        const medianEffort = 10;

        test('should correctly categorize tasks', () => {
            const result = categorizeIntoQuadrants(tasks, medianPriority, medianEffort);
            expect(result.q1).toHaveLength(1);
            expect(result.q2).toHaveLength(1);
            expect(result.q3).toHaveLength(1);
            expect(result.q4).toHaveLength(1);
        });

        test('should handle tasks equal to medians', () => {
            const tasksEqual = [
                { priorityScore: 5, effort: 10 }
            ];
            const result = categorizeIntoQuadrants(tasksEqual, 5, 10);
            expect(result.q1).toHaveLength(1); // >= priority и < effort? depends on logic
            // Уточним логику: highPriority = priorityScore >= medianPriority
            // highEffort = effort > medianEffort
            // Для priorityScore=5, effort=10: highPriority=true, highEffort=false => Q1
            expect(result.q1).toHaveLength(1);
        });
    });

    describe('selectTasksUniform', () => {
        const capacityByRole = {
            uiux: 10,
            ca: 10,
            fe: 10,
            be: 10,
            qa: 10
        };

        const tasks = [
            { id: 1, effort: 5, roleEffort: { uiux: 5 }, excluded: false },
            { id: 2, effort: 8, roleEffort: { be: 8 }, excluded: false },
            { id: 3, effort: 12, roleEffort: { fe: 12 }, excluded: false }, // превышает ёмкость
            { id: 4, effort: 3, roleEffort: { qa: 3 }, excluded: false },
            { id: 5, effort: 6, roleEffort: { ca: 6 }, excluded: false }
        ];

        test('should select tasks within capacity', () => {
            const result = selectTasksUniform(tasks, capacityByRole);
            expect(result.selectedTasks.length).toBeGreaterThan(0);
            expect(result.excludedTasks.length).toBeGreaterThan(0);
        });

        test('should respect role capacities', () => {
            const result = selectTasksUniform(tasks, capacityByRole);

            // Проверяем, что ни одна роль не перегружена
            const loadByRole = result.loadByRole;
            expect(loadByRole.uiux).toBeLessThanOrEqual(10);
            expect(loadByRole.be).toBeLessThanOrEqual(10);
            expect(loadByRole.fe).toBeLessThanOrEqual(10);
            expect(loadByRole.qa).toBeLessThanOrEqual(10);
            expect(loadByRole.ca).toBeLessThanOrEqual(10);
        });

        test('should handle excluded tasks', () => {
            const tasksWithExcluded = [
                { id: 1, effort: 5, roleEffort: { uiux: 5 }, excluded: true },
                { id: 2, effort: 8, roleEffort: { be: 8 }, excluded: false }
            ];
            const result = selectTasksUniform(tasksWithExcluded, capacityByRole);
            expect(result.selectedTasks).toHaveLength(1);
            expect(result.excludedTasks).toHaveLength(1);
        });

        test('should handle tasks with dependencies', () => {
            const tasksWithDeps = [
                { id: 1, effort: 5, roleEffort: { uiux: 5 }, excluded: false, dependencies: [] },
                { id: 2, effort: 8, roleEffort: { be: 8 }, excluded: false, dependencies: [1] }
            ];
            const result = selectTasksUniform(tasksWithDeps, capacityByRole);
            expect(result.selectedTasks).toHaveLength(2);
        });

        test('should handle unmet dependencies', () => {
            const tasksWithDeps = [
                { id: 1, effort: 5, roleEffort: { uiux: 5 }, excluded: false, dependencies: [2] },
                { id: 2, effort: 8, roleEffort: { be: 8 }, excluded: false, dependencies: [] }
            ];
            const result = selectTasksUniform(tasksWithDeps, capacityByRole);
            expect(result.selectedTasks).toHaveLength(1); // только task 2
            expect(result.excludedTasks).toHaveLength(1); // task 1 excluded из-за зависимости
        });
    });

    // ── compareByValueDensity ──────────────────────────────────────────────────

    describe('compareByValueDensity', () => {
        test('sorts by valueDensity descending', () => {
            const a = { id: 1, valueDensity: 5 };
            const b = { id: 2, valueDensity: 10 };
            expect(compareByValueDensity(a, b)).toBeGreaterThan(0); // b first
        });

        test('uses id as tiebreaker when valueDensity is equal', () => {
            const a = { id: 1, valueDensity: 5 };
            const b = { id: 2, valueDensity: 5 };
            expect(compareByValueDensity(a, b)).toBeGreaterThan(0); // higher id first
        });

        test('sorts array correctly', () => {
            const items = [
                { id: 1, valueDensity: 3 },
                { id: 3, valueDensity: 5 },
                { id: 2, valueDensity: 5 }
            ];
            items.sort(compareByValueDensity);
            expect(items.map(t => t.id)).toEqual([3, 2, 1]);
        });
    });

    // ── compareByPriority ──────────────────────────────────────────────────────

    describe('compareByPriority', () => {
        test('sorts by priorityScore descending', () => {
            const a = { id: 1, priorityScore: 3 };
            const b = { id: 2, priorityScore: 9 };
            expect(compareByPriority(a, b)).toBeGreaterThan(0); // b first
        });

        test('uses id as tiebreaker when priorityScore is equal', () => {
            const a = { id: 1, priorityScore: 5 };
            const b = { id: 2, priorityScore: 5 };
            expect(compareByPriority(a, b)).toBeGreaterThan(0); // higher id first
        });

        test('sorts array correctly', () => {
            const items = [
                { id: 1, priorityScore: 8 },
                { id: 3, priorityScore: 10 },
                { id: 2, priorityScore: 8 }
            ];
            items.sort(compareByPriority);
            expect(items.map(t => t.id)).toEqual([3, 2, 1]);
        });
    });

    // ── buildSelectionResult ───────────────────────────────────────────────────

    describe('buildSelectionResult', () => {
        test('merges selectionResult with quadrants and medians', () => {
            const selectionResult = {
                selectedTasks: [{ id: 1 }],
                excludedTasks: [],
                stats: { totalSelected: 1, totalExcluded: 0 }
            };
            const quadrants = { q1: [{ id: 1 }], q2: [], q3: [], q4: [] };
            const medians = { medianPriority: 5, medianEffort: 10 };

            const result = buildSelectionResult(selectionResult, quadrants, medians, 'matrix');

            expect(result.selectedTasks).toHaveLength(1);
            expect(result.algorithm).toBe('matrix');
            expect(result.medians).toEqual(medians);
            expect(result.quadrants).toBe(quadrants);
            expect(result.stats.quadrantsSummary).toEqual({ q1: 1, q2: 0, q3: 0, q4: 0 });
        });

        test('preserves original stats fields', () => {
            const selectionResult = {
                selectedTasks: [],
                stats: { totalSelected: 0, loadPercentage: 42 }
            };
            const quadrants = { q1: [], q2: [], q3: [], q4: [] };
            const medians = { medianPriority: 0, medianEffort: 0 };

            const result = buildSelectionResult(selectionResult, quadrants, medians, 'hybrid');

            expect(result.stats.loadPercentage).toBe(42);
            expect(result.stats.quadrantsSummary).toEqual({ q1: 0, q2: 0, q3: 0, q4: 0 });
        });

        test('sets correct algorithm name', () => {
            const selectionResult = { selectedTasks: [], stats: {} };
            const quadrants = { q1: [], q2: [], q3: [], q4: [] };
            const medians = { medianPriority: 0, medianEffort: 0 };

            expect(buildSelectionResult(selectionResult, quadrants, medians, 'value-density').algorithm).toBe('value-density');
        });
    });
});

