/**
 * @jest-environment jsdom
 */
import { showModal, hideModal, isModalOpen } from '../../../js/ui/modalManager.js';

describe('modalManager', () => {
    let modal;

    beforeEach(() => {
        modal = document.createElement('div');
        modal.id = 'testModal';
        modal.style.display = 'none';
        document.body.appendChild(modal);
    });

    afterEach(() => {
        modal.remove();
    });

    test('showModal устанавливает display и класс', () => {
        showModal(modal);
        expect(modal.style.display).toBe('flex');
        expect(modal.classList.contains('is-open')).toBe(true);
    });

    test('hideModal скрывает и убирает класс', () => {
        showModal(modal);
        hideModal(modal);
        expect(modal.style.display).toBe('none');
        expect(modal.classList.contains('is-open')).toBe(false);
    });

    test('isModalOpen возвращает true для открытого модала', () => {
        expect(isModalOpen(modal)).toBe(false);
        showModal(modal);
        expect(isModalOpen(modal)).toBe(true);
        hideModal(modal);
        expect(isModalOpen(modal)).toBe(false);
    });

    test('showModal/hideModal безопасны для null', () => {
        expect(() => showModal(null)).not.toThrow();
        expect(() => hideModal(null)).not.toThrow();
        expect(isModalOpen(null)).toBe(false);
    });
});
