import { jest } from '@jest/globals';
import {
  calculateTaskTotal,
  createTask,
  validateTaskOrder,
  fixTaskOrder,
  prepareTaskForSelection,
  getTaskStats,
  sortTasksByPriorityScore,
  _resetTaskIdCounter
} from '../../../js/domain/task.js';

describe('task', () => {
  const roles = [
    { id: 'uiux' }, { id: 'ca' }, { id: 'fe' }, { id: 'be' }, { id: 'qa' }
  ];

  test('calculateTaskTotal sums estimates', () => {
    const task = { est: { uiux: 5, ca: 2, fe: 3, be: 4, qa: 1 } };
    expect(calculateTaskTotal(task, roles)).toBe(15);
  });

  test('createTask creates task object', () => {
    const task = createTask({
      title: 'Test Task',
      jira: 'https://jira.com/TEST-1',
      type: 'us',
      comment: 'test comment',
      estimates: { uiux: 5 }
    });

    expect(task).toMatchObject({
      title: 'Test Task',
      jira: 'https://jira.com/TEST-1',
      type: 'us',
      comment: 'test comment',
      excluded: 0,
      est: { uiux: 5 }
    });
    expect(task.id).toBeDefined();
  });

  describe('_resetTaskIdCounter', () => {
    test('resets counter so next createTask gets predictable id', () => {
      _resetTaskIdCounter(1000);
      const task = createTask({
        title: 'Reset Test',
        jira: 'https://jira.com/R-1',
        type: 'us',
        comment: '',
        estimates: {}
      });
      expect(task.id).toBe(1001);
    });

    test('successive createTask calls produce monotonically increasing ids', () => {
      _resetTaskIdCounter(0);
      const t1 = createTask({ title: 'T1', jira: 'https://j.com/1', type: 'us', comment: '', estimates: {} });
      const t2 = createTask({ title: 'T2', jira: 'https://j.com/2', type: 'us', comment: '', estimates: {} });
      const t3 = createTask({ title: 'T3', jira: 'https://j.com/3', type: 'us', comment: '', estimates: {} });
      expect(t1.id).toBe(1);
      expect(t2.id).toBe(2);
      expect(t3.id).toBe(3);
    });
  });

  test('validateTaskOrder works correctly', () => {
    const goodOrder = [
      { excluded: 0 }, { excluded: 0 }, { excluded: 1 }, { excluded: 1 }
    ];
    const badOrder = [
      { excluded: 0 }, { excluded: 1 }, { excluded: 0 }, { excluded: 1 }
    ];

    expect(validateTaskOrder(goodOrder)).toBe(true);
    expect(validateTaskOrder(badOrder)).toBe(false);
  });

  test('fixTaskOrder moves excluded tasks to end', () => {
    const tasks = [
      { id: 1, excluded: 0 },
      { id: 2, excluded: 1 },
      { id: 3, excluded: 0 }
    ];
    const fixed = fixTaskOrder(tasks);
    expect(fixed.map(t => t.id)).toEqual([1, 3, 2]);
  });

  test('prepareTaskForSelection adds fields', () => {
    const task = {
      id: 123,
      title: 'Test',
      est: { uiux: 5, ca: 2 },
      excluded: 0
    };
    const priorityScoreFn = () => 7.5;
    const prepared = prepareTaskForSelection(task, roles, priorityScoreFn);

    expect(prepared).toMatchObject({
      id: task.id,
      title: task.title,
      priorityScore: 7.5,
      effort: 7,
      roleEffort: { uiux: 5, ca: 2, fe: 0, be: 0, qa: 0 }
    });
  });

  test('getTaskStats returns correct stats', () => {
    const tasks = [
      { type: 'us', excluded: 0 },
      { type: 'us', excluded: 0 },
      { type: 'bug', excluded: 0 },
      { type: 'tech', excluded: 1 },
      { type: 'bug', excluded: 1 }
    ];
    const stats = getTaskStats(tasks);

    expect(stats.included).toEqual({ total: 3, us: 2, bug: 1, tech: 0 });
    expect(stats.excluded).toEqual({ total: 2, us: 0, bug: 1, tech: 1 });
  });

  test('sortTasksByPriorityScore sorts correctly', () => {
    const tasks = [
      { id: 1, priorityScore: 5 },
      { id: 2, priorityScore: 8 },
      { id: 3, priorityScore: 3 }
    ];
    const priorityScoreFn = (t) => t.priorityScore;
    const sorted = sortTasksByPriorityScore(tasks, priorityScoreFn);
    expect(sorted.map(t => t.id)).toEqual([2, 1, 3]);
  });

  describe('edge cases', () => {
    test('calculateTaskTotal handles missing estimates', () => {
      const task = { est: { uiux: 5 } };
      expect(calculateTaskTotal(task, roles)).toBe(5);
    });

    test('prepareTaskForSelection handles excluded tasks', () => {
      const task = { id: 1, title: 'Test', est: {}, excluded: 1 };
      const priorityScoreFn = () => 5;
      const prepared = prepareTaskForSelection(task, roles, priorityScoreFn);
      expect(prepared.excluded).toBe(1);
    });

    test('fixTaskOrder handles empty array', () => {
      expect(fixTaskOrder([])).toEqual([]);
    });

    test('getTaskStats handles empty array', () => {
      const stats = getTaskStats([]);
      expect(stats.included).toEqual({ total: 0, us: 0, bug: 0, tech: 0 });
      expect(stats.excluded).toEqual({ total: 0, us: 0, bug: 0, tech: 0 });
    });
  });
});










