// js/controllers/configController.js

import { messageService } from '../services/message.js';
import { createDefaultConfig } from '../domain/config.js';
import { addWorkingDays, countWorkingDays, formatDate, parseDate } from '../utils/date.js';

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
     * Освобождение ресурсов: отписка от store при уничтожении контроллера.
     */
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    applyDays(days) {
        const { days: currentDays, startDate, endDate, holidays = 0 } = this.store.getState().config ?? {};
        if (currentDays === days) return false;

        const nextConfig = { days };
        if (startDate) {
            const calculatedEndDate = this.calculateEndDate(startDate, days + holidays);
            if (calculatedEndDate !== endDate) {
                nextConfig.endDate = calculatedEndDate;
            }
        }

        this.store.setConfig(nextConfig);
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
        // Название продукта
        const productInput = document.getElementById('cfgProduct');
        if (productInput) {
            productInput.addEventListener('blur', (e) => this.handleProductChange(e));
        }

        // Количество дней спринта
        const daysInput = document.getElementById('cfgDays');
        if (daysInput) {
            daysInput.addEventListener('input', (e) => this.handleDaysInput(e));
            daysInput.addEventListener('blur', (e) => this.handleDaysChange(e));
        }

        // Дата начала спринта
        const startDateInput = document.getElementById('cfgStartDate');
        if (startDateInput) {
            startDateInput.addEventListener('change', (e) => this.handleStartDateChange(e));
        }

        // Дата окончания (рассчитывается автоматически, но может быть изменена вручную)
        const endDateInput = document.getElementById('cfgEndDate');
        if (endDateInput) {
            endDateInput.addEventListener('change', (e) => this.handleEndDateChange(e));
        }

        // Праздничные дни
        const holidaysInput = document.getElementById('cfgHolidays');
        if (holidaysInput) {
            holidaysInput.addEventListener('input', (e) => this.handleHolidaysInput(e));
            holidaysInput.addEventListener('blur', (e) => this.handleHolidaysChange(e));
        }

        // Коэффициент доступности
        const availCoefInput = document.getElementById('cfgAvailCoef');
        if (availCoefInput) {
            availCoefInput.addEventListener('input', (e) => this.handleAvailCoefInput(e));
            availCoefInput.addEventListener('blur', (e) => this.handleAvailCoefChange(e));
        }

        // Порог предупреждения о перегрузке
        const alertInput = document.getElementById('cfgAlert');
        if (alertInput) {
            alertInput.addEventListener('blur', (e) => this.handleAlertChange(e));
        }

        // Кнопка сброса к значениям по умолчанию
        const resetBtn = document.getElementById('resetConfigBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.handleResetConfig());
        }
    }

    /**
     * Обновление всех полей ввода из текущей конфигурации store.
     */
    updateInputsFromState(config = this.store.getState().config) {
        if (!config) return;
        const {
            product = '',
            days = 10,
            holidays = 0,
            startDate = '',
            endDate = '',
            availCoef = 93.5,
            alert: alertThreshold = 3
        } = config;

        const activeElement = document.activeElement;
        const syncInputValue = (input, value) => {
            if (!input) return;
            if (activeElement === input) return;
            if (input.value === value) return;
            input.value = value;
        };

        const productInput = document.getElementById('cfgProduct');
        syncInputValue(productInput, product);

        const daysInput = document.getElementById('cfgDays');
        syncInputValue(daysInput, String(days));

        const holidaysInput = document.getElementById('cfgHolidays');
        syncInputValue(holidaysInput, String(holidays));

        const startDateInput = document.getElementById('cfgStartDate');
        syncInputValue(startDateInput, startDate);

        const endDateInput = document.getElementById('cfgEndDate');
        syncInputValue(endDateInput, endDate);

        const availCoefInput = document.getElementById('cfgAvailCoef');
        syncInputValue(availCoefInput, this.nfs.formatNumber(availCoef, 1));

        const alertInput = document.getElementById('cfgAlert');
        syncInputValue(alertInput, String(alertThreshold));
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
        if (!raw) return;

        const days = this.nfs.parseInteger(raw);
        // Вызываем applyDays только при валидном положительном числе
        if (days > 0) {
            this.applyDays(days);
        }
    }

    handleDaysChange(e) {
        const { value } = e.target;
        const days = this.nfs.parseInteger(value);
        if (days <= 0) {
            messageService.showMessage('Количество дней должно быть положительным числом');
            // Откат к предыдущему значению
            e.target.value = this.store.getState().config?.days ?? 10;
            return;
        }
        this.applyDays(days);
    }

    /**
     * Обработка изменения даты начала спринта.
     */
    handleStartDateChange(e) {
        const newStartDate = e.target.value;
        const { startDate: currentStart, days, holidays = 0 } = this.store.getState().config ?? {};
        if (currentStart === newStartDate) return;
        if (newStartDate && !parseDate(newStartDate)) {
            messageService.showMessage('Дата начала должна быть в формате дд.мм.гггг');
            e.target.value = currentStart || '';
            return;
        }
        const newEndDate = days ? this.calculateEndDate(newStartDate, days + holidays) : '';
        this.store.setConfig({ startDate: newStartDate, endDate: newEndDate });
    }

    /**
     * Обработка ручного изменения даты окончания спринта.
     * При изменении даты окончания пересчитывается количество рабочих дней.
     */
    handleEndDateChange(e) {
        const newEndDate = e.target.value;
        const { endDate: currentEnd, startDate } = this.store.getState().config ?? {};
        if (currentEnd === newEndDate) return;
        if (newEndDate && !parseDate(newEndDate)) {
            messageService.showMessage('Дата окончания должна быть в формате дд.мм.гггг');
            e.target.value = currentEnd || '';
            return;
        }
        const { holidays = 0 } = this.store.getState().config ?? {};
        const nextConfig = { endDate: newEndDate };
        // Пересчитываем количество рабочих дней если задана дата начала
        if (startDate && newEndDate) {
            const parsedStart = parseDate(startDate);
            const parsedEnd = parseDate(newEndDate);
            if (parsedStart && parsedEnd && parsedEnd >= parsedStart) {
                nextConfig.days = Math.max(0, countWorkingDays(parsedStart, parsedEnd) - holidays);
            }
        }
        this.store.setConfig(nextConfig);
    }

    /**
     * Обработка ввода количества праздничных дней (в реальном времени).
     */
    handleHolidaysInput(e) {
        const raw = e.target.value?.trim();
        if (!raw) return;
        const holidays = this.nfs.parseInteger(raw);
        if (holidays < 0) return;
        this.applyHolidays(holidays);
    }

    /**
     * Обработка окончательного изменения количества праздничных дней (blur).
     */
    handleHolidaysChange(e) {
        const holidays = this.nfs.parseInteger(e.target.value);
        if (holidays < 0) {
            messageService.showMessage('Количество праздничных дней не может быть отрицательным');
            e.target.value = this.store.getState().config?.holidays ?? 0;
            return;
        }
        this.applyHolidays(holidays);
    }

    /**
     * Применяет новое количество праздничных дней и пересчитывает дни спринта.
     */
    applyHolidays(holidays) {
        const { holidays: currentHolidays, startDate, endDate } = this.store.getState().config ?? {};
        if (currentHolidays === holidays) return false;
        const nextConfig = { holidays };
        // Пересчитываем дни спринта если заданы обе даты
        if (startDate && endDate) {
            const parsedStart = parseDate(startDate);
            const parsedEnd = parseDate(endDate);
            if (parsedStart && parsedEnd && parsedEnd >= parsedStart) {
                nextConfig.days = Math.max(0, countWorkingDays(parsedStart, parsedEnd) - holidays);
            }
        }
        this.store.setConfig(nextConfig);
        return true;
    }

    /**
     * Обработка ввода коэффициента доступности (в реальном времени).
     */
    handleAvailCoefInput(e) {
        const raw = e.target.value?.trim();
        if (!raw) return;

        const num = this.nfs.parseNumber(raw);
        if (isNaN(num) || num < 0 || num > 100) return;
        this.applyAvailCoef(num);
    }

    handleAvailCoefChange(e) {
        const num = this.nfs.parseNumber(e.target.value);
        if (isNaN(num) || num < 0 || num > 100) {
            messageService.showMessage('Коэффициент доступности должен быть числом от 0 до 100');
            // Откат к предыдущему значению
            e.target.value = this.nfs.formatNumber(this.store.getState().config?.availCoef ?? 93.5, 1);
            return;
        }
        const availCoef = this.nfs.roundToDecimals(num, 1);
        e.target.value = this.nfs.formatNumber(availCoef, 1);
        this.applyAvailCoef(availCoef);
    }

    /**
     * Обработка изменения порога предупреждения о перегрузке.
     */
    handleAlertChange(e) {
        const alert = this.nfs.parseInteger(e.target.value);
        if (alert < 0) {
            messageService.showMessage('Порог предупреждения должен быть неотрицательным целым числом');
            // Откат к предыдущему значению
            e.target.value = this.store.getState().config?.alert ?? 3;
            return;
        }
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
        if (!startDate || !days) return '';
        const parsed = parseDate(startDate);
        if (!parsed) return '';
        return formatDate(addWorkingDays(parsed, days - 1));
    }
}
