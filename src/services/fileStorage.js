import { openDB } from 'idb';
import { FILE_DB, logStorageError } from './storage.js';

let dbPromise;

export async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(FILE_DB.name, FILE_DB.version, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(FILE_DB.store)) db.createObjectStore(FILE_DB.store);
      },
    }).catch((error) => {
      dbPromise = undefined;
      logStorageError('open file database', error);
      return null;
    });
  }
  return dbPromise;
}

export async function selectAndSaveFile() {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{
        description: 'GGUF Model Files',
        accept: { 'application/x-gguf': ['.gguf'] },
      }],
      excludeAcceptAllOption: true,
      multiple: false,
    });
    await saveFileHandle(handle);
    return handle;
  } catch (error) {
    if (error?.name !== 'AbortError') logStorageError('select file', error);
    return null;
  }
}

export async function saveFileHandle(handle) {
  if (!handle) return null;
  try {
    const db = await getDB();
    if (!db) return null;
    await db.put(FILE_DB.store, handle, FILE_DB.key);
    return handle;
  } catch (error) {
    logStorageError('save file handle', error);
    return null;
  }
}

export async function getSavedFileHandle() {
  try {
    const db = await getDB();
    if (!db) return null;
    return (await db.get(FILE_DB.store, FILE_DB.key)) || null;
  } catch (error) {
    logStorageError('get saved file handle', error);
    return null;
  }
}

export async function clearSavedFileHandle() {
  try {
    const db = await getDB();
    if (db) await db.delete(FILE_DB.store, FILE_DB.key);
  } catch (error) {
    logStorageError('clear file handle', error);
  }
}

export async function verifyPermission(fileHandle) {
  if (!fileHandle) return false;
  try {
    const opts = { mode: 'read' };
    if ((await fileHandle.queryPermission(opts)) === 'granted') return true;
    return (await fileHandle.requestPermission(opts)) === 'granted';
  } catch (error) {
    logStorageError('verify file permission', error);
    return false;
  }
}

export async function saveModelToDisk(file, saveName) {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: saveName || file.name,
      types: [{
        description: 'GGUF Model Files',
        accept: { 'application/x-gguf': ['.gguf'] },
      }],
      excludeAcceptAllOption: true,
    });
    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
    await saveFileHandle(handle);
    return handle;
  } catch (error) {
    if (error?.name !== 'AbortError') logStorageError('save model to disk', error);
    return null;
  }
}

export async function saveFilePicker(suggestedName) {
  try {
    return await window.showSaveFilePicker({
      suggestedName: suggestedName || 'model.gguf',
      types: [{
        description: 'GGUF Model Files',
        accept: { 'application/x-gguf': ['.gguf'] },
      }],
      excludeAcceptAllOption: true,
    });
  } catch (error) {
    if (error?.name !== 'AbortError') logStorageError('save file picker', error);
    return null;
  }
}
