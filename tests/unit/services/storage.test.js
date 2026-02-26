/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import { storageService } from '../../../js/services/storage.js';

// Мокаем localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('storageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('save stores data', () => {
    const data = { version: 12, tasks: [] };
    storageService.save(data);
    expect(localStorage.setItem).toHaveBeenCalledWith('sprintPlannerData', JSON.stringify(data));
  });

  test('load retrieves data', () => {
    const data = { version: 12, tasks: [] };
    localStorage.getItem.mockReturnValueOnce(JSON.stringify(data));
    expect(storageService.load()).toEqual(data);
  });

  test('load returns null when no data', () => {
    localStorage.getItem.mockReturnValueOnce(null);
    expect(storageService.load()).toBeNull();
  });

  test('load returns null when JSON is invalid', () => {
    localStorage.getItem.mockReturnValueOnce('not-json{{{');
    expect(storageService.load()).toBeNull();
  });

  test('save does not throw when localStorage throws (quota exceeded)', () => {
    localStorage.setItem.mockImplementationOnce(() => { throw new Error('QuotaExceededError'); });
    expect(() => storageService.save({ tasks: [] })).not.toThrow();
  });

  // ── saveFile ──────────────────────────────────────────────────────────────

  describe('saveFile', () => {
    test('creates a download link and clicks it', () => {
      const appendSpy = jest.spyOn(document.body, 'appendChild');
      const removeSpy = jest.spyOn(document.body, 'removeChild');

      // Mock URL.createObjectURL and revokeObjectURL
      global.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();

      storageService.saveFile({ tasks: [] }, 'test.json');

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(appendSpy).toHaveBeenCalled();
      expect(removeSpy).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

      appendSpy.mockRestore();
      removeSpy.mockRestore();
    });

    test('sets correct download filename', () => {
      global.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();

      let capturedAnchor = null;
      const appendSpy = jest.spyOn(document.body, 'appendChild').mockImplementation((el) => {
        capturedAnchor = el;
        // Simulate click without actually navigating
        return el;
      });
      jest.spyOn(document.body, 'removeChild').mockImplementation(() => { });

      storageService.saveFile({ tasks: [] }, 'sprint-data.json');

      expect(capturedAnchor).not.toBeNull();
      expect(capturedAnchor.download).toBe('sprint-data.json');

      appendSpy.mockRestore();
    });
  });

  // ── loadFile ──────────────────────────────────────────────────────────────

  describe('loadFile', () => {
    test('resolves with parsed JSON when file is selected', async () => {
      const mockData = { tasks: [{ id: 1 }] };
      const mockFileContent = JSON.stringify(mockData);

      // Mock FileReader
      const mockReader = {
        onload: null,
        onerror: null,
        readAsText: jest.fn().mockImplementation(function () {
          // Simulate async file read
          setTimeout(() => {
            this.onload({ target: { result: mockFileContent } });
          }, 0);
        })
      };
      global.FileReader = jest.fn().mockImplementation(() => mockReader);

      // Mock input element
      const mockInput = {
        type: '',
        accept: '',
        onchange: null,
        oncancel: null,
        click: jest.fn().mockImplementation(function () {
          // Simulate file selection
          setTimeout(() => {
            this.onchange({ target: { files: [new Blob([mockFileContent])] } });
          }, 0);
        })
      };
      jest.spyOn(document, 'createElement').mockImplementationOnce(() => mockInput);

      const result = await storageService.loadFile();
      expect(result).toEqual(mockData);
    });

    test('rejects when no file is selected', async () => {
      const mockInput = {
        type: '',
        accept: '',
        onchange: null,
        oncancel: null,
        click: jest.fn().mockImplementation(function () {
          setTimeout(() => {
            this.onchange({ target: { files: [] } });
          }, 0);
        })
      };
      jest.spyOn(document, 'createElement').mockImplementationOnce(() => mockInput);

      await expect(storageService.loadFile()).rejects.toThrow('Файл не выбран');
    });

    test('rejects when file content is invalid JSON', async () => {
      const mockReader = {
        onload: null,
        onerror: null,
        readAsText: jest.fn().mockImplementation(function () {
          setTimeout(() => {
            this.onload({ target: { result: 'not-valid-json{{{' } });
          }, 0);
        })
      };
      global.FileReader = jest.fn().mockImplementation(() => mockReader);

      const mockInput = {
        type: '',
        accept: '',
        onchange: null,
        oncancel: null,
        click: jest.fn().mockImplementation(function () {
          setTimeout(() => {
            this.onchange({ target: { files: [new Blob(['invalid'])] } });
          }, 0);
        })
      };
      jest.spyOn(document, 'createElement').mockImplementationOnce(() => mockInput);

      await expect(storageService.loadFile()).rejects.toThrow('Ошибка чтения файла');
    });

    test('rejects when FileReader fires onerror', async () => {
      const mockReader = {
        onload: null,
        onerror: null,
        readAsText: jest.fn().mockImplementation(function () {
          setTimeout(() => {
            this.onerror();
          }, 0);
        })
      };
      global.FileReader = jest.fn().mockImplementation(() => mockReader);

      const mockInput = {
        type: '',
        accept: '',
        onchange: null,
        oncancel: null,
        click: jest.fn().mockImplementation(function () {
          setTimeout(() => {
            this.onchange({ target: { files: [new Blob(['data'])] } });
          }, 0);
        })
      };
      jest.spyOn(document, 'createElement').mockImplementationOnce(() => mockInput);

      await expect(storageService.loadFile()).rejects.toThrow('Ошибка чтения файла');
    });

    test('rejects when user cancels file selection', async () => {
      const mockInput = {
        type: '',
        accept: '',
        onchange: null,
        oncancel: null,
        click: jest.fn().mockImplementation(function () {
          setTimeout(() => {
            this.oncancel();
          }, 0);
        })
      };
      jest.spyOn(document, 'createElement').mockImplementationOnce(() => mockInput);

      await expect(storageService.loadFile()).rejects.toThrow('Выбор файла отменён');
    });
  });
});
