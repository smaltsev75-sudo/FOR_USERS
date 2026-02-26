// js/ui/modalManager.js
// Централизованное управление модальными окнами.
// Все модали открываются/закрываются через эти функции для единообразия.

/**
 * Открывает модальное окно (добавляет CSS-класс и устанавливает display).
 * @param {HTMLElement|null} modal — DOM-элемент модального окна
 */
export function showModal(modal) {
    if (!modal) return;
    modal.style.display = 'flex';
    modal.classList.add('is-open');
}

/**
 * Закрывает модальное окно (убирает CSS-класс и скрывает).
 * @param {HTMLElement|null} modal — DOM-элемент модального окна
 */
export function hideModal(modal) {
    if (!modal) return;
    modal.style.display = 'none';
    modal.classList.remove('is-open');
}

/**
 * Проверяет, открыто ли модальное окно.
 * @param {HTMLElement|null} modal
 * @returns {boolean}
 */
export function isModalOpen(modal) {
    if (!modal) return false;
    return modal.style.display === 'flex' || modal.classList.contains('is-open');
}
