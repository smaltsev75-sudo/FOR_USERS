// js/domain/criteriaManager.js

import { DEFAULT_CRITERIA } from '../utils/constants.js';
import {
    calculatePriorityScore as calculatePriorityScoreFn
} from './criteria.js';

/**
 * Monotonic ID counter for criteria. Seeded from Date.now() to avoid
 * collisions with previously deleted criteria across page reloads.
 */
let _nextCriteriaId = Date.now();

/**
 * Resets the criteria ID counter to the given seed value.
 * Intended for use in tests only — do not call in production code.
 * @param {number} [seed=0]
 */
export function _resetCriteriaIdCounter(seed = 0) {
    _nextCriteriaId = seed;
}

export class CriteriaManager {
    constructor() {
        this.criteria = [];
        this.editCriteriaId = null;
        this.loadDefaultCriteria();
    }

    loadDefaultCriteria() {
        this.criteria = DEFAULT_CRITERIA.map(c => ({
            ...c,
            scale: { ...c.scale }
        }));
    }

    loadCriteria(criteriaArray) {
        this.criteria = criteriaArray.map(c => ({
            ...c,
            scale: { ...(c.scale || {}) }
        }));
    }

    getCriteria() {
        return this.criteria;
    }

    getCriteriaById(id) {
        return this.criteria.find(c => c.id === id);
    }

    getCriteriaByAbbreviation(abbreviation) {
        const normalized = abbreviation.toUpperCase();
        return this.criteria.find(c => c.abbreviation.toUpperCase() === normalized);
    }

    addCriteria(criteriaData) {
        const newCriteria = {
            ...criteriaData,
            id: ++_nextCriteriaId,
            scale: criteriaData.scale || {}
        };
        this.criteria.push(newCriteria);
        return newCriteria;
    }

    updateCriteria(id, updatedData) {
        const index = this.criteria.findIndex(c => c.id === id);
        if (index !== -1) {
            this.criteria[index] = {
                ...updatedData,
                id,
                scale: updatedData.scale || {}
            };
            return true;
        }
        return false;
    }

    deleteCriteria(id) {
        const index = this.criteria.findIndex(c => c.id === id);
        if (index !== -1) {
            this.criteria.splice(index, 1);
            return true;
        }
        return false;
    }

    getTotalWeight() {
        return this.criteria.reduce((sum, c) => sum + c.weight, 0);
    }

    isWeightValid() {
        return this.getTotalWeight() === 100;
    }

    calculatePriorityScore(evaluations) {
        return calculatePriorityScoreFn(this.criteria, evaluations);
    }

    getMobileAbbreviation(criterion, index) {
        return `k-${index + 1}`;
    }
}
