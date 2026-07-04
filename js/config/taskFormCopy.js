export const TASK_FORM_MODE_COPY = Object.freeze({
    create: Object.freeze({
        title: 'Создание задачи',
        submit: 'Создать задачу',
        submitTitle: 'Создать задачу — Ctrl+Enter',
        submitAriaLabel: 'Создать задачу (горячая клавиша Ctrl+Enter)'
    }),
    edit: Object.freeze({
        title: 'Редактирование задачи',
        submit: 'Сохранить',
        submitTitle: 'Сохранить — Ctrl+S',
        submitAriaLabel: 'Сохранить (горячая клавиша Ctrl+S)'
    })
});

export function getTaskFormModeCopy(mode) {
    return TASK_FORM_MODE_COPY[mode] || TASK_FORM_MODE_COPY.create;
}
