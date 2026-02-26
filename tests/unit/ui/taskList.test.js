/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

// Моки должны быть объявлены до динамического импорта
const mockCalculateAvailability = jest.fn().mockReturnValue({ useful: 100 });
const mockCalculatePriorityScore = jest.fn().mockReturnValue(7.5);
const mockCalculateTaskTotal = jest.fn().mockReturnValue(10);

jest.unstable_mockModule('../../../js/domain/role.js', () => ({
  calculateAvailability: mockCalculateAvailability
}));

jest.unstable_mockModule('../../../js/domain/criteria.js', () => ({
  calculatePriorityScore: mockCalculatePriorityScore
}));

jest.unstable_mockModule('../../../js/domain/task.js', () => ({
  calculateTaskTotal: mockCalculateTaskTotal
}));

// Динамический импорт тестируемого модуля
const { renderTaskList } = await import('../../../js/ui/taskList.js');

const nfs = {
  formatNumber: (n) => n.toString(),
  parseNumber: (s) => parseFloat(s) || 0
};

const baseState = {
  tasks: [
    { id: 1, title: 'Task Alpha', type: 'us', est: { uiux: 5 }, excluded: 0 },
    { id: 2, title: 'Task Beta', type: 'bug', est: { uiux: 3 }, excluded: 0 },
    { id: 3, title: 'Task Gamma', type: 'tech', est: { uiux: 2 }, excluded: 1 }
  ],
  roles: [{ id: 'uiux', name: 'UI/UX', fte: 1, offDays: 0 }],
  criteria: [],
  config: { alert: 20 },
  taskFilter: {}
};

function setup(state = baseState) {
  document.body.innerHTML = '<div id="taskList"></div>';
  renderTaskList(state, nfs);
}

describe('taskList', () => {
  test('renders task list', () => {
    setup();
    expect(document.querySelectorAll('.task-item').length).toBe(3);
  });

  // ── Filtering ──────────────────────────────────────────────────────────────

  describe('filterTasks – search', () => {
    test('shows only tasks matching search term', () => {
      setup({ ...baseState, taskFilter: { search: 'alpha' } });
      const items = document.querySelectorAll('.task-item');
      expect(items.length).toBe(1);
      expect(items[0].querySelector('.task-title').textContent).toBe('Task Alpha');
    });

    test('search is case-insensitive', () => {
      setup({ ...baseState, taskFilter: { search: 'BETA' } });
      expect(document.querySelectorAll('.task-item').length).toBe(1);
    });

    test('shows empty message when no tasks match search', () => {
      setup({ ...baseState, taskFilter: { search: 'nonexistent' } });
      expect(document.querySelectorAll('.task-item').length).toBe(0);
      expect(document.querySelector('#taskList').textContent).toContain(
        'Нет задач, соответствующих поиску/фильтру'
      );
    });
  });

  describe('filterTasks – type filter', () => {
    test('shows only tasks of the specified type', () => {
      setup({ ...baseState, taskFilter: { type: 'bug' } });
      const items = document.querySelectorAll('.task-item');
      expect(items.length).toBe(1);
      expect(items[0].dataset.id).toBe('2');
    });

    test('combines search and type filter', () => {
      setup({ ...baseState, taskFilter: { search: 'task', type: 'tech' } });
      const items = document.querySelectorAll('.task-item');
      expect(items.length).toBe(1);
      expect(items[0].dataset.id).toBe('3');
    });
  });

  describe('empty state messages', () => {
    test('shows default empty message when no tasks and no filter', () => {
      setup({ ...baseState, tasks: [], taskFilter: {} });
      expect(document.querySelector('#taskList').textContent).toContain(
        'В спринте нет задач. Добавьте первую задачу'
      );
    });

    test('shows filter empty message when filter active but no results', () => {
      setup({ ...baseState, tasks: [], taskFilter: { type: 'us' } });
      expect(document.querySelector('#taskList').textContent).toContain(
        'Нет задач, соответствующих поиску/фильтру'
      );
    });
  });

  // ── Task card DOM structure ────────────────────────────────────────────────

  describe('task card structure', () => {
    test('excluded task has "excluded" CSS class', () => {
      setup();
      const excludedEl = document.querySelector('.task-item[data-id="3"]');
      expect(excludedEl.classList.contains('excluded')).toBe(true);
    });

    test('included task does not have "excluded" CSS class', () => {
      setup();
      const includedEl = document.querySelector('.task-item[data-id="1"]');
      expect(includedEl.classList.contains('excluded')).toBe(false);
    });

    test('task type indicator shows correct letter for us/bug/tech', () => {
      setup();
      const usEl = document.querySelector('.task-item[data-id="1"] .task-type-indicator');
      const bugEl = document.querySelector('.task-item[data-id="2"] .task-type-indicator');
      const techEl = document.querySelector('.task-item[data-id="3"] .task-type-indicator');
      expect(usEl.textContent).toBe('U');
      expect(bugEl.textContent).toBe('B');
      expect(techEl.textContent).toBe('T');
    });

    test('task title is set via textContent (not innerHTML)', () => {
      const xssTask = { id: 99, title: '<script>alert(1)</script>', type: 'us', est: {}, excluded: 0 };
      setup({ ...baseState, tasks: [xssTask] });
      const titleEl = document.querySelector('.task-title');
      expect(titleEl.textContent).toBe('<script>alert(1)</script>');
      expect(titleEl.innerHTML).not.toContain('<script>');
    });

    test('jira link is rendered when task has jira url', () => {
      const taskWithJira = { id: 10, title: 'Jira Task', type: 'us', est: {}, excluded: 0, jira: 'https://jira.example.com/TASK-1' };
      setup({ ...baseState, tasks: [taskWithJira] });
      const link = document.querySelector('.task-jira-link');
      expect(link.href).toBe('https://jira.example.com/TASK-1');
      expect(link.textContent).toBe('🔗');
    });

    test('excluded task exclude button shows 🙈 icon', () => {
      setup();
      const btn = document.querySelector('.task-item[data-id="3"] .btn-exclude');
      expect(btn.textContent).toBe('🙈');
    });

    test('included task exclude button shows 👁 icon', () => {
      setup();
      const btn = document.querySelector('.task-item[data-id="1"] .btn-exclude');
      expect(btn.textContent).toBe('👁');
    });

    test('jira link is hidden when task has no jira url', () => {
      setup({ ...baseState, tasks: [{ id: 11, title: 'No Jira', type: 'us', est: {}, excluded: 0 }] });
      const link = document.querySelector('.task-jira-link');
      expect(link.style.display).toBe('none');
    });

    test('comment is rendered when present', () => {
      const taskWithComment = { id: 12, title: 'With Comment', type: 'us', est: {}, excluded: 0, comment: 'Some note' };
      setup({ ...baseState, tasks: [taskWithComment] });
      const commentEl = document.querySelector('.task-comment');
      expect(commentEl.textContent).toBe('Some note');
    });

    test('comment element is hidden when absent', () => {
      setup({ ...baseState, tasks: [{ id: 13, title: 'No Comment', type: 'us', est: {}, excluded: 0 }] });
      const commentEl = document.querySelector('.task-comment');
      expect(commentEl.style.display).toBe('none');
    });
  });

  // ── Drag-and-drop attributes ───────────────────────────────────────────────

  describe('drag-and-drop DOM attributes', () => {
    test('task element has draggable=false by default (enabled via mousedown on handle)', () => {
      const task1 = { id: 1, title: 'Task Alpha', type: 'us', est: { uiux: 5 }, excluded: 0 };
      const createStateWithTasks = (tasks) => ({ ...baseState, tasks });
      const state = createStateWithTasks([task1]);
      document.body.innerHTML = '<div id="taskList"></div>'; // Ensure a fresh DOM for this specific test
      renderTaskList(state, nfs);
      const item = document.querySelector('.task-item');
      expect(item.draggable).toBe(false);
    });

    test('task element has correct data-index attribute', () => {
      setup();
      const items = document.querySelectorAll('.task-item');
      items.forEach((item, i) => {
        expect(item.dataset.index).toBe(String(i));
      });
    });

    test('task element has correct data-id attribute', () => {
      setup();
      expect(document.querySelector('.task-item[data-id="1"]')).not.toBeNull();
      expect(document.querySelector('.task-item[data-id="2"]')).not.toBeNull();
      expect(document.querySelector('.task-item[data-id="3"]')).not.toBeNull();
    });

    test('drag-handle element is present in each task card', () => {
      setup();
      const handles = document.querySelectorAll('.drag-handle');
      expect(handles.length).toBe(3);
    });

    test('task element has tabIndex=0 for keyboard accessibility', () => {
      setup();
      const item = document.querySelector('.task-item[data-id="1"]');
      expect(item.tabIndex).toBe(0);
    });
  });

  // ── Action buttons ─────────────────────────────────────────────────────────

  describe('action buttons', () => {
    test('edit button has correct data-action and data-id', () => {
      setup();
      const btn = document.querySelector('.task-item[data-id="1"] .btn-edit');
      expect(btn.dataset.action).toBe('edit');
      expect(btn.dataset.id).toBe('1');
    });

    test('exclude button has correct data-action and data-id', () => {
      setup();
      const btn = document.querySelector('.task-item[data-id="1"] .btn-exclude');
      expect(btn.dataset.action).toBe('toggleExclude');
      expect(btn.dataset.id).toBe('1');
    });

    test('excluded task exclude button has "excluded" class', () => {
      setup();
      const btn = document.querySelector('.task-item[data-id="3"] .btn-exclude');
      expect(btn.classList.contains('excluded')).toBe(true);
    });

    test('delete button has correct data-action and data-id', () => {
      setup();
      const btn = document.querySelector('.task-item[data-id="2"] .btn-delete');
      expect(btn.dataset.action).toBe('delete');
      expect(btn.dataset.id).toBe('2');
    });
  });

  // ── Criteria evaluation section ────────────────────────────────────────────

  describe('criteria evaluation', () => {
    const criterion = { id: 'c1', name: 'Impact', abbreviation: 'IMP', weight: 50 };
    const stateWithCriteria = {
      ...baseState,
      criteria: [criterion],
      tasks: [
        {
          id: 1, title: 'Task Alpha', type: 'us', est: { uiux: 5 }, excluded: 0,
          criteriaEvaluations: { c1: { score: 8, value: 40 } }
        }
      ]
    };

    test('criteria row is rendered for included tasks with criteria', () => {
      setup(stateWithCriteria);
      expect(document.querySelector('.criteria-row')).not.toBeNull();
    });

    test('criteria row is NOT rendered for excluded tasks', () => {
      const excludedState = {
        ...stateWithCriteria,
        tasks: [{
          id: 2, title: 'Excl', type: 'us', est: {}, excluded: 1,
          criteriaEvaluations: { c1: { score: 5, value: 25 } }
        }]
      };
      setup(excludedState);
      expect(document.querySelector('.criteria-row')).toBeNull();
    });

    test('priority score container is rendered', () => {
      setup(stateWithCriteria);
      expect(document.querySelector('.priority-score-container')).not.toBeNull();
    });

    test('criteria score select has correct task and criterion data attributes', () => {
      setup(stateWithCriteria);
      const select = document.querySelector('.criteria-score-select');
      expect(select.dataset.id).toBe('1');
      expect(select.dataset.criterionId).toBe('c1');
    });
  });

  // ── taskController integration ─────────────────────────────────────────────

  describe('taskController integration', () => {
    test('uses cached priority score from taskController when provided', () => {
      const mockController = {
        getCachedPriorityScore: jest.fn().mockReturnValue(9.9),
        selectedTaskId: null
      };
      document.body.innerHTML = '<div id="taskList"></div>';
      renderTaskList(
        {
          ...baseState, criteria: [{ id: 'c1', name: 'X', abbreviation: 'X', weight: 100 }],
          tasks: [{ id: 1, title: 'T', type: 'us', est: {}, excluded: 0, criteriaEvaluations: {} }]
        },
        nfs,
        mockController
      );
      expect(mockController.getCachedPriorityScore).toHaveBeenCalled();
    });

    test('restores selected-task class for selectedTaskId', () => {
      const mockController = {
        getCachedPriorityScore: jest.fn().mockReturnValue(0),
        selectedTaskId: 1
      };
      document.body.innerHTML = '<div id="taskList"></div>';
      renderTaskList(baseState, nfs, mockController);
      const selectedEl = document.querySelector('.task-item[data-id="1"]');
      expect(selectedEl.classList.contains('selected-task')).toBe(true);
    });
  });

  // ── Missing container guard ────────────────────────────────────────────────

  test('does nothing when taskList element is missing', () => {
    document.body.innerHTML = '';
    expect(() => renderTaskList(baseState, nfs)).not.toThrow();
  });
});
