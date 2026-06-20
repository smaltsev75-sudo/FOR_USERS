import { parseStrictIntegerInRange } from '../../domain/strictInteger.js';

/**
 * Нормализует `task.dependencies` к плоскому массиву strict positive integer id.
 */
export function normalizeTaskDependencies(deps, selfId = null) {
    if (!Array.isArray(deps)) return [];
    const seen = new Set();
    const result = [];
    for (const dep of deps) {
        const parsed = parseStrictIntegerInRange(dep, 1, Number.MAX_SAFE_INTEGER);
        if (parsed === null) continue;
        if (parsed === selfId) continue;
        if (seen.has(parsed)) continue;
        seen.add(parsed);
        result.push(parsed);
        if (result.length >= 100) break;
    }
    return result;
}

// v8.30.36: deterministic policy — clear dependencies for every cycle participant.
// v8.31.x: iterative DFS (явный стек) вместо рекурсии. Рекурсивный обход
// переполнял call stack на глубокой цепочке зависимостей из adversarial/corrupt
// импорта (RangeError) и ломал total-function контракт migratePersistedState.
// Семантика сохранена: для каждого back-edge помечаем все узлы пути от цели
// ребра до текущего узла как участников цикла.
export function findCycleParticipants(adj) {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map();
    const inCycle = new Set();

    for (const start of adj.keys()) {
        if ((color.get(start) || WHITE) !== WHITE) continue;

        // path — текущий DFS-путь; nextIdx — индекс следующего соседа на каждом фрейме.
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
                    // back edge: v на текущем пути → цикл от v до u включительно
                    const idx = path.indexOf(v);
                    for (let i = idx; i < path.length; i++) inCycle.add(path[i]);
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
    return inCycle;
}
