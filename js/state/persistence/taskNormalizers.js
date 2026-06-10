import { fixTaskOrder } from '../../domain/task.js';
import { parseStrictDecimal, parseStrictIntegerInRange } from '../../domain/strictInteger.js';
import { ROLES } from '../../utils/constants.js';
import { normalizeCriteriaEvaluations } from './criteriaEvaluations.js';
import { findCycleParticipants, normalizeTaskDependencies } from './dependencies.js';
import {
    collectValidIds,
    createIdAllocator,
    normalizeNumber,
    safePlainObject
} from './primitiveNormalizers.js';

/**
 * v8.30.6: defense-at-load для jira URL. Оставляем http/https и относительные
 * URL, но отбрасываем javascript:, data:, vbscript:, file: и другие схемы.
 */
function sanitizeJiraUrl(raw) {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return '';
    return trimmed;
}

export function normalizeTasks(tasks, opts = {}) {
    if (!Array.isArray(tasks)) return [];
    const { validCriterionIds = null } = opts;
    const objectTasks = tasks.filter((t) => t && typeof t === 'object' && !Array.isArray(t));
    const validIds = collectValidIds(objectTasks, 1);
    const allocate = createIdAllocator(validIds, Date.now());
    const seenIds = new Set();

    const normalized = objectTasks.map((task) => {
        let id = parseStrictIntegerInRange(task.id, 1, Number.MAX_SAFE_INTEGER);
        if (id === null || seenIds.has(id)) {
            id = allocate();
        }
        seenIds.add(id);
        return {
            id,
            title: String(task.title ?? '').trim(),
            jira: sanitizeJiraUrl(task.jira),
            type: normalizeTaskType(task.type),
            comment: String(task.comment ?? '').trim(),
            note: String(task.note ?? '').slice(0, 500),
            excluded: task.excluded ? 1 : 0,
            est: normalizeTaskEst(task.est),
            exclusionReason: String(task.exclusionReason ?? ''),
            criteriaEvaluations: normalizeCriteriaEvaluations(task.criteriaEvaluations, validCriterionIds),
            priorityScore: normalizeNumber(task.priorityScore, 0, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, 2),
            dependencies: normalizeTaskDependencies(task.dependencies, id)
        };
    });

    const validTaskIds = new Set(normalized.map(t => t.id));
    for (const task of normalized) {
        task.dependencies = task.dependencies.filter(depId => validTaskIds.has(depId));
    }

    const adj = new Map();
    for (const task of normalized) adj.set(task.id, [...task.dependencies]);
    const cycleNodes = findCycleParticipants(adj);
    if (cycleNodes.size > 0) {
        for (const task of normalized) {
            if (cycleNodes.has(task.id)) task.dependencies = [];
        }
    }

    return fixTaskOrder(normalized);
}

function normalizeTaskEst(est) {
    const safe = safePlainObject(est);
    return Object.fromEntries(
        ROLES.map(role => {
            const raw = safe[role.id];
            if (raw === undefined || raw === null) return [role.id, 0];
            const parsed = parseStrictDecimal(raw, { min: 0, max: Number.POSITIVE_INFINITY, maxDecimals: 2 });
            return [role.id, parsed === null ? 0 : parsed];
        })
    );
}

function normalizeTaskType(type) {
    return ['us', 'bug', 'tech'].includes(type) ? type : 'us';
}
