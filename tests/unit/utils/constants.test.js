import { DEFAULT_CRITERIA, ROLES } from '../../../js/utils/constants.js';

describe('utils/constants', () => {
    test('roles list is stable and unique by id', () => {
        expect(ROLES).toHaveLength(5);
        const ids = ROLES.map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test('default criteria have total weight 100', () => {
        const totalWeight = DEFAULT_CRITERIA.reduce((sum, c) => sum + c.weight, 0);
        expect(totalWeight).toBe(100);
    });
});
