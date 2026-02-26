/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

// Mock selectionHelpers before importing
const mockBuildComparisonDisplayData = jest.fn((results, comparison, algorithms) => {
    return algorithms.map(algo => ({
        name: algo,
        tasksCount: 2,
        displayLoad: 85.5,
        displayEffort: 20.0,
        displayPriority: 15.0,
        displayDensity: 0.75
    }));
});

jest.unstable_mockModule('../../../js/controllers/selection/selectionHelpers.js', () => ({
    areNearlyEqual: jest.fn((a, b) => Math.abs(a - b) < 0.001),
    buildComparisonDisplayData: mockBuildComparisonDisplayData,
    computeComparisonBestValues: jest.fn(() => ({
        bestTasks: 2,
        bestLoadDiff: 14.5,
        bestEffort: 20.0,
        bestPriority: 15.0,
        bestDensity: 0.75
    }))
}));

const { renderSelectionReport, getSeverityClass, getSeverityHint, ALGORITHM_NAMES } = await import('../../../js/ui/selectionReport.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function createDom() {
    document.body.innerHTML = `
        <div id="selectionReportContent"></div>
        <div id="selectionReportModal" style="display:none;"></div>
    `;
}

const mockResults = {
    matrix: {
        selectedTasks: [{ id: 1, title: 'T1' }, { id: 2, title: 'T2' }],
        excludedTasks: [],
        quadrants: { q1: [{ id: 1, title: 'T1', priorityScore: 8, effort: 5 }], q2: [], q3: [], q4: [] },
        algorithm: 'matrix'
    },
    'value-density': {
        selectedTasks: [{ id: 1, title: 'T1' }],
        excludedTasks: [{ id: 2, title: 'T2', reason: 'Capacity exceeded' }],
        quadrants: null,
        algorithm: 'value-density'
    },
    hybrid: {
        selectedTasks: [{ id: 1, title: 'T1' }, { id: 2, title: 'T2' }],
        excludedTasks: [],
        quadrants: { q1: [], q2: [], q3: [], q4: [] },
        algorithm: 'hybrid'
    }
};

const mockComparison = {
    matrix: { algorithmName: 'Priority-Effort Matrix' },
    'value-density': { algorithmName: 'Value Density' },
    hybrid: { algorithmName: 'Hybrid' }
};

describe('ui/selectionReport', () => {
    beforeEach(() => {
        createDom();
        jest.clearAllMocks();
    });

    // ── renderSelectionReport ──────────────────────────────────────────────────

    describe('renderSelectionReport', () => {
        test('returns false when multiSelectionResults is null', () => {
            const result = renderSelectionReport(null);
            expect(result).toBe(false);
        });

        test('returns false when #selectionReportContent is missing', () => {
            document.body.innerHTML = '';
            const result = renderSelectionReport({ results: mockResults, comparison: mockComparison });
            expect(result).toBe(false);
        });

        test('renders report and shows modal', () => {
            const result = renderSelectionReport({ results: mockResults, comparison: mockComparison });
            expect(result).toBe(true);
            expect(document.getElementById('selectionReportModal').style.display).toBe('flex');
        });

        test('renders comparison table', () => {
            renderSelectionReport({ results: mockResults, comparison: mockComparison });
            const content = document.getElementById('selectionReportContent').innerHTML;
            expect(content).toContain('comparison-table');
            expect(content).toContain('Сравнение алгоритмов');
        });

        test('renders algorithm descriptions accordion', () => {
            renderSelectionReport({ results: mockResults, comparison: mockComparison });
            const content = document.getElementById('selectionReportContent').innerHTML;
            expect(content).toContain('Об алгоритмах отбора');
            expect(content).toContain('accordion-item');
        });

        test('renders recommendations button', () => {
            renderSelectionReport({ results: mockResults, comparison: mockComparison });
            expect(document.getElementById('showRecommendationsBtn')).not.toBeNull();
        });

        test('renders algorithm detail accordions', () => {
            renderSelectionReport({ results: mockResults, comparison: mockComparison });
            const content = document.getElementById('selectionReportContent').innerHTML;
            expect(content).toContain('algorithm-detail');
        });

        test('renders quadrant tasks when present', () => {
            renderSelectionReport({ results: mockResults, comparison: mockComparison });
            const content = document.getElementById('selectionReportContent').innerHTML;
            expect(content).toContain('T1');
        });

        test('renders excluded tasks when present', () => {
            renderSelectionReport({ results: mockResults, comparison: mockComparison });
            const content = document.getElementById('selectionReportContent').innerHTML;
            expect(content).toContain('Исключено');
        });

        test('shows empty message when no comparable data', () => {
            mockBuildComparisonDisplayData.mockReturnValueOnce([]);

            renderSelectionReport({ results: mockResults, comparison: mockComparison });
            const content = document.getElementById('selectionReportContent').innerHTML;
            expect(content).toContain('Нет данных');
        });

        test('accordion headers toggle content on click', () => {
            renderSelectionReport({ results: mockResults, comparison: mockComparison });
            const header = document.querySelector('.accordion-header');
            const content = header.nextElementSibling;
            expect(content.style.display).toBe('none');
            header.click();
            expect(content.style.display).toBe('block');
            header.click();
            expect(content.style.display).toBe('none');
        });
    });

    // ── getSeverityClass ───────────────────────────────────────────────────────

    describe('getSeverityClass', () => {
        test('returns severity-high for high', () => {
            expect(getSeverityClass('high')).toBe('severity-high');
        });
        test('returns severity-medium for medium', () => {
            expect(getSeverityClass('medium')).toBe('severity-medium');
        });
        test('returns severity-low for low', () => {
            expect(getSeverityClass('low')).toBe('severity-low');
        });
        test('returns severity-info for unknown', () => {
            expect(getSeverityClass('unknown')).toBe('severity-info');
        });
    });

    // ── getSeverityHint ────────────────────────────────────────────────────────

    describe('getSeverityHint', () => {
        test('returns hint for high', () => {
            expect(getSeverityHint('high')).toContain('Критическая');
        });
        test('returns hint for medium', () => {
            expect(getSeverityHint('medium')).toContain('Существенное');
        });
        test('returns hint for low', () => {
            expect(getSeverityHint('low')).toContain('Предупреждение');
        });
        test('returns empty string for unknown', () => {
            expect(getSeverityHint('unknown')).toBe('');
        });
    });

    // ── ALGORITHM_NAMES ────────────────────────────────────────────────────────

    test('ALGORITHM_NAMES contains all 3 algorithms', () => {
        expect(ALGORITHM_NAMES['matrix']).toBeDefined();
        expect(ALGORITHM_NAMES['value-density']).toBeDefined();
        expect(ALGORITHM_NAMES['hybrid']).toBeDefined();
    });
});
