// js/controllers/viewModeController.js
// Контроллер переключения режима списка задач: List ↔ Quadrants (Stream C).
// Сохраняет выбранный режим в state.ui.viewMode (persist через store→persistence).

export class ViewModeController {
    /**
     * @param {Object} store — Store с методом setViewMode и getState
     */
    constructor(store) {
        this.store = store;
        this.buttons = null;
    }

    init() {
        this.buttons = document.querySelectorAll('.view-toggle-btn[data-view-mode]');
        // ВАЖНО: даже если кнопок нет в текущей разметке, регистрируем delegated
        // toggle-listener на #taskList — он работает для quadrant-групп,
        // которые рендерятся динамически.
        const self = this;

        if (this.buttons && this.buttons.length > 0) {
            this.syncFromState();
            this.buttons.forEach((btn) => {
                btn.addEventListener('click', () => {
                    const mode = btn.dataset.viewMode;
                    self.store.setViewMode(mode);
                    self.syncFromState();
                });
            });
        }

        // Делегированный toggle-listener для <details class="quadrant-group">.
        // Событие "toggle" не bubblet'ится по умолчанию — навешиваем capture-listener
        // на #taskList, иначе на корне body не сработает.
        const taskListEl = document.getElementById('taskList');
        if (taskListEl) {
            taskListEl.addEventListener('toggle', (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) return;
                if (!target.classList.contains('quadrant-group')) return;
                const key = target.dataset.quadrant;
                if (!key) return;
                self._syncDetailsToStore(key, target.open);
            }, true);
        }

        // Реагируем на любые изменения state.ui.viewMode (например, после loadState)
        this.store.subscribe(() => self.syncFromState());
    }

    /**
     * Прокидывает состояние одного <details> в store, не вызывая лишних toggle'ов.
     * Если store уже в нужном состоянии — ничего не делает.
     * @param {string} key
     * @param {boolean} isOpen
     * @private
     */
    _syncDetailsToStore(key, isOpen) {
        const expanded = this.store.getState().ui?.expandedQuadrants || [];
        const isInStore = expanded.includes(key);
        if (isOpen && !isInStore) {
            this.store.toggleQuadrantExpanded(key);
        } else if (!isOpen && isInStore) {
            this.store.toggleQuadrantExpanded(key);
        }
    }

    /**
     * Синхронизирует aria-pressed/active у кнопок с текущим state.ui.viewMode.
     */
    syncFromState() {
        if (!this.buttons) return;
        const state = this.store.getState();
        const currentMode = state.ui?.viewMode || 'list';
        this.buttons.forEach((btn) => {
            const isActive = btn.dataset.viewMode === currentMode;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }
}
