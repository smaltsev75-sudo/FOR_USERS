/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

const compareAlgorithmsMock = jest.fn();
const getOptimizationRecommendationsMock = jest.fn(() => []);
const messageServiceMock = { showMessage: jest.fn(), showConfirm: jest.fn() };
const renderSelectionReportMock = jest.fn();
const renderRecommendationsMock = jest.fn();
const hideModalMock = jest.fn();

jest.unstable_mockModule('../../../js/domain/selection/index.js', () => ({
    compareAlgorithms: compareAlgorithmsMock,
    getOptimizationRecommendations: getOptimizationRecommendationsMock
}));

jest.unstable_mockModule('../../../js/services/message.js', () => ({
    messageService: messageServiceMock
}));

jest.unstable_mockModule('../../../js/ui/selectionReport.js', () => ({
    renderSelectionReport: renderSelectionReportMock
}));

jest.unstable_mockModule('../../../js/ui/selectionRecommendations.js', () => ({
    renderRecommendations: renderRecommendationsMock
}));

jest.unstable_mockModule('../../../js/ui/modalManager.js', () => ({
    hideModal: hideModalMock
}));

const { SelectionController } = await import('../../../js/controllers/selectionController.js');

describe('controllers/selectionController', () => {
    function createStore(tasks = [{ id: 1, title: 'T1', est: { fe: 2 }, excluded: 0, criteriaEvaluations: {} }]) {
        const state = {
            config: { days: 10, availCoef: 90, alert: 3 },
            roles: [
                { id: 'uiux', fte: 100, off: 0 },
                { id: 'ca', fte: 100, off: 0 },
                { id: 'fe', fte: 100, off: 0 },
                { id: 'be', fte: 100, off: 0 },
                { id: 'qa', fte: 100, off: 0 }
            ],
            tasks
        };
        return {
            getState: jest.fn(() => state),
            setTaskFilter: jest.fn(),
            setTasks: jest.fn()
        };
    }

    function createCriteriaManager(weight = 100) {
        return {
            getTotalWeight: jest.fn(() => weight),
            calculatePriorityScore: jest.fn(() => 5),
            getCriteria: jest.fn(() => [{ id: 1, weight: 100 }])
        };
    }

    const nfs = { formatNumber: (x) => String(x) };

    function createDom() {
        document.body.innerHTML = `
            <button id="autoSelectBtn"></button>
            <div id="selectionLoadingIndicator" style="display:none"></div>
            <div id="selectionReportModal" style="display:none">
                <button id="closeSelectionReportBtn"></button>
                <button id="closeSelectionReportModalBtn"></button>
                <button id="applyMatrixBtn"></button>
                <button id="applyValueDensityBtn"></button>
                <button id="applyHybridBtn"></button>
                <button id="showRecommendationsBtn"></button>
                <div class="accordion-header">
                    <span class="accordion-icon">▶</span>
                </div>
                <div class="accordion-content" style="display:none">Accordion body</div>
            </div>
            <div id="selectionReportContent"></div>
            <div id="recommendationsModal" style="display:none">
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

    const defaultComparisonResult = {
        results: {
            matrix: { selectedTasks: [], totalLoad: 0, algorithmName: 'Matrix', excludedTasks: [], quadrants: { q1: [], q2: [], q3: [], q4: [] } },
            'value-density': { selectedTasks: [], totalLoad: 0, algorithmName: 'Density', excludedTasks: [] },
            hybrid: { selectedTasks: [], totalLoad: 0, algorithmName: 'Hybrid', excludedTasks: [], quadrants: { q1: [], q2: [], q3: [], q4: [] } }
        },
        comparison: {
            matrix: { algorithmName: 'Matrix', selectedTasks: 0, loadPercentage: 0 },
            'value-density': { algorithmName: 'Density', selectedTasks: 0, loadPercentage: 0 },
            hybrid: { algorithmName: 'Hybrid', selectedTasks: 0, loadPercentage: 0 }
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        createDom();
        compareAlgorithmsMock.mockReturnValue(defaultComparisonResult);
    });

    // ── constructor ───────────────────────────────────────────────────────────

    test('constructor sets up initial state', () => {
        const store = createStore();
        const cm = createCriteriaManager();
        const ctrl = new SelectionController(store, cm, nfs);

        expect(ctrl.store).toBe(store);
        expect(ctrl.criteriaManager).toBe(cm);
        expect(ctrl.multiSelectionResults).toBeNull();
    });

    // ── runMultiSelection ─────────────────────────────────────────────────────

    test('runMultiSelection executes algorithms and opens report', () => {
        const store = createStore();
        const criteriaManager = createCriteriaManager(100);
        const controller = new SelectionController(store, criteriaManager, nfs);

        controller.runMultiSelection();

        expect(compareAlgorithmsMock).toHaveBeenCalledTimes(1);
        expect(controller.multiSelectionResults).toBeTruthy();
    });

    test('runMultiSelection blocks when criteria weight > 100', () => {
        const store = createStore();
        const criteriaManager = createCriteriaManager(120);
        const controller = new SelectionController(store, criteriaManager, nfs);

        controller.runMultiSelection();

        expect(compareAlgorithmsMock).not.toHaveBeenCalled();
        expect(messageServiceMock.showMessage).toHaveBeenCalledWith(expect.stringContaining('превышает'));
    });

    test('runMultiSelection blocks when criteria weight < 100', () => {
        const store = createStore();
        const criteriaManager = createCriteriaManager(80);
        const controller = new SelectionController(store, criteriaManager, nfs);

        controller.runMultiSelection();

        expect(compareAlgorithmsMock).not.toHaveBeenCalled();
        expect(messageServiceMock.showMessage).toHaveBeenCalledWith(expect.stringContaining('не достигает'));
    });

    test('runMultiSelection shows error when algorithm throws', () => {
        compareAlgorithmsMock.mockImplementationOnce(() => { throw new Error('Algorithm failed'); });
        const store = createStore();
        const criteriaManager = createCriteriaManager(100);
        const controller = new SelectionController(store, criteriaManager, nfs);

        controller.runMultiSelection();

        expect(messageServiceMock.showMessage).toHaveBeenCalledWith(expect.stringContaining('Ошибка'));
    });

    test('runMultiSelection calls showMultiSelectionReport on success', () => {
        const store = createStore();
        const cm = createCriteriaManager(100);
        const ctrl = new SelectionController(store, cm, nfs);
        const spy = jest.spyOn(ctrl, 'showMultiSelectionReport');

        ctrl.runMultiSelection();

        expect(spy).toHaveBeenCalled();
    });

    // ── showMultiSelectionReport ───────────────────────────────────────────────

    test('showMultiSelectionReport does nothing when no results', () => {
        const store = createStore();
        const cm = createCriteriaManager();
        const ctrl = new SelectionController(store, cm, nfs);

        ctrl.showMultiSelectionReport();

        expect(renderSelectionReportMock).not.toHaveBeenCalled();
    });

    test('showMultiSelectionReport calls renderSelectionReport when results available', () => {
        const store = createStore();
        const cm = createCriteriaManager();
        const ctrl = new SelectionController(store, cm, nfs);
        ctrl.multiSelectionResults = defaultComparisonResult;

        ctrl.showMultiSelectionReport();

        expect(renderSelectionReportMock).toHaveBeenCalledWith(defaultComparisonResult, expect.any(Array));
    });

    // ── getCachedAlgorithmResults ──────────────────────────────────────────────

    test('getCachedAlgorithmResults caches results on second call', () => {
        const store = createStore();
        const criteriaManager = createCriteriaManager(100);
        const controller = new SelectionController(store, criteriaManager, nfs);

        const tasks = [{ id: 1, priorityScore: 5, effort: 5, roleEffort: { fe: 5 }, excluded: 0 }];
        const capacity = { fe: 80 };

        controller.getCachedAlgorithmResults(tasks, capacity);
        controller.getCachedAlgorithmResults(tasks, capacity);

        expect(compareAlgorithmsMock).toHaveBeenCalledTimes(1);
    });

    test('invalidateAlgorithmsCache clears cache', () => {
        const store = createStore();
        const criteriaManager = createCriteriaManager(100);
        const controller = new SelectionController(store, criteriaManager, nfs);

        const tasks = [{ id: 1, priorityScore: 5, effort: 5, roleEffort: { fe: 5 }, excluded: 0 }];
        const capacity = { fe: 80 };

        controller.getCachedAlgorithmResults(tasks, capacity);
        controller.invalidateAlgorithmsCache();
        controller.getCachedAlgorithmResults(tasks, capacity);

        expect(compareAlgorithmsMock).toHaveBeenCalledTimes(2);
    });

    // ── applyAlgorithm ────────────────────────────────────────────────────────

    describe('applyAlgorithm', () => {
        test('applies algorithm and updates store', () => {
            const tasks = [
                { id: 1, title: 'T1', excluded: 0, exclusionReason: '' },
                { id: 2, title: 'T2', excluded: 0, exclusionReason: '' }
            ];
            const store = createStore(tasks);
            const criteriaManager = createCriteriaManager(100);
            const controller = new SelectionController(store, criteriaManager, nfs);

            controller.multiSelectionResults = {
                results: {
                    matrix: {
                        selectedTasks: [{ id: 1, rawTask: { id: 1 } }],
                        algorithmName: 'Matrix'
                    }
                }
            };

            controller.applyAlgorithm('matrix');

            expect(store.setTasks).toHaveBeenCalled();
            expect(store.setTaskFilter).toHaveBeenCalledWith({ search: '', type: '' });
            expect(messageServiceMock.showMessage).toHaveBeenCalledWith(expect.stringContaining('Matrix'));
        });

        test('marks non-selected tasks as excluded', () => {
            const tasks = [
                { id: 1, title: 'T1', excluded: 0, exclusionReason: '' },
                { id: 2, title: 'T2', excluded: 0, exclusionReason: '' }
            ];
            const store = createStore(tasks);
            const cm = createCriteriaManager(100);
            const ctrl = new SelectionController(store, cm, nfs);

            ctrl.multiSelectionResults = {
                results: {
                    matrix: {
                        selectedTasks: [{ id: 1, rawTask: { id: 1 } }],
                        algorithmName: 'Matrix'
                    }
                }
            };

            ctrl.applyAlgorithm('matrix');

            const updatedTasks = store.setTasks.mock.calls[0][0];
            const t1 = updatedTasks.find(t => t.id === 1);
            const t2 = updatedTasks.find(t => t.id === 2);
            expect(t1.excluded).toBe(0);
            expect(t2.excluded).toBe(1);
            expect(t2.exclusionReason).toBe('Исключена алгоритмом');
        });

        test('preserves existing exclusionReason when re-excluding', () => {
            const tasks = [
                { id: 1, title: 'T1', excluded: 1, exclusionReason: 'Custom reason' }
            ];
            const store = createStore(tasks);
            const cm = createCriteriaManager(100);
            const ctrl = new SelectionController(store, cm, nfs);

            ctrl.multiSelectionResults = {
                results: {
                    matrix: {
                        selectedTasks: [], // No tasks selected → all excluded
                        algorithmName: 'Matrix'
                    }
                }
            };

            ctrl.applyAlgorithm('matrix');

            const updatedTasks = store.setTasks.mock.calls[0][0];
            expect(updatedTasks[0].exclusionReason).toBe('Custom reason');
        });

        test('handles tasks with id instead of rawTask', () => {
            const tasks = [{ id: 1, title: 'T1', excluded: 0, exclusionReason: '' }];
            const store = createStore(tasks);
            const cm = createCriteriaManager(100);
            const ctrl = new SelectionController(store, cm, nfs);

            ctrl.multiSelectionResults = {
                results: {
                    matrix: {
                        selectedTasks: [{ id: 1 }], // No rawTask — fallback to id
                        algorithmName: 'Matrix'
                    }
                }
            };

            ctrl.applyAlgorithm('matrix');

            const updatedTasks = store.setTasks.mock.calls[0][0];
            expect(updatedTasks[0].excluded).toBe(0);
        });

        test('shows error when no results for algorithm', () => {
            const store = createStore();
            const criteriaManager = createCriteriaManager(100);
            const controller = new SelectionController(store, criteriaManager, nfs);
            controller.multiSelectionResults = { results: {} };

            controller.applyAlgorithm('matrix');

            expect(messageServiceMock.showMessage).toHaveBeenCalled();
        });

        test('does nothing when multiSelectionResults is null', () => {
            const store = createStore();
            const criteriaManager = createCriteriaManager(100);
            const controller = new SelectionController(store, criteriaManager, nfs);

            controller.applyAlgorithm('matrix');

            expect(store.setTasks).not.toHaveBeenCalled();
        });

        test('invalidates algorithm cache after applying', () => {
            const tasks = [{ id: 1, title: 'T', excluded: 0, exclusionReason: '' }];
            const store = createStore(tasks);
            const cm = createCriteriaManager(100);
            const ctrl = new SelectionController(store, cm, nfs);
            const spy = jest.spyOn(ctrl, 'invalidateAlgorithmsCache');

            ctrl.multiSelectionResults = {
                results: {
                    matrix: {
                        selectedTasks: [{ id: 1, rawTask: { id: 1 } }],
                        algorithmName: 'Matrix'
                    }
                }
            };

            ctrl.applyAlgorithm('matrix');

            expect(spy).toHaveBeenCalled();
        });
    });

    // ── closeReport ───────────────────────────────────────────────────────────

    test('closeReport calls hideModal', () => {
        const store = createStore();
        const cm = createCriteriaManager(100);
        const ctrl = new SelectionController(store, cm, nfs);

        ctrl.closeReport();

        expect(hideModalMock).toHaveBeenCalled();
    });

    // ── calculateCapacityByRole ────────────────────────────────────────────────

    test('calculateCapacityByRole returns capacity object', () => {
        const store = createStore();
        const criteriaManager = createCriteriaManager(100);
        const controller = new SelectionController(store, criteriaManager, nfs);

        const capacity = controller.calculateCapacityByRole();

        expect(capacity).toBeDefined();
        expect(typeof capacity).toBe('object');
    });

    // ── showRecommendations ───────────────────────────────────────────────────

    test('showRecommendations does nothing when no results', () => {
        const store = createStore();
        const cm = createCriteriaManager(100);
        const ctrl = new SelectionController(store, cm, nfs);

        ctrl.showRecommendations();

        expect(renderRecommendationsMock).not.toHaveBeenCalled();
    });

    test('showRecommendations calls renderRecommendations when results available', () => {
        const store = createStore();
        const cm = createCriteriaManager(100);
        const ctrl = new SelectionController(store, cm, nfs);
        ctrl.multiSelectionResults = defaultComparisonResult;

        ctrl.showRecommendations();

        expect(renderRecommendationsMock).toHaveBeenCalledWith(
            defaultComparisonResult,
            expect.any(Object),
            expect.any(Array)
        );
    });

    // ── attachEvents ──────────────────────────────────────────────────────────

    describe('attachEvents', () => {
        test('autoSelectBtn click calls runMultiSelection', () => {
            const store = createStore();
            const cm = createCriteriaManager(100);
            const ctrl = new SelectionController(store, cm, nfs);
            ctrl.init();
            const spy = jest.spyOn(ctrl, 'runMultiSelection');

            document.getElementById('autoSelectBtn').click();

            expect(spy).toHaveBeenCalled();
        });

        test('applyMatrixBtn click calls applyAlgorithm with matrix', () => {
            const store = createStore();
            const cm = createCriteriaManager(100);
            const ctrl = new SelectionController(store, cm, nfs);
            ctrl.init();
            const spy = jest.spyOn(ctrl, 'applyAlgorithm');

            document.getElementById('applyMatrixBtn').click();

            expect(spy).toHaveBeenCalledWith('matrix');
        });

        test('applyValueDensityBtn click calls applyAlgorithm with value-density', () => {
            const store = createStore();
            const cm = createCriteriaManager(100);
            const ctrl = new SelectionController(store, cm, nfs);
            ctrl.init();
            const spy = jest.spyOn(ctrl, 'applyAlgorithm');

            document.getElementById('applyValueDensityBtn').click();

            expect(spy).toHaveBeenCalledWith('value-density');
        });

        test('applyHybridBtn click calls applyAlgorithm with hybrid', () => {
            const store = createStore();
            const cm = createCriteriaManager(100);
            const ctrl = new SelectionController(store, cm, nfs);
            ctrl.init();
            const spy = jest.spyOn(ctrl, 'applyAlgorithm');

            document.getElementById('applyHybridBtn').click();

            expect(spy).toHaveBeenCalledWith('hybrid');
        });

        test('closeSelectionReportBtn click closes report', () => {
            const store = createStore();
            const cm = createCriteriaManager(100);
            const ctrl = new SelectionController(store, cm, nfs);
            ctrl.init();
            const spy = jest.spyOn(ctrl, 'closeReport');

            document.getElementById('closeSelectionReportBtn').click();

            expect(spy).toHaveBeenCalled();
        });

        test('closeSelectionReportModalBtn click closes report', () => {
            const store = createStore();
            const cm = createCriteriaManager(100);
            const ctrl = new SelectionController(store, cm, nfs);
            ctrl.init();
            const spy = jest.spyOn(ctrl, 'closeReport');

            document.getElementById('closeSelectionReportModalBtn').click();

            expect(spy).toHaveBeenCalled();
        });

        test('showRecommendationsBtn click shows recommendations', () => {
            const store = createStore();
            const cm = createCriteriaManager(100);
            const ctrl = new SelectionController(store, cm, nfs);
            ctrl.init();
            const spy = jest.spyOn(ctrl, 'showRecommendations');

            document.getElementById('showRecommendationsBtn').click();

            expect(spy).toHaveBeenCalled();
        });

        test('accordion toggle opens and closes content', () => {
            const store = createStore();
            const cm = createCriteriaManager(100);
            const ctrl = new SelectionController(store, cm, nfs);
            ctrl.init();

            const header = document.querySelector('.accordion-header');
            const content = document.querySelector('.accordion-content');
            const icon = document.querySelector('.accordion-icon');

            // Initially hidden
            expect(content.style.display).toBe('none');

            // Click to open
            header.click();
            expect(content.style.display).toBe('block');
            expect(icon.textContent).toBe('▼');

            // Click to close
            header.click();
            expect(content.style.display).toBe('none');
            expect(icon.textContent).toBe('▶');
        });

        test('handles missing autoSelectBtn gracefully', () => {
            document.getElementById('autoSelectBtn').remove();
            const store = createStore();
            const cm = createCriteriaManager(100);
            const ctrl = new SelectionController(store, cm, nfs);

            expect(() => ctrl.init()).not.toThrow();
        });

        test('handles missing selectionReportModal gracefully', () => {
            document.getElementById('selectionReportModal').remove();
            const store = createStore();
            const cm = createCriteriaManager(100);
            const ctrl = new SelectionController(store, cm, nfs);

            expect(() => ctrl.init()).not.toThrow();
        });
    });
});
