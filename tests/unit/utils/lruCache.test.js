import { LruCache } from '../../../js/utils/lruCache.js';

describe('LruCache', () => {
    test('stores and retrieves values', () => {
        const cache = new LruCache(5);
        cache.set('a', 1);
        expect(cache.get('a')).toBe(1);
    });

    test('has() returns true for existing key', () => {
        const cache = new LruCache(5);
        cache.set('x', 42);
        expect(cache.has('x')).toBe(true);
    });

    test('has() returns false for missing key', () => {
        const cache = new LruCache(5);
        expect(cache.has('missing')).toBe(false);
    });

    test('get() returns undefined for missing key', () => {
        const cache = new LruCache(5);
        expect(cache.get('missing')).toBeUndefined();
    });

    test('size reflects number of entries', () => {
        const cache = new LruCache(10);
        cache.set('a', 1);
        cache.set('b', 2);
        expect(cache.size).toBe(2);
    });

    test('evicts oldest entry when capacity exceeded', () => {
        const cache = new LruCache(3);
        cache.set('a', 1);
        cache.set('b', 2);
        cache.set('c', 3);
        cache.set('d', 4); // 'a' should be evicted
        expect(cache.has('a')).toBe(false);
        expect(cache.has('b')).toBe(true);
        expect(cache.has('c')).toBe(true);
        expect(cache.has('d')).toBe(true);
        expect(cache.size).toBe(3);
    });

    test('get() promotes entry to most-recently-used (true LRU eviction)', () => {
        const cache = new LruCache(3);
        cache.set('a', 1);
        cache.set('b', 2);
        cache.set('c', 3);
        // Access 'a' — it should become MRU and survive the next eviction
        cache.get('a');
        cache.set('d', 4); // 'b' should be evicted (oldest after 'a' was promoted)
        expect(cache.has('a')).toBe(true);
        expect(cache.has('b')).toBe(false);
        expect(cache.has('c')).toBe(true);
        expect(cache.has('d')).toBe(true);
    });

    test('set() on existing key promotes it to most-recently-used', () => {
        const cache = new LruCache(3);
        cache.set('a', 1);
        cache.set('b', 2);
        cache.set('c', 3);
        // Re-write 'a' — it should become MRU and survive the next eviction
        cache.set('a', 99);
        cache.set('d', 4); // 'b' should be evicted (oldest after 'a' was promoted)
        expect(cache.has('a')).toBe(true);
        expect(cache.get('a')).toBe(99);
        expect(cache.has('b')).toBe(false);
        expect(cache.has('c')).toBe(true);
        expect(cache.has('d')).toBe(true);
    });

    test('does not exceed capacity', () => {
        const cache = new LruCache(2);
        cache.set('a', 1);
        cache.set('b', 2);
        cache.set('c', 3);
        cache.set('d', 4);
        expect(cache.size).toBe(2);
    });

    test('clear() removes all entries', () => {
        const cache = new LruCache(5);
        cache.set('a', 1);
        cache.set('b', 2);
        cache.clear();
        expect(cache.size).toBe(0);
        expect(cache.has('a')).toBe(false);
    });

    test('overwriting existing key does not increase size', () => {
        const cache = new LruCache(5);
        cache.set('a', 1);
        cache.set('a', 99);
        expect(cache.size).toBe(1);
        expect(cache.get('a')).toBe(99);
    });

    test('default capacity is 10', () => {
        const cache = new LruCache();
        for (let i = 0; i < 11; i++) cache.set(`k${i}`, i);
        expect(cache.size).toBe(10);
        expect(cache.has('k0')).toBe(false); // oldest evicted
    });
});
