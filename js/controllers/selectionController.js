// js/controllers/selectionController.js

import { messageService } from '../services/message.js';
import { calculateCapacityByRole, calculateRoleLoad } from '../domain/role.js';
import { compareAlgorithms } from '../domain/selection/index.js';
import { fixTaskOrder } from '../domain/task.js';
import {
    buildAlgorithmsCacheKey,
    buildCapacitySafeSelection,
    buildTasksWithPriority,
    setSelectionLoadingState
} from './selection/selectionHelpers.js';
import { LruCache } from '../utils/lruCache.js';
import {
    ALGORITHM_KEYS,
    EXCLUSION_REASON_ALGORITHM,
    EXCLUSION_REASON_CAPACITY_GUARD
} from '../domain/selection/config.js';
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
                }
                // .accordion-header обрабатывается локальным listener'ом,
                // навешенным в renderSelectionReport — здесь делегация
                // больше не нужна (дублировала бы toggle при bubbling).
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

        const originalTasks = this.store.getState().tasks;
        const capacityByRole = this.calculateCapacityByRole();

        // v8.30.9: precondition — если ни одна роль не перегружена (effort > capacity)
        // по текущему плану (не-исключённые задачи), показываем info и НЕ запускаем
        // алгоритмы. Сравнение строгое (>), без alert_threshold — порог влияет только
        // на UI-подсветку capacity-strip, не на бизнес-решение «нужен ли отбор».
        const roles = this.store.getState().roles;
        const overloadedRoles = roles.filter(role => {
            const load = calculateRoleLoad(role.id, originalTasks, false);
            const cap = capacityByRole[role.id] || 0;
            return load > cap;
        });
        if (overloadedRoles.length === 0) {
            messageService.showMessage('Текущий состав спринта уже сбалансирован, корректировка не требуется');
            return;
        }

        setSelectionLoadingState(loadingEl, autoSelectBtn, true);

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

        const state = this.store.getState();
        const allTasks = state.tasks;
        const capacityByRole = this.calculateCapacityByRole();
        const safety = buildCapacitySafeSelection(
            algoResult.selectedTasks,
            allTasks,
            capacityByRole,
            state.roles
        );
        const selectedIds = safety.selectedIds;
        const droppedIds = safety.droppedIds;

        const updatedTasks = allTasks.map(task => {
            const isSelected = selectedIds.has(task.id);
            const wasDroppedBySafety = droppedIds.has(task.id);
            return {
                ...task,
                excluded: isSelected ? 0 : 1,
                exclusionReason: isSelected
                    ? ''
                    : (wasDroppedBySafety ? EXCLUSION_REASON_CAPACITY_GUARD : (task.exclusionReason || EXCLUSION_REASON_ALGORITHM))
            };
        });

        this.store.setTaskFilter({ search: '', type: '' });
        this.store.setTasks(fixTaskOrder(updatedTasks));
        // Запоминаем последний применённый алгоритм — переживёт F5.
        if (typeof this.store.setUiState === 'function') {
            this.store.setUiState({ activeAlgorithm: algorithmKey });
        }
        this.invalidateAlgorithmsCache();

        this.closeReport();
        const safetySuffix = droppedIds.size > 0
            ? `. Защитная проверка дополнительно исключила задач: ${droppedIds.size}, чтобы не превысить ёмкость.`
            : '';
        messageService.showMessage(`Применён алгоритм: ${algoResult.algorithmName || algorithmKey}${safetySuffix}`);
    }

    closeReport() {
        const modal = document.getElementById('selectionReportModal');
        if (modal) hideModal(modal);
    }
}
