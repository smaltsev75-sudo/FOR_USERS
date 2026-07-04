import { messageService } from '../../services/message.js';
import { calculateCapacityByRole, calculateRoleLoad } from '../../domain/role.js';
import { compareAlgorithms } from '../../domain/selection/index.js';
import { getTotalWeight } from '../../domain/criteriaOps.js';
import {
    buildAlgorithmsCacheKey,
    buildTasksWithPriority,
    setSelectionLoadingState
} from './selectionHelpers.js';

export function calculateSelectionCapacityByRole(store) {
    const state = store.getState();
    const { roles, config } = state;
    return calculateCapacityByRole(roles, config);
}

export function getCachedAlgorithmResults(cache, tasks, capacityByRole) {
    const cacheKey = buildAlgorithmsCacheKey(tasks, capacityByRole);
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;

    const results = compareAlgorithms(tasks, capacityByRole);
    cache.set(cacheKey, results);
    return results;
}

export function runMultiSelection(controller) {
    // Проверка суммы весов критериев — должна быть ровно 100%
    const criteria = controller.store.getState().criteria || [];
    const totalWeight = getTotalWeight(criteria);
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

    const originalTasks = controller.store.getState().tasks;
    const capacityByRole = controller.calculateCapacityByRole();

    // v8.30.9: precondition — если ни одна роль не перегружена (effort > capacity)
    // по текущему плану (не-исключённые задачи), показываем info и НЕ запускаем
    // алгоритмы. Сравнение строгое (>), без alert_threshold — порог влияет только
    // на UI-подсветку capacity-strip, не на бизнес-решение «нужен ли отбор».
    const roles = controller.store.getState().roles;
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

    const tasksWithPriority = buildTasksWithPriority(originalTasks, criteria);

    try {
        const comparisonResult = controller.getCachedAlgorithmResults(tasksWithPriority, capacityByRole);
        controller.multiSelectionResults = comparisonResult;
    } catch (e) {
        messageService.showMessage('Ошибка при выполнении алгоритма: ' + e.message);
        setSelectionLoadingState(loadingEl, autoSelectBtn, false);
        return;
    }

    setSelectionLoadingState(loadingEl, autoSelectBtn, false);

    controller.showMultiSelectionReport();
}
