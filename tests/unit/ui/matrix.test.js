import { renderMatrix } from '../../../js/ui/matrix.js';

describe('ui/matrix', () => {
    const nfs = { formatNumber: (v) => Number(v).toFixed(1) };

    test('renders rows and totals by task type', () => {
        document.body.innerHTML = `
            <table>
                <tbody id="matrixBody"></tbody>
                <tfoot id="matrixFooter"></tfoot>
            </table>
        `;

        const state = {
            config: { days: 10, availCoef: 90, alert: 3 },
            roles: [
                { id: 'fe', name: 'FE', fte: 100, off: 0 },
                { id: 'qa', name: 'QA', fte: 100, off: 0 }
            ],
            tasks: [
                { type: 'bug', excluded: 0, est: { fe: 3, qa: 1 } },
                { type: 'us', excluded: 0, est: { fe: 2, qa: 2 } },
                { type: 'tech', excluded: 1, est: { fe: 8, qa: 8 } }
            ]
        };

        renderMatrix(state, nfs);

        const body = document.getElementById('matrixBody').innerHTML;
        const footer = document.getElementById('matrixFooter').innerHTML;
        expect(body).toContain('FE');
        expect(body).toContain('QA');
        expect(footer).toContain('ИТОГО');
        expect(footer).toContain('0.0');
        expect(footer).toContain('4.0');
    });

    test('returns early when DOM elements missing', () => {
        document.body.innerHTML = '';
        const state = { config: {}, roles: [], tasks: [] };
        // Should not throw
        expect(() => renderMatrix(state, nfs)).not.toThrow();
    });

    test('renders 0% when totalAvailable is 0', () => {
        document.body.innerHTML = `
            <table>
                <tbody id="matrixBody"></tbody>
                <tfoot id="matrixFooter"></tfoot>
            </table>
        `;
        const state = {
            config: { days: 0, availCoef: 0, alert: 3 },
            roles: [{ id: 'fe', name: 'FE', fte: 0, off: 0 }],
            tasks: [{ type: 'bug', excluded: 0, est: { fe: 5 } }]
        };
        renderMatrix(state, nfs);
        const footer = document.getElementById('matrixFooter').innerHTML;
        expect(footer).toContain('0.0%');
    });

    test('handles tasks with missing role estimates', () => {
        document.body.innerHTML = `
            <table>
                <tbody id="matrixBody"></tbody>
                <tfoot id="matrixFooter"></tfoot>
            </table>
        `;
        const state = {
            config: { days: 10, availCoef: 100, alert: 3 },
            roles: [
                { id: 'fe', name: 'FE', fte: 100, off: 0 },
                { id: 'be', name: 'BE', fte: 100, off: 0 }
            ],
            tasks: [{ type: 'us', excluded: 0, est: { fe: 3 } }] // no 'be' key
        };
        renderMatrix(state, nfs);
        const body = document.getElementById('matrixBody').innerHTML;
        expect(body).toContain('BE');
    });
});
