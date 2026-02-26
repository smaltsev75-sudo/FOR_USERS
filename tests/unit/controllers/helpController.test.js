/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import { HelpController } from '../../../js/controllers/helpController.js';

function createDom() {
    document.body.innerHTML = `
        <button id="helpBtn"></button>
        <div id="helpModal" style="display:none;">
            <button id="closeHelpModalBtn"></button>
            <button id="closeHelpBtn"></button>
            <div id="helpContent"></div>
        </div>
    `;
}

describe('helpController', () => {
    beforeEach(() => {
        createDom();
    });

    test('создание экземпляра', () => {
        const controller = new HelpController();
        expect(controller).toBeDefined();
    });

    test('init attaches click handlers', () => {
        const controller = new HelpController();
        controller.init();
        // Verify no errors thrown
        expect(controller.btn).not.toBeNull();
        expect(controller.closeBtn).not.toBeNull();
    });

    test('close() hides the modal', () => {
        const controller = new HelpController();
        controller.init();
        // Manually show modal
        controller.modal.style.display = 'flex';
        controller.close();
        expect(controller.modal.style.display).toBe('none');
    });

    test('clicking closeHelpBtn closes modal', () => {
        const controller = new HelpController();
        controller.init();
        controller.modal.style.display = 'flex';
        document.getElementById('closeHelpBtn').click();
        expect(controller.modal.style.display).toBe('none');
    });

    test('clicking closeHelpModalBtn closes modal', () => {
        const controller = new HelpController();
        controller.init();
        controller.modal.style.display = 'flex';
        document.getElementById('closeHelpModalBtn').click();
        expect(controller.modal.style.display).toBe('none');
    });

    test('clicking backdrop (modal itself) closes modal', () => {
        const controller = new HelpController();
        controller.init();
        controller.modal.style.display = 'flex';
        // Simulate click on the modal overlay itself
        const event = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(event, 'target', { value: controller.modal });
        controller.modal.dispatchEvent(event);
        expect(controller.modal.style.display).toBe('none');
    });

    test('open() shows modal and sets loading content', async () => {
        // Mock fetch to fail (no server in tests)
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

        // Provide a mock marked to avoid script loading
        const mockMarked = { parse: jest.fn().mockReturnValue('<p>content</p>') };
        const mockDOMPurify = { sanitize: jest.fn((html) => html) };
        const controller = new HelpController({ marked: mockMarked, DOMPurify: mockDOMPurify });
        controller.init();

        // open() is async — it shows modal immediately then tries to load
        const openPromise = controller.open();
        // Modal should be visible immediately
        expect(controller.modal.style.display).toBe('flex');
        expect(controller.content.innerHTML).toContain('Загрузка');

        // Wait for the async operation to complete (will fail gracefully due to fetch error)
        await openPromise;
        // After failure, content should show error message
        expect(controller.content.innerHTML).toContain('Не удалось загрузить');
    }, 10000);

    test('open() does nothing when modal is missing', async () => {
        document.body.innerHTML = ''; // Remove all DOM
        const controller = new HelpController();
        // Should not throw
        await expect(controller.open()).resolves.toBeUndefined();
    });

    test('open() renders markdown content when fetch succeeds', async () => {
        const markdownContent = '# User Manual\n\nThis is the manual.';
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            text: jest.fn().mockResolvedValue(markdownContent)
        });

        const mockMarked = {
            parse: jest.fn().mockReturnValue('<h1>User Manual</h1><p>This is the manual.</p>')
        };
        const mockDOMPurify = { sanitize: jest.fn((html) => html) };
        const controller = new HelpController({ marked: mockMarked, DOMPurify: mockDOMPurify });
        controller.init();

        await controller.open();

        expect(controller.content.innerHTML).toContain('User Manual');
        expect(mockMarked.parse).toHaveBeenCalledWith(markdownContent);
    }, 10000);

    test('setupTocLinks attaches click handlers to anchor links', () => {
        // Mock scrollIntoView (not implemented in jsdom)
        Element.prototype.scrollIntoView = jest.fn();

        const controller = new HelpController();
        controller.init();
        controller.modal.style.display = 'flex';

        // Add a TOC link to content
        controller.content.innerHTML = '<a href="#section-1">Section 1</a><h2 id="section-1">Section 1</h2>';
        controller.setupTocLinks();

        const link = controller.content.querySelector('a[href="#section-1"]');
        expect(link).not.toBeNull();
        // Click should not throw
        expect(() => link.click()).not.toThrow();
    });
});
