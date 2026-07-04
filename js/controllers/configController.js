// js/controllers/configController.js

import { ConfigFormAdapter } from './config/configFormAdapter.js';
import { wireConfigControllerEvents } from './config/configEventWiring.js';
import {
    applyAvailCoef,
    applyDays,
    applyHolidays,
    calculateEndDate,
    getConfigSignature,
    resetConfig
} from './config/configActions.js';
import {
    handleConfigAlertChange,
    handleConfigAvailCoefChange,
    handleConfigAvailCoefInput,
    handleConfigDaysChange,
    handleConfigDaysInput,
    handleConfigEndDateChange,
    handleConfigHolidaysChange,
    handleConfigHolidaysInput,
    handleConfigProductChange,
    handleConfigReset,
    handleConfigStartDateChange
} from './config/configFieldActions.js';

export class ConfigController {
    /**
     * @param {Object} store - хранилище состояния приложения
     * @param {Object} nfs - сервис форматирования чисел
     */
    constructor(store, nfs) {
        this.store = store;
        this.nfs = nfs;
        this.unsubscribe = null;
        this.lastConfigSignature = '';
        this.form = new ConfigFormAdapter(nfs);
        // CTRL-3 (DEEP-REFAC 2026-06-21): вестигиальные .bind() удалены — все
        // хендлеры передаются arrow-обёртками в configEventWiring и вызываются
        // method-call'ом, `this` корректен без bind.
        // Доказательство: handleProductChange биндился идентично, но в bind-списке
        // отсутствовал и работал — значит bind'ы были мёртвым остатком рефактора.
    }

    /**
     * Инициализация контроллера: подписка на события DOM и изменения store.
     */
    init() {
        this.attachEvents();
        // v8.30.33: mobile compact disclosure для cfg-section--coef.
        // На mobile (≤600px) #cfgAdvanced collapse'ится по умолчанию (open
        // удаляется); на desktop остаётся open. Без display:none — feature
        // parity сохранена. Resize не закрывает уже открытый <details>.
        this._applyMobileAdvancedDefault();
        // Подписываемся только на изменения конфигурации, чтобы синхронизировать поля ввода.
        this.unsubscribe = this.store.subscribe((state) => {
            const signature = this.getConfigSignature(state.config);
            if (signature === this.lastConfigSignature) return;
            this.lastConfigSignature = signature;
            this.updateInputsFromState(state.config);
        });
        const initialConfig = this.store.getState().config;
        this.lastConfigSignature = this.getConfigSignature(initialConfig);
        this.updateInputsFromState(initialConfig);
    }

    /**
     * v8.30.33: на mobile (≤600px) сворачивает <details id="cfgAdvanced">
     * (коэффициент доступности + порог алерта). На desktop остаётся открытым.
     * Защита от undefined matchMedia (старые jsdom).
     */
    _applyMobileAdvancedDefault() {
        this.form.applyMobileAdvancedDefault();
    }

    /**
     * Освобождение ресурсов: отписка от store при уничтожении контроллера.
     */
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    applyDays(days) {
        return applyDays(this.store, days);
    }

    applyAvailCoef(availCoef) {
        return applyAvailCoef(this.store, this.nfs, availCoef);
    }

    /**
     * Подключение обработчиков событий DOM для полей конфигурации и кнопок.
     */
    attachEvents() {
        wireConfigControllerEvents(this);
    }

    /**
     * Обновление всех полей ввода из текущей конфигурации store.
     */
    updateInputsFromState(config = this.store.getState().config) {
        if (!config) return;
        this.form.syncFromState(config);
    }

    getConfigSignature(config = {}) {
        return getConfigSignature(config);
    }

    /**
     * Обработка изменения названия продукта.
     */
    handleProductChange(e) {
        return handleConfigProductChange({ target: e.target, store: this.store });
    }

    /**
     * Обработка ввода количества дней спринта (в реальном времени).
     */
    handleDaysInput(e) {
        return handleConfigDaysInput({ target: e.target, applyDays: (days) => this.applyDays(days) });
    }

    handleDaysChange(e) {
        return handleConfigDaysChange({
            target: e.target,
            store: this.store,
            applyDays: (days) => this.applyDays(days)
        });
    }

    /**
     * Обработка изменения даты начала спринта.
     */
    handleStartDateChange(e) {
        return handleConfigStartDateChange({ target: e.target, store: this.store });
    }

    /**
     * Обработка ручного изменения даты окончания спринта.
     * При изменении даты окончания пересчитывается количество рабочих дней.
     */
    handleEndDateChange(e) {
        return handleConfigEndDateChange({ target: e.target, store: this.store });
    }

    /**
     * Обработка ввода количества праздничных дней (в реальном времени).
     */
    handleHolidaysInput(e) {
        return handleConfigHolidaysInput({
            target: e.target,
            applyHolidays: (holidays) => this.applyHolidays(holidays)
        });
    }

    /**
     * Обработка окончательного изменения количества праздничных дней (blur).
     */
    handleHolidaysChange(e) {
        return handleConfigHolidaysChange({
            target: e.target,
            store: this.store,
            applyHolidays: (holidays) => this.applyHolidays(holidays)
        });
    }

    /**
     * Применяет новое количество праздничных дней и пересчитывает дни спринта.
     */
    applyHolidays(holidays) {
        return applyHolidays(this.store, holidays);
    }

    /**
     * Обработка ввода коэффициента доступности (в реальном времени).
     */
    handleAvailCoefInput(e) {
        return handleConfigAvailCoefInput({
            target: e.target,
            nfs: this.nfs,
            applyAvailCoef: (availCoef) => this.applyAvailCoef(availCoef)
        });
    }

    handleAvailCoefChange(e) {
        return handleConfigAvailCoefChange({
            target: e.target,
            store: this.store,
            nfs: this.nfs,
            applyAvailCoef: (availCoef) => this.applyAvailCoef(availCoef)
        });
    }

    /**
     * Обработка изменения порога предупреждения о перегрузке.
     */
    handleAlertChange(e) {
        return handleConfigAlertChange({ target: e.target, store: this.store });
    }

    /**
     * Сброс конфигурации к значениям по умолчанию.
     */
    handleResetConfig() {
        return handleConfigReset({ store: this.store, resetConfig });
    }

    /**
     * Вычисляет дату окончания спринта по дате начала и количеству дней.
     * @param {string} startDate - дата начала в формате YYYY-MM-DD
     * @param {number} days - количество рабочих дней спринта
     * @returns {string} дата окончания в формате YYYY-MM-DD
     */
    calculateEndDate(startDate, days) {
        return calculateEndDate(startDate, days);
    }
}
