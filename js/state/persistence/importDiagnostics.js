import { parseRoleField } from '../../domain/roleFieldContract.js';
import { parseStrictDecimal, parseStrictIntegerInRange } from '../../domain/strictInteger.js';
import { ROLES } from '../../utils/constants.js';
import { checkIntegerField } from './primitiveNormalizers.js';

/**
 * v8.30.33 — honest import: сообщает потери данных, которые будут применены
 * при migratePersistedState. Отсутствие поля не является issue; distortion —
 * является.
 *
 * @param {*} rawState
 * @returns {{issues: string[]}}
 */
export function analyzeImportIssues(rawState) {
    const issues = [];
    if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
        return { issues };
    }

    if (rawState.config !== undefined && (rawState.config === null
        || typeof rawState.config !== 'object'
        || Array.isArray(rawState.config))) {
        const sample = JSON.stringify(rawState.config) || String(rawState.config);
        issues.push(`config = ${sample.slice(0, 80)} отвергнуто (требуется plain object); применены defaults`);
    }

    const cfg = rawState.config;
    if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
        checkIntegerField(issues, 'config.days', cfg.days, 1, Number.MAX_SAFE_INTEGER);
        checkIntegerField(issues, 'config.holidays', cfg.holidays, 0, Number.MAX_SAFE_INTEGER);
        checkIntegerField(issues, 'config.alert', cfg.alert, 0, Number.MAX_SAFE_INTEGER);
        if (cfg.availCoef !== undefined && cfg.availCoef !== null) {
            const n = Number(cfg.availCoef);
            if (!Number.isFinite(n) || n < 0 || n > 100) {
                issues.push(`config.availCoef = ${JSON.stringify(cfg.availCoef)} отвергнуто (требуется число 0..100); применён fallback`);
            }
        }
    }

    if (rawState.roles !== undefined && !Array.isArray(rawState.roles)) {
        issues.push(`roles = ${JSON.stringify(rawState.roles).slice(0, 80)} отвергнуто (требуется array); применены defaults`);
    }
    if (rawState.tasks !== undefined && !Array.isArray(rawState.tasks)) {
        issues.push(`tasks = ${JSON.stringify(rawState.tasks).slice(0, 80)} отвергнуто (требуется array); пустой список`);
    }
    if (rawState.criteria !== undefined && !Array.isArray(rawState.criteria)) {
        issues.push(`criteria = ${JSON.stringify(rawState.criteria).slice(0, 80)} отвергнуто (требуется array); пустой список`);
    }

    const nestedPlainShapeFields = ['taskFilter', 'taskSort', 'ui', 'numberFormatSettings'];
    for (const field of nestedPlainShapeFields) {
        if (rawState[field] === undefined) continue;
        const v = rawState[field];
        if (v === null || typeof v !== 'object' || Array.isArray(v)) {
            const sample = JSON.stringify(v) || String(v);
            issues.push(`${field} = ${sample.slice(0, 80)} отвергнуто (требуется plain object); применены defaults`);
        }
    }

    if (Array.isArray(rawState.roles)) {
        rawState.roles.forEach((role, i) => {
            if (role && typeof role === 'object' && !Array.isArray(role)) {
                if (role.fte !== undefined && parseRoleField('fte', role.fte) === null) {
                    issues.push(`roles[${i}].fte = ${JSON.stringify(role.fte)} отвергнуто (требуется целое ≥0); применён fallback`);
                }
                if (role.off !== undefined && parseRoleField('off', role.off) === null) {
                    issues.push(`roles[${i}].off = ${JSON.stringify(role.off)} отвергнуто (требуется ≥0, точность 1 знак); применён fallback`);
                }
            } else if (role !== undefined) {
                issues.push(`roles[${i}] = ${JSON.stringify(role)} отвергнуто (требуется object); пропущено`);
            }
        });
    }

    if (Array.isArray(rawState.criteria)) {
        const seenCritIds = new Set();
        rawState.criteria.forEach((criterion, i) => {
            if (criterion && typeof criterion === 'object' && !Array.isArray(criterion)) {
                if (criterion.id !== undefined && parseStrictIntegerInRange(criterion.id, 1, Number.MAX_SAFE_INTEGER) === null) {
                    issues.push(`criteria[${i}].id = ${JSON.stringify(criterion.id)} отвергнуто (требуется целое ≥1); назначен новый id`);
                } else if (criterion.id !== undefined) {
                    const sid = parseStrictIntegerInRange(criterion.id, 1, Number.MAX_SAFE_INTEGER);
                    if (seenCritIds.has(sid)) {
                        issues.push(`criteria[${i}].id = ${sid} — duplicate criterion id; назначен новый`);
                    } else {
                        seenCritIds.add(sid);
                    }
                }
                if (criterion.weight !== undefined && parseStrictIntegerInRange(criterion.weight, 0, 100) === null) {
                    issues.push(`criteria[${i}].weight = ${JSON.stringify(criterion.weight)} отвергнуто (требуется целое 0..100); применён fallback`);
                }
                if (criterion.scale !== undefined
                    && (criterion.scale === null || typeof criterion.scale !== 'object' || Array.isArray(criterion.scale))) {
                    const sample = JSON.stringify(criterion.scale) || String(criterion.scale);
                    issues.push(`criteria[${i}].scale = ${sample.slice(0, 80)} отвергнуто (требуется plain object); применён {}`);
                }
            } else if (criterion !== undefined) {
                issues.push(`criteria[${i}] = ${JSON.stringify(criterion)} отвергнуто (требуется object); пропущено`);
            }
        });
    }

    const validCritIds = new Set();
    if (Array.isArray(rawState.criteria)) {
        for (const criterion of rawState.criteria) {
            if (criterion && typeof criterion === 'object' && !Array.isArray(criterion)) {
                const cid = parseStrictIntegerInRange(criterion.id, 1, Number.MAX_SAFE_INTEGER);
                if (cid !== null) validCritIds.add(cid);
            }
        }
    }

    const validTaskIds = new Set();
    if (Array.isArray(rawState.tasks)) {
        for (const task of rawState.tasks) {
            if (task && typeof task === 'object' && !Array.isArray(task)) {
                const tid = parseStrictIntegerInRange(task.id, 1, Number.MAX_SAFE_INTEGER);
                if (tid !== null) validTaskIds.add(tid);
            }
        }
    }

    if (Array.isArray(rawState.tasks)) {
        const seenTaskIds = new Set();
        rawState.tasks.forEach((task, i) => {
            if (task && typeof task === 'object' && !Array.isArray(task)) {
                const taskId = parseStrictIntegerInRange(task.id, 1, Number.MAX_SAFE_INTEGER);
                if (task.id !== undefined && taskId === null) {
                    issues.push(`tasks[${i}].id = ${JSON.stringify(task.id)} отвергнуто (требуется целое ≥1); назначен новый id`);
                } else if (taskId !== null) {
                    if (seenTaskIds.has(taskId)) {
                        issues.push(`tasks[${i}].id = ${taskId} — duplicate task id; назначен новый (risk: update/delete мог попасть в несколько задач)`);
                    } else {
                        seenTaskIds.add(taskId);
                    }
                }

                if (task.est !== undefined) {
                    if (task.est === null
                        || typeof task.est !== 'object'
                        || Array.isArray(task.est)) {
                        const sample = JSON.stringify(task.est) || String(task.est);
                        issues.push(`tasks[${i}].est = ${sample.slice(0, 80)} отвергнуто (требуется plain object); применены 0 для всех ролей`);
                    } else {
                        const validRoleIds = new Set(ROLES.map(role => role.id));
                        for (const roleId of Object.keys(task.est)) {
                            if (!validRoleIds.has(roleId)) {
                                issues.push(`tasks[${i}].est.${roleId} — unknown role; поле отброшено (валидные: ${ROLES.map(role => role.id).join(', ')})`);
                                continue;
                            }
                            const v = task.est[roleId];
                            if (v === undefined || v === null) continue;
                            const parsed = parseStrictDecimal(v, { min: 0, max: Number.POSITIVE_INFINITY, maxDecimals: 2 });
                            if (parsed === null) {
                                issues.push(`tasks[${i}].est.${roleId} = ${JSON.stringify(v)} отвергнуто (требуется finite ≥0, max 2 decimals, "."/","); применён fallback=0`);
                            }
                        }
                    }
                }

                if (task.criteriaEvaluations !== undefined) {
                    if (task.criteriaEvaluations === null
                        || typeof task.criteriaEvaluations !== 'object'
                        || Array.isArray(task.criteriaEvaluations)) {
                        const sample = JSON.stringify(task.criteriaEvaluations) || String(task.criteriaEvaluations);
                        issues.push(`tasks[${i}].criteriaEvaluations = ${sample.slice(0, 80)} отвергнуто (требуется plain object); применён пустой`);
                    } else {
                        const seenCanonical = new Map();
                        const criteriaProvided = Array.isArray(rawState.criteria);
                        Object.entries(task.criteriaEvaluations).forEach(([critKey, ev]) => {
                            const parsedKey = parseStrictIntegerInRange(critKey, 1, Number.MAX_SAFE_INTEGER);
                            if (parsedKey === null) {
                                issues.push(`tasks[${i}].criteriaEvaluations[${JSON.stringify(critKey)}] — invalid key (требуется целое ≥1)`);
                                return;
                            }
                            const canonicalKey = String(parsedKey);
                            if (critKey !== canonicalKey) {
                                issues.push(`tasks[${i}].criteriaEvaluations["${critKey}"] — non-canonical key; нормализован к "${canonicalKey}"`);
                            }
                            if (seenCanonical.has(canonicalKey)) {
                                const firstRaw = seenCanonical.get(canonicalKey);
                                issues.push(`tasks[${i}].criteriaEvaluations — canonical key collision: "${firstRaw}" и "${critKey}" → "${canonicalKey}"; first-wins ("${firstRaw}" сохранён)`);
                            } else {
                                seenCanonical.set(canonicalKey, critKey);
                            }
                            if (criteriaProvided && !validCritIds.has(parsedKey)) {
                                issues.push(`tasks[${i}].criteriaEvaluations[${critKey}] — orphaned key (нет criterion с id=${parsedKey})`);
                            }
                            if (ev === null || typeof ev !== 'object' || Array.isArray(ev)) {
                                const sample = JSON.stringify(ev) || String(ev);
                                issues.push(`tasks[${i}].criteriaEvaluations[${critKey}] = ${sample.slice(0, 60)} отвергнуто (требуется object); применён {score:0,value:0}`);
                                return;
                            }
                            if (ev.score !== undefined && parseStrictIntegerInRange(ev.score, 0, 10) === null) {
                                issues.push(`tasks[${i}].criteriaEvaluations[${critKey}].score = ${JSON.stringify(ev.score)} отвергнуто (требуется целое 0..10); применён fallback`);
                            }
                        });
                    }
                }

                if (task.dependencies !== undefined) {
                    if (!Array.isArray(task.dependencies)) {
                        issues.push(`tasks[${i}].dependencies = ${JSON.stringify(task.dependencies).slice(0, 80)} отвергнуто (требуется array); применён []`);
                    } else {
                        const normalized = [];
                        task.dependencies.forEach((dep, j) => {
                            const parsed = parseStrictIntegerInRange(dep, 1, Number.MAX_SAFE_INTEGER);
                            if (parsed === null) {
                                issues.push(`tasks[${i}].dependencies[${j}] = ${JSON.stringify(dep)} — invalid id (требуется целое ≥1); отброшено`);
                                return;
                            }
                            if (taskId !== null && parsed === taskId) {
                                issues.push(`tasks[${i}].dependencies[${j}] = ${parsed} — self-dependency (cycle of length 1); отброшено`);
                                return;
                            }
                            if (validTaskIds.size > 0 && !validTaskIds.has(parsed)) {
                                issues.push(`tasks[${i}].dependencies[${j}] = ${parsed} — unknown task id (нет такой задачи); отброшено`);
                                return;
                            }
                            normalized.push(parsed);
                        });
                    }
                }
            } else if (task !== undefined) {
                issues.push(`tasks[${i}] = ${JSON.stringify(task)} отвергнуто (требуется object); пропущено`);
            }
        });

        const adj = new Map();
        rawState.tasks.forEach((task) => {
            if (!task || typeof task !== 'object' || Array.isArray(task)) return;
            const tid = parseStrictIntegerInRange(task.id, 1, Number.MAX_SAFE_INTEGER);
            if (tid === null) return;
            if (!Array.isArray(task.dependencies)) return;
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

        function dfs(u, path) {
            color.set(u, GRAY);
            for (const v of (adj.get(u) || [])) {
                if (color.get(v) === GRAY) {
                    const startIdx = path.indexOf(v);
                    const cycleNodes = path.slice(startIdx);
                    const key = canonical(cycleNodes);
                    if (!cycles.has(key)) {
                        cycles.add(key);
                        const display = [...cycleNodes, cycleNodes[0]].join(' → ');
                        issues.push(`tasks.dependencies cycle detected: ${display}; зависимости отброшены`);
                    }
                } else if ((color.get(v) || WHITE) === WHITE) {
                    dfs(v, [...path, v]);
                }
            }
            color.set(u, BLACK);
        }

        for (const node of adj.keys()) {
            if ((color.get(node) || WHITE) === WHITE) dfs(node, [node]);
        }
    }

    return { issues };
}
