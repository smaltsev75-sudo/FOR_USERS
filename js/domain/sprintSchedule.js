import { addWorkingDays, countWorkingDays, formatDate, parseDate } from '../utils/date.js';

export function calculateSprintEndDate(startDate, days) {
    if (!startDate || !days) return '';
    const parsed = parseDate(startDate);
    if (!parsed) return '';
    return formatDate(addWorkingDays(parsed, days - 1));
}

export function createDaysPatch(config = {}, days) {
    const { startDate, endDate, holidays = 0 } = config;
    const nextConfig = { days };
    if (startDate) {
        const calculatedEndDate = calculateSprintEndDate(startDate, days + holidays);
        if (calculatedEndDate !== endDate) {
            nextConfig.endDate = calculatedEndDate;
        }
    }
    return nextConfig;
}

export function createStartDatePatch(config = {}, newStartDate) {
    const { days, holidays = 0 } = config;
    return {
        startDate: newStartDate,
        endDate: days ? calculateSprintEndDate(newStartDate, days + holidays) : ''
    };
}

export function createEndDatePatch(config = {}, newEndDate) {
    const { startDate, holidays = 0 } = config;
    const nextConfig = { endDate: newEndDate };
    const days = calculateWorkingDaysMinusHolidays(startDate, newEndDate, holidays);
    if (days !== null) nextConfig.days = days;
    return nextConfig;
}

export function createHolidaysPatch(config = {}, holidays) {
    const { startDate, endDate } = config;
    const nextConfig = { holidays };
    const days = calculateWorkingDaysMinusHolidays(startDate, endDate, holidays);
    if (days !== null) nextConfig.days = days;
    return nextConfig;
}

export function calculateWorkingDaysMinusHolidays(startDate, endDate, holidays = 0) {
    if (!startDate || !endDate) return null;
    const parsedStart = parseDate(startDate);
    const parsedEnd = parseDate(endDate);
    if (!parsedStart || !parsedEnd || parsedEnd < parsedStart) return null;
    return Math.max(0, countWorkingDays(parsedStart, parsedEnd) - holidays);
}
