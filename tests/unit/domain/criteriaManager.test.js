/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import { CriteriaManager, _resetCriteriaIdCounter } from '../../../js/domain/criteriaManager.js';

describe('CriteriaManager', () => {
  let manager;

  beforeEach(() => {
    manager = new CriteriaManager();
    document.body.innerHTML = '<div id="scaleEditor"></div>';
  });

  test('constructor loads default criteria', () => {
    const criteria = manager.getCriteria();
    expect(criteria).toHaveLength(4);
  });

  test('loadCriteria replaces criteria', () => {
    const newCriteria = [
      { id: 5, name: 'Test', abbreviation: 'TST', weight: 100, rationale: 'test', scale: {} }
    ];
    manager.loadCriteria(newCriteria);
    expect(manager.getCriteria()).toEqual(newCriteria);
  });

  test('addCriteria adds new criteria with a unique numeric id', () => {
    const newCriteria = manager.addCriteria({
      name: 'New',
      abbreviation: 'NEW',
      weight: 25,
      rationale: 'test',
      scale: {}
    });

    expect(typeof newCriteria.id).toBe('number');
    expect(manager.getCriteria()).toHaveLength(5);
  });

  describe('addCriteria — monotonic ID (no collisions after delete)', () => {
    test('IDs are monotonically increasing', () => {
      _resetCriteriaIdCounter(100);
      const c1 = manager.addCriteria({ name: 'C1', abbreviation: 'C1', weight: 5, rationale: '', scale: {} });
      const c2 = manager.addCriteria({ name: 'C2', abbreviation: 'C2', weight: 5, rationale: '', scale: {} });
      expect(c1.id).toBe(101);
      expect(c2.id).toBe(102);
    });

    test('no ID collision after deleting a criterion', () => {
      _resetCriteriaIdCounter(200);
      const c1 = manager.addCriteria({ name: 'C1', abbreviation: 'C1', weight: 5, rationale: '', scale: {} });
      manager.deleteCriteria(c1.id); // delete id=201
      const c2 = manager.addCriteria({ name: 'C2', abbreviation: 'C2', weight: 5, rationale: '', scale: {} });
      // c2 should get 202, not 201 (no collision with deleted id)
      expect(c2.id).toBe(202);
      expect(c2.id).not.toBe(c1.id);
    });
  });

  test('updateCriteria modifies existing criteria', () => {
    const result = manager.updateCriteria(1, { name: 'Updated' });
    expect(result).toBe(true);
    expect(manager.getCriteriaById(1).name).toBe('Updated');
  });

  test('updateCriteria returns false for non-existent id', () => {
    const result = manager.updateCriteria(999, { name: 'Updated' });
    expect(result).toBe(false);
  });

  test('deleteCriteria removes criteria', () => {
    const result = manager.deleteCriteria(1);
    expect(result).toBe(true);
    expect(manager.getCriteria()).toHaveLength(3);
  });

  test('deleteCriteria returns false for non-existent id', () => {
    const result = manager.deleteCriteria(999);
    expect(result).toBe(false);
  });

  test('getTotalWeight calculates correctly', () => {
    expect(manager.getTotalWeight()).toBe(100);
  });

  test('isWeightValid returns true when total is 100', () => {
    expect(manager.isWeightValid()).toBe(true);
  });

  test('calculatePriorityScore works', () => {
    const score = manager.calculatePriorityScore({ 1: { score: 8 } });
    expect(score).toBeCloseTo(3.2, 1);
  });

  test('getCriteriaByAbbreviation returns correct criteria', () => {
    const found = manager.getCriteriaByAbbreviation('OKR');
    expect(found).toBeDefined();
  });

  test('getCriteriaByAbbreviation returns undefined when not found', () => {
    const found = manager.getCriteriaByAbbreviation('NONE');
    expect(found).toBeUndefined();
  });

  test('loadDefaultCriteria restores default set', () => {
    manager.loadCriteria([]);
    manager.loadDefaultCriteria();
    expect(manager.getCriteria()).toHaveLength(4);
  });

  test('getMobileAbbreviation returns formatted string', () => {
    expect(manager.getMobileAbbreviation(null, 0)).toBe('k-1');
  });
});

