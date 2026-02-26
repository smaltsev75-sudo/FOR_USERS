// js/utils/lruCache.js

/**
 * A simple Least-Recently-Used (LRU) cache backed by a Map.
 * Entries are evicted in insertion order once the capacity is exceeded.
 */
export class LruCache {
    /**
     * @param {number} capacity - Maximum number of entries to keep.
     */
    constructor(capacity = 10) {
        this._capacity = capacity;
        this._map = new Map();
    }

    /**
     * Returns the cached value for the given key, or undefined if not present.
     * Moves the accessed entry to the end (most-recently-used position).
     * @param {string} key
     * @returns {*}
     */
    get(key) {
        if (!this._map.has(key)) return undefined;
        const value = this._map.get(key);
        // Re-insert to mark as most-recently-used
        this._map.delete(key);
        this._map.set(key, value);
        return value;
    }

    /**
     * Returns true if the key exists in the cache.
     * Does NOT affect LRU order (use get() if you need the value).
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        return this._map.has(key);
    }

    /**
     * Stores a value. If the key already exists it is promoted to the
     * most-recently-used position (consistent with get() semantics).
     * Evicts the oldest entry if capacity is exceeded.
     * @param {string} key
     * @param {*} value
     */
    set(key, value) {
        // Remove first so the key is re-inserted at the end (MRU position)
        if (this._map.has(key)) this._map.delete(key);
        this._map.set(key, value);
        if (this._map.size > this._capacity) {
            const oldestKey = this._map.keys().next().value;
            this._map.delete(oldestKey);
        }
    }

    /**
     * Removes all entries from the cache.
     */
    clear() {
        this._map.clear();
    }

    /**
     * Returns the current number of entries.
     * @returns {number}
     */
    get size() {
        return this._map.size;
    }
}
