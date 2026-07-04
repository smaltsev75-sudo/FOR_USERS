import { escapeHtml } from '../../utils/escapeHtml.js';
import { HEADING_ID } from './constants.js';

export function renderBlockedScreenBody(args) {
    if (args.mode === 'future-storage') return renderFutureStorageBody(args);
    if (args.mode === 'backup-failed') return renderBackupFailedBody(args);
    if (args.mode === 'lock-storage-error') return renderLockStorageErrorBody(args);
    return renderConflictBody(args);
}

function renderConflictBody(args) {
    const myV = escapeHtml(String(args.mine?.version ?? ''));
    const otherV = escapeHtml(String(args.other?.version ?? ''));
    return `
        <h1 id="${HEADING_ID}" class="blocked-screen__title">
            Уже открыта другая вкладка приложения
        </h1>
        <p class="blocked-screen__lead">
            На этой машине уже работает экземпляр приложения. Одновременная работа двух
            вкладок может привести к потере расчётов: последнее сохранение перетирает
            предыдущее без слияния. Закройте эту вкладку и продолжайте работу в той,
            где уже открыто приложение, либо перезагрузите страницу,
            если другая вкладка уже закрыта.
        </p>
        <dl class="blocked-screen__versions">
            <dt>Эта вкладка:</dt>
            <dd>${myV}</dd>
            <dt>Уже активна:</dt>
            <dd>${otherV}</dd>
        </dl>
    `;
}

function renderLockStorageErrorBody(args) {
    const errorName = escapeHtml(String(args.error ?? 'StorageError'));
    return `
        <h1 id="${HEADING_ID}" class="blocked-screen__title">
            Не удалось обратиться к локальному хранилищу
        </h1>
        <p class="blocked-screen__lead">
            Приложение не смогло прочитать или записать данные о запущенных
            вкладках в локальное хранилище браузера (${errorName}). Это могло
            произойти из-за переполнения хранилища, режима инкогнито со
            строгой блокировкой или ограничений безопасности браузера.
            Освободите место в хранилище (например, очистите кэш), отключите
            строгий блок третьих сторон для этой страницы или используйте
            обычное окно, а затем нажмите «Попробовать снова».
        </p>
    `;
}

function renderBackupFailedBody(args) {
    const errorName = escapeHtml(String(args.error ?? 'StorageError'));
    const savedV = escapeHtml(String(args.savedVersion ?? ''));
    const currentV = escapeHtml(String(args.mine?.storageVersion ?? ''));
    return `
        <h1 id="${HEADING_ID}" class="blocked-screen__title">
            Не удалось создать резервную копию данных
        </h1>
        <p class="blocked-screen__lead">
            Перед миграцией формата приложение пытается сохранить копию исходного
            состояния в браузере, чтобы можно было откатиться, если что-то пойдёт
            не так. Сейчас сделать копию не получилось (${errorName}). Чтобы не
            потерять данные, приложение НЕ запускается. Откройте предыдущую
            версию или скачайте текущее сохранение через файл-менеджер браузера,
            затем очистите место в хранилище и попробуйте снова.
        </p>
        <dl class="blocked-screen__versions">
            <dt>Версия сохранения:</dt>
            <dd>${savedV}</dd>
            <dt>Версия приложения:</dt>
            <dd>${currentV}</dd>
        </dl>
    `;
}

function renderFutureStorageBody(args) {
    const saved = escapeHtml(String(args.savedVersion ?? ''));
    const current = escapeHtml(String(args.mine?.storageVersion ?? ''));
    return `
        <h1 id="${HEADING_ID}" class="blocked-screen__title">
            Сохранение из более новой версии приложения
        </h1>
        <p class="blocked-screen__lead">
            Данные в браузере сохранены более новой версией приложения.
            Чтобы не повредить их, эта (старая) версия не будет запускаться.
            Откройте приложение в более новой вкладке или обновите страницу до актуальной версии.
        </p>
        <dl class="blocked-screen__versions">
            <dt>Версия хранилища у данных:</dt>
            <dd>${saved}</dd>
            <dt>Версия хранилища в этой вкладке:</dt>
            <dd>${current}</dd>
        </dl>
    `;
}
