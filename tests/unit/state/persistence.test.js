import { APP_CONFIG } from '../../../js/utils/appConfig.js';
import { migratePersistedState, serializeStateForStorage } from '../../../js/state/persistence.js';

describe('state/persistence', () => {
  test('migratePersistedState normalizes and clamps persisted fields', () => {
    const migrated = migratePersistedState({
      config: { days: 0, availCoef: 200, alert: -5, product: 42 },
      roles: [{ id: 'uiux', fte: 120, off: -3 }],
      tasks: [{ id: 'x', type: 'invalid', excluded: 1, est: { fe: '8.5' } }],
      criteria: [{ id: '2', weight: 150, scale: null }],
      numberFormatSettings: { decimalSeparator: '.' },
      activeTab: 'invalid',
      taskFilter: { search: 99, type: 'unknown' },
      taskSort: { by: 'effort', order: 'asc' }
    });

    expect(migrated.version).toBe(APP_CONFIG.STORAGE_VERSION);
    expect(migrated.config.days).toBe(1);
    expect(migrated.config.availCoef).toBe(100);
    expect(migrated.config.alert).toBe(0);
    expect(migrated.config.product).toBe('42');
    expect(migrated.roles.find((r) => r.id === 'uiux')).toEqual(
      expect.objectContaining({ fte: 100, off: 0 })
    );
    expect(migrated.tasks[0]).toEqual(
      expect.objectContaining({
        type: 'us',
        excluded: 1
      })
    );
    expect(migrated.criteria[0]).toEqual(
      expect.objectContaining({
        id: 2,
        weight: 100,
        scale: {}
      })
    );
    expect(migrated.numberFormatSettings.decimalSeparator).toBe('.');
    expect(migrated.activeTab).toBe('planning');
    expect(migrated.taskFilter).toEqual({ search: '99', type: '' });
    expect(migrated.taskSort).toEqual({ by: 'effort', order: 'asc' });
  });

  test('serializeStateForStorage keeps only normalized state shape', () => {
    const serialized = serializeStateForStorage(
      {
        config: { days: '14', availCoef: 85.5, alert: '3', product: 'Planner' },
        roles: [{ id: 'qa', fte: '80', off: '2' }],
        tasks: [{ id: 1, title: ' A ', type: 'bug', excluded: false, est: { qa: '5' } }],
        activeTab: 'criteria',
        taskFilter: { search: 'jira', type: 'bug' },
        taskSort: { by: 'priorityScore', order: 'desc' }
      },
      [{ id: 1, name: 'C1', abbreviation: 'C1', weight: 50, rationale: '', scale: { 1: 'low' } }],
      '.'
    );

    expect(serialized.version).toBe(APP_CONFIG.STORAGE_VERSION);
    expect(serialized.config).toEqual(
      expect.objectContaining({ days: 14, availCoef: 85.5, alert: 3, product: 'Planner' })
    );
    expect(serialized.roles.find((r) => r.id === 'qa')).toEqual(
      expect.objectContaining({ fte: 80, off: 2 })
    );
    expect(serialized.tasks[0]).toEqual(
      expect.objectContaining({
        title: 'A',
        type: 'bug',
        excluded: 0,
        est: expect.objectContaining({ qa: 5 })
      })
    );
    expect(serialized.activeTab).toBe('criteria');
    expect(serialized.numberFormatSettings).toEqual({ decimalSeparator: '.' });
  });

  // ── Additional branch coverage tests ────────────────────────────────────────

  test('migratePersistedState with no arguments uses all defaults', () => {
    const migrated = migratePersistedState();
    expect(migrated.version).toBe(APP_CONFIG.STORAGE_VERSION);
    expect(migrated.config).toBeDefined();
    expect(migrated.roles.length).toBeGreaterThan(0);
    expect(migrated.tasks).toEqual([]);
    expect(migrated.criteria).toEqual([]);
    expect(migrated.activeTab).toBe('planning');
    expect(migrated.lastAddedTaskId).toBeNull();
  });

  test('migratePersistedState handles criteria activeTab', () => {
    const migrated = migratePersistedState({ activeTab: 'criteria' });
    expect(migrated.activeTab).toBe('criteria');
  });

  test('migratePersistedState normalizes comma decimal separator by default', () => {
    const migrated = migratePersistedState({ numberFormatSettings: {} });
    expect(migrated.numberFormatSettings.decimalSeparator).toBe(',');
  });

  test('migratePersistedState handles non-array tasks', () => {
    const migrated = migratePersistedState({ tasks: 'not-array' });
    expect(migrated.tasks).toEqual([]);
  });

  test('migratePersistedState handles non-array criteria', () => {
    const migrated = migratePersistedState({ criteria: 'not-array' });
    expect(migrated.criteria).toEqual([]);
  });

  test('migratePersistedState handles task with null criteriaEvaluations', () => {
    const migrated = migratePersistedState({
      tasks: [{ id: 1, title: 'T', type: 'us', effort: 5, est: { fe: 5 }, criteriaEvaluations: null }]
    });
    expect(migrated.tasks[0].criteriaEvaluations).toEqual({});
  });

  test('migratePersistedState handles type=bug and type=tech', () => {
    const migrated = migratePersistedState({
      tasks: [
        { id: 1, title: 'A', type: 'bug', est: {} },
        { id: 2, title: 'B', type: 'tech', est: {} },
        { id: 3, title: 'C', type: 'us', est: {} }
      ]
    });
    expect(migrated.tasks[0].type).toBe('bug');
    expect(migrated.tasks[1].type).toBe('tech');
    expect(migrated.tasks[2].type).toBe('us');
  });

  test('migratePersistedState normalizes null roles to defaults', () => {
    const migrated = migratePersistedState({ roles: null });
    expect(migrated.roles.length).toBeGreaterThan(0);
  });

  test('migratePersistedState normalizes config with null product', () => {
    const migrated = migratePersistedState({ config: { product: null } });
    expect(typeof migrated.config.product).toBe('string');
  });

  test('migratePersistedState normalizes config with null dates', () => {
    const migrated = migratePersistedState({ config: { startDate: null, endDate: null } });
    expect(typeof migrated.config.startDate).toBe('string');
    expect(typeof migrated.config.endDate).toBe('string');
  });

  test('migratePersistedState normalizes taskSort defaults', () => {
    const migrated = migratePersistedState({ taskSort: {} });
    expect(migrated.taskSort.by).toBe('priority');
    expect(migrated.taskSort.order).toBe('desc');
  });

  test('migratePersistedState normalizes taskFilter with valid type', () => {
    const migrated = migratePersistedState({
      taskFilter: { search: 'test', type: 'us' }
    });
    expect(migrated.taskFilter.type).toBe('us');
    expect(migrated.taskFilter.search).toBe('test');
  });

  test('migratePersistedState normalizes criteria evaluations with scores', () => {
    const migrated = migratePersistedState({
      tasks: [{
        id: 1, title: 'T', type: 'us', est: {},
        criteriaEvaluations: { 1: { score: '5', value: '10.5' } }
      }]
    });
    expect(migrated.tasks[0].criteriaEvaluations[1].score).toBe(5);
    expect(migrated.tasks[0].criteriaEvaluations[1].value).toBe(10.5);
  });

  test('migratePersistedState handles criteria evaluations with null item', () => {
    const migrated = migratePersistedState({
      tasks: [{
        id: 1, title: 'T', type: 'us', est: {},
        criteriaEvaluations: { 1: null }
      }]
    });
    expect(migrated.tasks[0].criteriaEvaluations[1]).toEqual({ score: 0, value: 0 });
  });

  test('migratePersistedState normalizes NaN values to fallbacks', () => {
    const migrated = migratePersistedState({
      config: { days: 'abc', availCoef: 'xyz', alert: 'zzz' }
    });
    // NaN values should fall back to defaults
    expect(migrated.config.days).toBeGreaterThanOrEqual(1);
    expect(typeof migrated.config.availCoef).toBe('number');
    expect(typeof migrated.config.alert).toBe('number');
  });

  test('serializeStateForStorage with comma decimal separator', () => {
    const serialized = serializeStateForStorage(
      { config: {}, roles: [], tasks: [], activeTab: 'planning', taskFilter: {}, taskSort: {} },
      [],
      ','
    );
    expect(serialized.numberFormatSettings.decimalSeparator).toBe(',');
  });

  test('migratePersistedState handles task with non-excluded value', () => {
    const migrated = migratePersistedState({
      tasks: [{ id: 1, title: 'T', type: 'us', est: {}, excluded: 0 }]
    });
    expect(migrated.tasks[0].excluded).toBe(0);
  });

  test('migratePersistedState handles task with empty est', () => {
    const migrated = migratePersistedState({
      tasks: [{ id: 1, title: 'T', type: 'us' }]
    });
    // est should be normalized even when missing
    expect(migrated.tasks[0].est).toBeDefined();
  });

  test('migratePersistedState handles criteria with name and abbreviation', () => {
    const migrated = migratePersistedState({
      criteria: [{ id: 1, name: null, abbreviation: null, weight: 50, rationale: null }]
    });
    expect(migrated.criteria[0].name).toBe('');
    expect(migrated.criteria[0].abbreviation).toBe('');
    expect(migrated.criteria[0].rationale).toBe('');
  });
});
