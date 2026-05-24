// Единый реестр пользовательских команд: кнопки, hotkeys и справка берут
// названия действий отсюда, чтобы UI и docs не расходились вручную.

const CTRL_ALT = Object.freeze({ primary: true, alt: true });
const PRIMARY = Object.freeze({ primary: true });

export const COMMANDS = Object.freeze({
    theme: Object.freeze({
        id: 'theme',
        buttonId: 'themeToggleBtn',
        label: 'Тема',
        title: 'Переключить тему (светлая/тёмная)',
        ariaLabel: 'Переключить тему'
    }),
    print: Object.freeze({
        id: 'print',
        buttonId: 'printBtn',
        label: 'Печать',
        title: 'Печать (Ctrl+Alt+P)',
        hotkey: Object.freeze({
            ...CTRL_ALT,
            code: 'KeyP',
            windows: 'Ctrl+Alt+P',
            macos: 'Cmd+Alt+P'
        }),
        manualAction: 'Открыть окно печати браузера'
    }),
    load: Object.freeze({
        id: 'load',
        buttonId: 'loadDataBtn',
        label: 'Загрузить',
        title: 'Загрузить данные из JSON-файла (Ctrl+Alt+O)',
        hotkey: Object.freeze({
            ...CTRL_ALT,
            code: 'KeyO',
            windows: 'Ctrl+Alt+O',
            macos: 'Cmd+Alt+O'
        }),
        manualAction: 'Загрузить данные из файла'
    }),
    save: Object.freeze({
        id: 'save',
        buttonId: 'saveDataBtn',
        label: 'Сохранить',
        title: 'Сохранить текущие данные в JSON-файл (Ctrl+Alt+S)',
        hotkey: Object.freeze({
            ...CTRL_ALT,
            code: 'KeyS',
            windows: 'Ctrl+Alt+S',
            macos: 'Cmd+Alt+S'
        }),
        manualAction: 'Сохранить данные в файл'
    }),
    diagnostics: Object.freeze({
        id: 'diagnostics',
        buttonId: 'downloadDiagnosticsBtn',
        label: 'Диагностика',
        title: 'Скачать диагностический пакет без текстов задач (Ctrl+Alt+D)',
        hotkey: Object.freeze({
            ...CTRL_ALT,
            code: 'KeyD',
            windows: 'Ctrl+Alt+D',
            macos: 'Cmd+Alt+D'
        }),
        manualAction: 'Скачать диагностический пакет без текстов задач'
    }),
    recovery: Object.freeze({
        id: 'recovery',
        buttonId: 'recoveryCenterBtn',
        label: 'Резерв',
        title: 'Открыть центр восстановления из локальной резервной копии'
    }),
    help: Object.freeze({
        id: 'help',
        buttonId: 'helpBtn',
        label: 'Справка',
        title: 'Открыть справку'
    }),
    createTask: Object.freeze({
        id: 'createTask',
        buttonId: 'addTaskBtn',
        label: 'Создать задачу',
        title: 'Создать новую задачу (Ctrl+Alt+N)',
        hotkey: Object.freeze({
            ...CTRL_ALT,
            code: 'KeyN',
            windows: 'Ctrl+Alt+N',
            macos: 'Cmd+Alt+N'
        }),
        manualAction: 'Открыть окно создания новой задачи (работает даже при фокусе в поле ввода)'
    }),
    focusSearch: Object.freeze({
        id: 'focusSearch',
        hotkey: Object.freeze({
            ...CTRL_ALT,
            code: 'KeyF',
            windows: 'Ctrl+Alt+F',
            macos: 'Cmd+Alt+F'
        }),
        manualAction: 'Установить фокус в поле поиска задач (работает даже при фокусе в поле ввода)'
    }),
    submitForm: Object.freeze({
        id: 'submitForm',
        hotkey: Object.freeze({
            ...PRIMARY,
            key: 'Enter',
            windows: 'Ctrl+Enter',
            macos: 'Cmd+Enter'
        }),
        manualAction: 'Создать задачу или сохранить изменения в форме'
    }),
    deleteTask: Object.freeze({
        id: 'deleteTask',
        hotkey: Object.freeze({
            keys: Object.freeze(['Delete', 'Del']),
            windows: 'Delete (при фокусе на карточке задачи)',
            macos: 'Delete'
        }),
        manualAction: 'Удалить выбранную задачу'
    }),
    closeModal: Object.freeze({
        id: 'closeModal',
        hotkey: Object.freeze({
            key: 'Escape',
            windows: 'Esc',
            macos: 'Esc'
        }),
        manualAction: 'Закрыть любое модальное окно'
    })
});

export const HEADER_COMMAND_IDS = Object.freeze([
    'theme',
    'print',
    'load',
    'save',
    'diagnostics',
    'recovery',
    'help'
]);

export const KEYBOARD_COMMAND_IDS = Object.freeze([
    'save',
    'load',
    'createTask',
    'focusSearch',
    'print',
    'diagnostics'
]);

export const MANUAL_HOTKEY_COMMAND_IDS = Object.freeze([
    'save',
    'load',
    'createTask',
    'focusSearch',
    'print',
    'diagnostics',
    'submitForm',
    'deleteTask',
    'closeModal'
]);

export function getCommand(id) {
    return COMMANDS[id];
}

export function getManualHotkeys() {
    return MANUAL_HOTKEY_COMMAND_IDS.map((id) => {
        const command = getCommand(id);
        return {
            id,
            windows: command.hotkey.windows,
            macos: command.hotkey.macos,
            action: command.manualAction
        };
    });
}

export function matchesHotkey(event, hotkey) {
    const hasPrimary = Boolean(event.ctrlKey || event.metaKey);
    if (Boolean(hotkey.primary) !== hasPrimary) return false;
    if (Boolean(hotkey.alt) !== Boolean(event.altKey)) return false;
    if (Boolean(hotkey.shift) !== Boolean(event.shiftKey)) return false;

    if (hotkey.code && event.code !== hotkey.code) return false;
    if (hotkey.key && event.key !== hotkey.key) return false;
    if (hotkey.keys && !hotkey.keys.includes(event.key)) return false;

    return Boolean(hotkey.code || hotkey.key || hotkey.keys);
}

export function findCommandByHotkey(event, commandIds = KEYBOARD_COMMAND_IDS) {
    return commandIds
        .map(getCommand)
        .find((command) => command?.hotkey && matchesHotkey(event, command.hotkey)) || null;
}
