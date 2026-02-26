

import { jest } from '@jest/globals';
import { debounce } from '../../../js/utils/debounce.js';

describe('debounce', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    it('calls the function after wait', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);
        debounced('a');
        expect(fn).not.toBeCalled();
        jest.advanceTimersByTime(100);
        expect(fn).toBeCalledWith('a');
    });

    it('debounces multiple calls', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);
        debounced('a');
        debounced('b');
        debounced('c');
        jest.advanceTimersByTime(99);
        expect(fn).not.toBeCalled();
        jest.advanceTimersByTime(1);
        expect(fn).toBeCalledTimes(1);
        expect(fn).toBeCalledWith('c');
    });
});
