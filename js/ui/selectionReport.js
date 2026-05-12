// js/ui/selectionReport.js
// Rendering functions for the multi-algorithm selection report modal.
//
// Архитектурные принципы:
//   - Только классы дизайн-системы (.rec-card, .accordion-*, .export-btn,
//     .best-value, .severity-*, .modal-*). Никаких inline-стилей в HTML.
//   - Иконки — inline-SVG из js/utils/icons.js, не эмодзи.
//   - Все user-input строки (task.title, task.reason) — через escapeHtml.
//
// Layout селектора отчёта:
//   1) Featured-баннер «Рекомендация» (.rec-card--featured)
//   2) Аккордеон «Об алгоритмах отбора»
//   3) Сетка карточек сравнения (.algo-cards-grid из 3×.rec-card--algo)
//   4) Кнопка «Рекомендации»
//   5) Аккордеоны «Детализация по алгоритмам»

import {
    areNearlyEqual,
    buildComparisonDisplayData,
    computeComparisonBestValues,
    pickRecommendedAlgorithm
} from '../controllers/selection/selectionHelpers.js';
import { ALGORITHM_KEYS } from '../domain/selection/config.js';
import { showModal } from './modalManager.js';
import { icon } from '../utils/icons.js';
import { escapeHtml } from '../utils/escapeHtml.js';

/** Human-readable names for each algorithm key. */
export const ALGORITHM_NAMES = {
    'matrix': 'Priority-Effort Matrix',
    'value-density': 'Value Density',
    'hybrid': 'Hybrid'
};

const ALGORITHM_ICON = {
    'matrix': 'layoutGrid',
    'value-density': 'gauge',
    'hybrid': 'scale'
};

const QUADRANT_DISPLAY = [
    { key: 'q1', icon: 'quadrant1', label: 'Q1 (высокий приоритет, малый effort)' },
    { key: 'q2', icon: 'quadrant2', label: 'Q2 (высокий приоритет, высокий effort)' },
    { key: 'q3', icon: 'quadrant3', label: 'Q3 (низкий приоритет, малый effort)' },
    { key: 'q4', icon: 'quadrant4', label: 'Q4 (низкий приоритет, высокий effort)' }
];

const APPLY_BUTTON_IDS = {
    'matrix': 'applyMatrixBtn',
    'value-density': 'applyValueDensityBtn',
    'hybrid': 'applyHybridBtn'
};

/**
 * Хинты к каждой метрике в карточках сравнения и в featured-баннере.
 * Формат: «что это» + «как интерпретировать / зачем смотреть».
 * Текст показывается через native `title="..."` (hover на десктопе,
 * long-press на сенсорных устройствах) и автоматически озвучивается
 * screen-reader'ами (с задержкой). Не должен повторять видимый label.
 * @type {Record<string, string>}
 */
export const METRIC_HINTS = {
    tasks: 'Сколько задач алгоритм отобрал в спринт. Сравните с числом задач, которое команда обычно успевает за период — если сильно меньше, значит критерии или ёмкости задают слишком жёсткий фильтр.',
    load: 'Доля плановой ёмкости команды, занятой отобранными задачами. ≤ 100% — всё уложилось. Чем ближе к 100%, тем плотнее заполнен спринт. > 100% означает, что алгоритм не уложился в ёмкость (редкий случай — обычно проверка ёмкости срабатывает раньше).',
    effort: 'Суммарные трудозатраты отобранных задач в часах. Должны быть ≤ общей ёмкости команды (см. Загрузку). Высокий Effort при невысокой Загрузке означает, что у команды больше плановой мощности.',
    priority: 'Сумма Priority Score всех отобранных задач. Главный целевой показатель отбора — чем выше, тем больше совокупной ценности (по вашим критериям с весами) попало в спринт.',
    density: 'Среднее значение Priority Score / Effort по отобранным задачам — «отдача» на час работы. Чем выше — тем эффективнее каждый час спринта вкладывается в ценность.'
};

const SECTION_HINTS = {
    descriptions: 'Краткое описание трёх алгоритмов с правилами сортировки внутри квадрантов. Раскройте, чтобы вспомнить логику — особенно полезно при сравнении неожиданных результатов.',
    details: 'Раскрывающиеся блоки по каждому алгоритму: какие задачи отобраны и в каком квадранте оказались, плюс список исключённых задач с причиной. Помогает понять, ПОЧЕМУ алгоритм получил именно такой результат.'
};

function algoDetailHint(algoName) {
    return `Состав спринта по алгоритму «${algoName}»: задачи по квадрантам Q1–Q4 в порядке отбора + список исключённых.`;
}

/**
 * Returns the CSS class for a recommendation severity level.
 * @param {string} severity
 * @returns {string}
 */
export function getSeverityClass(severity) {
    switch (severity) {
        case 'high': return 'severity-high';
        case 'medium': return 'severity-medium';
        case 'low': return 'severity-low';
        default: return 'severity-info';
    }
}

/**
 * Returns a human-readable hint for a severity level.
 * @param {string} severity
 * @returns {string}
 */
export function getSeverityHint(severity) {
    switch (severity) {
        case 'high': return 'Критическая перегрузка: превышение ёмкости > 100% + порог';
        case 'medium': return 'Существенное отклонение: недогрузка или значительный перегруз';
        case 'low': return 'Предупреждение: близко к перегрузке (95–100%)';
        case 'info': return 'Информационное сообщение';
        default: return '';
    }
}

function fmt1(n) {
    return Number(n).toFixed(1).replace('.', ',');
}

function fmt2(n) {
    return Number(n).toFixed(2).replace('.', ',');
}

/** Цветовой акцент полосы загрузки: близко к 100 — success, перегруз — danger. */
function loadBarFillClass(loadPct) {
    if (loadPct > 100) return 'metric-bar__fill--danger';
    if (loadPct >= 90) return 'metric-bar__fill--success';
    if (loadPct < 60) return 'metric-bar__fill--warning';
    return '';
}

/** Нормирует значение к процентам ширины относительно best (0…100). */
function ratioPct(value, best) {
    if (!best || best <= 0) return 0;
    const pct = Math.round((value / best) * 100);
    if (pct < 0) return 0;
    if (pct > 100) return 100;
    return pct;
}

/**
 * Featured-баннер с рекомендованным алгоритмом.
 * @param {Object} recommended - элемент comparableData
 * @returns {string}
 */
function buildRecommendationBannerHtml(recommended) {
    if (!recommended) return '';
    const name = escapeHtml(recommended.name);
    const tasksLabel = `${recommended.tasksCount} задач`;
    const loadLabel = `${fmt1(recommended.displayLoad)}% загрузка`;
    const priorityLabel = `Priority Score: ${fmt1(recommended.displayPriority)}`;
    const densityLabel = `Плотность: ${fmt2(recommended.displayDensity)}`;

    return `
<div class="rec-card rec-card--featured" data-recommended="${escapeHtml(recommended.algo)}">
    <div class="rec-card-header">
        <span class="rec-card-title">${icon('check')} Рекомендация: ${name}</span>
        <span class="algo-card-marker">Лучший выбор</span>
    </div>
    <div class="rec-card-body">
        Оптимальный баланс между объёмом отбора и суммарной ценностью при текущих ёмкостях команды.
    </div>
    <div class="rec-card-metrics">
        <span class="best-value" title="${escapeHtml(METRIC_HINTS.tasks)}">${escapeHtml(tasksLabel)}</span>
        <span class="best-value" title="${escapeHtml(METRIC_HINTS.load)}">${escapeHtml(loadLabel)}</span>
        <span class="best-value" title="${escapeHtml(METRIC_HINTS.priority)}">${escapeHtml(priorityLabel)}</span>
        <span class="best-value" title="${escapeHtml(METRIC_HINTS.density)}">${escapeHtml(densityLabel)}</span>
    </div>
</div>`;
}

/**
 * Аккордеон с описанием алгоритмов.
 * @returns {string}
 */
function buildAlgorithmDescriptionsHtml() {
    return `
<div class="accordion-item">
    <div class="accordion-header" title="${escapeHtml(SECTION_HINTS.descriptions)}">
        <span class="accordion-icon">▶</span>
        ${icon('bookOpen')}
        <strong>Об алгоритмах отбора</strong>
    </div>
    <div class="accordion-content" hidden>
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

/**
 * Одна карточка алгоритма с метриками.
 * @param {Object} item       - элемент comparableData
 * @param {Object} bestValues - результат computeComparisonBestValues
 * @param {string} recommendedKey
 * @returns {string}
 */
function buildAlgorithmCardHtml(item, bestValues, recommendedKey) {
    const { bestTasks, bestLoadDiff, bestEffort, bestPriority, bestDensity } = bestValues;

    const isBestTasks   = item.tasksCount === bestTasks;
    const isBestLoad    = areNearlyEqual(Math.abs(item.displayLoad - 100), bestLoadDiff);
    const isBestEffort  = areNearlyEqual(item.displayEffort, bestEffort);
    const isBestPriority = areNearlyEqual(item.displayPriority, bestPriority);
    const isBestDensity = areNearlyEqual(item.displayDensity, bestDensity);

    const isRecommended = item.algo === recommendedKey;

    const tasksPct    = ratioPct(item.tasksCount, bestTasks);
    const loadPct     = Math.min(100, Math.max(0, item.displayLoad));
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
            <span class="algo-card-metric-value">${wrap(`${fmt1(item.displayLoad)}%`, isBestLoad)}</span>
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
</div>`;
}

/**
 * Сетка карточек для всех алгоритмов.
 * Класс `comparison-table` сохранён как hook (для обратной совместимости с
 * другими местами, которые могут на него опираться в будущем — обнаружение
 * "это блок сравнения алгоритмов"). Стили на нём остаются для legacy и не
 * мешают новой раскладке.
 *
 * @param {Array} comparableData
 * @param {Object} bestValues
 * @param {string|null} recommendedKey
 * @returns {string}
 */
function buildAlgorithmCardsHtml(comparableData, bestValues, recommendedKey) {
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
        inner += `</ul>`;
    }

    return `
<div class="accordion-item algorithm-detail" data-algorithm="${escapeHtml(algo)}">
    <div class="accordion-header" title="${escapeHtml(algoDetailHint(displayName))}">
        <span class="accordion-icon">▶</span>
        ${icon(ALGORITHM_ICON[algo] || 'barChart')}
        <strong>${escapeHtml(displayName)}</strong>
    </div>
    <div class="accordion-content" hidden>${inner}</div>
</div>`;
}

/**
 * Аккордеоны по каждому алгоритму.
 */
function buildAlgorithmDetailsHtml(results, comparison, algorithms) {
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
function buildRecommendationsButtonHtml() {
    return `
<div class="report-section-actions">
    <button id="showRecommendationsBtn" type="button" class="export-btn">
        ${icon('clipboardList')}
        Рекомендации
    </button>
</div>`;
}

/**
 * Подсвечивает кнопку рекомендованного алгоритма как primary, остальные —
 * как нейтральные. IDs кнопок остаются прежними (применяются в e2e и в
 * controller-логике через делегирование), меняется только classList.
 *
 * @param {string|null} recommendedKey
 */
function highlightRecommendedApplyButton(recommendedKey) {
    Object.entries(APPLY_BUTTON_IDS).forEach(([key, id]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const isRecommended = key === recommendedKey;
        btn.classList.remove('primary', 'export-btn--success');
        btn.classList.add('export-btn');
        if (isRecommended) {
            btn.classList.add('primary');
        }
        btn.setAttribute('aria-pressed', isRecommended ? 'true' : 'false');
    });
}

/**
 * Renders the full selection report into the `#selectionReportContent` element
 * and shows the `#selectionReportModal`.
 *
 * @param {Object} multiSelectionResults - { results, comparison }
 * @param {string[]} [algorithms] - algorithm keys to display (defaults to ALGORITHM_KEYS)
 * @returns {boolean} true if rendered successfully
 */
export function renderSelectionReport(multiSelectionResults, algorithms = ALGORITHM_KEYS) {
    if (!multiSelectionResults) return false;

    const { results, comparison } = multiSelectionResults;
    const contentEl = document.getElementById('selectionReportContent');
    if (!contentEl) return false;

    const comparableData = buildComparisonDisplayData(results, comparison, algorithms);

    if (comparableData.length === 0) {
        contentEl.innerHTML = '<div class="report-empty-state">Нет данных для отображения</div>';
        highlightRecommendedApplyButton(null);
        const modal = document.getElementById('selectionReportModal');
        if (modal) showModal(modal);
        return true;
    }

    const bestValues = computeComparisonBestValues(comparableData);
    const recommended = pickRecommendedAlgorithm(comparableData);
    const recommendedKey = recommended ? recommended.algo : null;

    contentEl.innerHTML = [
        buildRecommendationBannerHtml(recommended),
        buildAlgorithmDescriptionsHtml(),
        buildAlgorithmCardsHtml(comparableData, bestValues, recommendedKey),
        buildRecommendationsButtonHtml(),
        buildAlgorithmDetailsHtml(results, comparison, algorithms)
    ].join('');

    highlightRecommendedApplyButton(recommendedKey);

    contentEl.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', function () {
            const content = this.nextElementSibling;
            if (content && content.classList.contains('accordion-content')) {
                const isHidden = content.hasAttribute('hidden') || content.style.display === 'none';
                if (isHidden) {
                    content.removeAttribute('hidden');
                    content.style.display = 'block';
                } else {
                    content.setAttribute('hidden', '');
                    content.style.display = 'none';
                }
                const iconEl = this.querySelector('.accordion-icon');
                if (iconEl) iconEl.textContent = isHidden ? '▼' : '▶';
            }
        });
    });

    const modal = document.getElementById('selectionReportModal');
    if (modal) showModal(modal);

    return true;
}
