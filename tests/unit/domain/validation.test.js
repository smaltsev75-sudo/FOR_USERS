import { jest } from '@jest/globals';
import {
    validateTitle,
    validateJiraUrl,
    isTitleUnique,
    isJiraUrlUnique,
    validateAbbreviation,
    isAbbreviationUnique,
    generateAbbreviation
} from '../../../js/domain/validation.js';

describe('domain/validation', () => {
    describe('validateTitle', () => {
        test('valid title passes', () => {
            expect(validateTitle('Valid Task Title')).toEqual({ valid: true });
        });

        test('empty title fails', () => {
            expect(validateTitle('')).toEqual({ valid: false, message: expect.any(String) });
        });

        test('too short title fails', () => {
            expect(validateTitle('abc')).toEqual({ valid: false, message: expect.any(String) });
        });

        test('title with exactly 5 characters passes', () => {
            expect(validateTitle('12345')).toEqual({ valid: true });
        });

        test('title with exactly 150 characters passes', () => {
            const title = 'a'.repeat(150);
            expect(validateTitle(title)).toEqual({ valid: true });
        });

        test('title with 151 characters fails', () => {
            const title = 'a'.repeat(151);
            expect(validateTitle(title)).toEqual({ valid: false, message: expect.any(String) });
        });

        test('title with whitespace only fails', () => {
            expect(validateTitle('   ')).toEqual({ valid: false, message: expect.any(String) });
        });
    });

    describe('validateJiraUrl', () => {
        test('valid http url passes', () => {
            expect(validateJiraUrl('http://jira.com/TEST-1')).toEqual({ valid: true });
        });

        test('valid https url passes', () => {
            expect(validateJiraUrl('https://jira.com/TEST-1')).toEqual({ valid: true });
        });

        test('missing protocol fails', () => {
            expect(validateJiraUrl('jira.com/TEST-1')).toEqual({ valid: false, message: expect.any(String) });
        });

        test('empty url fails', () => {
            expect(validateJiraUrl('')).toEqual({ valid: false, message: expect.any(String) });
        });

        test('url with exactly 10 characters passes', () => {
            expect(validateJiraUrl('http://a.b')).toEqual({ valid: true });
        });

        test('url with 9 characters fails', () => {
            expect(validateJiraUrl('http://a')).toEqual({ valid: false, message: expect.any(String) });
        });

        test('javascript protocol fails', () => {
            expect(validateJiraUrl('javascript:alert(1)')).toEqual({ valid: false, message: expect.any(String) });
        });

        test('http:// without domain fails', () => {
            expect(validateJiraUrl('http://')).toEqual({ valid: false, message: expect.any(String) });
        });
    });

    describe('isTitleUnique', () => {
        const tasks = [
            { id: 1, title: 'Task One' },
            { id: 2, title: 'Task Two' }
        ];

        test('returns true for new title', () => {
            expect(isTitleUnique(tasks, 'Task Three')).toBe(true);
        });

        test('returns false for existing title', () => {
            expect(isTitleUnique(tasks, 'Task One')).toBe(false);
        });

        test('excludes current task when editing', () => {
            expect(isTitleUnique(tasks, 'Task One', 1)).toBe(true);
        });

        test('returns true for undefined title', () => {
            expect(isTitleUnique(tasks, undefined)).toBe(true);
        });

        test('returns true for empty tasks array', () => {
            expect(isTitleUnique([], 'Test')).toBe(true);
        });

        test('case insensitive comparison', () => {
            expect(isTitleUnique(tasks, 'TASK ONE')).toBe(false);
        });
    });

    describe('isJiraUrlUnique', () => {
        const tasks = [
            { id: 1, jira: 'https://jira.com/TEST-1' }
        ];

        test('returns true for new url', () => {
            expect(isJiraUrlUnique(tasks, 'https://jira.com/TEST-2')).toBe(true);
        });

        test('returns false for existing url', () => {
            expect(isJiraUrlUnique(tasks, 'https://jira.com/TEST-1')).toBe(false);
        });

        test('excludes current when editing', () => {
            expect(isJiraUrlUnique(tasks, 'https://jira.com/TEST-1', 1)).toBe(true);
        });

        test('returns true for undefined url', () => {
            expect(isJiraUrlUnique(tasks, undefined)).toBe(true);
        });

        test('returns true for empty tasks array', () => {
            expect(isJiraUrlUnique([], 'http://test.com')).toBe(true);
        });

        test('case insensitive comparison', () => {
            expect(isJiraUrlUnique(tasks, 'HTTPS://JIRA.COM/TEST-1')).toBe(false);
        });
    });

    describe('validateAbbreviation', () => {
        test('valid abbreviation passes', () => {
            expect(validateAbbreviation('OKR')).toEqual({ valid: true });
        });

        test('empty fails', () => {
            expect(validateAbbreviation('')).toEqual({ valid: false, message: expect.any(String) });
        });

        test('too long fails', () => {
            expect(validateAbbreviation('TOOLONG')).toEqual({ valid: false, message: expect.any(String) });
        });

        test('space fails', () => {
            expect(validateAbbreviation('O KR')).toEqual({ valid: false, message: expect.any(String) });
        });

        test('first char must be letter/digit', () => {
            expect(validateAbbreviation('1AB')).toEqual({ valid: true });
            expect(validateAbbreviation('@AB')).toEqual({ valid: false, message: expect.any(String) });
        });

        test('exactly 1 character passes', () => {
            expect(validateAbbreviation('A')).toEqual({ valid: true });
        });

        test('exactly 5 characters passes', () => {
            expect(validateAbbreviation('ABCDE')).toEqual({ valid: true });
        });

        test('whitespace only fails', () => {
            expect(validateAbbreviation('   ')).toEqual({ valid: false, message: expect.any(String) });
        });

        test('digits as first char passes', () => {
            expect(validateAbbreviation('1ABC')).toEqual({ valid: true });
        });

        test('russian letters with valid length pass', () => {
            expect(validateAbbreviation('ПРИВ')).toEqual({ valid: true });
        });

        test('russian letters too long fail', () => {
            expect(validateAbbreviation('ПРИВЕТ')).toEqual({ valid: false, message: expect.any(String) });
        });

        test('lowercase passes', () => {
            expect(validateAbbreviation('okr')).toEqual({ valid: true });
        });
    });

    describe('isAbbreviationUnique', () => {
        const criteria = [
            { id: 1, abbreviation: 'OKR' }
        ];

        test('returns true for new abbreviation', () => {
            expect(isAbbreviationUnique(criteria, 'UX')).toBe(true);
        });

        test('returns false for existing abbreviation', () => {
            expect(isAbbreviationUnique(criteria, 'OKR')).toBe(false);
        });

        test('excludes current when editing', () => {
            expect(isAbbreviationUnique(criteria, 'OKR', 1)).toBe(true);
        });

        test('case insensitive', () => {
            expect(isAbbreviationUnique(criteria, 'okr')).toBe(false);
        });

        test('returns true for empty abbreviation', () => {
            expect(isAbbreviationUnique(criteria, '')).toBe(true);
        });
    });

    describe('generateAbbreviation', () => {
        test('generates abbreviation from name', () => {
            expect(generateAbbreviation('Key Result')).toBe('KEYRE');
            expect(generateAbbreviation('A')).toBe('A');
            expect(generateAbbreviation('Very Long Name Here')).toBe('VERYL');
        });

        test('handles names with spaces', () => {
            expect(generateAbbreviation('  Key   Result  ')).toBe('KEYRE');
        });

        test('handles names with non-letter first character', () => {
            expect(generateAbbreviation('123 Test')).toBe('123TE');
        });

        test('returns CRT for empty input', () => {
            expect(generateAbbreviation('')).toBe('CRT');
        });

        test('returns CRT when no letters/digits found', () => {
            expect(generateAbbreviation('@#$%')).toBe('CRT');
        });

        test('handles name starting with space', () => {
            expect(generateAbbreviation('  Test')).toBe('TEST');
        });

        test('handles name with only numbers', () => {
            expect(generateAbbreviation('123456')).toBe('12345');
        });
    });
});
