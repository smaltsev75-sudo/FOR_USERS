import { jest } from '@jest/globals';
import {
    createDefaultRoles,
    calculateAvailability,
    calculateRoleLoad,
    calculateTeamLoad,
    calculateCapacityByRole,
    getRoleLoadColor
} from '../../../js/domain/role.js';

describe('domain/role', () => {
    test('createDefaultRoles returns array of 5 roles with default values', () => {
        const roles = createDefaultRoles();
        expect(roles).toHaveLength(5);
        expect(roles[0]).toHaveProperty('id', 'uiux');
        expect(roles[0].fte).toBe(100);
        expect(roles[0].off).toBe(0);
    });

    test('calculateAvailability returns correct useful hours', () => {
        const role = { fte: 100, off: 0 };
        const config = { days: 10, availCoef: 93.5 };
        const result = calculateAvailability(role, config);
        expect(result.useful).toBeCloseTo(61.068, 3);
    });

    test('calculateAvailability handles zero FTE', () => {
        const role = { fte: 0, off: 0 };
        const config = { days: 10, availCoef: 93.5 };
        const result = calculateAvailability(role, config);
        expect(result.useful).toBe(0);
    });

    test('calculateAvailability handles off days > sprint days', () => {
        const role = { fte: 100, off: 15 };
        const config = { days: 10, availCoef: 93.5 };
        const result = calculateAvailability(role, config);
        expect(result.useful).toBe(0);
    });

    test('calculateRoleLoad sums estimates for included tasks', () => {
        const tasks = [
            { excluded: 0, est: { uiux: 5, ca: 2, fe: 3, be: 4, qa: 1 } },
            { excluded: 1, est: { uiux: 10, ca: 0, fe: 0, be: 0, qa: 0 } },
            { excluded: 0, est: { uiux: 3, ca: 0, fe: 0, be: 0, qa: 0 } }
        ];
        const load = calculateRoleLoad('uiux', tasks);
        expect(load).toBe(8);
    });

    test('calculateRoleLoad for excluded tasks only', () => {
        const tasks = [
            { excluded: 0, est: { uiux: 5 } },
            { excluded: 1, est: { uiux: 10 } }
        ];
        const load = calculateRoleLoad('uiux', tasks, true);
        expect(load).toBe(10);
    });

    test('calculateTeamLoad returns correct totals', () => {
        const roles = createDefaultRoles();
        const config = { days: 10, availCoef: 93.5 };
        const tasks = [
            { excluded: 0, est: { uiux: 5, ca: 2, fe: 3, be: 4, qa: 1 } }
        ];
        const teamLoad = calculateTeamLoad(roles, tasks, config);
        expect(teamLoad.totalUsed).toBe(15);
        expect(teamLoad.totalAvailable).toBeGreaterThan(0);
    });

    test('calculateTeamLoad handles empty tasks', () => {
        const roles = createDefaultRoles();
        const config = { days: 10, availCoef: 93.5 };
        const teamLoad = calculateTeamLoad(roles, [], config);
        expect(teamLoad.totalUsed).toBe(0);
        expect(teamLoad.percentage).toBe(0);
    });

    test('calculateCapacityByRole returns object with capacities', () => {
        const roles = createDefaultRoles();
        const config = { days: 10, availCoef: 93.5 };
        const caps = calculateCapacityByRole(roles, config);
        expect(caps).toHaveProperty('uiux');
        expect(caps.uiux).toBeCloseTo(61.068, 3);
    });

    test('getRoleLoadColor returns correct color based on percentage and alert', () => {
        expect(getRoleLoadColor(105, 3)).toBe('var(--danger)');
        expect(getRoleLoadColor(98, 3)).toBe('var(--warning)');
        expect(getRoleLoadColor(80, 3)).toBe('var(--success)');
        expect(getRoleLoadColor(103, 3)).toBe('var(--warning)');
        expect(getRoleLoadColor(104, 3)).toBe('var(--danger)');
    });
});
