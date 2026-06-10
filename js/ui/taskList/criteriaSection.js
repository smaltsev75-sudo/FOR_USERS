/**
 * Criteria scoring helpers.
 *
 * v2 redesign (owner feedback #6): criteria steppers («Метрики приоритета»
 * OKR/UX/STRAT/RISK с +/-) больше НЕ рендерятся в строке задачи. Оценка по
 * критериям живёт только в модалке создания/редактирования задачи. В карточке
 * списка остаются компактные бейджи Priority Score + Effort (см. taskCard.js
 * → buildTaskMetricsHtml). Здесь сохранены лишь чистые helper'ы, которые
 * переиспользуются модальной формой и тестами уровней score.
 */

export function buildCriteriaScoreOptions(selectedScore) {
    let options = '';
    for (let score = 0; score <= 10; score++) {
        options += `<option value="${score}"${score === selectedScore ? ' selected' : ''}>${score}</option>`;
    }
    return options;
}

/**
 * v8.27.2: маппит score 0-10 в один из трёх уровней «силы» (low/mid/high).
 * Используется для цвета индикаторов оценки критериев.
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
