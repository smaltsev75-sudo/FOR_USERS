import { parseRoleField } from '../../domain/roleFieldContract.js';

export function parseRoleFieldValue(field, rawValue) {
    return parseRoleField(field, rawValue);
}

export function setRoleFieldValidity(target, valid) {
    if (valid) {
        target.removeAttribute('aria-invalid');
        target.classList.remove('error');
    } else {
        target.setAttribute('aria-invalid', 'true');
        target.classList.add('error');
    }
}

function readRoleTarget(target) {
    const roleId = target?.dataset?.role;
    const field = target?.dataset?.field;
    if (!roleId || !field) return null;
    return { roleId, field };
}

function findRole(store, roleId) {
    return store.getState().roles.find(role => role.id === roleId);
}

export function applyRoleInputValue({ target, store }) {
    const roleTarget = readRoleTarget(target);
    if (!roleTarget) return;

    const { roleId, field } = roleTarget;
    if (target.value === '') {
        setRoleFieldValidity(target, true);
        return;
    }

    const value = parseRoleFieldValue(field, target.value);
    if (value === null) {
        setRoleFieldValidity(target, false);
        return;
    }

    setRoleFieldValidity(target, true);
    store.updateRole(roleId, { [field]: value });
}

export function applyRoleChangeValue({ target, store }) {
    const roleTarget = readRoleTarget(target);
    if (!roleTarget) return;

    const { roleId, field } = roleTarget;
    const role = findRole(store, roleId);
    if (!role) return;

    const value = parseRoleFieldValue(field, target.value);
    if (value === null) {
        setRoleFieldValidity(target, false);
        return;
    }

    setRoleFieldValidity(target, true);
    store.updateRole(roleId, { [field]: value });
}

export function formatRoleFieldOnBlur({ target, store, nfs }) {
    const roleTarget = readRoleTarget(target);
    if (!roleTarget) return;

    const { roleId, field } = roleTarget;
    const role = findRole(store, roleId);
    if (!role) return;

    if (field === 'fte') {
        target.value = nfs.formatNumber(role.fte, 0);
        return;
    }

    if (field === 'off') {
        const value = Number(role.off);
        target.value = Number.isInteger(value) ? String(value) : nfs.formatNumber(value, 1);
    }
}
