import { escapeHtml } from '../../utils/escapeHtml.js';
import { icon } from '../../utils/icons.js';

const ROLE_ICON_MAP = {
    uiux: 'rolePalette',
    ca: 'roleSearch',
    fe: 'roleCode',
    be: 'roleServer',
    qa: 'roleBugShield'
};

/**
 * Builds the estimates HTML for a task card.
 * @param {Object} task
 * @param {Array} roles
 * @param {Object} nfs
 * @param {number} taskTotal
 * @returns {string}
 */
export function buildEstimatesHtml(task, roles, nfs, _taskTotal) {
    const maxVal = Math.max(1, ...roles.map(r => Number(task.est[r.id]) || 0));
    let chips = '';
    roles.forEach(role => {
        const val = Number(task.est[role.id]) || 0;
        const barPct = maxVal > 0 ? Math.min(100, (val / maxVal) * 100) : 0;
        const iconName = ROLE_ICON_MAP[role.id] || 'rolePalette';
        const filled = val > 0 ? 'est-box--filled' : 'est-box--empty';
        chips += `
            <div class="est-box ${filled}">
                <div class="est-box-header">
                    <span class="est-role-icon" aria-hidden="true">${icon(iconName)}</span>
                    <span class="est-role-label">${escapeHtml(role.name)}</span>
                </div>
                <div class="est-box-bar" aria-hidden="true">
                    <span class="est-box-bar-fill" style="width: ${barPct}%"></span>
                </div>
                <div class="est-input-container">
                    <input type="text" class="number-input" value="${nfs.formatNumber(val)}"
                           data-action="updateEst" data-id="${task.id}" data-role="${role.id}"
                           aria-label="${escapeHtml(role.name)} часы" ${task.excluded ? 'disabled' : ''}>
                    <span class="est-box-suffix">ч</span>
                </div>
                <div class="overload-placeholder" data-role="${role.id}"></div>
            </div>
        `;
    });
    // SM-комментарий рендерится НЕ здесь: в строке — иконка (taskCard.js),
    // редактирование — в модалке #noteModal. Σ Effort total тоже убран (в бейдже).
    return `
        <div class="task-estimates-label">Оценка трудозатрат</div>
        <div class="task-estimates-grid">
            <div class="task-estimates-roles">${chips}</div>
        </div>
    `;
}
