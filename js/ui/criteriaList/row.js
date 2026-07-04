import { escapeHtml } from '../../utils/escapeHtml.js';
import { icon } from '../../utils/icons.js';

/**
 * Generates the HTML for the scale editor (10 textarea rows).
 * Used in edit-criteria modal.
 * @param {Object} scale - { [1..10]: string }
 * @returns {string}
 */
export function generateScaleEditorHTML(scale = {}) {
    // Owner redesign: нумерованный circular-badge + single-line <input> в
    // 2-колоночной сетке (.scale-editor — grid). escapeHtml экранирует кавычки,
    // поэтому value-атрибут безопасен. collectScaleFromEditor читает .value —
    // работает и для input. Геометрия/вид — в `.scale-description--editor`.
    let html = '';
    for (let i = 1; i <= 10; i++) {
        const escaped = escapeHtml(scale[i] || '');
        html += '<div class="scale-item scale-item--editor">' +
            '<span class="scale-score">' + i + '</span>' +
            '<input type="text" class="scale-description scale-description--editor" id="scale_' + i + '" ' +
            'placeholder="Описание значения (опционально)" value="' + escaped + '">' +
            '</div>';
    }
    return html;
}

export function buildScaleSectionHtml(criterion) {
    let scaleRows = '';
    for (let i = 1; i <= 10; i++) {
        const scaleValue = criterion.scale && criterion.scale[i] !== undefined ? criterion.scale[i] : '';
        scaleRows += `<div class="scale-item"><div class="scale-score">${i}</div><div class="scale-description">${escapeHtml(scaleValue)}</div></div>`;
    }
    // v8.30.2: scale-toggle переведён с `<div role="button" tabindex="0">` на
    // native `<button>`. Раньше у div был только click-listener, Enter/Space
    // нативно не работали — пользователи с клавиатуры не могли раскрыть шкалу.
    // Native button даёт Enter/Space из коробки. Это тот же урок что
    // criteria-item-header в v8.30.0 — но я пропустил scale-toggle в audit'е.
    return `
        <div class="criteria-scale-container">
            <button type="button" class="scale-toggle" data-id="${criterion.id}" aria-expanded="false" aria-controls="scale_${criterion.id}">
                <span class="scale-toggle-icon collapsed" aria-hidden="true">▶</span>
                <span class="scale-toggle-text">Показать шкалу 1–10</span>
            </button>
            <div class="criteria-scale" id="scale_${criterion.id}">${scaleRows}</div>
        </div>`;
}

export function buildCriteriaItemHtml(criterion) {
    const id = criterion.id;
    const safeName = escapeHtml(criterion.name);
    const safeAbbreviation = escapeHtml(criterion.abbreviation);
    const safeRationale = escapeHtml(criterion.rationale || '');
    const weight = Number(criterion.weight) || 0;

    // v8.30.0 (a11y): header больше не role=button. Toggle вынесен в отдельную
    // нативную <button>. Раньше header был role=button + tabindex=0, а внутри
    // лежали focusable input/buttons — axe-core помечал как «nested interactive»
    // (WCAG 4.1.2). Теперь grip + weight + actions — siblings toggle-кнопки.
    return `
<div class="criteria-item" data-id="${id}" data-expanded="false">
    <div class="criteria-item-header">
        <span class="criteria-item-grip" data-action="dragHandle" role="img" aria-label="Перетащить для изменения порядка" title="Перетащить для изменения порядка">${icon('gripVertical')}</span>
        <button type="button" class="criteria-item-toggle-btn" aria-expanded="false" aria-controls="criteriaBody_${id}" data-action="toggleExpand" data-id="${id}" aria-label="Раскрыть критерий ${safeName}">
            <span class="criteria-abbreviation" title="Аббревиатура">${safeAbbreviation}</span>
            <span class="criteria-name">${safeName}</span>
            <span class="criteria-item-chevron" aria-hidden="true">▶</span>
        </button>
        <span class="criteria-weight-control">
            <input
                type="number"
                class="criteria-weight-input"
                value="${weight}"
                min="0"
                max="100"
                step="1"
                data-id="${id}"
                data-focus-key="criteria-weight:${id}"
                aria-label="Вес критерия в процентах"
                title="Вес критерия (0–100%). Сумма всех весов должна быть 100%."
            >
            <span class="criteria-weight-suffix">%</span>
        </span>
        <span class="criteria-actions">
            <button type="button" class="criteria-icon-btn btn-edit-criteria-icon" data-action="editCriteria" data-id="${id}" title="Редактировать критерий" aria-label="Редактировать критерий">${icon('pencil')}</button>
            <button type="button" class="criteria-icon-btn btn-delete-criteria-icon" data-action="deleteCriteria" data-id="${id}" title="Удалить критерий" aria-label="Удалить критерий">${icon('trash')}</button>
        </span>
    </div>
    <div class="criteria-body" id="criteriaBody_${id}" hidden>
        <p class="criteria-rationale">${safeRationale}</p>
        ${buildScaleSectionHtml(criterion)}
    </div>
</div>`;
}
