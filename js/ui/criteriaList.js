// js/ui/criteriaList.js
//
// v8.29 redesign:
//   - Sticky-bar с pill «Сумма N%» + кнопкой «Авто-баланс»
//   - Карточки collapsed-by-default; click на header — toggle
//   - Inline-input для веса (фокус сохраняется через `data-focus-key`)
//   - Hover-actions edit/delete через SVG (не эмодзи)
//   - Drag-handle (gripVertical) на левой стороне для reorder
//   - Никаких inline-стилей, только классы из css/criteria.css

import { escapeHtml } from '../utils/escapeHtml.js';
import { icon } from '../utils/icons.js';

/**
 * Generates the HTML for the scale editor (10 textarea rows).
 * Used in edit-criteria modal.
 * @param {Object} scale - { [1..10]: string }
 * @returns {string}
 */
export function generateScaleEditorHTML(scale = {}) {
    let html = '';
    for (let i = 1; i <= 10; i++) {
        const description = scale[i] || '';
        const escaped = escapeHtml(description);
        html += '<div class="scale-item">' +
            '<div class="scale-score">' + i + '</div>' +
            '<textarea class="scale-description" id="scale_' + i + '" ' +
            'placeholder="Описание значения шкалы (опционально)" ' +
            'style="font-size:0.75rem; padding:6px; height:40px; width:100%; box-sizing:border-box;">' +
            escaped + '</textarea>' +
            '</div>';
    }
    return html;
}

/**
 * Returns CSS modifier class for the sum pill based on total weight.
 * Exported for tests + sticky-bar partial-update logic.
 * @param {number} total
 * @returns {string} '' | 'criteria-sum-pill--invalid-under' | 'criteria-sum-pill--invalid-over'
 */
export function getSumPillModifier(total) {
    if (total === 100) return '';
    if (total < 100) return 'criteria-sum-pill--invalid-under';
    return 'criteria-sum-pill--invalid-over';
}

/**
 * Returns the human-readable label inside the sum pill.
 * @param {number} total
 * @returns {string}
 */
export function getSumPillLabel(total) {
    if (total === 100) return 'Сумма весов: 100%';
    if (total < 100) return `Осталось распределить: ${100 - total}%`;
    return `Превышение на ${total - 100}%`;
}

function buildSumBarHtml(total) {
    const modifier = getSumPillModifier(total);
    const label = getSumPillLabel(total);
    const pillIcon = total === 100 ? icon('check') : icon('alertCircle');
    const showAutoBalance = total !== 100;
    return `
<div class="criteria-sum-bar" id="criteriaSumBar">
    <span class="criteria-sum-pill ${modifier}" id="criteriaSumPill" data-total="${total}">
        ${pillIcon}<span id="criteriaSumPillLabel">${escapeHtml(label)}</span>
    </span>
    <div class="criteria-sum-actions">
        <button type="button" id="criteriaAutoBalanceBtn" class="criteria-auto-balance-btn"${showAutoBalance ? '' : ' hidden'} title="Распределить веса так, чтобы сумма равнялась 100%">
            ${icon('rotateCcw')}
            Авто-баланс
        </button>
    </div>
</div>`;
}

function buildScaleSectionHtml(criterion) {
    let scaleRows = '';
    for (let i = 1; i <= 10; i++) {
        const scaleValue = criterion.scale && criterion.scale[i] !== undefined ? criterion.scale[i] : '';
        scaleRows += `<div class="scale-item"><div class="scale-score">${i}</div><div class="scale-description">${escapeHtml(scaleValue)}</div></div>`;
    }
    return `
        <div class="criteria-scale-container">
            <div class="scale-toggle" data-id="${criterion.id}" role="button" tabindex="0" aria-expanded="false">
                <span class="scale-toggle-icon collapsed">▶</span>
                <span class="scale-toggle-text">Показать шкалу 1–10</span>
            </div>
            <div class="criteria-scale" id="scale_${criterion.id}">${scaleRows}</div>
        </div>`;
}

function buildCriteriaItemHtml(criterion) {
    const id = criterion.id;
    const safeName = escapeHtml(criterion.name);
    const safeAbbreviation = escapeHtml(criterion.abbreviation);
    const safeRationale = escapeHtml(criterion.rationale || '');
    const weight = Number(criterion.weight) || 0;

    return `
<div class="criteria-item" data-id="${id}" data-expanded="false">
    <div class="criteria-item-header" role="button" tabindex="0" aria-expanded="false" aria-controls="criteriaBody_${id}" data-action="toggleExpand" data-id="${id}">
        <span class="criteria-item-grip" data-action="dragHandle" aria-label="Перетащить для изменения порядка" title="Перетащить для изменения порядка">${icon('gripVertical')}</span>
        <span class="criteria-abbreviation" title="Аббревиатура">${safeAbbreviation}</span>
        <h4 class="criteria-name">${safeName}</h4>
        <span class="criteria-weight-control" data-no-toggle="true">
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
        <span class="criteria-actions" data-no-toggle="true">
            <button type="button" class="criteria-icon-btn btn-edit-criteria-icon" data-action="editCriteria" data-id="${id}" title="Редактировать критерий" aria-label="Редактировать критерий">${icon('pencil')}</button>
            <button type="button" class="criteria-icon-btn btn-delete-criteria-icon" data-action="deleteCriteria" data-id="${id}" title="Удалить критерий" aria-label="Удалить критерий">${icon('trash')}</button>
        </span>
        <span class="criteria-item-chevron" aria-hidden="true">▶</span>
    </div>
    <div class="criteria-body" id="criteriaBody_${id}" hidden>
        <p class="criteria-rationale">${safeRationale}</p>
        ${buildScaleSectionHtml(criterion)}
    </div>
</div>`;
}

/**
 * Запоминает фокус и selectionRange активного weight-input перед re-render
 * (обходим потерю фокуса при перерисовке списка).
 * @returns {{ key: string|null, start: number, end: number }}
 */
function snapshotWeightFocus() {
    const active = document.activeElement;
    if (!active || !active.classList?.contains('criteria-weight-input')) {
        return { key: null, start: 0, end: 0 };
    }
    return {
        key: active.getAttribute('data-focus-key'),
        start: active.selectionStart || 0,
        end: active.selectionEnd || 0
    };
}

function restoreWeightFocus(snapshot, container) {
    if (!snapshot.key) return;
    const target = container.querySelector(`[data-focus-key="${CSS.escape(snapshot.key)}"]`);
    if (target) {
        target.focus();
        try {
            target.setSelectionRange(snapshot.start, snapshot.end);
        } catch (_) {
            // not all input types support selection range
        }
    }
}

/**
 * Renders the criteria management list with sticky sum-bar.
 *
 * @param {Object} state - { criteria: Array }
 * @param {Object} _nfs - number formatting service (unused now)
 * @returns {void}
 */
export function renderCriteriaList(state, _nfs) {
    const criteriaListEl = document.getElementById('criteriaList');
    if (!criteriaListEl) return;

    const criteria = state.criteria || [];
    const totalWeight = criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

    const focusSnapshot = snapshotWeightFocus();
    const expandedIds = new Set(
        Array.from(criteriaListEl.querySelectorAll('.criteria-item[data-expanded="true"]'))
            .map(el => Number(el.dataset.id))
    );

    let html = buildSumBarHtml(totalWeight);

    if (criteria.length === 0) {
        html += '<div class="criteria-empty-state">Нет критериев оценки. Добавьте первый критерий.</div>';
    } else {
        criteria.forEach(criterion => { html += buildCriteriaItemHtml(criterion); });
    }

    criteriaListEl.innerHTML = html;

    // Восстанавливаем раскрытые карточки (которые пользователь открыл до re-render)
    expandedIds.forEach(id => {
        const item = criteriaListEl.querySelector(`.criteria-item[data-id="${id}"]`);
        if (item) {
            item.dataset.expanded = 'true';
            item.classList.add('is-expanded');
            const header = item.querySelector('.criteria-item-header');
            const body = item.querySelector('.criteria-body');
            if (header) header.setAttribute('aria-expanded', 'true');
            if (body) body.removeAttribute('hidden');
        }
    });

    // Восстанавливаем фокус на weight-input после re-render (например, после
    // setCriteria из autoBalance или updateCriteriaWeight).
    restoreWeightFocus(focusSnapshot, criteriaListEl);

    // Локальный listener: только scale-toggle (вложенный в body карточки).
    // Остальные клики/инпуты обрабатываются делегированно в criteriaController.
    criteriaListEl.querySelectorAll('.scale-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = toggle.dataset.id;
            const scaleEl = document.getElementById(`scale_${id}`);
            const iconEl = toggle.querySelector('.scale-toggle-icon');
            const textSpan = toggle.querySelector('.scale-toggle-text');
            if (!scaleEl) return;
            if (scaleEl.classList.contains('expanded')) {
                scaleEl.classList.remove('expanded');
                if (iconEl) {
                    iconEl.classList.add('collapsed');
                    iconEl.textContent = '▶';
                }
                if (textSpan) textSpan.textContent = 'Показать шкалу 1–10';
                toggle.setAttribute('aria-expanded', 'false');
            } else {
                scaleEl.classList.add('expanded');
                if (iconEl) {
                    iconEl.classList.remove('collapsed');
                    iconEl.textContent = '▼';
                }
                if (textSpan) textSpan.textContent = 'Скрыть шкалу';
                toggle.setAttribute('aria-expanded', 'true');
            }
        });
    });
}

/**
 * Обновляет только sum-bar (без перерисовки списка карточек). Используется
 * во время `input` события inline weight-input — нужно мгновенно показать
 * пользователю изменение суммы, но не дёргать DOM карточек (потеря фокуса).
 *
 * @param {number} total — текущая сумма весов
 */
export function updateSumBar(total) {
    const pill = document.getElementById('criteriaSumPill');
    const label = document.getElementById('criteriaSumPillLabel');
    const autoBtn = document.getElementById('criteriaAutoBalanceBtn');
    if (!pill || !label) return;

    pill.classList.remove('criteria-sum-pill--invalid-under', 'criteria-sum-pill--invalid-over');
    const modifier = getSumPillModifier(total);
    if (modifier) pill.classList.add(modifier);
    pill.dataset.total = String(total);
    label.textContent = getSumPillLabel(total);

    if (autoBtn) {
        if (total === 100) {
            autoBtn.setAttribute('hidden', '');
        } else {
            autoBtn.removeAttribute('hidden');
        }
    }
}
