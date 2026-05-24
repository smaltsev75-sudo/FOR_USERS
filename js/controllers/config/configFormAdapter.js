export class ConfigFormAdapter {
    constructor(nfs, doc = document, win = window) {
        this.nfs = nfs;
        this.document = doc;
        this.window = win;
    }

    attachEvents(handlers) {
        this.byId('cfgProduct')?.addEventListener('blur', handlers.onProductChange);
        this.byId('cfgDays')?.addEventListener('input', handlers.onDaysInput);
        this.byId('cfgDays')?.addEventListener('blur', handlers.onDaysChange);
        this.byId('cfgStartDate')?.addEventListener('change', handlers.onStartDateChange);
        this.byId('cfgEndDate')?.addEventListener('change', handlers.onEndDateChange);
        this.byId('cfgHolidays')?.addEventListener('input', handlers.onHolidaysInput);
        this.byId('cfgHolidays')?.addEventListener('blur', handlers.onHolidaysChange);
        this.byId('cfgAvailCoef')?.addEventListener('input', handlers.onAvailCoefInput);
        this.byId('cfgAvailCoef')?.addEventListener('blur', handlers.onAvailCoefChange);
        this.byId('cfgAlert')?.addEventListener('blur', handlers.onAlertChange);
        this.byId('resetConfigBtn')?.addEventListener('click', handlers.onResetConfig);
    }

    applyMobileAdvancedDefault() {
        const cfg = this.byId('cfgAdvanced');
        if (!cfg) return;
        const matchMedia = this.window?.matchMedia;
        const mm = typeof matchMedia === 'function'
            ? matchMedia.call(this.window, '(max-width: 600px)')
            : null;
        if (mm?.matches) cfg.removeAttribute('open');
    }

    syncFromState(config = {}) {
        const {
            product = '',
            days = 10,
            holidays = 0,
            startDate = '',
            endDate = '',
            availCoef = 93.5,
            alert: alertThreshold = 3
        } = config;

        this.syncInputValue(this.byId('cfgProduct'), product);
        this.syncInputValue(this.byId('cfgDays'), String(days));
        this.syncInputValue(this.byId('cfgHolidays'), String(holidays));
        this.syncInputValue(this.byId('cfgStartDate'), startDate);
        this.syncInputValue(this.byId('cfgEndDate'), endDate);
        this.syncInputValue(this.byId('cfgAvailCoef'), this.nfs.formatNumber(availCoef));
        this.syncInputValue(this.byId('cfgAlert'), String(alertThreshold));
    }

    syncInputValue(input, value) {
        if (!input) return;
        if (this.document.activeElement === input) return;
        if (input.value === value) return;
        input.value = value;
    }

    byId(id) {
        return this.document.getElementById(id);
    }
}
