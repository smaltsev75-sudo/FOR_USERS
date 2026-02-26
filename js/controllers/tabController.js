// js/controllers/tabController.js
export class TabController {
    constructor(store) {
        this.store = store;
        this.tabButtons = document.querySelectorAll('.tab-btn');
        this.tabContents = document.querySelectorAll('.tab-content');
    }

    init() {
        const savedTab = this.store.getState().activeTab || 'planning';
        this.activateTab(savedTab);
        const self = this;
        this.tabButtons.forEach(function (button) {
            button.addEventListener('click', function () {
                self.activateTab(button.dataset.tab);
            });
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
            this.tabButtons[j].classList.remove('active');
        }
        const activeButton = document.querySelector('.tab-btn[data-tab="' + tabId + '"]');
        if (activeButton) {
            activeButton.classList.add('active');
        }

        this.store.setActiveTab(tabId);
    }
}
