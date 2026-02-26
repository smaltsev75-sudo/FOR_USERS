import { selectTasksValueDensity } from '../../../../js/domain/selection/valueDensity.js';

describe('domain/selection/valueDensity', () => {
    const capacityByRole = { uiux: 100, ca: 100, fe: 5, be: 100, qa: 100 };

    test('selects by value density and respects role capacity', () => {
        const tasks = [
            { id: 1, title: 'A', priorityScore: 10, effort: 5, roleEffort: { fe: 5 } },
            { id: 2, title: 'B', priorityScore: 4, effort: 4, roleEffort: { fe: 4 } },
            { id: 3, title: 'C', priorityScore: 9, effort: 0, roleEffort: { fe: 0 } }
        ];

        const result = selectTasksValueDensity(tasks, capacityByRole);

        expect(result.algorithm).toBe('value-density');
        expect(result.selectedTasks.map((t) => t.id)).toEqual([1]);
        expect(result.excludedTasks).toHaveLength(2);
        expect(result.stats.quadrantsSummary).toBeDefined();
    });

    test('tiebreaker: same valueDensity sorts by id descending', () => {
        const tasks = [
            { id: 1, priorityScore: 10, effort: 5, roleEffort: { fe: 5 } },
            { id: 2, priorityScore: 10, effort: 5, roleEffort: { fe: 5 } }
        ];
        const result = selectTasksValueDensity(tasks, { fe: 100 });
        // Both selected, higher id first
        expect(result.selectedTasks.length).toBe(2);
        expect(result.selectedTasks[0].id).toBe(2);
    });

    test('handles empty tasks', () => {
        const result = selectTasksValueDensity([], capacityByRole);
        expect(result.selectedTasks).toHaveLength(0);
        expect(result.algorithm).toBe('value-density');
    });
});
