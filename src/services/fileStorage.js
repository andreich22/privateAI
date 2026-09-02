import { openDB } from 'idb';

const DB_NAME = 'LocalReactAIVault';
const STORE_NAME = 'FileHandles';
const KEY_NAME = 'gguf_model_handle';

export async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    },
  });
}

export async function selectAndSaveFile() {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{
        description: 'GGUF Model Files',
        accept: { 'application/x-gguf': ['.gguf'] }
      }],
      excludeAcceptAllOption: true,
      multiple: false
    });
    
    const db = await getDB();
    await db.put(STORE_NAME, handle, KEY_NAME);
    return handle;
  } catch (e) {
    console.error('Выбор файла отменен:', e);
    return null;
  }
}

export async function getSavedFileHandle() {
  const db = await getDB();
  return (await db.get(STORE_NAME, KEY_NAME)) || null;
}

export async function verifyPermission(fileHandle) {
  const opts = { mode: 'read' };
  if ((await fileHandle.queryPermission(opts)) === 'granted') return true;
  if ((await fileHandle.requestPermission(opts)) === 'granted') return true;
  return false;
}

export async function saveModelToDisk(file, saveName) {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: saveName || file.name,
      types: [{
        description: 'GGUF Model Files',
        accept: { 'application/x-gguf': ['.gguf'] }
      }],
      excludeAcceptAllOption: true,
    });

    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();

    const db = await getDB();
    await db.put(STORE_NAME, handle, KEY_NAME);

    return handle;
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error('Ошибка сохранения:', e);
    }
    return null;
  }
}

export async function getFileBlob(fileHandle) {
  const file = await fileHandle.getFile();
  return await file.arrayBuffer();
}

export async function saveFilePicker(suggestedName) {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: suggestedName || 'model.gguf',
      types: [{
        description: 'GGUF Model Files',
        accept: { 'application/x-gguf': ['.gguf'] }
      }],
      excludeAcceptAllOption: true,
    });
    return handle;
  } catch (e) {
    console.error('Выбор места сохранения отменен:', e);
    return null;
  }
}
