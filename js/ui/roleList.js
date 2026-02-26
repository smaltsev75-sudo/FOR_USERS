// js/ui/roleList.js
import { escapeHtml } from '../utils/escapeHtml.js';
import { calculateAvailability, getRoleLoadColor, calculateTeamLoad } from '../domain/role.js';

export function renderRoleList(state, nfs) {
    const roleListEl = document.getElementById('roleList');
    if (!roleListEl) return;
    const config = state.config;
    const fragment = document.createDocumentFragment();

    state.roles.forEach(role => {
        const avail = calculateAvailability(role, config);
        const used = state.tasks.reduce((sum, t) => {
            if (t.excluded) return sum;
            return sum + (t.est[role.id] || 0);
        }, 0);
        const pct = avail.useful > 0 ? (used / avail.useful) * 100 : 0;
        const color = getRoleLoadColor(pct, config.alert);

        const row = document.createElement('div');
        row.className = 'role-res-row';
        row.dataset.role = role.id;
        row.innerHTML = `
            <span class="role-name-cell">${escapeHtml(role.name)}</span>
            <div>
                <div class="role-inline-stats">
                    <span class="role-load-numbers">${nfs.formatNumber(used)} / ${nfs.formatNumber(avail.useful)}  ч</span>
                    <span class="role-load-numbers">${nfs.formatNumber(pct)}%</span>
                </div>
                <div class="progress-bg"><div class="progress-fill" style="width:${Math.min(pct, 100)}%; background:${color}"></div></div>
            </div>
            <input type="text" class="input-fte number-input role-input-cell" value="${nfs.formatNumber(role.fte, 0)}" data-action="updateRole" data-field="fte" data-role="${role.id}" aria-label="${escapeHtml(role.name)} FTE %">
            <input type="number" class="input-off number-input role-input-cell" value="${role.off}" data-action="updateRole" data-field="off" data-role="${role.id}" min="0" step="1" aria-label="${escapeHtml(role.name)} отпуск (дней)">
        `;
        fragment.appendChild(row);
    });

    roleListEl.replaceChildren();
    roleListEl.appendChild(fragment);
}

export function renderTeamTotal(state, nfs) {
    const roleTotalEl = document.getElementById('roleTotal');
    if (!roleTotalEl) return;
    const config = state.config;
    const teamLoad = calculateTeamLoad(state.roles, state.tasks, config);
    const totalPercent = teamLoad.percentage;
    const color = getRoleLoadColor(totalPercent, config.alert);

    roleTotalEl.innerHTML = `
        <span class="role-name-cell">ИТОГО</span>
        <div>
            <div class="role-inline-stats">
                <span class="role-total-numbers">${nfs.formatNumber(teamLoad.totalUsed)} / ${nfs.formatNumber(teamLoad.totalAvailable)}  ч</span>
                <span class="role-total-numbers">${nfs.formatNumber(totalPercent)}%</span>
            </div>
            <div class="progress-bg" style="margin-top: 4px;"><div class="progress-fill" style="width:${Math.min(totalPercent, 100)}%; background:${color}"></div></div>
        </div>
        <div></div>
        <div></div>
    `;
}
