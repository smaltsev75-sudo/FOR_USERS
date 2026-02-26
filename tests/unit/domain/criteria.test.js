/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import {
  calculatePriorityScore,
  initializeCriteriaEvaluations,
  calculateCriteriaValue,
  updateCriteriaEvaluation
} from '../../../js/domain/criteria.js';
import { generateScaleEditorHTML } from '../../../js/ui/criteriaList.js';

describe('criteria', () => {
  const sampleCriteria = [
    { id: 1, weight: 40 },
    { id: 2, weight: 30 },
    { id: 3, weight: 20 },
    { id: 4, weight: 10 }
  ];

  describe('calculatePriorityScore', () => {
    test('returns 0 when no criteria', () => {
      expect(calculatePriorityScore([], {})).toBe(0);
    });

    test('returns 0 when no evaluations', () => {
      expect(calculatePriorityScore(sampleCriteria, {})).toBe(0);
    });

    test('calculates weighted average correctly', () => {
      const evaluations = {
        1: { score: 8 },
        2: { score: 7 },
        3: { score: 6 },
        4: { score: 5 }
      };
      expect(calculatePriorityScore(sampleCriteria, evaluations)).toBe(7);
    });

    test('handles missing evaluations', () => {
      const evaluations = {
        1: { score: 8 },
        3: { score: 6 }
      };
      expect(calculatePriorityScore(sampleCriteria, evaluations)).toBe(4.4);
    });
  });

  describe('initializeCriteriaEvaluations', () => {
    test('creates empty evaluations for all criteria', () => {
      const result = initializeCriteriaEvaluations(sampleCriteria);
      expect(Object.keys(result)).toHaveLength(4);
      expect(result[1]).toEqual({ score: 0, value: 0 });
    });
  });

  describe('calculateCriteriaValue', () => {
    test('calculates value correctly', () => {
      expect(calculateCriteriaValue(8, 40)).toBe(32);
      expect(calculateCriteriaValue(10, 50)).toBe(50);
      expect(calculateCriteriaValue(0, 30)).toBe(0);
    });
  });

  describe('updateCriteriaEvaluation', () => {
    test('updates score and value correctly', () => {
      const old = { score: 5, value: 20 };
      const result = updateCriteriaEvaluation(old, '7', 30);
      expect(result).toEqual({ score: 7, value: 21 });
    });

    test('handles invalid input', () => {
      const old = { score: 5, value: 20 };
      const result = updateCriteriaEvaluation(old, 'invalid', 30);
      expect(result).toEqual({ score: 0, value: 0 });
    });
  });

  describe('generateScaleEditorHTML', () => {
    test('should generate HTML with 10 scale items', () => {
      const html = generateScaleEditorHTML();
      expect(typeof html).toBe('string');

      // Проверяем наличие 10 элементов
      const matches = html.match(/scale-item/g);
      expect(matches).toHaveLength(10);

      // Проверяем наличие правильных ID
      for (let i = 1; i <= 10; i++) {
        expect(html).toContain(`id="scale_${i}"`);
      }
    });

    test('should include provided scale descriptions', () => {
      const scale = {
        1: 'Very Low',
        2: 'Low',
        3: 'Medium',
        4: 'High',
        5: 'Very High'
      };
      const html = generateScaleEditorHTML(scale);
      expect(html).toContain('Very Low');
      expect(html).toContain('Very High');
    });

    test('should handle empty scale object', () => {
      const html = generateScaleEditorHTML({});
      expect(html).toContain('placeholder="Описание значения шкалы (опционально)"');
    });

    test('should properly escape HTML in descriptions', () => {
      const scale = {
        1: '<script>alert("xss")</script>'
      };
      const html = generateScaleEditorHTML(scale);
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });
});








