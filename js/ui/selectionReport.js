// js/ui/selectionReport.js
// Rendering functions for the multi-algorithm selection report modal.

import { areNearlyEqual, buildComparisonDisplayData, computeComparisonBestValues } from '../controllers/selection/selectionHelpers.js';
import { ALGORITHM_KEYS } from '../domain/selection/config.js';
import { showModal } from './modalManager.js';

/** Human-readable names for each algorithm key. */
export const ALGORITHM_NAMES = {
    'matrix': 'Priority-Effort Matrix',
    'value-density': 'Value Density',
    'hybrid': 'Hybrid'
};

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

/**
 * Builds the HTML for the algorithm descriptions accordion block.
 * @returns {string}
 */
function buildAlgorithmDescriptionsHtml() {
    return `
<div class="accordion-item">
    <div class="accordion-header">
        <span class="accordion-icon">▶</span>
        <strong>📘 Об алгоритмах отбора</strong>
    </div>
    <div class="accordion-content" style="display: none;">
        <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 8px; min-width: 0;">
            <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px;">
                <div style="font-weight: bold; color: var(--accent); margin-bottom: 8px;">Priority-Effort Matrix</div>
                <p style="margin: 0; font-size: 0.8rem; line-height: 1.5;">
                    Задачи делятся на 4 квадранта относительно медиан приоритета (Priority Score) и трудозатрат (Effort).<br>
                    <strong>Порядок отбора:</strong> Q1 → Q2 → Q3 → Q4.<br>
                    <strong>Q1</strong> (высокий приоритет, малые трудозатраты): сортируются по убыванию приоритета.<br>
                    <strong>Q2</strong> (высокий приоритет, большие трудозатраты): сортируются по возрастанию трудозатрат; при равных — по убыванию приоритета.<br>
                    <strong>Q3</strong> (низкий приоритет, малые трудозатраты): сортируются по убыванию приоритета.<br>
                    <strong>Q4</strong> (низкий приоритет, большие трудозатраты): сортируются по убыванию приоритета.<br>
                    <em>Примечание: Q4 рассматривается в последнюю очередь, если остались ресурсы.</em>
                </p>
            </div>
            <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px;">
                <div style="font-weight: bold; color: var(--accent); margin-bottom: 8px;">Value Density</div>
                <p style="margin: 0; font-size: 0.8rem; line-height: 1.5;">
                    Для каждой задачи вычисляется плотность ценности = Priority Score / Effort.<br>
                    Задачи сортируются по убыванию плотности; при равной плотности — по убыванию приоритета.<br>
                    Отбор ведётся последовательно сверху вниз с проверкой доступных ёмкостей.<br>
                    Максимизирует суммарный приоритет при заданных ресурсах.
                </p>
            </div>
            <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px;">
                <div style="font-weight: bold; color: var(--accent); margin-bottom: 8px;">Hybrid</div>
                <p style="margin: 0; font-size: 0.8rem; line-height: 1.5;">
                    Комбинирует матричную классификацию и плотность ценности.<br>
                    <strong>Порядок отбора:</strong> Q1 → Q2 → Q3 → Q4.<br>
                    <strong>Q1 и Q2</strong> сортируются по убыванию плотности ценности; при равной плотности — по убыванию приоритета.<br>
                    <strong>Q3 и Q4</strong> сортируются по убыванию приоритета.<br>
                    <em>Примечание: Q4 рассматривается только после исчерпания всех остальных квадрантов.</em>
                </p>
            </div>
        </div>
        <p style="font-size:0.75rem; color:var(--text-muted); margin-top:12px; font-style:italic;">
            Медианы приоритета и трудозатрат вычисляются один раз перед началом отбора по всем задачам-кандидатам.<br>
            Все методы строго соблюдают ёмкость каждой роли и общую ёмкость команды.
        </p>
    </div>
</div>`;
}

/**
 * Builds the HTML for the comparison table.
 * @param {Array} comparableData
 * @param {Object} bestValues
 * @returns {string}
 */
function buildComparisonTableHtml(comparableData, bestValues) {
    const { bestTasks, bestLoadDiff, bestEffort, bestPriority, bestDensity } = bestValues;

    let html = `
        <h2 style="font-size:1rem; margin:16px 0 12px;">Сравнение алгоритмов</h2>
        <table class="comparison-table">
            <thead>
                <tr>
                    <th style="text-align: left;" title="Название алгоритма">Алгоритм</th>
                    <th title="Количество задач, отобранных алгоритмом">Выбрано задач</th>
                    <th title="Отношение суммарного Effort к общей ёмкости команды">Загрузка (%)</th>
                    <th title="Суммарные трудозатраты отобранных задач">Сумм. Effort (ч)</th>
                    <th title="Сумма Priority Score отобранных задач">Сумм. Priority Score</th>
                    <th title="Среднее значение Priority Score / Effort по отобранным задачам">Ср. плотность</th>
                </tr>
            </thead>
            <tbody>
    `;

    comparableData.forEach(item => {
        const isBestTasks = item.tasksCount === bestTasks;
        const isBestLoad = areNearlyEqual(Math.abs(item.displayLoad - 100), bestLoadDiff);
        const isBestEffort = areNearlyEqual(item.displayEffort, bestEffort);
        const isBestPriority = areNearlyEqual(item.displayPriority, bestPriority);
        const isBestDensity = areNearlyEqual(item.displayDensity, bestDensity);

        const loadFormatted = item.displayLoad.toFixed(1).replace('.', ',');
        const effortFormatted = item.displayEffort.toFixed(1).replace('.', ',');
        const priorityFormatted = item.displayPriority.toFixed(1).replace('.', ',');
        const densityFormatted = item.displayDensity.toFixed(2).replace('.', ',');

        html += `
            <tr>
                <td style="text-align: left;">${item.name}</td>
                <td>${isBestTasks ? `<span class="best-value">${item.tasksCount}</span>` : item.tasksCount}</td>
                <td>${isBestLoad ? `<span class="best-value">${loadFormatted}</span>` : loadFormatted}</td>
                <td>${isBestEffort ? `<span class="best-value">${effortFormatted}</span>` : effortFormatted}</td>
                <td>${isBestPriority ? `<span class="best-value">${priorityFormatted}</span>` : priorityFormatted}</td>
                <td>${isBestDensity ? `<span class="best-value">${densityFormatted}</span>` : densityFormatted}</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    return html;
}

/**
 * Builds the HTML for the per-algorithm detail accordions.
 * @param {Object} results - { [algoKey]: selectionResult }
 * @param {Object} comparison - comparison metadata
 * @param {string[]} algorithms
 * @returns {string}
 */
function buildAlgorithmDetailsHtml(results, comparison, algorithms) {
    let html = `<h3 style="font-size:0.9rem; margin:16px 0 8px;">Детализация по алгоритмам</h3>`;

    algorithms.forEach(algo => {
        const res = results[algo];
        if (!res || res.error) return;

        const algoName = comparison[algo]?.algorithmName || ALGORITHM_NAMES[algo] || algo;
        html += `
<div class="accordion-item algorithm-detail" data-algorithm="${algo}">
    <div class="accordion-header">
        <span class="accordion-icon">▶</span>
        <strong>${algoName}</strong>
    </div>
    <div class="accordion-content" style="display: none;">
        `;

        if (res.quadrants) {
            const quadrantsDisplay = [
                { key: 'q1', title: '📊 Q1 (высокий приоритет, малый effort)' },
                { key: 'q2', title: '📈 Q2 (высокий приоритет, высокий effort)' },
                { key: 'q3', title: '📉 Q3 (низкий приоритет, малый effort)' },
                { key: 'q4', title: '📌 Q4 (низкий приоритет, высокий effort)' }
            ];

            quadrantsDisplay.forEach(q => {
                const tasks = res.quadrants[q.key] || [];
                if (tasks.length === 0) return;

                html += `
                    <div style="margin-bottom:12px;">
                        <div style="font-weight:bold; margin-bottom:4px;">${q.title}</div>
                        <ul style="margin:0 0 8px 20px; font-size:0.75rem;">
                `;
                tasks.forEach(task => {
                    const title = task.title || 'Без названия';
                    const priority = (task.priorityScore || 0).toFixed(1).replace('.', ',');
                    const effort = (task.effort || 0).toFixed(1).replace('.', ',');
                    html += `<li>${title} (Priority Score: ${priority} / Effort: ${effort} ч)</li>`;
                });
                html += `</ul></div>`;
            });
        }

        if (res.excludedTasks && res.excludedTasks.length > 0) {
            html += `<div style="font-weight:bold; color:var(--danger);">❌ Исключено (${res.excludedTasks.length})</div><ul>`;
            res.excludedTasks.forEach(task => {
                const title = task.title || 'Без названия';
                const reason = task.reason || 'Неизвестная причина';
                html += `<li>${title} — <span style="color:var(--text-muted);">${reason}</span></li>`;
            });
            html += `</ul>`;
        }

        html += `</div></div>`;
    });

    return html;
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
        contentEl.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted);">Нет данных для отображения</div>';
        const modal = document.getElementById('selectionReportModal');
        if (modal) showModal(modal);
        return true;
    }

    const bestValues = computeComparisonBestValues(comparableData);

    let html = '';
    html += buildAlgorithmDescriptionsHtml();
    html += buildComparisonTableHtml(comparableData, bestValues);
    html += `
        <div style="text-align:center; margin:16px 0;">
            <button id="showRecommendationsBtn" class="export-btn" style="color:var(--accent); border-color:var(--accent);">
                📋 Рекомендации
            </button>
        </div>
    `;
    html += buildAlgorithmDetailsHtml(results, comparison, algorithms);

    contentEl.innerHTML = html;

    // Attach accordion event listeners
    contentEl.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', function () {
            const content = this.nextElementSibling;
            if (content && content.classList.contains('accordion-content')) {
                const isHidden = content.style.display === 'none';
                content.style.display = isHidden ? 'block' : 'none';
                const icon = this.querySelector('.accordion-icon');
                if (icon) icon.textContent = isHidden ? '▼' : '▶';
            }
        });
    });

    const modal = document.getElementById('selectionReportModal');
    if (modal) showModal(modal);

    return true;
}
