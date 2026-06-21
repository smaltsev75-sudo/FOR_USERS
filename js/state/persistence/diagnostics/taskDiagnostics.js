import { parseStrictDecimal, parseStrictIntegerInRange } from '../../../domain/strictInteger.js';
import { ROLES } from '../../../utils/constants.js';
import { collectValidIds, isPlainRecord, valueSample } from './shared.js';

export function collectValidTaskIds(rawState) {
    return collectValidIds(rawState.tasks);
}

export function addTaskIssues(issues, rawState, { validCritIds, validTaskIds }) {
    if (!Array.isArray(rawState.tasks)) return;

    const seenTaskIds = new Set();
    rawState.tasks.forEach((task, i) => {
        if (isPlainRecord(task)) {
            const taskId = addTaskIdIssues(issues, task, i, seenTaskIds);
            addTaskEstIssues(issues, task, i);
            addCriteriaEvaluationIssues(issues, task, i, rawState, validCritIds);
            addDependencyIssues(issues, task, i, taskId, validTaskIds);
        } else if (task !== undefined) {
            issues.push(`tasks[${i}] = ${JSON.stringify(task)} отвергнуто (требуется object); пропущено`);
        }
    });

    addDependencyCycleIssues(issues, rawState, validTaskIds);
}

function addTaskIdIssues(issues, task, index, seenTaskIds) {
    const taskId = parseStrictIntegerInRange(task.id, 1, Number.MAX_SAFE_INTEGER);
    if (task.id !== undefined && taskId === null) {
        issues.push(`tasks[${index}].id = ${JSON.stringify(task.id)} отвергнуто (требуется целое ≥1); назначен новый id`);
    } else if (taskId !== null) {
        if (seenTaskIds.has(taskId)) {
            issues.push(`tasks[${index}].id = ${taskId} — duplicate task id; назначен новый (risk: update/delete мог попасть в несколько задач)`);
        } else {
            seenTaskIds.add(taskId);
        }
    }
    return taskId;
}

function addTaskEstIssues(issues, task, index) {
    if (task.est === undefined) return;
    if (!isPlainRecord(task.est)) {
        issues.push(`tasks[${index}].est = ${valueSample(task.est)} отвергнуто (требуется plain object); применены 0 для всех ролей`);
        return;
    }

    const validRoleIds = new Set(ROLES.map(role => role.id));
    for (const roleId of Object.keys(task.est)) {
        if (!validRoleIds.has(roleId)) {
            issues.push(`tasks[${index}].est.${roleId} — unknown role; поле отброшено (валидные: ${ROLES.map(role => role.id).join(', ')})`);
            continue;
        }
        const v = task.est[roleId];
        if (v === undefined || v === null) continue;
        const parsed = parseStrictDecimal(v, { min: 0, max: Number.POSITIVE_INFINITY, maxDecimals: 2 });
        if (parsed === null) {
            issues.push(`tasks[${index}].est.${roleId} = ${JSON.stringify(v)} отвергнуто (требуется finite ≥0, max 2 decimals, "."/","); применён fallback=0`);
        }
    }
}

function addCriteriaEvaluationIssues(issues, task, index, rawState, validCritIds) {
    if (task.criteriaEvaluations === undefined) return;
    if (!isPlainRecord(task.criteriaEvaluations)) {
        issues.push(`tasks[${index}].criteriaEvaluations = ${valueSample(task.criteriaEvaluations)} отвергнуто (требуется plain object); применён пустой`);
        return;
    }

    const seenCanonical = new Map();
    // PERSIST-1 (DEEP-REFAC 2026-06-21): align с migrate-предикатом
    // (persistence.js:37 `safe.criteria !== undefined`). Раньше analyze гейтил
    // orphan-репорт на Array.isArray → для `criteria:{}` (present-but-non-array)
    // migrate ДРОПАЛ eval'ы (validCritIds пустой), а analyze молчал — нарушение
    // honest-import контракта. Теперь оба судят «criteria provided?» одинаково.
    const criteriaProvided = rawState.criteria !== undefined;
    Object.entries(task.criteriaEvaluations).forEach(([critKey, ev]) => {
        const parsedKey = parseStrictIntegerInRange(critKey, 1, Number.MAX_SAFE_INTEGER);
        if (parsedKey === null) {
            issues.push(`tasks[${index}].criteriaEvaluations[${JSON.stringify(critKey)}] — invalid key (требуется целое ≥1)`);
            return;
        }

        const canonicalKey = String(parsedKey);
        if (critKey !== canonicalKey) {
            issues.push(`tasks[${index}].criteriaEvaluations["${critKey}"] — non-canonical key; нормализован к "${canonicalKey}"`);
        }
        if (seenCanonical.has(canonicalKey)) {
            const firstRaw = seenCanonical.get(canonicalKey);
            issues.push(`tasks[${index}].criteriaEvaluations — canonical key collision: "${firstRaw}" и "${critKey}" → "${canonicalKey}"; first-wins ("${firstRaw}" сохранён)`);
        } else {
            seenCanonical.set(canonicalKey, critKey);
        }
        if (criteriaProvided && !validCritIds.has(parsedKey)) {
            issues.push(`tasks[${index}].criteriaEvaluations[${critKey}] — orphaned key (нет criterion с id=${parsedKey})`);
        }
        if (!isPlainRecord(ev)) {
            issues.push(`tasks[${index}].criteriaEvaluations[${critKey}] = ${valueSample(ev, 60)} отвергнуто (требуется object); применён {score:0,value:0}`);
            return;
        }
        if (ev.score !== undefined && parseStrictIntegerInRange(ev.score, 0, 10) === null) {
            issues.push(`tasks[${index}].criteriaEvaluations[${critKey}].score = ${JSON.stringify(ev.score)} отвергнуто (требуется целое 0..10); применён fallback`);
        }
    });
}

function addDependencyIssues(issues, task, index, taskId, validTaskIds) {
    if (task.dependencies === undefined) return;
    if (!Array.isArray(task.dependencies)) {
        issues.push(`tasks[${index}].dependencies = ${valueSample(task.dependencies)} отвергнуто (требуется array); применён []`);
        return;
    }

    task.dependencies.forEach((dep, j) => {
        const parsed = parseStrictIntegerInRange(dep, 1, Number.MAX_SAFE_INTEGER);
        if (parsed === null) {
            issues.push(`tasks[${index}].dependencies[${j}] = ${JSON.stringify(dep)} — invalid id (требуется целое ≥1); отброшено`);
            return;
        }
        if (taskId !== null && parsed === taskId) {
            issues.push(`tasks[${index}].dependencies[${j}] = ${parsed} — self-dependency (cycle of length 1); отброшено`);
            return;
        }
        if (validTaskIds.size > 0 && !validTaskIds.has(parsed)) {
            issues.push(`tasks[${index}].dependencies[${j}] = ${parsed} — unknown task id (нет такой задачи); отброшено`);
        }
    });
}

function addDependencyCycleIssues(issues, rawState, validTaskIds) {
    const adj = new Map();
    rawState.tasks.forEach((task) => {
        if (!isPlainRecord(task)) return;
        const tid = parseStrictIntegerInRange(task.id, 1, Number.MAX_SAFE_INTEGER);
        if (tid === null || !Array.isArray(task.dependencies)) return;
        const deps = [];
        for (const dep of task.dependencies) {
            const depId = parseStrictIntegerInRange(dep, 1, Number.MAX_SAFE_INTEGER);
            if (depId === null || depId === tid) continue;
            if (validTaskIds.has(depId)) deps.push(depId);
        }
        adj.set(tid, deps);
    });

    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map();
    const cycles = new Set();

    function canonical(arr) {
        let minIdx = 0;
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] < arr[minIdx]) minIdx = i;
        }
        return [...arr.slice(minIdx), ...arr.slice(0, minIdx)].join(',');
    }

    // PERSIST-2 (DEEP-REFAC 2026-06-21): итеративный explicit-stack DFS вместо
    // рекурсии. Рекурсивный обход переполнял call stack на глубокой цепочке
    // зависимостей (RangeError), а analyzeImportIssues зовётся ВНЕ try/catch
    // (statePreview.js), поэтому файл, который migrate бы импортировал, падал.
    // Зеркало findCycleParticipants (dependencies.js). Семантика идентична: тот
    // же порядок обхода соседей, та же canonical-дедупликация, одно issue на цикл.
    for (const start of adj.keys()) {
        if ((color.get(start) || WHITE) !== WHITE) continue;
        const path = [start];
        const nextIdx = [0];
        color.set(start, GRAY);

        while (path.length > 0) {
            const u = path[path.length - 1];
            const neighbors = adj.get(u) || [];
            let descended = false;

            while (nextIdx[nextIdx.length - 1] < neighbors.length) {
                const v = neighbors[nextIdx[nextIdx.length - 1]++];
                const cv = color.get(v) || WHITE;
                if (cv === GRAY) {
                    const startIdx = path.indexOf(v);
                    const cycleNodes = path.slice(startIdx);
                    const key = canonical(cycleNodes);
                    if (!cycles.has(key)) {
                        cycles.add(key);
                        const display = [...cycleNodes, cycleNodes[0]].join(' → ');
                        issues.push(`tasks.dependencies cycle detected: ${display}; зависимости отброшены`);
                    }
                } else if (cv === WHITE) {
                    color.set(v, GRAY);
                    path.push(v);
                    nextIdx.push(0);
                    descended = true;
                    break;
                }
                // BLACK → узел уже полностью обработан, пропускаем
            }

            if (!descended) {
                color.set(u, BLACK);
                path.pop();
                nextIdx.pop();
            }
        }
    }
}
