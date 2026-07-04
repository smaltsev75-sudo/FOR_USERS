// js/domain/criteriaOps.js

import { DEFAULT_CRITERIA } from '../utils/constants.js';
import { calculatePriorityScore as calculatePriorityScoreFn } from './criteria.js';

let _nextCriteriaId = Date.now();

export function _resetCriteriaIdCounter(seed = 0) {
    _nextCriteriaId = Number(seed) || 0;
}

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function cloneCriterion(criterion = {}) {
    const safe = isPlainObject(criterion) ? criterion : {};
    return {
        ...safe,
        scale: isPlainObject(safe.scale) ? { ...safe.scale } : {}
    };
}

export function cloneCriteria(criteria = []) {
    return Array.isArray(criteria) ? criteria.map(cloneCriterion) : [];
}

export function loadDefaultCriteria() {
    return cloneCriteria(DEFAULT_CRITERIA);
}

export function loadCriteria(criteriaArray = []) {
    return cloneCriteria(criteriaArray);
}

export function getCriterionById(criteria = [], id) {
    return (criteria || []).find(c => c.id === id);
}

export function getCriterionByAbbreviation(criteria = [], abbreviation = '') {
    const normalized = String(abbreviation).toUpperCase();
    return (criteria || []).find(c => String(c.abbreviation || '').toUpperCase() === normalized);
}

export function addCriterion(criteria = [], criteriaData = {}) {
    const newCriterion = {
        ...criteriaData,
        id: ++_nextCriteriaId,
        scale: isPlainObject(criteriaData.scale) ? { ...criteriaData.scale } : {}
    };
    return [...cloneCriteria(criteria), newCriterion];
}

export function updateCriterion(criteria = [], id, updatedData = {}) {
    const index = (criteria || []).findIndex(c => c.id === id);
    if (index === -1) return criteria;
    return criteria.map(c => (
        c.id === id
            ? {
                ...updatedData,
                id,
                scale: isPlainObject(updatedData.scale) ? { ...updatedData.scale } : {}
            }
            : cloneCriterion(c)
    ));
}

export function deleteCriterion(criteria = [], id) {
    if (!(criteria || []).some(c => c.id === id)) return criteria;
    return (criteria || []).filter(c => c.id !== id).map(cloneCriterion);
}

export function getTotalWeight(criteria = []) {
    return (criteria || []).reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
}

export function isWeightValid(criteria = []) {
    return getTotalWeight(criteria) === 100;
}

export function calculatePriorityScoreForTask(criteria = [], evaluations = {}) {
    return calculatePriorityScoreFn(criteria, evaluations);
}

export function getMobileAbbreviation(criteria = [], criterionOrId, index = null) {
    if (Number.isInteger(index)) return `k-${index + 1}`;
    const id = typeof criterionOrId === 'object' && criterionOrId !== null
        ? criterionOrId.id
        : criterionOrId;
    const foundIndex = (criteria || []).findIndex(c => c.id === id);
    return foundIndex >= 0 ? `k-${foundIndex + 1}` : `k-${id}`;
}

export function updateCriterionWeight(criteria = [], id, weight) {
    if (!(criteria || []).some(c => c.id === id)) return criteria;
    const safeWeight = Math.max(0, Math.min(100, Math.round(Number(weight) || 0)));
    return (criteria || []).map(c => (
        c.id === id ? { ...cloneCriterion(c), weight: safeWeight } : cloneCriterion(c)
    ));
}

export function autoBalanceCriteria(criteria = []) {
    const list = criteria || [];
    const n = list.length;
    if (n === 0) return criteria;
    const total = getTotalWeight(list);
    if (total === 100) return criteria;

    const next = cloneCriteria(list);
    if (total === 0) {
        const base = Math.floor(100 / n);
        const remainder = 100 - base * n;
        return next.map((criterion, i) => ({
            ...criterion,
            weight: base + (i < remainder ? 1 : 0)
        }));
    }

    const scaled = next.map(c => ((Number(c.weight) || 0) * 100) / total);
    const floored = scaled.map(s => Math.floor(s));
    const distributed = 100 - floored.reduce((a, b) => a + b, 0);
    const fracs = scaled
        .map((s, i) => ({ i, frac: s - floored[i] }))
        .sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < distributed; k++) {
        floored[fracs[k].i] += 1;
    }
    return next.map((criterion, i) => ({ ...criterion, weight: floored[i] }));
}

export function reorderCriteria(criteria = [], orderedIds = []) {
    if (!Array.isArray(orderedIds)) return criteria;
    const list = criteria || [];
    const map = new Map(list.map(c => [c.id, c]));
    const reordered = orderedIds.map(id => map.get(id)).filter(Boolean);
    if (reordered.length !== list.length) return criteria;
    return reordered.map(cloneCriterion);
}
