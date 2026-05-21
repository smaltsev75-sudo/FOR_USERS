// js/ui/teamCapacity.js
// «Team Capacity Dashboard» — премиум-карточки ролей, заменяющие старые
// Capacity Strip + role-list. Один компонент = header (общая загрузка с
// gauge) + grid из 5 карточек (иконка + bar + numbers + FTE/Off inputs).
//
// Public API:
//   renderTeamCapacity(state, nfs, opts?)
//     state: { config, roles, tasks }
//     nfs:   NumberFormatService (formatNumber)
//     opts:  { previewTask, previewMode } — для hover/drag preview
//
// DOM-контракт:
//   - Контейнер: #capacityStrip (исторический id, остался от Stream A)
//   - Inputs:    [data-action="updateRole"][data-field="fte"|"off"][data-role=X]
//                — слушает RoleController через делегирование на #capacityStrip
//
// Backward-compat: дублирует ключевые классы (.cap-segment*) на карточках, чтобы
// существующие e2e/unit тесты и CapacityStripController продолжали работать.
//
// Layer: UI. Без Store, без бизнес-логики (всё через domain/role.js).

import {
    simulateLoadDelta,
    getRoleLoadLevel,
    calculateTeamLoad
} from '../domain/role.js';
import { ICONS } from '../utils/icons.js';
import { escapeHtml } from '../utils/escapeHtml.js';

const ROLE_ICON_MAP = {
    uiux: 'rolePalette',
    ca: 'roleSearch',
    fe: 'roleCode',
    be: 'roleServer',
    qa: 'roleBugShield'
};

/**
 * @param {Object} state
 * @param {{formatNumber: Function}} nfs
 * @param {{previewTask?: Object|null, previewMode?: 'add'|'remove'}} [opts]
 */
export function renderTeamCapacity(state, nfs, opts = {}) {
    const root = document.getElementById('capacityStrip');
    if (!root) return;

    const config = state.config || {};
    const alert = typeof config.alert === 'number' ? config.alert : 3;
    const previewTask = opts.previewTask || null;
    const previewMode = opts.previewMode || 'add';

    const sim = simulateLoadDelta({
        roles: state.roles,
        tasks: state.tasks,
        config,
        mode: previewMode,
        task: previewTask
    });

    root.classList.add('team-cap');

    const fragment = document.createDocumentFragment();

    // ── Header: общая загрузка ────────────────────────────────────────────
    const total = calculateTeamLoad(state.roles, state.tasks, config);
    const totalLevel = getRoleLoadLevel(total.percentage, alert);

    const header = document.createElement('header');
    header.className = `team-cap__header team-cap__header--${totalLevel}`;
    header.setAttribute('role', 'group');
    header.setAttribute('aria-label', `Общая загрузка команды ${nfs.formatNumber(total.percentage, 0)}%`);

    const headerText = document.createElement('div');
    headerText.className = 'team-cap__header-text';
    const headerLabel = document.createElement('span');
    headerLabel.className = 'team-cap__header-label';
    headerLabel.textContent = 'Общая загрузка команды';
    const headerNumbers = document.createElement('span');
    headerNumbers.className = 'team-cap__header-numbers';
    headerNumbers.textContent = `${nfs.formatNumber(total.totalUsed)} / ${nfs.formatNumber(total.totalAvailable)} ч`;
    headerText.appendChild(headerLabel);
    headerText.appendChild(headerNumbers);

    const percentBlock = document.createElement('div');
    percentBlock.className = 'team-cap__header-percent';
    const percentValue = document.createElement('span');
    percentValue.className = 'team-cap__header-percent-value';
    percentValue.textContent = nfs.formatNumber(total.percentage, 0);
    const percentSign = document.createElement('span');
    percentSign.className = 'team-cap__header-percent-sign';
    percentSign.textContent = '%';
    percentBlock.appendChild(percentValue);
    percentBlock.appendChild(percentSign);

    // Gauge — semi-circular SVG (-90deg start, fills 270deg max for 100%)
    const gauge = document.createElement('div');
    gauge.className = 'team-cap__gauge';
    gauge.setAttribute('aria-hidden', 'true');
    const cappedPct = Math.min(total.percentage, 100);
    const dashLen = (cappedPct / 100) * 213.6; // 2*PI*r где r=34
    gauge.innerHTML = `
        <svg class="team-cap__gauge-svg" viewBox="0 0 80 80" focusable="false">
            <circle class="team-cap__gauge-track" cx="40" cy="40" r="34" />
            <circle class="team-cap__gauge-fill" cx="40" cy="40" r="34"
                    style="stroke-dasharray: ${dashLen.toFixed(1)} 213.6;" />
        </svg>
        <span class="team-cap__gauge-icon">${ICONS.gauge || ''}</span>
    `;

    header.appendChild(headerText);
    header.appendChild(percentBlock);
    header.appendChild(gauge);
    fragment.appendChild(header);

    // ── Cards: 5 карточек ролей ──────────────────────────────────────────
    const cardsGrid = document.createElement('div');
    cardsGrid.className = 'team-cap__cards';
    cardsGrid.setAttribute('role', 'list');

    state.roles.forEach((role) => {
        const data = sim.byRole[role.id] || {
            current: 0, next: 0, delta: 0, capacity: 0,
            currentPercent: 0, nextPercent: 0, deltaPercent: 0,
            currentOverload: false, nextOverload: false
        };
        const displayPercent = previewTask ? data.nextPercent : data.currentPercent;
        const level = getRoleLoadLevel(displayPercent, alert);
        const overload = data.currentOverload || (previewTask && data.nextOverload);

        const card = document.createElement('article');
        // dual-class: новый team-cap__card* + legacy cap-segment* (для backward compat)
        card.className = `team-cap__card team-cap__card--${level} cap-segment cap-segment--${level}`;
        if (overload) card.classList.add('team-cap__card--overload', 'cap-segment--overload');
        if (previewTask && data.delta !== 0) {
            card.classList.add('team-cap__card--preview', 'cap-segment--preview');
            card.classList.add(data.delta > 0 ? 'team-cap__card--preview-up' : 'team-cap__card--preview-down');
            card.classList.add(data.delta > 0 ? 'cap-segment--preview-up' : 'cap-segment--preview-down');
        }
        card.dataset.role = role.id;
        card.dataset.percent = String(Math.round(displayPercent));
        card.dataset.delta = String(data.delta);
        card.setAttribute('role', 'listitem');

        const labelText = `${role.name}: ${nfs.formatNumber(data.current)} из ${nfs.formatNumber(data.capacity)} ч (${nfs.formatNumber(data.currentPercent, 0)}%)`;
        card.setAttribute('aria-label', labelText);
        let titleText = labelText;
        if (previewTask && data.delta !== 0) {
            const sign = data.delta > 0 ? '+' : '';
            titleText += ` → ${sign}${nfs.formatNumber(data.delta)} ч (${sign}${nfs.formatNumber(data.deltaPercent, 0)}%)`;
        }
        card.title = titleText;

        // Header строки карточки: иконка + название + большой %
        const cardHead = document.createElement('header');
        cardHead.className = 'team-cap__card-head';

        const iconWrap = document.createElement('span');
        iconWrap.className = 'team-cap__card-icon';
        iconWrap.setAttribute('aria-hidden', 'true');
        const iconKey = ROLE_ICON_MAP[role.id] || 'rolePalette';
        iconWrap.innerHTML = ICONS[iconKey] || '';

        const nameEl = document.createElement('span');
        nameEl.className = 'team-cap__card-name cap-segment__label';
        nameEl.textContent = role.name;

        const pctWrap = document.createElement('span');
        pctWrap.className = 'team-cap__card-percent cap-segment__percent';
        const pctNum = document.createElement('span');
        pctNum.className = 'team-cap__card-percent-num';
        pctNum.textContent = nfs.formatNumber(displayPercent, 0);
        const pctSup = document.createElement('sup');
        pctSup.textContent = '%';
        pctWrap.appendChild(pctNum);
        pctWrap.appendChild(pctSup);

        if (previewTask && data.delta !== 0) {
            const deltaEl = document.createElement('span');
            deltaEl.className = 'team-cap__card-delta cap-segment__delta';
            const sign = data.delta > 0 ? '+' : '';
            deltaEl.textContent = `${sign}${nfs.formatNumber(data.deltaPercent, 0)}%`;
            pctWrap.appendChild(deltaEl);
        }

        cardHead.appendChild(iconWrap);
        cardHead.appendChild(nameEl);
        // pctWrap теперь добавляется отдельной строкой ниже (см. card.appendChild(pctWrap))

        // Bar (с overload-overlay)
        const barWrap = document.createElement('div');
        // dual-class: bar держит legacy cap-segment__track для backward compat hover preview tests
        barWrap.className = 'team-cap__card-bar cap-segment__track';

        const fill = document.createElement('div');
        fill.className = 'team-cap__card-bar-fill cap-segment__fill';
        fill.style.width = `${Math.min(displayPercent, 100)}%`;
        barWrap.appendChild(fill);

        if (overload) {
            const overloadBar = document.createElement('div');
            overloadBar.className = 'team-cap__card-bar-overload';
            barWrap.appendChild(overloadBar);
        }

        if (previewTask && data.delta !== 0) {
            const previewFill = document.createElement('div');
            previewFill.className = 'team-cap__card-bar-preview cap-segment__preview-fill';
            previewFill.style.width = `${Math.min(data.nextPercent, 100)}%`;
            barWrap.appendChild(previewFill);
        }

        // Numbers (compact)
        const numbersEl = document.createElement('div');
        numbersEl.className = 'team-cap__card-numbers';
        numbersEl.textContent = `${nfs.formatNumber(data.current)} / ${nfs.formatNumber(data.capacity)} ч`;

        // Controls: label СВЕРХУ pill, input + suffix внутри pill (grid 1fr auto)
        // на всю ширину карточки. На любых cards (даже 120px) цифра видна
        // полностью — нет горизонтального компромисса с label.
        const controls = document.createElement('div');
        controls.className = 'team-cap__card-controls';
        // v8.29: убран дублирующий suffix внутри pill — единица измерения
        // («%» / «д») уже присутствует в label. Раньше пользователь видел
        // дублирование: «FTE %  100 %» и «Отпуск (д)  5 д».
        controls.innerHTML = `
            <label class="team-cap__card-control" title="${escapeHtml(role.name)} FTE %">
                <span class="team-cap__card-control-label">FTE %</span>
                <span class="team-cap__card-control-pill">
                    <input type="text" class="input-fte number-input team-cap__card-control-input"
                           value="${nfs.formatNumber(role.fte, 0)}"
                           data-action="updateRole" data-field="fte" data-role="${role.id}"
                           aria-label="${escapeHtml(role.name)} FTE %">
                </span>
            </label>
            <label class="team-cap__card-control" title="${escapeHtml(role.name)} отпуск (дней)">
                <span class="team-cap__card-control-label">Отпуск (д)</span>
                <span class="team-cap__card-control-pill">
                    <input type="text" inputmode="decimal"
                           class="input-off number-input team-cap__card-control-input"
                           value="${Number.isInteger(Number(role.off)) ? String(role.off) : nfs.formatNumber(role.off, 1)}"
                           data-action="updateRole" data-field="off" data-role="${role.id}"
                           aria-label="${escapeHtml(role.name)} отпуск (дней)">
                </span>
            </label>
        `;

        card.appendChild(cardHead);
        card.appendChild(pctWrap);
        card.appendChild(barWrap);
        card.appendChild(numbersEl);
        card.appendChild(controls);

        cardsGrid.appendChild(card);
    });

    fragment.appendChild(cardsGrid);

    // Сохраняем фокус и позицию курсора через re-render — иначе при
    // вводе в input-fte/input-off на каждой клавише делается
    // store.updateRole() → renderApp() → root.replaceChildren() и DOM-узел
    // input'а уничтожается; браузер сбрасывает focus на body, и пользователь
    // может ввести только одну цифру за раз. Решение: до replaceChildren
    // запомнить ключ активного input'а (data-role + data-field) и selection,
    // после appendChild — найти новый узел с тем же ключом и восстановить.
    const active = document.activeElement;
    let focusInfo = null;
    if (active && root.contains(active) && active.tagName === 'INPUT'
        && active.dataset.role && active.dataset.field) {
        focusInfo = {
            role: active.dataset.role,
            field: active.dataset.field,
            selectionStart: active.selectionStart,
            selectionEnd: active.selectionEnd
        };
    }

    root.replaceChildren();
    root.appendChild(fragment);

    if (focusInfo) {
        const restored = root.querySelector(
            `input[data-role="${focusInfo.role}"][data-field="${focusInfo.field}"]`
        );
        if (restored) {
            restored.focus();
            // Курсор: если capture'нутый selectionStart валиден — используем его,
            // иначе ставим в конец (защита от reverse-digit бага, когда некоторые
            // типы input возвращают selectionStart=null и Chrome ставит курсор
            // в начало после focus(), из-за чего следующий keystroke вставляется
            // ПЕРЕД уже введёнными цифрами и «12» превращается в «21»).
            const len = restored.value.length;
            const start = Number.isInteger(focusInfo.selectionStart)
                ? Math.min(focusInfo.selectionStart, len) : len;
            const end = Number.isInteger(focusInfo.selectionEnd)
                ? Math.min(focusInfo.selectionEnd, len) : len;
            try {
                restored.setSelectionRange(start, end);
            } catch (_) { /* отдельные типы input не поддерживают setSelectionRange */ }
        }
    }
}

// Backward-compat: некоторые модули продолжают импортировать renderCapacityStrip
export { renderTeamCapacity as renderCapacityStrip };
