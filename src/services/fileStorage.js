import { openDB } from 'idb';

const DB_NAME = 'LocalReactAIVault';
const STORE_NAME = 'FileHandles';
const KEY_NAME = 'gguf_model_handle';

export async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
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
    if (error?.name !== 'AbortError') console.error('Ошибка выбора файла:', error);
    return null;
  }
}

export async function saveFileHandle(handle) {
  if (!handle) return null;
  const db = await getDB();
  await db.put(STORE_NAME, handle, KEY_NAME);
  return handle;
}

export async function getSavedFileHandle() {
  const db = await getDB();
  return (await db.get(STORE_NAME, KEY_NAME)) || null;
}

export async function clearSavedFileHandle() {
  const db = await getDB();
  await db.delete(STORE_NAME, KEY_NAME);
}

export async function verifyPermission(fileHandle) {
  if (!fileHandle) return false;
  const opts = { mode: 'read' };
  if ((await fileHandle.queryPermission(opts)) === 'granted') return true;
  return (await fileHandle.requestPermission(opts)) === 'granted';
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
    if (error?.name !== 'AbortError') console.error('Ошибка сохранения:', error);
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
    if (error?.name !== 'AbortError') console.error('Ошибка выбора места сохранения:', error);
    return null;
  }
}
