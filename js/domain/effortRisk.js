// @ts-check

const KNOWN_ROLE_IDS = ['uiux', 'ca', 'fe', 'be', 'qa'];
const DEV_ROLE_IDS = ['fe', 'be'];
const NON_DEV_ROLE_IDS = ['uiux', 'ca'];

const SIGNAL_PRIORITY = { high: 3, medium: 2, low: 1 };

function positiveNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function buildEffortMap(task, roles) {
    const est = task?.est || {};
    const map = {};
    roles.forEach((role) => {
        map[role.id] = positiveNumber(est[role.id]);
    });
    KNOWN_ROLE_IDS.forEach((id) => {
        if (!(id in map)) map[id] = positiveNumber(est[id]);
    });
    return map;
}

function hasEffort(map, roleId) {
    return positiveNumber(map[roleId]) > 0;
}

function sumEffort(map, roleIds) {
    return roleIds.reduce((total, roleId) => total + positiveNumber(map[roleId]), 0);
}

function detectProfile(task, map) {
    const uiux = hasEffort(map, 'uiux');
    const ca = hasEffort(map, 'ca');
    const fe = hasEffort(map, 'fe');
    const be = hasEffort(map, 'be');
    const qa = hasEffort(map, 'qa');
    const nonZeroIds = KNOWN_ROLE_IDS.filter((id) => hasEffort(map, id));
    const nonZeroCount = nonZeroIds.length;

    if (uiux && nonZeroCount === 1) {
        return { id: 'uiux_only', label: 'UI/UX only', expectedRoleIds: ['uiux'] };
    }
    if (ca && nonZeroCount === 1) {
        return { id: 'ca_only', label: 'CA only', expectedRoleIds: ['ca'] };
    }
    if (fe && !be && qa && nonZeroCount <= 3) {
        return { id: 'fe_qa', label: 'FE + QA', expectedRoleIds: ['fe', 'qa'] };
    }
    if (be && !fe && qa && nonZeroCount <= 3) {
        return { id: 'be_qa', label: 'BE + QA', expectedRoleIds: ['be', 'qa'] };
    }
    if (fe && be && qa && nonZeroCount === 3) {
        return { id: 'fe_be_qa', label: 'FE + BE + QA', expectedRoleIds: ['fe', 'be', 'qa'] };
    }
    if ((fe || be) && !qa) {
        const devIds = [...(fe ? ['fe'] : []), ...(be ? ['be'] : [])];
        const label = devIds.map((id) => id.toUpperCase()).join(' + ');
        return {
            id: `${devIds.join('_')}_without_qa`,
            label,
            expectedRoleIds: [...devIds, 'qa']
        };
    }
    return { id: 'mixed', label: 'Mixed', expectedRoleIds: nonZeroIds };
}

function roleName(role) {
    return role.name || role.id.toUpperCase();
}

function okSignal(role) {
    return {
        roleId: role.id,
        roleName: roleName(role),
        direction: 'ok',
        severity: 'low',
        label: '',
        message: ''
    };
}

function makeSignal(role, direction, severity, message) {
    const name = roleName(role);
    return {
        roleId: role.id,
        roleName: name,
        direction,
        severity,
        label: `${name}${direction === 'up' ? '↑' : '↓'}`,
        message
    };
}

function shouldFlagUnexpectedRole(profile, roleId, value, total) {
    if (value <= 0) return false;
    if (profile.id === 'mixed') return false;
    if (profile.expectedRoleIds.includes(roleId)) return false;
    const absoluteThreshold = roleId === 'ca' ? 4 : 3;
    const shareThreshold = total >= 12 ? total * 0.2 : absoluteThreshold;
    return value >= Math.max(absoluteThreshold, shareThreshold);
}

function buildRoleSignals(map, roles, profile) {
    const roleById = Object.fromEntries(roles.map((role) => [role.id, role]));
    KNOWN_ROLE_IDS.forEach((id) => {
        if (!roleById[id]) roleById[id] = { id, name: id.toUpperCase() };
    });

    const signals = {};
    const total = sumEffort(map, KNOWN_ROLE_IDS);
    const devHours = sumEffort(map, DEV_ROLE_IDS);
    const qaHours = positiveNumber(map.qa);

    KNOWN_ROLE_IDS.forEach((roleId) => {
        const role = roleById[roleId];
        const value = positiveNumber(map[roleId]);
        signals[roleId] = okSignal(role);

        if (roleId === 'qa' && devHours > 0) {
            if (qaHours === 0) {
                signals.qa = makeSignal(role, 'down', 'high', 'QA = 0 при dev-работе');
            } else if (qaHours < Math.max(3, devHours * 0.18)) {
                signals.qa = makeSignal(role, 'down', 'medium', 'QA ниже ожидаемой проверки относительно dev-работы');
            }
            return;
        }

        if (NON_DEV_ROLE_IDS.includes(roleId) && shouldFlagUnexpectedRole(profile, roleId, value, total)) {
            const message = roleId === 'ca'
                ? 'CA выше ожидаемого участия для профиля работ'
                : 'UI/UX выше ожидаемого участия для профиля работ';
            signals[roleId] = makeSignal(role, 'up', 'medium', message);
        }
    });

    return signals;
}

function visibleSignals(roleSignals) {
    return Object.values(roleSignals)
        .filter((signal) => signal.direction !== 'ok')
        .sort((a, b) => (SIGNAL_PRIORITY[b.severity] || 0) - (SIGNAL_PRIORITY[a.severity] || 0));
}

function severityFrom(signals) {
    if (signals.some((signal) => signal.severity === 'high')) return 'high';
    if (signals.some((signal) => signal.severity === 'medium')) return 'medium';
    return 'low';
}

function severityLabel(severity) {
    if (severity === 'high') return 'высокие';
    if (severity === 'medium') return 'средние';
    return 'низкие';
}

function buildRecommendation(severity, signals) {
    if (severity === 'low') {
        return 'Риски оценки низкие. Дополнительное действие не требуется.';
    }
    const roleList = signals.map((signal) => signal.roleName).join(', ');
    return `Стоит уточнить допущения по ролям: ${roleList}. Не менять оценку автоматически.`;
}

function buildTooltip(profile, severity, signals) {
    const lines = [`Риски оценки: ${severityLabel(severity)}`];
    if (signals.length === 0) {
        lines.push(`Профиль ${profile.label}: заметных вопросов к распределению ролей нет.`);
        return lines.join('\n');
    }
    signals.forEach((signal) => lines.push(signal.message));
    lines.push(buildRecommendation(severity, signals));
    return lines.join('\n');
}

/**
 * Compares current role effort estimates against an inferred work profile.
 * It does not use historical actuals and never mutates expert estimates.
 *
 * @param {Object} task
 * @param {Array<{id:string,name?:string}>} [roles]
 */
export function analyseEffortRisk(task, roles = []) {
    const safeRoles = Array.isArray(roles) ? roles : [];
    const map = buildEffortMap(task, safeRoles);
    const profile = detectProfile(task, map);
    const roleSignals = buildRoleSignals(map, safeRoles, profile);
    const signals = visibleSignals(roleSignals);
    const severity = severityFrom(signals);

    return {
        profile,
        severity,
        roleSignals,
        signals,
        summary: signals.map((signal) => signal.label).join(' · '),
        recommendation: buildRecommendation(severity, signals),
        tooltip: buildTooltip(profile, severity, signals)
    };
}
