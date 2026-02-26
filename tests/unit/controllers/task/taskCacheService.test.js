import { jest } from '@jest/globals';
import { TaskCacheService } from '../../../../js/controllers/task/taskCacheService.js';

describe('TaskCacheService', () => {
    let service;

    beforeEach(() => {
        service = new TaskCacheService();
    });

    // ── isReady ───────────────────────────────────────────────────────────

    test('isReady returns false before calculator is set', () => {
        expect(service.isReady()).toBe(false);
    });

    test('isReady returns true after calculator is set', () => {
        service.setPriorityScoreCalculator(() => 0);
        expect(service.isReady()).toBe(true);
    });

    // ── setPriorityScoreCalculator ─────────────────────────────────────────

    test('getCachedPriorityScore returns 0 when no calculator set', () => {
        const task = { id: 1, criteriaEvaluations: {} };
        expect(service.getCachedPriorityScore(task, [])).toBe(0);
    });

    test('getCachedPriorityScore calls calculator and returns result', () => {
        const calc = jest.fn().mockReturnValue(7.5);
        service.setPriorityScoreCalculator(calc);
        const task = { id: 1, criteriaEvaluations: {} };
        const criteria = [{ id: 'c1', weight: 100 }];
        const result = service.getCachedPriorityScore(task, criteria);
        expect(result).toBe(7.5);
        expect(calc).toHaveBeenCalledWith(task);
    });

    test('getCachedPriorityScore caches result on second call', () => {
        const calc = jest.fn().mockReturnValue(5);
        service.setPriorityScoreCalculator(calc);
        const task = { id: 2, criteriaEvaluations: {} };
        const criteria = [{ id: 'c1', weight: 50 }];
        service.getCachedPriorityScore(task, criteria);
        service.getCachedPriorityScore(task, criteria);
        expect(calc).toHaveBeenCalledTimes(1);
    });

    test('getCachedPriorityScore recomputes when criteria change', () => {
        const calc = jest.fn().mockReturnValue(3);
        service.setPriorityScoreCalculator(calc);
        const task = { id: 3, criteriaEvaluations: {} };
        service.getCachedPriorityScore(task, [{ id: 'c1', weight: 40 }]);
        service.getCachedPriorityScore(task, [{ id: 'c1', weight: 60 }]); // different weight
        expect(calc).toHaveBeenCalledTimes(2);
    });

    // ── getCachedRoleLoad ──────────────────────────────────────────────────

    test('getCachedRoleLoad returns correct load per role', () => {
        const tasks = [
            { id: 1, excluded: 0, est: { fe: 5, be: 3 } },
            { id: 2, excluded: 0, est: { fe: 2, be: 4 } },
            { id: 3, excluded: 1, est: { fe: 10, be: 10 } } // excluded — should not count
        ];
        const roles = [{ id: 'fe' }, { id: 'be' }];
        const config = { days: 10, availCoef: 93.5, alert: 3 };
        const load = service.getCachedRoleLoad(tasks, roles, config);
        expect(load.fe).toBe(7);
        expect(load.be).toBe(7);
    });

    test('getCachedRoleLoad caches result on second call', () => {
        const tasks = [{ id: 1, excluded: 0, est: { fe: 5 } }];
        const roles = [{ id: 'fe' }];
        const config = { days: 10, availCoef: 93.5, alert: 3 };
        const load1 = service.getCachedRoleLoad(tasks, roles, config);
        const load2 = service.getCachedRoleLoad(tasks, roles, config);
        expect(load1).toBe(load2); // same reference from cache
    });

    // ── invalidate ────────────────────────────────────────────────────────

    test('invalidate clears priority cache', () => {
        const calc = jest.fn().mockReturnValue(9);
        service.setPriorityScoreCalculator(calc);
        const task = { id: 4, criteriaEvaluations: {} };
        const criteria = [{ id: 'c1', weight: 100 }];
        service.getCachedPriorityScore(task, criteria);
        service.invalidate();
        service.getCachedPriorityScore(task, criteria);
        expect(calc).toHaveBeenCalledTimes(2); // recomputed after invalidate
    });

    test('invalidate clears role load cache', () => {
        const tasks = [{ id: 1, excluded: 0, est: { fe: 5 } }];
        const roles = [{ id: 'fe' }];
        const config = { days: 10, availCoef: 93.5, alert: 3 };
        const load1 = service.getCachedRoleLoad(tasks, roles, config);
        service.invalidate();
        const load2 = service.getCachedRoleLoad(tasks, roles, config);
        // After invalidate, a new object is created (not same reference)
        expect(load2).toEqual(load1);
        expect(load2).not.toBe(load1);
    });
});
