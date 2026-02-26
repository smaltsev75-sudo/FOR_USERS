/**
 * @jest-environment jsdom
 */
import { escapeHtml } from '../../../js/utils/escapeHtml.js';

describe('escapeHtml', () => {
  test('should escape HTML special characters', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
    expect(escapeHtml('"quote"')).toBe('&quot;quote&quot;');
    expect(escapeHtml("'apos'")).toBe('&#39;apos&#39;');
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });

  test('should handle empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  test('should handle strings without special characters', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

