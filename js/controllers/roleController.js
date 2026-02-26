// js/controllers/roleController.js
export class RoleController {
    constructor(store, numberFormatService) {
        this.store = store;
        this.nfs = numberFormatService;
        this.roleListEl = document.getElementById('roleList');
    }

    init() {
        this.attachEvents();
    }

    attachEvents() {
        if (this.roleListEl) {
            this.roleListEl.addEventListener('input', (e) => {
                this.handleRoleInput(e);
            });
            this.roleListEl.addEventListener('change', (e) => {
                this.handleRoleUpdate(e);
            });
            this.roleListEl.addEventListener('blur', (e) => {
                this.handleRoleBlur(e);
            }, true);
        }
    }

    /**
     * Парсит значение поля роли из строки.
     * @param {'fte'|'off'} field
     * @param {string} rawValue
     * @returns {number|null} Число или null, если значение невалидно
     */
    _parseRoleFieldValue(field, rawValue) {
        if (field === 'off') {
            const value = parseInt(rawValue, 10);
            return Number.isNaN(value) ? null : Math.max(0, value);
        }
        if (field === 'fte') {
            const value = this.nfs.parseNumber(rawValue);
            return Number.isNaN(value) ? null : Math.max(0, Math.round(value));
        }
        return null;
    }

    handleRoleInput(e) {
        const target = e.target;
        const roleId = target.dataset.role;
        const field = target.dataset.field;
        if (!roleId || !field) return;
        const value = this._parseRoleFieldValue(field, target.value);
        if (value === null) return;
        this.store.updateRole(roleId, { [field]: value });
    }

    handleRoleUpdate(e) {
        const target = e.target;
        const roleId = target.dataset.role;
        const field = target.dataset.field;
        if (!roleId || !field) return;

        const role = this.store.getState().roles.find(r => r.id === roleId);
        if (!role) return;

        const value = this._parseRoleFieldValue(field, target.value);
        if (value === null) return;
        this.store.updateRole(roleId, { [field]: value });
    }

    handleRoleBlur(e) {
        const target = e.target;
        const roleId = target.dataset.role;
        const field = target.dataset.field;
        if (!roleId || !field) return;

        const role = this.store.getState().roles.find(r => r.id === roleId);
        if (!role) return;

        if (field === 'fte') {
            target.value = this.nfs.formatNumber(role.fte, 0);
            return;
        }

        if (field === 'off') {
            target.value = String(role.off);
        }
    }
}
