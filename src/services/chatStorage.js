import { openDB } from 'idb';

const DB_NAME = 'private-ai';
const DB_VERSION = 2;
const CONVERSATIONS = 'conversations';
const MESSAGES = 'messages';
const META = 'meta';

let dbPromise;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
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
    });
  }
  return dbPromise;
}

const id = () => crypto.randomUUID();

export async function listConversations() {
  const db = await getDB();
  return (await db.getAllFromIndex(CONVERSATIONS, 'updatedAt')).reverse();
}

export async function getConversation(id) {
  const db = await getDB();
  const conversation = await db.get(CONVERSATIONS, id);
  if (!conversation) return null;
  const messages = await db.getAllFromIndex(MESSAGES, 'conversationId', id);
  messages.sort((a, b) => a.createdAt - b.createdAt);
  return { ...conversation, messages };
}

export async function createConversation(title = 'Новый чат') {
  const now = Date.now();
  const conversation = { id: id(), title, createdAt: now, updatedAt: now };
  const db = await getDB();
  await db.put(CONVERSATIONS, conversation);
  await db.put(META, { key: 'activeConversationId', value: conversation.id });
  return { ...conversation, messages: [] };
}

export async function saveConversation(conversation) {
  const db = await getDB();
  const now = Date.now();
  await db.put(CONVERSATIONS, { id: conversation.id, title: conversation.title, createdAt: conversation.createdAt, updatedAt: now });
  const tx = db.transaction(MESSAGES, 'readwrite');
  const existing = await tx.store.index('conversationId').getAll(conversation.id);
  const keep = new Set((conversation.messages || []).map((message) => message.id));
  for (const message of existing) if (!keep.has(message.id)) await tx.store.delete(message.id);
  for (const message of conversation.messages || []) {
    await tx.store.put({ ...message, conversationId: conversation.id, id: message.id || id(), createdAt: message.createdAt || now });
  }
  await tx.done;
  await db.put(META, { key: 'activeConversationId', value: conversation.id });
}

export async function renameConversation(conversationId, title) {
  const db = await getDB();
  const conversation = await db.get(CONVERSATIONS, conversationId);
  if (!conversation) return null;
  conversation.title = title.trim() || 'Новый чат';
  conversation.updatedAt = Date.now();
  await db.put(CONVERSATIONS, conversation);
  return conversation;
}

export async function deleteConversation(conversationId) {
  const db = await getDB();
  const tx = db.transaction([CONVERSATIONS, MESSAGES], 'readwrite');
  const messages = await tx.objectStore(MESSAGES).index('conversationId').getAll(conversationId);
  for (const message of messages) await tx.objectStore(MESSAGES).delete(message.id);
  await tx.objectStore(CONVERSATIONS).delete(conversationId);
  await tx.done;
  const conversations = await listConversations();
  await db.put(META, { key: 'activeConversationId', value: conversations[0]?.id || null });
  return conversations[0] || null;
}

export async function getActiveConversationId() {
  const db = await getDB();
  return (await db.get(META, 'activeConversationId'))?.value || null;
}
