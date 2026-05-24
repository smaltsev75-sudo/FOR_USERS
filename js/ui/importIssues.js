// js/ui/importIssues.js
// View-model helpers for the JSON import confirmation UX.

const DEFAULT_IMPORT_ISSUE_LIMIT = 200;

function normalizeIssues(issues) {
    if (!Array.isArray(issues)) return [];
    return issues
        .map(issue => String(issue ?? '').trim())
        .filter(Boolean);
}

/**
 * Creates a structured confirm model for messageService.showConfirm().
 * The model is intentionally data-only: messageService owns DOM rendering.
 *
 * @param {Array<*>|Object} previewOrIssues
 * @returns {Object}
 */
export function createImportConfirmModel(previewOrIssues) {
    const preview = Array.isArray(previewOrIssues) ? null : previewOrIssues;
    const normalizedIssues = normalizeIssues(preview?.issues || previewOrIssues);
    const issueCount = normalizedIssues.length;
    const footer = buildPreviewFooter(preview);

    if (issueCount === 0) {
        return {
            title: 'Загрузить данные?',
            body: 'Текущие данные будут потеряны.',
            ...(footer ? { footer } : {})
        };
    }

    return {
        title: 'Загрузить данные?',
        body: 'Текущие данные будут потеряны.',
        notice: `Файл содержит ${issueCount} проблем(ы). Некорректные значения будут заменены fallback'ами.`,
        noticeVariant: 'warning',
        ...(footer ? { footer } : {}),
        detailsSummary: `Показать детали (${issueCount})`,
        detailsItems: normalizedIssues.slice(0, DEFAULT_IMPORT_ISSUE_LIMIT),
        detailsOverflow: Math.max(0, issueCount - DEFAULT_IMPORT_ISSUE_LIMIT)
    };
}

/**
 * Formats the post-import status without duplicating import issue details.
 *
 * @param {Object} params
 * @param {number} params.migratedTaskCount
 * @param {number} params.droppedTaskCount
 * @param {boolean} params.rawTasksWereArray
 * @param {number} params.issueCount
 * @returns {string}
 */
export function formatImportSuccessMessage({
    migratedTaskCount,
    droppedTaskCount = 0,
    rawTasksWereArray = false,
    issueCount = 0
}) {
    const droppedNote = rawTasksWereArray && droppedTaskCount > 0
        ? ` (${droppedTaskCount} элементов отвергнуто)`
        : '';

    if (issueCount > 0) {
        return `Данные загружены: ${migratedTaskCount} задач${droppedNote}. ` +
            `Применены fallback'и для ${issueCount} невалидных полей.`;
    }

    return `Данные успешно загружены! Загружено ${migratedTaskCount} задач${droppedNote}`;
}

export function createStateReplaceConfirmModel({
    title = 'Заменить данные?',
    body = 'Текущие данные будут заменены.',
    preview,
    noticeVariant = 'warning',
    footer = ''
} = {}) {
    const counts = preview?.migratedSummary?.counts;
    const notice = counts
        ? `После замены: ${counts.tasks} задач, ${counts.criteria} критериев.`
        : '';

    return {
        title,
        body,
        ...(notice ? { notice, noticeVariant } : {}),
        ...(footer ? { footer } : {})
    };
}

function buildPreviewFooter(preview) {
    const counts = preview?.migratedSummary?.counts;
    if (!counts) return '';
    return `После загрузки: ${counts.tasks} задач, ${counts.criteria} критериев.`;
}
