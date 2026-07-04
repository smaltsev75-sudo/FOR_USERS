import { escapeHtml } from '../../../utils/escapeHtml.js';
import { icon } from '../../../utils/icons.js';

function readTaskId(task) {
    const id = task?.rawTask?.id ?? task?.id;
    if (id === null || id === undefined || id === '') return null;
    return String(id);
}

function buildSelectedSignature(tasks, sortIds = false) {
    const ids = (Array.isArray(tasks) ? tasks : [])
        .map(readTaskId)
        .filter(id => id !== null);
    if (sortIds) ids.sort((left, right) => left.localeCompare(right));
    return ids.join('\u0001');
}

function collectComparableAlgorithmSets(results, algorithms) {
    return algorithms
        .map(algo => {
            const result = results?.[algo];
            if (!result || result.error || !Array.isArray(result.selectedTasks)) return null;
            return {
                algo,
                selectedTasks: result.selectedTasks,
                selectedSetSignature: buildSelectedSignature(result.selectedTasks, true),
                selectedOrderSignature: buildSelectedSignature(result.selectedTasks, false),
                activeRejections: (Array.isArray(result.excludedTasks) ? result.excludedTasks : [])
                    .filter(task => task && !task.excluded)
            };
        })
        .filter(Boolean);
}

function collectCommonActiveRejections(entries) {
    if (entries.length === 0) return [];

    const allRejectedIdSets = entries.map(entry => new Set(entry.activeRejections.map(readTaskId).filter(id => id !== null)));
    return entries[0].activeRejections
        .map(task => ({
            id: readTaskId(task),
            title: task.title || task.rawTask?.title || 'Без названия',
            reason: task.reason || 'Неизвестная причина'
        }))
        .filter(task => task.id !== null && allRejectedIdSets.every(set => set.has(task.id)));
}

export function buildAlgorithmSetInsightData(results, algorithms) {
    const entries = collectComparableAlgorithmSets(results, algorithms || []);
    if (entries.length < 2) return null;

    const [first] = entries;
    const sameSelectedSet = entries.every(entry => entry.selectedSetSignature === first.selectedSetSignature);
    const sameSelectedOrder = entries.every(entry => entry.selectedOrderSignature === first.selectedOrderSignature);

    return {
        algorithms: entries.map(entry => entry.algo),
        sameSelectedSet,
        sameSelectedOrder,
        selectedCount: first.selectedTasks.length,
        commonActiveRejections: collectCommonActiveRejections(entries)
    };
}

export function buildAlgorithmSetInsightHtml(insight) {
    if (!insight?.sameSelectedSet) return '';

    const count = Number(insight.selectedCount) || 0;
    const orderText = insight.sameSelectedOrder
        ? 'Порядок рассмотрения также совпал.'
        : 'Состав одинаковый, но порядок рассмотрения различается.';

    const rejections = Array.isArray(insight.commonActiveRejections)
        ? insight.commonActiveRejections.slice(0, 2)
        : [];
    const rejectedHtml = rejections.length > 0
        ? `
        <ul class="algo-set-insight__list">
            ${rejections.map(task => `
            <li>
                <span>${escapeHtml(task.title || 'Без названия')}</span>
                <span class="algo-set-insight__reason">${escapeHtml(task.reason || 'Неизвестная причина')}</span>
            </li>`).join('')}
        </ul>`
        : '';

    return `
<div class="algo-set-insight" role="note">
    <div class="algo-set-insight__title">
        ${icon('check')}
        <strong>Состав совпал</strong>
    </div>
    <p>Все алгоритмы выбрали один и тот же набор: ${count} задач. ${escapeHtml(orderText)}</p>
    ${rejectedHtml}
</div>`;
}
