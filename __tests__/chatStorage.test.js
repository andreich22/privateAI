import { beforeEach, describe, expect, it, vi } from 'vitest';

function createFakeDb() {
  const conversations = new Map();
  const messages = new Map();
  const meta = new Map();

  const conversationIndex = {
    getAll: vi.fn(async (conversationId) => [...messages.values()].filter((message) => message.conversationId === conversationId)),
  };

  const messageStore = {
    index: vi.fn(() => conversationIndex),
    delete: vi.fn(async (id) => messages.delete(id)),
    put: vi.fn(async (message) => messages.set(message.id, message)),
  };

  const tx = {
    store: messageStore,
    objectStore: vi.fn((storeName) => {
      if (storeName === 'messages') return messageStore;
      return {
        delete: vi.fn(async (id) => conversations.delete(id)),
      };
    }),
    done: Promise.resolve(),
  };

  return {
    conversations,
    messages,
    meta,
    put: vi.fn(async (store, value) => {
      if (store === 'conversations') conversations.set(value.id, value);
      if (store === 'messages') messages.set(value.id, value);
      if (store === 'meta') meta.set(value.key, value);
    }),
    get: vi.fn(async (store, key) => {
      if (store === 'conversations') return conversations.get(key);
      if (store === 'meta') return meta.get(key);
      return undefined;
    }),
    getAllFromIndex: vi.fn(async (store, indexName, value) => {
      if (store === 'conversations' && indexName === 'updatedAt') return [...conversations.values()].sort((a, b) => a.updatedAt - b.updatedAt);
      if (store === 'messages' && indexName === 'conversationId') return [...messages.values()].filter((message) => message.conversationId === value);
      return [];
    }),
    transaction: vi.fn(() => tx),
    delete: vi.fn(async (store, key) => {
      if (store === 'conversations') conversations.delete(key);
      if (store === 'messages') messages.delete(key);
      if (store === 'meta') meta.delete(key);
    }),
  };
}

let db;
let openDB;

async function loadChatStorage() {
  vi.resetModules();
  db = createFakeDb();
  vi.doMock('idb', () => ({
    openDB: vi.fn().mockResolvedValue(db),
  }));
  ({ openDB } = await import('idb'));
  return import('../src/services/chatStorage.js');
}

describe('chatStorage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a conversation and marks it active', async () => {
    const storage = await loadChatStorage();

    const conversation = await storage.createConversation('My chat');

    expect(conversation).toMatchObject({
      title: 'My chat',
      systemPrompt: '',
      messages: [],
    });
    expect(db.meta.get('activeConversationId').value).toBe(conversation.id);
    expect(db.conversations.get(conversation.id)).toMatchObject({ title: 'My chat' });
  });

  it('creates a default titled conversation', async () => {
    const storage = await loadChatStorage();
    const conversation = await storage.createConversation();

    expect(conversation.title).toBe('Новый чат');
  });

  it('lists only valid conversations in reverse updated order', async () => {
    const storage = await loadChatStorage();
    db.conversations.set('old', { id: 'old', title: 'Old', systemPrompt: '', createdAt: 1, updatedAt: 1 });
    db.conversations.set('new', { id: 'new', title: 'New', systemPrompt: '', createdAt: 2, updatedAt: 2 });
    db.conversations.set('bad', { id: 'bad', title: null, systemPrompt: '', createdAt: 3, updatedAt: 3 });

    await expect(storage.listConversations()).resolves.toEqual([
      db.conversations.get('new'),
      db.conversations.get('old'),
    ]);
  });

  it('loads a conversation with messages sorted by creation time and filters malformed records', async () => {
    const storage = await loadChatStorage();
    db.conversations.set('c1', { id: 'c1', title: 'Chat', systemPrompt: '', createdAt: 1, updatedAt: 2 });
    db.messages.set('m2', { id: 'm2', conversationId: 'c1', role: 'assistant', content: 'second', createdAt: 2 });
    db.messages.set('m1', { id: 'm1', conversationId: 'c1', role: 'user', content: 'first', createdAt: 1 });
    db.messages.set('bad', { id: 'bad', conversationId: 'c1', role: 'user', createdAt: 0 });

    await expect(storage.getConversation('c1')).resolves.toEqual({
      ...db.conversations.get('c1'),
      messages: [db.messages.get('m1'), db.messages.get('m2')],
    });
    await expect(storage.getConversation('missing')).resolves.toBeNull();
  });

  it('saves a conversation, removes stale messages and ignores malformed messages', async () => {
    const storage = await loadChatStorage();
    db.conversations.set('c1', { id: 'c1', title: 'Old', systemPrompt: '', createdAt: 1, updatedAt: 1 });
    db.messages.set('stale', { id: 'stale', conversationId: 'c1', role: 'user', content: 'remove', createdAt: 1 });

    const saved = await storage.saveConversation({
      id: 'c1',
      title: '',
      systemPrompt: 'Be concise',
      createdAt: 1,
      messages: [
        { id: 'keep', role: 'user', content: 'hello', createdAt: 2 },
        { role: 'assistant', content: 'reply' },
        { id: 'invalid', role: 'assistant' },
      ],
    });

    expect(saved).toBe(true);
    expect(db.messages.has('stale')).toBe(false);
    expect([...db.messages.values()].filter((m) => m.conversationId === 'c1')).toHaveLength(2);
    expect(db.meta.get('activeConversationId').value).toBe('c1');
    expect(db.conversations.get('c1')).toMatchObject({
      title: 'Новый чат',
      systemPrompt: 'Be concise',
      createdAt: 1,
    });
  });

  it('rejects saving a conversation without an id', async () => {
    const storage = await loadChatStorage();
    await expect(storage.saveConversation({ title: 'No id' })).resolves.toBe(false);
  });

  it('renames an existing conversation and normalizes an empty title', async () => {
    const storage = await loadChatStorage();
    db.conversations.set('c1', { id: 'c1', title: 'Old', systemPrompt: '', createdAt: 1, updatedAt: 1 });

    await expect(storage.renameConversation('c1', '   ')).resolves.toMatchObject({
      id: 'c1',
      title: 'Новый чат',
    });
    await expect(storage.renameConversation('missing', 'Name')).resolves.toBeNull();
  });

  it('deletes a conversation and activates the newest remaining conversation', async () => {
    const storage = await loadChatStorage();
    db.conversations.set('c1', { id: 'c1', title: 'First', systemPrompt: '', createdAt: 1, updatedAt: 1 });
    db.conversations.set('c2', { id: 'c2', title: 'Second', systemPrompt: '', createdAt: 2, updatedAt: 2 });
    db.messages.set('m1', { id: 'm1', conversationId: 'c1', role: 'user', content: 'hello', createdAt: 1 });

    await expect(storage.deleteConversation('c1')).resolves.toMatchObject({ id: 'c2' });
    expect(db.conversations.has('c1')).toBe(false);
    expect(db.messages.has('m1')).toBe(false);
    expect(db.meta.get('activeConversationId').value).toBe('c2');
  });

  it('returns the active conversation id or null', async () => {
    const storage = await loadChatStorage();
    await expect(storage.getActiveConversationId()).resolves.toBeNull();

    db.meta.set('activeConversationId', { key: 'activeConversationId', value: 'c1' });
    await expect(storage.getActiveConversationId()).resolves.toBe('c1');
  });

  it('opens the database with the chat schema upgrade callback', async () => {
    const storage = await loadChatStorage();
    await storage.listConversations();
    expect(openDB).toHaveBeenCalledWith(
      'LocalReactAIChat',
      3,
      expect.objectContaining({ upgrade: expect.any(Function) }),
    );
  });
});
