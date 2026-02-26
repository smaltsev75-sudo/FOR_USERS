import { jest } from '@jest/globals';

const renderHeader = jest.fn();
const renderRoleList = jest.fn();
const renderTeamTotal = jest.fn();
const renderMatrix = jest.fn();
const renderTaskList = jest.fn();
const renderCriteriaList = jest.fn();
const updateCreateFormTotal = jest.fn();
const updateTabTitle = jest.fn();
const getNFS = jest.fn((nfs) => nfs || { fallback: true });

jest.unstable_mockModule('../../../js/ui/header.js', () => ({ renderHeader }));
jest.unstable_mockModule('../../../js/ui/roleList.js', () => ({ renderRoleList, renderTeamTotal }));
jest.unstable_mockModule('../../../js/ui/matrix.js', () => ({ renderMatrix }));
jest.unstable_mockModule('../../../js/ui/taskList.js', () => ({ renderTaskList }));
jest.unstable_mockModule('../../../js/ui/criteriaList.js', () => ({ renderCriteriaList }));
jest.unstable_mockModule('../../../js/ui/createForm.js', () => ({ updateCreateFormTotal }));
jest.unstable_mockModule('../../../js/ui/utils.js', () => ({ getNFS, updateTabTitle }));

const { renderApp } = await import('../../../js/ui/index.js');

describe('ui/index', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renderApp orchestrates all UI renderers', () => {
        const state = { tasks: [], roles: [], criteria: [] };
        const nfs = { custom: true };
        const taskController = { id: 'tc' };

        renderApp(state, { nfs, taskController });

        expect(getNFS).toHaveBeenCalledWith(nfs);
        expect(renderHeader).toHaveBeenCalledWith(state);
        expect(renderRoleList).toHaveBeenCalledWith(state, nfs);
        expect(renderTeamTotal).toHaveBeenCalledWith(state, nfs);
        expect(renderMatrix).toHaveBeenCalledWith(state, nfs);
        expect(renderTaskList).toHaveBeenCalledWith(state, nfs, taskController);
        expect(renderCriteriaList).toHaveBeenCalledWith(state, nfs);
        expect(updateTabTitle).toHaveBeenCalledWith(state);
        expect(updateCreateFormTotal).toHaveBeenCalledWith(nfs);
    });
});
