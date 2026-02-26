// js/ui/criteriaList.js
import { escapeHtml } from '../utils/escapeHtml.js';

/**
 * Generates the HTML for the scale editor (10 textarea rows).
 * Moved here from js/domain/criteria.js to keep domain logic free of HTML.
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

export function renderCriteriaList(state, nfs) {
    const criteriaListEl = document.getElementById('criteriaList');
    if (!criteriaListEl) return;

    const criteria = state.criteria;
    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    const isWeightValid = totalWeight === 100;

    let html = '';
    html += `<div class="total-weight top-total-weight" style="background:rgba(0,255,157,0.15);">
                <span>Общий процент весов:</span>
                <span class="${isWeightValid ? 'weight-valid' : 'weight-invalid'}">${totalWeight}%</span>
            </div>`;

    if (criteria.length === 0) {
        html += '<div style="text-align:center; padding:20px; color:var(--text-muted); font-style:italic;">Нет критериев оценки. Добавьте первый критерий.</div>';
    } else {
        criteria.forEach((criterion) => {
            let scaleHtml = '';
            for (let i = 1; i <= 10; i++) {
                const scaleValue = criterion.scale && criterion.scale[i] !== undefined ? criterion.scale[i] : '';
                scaleHtml += `<div class="scale-item"><div class="scale-score">${i}</div><div class="scale-description">${escapeHtml(scaleValue)}</div></div>`;
            }
            html += `<div class="criteria-item" data-id="${criterion.id}">
                        <div class="criteria-header">
                            <div class="criteria-name-container">
                                <div class="criteria-name">${escapeHtml(criterion.name)}</div>
                                <div class="criteria-abbreviation" title="Аббревиатура">${escapeHtml(criterion.abbreviation)}</div>
                                <div class="criteria-weight" title="Вес критерия">${criterion.weight}%</div>
                            </div>
                            <div class="criteria-controls-icons">
                                <button class="criteria-icon-btn btn-edit-criteria-icon" data-action="editCriteria" data-id="${criterion.id}" title="Редактировать" aria-label="Редактировать">✎</button>
                                <button class="criteria-icon-btn btn-delete-criteria-icon" data-action="deleteCriteria" data-id="${criterion.id}" title="Удалить" aria-label="Удалить">🗑</button>
                            </div>
                        </div>
                        <div class="criteria-rationale">${escapeHtml(criterion.rationale)}</div>
                        <div class="criteria-scale-container">
                            <div class="scale-toggle" data-id="${criterion.id}">
                                <span class="scale-toggle-icon collapsed">▸</span>
                                <span class="scale-toggle-text">Показать</span>
                            </div>
                            <div class="criteria-scale" id="scale_${criterion.id}">${scaleHtml}</div>
                        </div>
                    </div>`;
        });
    }

    if (criteria.length > 3) {
        html += `<div class="total-weight bottom-total-weight" style="background:rgba(0,255,157,0.15);">
                    <span>Общий процент весов:</span>
                    <span class="${isWeightValid ? 'weight-valid' : 'weight-invalid'}">${totalWeight}%</span>
                </div>`;
    }

    criteriaListEl.innerHTML = html;

    criteriaListEl.querySelectorAll('.scale-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            const id = toggle.dataset.id;
            const scaleEl = document.getElementById(`scale_${id}`);
            const icon = toggle.querySelector('.scale-toggle-icon');
            const textSpan = toggle.querySelector('.scale-toggle-text');
            if (scaleEl) {
                if (scaleEl.classList.contains('expanded')) {
                    scaleEl.classList.remove('expanded');
                    if (icon) icon.classList.add('collapsed');
                    if (icon) icon.textContent = '▸';
                    if (textSpan) textSpan.textContent = 'Показать';
                } else {
                    scaleEl.classList.add('expanded');
                    if (icon) icon.classList.remove('collapsed');
                    if (icon) icon.textContent = '▾';
                    if (textSpan) textSpan.textContent = 'Скрыть';
                }
            }
        });
    });
}
