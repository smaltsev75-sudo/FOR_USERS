import { areNearlyEqual } from '../../domain/selection/comparisonDisplay.js';
import { clampPercentWidth, formatUiPercent } from '../../utils/percent.js';
import { escapeHtml } from '../../utils/escapeHtml.js';
import { icon } from '../../utils/icons.js';
import {
    ALGORITHM_ICON,
    ALGORITHM_NAMES,
    APPLY_BUTTON_IDS,
    METRIC_HINTS,
    QUADRANT_DISPLAY,
    SECTION_HINTS,
    algoDetailHint
} from './constants.js';
import { fmt1, fmt2, loadBarFillClass, ratioPct } from './format.js';

/**
 * Аккордеон с описанием алгоритмов.
 * @returns {string}
 */
export function buildAlgorithmDescriptionsHtml() {
    return `
<div class="accordion-item">
    <button type="button" class="accordion-header" aria-expanded="false" aria-controls="algoDescriptionsPanel" title="${escapeHtml(SECTION_HINTS.descriptions)}">
        <span class="accordion-icon">▶</span>
        ${icon('bookOpen')}
        <strong>Об алгоритмах отбора</strong>
    </button>
    <div id="algoDescriptionsPanel" class="accordion-content" hidden>
        <div class="algo-info-grid">
            <div class="algo-info-card">
                <div class="algo-info-card-title">Priority-Effort Matrix</div>
                <p class="algo-info-card-body">
                    Задачи делятся на 4 квадранта относительно медиан приоритета (Priority Score) и трудозатрат (Effort).<br>
                    <strong>Порядок отбора:</strong> Q1 → Q2 → Q3 → Q4.<br>
                    <strong>Q1</strong> (высокий приоритет, малые трудозатраты): сортируются по убыванию приоритета.<br>
                    <strong>Q2</strong> (высокий приоритет, большие трудозатраты): сортируются по возрастанию трудозатрат; при равных — по убыванию приоритета.<br>
                    <strong>Q3</strong> (низкий приоритет, малые трудозатраты): сортируются по убыванию приоритета.<br>
                    <strong>Q4</strong> (низкий приоритет, большие трудозатраты): сортируются по убыванию приоритета.<br>
                    <em>Примечание: Q4 рассматривается в последнюю очередь, если остались ресурсы.</em>
                </p>
            </div>
            <div class="algo-info-card">
                <div class="algo-info-card-title">Value Density</div>
                <p class="algo-info-card-body">
                    Для каждой задачи вычисляется плотность ценности = Priority Score / Effort.<br>
                    Задачи сортируются по убыванию плотности; при равной плотности — по убыванию приоритета.<br>
                    Отбор ведётся последовательно сверху вниз с проверкой доступных ёмкостей.<br>
                    Максимизирует суммарный приоритет при заданных ресурсах.
                </p>
            </div>
            <div class="algo-info-card">
                <div class="algo-info-card-title">Hybrid</div>
                <p class="algo-info-card-body">
                    Комбинирует матричную классификацию и плотность ценности.<br>
                    <strong>Порядок отбора:</strong> Q1 → Q2 → Q3 → Q4.<br>
                    <strong>Q1 и Q2</strong> сортируются по убыванию плотности ценности; при равной плотности — по убыванию приоритета.<br>
                    <strong>Q3 и Q4</strong> сортируются по убыванию приоритета.<br>
                    <em>Примечание: Q4 рассматривается только после исчерпания всех остальных квадрантов.</em>
                </p>
            </div>
        </div>
        <p class="algo-info-footnote">
            Медианы приоритета и трудозатрат вычисляются один раз перед началом отбора по всем задачам-кандидатам.
            Все методы строго соблюдают ёмкость каждой роли и общую ёмкость команды.
        </p>
    </div>
</div>`;
}

function buildApplyButtonHtml(item) {
    const id = APPLY_BUTTON_IDS[item.algo];
    if (!id) return '';
    const shortName = item.algo === 'value-density' ? 'Value Density'
        : item.algo === 'hybrid' ? 'Hybrid'
            : 'Matrix';
    return `
    <div class="algo-card-actions">
        <button id="${id}" type="button" class="export-btn export-btn--select-algorithm" data-algorithm="${escapeHtml(item.algo)}" aria-label="Применить алгоритм ${escapeHtml(item.name)}">
            ${icon('check')}
            <span>Применить ${escapeHtml(shortName)}</span>
        </button>
    </div>`;
}

/**
 * Одна карточка алгоритма с метриками.
 * @param {Object} item       - элемент comparableData
 * @param {Object} bestValues - результат computeComparisonBestValues
 * @param {string} recommendedKey
 * @returns {string}
 */
export function buildAlgorithmCardHtml(item, bestValues, recommendedKey) {
    const { bestTasks, bestLoadDiff, bestEffort, bestPriority, bestDensity } = bestValues;

    const isBestTasks   = item.tasksCount === bestTasks;
    const isBestLoad    = areNearlyEqual(Math.abs(item.displayLoad - 100), bestLoadDiff);
    const isBestEffort  = areNearlyEqual(item.displayEffort, bestEffort);
    const isBestPriority = areNearlyEqual(item.displayPriority, bestPriority);
    const isBestDensity = areNearlyEqual(item.displayDensity, bestDensity);

    const isRecommended = item.algo === recommendedKey;

    const tasksPct    = ratioPct(item.tasksCount, bestTasks);
    const loadPct     = clampPercentWidth(item.displayLoad);
    const effortPct   = ratioPct(item.displayEffort, bestEffort);
    const priorityPct = ratioPct(item.displayPriority, bestPriority);
    const densityPct  = ratioPct(item.displayDensity, bestDensity);

    const algoIcon = icon(ALGORITHM_ICON[item.algo] || 'barChart');
    const cardClasses = ['rec-card', 'rec-card--algo'];
    if (isRecommended) cardClasses.push('rec-card--recommended');

    const wrap = (raw, isBest) => isBest
        ? `<span class="best-value">${raw}</span>`
        : raw;

    return `
<div class="${cardClasses.join(' ')}" data-algorithm="${escapeHtml(item.algo)}">
    <div class="rec-card-header">
        <span class="rec-card-title">${algoIcon}<span>${escapeHtml(item.name)}</span></span>
        ${isRecommended ? '<span class="algo-card-marker">Рекомендовано</span>' : ''}
    </div>
    <div class="algo-card-metrics">
        <div class="algo-card-metric" title="${escapeHtml(METRIC_HINTS.tasks)}">
            <span class="algo-card-metric-label">Выбрано задач</span>
            <span class="algo-card-metric-value">${wrap(String(item.tasksCount), isBestTasks)}</span>
            <span class="metric-bar"><span class="metric-bar__fill" style="width:${tasksPct}%"></span></span>
        </div>
        <div class="algo-card-metric" title="${escapeHtml(METRIC_HINTS.load)}">
            <span class="algo-card-metric-label">Загрузка</span>
            <span class="algo-card-metric-value">${wrap(`${formatUiPercent(item.displayLoad)}%`, isBestLoad)}</span>
            <span class="metric-bar"><span class="metric-bar__fill ${loadBarFillClass(item.displayLoad)}" style="width:${loadPct}%"></span></span>
        </div>
        <div class="algo-card-metric" title="${escapeHtml(METRIC_HINTS.effort)}">
            <span class="algo-card-metric-label">Сумм. Effort, ч</span>
            <span class="algo-card-metric-value">${wrap(fmt1(item.displayEffort), isBestEffort)}</span>
            <span class="metric-bar"><span class="metric-bar__fill" style="width:${effortPct}%"></span></span>
        </div>
        <div class="algo-card-metric" title="${escapeHtml(METRIC_HINTS.priority)}">
            <span class="algo-card-metric-label">Сумм. Priority Score</span>
            <span class="algo-card-metric-value">${wrap(fmt1(item.displayPriority), isBestPriority)}</span>
            <span class="metric-bar"><span class="metric-bar__fill" style="width:${priorityPct}%"></span></span>
        </div>
        <div class="algo-card-metric" title="${escapeHtml(METRIC_HINTS.density)}">
            <span class="algo-card-metric-label">Ср. плотность</span>
            <span class="algo-card-metric-value">${wrap(fmt2(item.displayDensity), isBestDensity)}</span>
            <span class="metric-bar"><span class="metric-bar__fill" style="width:${densityPct}%"></span></span>
        </div>
    </div>
    ${buildApplyButtonHtml(item)}
</div>`;
}

/**
 * Сетка карточек для всех алгоритмов.
 * @param {Array} comparableData
 * @param {Object} bestValues
 * @param {string|null} recommendedKey
 * @returns {string}
 */
export function buildAlgorithmCardsHtml(comparableData, bestValues, recommendedKey) {
    const cards = comparableData
        .map(item => buildAlgorithmCardHtml(item, bestValues, recommendedKey))
        .join('');
    return `
<h2 class="report-section-title">Сравнение алгоритмов</h2>
<div class="algo-cards-grid">
${cards}
</div>`;
}

/**
 * Аккордеон детализации одного алгоритма.
 */
function buildSingleAlgorithmDetailHtml(algo, res, displayName) {
    let inner = '';

    if (res.quadrants) {
        QUADRANT_DISPLAY.forEach(q => {
            const tasks = res.quadrants[q.key] || [];
            if (tasks.length === 0) return;

            inner += `
            <div class="algo-detail-section">
                <div class="algo-detail-quadrant-title">${icon(q.icon)}${escapeHtml(q.label)}</div>
                <ul class="algo-detail-list">`;
            tasks.forEach(task => {
                const title = escapeHtml(task.title || 'Без названия');
                const priority = fmt1(task.priorityScore || 0);
                const effort = fmt1(task.effort || 0);
                inner += `<li>${title} <span class="algo-detail-meta">(Priority Score: ${priority} / Effort: ${effort} ч)</span></li>`;
            });
            inner += `</ul>
            </div>`;
        });
    }

    if (res.excludedTasks && res.excludedTasks.length > 0) {
        inner += `
            <div class="algo-detail-excluded-title">${icon('alertCircle')}Исключено (${res.excludedTasks.length})</div>
            <ul class="algo-detail-excluded-list">`;
        res.excludedTasks.forEach(task => {
            const title = escapeHtml(task.title || 'Без названия');
            const reason = escapeHtml(task.reason || 'Неизвестная причина');
            inner += `<li>${title} — <span class="algo-detail-reason">${reason}</span></li>`;
        });
        inner += '</ul>';
    }

    const panelId = `algoDetail_${algo}`;
    return `
<div class="accordion-item algorithm-detail" data-algorithm="${escapeHtml(algo)}">
    <button type="button" class="accordion-header" aria-expanded="false" aria-controls="${panelId}" title="${escapeHtml(algoDetailHint(displayName))}">
        <span class="accordion-icon">▶</span>
        ${icon(ALGORITHM_ICON[algo] || 'barChart')}
        <strong>${escapeHtml(displayName)}</strong>
    </button>
    <div id="${panelId}" class="accordion-content" hidden>${inner}</div>
</div>`;
}

/**
 * Аккордеоны по каждому алгоритму.
 */
export function buildAlgorithmDetailsHtml(results, comparison, algorithms) {
    const items = algorithms
        .map(algo => {
            const res = results[algo];
            if (!res || res.error) return '';
            const algoName = comparison[algo]?.algorithmName || ALGORITHM_NAMES[algo] || algo;
            return buildSingleAlgorithmDetailHtml(algo, res, algoName);
        })
        .filter(Boolean)
        .join('');

    return `
<h3 class="report-section-title report-section-title--sub">Детализация по алгоритмам</h3>
${items}`;
}

/**
 * Кнопка показа рекомендаций.
 */
export function buildRecommendationsButtonHtml() {
    return `
<div class="report-section-actions">
    <button id="showRecommendationsBtn" type="button" class="export-btn">
        ${icon('clipboardList')}
        Рекомендации
    </button>
</div>`;
}
