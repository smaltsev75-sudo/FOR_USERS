// js/controllers/selectionController.js

import { LruCache } from '../utils/lruCache.js';
import {
    ALGORITHM_KEYS
} from '../domain/selection/config.js';
import { renderSelectionReport } from '../ui/selectionReport.js';
import { renderRecommendations } from '../ui/selectionRecommendations.js';
import { hideModal } from '../ui/modalManager.js';
import { applyAlgorithm } from './selection/selectionApplyFlow.js';
import { wireSelectionControllerEvents } from './selection/selectionEventWiring.js';
import {
    calculateSelectionCapacityByRole,
    getCachedAlgorithmResults,
    runMultiSelection
} from './selection/selectionRunFlow.js';

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
    constructor(store, numberFormatService) {
        this.store = store;
        this.nfs = numberFormatService;
        this.multiSelectionResults = null;
        this.algorithmsCache = new LruCache(5);
    }

    init() {
        this.attachEvents();
    }

    attachEvents() {
        wireSelectionControllerEvents(this);
    }

    calculateCapacityByRole() {
        return calculateSelectionCapacityByRole(this.store);
    }

    getCachedAlgorithmResults(tasks, capacityByRole) {
        return getCachedAlgorithmResults(this.algorithmsCache, tasks, capacityByRole);
    }

    invalidateAlgorithmsCache() {
        this.algorithmsCache.clear();
    }

    /**
     * Запускает сравнение алгоритмов для текущих задач и ёмкостей.
     * Проверяет сумму весов критериев (=100%), затем делегирует run-flow.
     */
    runMultiSelection() {
        runMultiSelection(this);
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
        applyAlgorithm(this, algorithmKey);
    }

    closeReport() {
        const modal = document.getElementById('selectionReportModal');
        if (modal) hideModal(modal);
    }
}
