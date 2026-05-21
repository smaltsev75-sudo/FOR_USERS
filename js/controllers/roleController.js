// js/controllers/roleController.js
import { parseRoleField } from '../domain/roleFieldContract.js';

export class RoleController {
    constructor(store, numberFormatService) {
        this.store = store;
        this.nfs = numberFormatService;
        // v8.21+: inputs живут внутри Team Capacity Dashboard (#capacityStrip).
        this.containerEl = document.getElementById('capacityStrip');
    }

    init() {
        this.attachEvents();
    }

    attachEvents() {
        if (this.containerEl) {
            this.containerEl.addEventListener('input', (e) => {
                this.handleRoleInput(e);
            });
            this.containerEl.addEventListener('change', (e) => {
                this.handleRoleUpdate(e);
            });
            this.containerEl.addEventListener('blur', (e) => {
                this.handleRoleBlur(e);
            }, true);
        }
    }

    /**
     * v8.30.32: единый контракт через domain/roleFieldContract.js.
     *   FTE — integer ≥0 без верхнего лимита (200% = два full-time).
     *   off — decimal ≥0, 1 знак после запятой (0.5 = пол-дня), «,» и «.» равны.
     * @param {'fte'|'off'} field
     * @param {string} rawValue
     * @returns {number|null}
     */
    _parseRoleFieldValue(field, rawValue) {
        return parseRoleField(field, rawValue);
    }

    /**
     * v8.30.31: aria-invalid выставляется ТОЛЬКО когда поле непустое и парсер
     * вернул null (т.е. ввод был — но он невалиден). Пустое поле в процессе
     * редактирования (Backspace до конца) — НЕ "invalid", aria-invalid снят.
     */
    _setFieldValidity(target, valid) {
        if (valid) {
            target.removeAttribute('aria-invalid');
            target.classList.remove('error');
        } else {
            target.setAttribute('aria-invalid', 'true');
            target.classList.add('error');
        }
    }

    handleRoleInput(e) {
        const target = e.target;
        const roleId = target.dataset.role;
        const field = target.dataset.field;
        if (!roleId || !field) return;
        const raw = target.value;
        if (raw === '') {
            // пустое поле в процессе редактирования — не invalid, не update
            target.removeAttribute('aria-invalid');
            target.classList.remove('error');
            return;
        }
        const value = this._parseRoleFieldValue(field, raw);
        if (value === null) {
            this._setFieldValidity(target, false);
            return;
        }
        this._setFieldValidity(target, true);
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
        if (value === null) {
            this._setFieldValidity(target, false);
            return;
        }
        this._setFieldValidity(target, true);
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
            // v8.30.32: off — decimal с 1 знаком после запятой. Если целое (0, 5)
            // показываем без дроби; если дробь — с одним знаком (используя
            // выбранный пользователем разделитель «,» или «.»).
            const value = Number(role.off);
            if (Number.isInteger(value)) {
                target.value = String(value);
            } else {
                target.value = this.nfs.formatNumber(value, 1);
            }
        }
    }
}
