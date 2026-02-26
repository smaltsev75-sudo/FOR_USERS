// js/controllers/task/taskCacheService.js

import { LruCache } from '../../utils/lruCache.js';

/**
 * Manages priority-score and role-load caches for TaskController.
 * Extracted to keep TaskController focused on UI orchestration.
 */
export class TaskCacheService {
    constructor() {
        /** @type {LruCache} */
        this._priorityCache = new LruCache(200);
        /** @type {LruCache} */
        this._roleLoadCache = new LruCache(20);
        /** @type {Function|null} */
        this._calculatePriorityScore = null;
    }

    /**
     * Sets the priority-score calculator function.
     * @param {Function} fn - (task) => number
     */
    setPriorityScoreCalculator(fn) {
        this._calculatePriorityScore = fn;
    }

    /**
     * Returns true if a priority-score calculator has been set.
     * @returns {boolean}
     */
    isReady() {
        return this._calculatePriorityScore !== null;
    }

    /**
     * Returns the cached priority score for a task, computing it if necessary.
     * @param {Object} task
     * @param {Array} criteria
     * @returns {number}
     */
    getCachedPriorityScore(task, criteria) {
        if (!this._calculatePriorityScore) return 0;
        const criteriaHash = criteria.map(c => `${c.id}:${c.weight}`).join('|');
        const cacheKey = `${task.id}_${criteriaHash}`;
        const cached = this._priorityCache.get(cacheKey);
        if (cached !== undefined) return cached;
        const score = this._calculatePriorityScore(task);
        this._priorityCache.set(cacheKey, score);
        return score;
    }

    /**
     * Returns the cached role-load map, computing it if necessary.
     * @param {Array} tasks
     * @param {Array} roles
     * @param {Object} config
     * @returns {Object} - { [roleId]: number }
     */
    getCachedRoleLoad(tasks, roles, config) {
        const tasksHash = tasks.map(t => `${t.id}:${t.excluded}:${JSON.stringify(t.est)}`).join('|');
        const configHash = `${config.days}_${config.availCoef}_${config.alert}`;
        const cacheKey = `${tasksHash}_${configHash}`;
        const cached = this._roleLoadCache.get(cacheKey);
        if (cached !== undefined) return cached;
        const loadByRole = {};
        roles.forEach(role => {
            loadByRole[role.id] = tasks.reduce((sum, task) => {
                if (task.excluded) return sum;
                return sum + (task.est[role.id] || 0);
            }, 0);
        });
        this._roleLoadCache.set(cacheKey, loadByRole);
        return loadByRole;
    }

    /**
     * Clears all caches.
     */
    invalidate() {
        this._priorityCache.clear();
        this._roleLoadCache.clear();
    }
}
