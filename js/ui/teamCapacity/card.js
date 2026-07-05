import { getRoleLoadLevel } from '../../domain/role.js';
import { escapeHtml } from '../../utils/escapeHtml.js';
import { ICONS } from '../../utils/icons.js';
import { clampPercentWidth, formatSignedUiPercent, formatUiPercent } from '../../utils/percent.js';

const ROLE_ICON_MAP = {
    uiux: 'rolePalette',
    ca: 'roleSearch',
    fe: 'roleCode',
    be: 'roleServer',
    qa: 'roleBugShield'
};

export function createTeamCapacityCardsGrid(roles, byRole, options) {
    const cardsGrid = document.createElement('div');
    cardsGrid.className = 'team-cap__cards';
    cardsGrid.setAttribute('role', 'list');

    roles.forEach((role) => {
        cardsGrid.appendChild(createTeamCapacityCard(role, byRole[role.id], options));
    });

    return cardsGrid;
}

function createTeamCapacityCard(role, roleData, options) {
    const { nfs, previewTask, alert } = options;
    const data = roleData || {
        current: 0, next: 0, delta: 0, capacity: 0,
        currentPercent: 0, nextPercent: 0, deltaPercent: 0,
        currentOverload: false, nextOverload: false
    };
    const displayPercent = previewTask ? data.nextPercent : data.currentPercent;
    const level = getRoleLoadLevel(displayPercent, alert);
    const overload = data.currentOverload || (previewTask && data.nextOverload);

    const card = document.createElement('article');
    card.className = `team-cap__card team-cap__card--${level}`;
    if (overload) card.classList.add('team-cap__card--overload');
    if (previewTask && data.delta !== 0) {
        card.classList.add('team-cap__card--preview');
        card.classList.add(data.delta > 0 ? 'team-cap__card--preview-up' : 'team-cap__card--preview-down');
    }
    card.dataset.role = role.id;
    card.dataset.percent = formatUiPercent(displayPercent);
    card.dataset.delta = String(data.delta);
    card.setAttribute('role', 'listitem');

    const labelText = `${role.name}: ${nfs.formatNumber(data.current)} из ${nfs.formatNumber(data.capacity)} ч (${formatUiPercent(data.currentPercent)}%)`;
    card.setAttribute('aria-label', labelText);
    if (previewTask && data.delta !== 0) {
        const sign = data.delta > 0 ? '+' : '';
        card.title = `Что изменится: ${sign}${nfs.formatNumber(data.delta)} ч (${formatSignedUiPercent(data.deltaPercent)})`;
    }

    const { cardHead, pctWrap } = createCardHeader(role, displayPercent, data, previewTask);
    card.appendChild(cardHead);
    card.appendChild(pctWrap);
    card.appendChild(createCardBar(displayPercent, data, overload, previewTask));
    card.appendChild(createCardNumbers(data, nfs));
    card.appendChild(createCardControls(role, nfs));

    return card;
}

function createCardHeader(role, displayPercent, data, previewTask) {
    const cardHead = document.createElement('header');
    cardHead.className = 'team-cap__card-head';

    const iconWrap = document.createElement('span');
    iconWrap.className = 'team-cap__card-icon';
    iconWrap.setAttribute('aria-hidden', 'true');
    const iconKey = ROLE_ICON_MAP[role.id] || 'rolePalette';
    iconWrap.innerHTML = ICONS[iconKey] || '';

    const nameEl = document.createElement('span');
    nameEl.className = 'team-cap__card-name';
    nameEl.textContent = role.name;

    const pctWrap = document.createElement('span');
    pctWrap.className = 'team-cap__card-percent';
    const pctNum = document.createElement('span');
    pctNum.className = 'team-cap__card-percent-num';
    pctNum.textContent = formatUiPercent(displayPercent);
    const pctSup = document.createElement('sup');
    pctSup.textContent = '%';
    pctWrap.appendChild(pctNum);
    pctWrap.appendChild(pctSup);

    if (previewTask && data.delta !== 0) {
        const deltaEl = document.createElement('span');
        deltaEl.className = 'team-cap__card-delta';
        deltaEl.textContent = formatSignedUiPercent(data.deltaPercent);
        pctWrap.appendChild(deltaEl);
    }

    cardHead.appendChild(iconWrap);
    cardHead.appendChild(nameEl);
    return { cardHead, pctWrap };
}

function createCardBar(displayPercent, data, overload, previewTask) {
    const barWrap = document.createElement('div');
    barWrap.className = 'team-cap__card-bar';

    const fill = document.createElement('div');
    fill.className = 'team-cap__card-bar-fill';
    fill.style.width = `${clampPercentWidth(displayPercent)}%`;
    barWrap.appendChild(fill);

    if (overload) {
        const overloadBar = document.createElement('div');
        overloadBar.className = 'team-cap__card-bar-overload';
        barWrap.appendChild(overloadBar);
    }

    if (previewTask && data.delta !== 0) {
        const previewFill = document.createElement('div');
        previewFill.className = 'team-cap__card-bar-preview';
        previewFill.style.width = `${clampPercentWidth(data.nextPercent)}%`;
        barWrap.appendChild(previewFill);
    }

    return barWrap;
}

function createCardNumbers(data, nfs) {
    const numbersEl = document.createElement('div');
    numbersEl.className = 'team-cap__card-numbers';
    numbersEl.textContent = `${nfs.formatNumber(data.current)} / ${nfs.formatNumber(data.capacity)} ч`;
    return numbersEl;
}

function createCardControls(role, nfs) {
    const controls = document.createElement('div');
    controls.className = 'team-cap__card-controls';
    // v8.29: убран дублирующий suffix внутри pill — единица измерения
    // («%» / «д») уже присутствует в label.
    controls.innerHTML = `
        <label class="team-cap__card-control">
            <span class="team-cap__card-control-label">FTE %</span>
            <span class="team-cap__card-control-pill">
                <input type="text" class="input-fte number-input team-cap__card-control-input"
                       value="${nfs.formatNumber(role.fte, 0)}"
                       data-action="updateRole" data-field="fte" data-role="${role.id}"
                       aria-label="${escapeHtml(role.name)} FTE %">
            </span>
        </label>
        <label class="team-cap__card-control">
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
    return controls;
}
