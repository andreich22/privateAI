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
