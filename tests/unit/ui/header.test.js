import { renderHeader } from '../../../js/ui/header.js';

describe('ui/header', () => {
    function setup(tasks) {
        document.body.innerHTML = `
            <div id="includedTasksHeader"></div>
            <div id="excludedTasksHeader"></div>
        `;
        renderHeader({ tasks });
    }

    // ── Basic counters ─────────────────────────────────────────────────────

    test('renders included and excluded counters', () => {
        setup([
            { excluded: 0, type: 'us' },
            { excluded: 0, type: 'bug' },
            { excluded: 1, type: 'tech' }
        ]);

        const included = document.getElementById('includedTasksHeader').textContent;
        const excluded = document.getElementById('excludedTasksHeader').textContent;
        expect(included).toContain('Задач в спринте: 2');
        expect(excluded).toContain('Исключено из спринта: 1');
    });

    test('shows zero counts when no tasks', () => {
        setup([]);
        expect(document.getElementById('includedTasksHeader').textContent).toContain('Задач в спринте: 0');
        expect(document.getElementById('excludedTasksHeader').textContent).toContain('Исключено из спринта: 0');
    });

    // ── Excluded details breakdown ─────────────────────────────────────────

    describe('excluded counter details', () => {
        test('shows US detail when excluded us task present', () => {
            setup([{ excluded: 1, type: 'us' }]);
            const text = document.getElementById('excludedTasksHeader').textContent;
            expect(text).toContain('US:1');
        });

        test('shows Bug detail when excluded bug task present', () => {
            setup([{ excluded: 1, type: 'bug' }]);
            const text = document.getElementById('excludedTasksHeader').textContent;
            expect(text).toContain('Bug:1');
        });

        test('shows Tech detail when excluded tech task present', () => {
            setup([{ excluded: 1, type: 'tech' }]);
            const text = document.getElementById('excludedTasksHeader').textContent;
            expect(text).toContain('Tech:1');
        });

        test('shows all three type details when all types excluded', () => {
            setup([
                { excluded: 1, type: 'us' },
                { excluded: 1, type: 'bug' },
                { excluded: 1, type: 'tech' }
            ]);
            const text = document.getElementById('excludedTasksHeader').textContent;
            expect(text).toContain('US:1');
            expect(text).toContain('Bug:1');
            expect(text).toContain('Tech:1');
        });

        test('does not show details when no tasks are excluded', () => {
            setup([{ excluded: 0, type: 'us' }]);
            const text = document.getElementById('excludedTasksHeader').textContent;
            expect(text).not.toContain('US:');
            expect(text).not.toContain('Bug:');
            expect(text).not.toContain('Tech:');
        });

        test('counts multiple excluded tasks of same type', () => {
            setup([
                { excluded: 1, type: 'us' },
                { excluded: 1, type: 'us' },
                { excluded: 1, type: 'bug' }
            ]);
            const text = document.getElementById('excludedTasksHeader').textContent;
            expect(text).toContain('US:2');
            expect(text).toContain('Bug:1');
        });
    });

    // ── Included details breakdown ─────────────────────────────────────────

    describe('included counter details', () => {
        test('shows US detail when included us task present', () => {
            setup([{ excluded: 0, type: 'us' }]);
            const text = document.getElementById('includedTasksHeader').textContent;
            expect(text).toContain('US:1');
        });

        test('shows Bug detail when included bug task present', () => {
            setup([{ excluded: 0, type: 'bug' }]);
            const text = document.getElementById('includedTasksHeader').textContent;
            expect(text).toContain('Bug:1');
        });

        test('shows Tech detail when included tech task present', () => {
            setup([{ excluded: 0, type: 'tech' }]);
            const text = document.getElementById('includedTasksHeader').textContent;
            expect(text).toContain('Tech:1');
        });

        test('shows all three type details when all types included', () => {
            setup([
                { excluded: 0, type: 'us' },
                { excluded: 0, type: 'bug' },
                { excluded: 0, type: 'tech' }
            ]);
            const text = document.getElementById('includedTasksHeader').textContent;
            expect(text).toContain('US:1');
            expect(text).toContain('Bug:1');
            expect(text).toContain('Tech:1');
        });

        test('does not show details when no tasks are included', () => {
            setup([{ excluded: 1, type: 'us' }]);
            const text = document.getElementById('includedTasksHeader').textContent;
            expect(text).not.toContain('US:');
            expect(text).not.toContain('Bug:');
            expect(text).not.toContain('Tech:');
        });

        test('counts multiple included tasks of same type', () => {
            setup([
                { excluded: 0, type: 'us' },
                { excluded: 0, type: 'us' },
                { excluded: 0, type: 'tech' }
            ]);
            const text = document.getElementById('includedTasksHeader').textContent;
            expect(text).toContain('US:2');
            expect(text).toContain('Tech:1');
        });
    });

    // ── Missing DOM elements guard ─────────────────────────────────────────

    test('does not throw when header elements are missing', () => {
        document.body.innerHTML = '';
        expect(() => renderHeader({ tasks: [{ excluded: 0, type: 'us' }] })).not.toThrow();
    });

    // ── Mixed included/excluded ────────────────────────────────────────────

    test('correctly separates included and excluded counts', () => {
        setup([
            { excluded: 0, type: 'us' },
            { excluded: 0, type: 'us' },
            { excluded: 1, type: 'us' },
            { excluded: 0, type: 'bug' },
            { excluded: 1, type: 'tech' },
            { excluded: 1, type: 'tech' }
        ]);
        const includedText = document.getElementById('includedTasksHeader').textContent;
        const excludedText = document.getElementById('excludedTasksHeader').textContent;

        expect(includedText).toContain('Задач в спринте: 3');
        expect(includedText).toContain('US:2');
        expect(includedText).toContain('Bug:1');
        expect(includedText).not.toContain('Tech:');

        expect(excludedText).toContain('Исключено из спринта: 3');
        expect(excludedText).toContain('US:1');
        expect(excludedText).toContain('Tech:2');
        expect(excludedText).not.toContain('Bug:');
    });
});
