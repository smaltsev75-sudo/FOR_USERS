// DOM event wiring for the sprint configuration form.
// Behavior remains owned by ConfigController; this module only preserves the
// listener map and registration order through ConfigFormAdapter.
export function wireConfigControllerEvents(controller) {
    controller.form.attachEvents({
        onProductChange: (e) => controller.handleProductChange(e),
        onDaysInput: (e) => controller.handleDaysInput(e),
        onDaysChange: (e) => controller.handleDaysChange(e),
        onStartDateChange: (e) => controller.handleStartDateChange(e),
        onEndDateChange: (e) => controller.handleEndDateChange(e),
        onHolidaysInput: (e) => controller.handleHolidaysInput(e),
        onHolidaysChange: (e) => controller.handleHolidaysChange(e),
        onAvailCoefInput: (e) => controller.handleAvailCoefInput(e),
        onAvailCoefChange: (e) => controller.handleAvailCoefChange(e),
        onAlertChange: (e) => controller.handleAlertChange(e),
        onResetConfig: () => controller.handleResetConfig()
    });
}
