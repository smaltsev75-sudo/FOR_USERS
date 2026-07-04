import { escapeHtml } from '../../../utils/escapeHtml.js';
import { icon } from '../../../utils/icons.js';
import { SECTION_HINTS } from '../constants.js';

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
