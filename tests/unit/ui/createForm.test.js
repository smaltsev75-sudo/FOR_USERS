import { updateCreateFormTotal } from '../../../js/ui/createForm.js';

describe('ui/createForm', () => {
    test('updateCreateFormTotal writes aggregated effort', () => {
        document.body.innerHTML = `
            <input id="h_uiux" value="1" />
            <input id="h_ca" value="2" />
            <input id="h_fe" value="3" />
            <input id="h_be" value="4" />
            <input id="h_qa" value="5" />
            <div id="h_total"></div>
        `;

        const nfs = {
            parseNumber: (value) => Number(value),
            formatNumber: (value) => value.toFixed(1)
        };

        updateCreateFormTotal(nfs);

        expect(document.getElementById('h_total').textContent).toBe('15.0');
    });

    test('updateCreateFormTotal handles missing DOM elements gracefully', () => {
        document.body.innerHTML = '';

        const nfs = {
            parseNumber: () => 0,
            formatNumber: (value) => value.toFixed(1)
        };

        // Should not throw when elements are missing
        expect(() => updateCreateFormTotal(nfs)).not.toThrow();
    });

    test('updateCreateFormTotal handles NaN values as 0', () => {
        document.body.innerHTML = `
            <input id="h_uiux" value="abc" />
            <input id="h_ca" value="" />
            <input id="h_fe" value="3" />
            <input id="h_be" value="" />
            <input id="h_qa" value="" />
            <div id="h_total"></div>
        `;

        const nfs = {
            parseNumber: (value) => Number(value) || 0,
            formatNumber: (value) => String(value)
        };

        updateCreateFormTotal(nfs);
        expect(document.getElementById('h_total').textContent).toBe('3');
    });

    test('updateCreateFormTotal does nothing when h_total is missing', () => {
        document.body.innerHTML = `
            <input id="h_uiux" value="5" />
            <input id="h_ca" value="5" />
            <input id="h_fe" value="5" />
            <input id="h_be" value="5" />
            <input id="h_qa" value="5" />
        `;

        const nfs = {
            parseNumber: (value) => Number(value),
            formatNumber: (value) => value.toFixed(1)
        };

        expect(() => updateCreateFormTotal(nfs)).not.toThrow();
    });
});
