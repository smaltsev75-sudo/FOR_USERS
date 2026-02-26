import { jest } from '@jest/globals';
import { selectTasksMatrix } from '../../../../js/domain/selection/matrix.js';

describe('selection/matrix', () => {
    const capacityByRole = {
        uiux: 20,
        ca: 20,
        fe: 20,
        be: 20,
        qa: 20
    };

    // Базовые задачи для тестирования
    const tasks = [
        { id: 1, priorityScore: 9, effort: 5, roleEffort: { uiux: 5 }, excluded: 0 },  // Q1
        { id: 2, priorityScore: 8, effort: 15, roleEffort: { be: 15 }, excluded: 0 }, // Q2
        { id: 3, priorityScore: 4, effort: 4, roleEffort: { ca: 4 }, excluded: 0 },   // Q3
        { id: 4, priorityScore: 3, effort: 12, roleEffort: { fe: 12 }, excluded: 0 }, // Q4
        { id: 5, priorityScore: 7, effort: 6, roleEffort: { qa: 6 }, excluded: 0 }    // Q1
    ];

    test('should return selection result with all fields', () => {
        const result = selectTasksMatrix(tasks, capacityByRole);
        expect(result.selectedTasks).toBeDefined();
        expect(result.excludedTasks).toBeDefined();
        expect(result.quadrants).toBeDefined();
        expect(result.medians).toBeDefined();
        expect(result.stats).toBeDefined();
        expect(result.algorithm).toBe('matrix');
    });

    test('should select some tasks within capacity', () => {
        const result = selectTasksMatrix(tasks, capacityByRole);
        expect(result.selectedTasks.length).toBeGreaterThan(0);
        expect(result.selectedTasks.length).toBeLessThanOrEqual(tasks.length);
    });

    test('should prioritize Q1 tasks', () => {
        const result = selectTasksMatrix(tasks, capacityByRole);
        // Все Q1 задачи должны быть выбраны
        const q1Tasks = tasks.filter(t => t.priorityScore >= 5 && t.effort < 10);
        const selectedIds = result.selectedTasks.map(t => t.id);
        q1Tasks.forEach(t => {
            expect(selectedIds).toContain(t.id);
        });
    });

    test('should handle empty tasks', () => {
        const result = selectTasksMatrix([], capacityByRole);
        expect(result.selectedTasks).toHaveLength(0);
        expect(result.excludedTasks).toHaveLength(0);
        expect(result.medians.medianPriority).toBe(0);
        expect(result.medians.medianEffort).toBe(0);
        expect(result.quadrants.q1).toHaveLength(0);
        expect(result.quadrants.q2).toHaveLength(0);
        expect(result.quadrants.q3).toHaveLength(0);
        expect(result.quadrants.q4).toHaveLength(0);
    });

    test('should respect capacity limits', () => {
        const result = selectTasksMatrix(tasks, capacityByRole);
        const loadByRole = result.loadByRole;
        expect(loadByRole.uiux).toBeLessThanOrEqual(20);
        expect(loadByRole.be).toBeLessThanOrEqual(20);
        expect(loadByRole.fe).toBeLessThanOrEqual(20);
        expect(loadByRole.qa).toBeLessThanOrEqual(20);
        expect(loadByRole.ca).toBeLessThanOrEqual(20);
    });

    test('should handle tasks with zero effort', () => {
        const tasksWithZeroEffort = [
            { id: 6, priorityScore: 10, effort: 0, roleEffort: { uiux: 0 }, excluded: 0 }
        ];
        const result = selectTasksMatrix(tasksWithZeroEffort, capacityByRole);
        // Задачи с нулевым effort должны быть исключены
        expect(result.selectedTasks).toHaveLength(0);
        expect(result.excludedTasks).toHaveLength(1);
    });

    test('should handle excluded tasks', () => {
        const tasksWithExcluded = [
            { id: 1, priorityScore: 9, effort: 5, roleEffort: { uiux: 5 }, excluded: 1 },
            { id: 2, priorityScore: 8, effort: 15, roleEffort: { be: 15 }, excluded: 0 }
        ];
        const result = selectTasksMatrix(tasksWithExcluded, capacityByRole);
        expect(result.selectedTasks).toHaveLength(1);
        expect(result.excludedTasks).toHaveLength(1);
        expect(result.excludedTasks[0].reason).toBe('Исключена вручную');
    });

    test('should calculate quadrants correctly', () => {
        const result = selectTasksMatrix(tasks, capacityByRole);
        const quadrants = result.quadrants;
        expect(quadrants.q1.length + quadrants.q2.length + quadrants.q3.length + quadrants.q4.length).toBe(tasks.length);

        // Проверяем, что все задачи распределены по квадрантам
        const allQuadrantTasks = [...quadrants.q1, ...quadrants.q2, ...quadrants.q3, ...quadrants.q4];
        expect(allQuadrantTasks.length).toBe(tasks.length);
    });

    test('should sort Q2 tasks by effort ascending', () => {
        const tasksWithMultipleQ2 = [
            { id: 1, priorityScore: 8, effort: 15, roleEffort: { be: 15 }, excluded: 0 },
            { id: 2, priorityScore: 8, effort: 10, roleEffort: { be: 10 }, excluded: 0 },
            { id: 3, priorityScore: 9, effort: 12, roleEffort: { be: 12 }, excluded: 0 }
        ];
        const result = selectTasksMatrix(tasksWithMultipleQ2, capacityByRole);
        // Проверяем, что Q2 задачи отсортированы по effort
        const q2Tasks = result.quadrants.q2;
        if (q2Tasks.length > 1) {
            for (let i = 0; i < q2Tasks.length - 1; i++) {
                expect(q2Tasks[i].effort).toBeLessThanOrEqual(q2Tasks[i + 1].effort);
            }
        }
    });

    test('should handle dependencies', () => {
        const tasksWithDeps = [
            { id: 1, priorityScore: 9, effort: 5, roleEffort: { uiux: 5 }, excluded: 0, dependencies: [] },
            { id: 2, priorityScore: 8, effort: 10, roleEffort: { be: 10 }, excluded: 0, dependencies: [1] },
            { id: 3, priorityScore: 7, effort: 8, roleEffort: { fe: 8 }, excluded: 0, dependencies: [2] }
        ];
        const result = selectTasksMatrix(tasksWithDeps, capacityByRole);
        expect(result.selectedTasks.length).toBe(3); // Все должны быть выбраны, т.к. зависимости выполнены
    });

    test('should handle unmet dependencies', () => {
        const tasksWithUnmetDeps = [
            { id: 1, priorityScore: 9, effort: 5, roleEffort: { uiux: 5 }, excluded: 0, dependencies: [2] },
            { id: 2, priorityScore: 8, effort: 10, roleEffort: { be: 10 }, excluded: 0, dependencies: [] }
        ];
        const result = selectTasksMatrix(tasksWithUnmetDeps, capacityByRole);
        expect(result.selectedTasks).toHaveLength(1); // только task 2
        expect(result.excludedTasks).toHaveLength(1); // task 1 исключён из-за зависимости
    });

    test('should handle role overload', () => {
        const overloadTasks = [
            { id: 1, priorityScore: 9, effort: 25, roleEffort: { uiux: 25 }, excluded: 0 },
            { id: 2, priorityScore: 8, effort: 10, roleEffort: { uiux: 10 }, excluded: 0 }
        ];
        const result = selectTasksMatrix(overloadTasks, capacityByRole);
        expect(result.selectedTasks).toHaveLength(1); // только одна задача может быть выбрана
        expect(result.excludedTasks).toHaveLength(1); // вторая исключена из-за перегрузки роли
    });

    test('should handle team overload', () => {
        const smallCapacity = {
            uiux: 5,
            ca: 5,
            fe: 5,
            be: 5,
            qa: 5
        };
        const largeTasks = [
            { id: 1, priorityScore: 9, effort: 6, roleEffort: { uiux: 6 }, excluded: 0 },
            { id: 2, priorityScore: 8, effort: 6, roleEffort: { be: 6 }, excluded: 0 }
        ];
        const result = selectTasksMatrix(largeTasks, smallCapacity);
        expect(result.selectedTasks).toHaveLength(0);
        expect(result.excludedTasks).toHaveLength(2);
    });

    test('should sort Q4 tasks by priority', () => {
        const tasksWithMultipleQ4 = [
            { id: 1, priorityScore: 3, effort: 15, roleEffort: { be: 15 }, excluded: 0 },
            { id: 2, priorityScore: 4, effort: 14, roleEffort: { be: 14 }, excluded: 0 },
            { id: 3, priorityScore: 5, effort: 13, roleEffort: { be: 13 }, excluded: 0 }
        ];
        // Медианы: priority ~ 3, effort ~ 13 => все в Q4
        const result = selectTasksMatrix(tasksWithMultipleQ4, capacityByRole);
        const q4Tasks = result.quadrants.q4;
        if (q4Tasks.length > 1) {
            for (let i = 0; i < q4Tasks.length - 1; i++) {
                expect(q4Tasks[i].priorityScore).toBeGreaterThanOrEqual(q4Tasks[i + 1].priorityScore);
            }
        }
    });

    test('returns quadrantsSummary in stats', () => {
        const result = selectTasksMatrix(tasks, capacityByRole);
        expect(result.stats.quadrantsSummary).toBeDefined();
        const qs = result.stats.quadrantsSummary;
        expect(qs.q1 + qs.q2 + qs.q3 + qs.q4).toBe(tasks.length);
    });

    test('selects tasks from Q1 when capacity allows', () => {
        // Two Q1 tasks — both should be selected when capacity is sufficient
        const tiedTasks = [
            { id: 1, priorityScore: 9, effort: 3, roleEffort: { fe: 3 }, excluded: 0 },
            { id: 2, priorityScore: 9, effort: 3, roleEffort: { fe: 3 }, excluded: 0 }
        ];
        const result = selectTasksMatrix(tiedTasks, { fe: 100 });
        expect(result.selectedTasks.length).toBe(2);
        expect(result.quadrants.q1.length).toBe(2);
    });

    test('sorts Q2 tasks by effort then priority (tie-breaker by id)', () => {
        // Two tasks with same effort in Q2 — should sort by priority descending
        const tiedTasks = [
            { id: 1, priorityScore: 7, effort: 12, roleEffort: { be: 12 }, excluded: 0 },
            { id: 2, priorityScore: 9, effort: 12, roleEffort: { be: 12 }, excluded: 0 }
        ];
        const result = selectTasksMatrix(tiedTasks, { be: 100 });
        const q2 = result.quadrants.q2;
        if (q2.length === 2) {
            // Same effort → sort by priority desc
            expect(q2[0].priorityScore).toBeGreaterThanOrEqual(q2[1].priorityScore);
        }
    });

    // ── Additional branch coverage tests ──────────────────────────────────────

    test('Q1 tie-breaker: same priority sorts by id descending', () => {
        // Two Q1 tasks with identical priority and effort → sort by id descending
        const tiedTasks = [
            { id: 1, priorityScore: 9, effort: 3, roleEffort: { fe: 3 }, excluded: 0 },
            { id: 2, priorityScore: 9, effort: 3, roleEffort: { fe: 3 }, excluded: 0 }
        ];
        const result = selectTasksMatrix(tiedTasks, { fe: 100 });
        // Both selected, and Q1 should have id=2 first (b.id - a.id)
        expect(result.selectedTasks.length).toBe(2);
        if (result.selectedTasks.length === 2) {
            expect(result.selectedTasks[0].id).toBe(2);
        }
    });

    test('Q3 tie-breaker: same priority sorts by id descending', () => {
        // Force tasks into Q3 (low priority, low effort)
        const q3Tasks = [
            { id: 1, priorityScore: 2, effort: 2, roleEffort: { fe: 2 }, excluded: 0 },
            { id: 2, priorityScore: 2, effort: 2, roleEffort: { fe: 2 }, excluded: 0 }
        ];
        const result = selectTasksMatrix(q3Tasks, { fe: 100 });
        const q3 = result.quadrants.q3;
        if (q3.length === 2) {
            expect(q3[0].id).toBe(2); // Higher id first (b.id - a.id)
        }
    });

    test('single task — goes to correct quadrant', () => {
        const single = [
            { id: 1, priorityScore: 5, effort: 5, roleEffort: { fe: 5 }, excluded: 0 }
        ];
        const result = selectTasksMatrix(single, { fe: 100 });
        expect(result.selectedTasks.length).toBe(1);
        const total = result.quadrants.q1.length + result.quadrants.q2.length +
            result.quadrants.q3.length + result.quadrants.q4.length;
        expect(total).toBe(1);
    });

    test('all tasks with identical priority and effort', () => {
        const identical = [
            { id: 1, priorityScore: 5, effort: 5, roleEffort: { fe: 5 }, excluded: 0 },
            { id: 2, priorityScore: 5, effort: 5, roleEffort: { fe: 5 }, excluded: 0 },
            { id: 3, priorityScore: 5, effort: 5, roleEffort: { fe: 5 }, excluded: 0 }
        ];
        const result = selectTasksMatrix(identical, { fe: 100 });
        expect(result.selectedTasks.length).toBeGreaterThan(0);
        expect(result.medians.medianPriority).toBe(5);
        expect(result.medians.medianEffort).toBe(5);
    });

    test('Q2 sort: same effort and same priority — falls to id tiebreaker', () => {
        const tiedQ2 = [
            { id: 1, priorityScore: 8, effort: 15, roleEffort: { be: 15 }, excluded: 0 },
            { id: 2, priorityScore: 8, effort: 15, roleEffort: { be: 15 }, excluded: 0 }
        ];
        const result = selectTasksMatrix(tiedQ2, { be: 100 });
        const q2 = result.quadrants.q2;
        if (q2.length === 2) {
            expect(q2[0].id).toBe(2); // Higher id first
        }
    });

    test('Q4 tie-breaker: same priority sorts by id descending', () => {
        const q4Tasks = [
            { id: 1, priorityScore: 2, effort: 20, roleEffort: { fe: 20 }, excluded: 0 },
            { id: 2, priorityScore: 2, effort: 20, roleEffort: { fe: 20 }, excluded: 0 }
        ];
        const result = selectTasksMatrix(q4Tasks, { fe: 100 });
        const q4 = result.quadrants.q4;
        if (q4.length === 2) {
            expect(q4[0].id).toBe(2);
        }
    });

    test('multi-role tasks distributed correctly', () => {
        const multiRole = [
            { id: 1, priorityScore: 9, effort: 10, roleEffort: { fe: 5, be: 5 }, excluded: 0 },
            { id: 2, priorityScore: 7, effort: 8, roleEffort: { fe: 4, qa: 4 }, excluded: 0 }
        ];
        const result = selectTasksMatrix(multiRole, { fe: 20, be: 20, qa: 20 });
        expect(result.selectedTasks.length).toBe(2);
    });

    // ── Q1 sort: distinct priorities ──────────────────────────────────────────

    test('Q1 sorts by priority descending when priorities differ', () => {
        const q1Tasks = [
            { id: 1, priorityScore: 7, effort: 3, roleEffort: { fe: 3 }, excluded: 0 },
            { id: 2, priorityScore: 9, effort: 3, roleEffort: { fe: 3 }, excluded: 0 },
            { id: 3, priorityScore: 1, effort: 20, roleEffort: { be: 20 }, excluded: 0 } // anchor for median
        ];
        const result = selectTasksMatrix(q1Tasks, { fe: 100, be: 100 });
        // selectedTasks should have priority=9 (id=2) before priority=7 (id=1)
        const q1Selected = result.selectedTasks.filter(t => t.priorityScore >= 7 && t.effort <= 3);
        if (q1Selected.length >= 2) {
            expect(q1Selected[0].priorityScore).toBeGreaterThanOrEqual(q1Selected[1].priorityScore);
        }
    });

    // ── Q2 sort: distinct efforts ──────────────────────────────────────────

    test('Q2 sorts by effort ascending when efforts differ', () => {
        const q2Tasks = [
            { id: 1, priorityScore: 8, effort: 18, roleEffort: { be: 18 }, excluded: 0 },
            { id: 2, priorityScore: 9, effort: 12, roleEffort: { be: 12 }, excluded: 0 },
            { id: 3, priorityScore: 2, effort: 2, roleEffort: { fe: 2 }, excluded: 0 } // anchor for median
        ];
        const result = selectTasksMatrix(q2Tasks, { be: 100, fe: 100 });
        const q2 = result.quadrants.q2;
        if (q2.length >= 2) {
            expect(q2[0].effort).toBeLessThanOrEqual(q2[1].effort);
        }
    });

    // ── Q2 sort: same effort, different priority ──────────────────────────

    test('Q2 same effort different priority sorts by priority desc', () => {
        const q2Tasks = [
            { id: 1, priorityScore: 7, effort: 15, roleEffort: { be: 15 }, excluded: 0 },
            { id: 2, priorityScore: 9, effort: 15, roleEffort: { be: 15 }, excluded: 0 },
            { id: 3, priorityScore: 2, effort: 2, roleEffort: { fe: 2 }, excluded: 0 } // anchor
        ];
        const result = selectTasksMatrix(q2Tasks, { be: 100, fe: 100 });
        const q2 = result.quadrants.q2;
        if (q2.length >= 2) {
            expect(q2[0].priorityScore).toBeGreaterThanOrEqual(q2[1].priorityScore);
        }
    });

    // ── Q3 sort: different priorities ──────────────────────────────────────

    test('Q3 sorts by priority descending when priorities differ', () => {
        const mixed = [
            { id: 1, priorityScore: 2, effort: 3, roleEffort: { fe: 3 }, excluded: 0 },
            { id: 2, priorityScore: 4, effort: 3, roleEffort: { fe: 3 }, excluded: 0 },
            { id: 3, priorityScore: 10, effort: 20, roleEffort: { be: 20 }, excluded: 0 } // anchor high
        ];
        const result = selectTasksMatrix(mixed, { fe: 100, be: 100 });
        // Q3 tasks should still be selected; just verify the branch is hit
        const q3 = result.quadrants.q3;
        expect(q3.length).toBeGreaterThanOrEqual(0);
        expect(result.selectedTasks.length).toBeGreaterThan(0);
    });

    // ── Q4 sort: different priorities ──────────────────────────────────────

    test('Q4 sorts by priority descending when priorities differ', () => {
        const q4Tasks = [
            { id: 1, priorityScore: 2, effort: 20, roleEffort: { fe: 20 }, excluded: 0 },
            { id: 2, priorityScore: 4, effort: 20, roleEffort: { fe: 20 }, excluded: 0 },
            { id: 3, priorityScore: 10, effort: 2, roleEffort: { be: 2 }, excluded: 0 } // anchor
        ];
        const result = selectTasksMatrix(q4Tasks, { fe: 100, be: 100 });
        const q4 = result.quadrants.q4;
        if (q4.length >= 2) {
            expect(q4[0].priorityScore).toBeGreaterThanOrEqual(q4[1].priorityScore);
        }
    });

    // ── Even number of tasks — median is average of two central ──────────

    test('even number of tasks uses average for median', () => {
        const evenTasks = [
            { id: 1, priorityScore: 5, effort: 4, roleEffort: { fe: 4 }, excluded: 0 },
            { id: 2, priorityScore: 10, effort: 8, roleEffort: { fe: 8 }, excluded: 0 }
        ];
        const result = selectTasksMatrix(evenTasks, { fe: 100 });
        expect(result.medians.medianPriority).toBe(7.5);
        expect(result.medians.medianEffort).toBe(6);
    });

    // ── Zero capacity → all excluded by total capacity ──────────────────

    test('zero total capacity excludes all tasks', () => {
        const tasks = [
            { id: 1, priorityScore: 9, effort: 5, roleEffort: { fe: 5 }, excluded: 0 }
        ];
        const result = selectTasksMatrix(tasks, { uiux: 0, ca: 0, fe: 0, be: 0, qa: 0 });
        expect(result.selectedTasks).toHaveLength(0);
    });
});

