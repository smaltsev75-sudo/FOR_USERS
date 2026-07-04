import { ICONS } from '../../utils/icons.js';
import { clampPercentWidth } from '../../utils/percent.js';

export function createTeamCapacityGauge(percentage) {
    const gauge = document.createElement('div');
    gauge.className = 'team-cap__gauge';
    gauge.setAttribute('aria-hidden', 'true');

    const cappedPct = clampPercentWidth(percentage);
    const dashLen = (cappedPct / 100) * 213.6; // 2*PI*r where r=34
    gauge.innerHTML = `
        <svg class="team-cap__gauge-svg" viewBox="0 0 80 80" focusable="false">
            <circle class="team-cap__gauge-track" cx="40" cy="40" r="34" />
            <circle class="team-cap__gauge-fill" cx="40" cy="40" r="34"
                    style="stroke-dasharray: ${dashLen.toFixed(1)} 213.6;" />
        </svg>
        <span class="team-cap__gauge-icon">${ICONS.gauge || ''}</span>
    `;

    return gauge;
}
