// js/controllers/selectionController.js

import { messageService } from '../services/message.js';
import { calculateCapacityByRole } from '../domain/role.js';
import { compareAlgorithms } from '../domain/selection/index.js';
import { fixTaskOrder } from '../domain/task.js';
import {
    buildAlgorithmsCacheKey,
    buildTasksWithPriority,
    setSelectionLoadingState
} from './selection/selectionHelpers.js';
import { LruCache } from '../utils/lruCache.js';
import { ALGORITHM_KEYS } from '../domain/selection/config.js';
import { renderSelectionReport } from '../ui/selectionReport.js';
import { renderRecommendations } from '../ui/selectionRecommendations.js';
import { hideModal } from '../ui/modalManager.js';

/**
 * SelectionController — контроллер автоотбора задач в спринт.
 *
 * Отвечает за:
 * - Запуск сравнения 3 алгоритмов (Matrix, Value Density, Hybrid)
 * - Кэширование результатов через LruCache
 * - Отображение отчёта и рекомендаций
 * - Применение выбранного алгоритма к списку задач
 */
export class SelectionController {
    constructor(store, criteriaManager, numberFormatService) {
        this.store = store;
        this.criteriaManager = criteriaManager;
        this.nfs = numberFormatService;
        this.multiSelectionResults = null;
        this.algorithmsCache = new LruCache(5);
    }

    init() {
        this.attachEvents();
    }

    attachEvents() {
        const autoSelectBtn = document.getElementById('autoSelectBtn');
        if (autoSelectBtn) {
            autoSelectBtn.addEventListener('click', () => this.runMultiSelection());
        }

        const modal = document.getElementById('selectionReportModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                const target = e.target;
                if (target.id === 'applyMatrixBtn') {
                    this.applyAlgorithm('matrix');
                } else if (target.id === 'applyValueDensityBtn') {
                    this.applyAlgorithm('value-density');
                } else if (target.id === 'applyHybridBtn') {
                    this.applyAlgorithm('hybrid');
                } else if (target.id === 'closeSelectionReportBtn' || target.id === 'closeSelectionReportModalBtn') {
                    this.closeReport();
                } else if (target.id === 'showRecommendationsBtn') {
                    this.showRecommendations();
                } else if (target.classList.contains('accordion-header')) {
                    const content = target.nextElementSibling;
                    if (content && content.classList.contains('accordion-content')) {
                        const isHidden = content.style.display === 'none';
                        content.style.display = isHidden ? 'block' : 'none';
                        const icon = target.querySelector('.accordion-icon');
                        if (icon) icon.textContent = isHidden ? '▼' : '▶';
                    }
                }
            });
        }
    }

    calculateCapacityByRole() {
        const state = this.store.getState();
        const { roles, config } = state;
        return calculateCapacityByRole(roles, config);
    }

    getCachedAlgorithmResults(tasks, capacityByRole) {
        const cacheKey = buildAlgorithmsCacheKey(tasks, capacityByRole);
        const cached = this.algorithmsCache.get(cacheKey);
        if (cached !== undefined) return cached;
        const results = compareAlgorithms(tasks, capacityByRole);
        this.algorithmsCache.set(cacheKey, results);
        return results;
    }

    invalidateAlgorithmsCache() {
        this.algorithmsCache.clear();
    }

    /**
     * Запускает сравнение алгоритмов для текущих задач и ёмкостей.
     * Проверяет сумму весов критериев (=100%), затем вызывает compareAlgorithms.
     */
    runMultiSelection() {
        // Проверка суммы весов критериев — должна быть ровно 100%
        const totalWeight = this.criteriaManager.getTotalWeight();
        if (totalWeight !== 100) {
            const direction = totalWeight > 100 ? 'превышает' : 'не достигает';
            messageService.showMessage(
                'Невозможно выполнить отбор: сумма весов критериев (' + totalWeight + '%) ' + direction + ' 100%. ' +
                'Пожалуйста, отредактируйте веса критериев на вкладке "Критерии оценки" так, чтобы их сумма составляла ровно 100%.'
            );
            setSelectionLoadingState(
                document.getElementById('selectionLoadingIndicator'),
                document.getElementById('autoSelectBtn'),
                false
            );
            return;
        }

        const loadingEl = document.getElementById('selectionLoadingIndicator');
        const autoSelectBtn = document.getElementById('autoSelectBtn');

        setSelectionLoadingState(loadingEl, autoSelectBtn, true);

        const originalTasks = this.store.getState().tasks;
        const capacityByRole = this.calculateCapacityByRole();

        const tasksWithPriority = buildTasksWithPriority(originalTasks, this.criteriaManager, this.store.getState().roles);

        try {
            const comparisonResult = this.getCachedAlgorithmResults(tasksWithPriority, capacityByRole);
            this.multiSelectionResults = comparisonResult;
        } catch (e) {
            messageService.showMessage('Ошибка при выполнении алгоритма: ' + e.message);
            setSelectionLoadingState(loadingEl, autoSelectBtn, false);
            return;
        }

        setSelectionLoadingState(loadingEl, autoSelectBtn, false);

        this.showMultiSelectionReport();
    }

    showMultiSelectionReport() {
        if (!this.multiSelectionResults) return;
        // Кнопка showRecommendationsBtn обрабатывается через делегацию в attachEvents
        renderSelectionReport(this.multiSelectionResults, ALGORITHM_KEYS);
    }

    showRecommendations() {
        if (!this.multiSelectionResults) return;
        const capacityByRole = this.calculateCapacityByRole();
        renderRecommendations(this.multiSelectionResults, capacityByRole, ALGORITHM_KEYS);
    }

    /**
     * Применяет результат алгоритма: отмечает исключённые задачи в store.
     * @param {string} algorithmKey — 'matrix' | 'value-density' | 'hybrid'
     */
    applyAlgorithm(algorithmKey) {
        if (!this.multiSelectionResults) return;

        const results = this.multiSelectionResults.results;
        const algoResult = results[algorithmKey];
        if (!algoResult || !algoResult.selectedTasks) {
            messageService.showMessage('Нет результатов для выбранного алгоритма');
            return;
        }

        const allTasks = this.store.getState().tasks;
        const selectedIds = new Set(algoResult.selectedTasks.map(t => t.rawTask?.id || t.id));

        const updatedTasks = allTasks.map(task => {
            const isSelected = selectedIds.has(task.id);
            return {
                ...task,
                excluded: isSelected ? 0 : 1,
                exclusionReason: isSelected ? '' : (task.exclusionReason || 'Исключена алгоритмом')
            };
        });

        this.store.setTaskFilter({ search: '', type: '' });
        this.store.setTasks(fixTaskOrder(updatedTasks));
        this.invalidateAlgorithmsCache();

        this.closeReport();
        messageService.showMessage(`Применён алгоритм: ${algoResult.algorithmName || algorithmKey}`);
    }

    closeReport() {
        const modal = document.getElementById('selectionReportModal');
        if (modal) hideModal(modal);
    }
}
