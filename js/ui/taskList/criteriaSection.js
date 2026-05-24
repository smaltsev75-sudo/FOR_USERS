import { parseCriteriaScore } from '../../domain/criteria.js';
import { escapeHtml } from '../../utils/escapeHtml.js';
import { icon } from '../../utils/icons.js';
import { getPriorityLabel, getPriorityLevel } from '../createTaskRowVM.js';

export function buildCriteriaScoreOptions(selectedScore) {
    let options = '';
    for (let score = 0; score <= 10; score++) {
        options += `<option value="${score}"${score === selectedScore ? ' selected' : ''}>${score}</option>`;
    }
    return options;
}

/**
 * v8.27.2: маппит score 0-10 в один из трёх уровней «силы» (low/mid/high).
 * Используется для цвета stepper'а, заливки contribution-бара, opacity бейджа.
 * Граница 0-3 / 4-7 / 8-10 — по брифу UX-редизайна.
 * @param {number} score
 * @returns {'low'|'mid'|'high'|'zero'}
 */
export function getCriteriaScoreLevel(score) {
    if (score <= 0) return 'zero';
    if (score <= 3) return 'low';
    if (score <= 7) return 'mid';
    return 'high';
}

/**
 * Builds the criteria evaluation HTML for a task card.
 * @param {Object} task
 * @param {Object} taskEvaluations
 * @param {Array} criteria
 * @param {Object} nfs
 * @param {number} priorityScore
 * @returns {string}
 */
export function buildCriteriaHtml(task, taskEvaluations, criteria, nfs, priorityScore) {
    if (criteria.length === 0) return '';

    // v8.30.10: для исключённых задач показываем компактный read-only Priority Score
    // без stepper'ов и chip'ов критериев — пользователь видит итоговый приоритет
    // и может верифицировать корректность сортировки по приоритету.
    if (task.excluded) {
        const lvl = getPriorityLevel(priorityScore);
        const lbl = getPriorityLabel(lvl);
        return `
            <div class="criteria-row criteria-row--excluded">
                <div class="criteria-section-label">Приоритет</div>
                <div class="criteria-row-body">
                    <div class="priority-score-container priority-score-${lvl}" title="Приоритет: ${escapeHtml(lbl)} (${nfs.formatNumber(priorityScore)})">
                        <span class="priority-score-icon" aria-hidden="true">${icon('barChart')}</span>
                        <span class="priority-score-meta">
                            <span class="priority-score-label">Priority Score</span>
                        </span>
                        <span class="priority-score-value" data-value="${nfs.formatNumber(priorityScore)}">${nfs.formatNumber(priorityScore)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // v8.30.40: быстрые [−]/[+] сохранены, само число editable input, а
    // dropdown — отдельный native select со всеми 0..10.
    let criteriaRows = '';
    criteria.forEach((criterion, idx) => {
        const evaluation = taskEvaluations[criterion.id] || { score: 0, value: 0 };
        const score = parseCriteriaScore(evaluation.score);
        const value = (score * criterion.weight) / 10;
        const maxValue = criterion.weight;
        const contributionPct = maxValue > 0 ? (value / maxValue) * 100 : 0;
        const level = getCriteriaScoreLevel(score);
        const mobileAbbreviation = `k-${idx + 1}`;
        const minDisabled = score <= 0;
        const maxDisabled = score >= 10;
        const criterionNameSafe = escapeHtml(criterion.name);
        const scoreOptions = buildCriteriaScoreOptions(score);
        criteriaRows += `
            <div class="criteria-eval-item" data-criterion-id="${criterion.id}" data-score-level="${level}">
                <div class="criteria-eval-head">
                    <span class="criteria-eval-abbreviation" title="${criterionNameSafe}">${escapeHtml(criterion.abbreviation)}</span>
                    <span class="mobile-criteria-abbreviation" title="${criterionNameSafe}">${mobileAbbreviation}</span>
                    <span class="criteria-eval-weight" title="Вес критерия">${criterion.weight}%</span>
                    <span class="criteria-eval-contribution" title="Вклад в Priority Score (score × weight / 10)">+${nfs.formatNumber(value)}</span>
                </div>
                <div class="criteria-eval-stepper"
                     role="group"
                     aria-label="${criterionNameSafe} оценка от 0 до 10"
                     data-id="${task.id}"
                     data-criterion-id="${criterion.id}">
                    <button type="button" class="criteria-eval-step criteria-eval-step--minus"
                            data-action="decrement" aria-label="Уменьшить" tabindex="-1"
                            ${minDisabled ? 'disabled' : ''}>−</button>
                    <span class="criteria-eval-score">
                        <input type="number"
                               class="criteria-score-input"
                               data-id="${task.id}"
                               data-criterion-id="${criterion.id}"
                               value="${score}"
                               min="0"
                               max="10"
                               step="1"
                               inputmode="numeric"
                               autocomplete="off"
                               aria-label="${criterionNameSafe} ввод оценки от 0 до 10">
                        <span class="criteria-score-dropdown">
                            <select class="criteria-score-select"
                                    data-id="${task.id}"
                                    data-criterion-id="${criterion.id}"
                                    aria-label="${criterionNameSafe} выбрать оценку от 0 до 10">
                                ${scoreOptions}
                            </select>
                        </span>
                        <span class="criteria-score-print" aria-hidden="true">${score}</span>
                    </span>
                    <button type="button" class="criteria-eval-step criteria-eval-step--plus"
                            data-action="increment" aria-label="Увеличить" tabindex="-1"
                            ${maxDisabled ? 'disabled' : ''}>+</button>
                </div>
                <div class="criteria-eval-bar" aria-hidden="true">
                    <span class="criteria-eval-bar-fill" style="width: ${contributionPct.toFixed(1)}%"></span>
                </div>
            </div>
        `;
    });

    const level = getPriorityLevel(priorityScore);
    const label = getPriorityLabel(level);

    return `
        <div class="criteria-row">
            <div class="criteria-section-label">Метрики приоритета</div>
            <div class="criteria-row-body">
                <div class="criteria-evaluation">${criteriaRows}</div>
                <div class="priority-score-container priority-score-${level}" title="Приоритет: ${escapeHtml(label)} (${nfs.formatNumber(priorityScore)})">
                    <span class="priority-score-icon" aria-hidden="true">${icon('barChart')}</span>
                    <span class="priority-score-meta">
                        <span class="priority-score-label">Priority Score</span>
                    </span>
                    <span class="priority-score-value" data-value="${nfs.formatNumber(priorityScore)}">${nfs.formatNumber(priorityScore)}</span>
                </div>
            </div>
        </div>
    `;
}
