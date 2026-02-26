import { renderCriteriaList, generateScaleEditorHTML } from '../../../js/ui/criteriaList.js';

describe('ui/criteriaList', () => {
    const nfs = { formatNumber: (x) => String(x) };

    test('renders list with total weight and escaped scale values', () => {
        document.body.innerHTML = '<div id="criteriaList"></div>';
        const state = {
            criteria: [
                {
                    id: 1,
                    name: 'Impact',
                    abbreviation: 'IMP',
                    weight: 100,
                    rationale: 'Rationale',
                    scale: { 1: '<b>XSS</b>' }
                }
            ]
        };

        renderCriteriaList(state, nfs);

        const html = document.getElementById('criteriaList').innerHTML;
        expect(html).toContain('Общий процент весов:');
        expect(html).toContain('100%');
        expect(html).toContain('&lt;b&gt;XSS&lt;/b&gt;');
        expect(html).not.toContain('<b>XSS</b>');
    });

    test('toggles criterion scale block on click', () => {
        document.body.innerHTML = '<div id="criteriaList"></div>';
        renderCriteriaList({
            criteria: [{
                id: 5, name: 'C', abbreviation: 'C', weight: 100, rationale: '', scale: {}
            }]
        }, nfs);

        const toggle = document.querySelector('.scale-toggle');
        const scaleEl = document.getElementById('scale_5');
        expect(scaleEl.classList.contains('expanded')).toBe(false);

        toggle.click();
        expect(scaleEl.classList.contains('expanded')).toBe(true);

        // Toggle back (collapse)
        toggle.click();
        expect(scaleEl.classList.contains('expanded')).toBe(false);
    });

    test('returns early when criteriaList element is missing', () => {
        document.body.innerHTML = '';
        expect(() => renderCriteriaList({ criteria: [] }, nfs)).not.toThrow();
    });

    test('renders empty message when no criteria', () => {
        document.body.innerHTML = '<div id="criteriaList"></div>';
        renderCriteriaList({ criteria: [] }, nfs);
        const html = document.getElementById('criteriaList').innerHTML;
        expect(html).toContain('Нет критериев');
    });

    test('shows weight-invalid class when total !== 100', () => {
        document.body.innerHTML = '<div id="criteriaList"></div>';
        renderCriteriaList({
            criteria: [{
                id: 1, name: 'A', abbreviation: 'A', weight: 50, rationale: 'R', scale: {}
            }]
        }, nfs);
        const html = document.getElementById('criteriaList').innerHTML;
        expect(html).toContain('weight-invalid');
        expect(html).toContain('50%');
    });

    test('renders bottom total when >3 criteria', () => {
        document.body.innerHTML = '<div id="criteriaList"></div>';
        const criteria = [1, 2, 3, 4].map(i => ({
            id: i, name: `C${i}`, abbreviation: `C${i}`, weight: 25, rationale: 'R', scale: {}
        }));
        renderCriteriaList({ criteria }, nfs);
        const html = document.getElementById('criteriaList').innerHTML;
        // Both top and bottom total weights
        const matches = html.match(/Общий процент весов/g);
        expect(matches.length).toBe(2);
    });

    test('generateScaleEditorHTML creates 10 rows', () => {
        const html = generateScaleEditorHTML({ 1: 'Low', 5: 'Medium' });
        expect(html).toContain('scale-score');
        // Should have all 10 rows
        for (let i = 1; i <= 10; i++) {
            expect(html).toContain(`id="scale_${i}"`);
        }
        expect(html).toContain('Low');
        expect(html).toContain('Medium');
    });
});
