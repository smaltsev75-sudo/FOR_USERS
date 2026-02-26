import { jest } from '@jest/globals';
import { TabController } from '../../../js/controllers/tabController.js';

describe('tabController', () => {
    let controller;
    let mockStore;

    beforeEach(() => {
        jest.clearAllMocks();

        mockStore = {
            getState: jest.fn(() => ({ activeTab: 'planning' })),
            setActiveTab: jest.fn()
        };

        document.body.innerHTML = `
            <button class="tab-btn" data-tab="planning">Planning</button>
            <button class="tab-btn" data-tab="criteria">Criteria</button>
            <div class="tab-content" id="planningTabContent" style="display:none"></div>
            <div class="tab-content" id="criteriaTabContent" style="display:none"></div>
        `;

        controller = new TabController(mockStore);
    });

    test('constructor finds tab buttons and contents', () => {
        expect(controller.tabButtons.length).toBe(2);
        expect(controller.tabContents.length).toBe(2);
    });

    test('init activates saved tab from store', () => {
        controller.init();
        expect(mockStore.setActiveTab).toHaveBeenCalledWith('planning');
        expect(document.getElementById('planningTabContent').style.display).toBe('block');
    });

    test('init defaults to planning when activeTab is empty', () => {
        mockStore.getState.mockReturnValue({ activeTab: '' });
        controller.init();
        expect(mockStore.setActiveTab).toHaveBeenCalledWith('planning');
    });

    test('init activates criteria tab when saved', () => {
        mockStore.getState.mockReturnValue({ activeTab: 'criteria' });
        controller.init();
        expect(mockStore.setActiveTab).toHaveBeenCalledWith('criteria');
        expect(document.getElementById('criteriaTabContent').style.display).toBe('block');
    });

    test('activateTab hides all content, shows target', () => {
        controller.init();
        controller.activateTab('criteria');

        expect(document.getElementById('planningTabContent').style.display).toBe('none');
        expect(document.getElementById('criteriaTabContent').style.display).toBe('block');
    });

    test('activateTab sets active class on correct button', () => {
        controller.init();
        controller.activateTab('criteria');

        const planningBtn = document.querySelector('[data-tab="planning"]');
        const criteriaBtn = document.querySelector('[data-tab="criteria"]');
        expect(planningBtn.classList.contains('active')).toBe(false);
        expect(criteriaBtn.classList.contains('active')).toBe(true);
    });

    test('activateTab handles nonexistent tab gracefully', () => {
        controller.init();
        // Nonexistent tab — activeContent will be null
        expect(() => controller.activateTab('nonexistent')).not.toThrow();
        // All content should be hidden
        const contents = document.querySelectorAll('.tab-content');
        contents.forEach(c => expect(c.style.display).toBe('none'));
    });

    test('tab button click activates the tab', () => {
        controller.init();
        const criteriaBtn = document.querySelector('[data-tab="criteria"]');
        criteriaBtn.click();

        expect(mockStore.setActiveTab).toHaveBeenCalledWith('criteria');
        expect(document.getElementById('criteriaTabContent').style.display).toBe('block');
    });
});