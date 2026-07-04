// js/controllers/roleController.js
import {
    applyRoleChangeValue,
    applyRoleInputValue,
    formatRoleFieldOnBlur,
    parseRoleFieldValue,
    setRoleFieldValidity
} from './role/roleInputActions.js';

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
        return parseRoleFieldValue(field, rawValue);
    }

    /**
     * v8.30.31: aria-invalid выставляется ТОЛЬКО когда поле непустое и парсер
     * вернул null (т.е. ввод был — но он невалиден). Пустое поле в процессе
     * редактирования (Backspace до конца) — НЕ "invalid", aria-invalid снят.
     */
    _setFieldValidity(target, valid) {
        return setRoleFieldValidity(target, valid);
    }

    handleRoleInput(e) {
        return applyRoleInputValue({ target: e.target, store: this.store });
    }

    handleRoleUpdate(e) {
        return applyRoleChangeValue({ target: e.target, store: this.store });
    }

    handleRoleBlur(e) {
        return formatRoleFieldOnBlur({ target: e.target, store: this.store, nfs: this.nfs });
    }
}
