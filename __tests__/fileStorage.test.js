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
  it('opens DB with the current schema version and upgrade callback', async () => {
    const { openDB } = await import('idb');
    const { getDB } = await import('../src/services/fileStorage.js');
    await getDB();

    expect(openDB).toHaveBeenCalledWith(
      'LocalReactAIVault',
      2,
      expect.objectContaining({ upgrade: expect.any(Function) })
    );
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

describe('fileStorage - remaining persistence operations', () => {
  it('returns null without touching IndexedDB when no handle is supplied', async () => {
    const { saveFileHandle } = await import('../src/services/fileStorage.js');
    await expect(saveFileHandle(null)).resolves.toBeNull();
    expect(mockDB.put).not.toHaveBeenCalled();
  });

  it('clears the saved handle from IndexedDB', async () => {
    const { clearSavedFileHandle } = await import('../src/services/fileStorage.js');
    await clearSavedFileHandle();
    expect(mockDB.delete).toHaveBeenCalledWith('FileHandles', 'gguf_model_handle');
  });

  it('writes a model to disk and persists the resulting handle', async () => {
    const { saveModelToDisk } = await import('../src/services/fileStorage.js');
    const file = new File(['gguf'], 'downloaded.gguf', { type: 'application/x-gguf' });

    const result = await saveModelToDisk(file, 'saved.gguf');

    expect(window.showSaveFilePicker).toHaveBeenCalledWith(expect.objectContaining({
      suggestedName: 'saved.gguf',
    }));
    expect(result.name).toBe('model.gguf');
    expect(mockDB.put).toHaveBeenCalledWith('FileHandles', expect.any(Object), 'gguf_model_handle');
  });

  it('uses the source file name when no save name is supplied', async () => {
    const { saveModelToDisk } = await import('../src/services/fileStorage.js');
    const file = new File(['gguf'], 'source.gguf');

    await saveModelToDisk(file);

    expect(window.showSaveFilePicker).toHaveBeenCalledWith(expect.objectContaining({
      suggestedName: 'source.gguf',
    }));
  });

  it('returns null when saving the model is cancelled', async () => {
    window.showSaveFilePicker.mockRejectedValueOnce(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
    const { saveModelToDisk } = await import('../src/services/fileStorage.js');

    await expect(saveModelToDisk(new File(['gguf'], 'model.gguf'), 'model.gguf')).resolves.toBeNull();
  });
});
