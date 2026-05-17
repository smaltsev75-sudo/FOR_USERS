// js/services/storage.js
//
// v8.30.0: save() возвращает status-объект `{ok, error}` вместо тихого глотания.
// Раньше QuotaExceededError / SecurityError проглатывались — пользователь
// получал «успешное» сохранение и терял рабочий день после F5. Теперь вызывающая
// сторона (app.saveToLS) реагирует на `!ok` и показывает snackbar.

/** @typedef {{ ok: true } | { ok: false, error: string }} SaveResult */

export const storageService = {
    /**
     * Сохраняет состояние в localStorage.
     * @param {Object} data — нормализованное состояние
     * @returns {SaveResult} `{ok:true}` при успехе либо `{ok:false, error}` при сбое.
     */
    save(data) {
        try {
            localStorage.setItem('sprintPlannerData', JSON.stringify(data));
            return { ok: true };
        } catch (err) {
            const name = (err && (err.name || err.message)) || 'StorageError';
            return { ok: false, error: String(name) };
        }
    },

    load() {
        try {
            const saved = localStorage.getItem('sprintPlannerData');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    },

    saveFile(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    loadFile() {
        // v8.30.5: типизируем причину reject через `.code` —
        //   'cancel' — пользователь отменил file picker (silent для caller).
        //   'timeout' — picker не сработал за 30s (silent).
        //   'read'   — FileReader.onerror (real error, показать пользователю).
        //   'parse'  — невалидный JSON (real error, показать пользователю).
        // До v8.30.5 все 4 пути выбрасывали generic Error, и fileController
        // глотал их одинаково — пользователь не понимал, что произошло.
        const makeError = (message, code) => {
            const e = new Error(message);
            e.code = code;
            return e;
        };
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            const timeout = setTimeout(() => {
                reject(makeError('Выбор файла отменён (таймаут)', 'timeout'));
            }, 30000);

            input.onchange = (e) => {
                clearTimeout(timeout);
                const file = e.target.files[0];
                if (!file) {
                    reject(makeError('Файл не выбран', 'cancel'));
                    return;
                }
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        resolve(data);
                    } catch (parseErr) {
                        reject(makeError(`Невалидный JSON: ${parseErr.message}`, 'parse'));
                    }
                };
                reader.onerror = () => reject(makeError('Ошибка чтения файла (FileReader)', 'read'));
                reader.readAsText(file);
            };

            input.oncancel = () => {
                clearTimeout(timeout);
                reject(makeError('Выбор файла отменён', 'cancel'));
            };

            input.click();
        });
    }
};
