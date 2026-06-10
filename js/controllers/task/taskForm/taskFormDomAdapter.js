import { parseStrictIntegerInRange } from '../../../domain/strictInteger.js';
import { ROLES } from '../../../utils/constants.js';
import { escapeHtml } from '../../../utils/escapeHtml.js';
import {
    calculateCreateFormTotal,
    collectCriteriaEvaluations
} from '../formHelpers.js';

export class TaskFormDomAdapter {
    constructor(nfs, doc = document) {
        this.nfs = nfs;
        this.document = doc;
    }

    get modal() {
        return this.document.getElementById('createTaskModal');
    }

    setModalMode(mode) {
        const modal = this.modal;
        if (!modal) return;
        const title = modal.querySelector('#createTaskModalTitle');
        const saveBtn = modal.querySelector('#saveCreateBtn');
        const attr = mode === 'edit' ? 'data-edit-text' : 'data-create-text';
        if (title && title.getAttribute(attr)) {
            title.textContent = title.getAttribute(attr);
        }
        if (saveBtn && saveBtn.getAttribute(attr)) {
            saveBtn.textContent = saveBtn.getAttribute(attr);
            if (mode === 'edit') {
                saveBtn.setAttribute('title', 'Сохранить — Ctrl+S');
                saveBtn.setAttribute('aria-label', 'Сохранить (горячая клавиша Ctrl+S)');
            } else {
                saveBtn.setAttribute('title', 'Создать задачу — Ctrl+Enter');
                saveBtn.setAttribute('aria-label', 'Создать задачу (горячая клавиша Ctrl+Enter)');
            }
        }
        modal.dataset.mode = mode;
    }

    focusFirstInput() {
        const modal = this.modal;
        const firstInput = modal?.querySelector('input:not([type="hidden"]), select');
        if (firstInput) firstInput.focus();
    }

    wireSegmentedType() {
        const seg = this.modal?.querySelector('#newTypeSegmented');
        if (!seg || seg.dataset.wired === '1') return;
        seg.dataset.wired = '1';
        seg.addEventListener('click', (e) => {
            const btn = e.target.closest('.cf-seg-btn[data-type]');
            if (!btn || !seg.contains(btn)) return;
            this.setTypeSegment(btn.dataset.type);
        });
        seg.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            const buttons = Array.from(seg.querySelectorAll('.cf-seg-btn[data-type]'));
            const current = buttons.findIndex(b => b.getAttribute('aria-checked') === 'true');
            const dir = e.key === 'ArrowRight' ? 1 : -1;
            const next = (current + dir + buttons.length) % buttons.length;
            this.setTypeSegment(buttons[next].dataset.type);
            buttons[next].focus();
            e.preventDefault();
        });
    }

    setTypeSegment(type) {
        const seg = this.document.getElementById('newTypeSegmented');
        const buttons = seg?.querySelectorAll('.cf-seg-btn[data-type]') || [];
        buttons.forEach(button => {
            const active = button.dataset.type === type;
            button.setAttribute('aria-checked', active ? 'true' : 'false');
            button.dataset.active = active ? 'true' : 'false';
        });
        const hidden = this.document.getElementById('newType');
        if (hidden) hidden.value = type;
    }

    wirePresetChips() {
        const roots = this.modal?.querySelectorAll('.cf-role__presets[data-target]') || [];
        roots.forEach(root => {
            if (root.dataset.wired === '1') return;
            root.dataset.wired = '1';
            root.addEventListener('click', (e) => {
                const chip = e.target.closest('.cf-preset[data-value]');
                if (!chip || !root.contains(chip)) return;
                const input = this.document.getElementById(root.dataset.target);
                if (!input) return;
                input.value = chip.dataset.value;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.focus();
            });
        });
    }

    /**
     * Рендерит критерии как шкалы-полосы (1 клик к любому значению 0..10).
     * На каждый критерий: label (вес + аббревиатура), кликабельная шкала
     * (role="slider", 11 делений 0..10, заливка sage до значения, keyboard
     * ←/→/Home/End) и hidden-input #criteria_<id>.criteria-score-select —
     * через него читается значение (collectCriteriaEvaluations) и триггерится
     * пересчёт Priority Score (общий change-listener на контейнере).
     */
    populateCriteriaSelects(criteria = []) {
        const container = this.document.getElementById('createCriteriaContainer');
        if (!container) return;
        if (!criteria.length) {
            container.innerHTML = '<div class="create-criteria-empty">Нет критериев оценки</div>';
            return;
        }

        let rowsHtml = '';
        criteria.forEach(criterion => {
            const safeName = escapeHtml(criterion.name);
            const safeAbbr = escapeHtml(criterion.abbreviation);
            const safeId = parseStrictIntegerInRange(criterion.id, 1, Infinity) ?? 0;
            const safeWeight = parseStrictIntegerInRange(criterion.weight, 0, 100) ?? 0;
            const ticks = Array.from({ length: 11 }, (_, i) =>
                `<span class="cf-scale__tick" data-value="${i}"></span>`
            ).join('');
            rowsHtml += `
                <div class="cf-criteria-row">
                    <span class="cf-criteria-label" title="${safeName}">
                        <span class="cf-criteria-weight">${safeWeight}%</span>${safeAbbr}
                    </span>
                    <span class="cf-scale__end" aria-hidden="true">0</span>
                    <span class="cf-scale" role="slider" tabindex="0"
                          aria-valuemin="0" aria-valuemax="10" aria-valuenow="0"
                          aria-label="${safeName}: оценка от 0 до 10" data-criterion-id="${safeId}">
                        <span class="cf-scale__track" aria-hidden="true">${ticks}</span>
                    </span>
                    <span class="cf-scale__end" aria-hidden="true">10</span>
                    <span class="cf-scale__value" data-criterion-id="${safeId}" aria-hidden="true">0</span>
                    <input type="hidden" id="criteria_${safeId}" class="criteria-score-select" data-criterion-id="${safeId}" value="0">
                </div>
            `;
        });

        container.innerHTML = `<div class="cf-criteria-scales">${rowsHtml}</div>`;
    }

    /**
     * Устанавливает значение шкалы критерия: hidden-input + aria-valuenow +
     * подпись + заливка делений. dispatch=true → диспатчит change на hidden-input
     * (триггерит пересчёт Priority Score). dispatch=false — для программной
     * предзаливки (writeDraft/clear), где Priority Score обновляется отдельно.
     */
    setCriteriaScaleValue(criterionId, value, { dispatch = true } = {}) {
        const v = Math.max(0, Math.min(10, Math.round(Number(value) || 0)));
        const hidden = this.document.getElementById(`criteria_${criterionId}`);
        if (!hidden) return;
        hidden.value = String(v);

        const scale = this.document.querySelector(`.cf-scale[data-criterion-id="${criterionId}"]`);
        if (scale) {
            scale.setAttribute('aria-valuenow', String(v));
            scale.querySelectorAll('.cf-scale__tick').forEach(tick => {
                const tv = Number(tick.dataset.value);
                tick.classList.toggle('cf-scale__tick--on', tv >= 1 && tv <= v);
            });
        }
        const valueEl = this.document.querySelector(`.cf-scale__value[data-criterion-id="${criterionId}"]`);
        if (valueEl) valueEl.textContent = String(v);

        if (dispatch) hidden.dispatchEvent(new Event('change', { bubbles: true }));
    }

    clear(criteria = []) {
        const ids = ['newTitle', 'newJira', 'newComment', ...ROLES.map(role => `h_${role.id}`)];
        ids.forEach(id => {
            const el = this.document.getElementById(id);
            if (!el) return;
            el.value = '';
            el.classList.remove('error');
            el.removeAttribute('aria-invalid');
        });
        this.setTypeSegment('us');
        criteria.forEach(criterion => {
            this.setCriteriaScaleValue(criterion.id, 0, { dispatch: false });
        });
        this.updateCommentCounter(0, 255);
    }

    readDraft(criteria = []) {
        const title = this.document.getElementById('newTitle')?.value.trim() || '';
        const jira = this.document.getElementById('newJira')?.value.trim() || '';
        const type = this.document.getElementById('newType')?.value || 'us';
        const comment = this.document.getElementById('newComment')?.value.trim() || '';
        return {
            title,
            jira,
            type,
            comment,
            // Эффорт-секция удалена из модалки (owner): не читаем часы из формы.
            // create → новая задача стартует с est=0 (normalizeEstimates(undefined));
            // edit → патч не содержит est, существующие часы сохраняются.
            criteriaEvaluations: collectCriteriaEvaluations(criteria)
        };
    }

    writeDraft(draft, criteria = []) {
        this.setValue('newTitle', draft.title || '');
        this.setValue('newJira', draft.jira || '');
        this.setValue('newType', draft.type || 'us');
        this.setTypeSegment(draft.type || 'us');
        this.setValue('newComment', draft.comment || '');
        this.updateCommentCounter((draft.comment || '').length, 255);

        const estimates = draft.estimates || {};
        ROLES.forEach(role => {
            const input = this.document.getElementById(`h_${role.id}`);
            if (!input) return;
            const value = estimates[role.id];
            input.value = value ? this.nfs.formatNumber(value) : '';
        });

        const evaluations = draft.criteriaEvaluations || {};
        criteria.forEach(criterion => {
            const score = evaluations[criterion.id]?.score;
            this.setCriteriaScaleValue(criterion.id, Number.isFinite(score) ? score : 0, { dispatch: false });
        });
    }

    updatePriorityHeader(priorityScore) {
        const el = this.document.getElementById('createPriorityScoreHeader');
        if (el) {
            el.textContent = `Priority Score: ${this.nfs.formatNumber(priorityScore)}`;
        }
    }

    updateTotalHeader() {
        const total = calculateCreateFormTotal(this.nfs);
        const headerEl = this.document.getElementById('createEffortHeader');
        if (headerEl) {
            headerEl.textContent = `Effort: ${this.nfs.formatNumber(total)}`;
        }
    }

    updateCommentCounter(used, max) {
        const counterText = this.document.getElementById('newCommentCounter')
            || this.document.getElementById('editCommentCounter');
        const bar = this.document.getElementById('newCommentCounterBar')
            || this.document.getElementById('editCommentCounterBar');
        const remaining = Math.max(0, max - used);
        const pct = Math.min(100, Math.max(0, (used / max) * 100));
        if (counterText) counterText.textContent = `Осталось: ${remaining}`;
        if (bar) {
            bar.style.setProperty('--fill', `${pct.toFixed(1)}%`);
            let color = 'var(--success)';
            if (pct >= 90) color = 'var(--danger)';
            else if (pct >= 70) color = 'var(--warning)';
            bar.style.setProperty('--color', color);
        }
    }

    setValue(id, value) {
        const el = this.document.getElementById(id);
        if (el) el.value = value;
    }
}
