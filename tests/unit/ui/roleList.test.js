import { jest } from '@jest/globals';
import { renderRoleList, renderTeamTotal } from '../../../js/ui/roleList.js';

describe('renderRoleList', () => {
    let nfs;

    beforeEach(() => {
        nfs = { formatNumber: jest.fn(x => String(x)) };
    });

    it('renders roles with correct structure', () => {
        document.body.innerHTML = '<div id="roleList"></div>';
        const container = document.getElementById('roleList');
        const state = {
            config: { days: 10, availCoef: 100, alert: 80 },
            roles: [
                { id: 'dev', name: 'Developer', fte: 100, off: 0 },
                { id: 'qa', name: 'QA', fte: 50, off: 2 }
            ],
            tasks: [
                { est: { dev: 20, qa: 10 } },
                { est: { dev: 10, qa: 5 } }
            ]
        };
        renderRoleList(state, nfs);
        expect(container.children.length).toBe(2);
        expect(container.innerHTML).toContain('Developer');
        expect(container.innerHTML).toContain('QA');
    });

    it('does nothing if roleList element is missing', () => {
        document.body.innerHTML = '';
        const state = { config: {}, roles: [], tasks: [] };
        expect(() => renderRoleList(state, nfs)).not.toThrow();
    });

    it('renders FTE input with correct value', () => {
        document.body.innerHTML = '<div id="roleList"></div>';
        const state = {
            config: { days: 10, availCoef: 100, alert: 80 },
            roles: [{ id: 'fe', name: 'FE', fte: 75, off: 0 }],
            tasks: []
        };
        renderRoleList(state, nfs);
        const fteInput = document.querySelector('.input-fte[data-role="fe"]');
        expect(fteInput).not.toBeNull();
        expect(fteInput.dataset.field).toBe('fte');
    });

    it('renders off-days input with correct value', () => {
        document.body.innerHTML = '<div id="roleList"></div>';
        const state = {
            config: { days: 10, availCoef: 100, alert: 80 },
            roles: [{ id: 'be', name: 'BE', fte: 100, off: 3 }],
            tasks: []
        };
        renderRoleList(state, nfs);
        const offInput = document.querySelector('.input-off[data-role="be"]');
        expect(offInput).not.toBeNull();
        expect(offInput.value).toBe('3');
    });

    it('excludes excluded tasks from load calculation', () => {
        document.body.innerHTML = '<div id="roleList"></div>';
        const state = {
            config: { days: 10, availCoef: 100, alert: 80 },
            roles: [{ id: 'fe', name: 'FE', fte: 100, off: 0 }],
            tasks: [
                { est: { fe: 10 }, excluded: 0 },
                { est: { fe: 20 }, excluded: 1 } // should not count
            ]
        };
        renderRoleList(state, nfs);
        // formatNumber should be called with 10 (not 30)
        expect(nfs.formatNumber).toHaveBeenCalledWith(10);
    });
});

describe('renderTeamTotal', () => {
    let nfs;

    beforeEach(() => {
        nfs = { formatNumber: jest.fn(x => String(x)) };
    });

    it('renders team total row with correct structure', () => {
        document.body.innerHTML = '<div id="roleTotal"></div>';
        const state = {
            config: { days: 10, availCoef: 100, alert: 80 },
            roles: [
                { id: 'fe', name: 'FE', fte: 100, off: 0 },
                { id: 'be', name: 'BE', fte: 100, off: 0 }
            ],
            tasks: [
                { est: { fe: 5, be: 3 }, excluded: 0 }
            ]
        };
        renderTeamTotal(state, nfs);
        const el = document.getElementById('roleTotal');
        expect(el.innerHTML).toContain('ИТОГО');
    });

    it('does nothing if roleTotal element is missing', () => {
        document.body.innerHTML = '';
        const state = {
            config: { days: 10, availCoef: 100, alert: 80 },
            roles: [],
            tasks: []
        };
        expect(() => renderTeamTotal(state, nfs)).not.toThrow();
    });

    it('renders progress bar in team total', () => {
        document.body.innerHTML = '<div id="roleTotal"></div>';
        const state = {
            config: { days: 10, availCoef: 100, alert: 80 },
            roles: [{ id: 'fe', name: 'FE', fte: 100, off: 0 }],
            tasks: [{ est: { fe: 10 }, excluded: 0 }]
        };
        renderTeamTotal(state, nfs);
        expect(document.querySelector('.progress-fill')).not.toBeNull();
    });
});
