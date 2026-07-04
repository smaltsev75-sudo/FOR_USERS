import { getCommand } from '../../config/commands.js';
import { messageService } from '../../services/message.js';

// DOM command wiring for save/load/diagnostics actions.
// FileController keeps the behavior; this module owns only command lookup and
// click listener registration.
export function wireFileControllerEvents(controller, { doc = document } = {}) {
    const saveBtn = doc.getElementById(getCommand('save').buttonId);
    const loadBtn = doc.getElementById(getCommand('load').buttonId);
    const diagnosticsBtn = doc.getElementById(getCommand('diagnostics').buttonId);

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            controller.saveToFile();
        });
    } else {
        messageService.showMessage('Ошибка: кнопка «Сохранить» не найдена в DOM');
    }

    if (loadBtn) {
        loadBtn.addEventListener('click', () => {
            controller.loadFromFile();
        });
    } else {
        messageService.showMessage('Ошибка: кнопка «Загрузить» не найдена в DOM');
    }

    if (diagnosticsBtn) {
        diagnosticsBtn.addEventListener('click', () => {
            controller.downloadDiagnostics();
        });
    }
}
