/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

// Module-level mock reference
const mockGetOptimizationRecommendations = jest.fn((res, capacity) => {
    return [
        { type: 'team-overload', message: 'Team overloaded', severity: 'high', suggestion: 'Reduce tasks' },
        { type: 'role-overload', message: 'FE overloaded', severity: 'medium', suggestion: 'Reduce FE tasks' }
    ];
});

// Mock dependencies before importing
jest.unstable_mockModule('../../../js/domain/selection/index.js', () => ({
    compareAlgorithms: jest.fn(),
    getOptimizationRecommendations: mockGetOptimizationRecommendations
}));

jest.unstable_mockModule('../../../js/services/message.js', () => ({
    messageService: {
        showMessage: jest.fn()
    }
}));

const { buildRecommendationsHtml, renderRecommendations, showRecommendationsFallback } = await import('../../../js/ui/selectionRecommendations.js');
const { messageService } = await import('../../../js/services/message.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockMultiSelectionResults = {
    results: {
        matrix: { selectedTasks: [], excludedTasks: [], algorithm: 'matrix' },
        'value-density': { selectedTasks: [], excludedTasks: [], algorithm: 'value-density' },
        hybrid: { selectedTasks: [], excludedTasks: [], algorithm: 'hybrid' }
    }
};

const mockCapacity = { fe: 80, be: 80, uiux: 80, ca: 80, qa: 80 };

function createDom() {
    document.body.innerHTML = `
        <div id="recommendationsModal" style="display:none;">
            <div id="recommendationsContent"></div>
            <button id="closeRecommendationsModalBtn"></button>
            <button id="closeRecommendationsBtn"></button>
        </div>
        <div id="messageModal" style="display:none;">
            <div id="messageText"></div>
            <button id="okMessageBtn"></button>
            <button id="closeMessageModalBtn"></button>
        </div>
    `;
}

describe('ui/selectionRecommendations', () => {
    beforeEach(() => {
        createDom();
        jest.clearAllMocks();
        // Reset to default implementation
        mockGetOptimizationRecommendations.mockImplementation((res, capacity) => [
            { type: 'team-overload', message: 'Team overloaded', severity: 'high', suggestion: 'Reduce tasks' },
            { type: 'role-overload', message: 'FE overloaded', severity: 'medium', suggestion: 'Reduce FE tasks' }
        ]);
    });

    // ── buildRecommendationsHtml ───────────────────────────────────────────────

    describe('buildRecommendationsHtml', () => {
        test('returns "no recommendations" message when no recs', () => {
            mockGetOptimizationRecommendations.mockReturnValue([]);
            const html = buildRecommendationsHtml(mockMultiSelectionResults, mockCapacity);
            expect(html).toContain('Нет рекомендаций');
        });

        test('includes general recommendations section', () => {
            const html = buildRecommendationsHtml(mockMultiSelectionResults, mockCapacity);
            expect(html).toContain('Общие рекомендации');
            expect(html).toContain('Team overloaded');
        });

        test('includes per-algorithm sections', () => {
            const html = buildRecommendationsHtml(mockMultiSelectionResults, mockCapacity);
            expect(html).toContain('algorithms-grid');
        });

        test('deduplicates general recommendations', () => {
            const html = buildRecommendationsHtml(mockMultiSelectionResults, mockCapacity);
            // "Team overloaded" should appear only once despite 3 algorithms
            const count = (html.match(/Team overloaded/g) || []).length;
            expect(count).toBe(1);
        });

        test('includes suggestion text', () => {
            const html = buildRecommendationsHtml(mockMultiSelectionResults, mockCapacity);
            expect(html).toContain('Reduce tasks');
        });

        test('skips algorithms with errors', () => {
            const resultsWithError = {
                results: {
                    matrix: { error: 'Some error' },
                    'value-density': { selectedTasks: [], excludedTasks: [], algorithm: 'value-density' },
                    hybrid: { selectedTasks: [], excludedTasks: [], algorithm: 'hybrid' }
                }
            };
            const html = buildRecommendationsHtml(resultsWithError, mockCapacity);
            expect(html).toBeDefined();
        });
    });

    // ── renderRecommendations ──────────────────────────────────────────────────

    describe('renderRecommendations', () => {
        test('renders into modal and shows it', () => {
            renderRecommendations(mockMultiSelectionResults, mockCapacity);
            expect(document.getElementById('recommendationsModal').style.display).toBe('flex');
            expect(document.getElementById('recommendationsContent').innerHTML).toContain('recommendations-container');
        });

        test('close button hides modal', () => {
            renderRecommendations(mockMultiSelectionResults, mockCapacity);
            document.getElementById('closeRecommendationsBtn').click();
            expect(document.getElementById('recommendationsModal').style.display).toBe('none');
        });

        test('closeRecommendationsModalBtn also hides modal', () => {
            renderRecommendations(mockMultiSelectionResults, mockCapacity);
            document.getElementById('closeRecommendationsModalBtn').click();
            expect(document.getElementById('recommendationsModal').style.display).toBe('none');
        });

        test('falls back to message when modal is missing', () => {
            document.body.innerHTML = ''; // Remove modal
            renderRecommendations(mockMultiSelectionResults, mockCapacity);
            expect(messageService.showMessage).toHaveBeenCalled();
        });
    });

    // ── showRecommendationsFallback ────────────────────────────────────────────

    test('showRecommendationsFallback calls messageService.showMessage', () => {
        showRecommendationsFallback(mockMultiSelectionResults, mockCapacity);
        expect(messageService.showMessage).toHaveBeenCalled();
        const msg = messageService.showMessage.mock.calls[0][0];
        expect(msg).toContain('Team overloaded');
    });

    test('showRecommendationsFallback shows "no recommendations" when empty', () => {
        mockGetOptimizationRecommendations.mockReturnValue([]);
        showRecommendationsFallback(mockMultiSelectionResults, mockCapacity);
        expect(messageService.showMessage).toHaveBeenCalledWith(expect.stringContaining('нет'));
    });

    test('showRecommendationsFallback includes algorithm-specific recs', () => {
        showRecommendationsFallback(mockMultiSelectionResults, mockCapacity);
        const msg = messageService.showMessage.mock.calls[0][0];
        expect(msg).toContain('FE overloaded');
    });
});
