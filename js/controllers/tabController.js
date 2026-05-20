// js/controllers/tabController.js
//
// v8.30.26: реализован полный ARIA tabs pattern + mobile burger toggle.
//   - aria-selected / aria-controls / tabindex синхронизируется при activateTab.
//   - keyboard navigation: ArrowLeft/ArrowRight/Home/End (W3C tabs pattern).
//   - Burger menu (.mobile-menu-toggle): toggle .tabs-container.active на mobile
//     (≤600px). Раньше HTML-кнопки не было — навигация между tab'ами была
//     физически невозможна на телефоне (см. RELEASE_NOTES v8.30.26 P1).

export class TabController {
    constructor(store) {
        this.store = store;
        this.tabButtons = document.querySelectorAll('.tab-btn');
        this.tabContents = document.querySelectorAll('.tab-content');
        this.tabsContainer = document.getElementById('tabsContainer');
        this.burgerToggle = document.getElementById('mobileMenuToggle');
    }

    init() {
        const savedTab = this.store.getState().activeTab || 'planning';
        this.activateTab(savedTab);

        // Click + keyboard на каждой tab-btn
        const self = this;
        this.tabButtons.forEach((button) => {
            button.addEventListener('click', () => {
                self.activateTab(button.dataset.tab);
                self._closeBurger();
            });
            button.addEventListener('keydown', (ev) => self._onTabKeydown(ev));
        });

        // Burger toggle (на mobile)
        if (this.burgerToggle && this.tabsContainer) {
            this.burgerToggle.addEventListener('click', () => self._toggleBurger());
        }

        // Click outside .tabs-container на mobile закрывает burger.
        document.addEventListener('click', (ev) => {
            if (!self.burgerToggle || !self.tabsContainer) return;
            if (!self.tabsContainer.classList.contains('active')) return;
            const inside = self.tabsContainer.contains(ev.target) || self.burgerToggle.contains(ev.target);
            if (!inside) self._closeBurger();
        });
    }

    activateTab(tabId) {
        for (let i = 0; i < this.tabContents.length; i++) {
            this.tabContents[i].style.display = 'none';
        }
        const activeContent = document.getElementById(tabId + 'TabContent');
        if (activeContent) {
            activeContent.style.display = 'block';
        }

        for (let j = 0; j < this.tabButtons.length; j++) {
            const btn = this.tabButtons[j];
            const isActive = btn.dataset.tab === tabId;
            btn.classList.toggle('active', isActive);
            // ARIA tabs pattern: aria-selected на текущей true, остальные false;
            // tabindex="0" только на текущей (roving tabindex) — Tab перемещает
            // в panel сразу, а внутри tablist навигация стрелками.
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
            btn.setAttribute('tabindex', isActive ? '0' : '-1');
        }

        this.store.setActiveTab(tabId);
    }

    /**
     * v8.30.26: W3C tabs keyboard pattern.
     *   - ArrowLeft / ArrowRight: переключение на соседнюю tab + focus.
     *   - Home / End: первая / последняя tab + focus.
     *   - Enter / Space: native button handler (click delegate).
     */
    _onTabKeydown(ev) {
        const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (!keys.includes(ev.key)) return;
        ev.preventDefault();

        const buttons = Array.from(this.tabButtons);
        const currentIndex = buttons.indexOf(ev.currentTarget);
        if (currentIndex === -1) return;

        let nextIndex;
        if (ev.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
        else if (ev.key === 'ArrowRight') nextIndex = (currentIndex + 1) % buttons.length;
        else if (ev.key === 'Home') nextIndex = 0;
        else nextIndex = buttons.length - 1;

        const nextBtn = buttons[nextIndex];
        this.activateTab(nextBtn.dataset.tab);
        nextBtn.focus();
    }

    _toggleBurger() {
        if (!this.tabsContainer || !this.burgerToggle) return;
        const willOpen = !this.tabsContainer.classList.contains('active');
        this.tabsContainer.classList.toggle('active', willOpen);
        this.burgerToggle.classList.toggle('active', willOpen);
        this.burgerToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    }

    _closeBurger() {
        if (!this.tabsContainer || !this.burgerToggle) return;
        if (!this.tabsContainer.classList.contains('active')) return;
        this.tabsContainer.classList.remove('active');
        this.burgerToggle.classList.remove('active');
        this.burgerToggle.setAttribute('aria-expanded', 'false');
    }
}
