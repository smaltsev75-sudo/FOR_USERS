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
export function findCycleParticipants(adj) {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map();
    const inCycle = new Set();

    function visit(u, stack, onStack) {
        color.set(u, GRAY);
        stack.push(u);
        onStack.add(u);
        for (const v of (adj.get(u) || [])) {
            if (color.get(v) === GRAY) {
                const idx = stack.indexOf(v);
                for (let i = idx; i < stack.length; i++) inCycle.add(stack[i]);
            } else if ((color.get(v) || WHITE) === WHITE) {
                visit(v, stack, onStack);
            }
        }
        color.set(u, BLACK);
        stack.pop();
        onStack.delete(u);
    }

    for (const node of adj.keys()) {
        if ((color.get(node) || WHITE) === WHITE) visit(node, [], new Set());
    }
    return inCycle;
}
