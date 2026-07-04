import { formatUiPercent } from '../../utils/percent.js';
import { createTeamCapacityGauge } from './gauge.js';

export function createTeamCapacityHeader(total, totalLevel, nfs) {
    const header = document.createElement('header');
    header.className = `team-cap__header team-cap__header--${totalLevel}`;
    header.setAttribute('role', 'group');
    header.setAttribute('aria-label', `Общая загрузка команды ${formatUiPercent(total.percentage)}%`);

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
    percentValue.textContent = formatUiPercent(total.percentage);
    const percentSign = document.createElement('span');
    percentSign.className = 'team-cap__header-percent-sign';
    percentSign.textContent = '%';
    percentBlock.appendChild(percentValue);
    percentBlock.appendChild(percentSign);

    header.appendChild(headerText);
    header.appendChild(percentBlock);
    header.appendChild(createTeamCapacityGauge(total.percentage));
    return header;
}
