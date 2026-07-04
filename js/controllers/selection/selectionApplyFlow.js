import { messageService } from '../../services/message.js';
import { fixTaskOrder } from '../../domain/task.js';
import {
    EXCLUSION_REASON_ALGORITHM,
    EXCLUSION_REASON_CAPACITY_GUARD,
    EXCLUSION_REASON_DEPENDENCY
} from '../../domain/selection/config.js';
import { showSnackbar } from '../../ui/snackbar.js';
import { buildCapacitySafeSelection } from './selectionHelpers.js';

export function applyAlgorithm(controller, algorithmKey) {
    if (!controller.multiSelectionResults) return;

    const results = controller.multiSelectionResults.results;
    const algoResult = results[algorithmKey];
    if (!algoResult || !algoResult.selectedTasks) {
        messageService.showMessage('Нет результатов для выбранного алгоритма');
        return;
    }

    const state = controller.store.getState();
    const allTasks = state.tasks;
    const capacityByRole = controller.calculateCapacityByRole();
    const safety = buildCapacitySafeSelection(
        algoResult.selectedTasks,
        allTasks,
        capacityByRole,
        state.roles
    );
    const selectedIds = safety.selectedIds;
    const droppedIds = safety.droppedIds;
    // SELECT-1 refinement: dependency-cascade drops получают точную причину,
    // не ложное «превышение ёмкости».
    const depDroppedIds = safety.depDroppedIds || new Set();

    const updatedTasks = allTasks.map(task => {
        const isSelected = selectedIds.has(task.id);
        const reason = depDroppedIds.has(task.id)
            ? EXCLUSION_REASON_DEPENDENCY
            : droppedIds.has(task.id)
                ? EXCLUSION_REASON_CAPACITY_GUARD
                : (task.exclusionReason || EXCLUSION_REASON_ALGORITHM);
        return {
            ...task,
            excluded: isSelected ? 0 : 1,
            exclusionReason: isSelected ? '' : reason
        };
    });

    controller.store.setTaskFilter({ search: '', type: '' });
    controller.store.setTasks(fixTaskOrder(updatedTasks));
    // Запоминаем последний применённый алгоритм — переживёт F5.
    if (typeof controller.store.setUiState === 'function') {
        controller.store.setUiState({ activeAlgorithm: algorithmKey });
    }
    controller.invalidateAlgorithmsCache();

    controller.closeReport();
    // v2: модальное окно «Применён алгоритм…» убрано (owner) — результат виден
    // в списке. Snackbar показываем ТОЛЬКО при защитном дропе задач (важное
    // предупреждение), иначе тихо.
    if (droppedIds.size > 0) {
        const capacityDropped = droppedIds.size - depDroppedIds.size;
        const reasons = [];
        if (capacityDropped > 0) reasons.push(`по ёмкости: ${capacityDropped}`);
        if (depDroppedIds.size > 0) reasons.push(`по невыполненным зависимостям: ${depDroppedIds.size}`);
        showSnackbar(
            `Применён ${algoResult.algorithmName || algorithmKey}. Защитная проверка исключила задач (${reasons.join(', ')}).`,
            { duration: 6000 }
        );
    }
}
