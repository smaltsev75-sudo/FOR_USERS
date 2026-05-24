// js/controllers/configController.js

import { messageService } from '../services/message.js';
import { createDefaultConfig } from '../domain/config.js';
import { parseDate } from '../utils/date.js';
import { parseStrictInteger } from '../domain/strictInteger.js';
import {
    calculateSprintEndDate,
    createDaysPatch,
    createEndDatePatch,
    createHolidaysPatch,
    createStartDatePatch
} from '../domain/sprintSchedule.js';
import { ConfigFormAdapter } from './config/configFormAdapter.js';

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
        // Bind event-handler methods so they can be passed as callbacks
        this.updateInputsFromState = this.updateInputsFromState.bind(this);
        this.handleDaysInput = this.handleDaysInput.bind(this);
        this.handleDaysChange = this.handleDaysChange.bind(this);
        this.handleStartDateChange = this.handleStartDateChange.bind(this);
        this.handleEndDateChange = this.handleEndDateChange.bind(this);
        this.handleHolidaysInput = this.handleHolidaysInput.bind(this);
        this.handleHolidaysChange = this.handleHolidaysChange.bind(this);
        this.handleAvailCoefInput = this.handleAvailCoefInput.bind(this);
        this.handleAvailCoefChange = this.handleAvailCoefChange.bind(this);
        this.handleAlertChange = this.handleAlertChange.bind(this);
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
        const currentConfig = this.store.getState().config ?? {};
        const { days: currentDays } = currentConfig;
        if (currentDays === days) return false;

        this.store.setConfig(createDaysPatch(currentConfig, days));
        return true;
    }

    applyAvailCoef(availCoef) {
        const normalized = this.nfs.roundToDecimals(availCoef, 1);
        const { availCoef: currentCoef } = this.store.getState().config ?? {};
        if (currentCoef === normalized) return false;
        this.store.setConfig({ availCoef: normalized });
        return true;
    }

    /**
     * Подключение обработчиков событий DOM для полей конфигурации и кнопок.
     */
    attachEvents() {
        this.form.attachEvents({
            onProductChange: (e) => this.handleProductChange(e),
            onDaysInput: (e) => this.handleDaysInput(e),
            onDaysChange: (e) => this.handleDaysChange(e),
            onStartDateChange: (e) => this.handleStartDateChange(e),
            onEndDateChange: (e) => this.handleEndDateChange(e),
            onHolidaysInput: (e) => this.handleHolidaysInput(e),
            onHolidaysChange: (e) => this.handleHolidaysChange(e),
            onAvailCoefInput: (e) => this.handleAvailCoefInput(e),
            onAvailCoefChange: (e) => this.handleAvailCoefChange(e),
            onAlertChange: (e) => this.handleAlertChange(e),
            onResetConfig: () => this.handleResetConfig()
        });
    }

    /**
     * Обновление всех полей ввода из текущей конфигурации store.
     */
    updateInputsFromState(config = this.store.getState().config) {
        if (!config) return;
        this.form.syncFromState(config);
    }

    getConfigSignature(config = {}) {
        return [
            config.product ?? '',
            config.days ?? '',
            config.holidays ?? '',
            config.startDate ?? '',
            config.endDate ?? '',
            config.availCoef ?? '',
            config.alert ?? ''
        ].join('|');
    }

    /**
     * Обработка изменения названия продукта.
     */
    handleProductChange(e) {
        const newProduct = e.target.value.trim();
        const currentConfig = this.store.getState().config;
        if (currentConfig.product === newProduct) return;
        this.store.setConfig({ product: newProduct });
    }

    /**
     * Обработка ввода количества дней спринта (в реальном времени).
     */
    handleDaysInput(e) {
        const raw = e.target.value?.trim();
        if (!raw) {
            // Пустое поле в процессе редактирования — не invalid, не update.
            e.target.removeAttribute('aria-invalid');
            return;
        }
        // v8.30.33: strict integer. '1.9' / '1abc' / '' → null, НЕ 1.
        const days = parseStrictInteger(raw);
        if (days === null || days < 1) {
            e.target.setAttribute('aria-invalid', 'true');
            return;
        }
        e.target.removeAttribute('aria-invalid');
        this.applyDays(days);
    }

    handleDaysChange(e) {
        const { value } = e.target;
        const days = parseStrictInteger(value);
        if (days === null || days < 1) {
            e.target.setAttribute('aria-invalid', 'true');
            messageService.showMessage('Количество дней должно быть положительным целым числом');
            // Откат к предыдущему значению
            e.target.value = this.store.getState().config?.days ?? 10;
            e.target.removeAttribute('aria-invalid');
            return;
        }
        e.target.removeAttribute('aria-invalid');
        this.applyDays(days);
    }

    /**
     * Обработка изменения даты начала спринта.
     */
    handleStartDateChange(e) {
        const newStartDate = e.target.value;
        const currentConfig = this.store.getState().config ?? {};
        const { startDate: currentStart } = currentConfig;
        if (currentStart === newStartDate) return;
        if (newStartDate && !parseDate(newStartDate)) {
            messageService.showMessage('Дата начала должна быть в формате дд.мм.гггг');
            e.target.value = currentStart || '';
            return;
        }
        this.store.setConfig(createStartDatePatch(currentConfig, newStartDate));
    }

    /**
     * Обработка ручного изменения даты окончания спринта.
     * При изменении даты окончания пересчитывается количество рабочих дней.
     */
    handleEndDateChange(e) {
        const newEndDate = e.target.value;
        const currentConfig = this.store.getState().config ?? {};
        const { endDate: currentEnd } = currentConfig;
        if (currentEnd === newEndDate) return;
        if (newEndDate && !parseDate(newEndDate)) {
            messageService.showMessage('Дата окончания должна быть в формате дд.мм.гггг');
            e.target.value = currentEnd || '';
            return;
        }
        this.store.setConfig(createEndDatePatch(currentConfig, newEndDate));
    }

    /**
     * Обработка ввода количества праздничных дней (в реальном времени).
     */
    handleHolidaysInput(e) {
        const raw = e.target.value?.trim();
        if (!raw) {
            e.target.removeAttribute('aria-invalid');
            return;
        }
        // v8.30.33: strict integer. '0.5' / '5abc' → null, НЕ 0/5.
        const holidays = parseStrictInteger(raw);
        if (holidays === null || holidays < 0) {
            e.target.setAttribute('aria-invalid', 'true');
            return;
        }
        e.target.removeAttribute('aria-invalid');
        this.applyHolidays(holidays);
    }

    /**
     * Обработка окончательного изменения количества праздничных дней (blur).
     */
    handleHolidaysChange(e) {
        const holidays = parseStrictInteger(e.target.value);
        if (holidays === null || holidays < 0) {
            e.target.setAttribute('aria-invalid', 'true');
            messageService.showMessage('Количество праздничных дней должно быть неотрицательным целым числом');
            e.target.value = this.store.getState().config?.holidays ?? 0;
            e.target.removeAttribute('aria-invalid');
            return;
        }
        e.target.removeAttribute('aria-invalid');
        this.applyHolidays(holidays);
    }

    /**
     * Применяет новое количество праздничных дней и пересчитывает дни спринта.
     */
    applyHolidays(holidays) {
        const currentConfig = this.store.getState().config ?? {};
        const { holidays: currentHolidays } = currentConfig;
        if (currentHolidays === holidays) return false;
        this.store.setConfig(createHolidaysPatch(currentConfig, holidays));
        return true;
    }

    /**
     * Обработка ввода коэффициента доступности (в реальном времени).
     */
    handleAvailCoefInput(e) {
        // v8.30.24: live cap через handleInput (P1.1 fix).
        this.nfs.handleInput(e.target);
        const raw = e.target.value?.trim();
        if (!raw) return;

        const num = this.nfs.parseNumber(raw);
        if (num < 0 || num > 100) return;
        this.applyAvailCoef(num);
    }

    handleAvailCoefChange(e) {
        const num = this.nfs.parseNumber(e.target.value);
        if (num < 0 || num > 100) {
            messageService.showMessage('Коэффициент доступности должен быть числом от 0 до 100');
            // Откат к предыдущему значению.
            e.target.value = this.nfs.formatNumber(this.store.getState().config?.availCoef ?? 93.5);
            return;
        }
        // v8.30.24: cap ≤ 2 знака (раньше принудительно 1).
        const availCoef = this.nfs.roundToDecimals(num, 2);
        e.target.value = this.nfs.formatNumber(availCoef);
        this.applyAvailCoef(availCoef);
    }

    /**
     * Обработка изменения порога предупреждения о перегрузке.
     */
    handleAlertChange(e) {
        // v8.30.33: strict integer. '3.5' / '5abc' → null, НЕ 3/5.
        const alert = parseStrictInteger(e.target.value);
        if (alert === null || alert < 0) {
            e.target.setAttribute('aria-invalid', 'true');
            messageService.showMessage('Порог предупреждения должен быть неотрицательным целым числом');
            e.target.value = this.store.getState().config?.alert ?? 3;
            e.target.removeAttribute('aria-invalid');
            return;
        }
        e.target.removeAttribute('aria-invalid');
        const { alert: currentAlert } = this.store.getState().config ?? {};
        if (currentAlert === alert) return;
        this.store.setConfig({ alert });
    }

    /**
     * Сброс конфигурации к значениям по умолчанию.
     */
    handleResetConfig() {
        const defaultConfig = createDefaultConfig();
        this.store.setConfig(defaultConfig);
        messageService.showMessage('Конфигурация сброшена к значениям по умолчанию');
    }

    /**
     * Вычисляет дату окончания спринта по дате начала и количеству дней.
     * @param {string} startDate - дата начала в формате YYYY-MM-DD
     * @param {number} days - количество рабочих дней спринта
     * @returns {string} дата окончания в формате YYYY-MM-DD
     */
    calculateEndDate(startDate, days) {
        return calculateSprintEndDate(startDate, days);
    }
}
