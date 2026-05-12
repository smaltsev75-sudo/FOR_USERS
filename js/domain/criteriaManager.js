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

    /**
     * Обновляет только вес критерия (без затрагивания scale/rationale/etc).
     * Используется inline-редактором веса в карточке. Отдельный метод вместо
     * `updateCriteria(id, fullData)`, чтобы не требовать передачи всех полей.
     * @param {number} id
     * @param {number} weight - целое число 0..100
     * @returns {boolean} true если критерий найден и обновлён
     */
    updateCriteriaWeight(id, weight) {
        const c = this.getCriteriaById(id);
        if (!c) return false;
        const w = Math.max(0, Math.min(100, Math.round(Number(weight) || 0)));
        c.weight = w;
        return true;
    }

    /**
     * Авто-баланс весов до суммы 100%.
     *  - Если все веса нулевые — равномерное распределение (с раздачей
     *    остатка от целочисленного деления первым критериям).
     *  - Иначе — пропорциональное масштабирование с округлением вниз и
     *    раздачей остатка критериям с наибольшей дробной частью
     *    (метод наибольших остатков, гарантирует точную сумму 100).
     * Возвращает false, если критериев нет или сумма уже равна 100.
     * @returns {boolean} true если веса были изменены
     */
    autoBalance() {
        const n = this.criteria.length;
        if (n === 0) return false;
        const total = this.getTotalWeight();
        if (total === 100) return false;

        if (total === 0) {
            const base = Math.floor(100 / n);
            const remainder = 100 - base * n;
            this.criteria.forEach((c, i) => {
                c.weight = base + (i < remainder ? 1 : 0);
            });
            return true;
        }

        const scaled = this.criteria.map(c => (c.weight * 100) / total);
        const floored = scaled.map(s => Math.floor(s));
        const distributed = 100 - floored.reduce((a, b) => a + b, 0);
        const fracs = scaled
            .map((s, i) => ({ i, frac: s - floored[i] }))
            .sort((a, b) => b.frac - a.frac);
        for (let k = 0; k < distributed; k++) {
            floored[fracs[k].i] += 1;
        }
        this.criteria.forEach((c, i) => { c.weight = floored[i]; });
        return true;
    }

    /**
     * Меняет порядок критериев на основании списка ID.
     * Используется при drag-and-drop переупорядочивании.
     * Возвращает false если orderedIds не покрывает все существующие критерии
     * (защита от потери данных при ошибке вызывающего кода).
     * @param {number[]} orderedIds
     * @returns {boolean}
     */
    reorderCriteria(orderedIds) {
        if (!Array.isArray(orderedIds)) return false;
        const map = new Map(this.criteria.map(c => [c.id, c]));
        const reordered = orderedIds.map(id => map.get(id)).filter(Boolean);
        if (reordered.length !== this.criteria.length) return false;
        this.criteria = reordered;
        return true;
    }
}
