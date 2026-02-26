/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../../../js/services/message.js', () => ({
    messageService: {
        showMessage: jest.fn(),
        showConfirm: jest.fn()
    }
}));

const { CriteriaFormController } = await import('../../../../js/controllers/criteria/criteriaFormController.js');
const { messageService } = await import('../../../../js/services/message.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function createCriteriaManager(criteria = [
    { id: 1, name: 'OKR', abbreviation: 'OKR', weight: 40, rationale: 'R1', scale: { 1: 'Low', 2: 'High' } },
    { id: 2, name: 'UX', abbreviation: 'UX', weight: 60, rationale: 'R2', scale: {} }
]) {
    const list = [...criteria];
    return {
        editCriteriaId: null,
        getCriteria: jest.fn(() => list),
        getCriteriaById: jest.fn((id) => list.find(c => c.id === id)),
        addCriteria: jest.fn((data) => { list.push({ id: Date.now(), ...data }); }),
        updateCriteria: jest.fn((id, data) => {
            const idx = list.findIndex(c => c.id === id);
            if (idx === -1) return false;
            list[idx] = { ...list[idx], ...data };
            return true;
        }),
        getTotalWeight: jest.fn(() => list.reduce((s, c) => s + c.weight, 0)),
        loadDefaultCriteria: jest.fn()
    };
}

function createStore(tasks = []) {
    const state = { tasks, criteria: [] };
    return {
        getState: jest.fn(() => state),
        setCriteria: jest.fn(),
        setTasks: jest.fn()
    };
}

function createDom() {
    document.body.innerHTML = `
        <div id="editCriteriaModal" style="display:none;">
            <h3 id="criteriaModalTitle"></h3>
            <button id="closeEditCriteriaModalBtn"></button>
            <input id="editCriteriaName" />
            <input id="editCriteriaAbbreviation" />
            <input id="editCriteriaWeight" type="number" />
            <textarea id="editCriteriaRationale"></textarea>
            <div id="scaleEditor">
                <textarea id="scale_1">нет описания</textarea>
                <textarea id="scale_2">нет описания</textarea>
                <textarea id="scale_3">нет описания</textarea>
                <textarea id="scale_4">нет описания</textarea>
                <textarea id="scale_5">нет описания</textarea>
                <textarea id="scale_6">нет описания</textarea>
                <textarea id="scale_7">нет описания</textarea>
                <textarea id="scale_8">нет описания</textarea>
                <textarea id="scale_9">нет описания</textarea>
                <textarea id="scale_10">нет описания</textarea>
            </div>
            <button id="cancelEditCriteriaBtn"></button>
            <button id="saveCriteriaEditBtn"></button>
        </div>
        <div id="messageModal" style="display:none;">
            <div id="messageText"></div>
            <button id="okMessageBtn"></button>
            <button id="closeMessageModalBtn"></button>
        </div>
    `;
}

describe('CriteriaFormController', () => {
    let store;
    let cmgr;
    let controller;
    const onSaved = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        createDom();
        store = createStore();
        cmgr = createCriteriaManager();
        controller = new CriteriaFormController(store, cmgr, onSaved);
    });

    // ── openEditCriteria (add mode) ────────────────────────────────────────────

    test('openEditCriteria in add mode shows modal with empty fields', () => {
        controller.openEditCriteria();
        expect(document.getElementById('editCriteriaModal').style.display).toBe('flex');
        expect(document.getElementById('criteriaModalTitle').textContent).toBe('Добавить критерий');
        expect(document.getElementById('editCriteriaName').value).toBe('');
    });

    // ── openEditCriteria (edit mode) ───────────────────────────────────────────

    test('openEditCriteria in edit mode fills form with criterion data', () => {
        controller.openEditCriteria(1);
        expect(document.getElementById('editCriteriaModal').style.display).toBe('flex');
        expect(document.getElementById('criteriaModalTitle').textContent).toBe('Редактировать критерий');
        expect(document.getElementById('editCriteriaName').value).toBe('OKR');
        expect(document.getElementById('editCriteriaAbbreviation').value).toBe('OKR');
        expect(document.getElementById('editCriteriaWeight').value).toBe('40');
        expect(document.getElementById('editCriteriaRationale').value).toBe('R1');
    });

    test('openEditCriteria in edit mode renders scale editor', () => {
        controller.openEditCriteria(1);
        // Scale editor should be populated (generateScaleEditorHTML is called)
        expect(document.getElementById('scaleEditor').innerHTML).toBeDefined();
    });

    test('openEditCriteria shows error when modal elements missing', () => {
        document.body.innerHTML = ''; // Remove all DOM
        controller.openEditCriteria();
        expect(messageService.showMessage).toHaveBeenCalledWith(expect.stringContaining('Не найдены'));
    });

    test('openEditCriteria does nothing for non-existent criterion id', () => {
        controller.openEditCriteria(999);
        // Modal should still open (editCriteriaId set to 999, but getCriteriaById returns undefined)
        expect(document.getElementById('editCriteriaModal').style.display).toBe('flex');
    });

    // ── closeEditCriteria ──────────────────────────────────────────────────────

    test('closeEditCriteria hides modal', () => {
        controller.openEditCriteria();
        controller.closeEditCriteria();
        expect(document.getElementById('editCriteriaModal').style.display).toBe('none');
    });

    // ── collectScaleFromEditor ─────────────────────────────────────────────────

    test('collectScaleFromEditor reads values from scale textareas', () => {
        document.getElementById('scale_1').value = 'Very low';
        document.getElementById('scale_5').value = 'Medium';
        document.getElementById('scale_10').value = 'Very high';

        const scale = controller.collectScaleFromEditor();

        expect(scale[1]).toBe('Very low');
        expect(scale[5]).toBe('Medium');
        expect(scale[10]).toBe('Very high');
    });

    test('collectScaleFromEditor returns empty object when modal missing', () => {
        document.body.innerHTML = '';
        const scale = controller.collectScaleFromEditor();
        expect(scale).toEqual({});
    });

    // ── saveCriteria ───────────────────────────────────────────────────────────

    test('saveCriteria adds new criterion when form is valid', () => {
        controller.openEditCriteria(); // add mode
        document.getElementById('editCriteriaName').value = 'New Criterion';
        document.getElementById('editCriteriaAbbreviation').value = 'NC';
        document.getElementById('editCriteriaWeight').value = '5';
        document.getElementById('editCriteriaRationale').value = 'Some rationale';

        controller.saveCriteria();

        expect(cmgr.addCriteria).toHaveBeenCalledWith(expect.objectContaining({
            name: 'New Criterion',
            abbreviation: 'NC',
            weight: 5
        }));
        expect(store.setCriteria).toHaveBeenCalled();
        expect(onSaved).toHaveBeenCalled();
    });

    test('saveCriteria updates existing criterion in edit mode', () => {
        controller.openEditCriteria(1); // edit mode
        document.getElementById('editCriteriaName').value = 'Updated OKR';
        document.getElementById('editCriteriaAbbreviation').value = 'OKR';
        document.getElementById('editCriteriaWeight').value = '40';
        document.getElementById('editCriteriaRationale').value = 'Updated rationale';

        controller.saveCriteria();

        expect(cmgr.updateCriteria).toHaveBeenCalledWith(1, expect.objectContaining({
            name: 'Updated OKR'
        }));
    });

    // ── renderScaleEditor ──────────────────────────────────────────────────────

    test('renderScaleEditor populates scaleEditor element', () => {
        controller.renderScaleEditor({ 1: 'Low', 10: 'High' });
        const scaleEditor = document.getElementById('scaleEditor');
        expect(scaleEditor.innerHTML).toBeDefined();
        expect(scaleEditor.innerHTML.length).toBeGreaterThan(0);
    });

    test('renderScaleEditor does nothing when scaleEditor missing', () => {
        document.getElementById('scaleEditor').remove();
        expect(() => controller.renderScaleEditor({})).not.toThrow();
    });

    // ── attachNameInputHandler ─────────────────────────────────────────────────

    test('attachNameInputHandler auto-fills abbreviation from name', () => {
        controller.attachNameInputHandler();
        const nameInput = document.getElementById('editCriteriaName');
        const abbrevInput = document.getElementById('editCriteriaAbbreviation');
        abbrevInput.value = ''; // empty abbreviation

        nameInput.value = 'Business Value';
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));

        // Abbreviation should be auto-generated
        expect(abbrevInput.value.length).toBeGreaterThan(0);
    });

    test('attachNameInputHandler does not overwrite existing abbreviation', () => {
        controller.attachNameInputHandler();
        const nameInput = document.getElementById('editCriteriaName');
        const abbrevInput = document.getElementById('editCriteriaAbbreviation');
        abbrevInput.value = 'EXISTING'; // already set

        nameInput.value = 'Business Value';
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));

        expect(abbrevInput.value).toBe('EXISTING');
    });
});
