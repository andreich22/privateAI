import { openDB } from 'idb';
import {
  CHAT_DB,
  isConversationRecord,
  isMessageRecord,
  logStorageError,
} from './storage.js';

const { conversations: CONVERSATIONS, messages: MESSAGES, meta: META } = CHAT_DB.stores;
let dbPromise;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(CHAT_DB.name, CHAT_DB.version, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(CONVERSATIONS)) {
          const store = db.createObjectStore(CONVERSATIONS, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains(MESSAGES)) {
          const store = db.createObjectStore(MESSAGES, { keyPath: 'id' });
          store.createIndex('conversationId', 'conversationId');
          store.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'key' });
      },
    }).catch((error) => {
      dbPromise = undefined;
      logStorageError('open chat database', error);
      return null;
    });
  }
  return dbPromise;
}

const id = () => crypto.randomUUID();

export async function listConversations() {
  try {
    const db = await getDB();
    if (!db) return [];
    const records = await db.getAllFromIndex(CONVERSATIONS, 'updatedAt');
    return records.filter(isConversationRecord).reverse();
  } catch (error) {
    logStorageError('list conversations', error);
    return [];
  }
}

export async function getConversation(conversationId) {
  try {
    const db = await getDB();
    if (!db) return null;
    const conversation = await db.get(CONVERSATIONS, conversationId);
    if (!isConversationRecord(conversation)) return null;
    const messages = (await db.getAllFromIndex(MESSAGES, 'conversationId', conversationId))
      .filter(isMessageRecord)
      .sort((a, b) => a.createdAt - b.createdAt);
    return { ...conversation, messages };
  } catch (error) {
    logStorageError('get conversation', error);
    return null;
  }
}

export async function createConversation(title = 'Новый чат') {
  const now = Date.now();
  const conversation = { id: id(), title, systemPrompt: '', createdAt: now, updatedAt: now };
  try {
    const db = await getDB();
    if (!db) return { ...conversation, messages: [] };
    await db.put(CONVERSATIONS, conversation);
    await db.put(META, { key: 'activeConversationId', value: conversation.id });
  } catch (error) {
    logStorageError('create conversation', error);
  }
  return { ...conversation, messages: [] };
}

export async function saveConversation(conversation) {
  if (!conversation?.id) return false;
  try {
    const db = await getDB();
    if (!db) return false;
    const now = Date.now();
    await db.put(CONVERSATIONS, {
      id: conversation.id,
      title: typeof conversation.title === 'string' ? conversation.title : 'Новый чат',
      systemPrompt: conversation.systemPrompt || '',
      createdAt: Number.isFinite(conversation.createdAt) ? conversation.createdAt : now,
      updatedAt: now,
    });
    const tx = db.transaction(MESSAGES, 'readwrite');
    const existing = await tx.store.index('conversationId').getAll(conversation.id);
    const keep = new Set((conversation.messages || []).map((message) => message.id).filter(Boolean));
    for (const message of existing) if (!keep.has(message.id)) await tx.store.delete(message.id);
    for (const message of conversation.messages || []) {
      if (!message || typeof message.role !== 'string' || typeof message.content !== 'string') continue;
      await tx.store.put({
        ...message,
        conversationId: conversation.id,
        id: message.id || id(),
        createdAt: Number.isFinite(message.createdAt) ? message.createdAt : now,
      });
    }
    await tx.done;
    await db.put(META, { key: 'activeConversationId', value: conversation.id });
    return true;
  } catch (error) {
    logStorageError('save conversation', error);
    return false;
  }
}

export async function renameConversation(conversationId, title) {
  try {
    const db = await getDB();
    if (!db) return null;
    const conversation = await db.get(CONVERSATIONS, conversationId);
    if (!isConversationRecord(conversation)) return null;
    conversation.title = String(title || '').trim() || 'Новый чат';
    conversation.updatedAt = Date.now();
    await db.put(CONVERSATIONS, conversation);
    return conversation;
  } catch (error) {
    logStorageError('rename conversation', error);
    return null;
  }
}

export async function deleteConversation(conversationId) {
  try {
    const db = await getDB();
    if (!db) return null;
    const tx = db.transaction([CONVERSATIONS, MESSAGES], 'readwrite');
    const messages = await tx.objectStore(MESSAGES).index('conversationId').getAll(conversationId);
    for (const message of messages) await tx.objectStore(MESSAGES).delete(message.id);
    await tx.objectStore(CONVERSATIONS).delete(conversationId);
    await tx.done;
    const conversations = await listConversations();
    await db.put(META, { key: 'activeConversationId', value: conversations[0]?.id || null });
    return conversations[0] || null;
  } catch (error) {
    logStorageError('delete conversation', error);
    return null;
  }
}

export async function getActiveConversationId() {
  try {
    const db = await getDB();
    if (!db) return null;
    return (await db.get(META, 'activeConversationId'))?.value || null;
  } catch (error) {
    logStorageError('get active conversation', error);
    return null;
  }
}
