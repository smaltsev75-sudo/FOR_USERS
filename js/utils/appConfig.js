// js/utils/appConfig.js
export const APP_CONFIG = {
    // Версия хранилища (используется для миграций)
    STORAGE_VERSION: 12,

    // Настройки спринта по умолчанию
    SPRINT: {
        DEFAULT_PRODUCT: 'SberUnity',        // Название продукта по умолчанию
        DEFAULT_DAYS: 10,                     // Длительность спринта в днях
        DEFAULT_AVAIL_COEF: 93.5,              // Коэффициент доступности команды (в процентах)
        DEFAULT_ALERT_THRESHOLD: 3,            // Порог срабатывания визуального алерта (в процентах)
    },

    // Параметры валидации полей задач
    VALIDATION: {
        TITLE_MIN_LENGTH: 5,                  // Минимальная длина названия задачи
        TITLE_MAX_LENGTH: 150,                 // Максимальная длина названия задачи
        JIRA_URL_MIN_LENGTH: 10,                // Минимальная длина ссылки JIRA
        ABBREVIATION_MIN_LENGTH: 1,             // Минимальная длина аббревиатуры критерия
        ABBREVIATION_MAX_LENGTH: 5,              // Максимальная длина аббревиатуры критерия
    },

    // Параметры расчёта доступной ёмкости команды
    CAPACITY: {
        HOURS_PER_DAY: 8,                       // Количество рабочих часов в дне
        SELF_DEVELOPMENT_PERCENT: 0.09,          // Доля времени на саморазвитие (9 процентов)
        MEETING_HOURS_BASE: 7,                   // Базовое время на встречи за спринт (часов)
        MINIMUM_USEFUL_HOURS: 0,                  // Минимальное полезное время для роли (часов)
    },
};