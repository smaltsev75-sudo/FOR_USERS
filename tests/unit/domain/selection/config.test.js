import { SELECTION_CONFIG, ALGORITHM_KEYS } from '../../../../js/domain/selection/config.js';

describe('domain/selection/config', () => {
    test('contains required algorithm keys', () => {
        expect(SELECTION_CONFIG.ALGORITHMS).toEqual(
            expect.objectContaining({
                MATRIX: 'matrix',
                VALUE_DENSITY: 'value-density',
                HYBRID: 'hybrid'
            })
        );
    });

    test('contains role list used by selectors', () => {
        expect(SELECTION_CONFIG.ROLES).toEqual(['uiux', 'ca', 'fe', 'be', 'qa']);
    });

    test('ALGORITHM_KEYS exports ordered array of algorithm keys', () => {
        expect(ALGORITHM_KEYS).toEqual(['matrix', 'value-density', 'hybrid']);
    });

    test('ALGORITHM_KEYS contains all algorithms from SELECTION_CONFIG', () => {
        const configAlgos = Object.values(SELECTION_CONFIG.ALGORITHMS);
        expect(ALGORITHM_KEYS).toHaveLength(configAlgos.length);
        configAlgos.forEach(algo => {
            expect(ALGORITHM_KEYS).toContain(algo);
        });
    });
});
