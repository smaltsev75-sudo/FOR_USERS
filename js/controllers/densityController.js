// @ts-check
// js/controllers/densityController.js

/**
 * DensityController — переключение плотности отображения списка задач.
 *
 * Делегирует событие click на контейнер `.density-toggle` (data-density="...").
 * Изменения сохраняются в state.ui.density через `store.setDensity(value)`,
 * который автоматически persist'ится через `schedulePersist`.
 *
 * После каждого изменения обновляет aria-pressed на трёх кнопках —
 * визуальный feedback active-режима.
 */

const VALID_DENSITIES = ['compact', 'comfortable', 'cozy'];

export class DensityController {
    /**
     * @param {import('../state/store.js').Store} store
     */
    constructor(store) {
        this.store = store;
        this._toggle = null;
        this._handleClick = this._handleClick.bind(this);
        this._handleStateChange = this._handleStateChange.bind(this);
    }

    init() {
        this._toggle = document.querySelector('.density-toggle');
        if (!this._toggle) return;

        this._toggle.addEventListener('click', this._handleClick);
        this.store.subscribe(this._handleStateChange);

        // Восстановить начальное состояние из store
        this._updateButtonsFromState();
    }

    /**
     * Обрабатывает клик по кнопке density-btn.
     * @param {Event} e
     */
    _handleClick(e) {
        const target = /** @type {HTMLElement} */ (e.target);
        const btn = target && target.closest ? target.closest('.density-btn') : null;
        if (!btn) return;
        const density = btn.dataset.density;
        if (!VALID_DENSITIES.includes(density)) return;
        this.store.setDensity(density);
    }

    /**
     * Слушатель изменений state — обновляет aria-pressed на кнопках.
     */
    _handleStateChange() {
        this._updateButtonsFromState();
    }

    _updateButtonsFromState() {
        if (!this._toggle) return;
        const state = this.store.getState();
        const current = (state.ui && state.ui.density) || 'comfortable';
        const buttons = this._toggle.querySelectorAll('.density-btn');
        buttons.forEach((b) => {
            const value = b.getAttribute('data-density');
            const active = value === current;
            b.setAttribute('aria-pressed', String(active));
            b.classList.toggle('density-btn--active', active);
        });
    }
}
