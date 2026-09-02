import { describe, it, expect, vi } from 'vitest';

const mockDB = {
  put: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(undefined),
  close: vi.fn(),
};

vi.mock('idb', () => ({
  openDB: vi.fn().mockResolvedValue(mockDB),
}));

describe('fileStorage - getDB', () => {
  it('opens DB with correct name and version', async () => {
    const { openDB } = await import('idb');
    const { getDB } = await import('../src/services/fileStorage.js');
    await getDB();

    expect(openDB).toHaveBeenCalledWith(
      'LocalReactAIVault',
      1,
      expect.objectContaining({ upgrade: expect.any(Function) })
    );
  });

  it('creates object store FileHandles on upgrade', async () => {
    const { openDB } = await import('idb');
    const { getDB } = await import('../src/services/fileStorage.js');

    await getDB();

    const callArgs = openDB.mock.calls[0];
    expect(callArgs[0]).toBe('LocalReactAIVault');
    expect(callArgs[1]).toBe(1);
    expect(typeof callArgs[2].upgrade).toBe('function');
  });
});

describe('fileStorage - getSavedFileHandle', () => {
  beforeEach(() => {
    mockDB.get.mockResolvedValue(null);
  });

  it('returns null when no handle is saved', async () => {
    const { getSavedFileHandle } = await import('../src/services/fileStorage.js');

    const result = await getSavedFileHandle();

    expect(result).toBeNull();
  });

  it('returns saved handle when one exists', async () => {
    const { getSavedFileHandle } = await import('../src/services/fileStorage.js');

    const savedHandle = { name: 'saved-model.gguf', isFile: true };
    mockDB.get.mockResolvedValue(savedHandle);

    const result = await getSavedFileHandle();

    expect(result).toBe(savedHandle);
  });
});

describe('fileStorage - verifyPermission', () => {
  it('returns true when queryPermission returns granted', async () => {
    const mockHandle = {
      queryPermission: vi.fn().mockResolvedValue('granted'),
      requestPermission: vi.fn(),
    };
    const { verifyPermission } = await import('../src/services/fileStorage.js');

    const result = await verifyPermission(mockHandle);

    expect(result).toBe(true);
    expect(mockHandle.queryPermission).toHaveBeenCalledWith({ mode: 'read' });
    expect(mockHandle.requestPermission).not.toHaveBeenCalled();
  });

  it('returns true when queryPermission denied but requestPermission granted', async () => {
    const mockHandle = {
      queryPermission: vi.fn().mockResolvedValue('denied'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
    };
    const { verifyPermission } = await import('../src/services/fileStorage.js');

    const result = await verifyPermission(mockHandle);

    expect(result).toBe(true);
    expect(mockHandle.queryPermission).toHaveBeenCalledWith({ mode: 'read' });
    expect(mockHandle.requestPermission).toHaveBeenCalledWith({ mode: 'read' });
  });

  it('returns false when both permissions denied', async () => {
    const mockHandle = {
      queryPermission: vi.fn().mockResolvedValue('denied'),
      requestPermission: vi.fn().mockResolvedValue('denied'),
    };
    const { verifyPermission } = await import('../src/services/fileStorage.js');

    const result = await verifyPermission(mockHandle);

    expect(result).toBe(false);
  });
});

describe('fileStorage - selectAndSaveFile', () => {
  beforeEach(() => {
    mockDB.put.mockClear();
  });

  it('shows file picker and saves handle to DB', async () => {
    const { selectAndSaveFile } = await import('../src/services/fileStorage.js');

    const result = await selectAndSaveFile();

    expect(window.showOpenFilePicker).toHaveBeenCalledWith({
      types: [{
        description: 'GGUF Model Files',
        accept: { 'application/x-gguf': ['.gguf'] }
      }],
      excludeAcceptAllOption: true,
      multiple: false
    });

    expect(result.name).toBe('model.gguf');
    expect(mockDB.put).toHaveBeenCalledWith('FileHandles', expect.any(Object), 'gguf_model_handle');
  });

  it('returns null when file picker is cancelled', async () => {
    window.showOpenFilePicker.mockRejectedValue(new Error('Cancelled'));

    const { selectAndSaveFile } = await import('../src/services/fileStorage.js');

    const result = await selectAndSaveFile();

    expect(result).toBeNull();
  });
});

describe('fileStorage - saveFilePicker', () => {
  it('shows save file picker with suggested name', async () => {
    const { saveFilePicker } = await import('../src/services/fileStorage.js');

    await saveFilePicker('Qwen3.8-2B-Q4_K_M.gguf');

    expect(window.showSaveFilePicker).toHaveBeenCalledWith({
      suggestedName: 'Qwen3.8-2B-Q4_K_M.gguf',
      types: [{
        description: 'GGUF Model Files',
        accept: { 'application/x-gguf': ['.gguf'] }
      }],
      excludeAcceptAllOption: true,
    });
  });

  it('uses default name when none provided', async () => {
    const { saveFilePicker } = await import('../src/services/fileStorage.js');

    await saveFilePicker();

    expect(window.showSaveFilePicker).toHaveBeenCalledWith({
      suggestedName: 'model.gguf',
      types: [{
        description: 'GGUF Model Files',
        accept: { 'application/x-gguf': ['.gguf'] }
      }],
      excludeAcceptAllOption: true,
    });
  });

  it('returns the file handle', async () => {
    const { saveFilePicker } = await import('../src/services/fileStorage.js');

    const result = await saveFilePicker('test.gguf');

    expect(result).toBeDefined();
    expect(result.name).toBe('model.gguf');
  });

  it('returns null when save picker is cancelled', async () => {
    const savePickerMock = window.showSaveFilePicker;
    savePickerMock.mockRejectedValueOnce(new Error('Cancelled'));

    const { saveFilePicker } = await import('../src/services/fileStorage.js');

    const result = await saveFilePicker();

    expect(result).toBeNull();
  });
});
