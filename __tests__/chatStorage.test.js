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

async function loadChatStorageWithNullDb() {
  vi.resetModules();
  db = null;
  vi.doMock('idb', () => ({
    openDB: vi.fn().mockResolvedValue(null),
  }));
  ({ openDB } = await import('idb'));
  return import('../src/services/chatStorage.js');
}

describe('chatStorage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('happy path', () => {
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
        title: '',
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
        'private-ai',
        3,
        expect.objectContaining({ upgrade: expect.any(Function) }),
      );
    });
  });

  describe('null-db degraded paths', () => {
    it('listConversations returns [] when db is null', async () => {
      const storage = await loadChatStorageWithNullDb();
      await expect(storage.listConversations()).resolves.toEqual([]);
    });

    it('getConversation returns null when db is null', async () => {
      const storage = await loadChatStorageWithNullDb();
      await expect(storage.getConversation('c1')).resolves.toBeNull();
    });

    it('createConversation returns conversation with messages [] when db is null', async () => {
      const storage = await loadChatStorageWithNullDb();
      const conversation = await storage.createConversation('test');
      expect(conversation).toMatchObject({ title: 'test', messages: [] });
    });

    it('saveConversation returns false when db is null', async () => {
      const storage = await loadChatStorageWithNullDb();
      await expect(storage.saveConversation({ id: 'c1', title: 't' })).resolves.toBe(false);
    });

    it('renameConversation returns null when db is null', async () => {
      const storage = await loadChatStorageWithNullDb();
      await expect(storage.renameConversation('c1', 'new')).resolves.toBeNull();
    });

    it('deleteConversation returns null when db is null', async () => {
      const storage = await loadChatStorageWithNullDb();
      await expect(storage.deleteConversation('c1')).resolves.toBeNull();
    });

    it('getActiveConversationId returns null when db is null', async () => {
      const storage = await loadChatStorageWithNullDb();
      await expect(storage.getActiveConversationId()).resolves.toBeNull();
    });
  });

  describe('exception paths', () => {
    it('listConversations returns [] when db throws', async () => {
      const storage = await loadChatStorage();
      db.getAllFromIndex.mockRejectedValue(new Error('IDB failure'));
      await expect(storage.listConversations()).resolves.toEqual([]);
    });

    it('getConversation returns null when db throws', async () => {
      const storage = await loadChatStorage();
      db.get.mockRejectedValue(new Error('IDB failure'));
      await expect(storage.getConversation('c1')).resolves.toBeNull();
    });

    it('createConversation returns conversation when db throws on put', async () => {
      const storage = await loadChatStorage();
      db.put.mockRejectedValue(new Error('IDB failure'));
      const conversation = await storage.createConversation('fail');
      expect(conversation).toMatchObject({ title: 'fail', messages: [] });
    });

    it('saveConversation returns false when db throws', async () => {
      const storage = await loadChatStorage();
      db.conversations.set('c1', { id: 'c1', title: 't', systemPrompt: '', createdAt: 1, updatedAt: 1 });
      db.put.mockRejectedValue(new Error('IDB failure'));
      await expect(storage.saveConversation({ id: 'c1', title: 't', messages: [] })).resolves.toBe(false);
    });

    it('renameConversation returns null when db throws', async () => {
      const storage = await loadChatStorage();
      db.get.mockRejectedValue(new Error('IDB failure'));
      await expect(storage.renameConversation('c1', 'new')).resolves.toBeNull();
    });

    it('deleteConversation returns null when db throws', async () => {
      const storage = await loadChatStorage();
      db.transaction.mockImplementation(() => { throw new Error('IDB failure'); });
      await expect(storage.deleteConversation('c1')).resolves.toBeNull();
    });

    it('getActiveConversationId returns null when db throws', async () => {
      const storage = await loadChatStorage();
      db.get.mockRejectedValue(new Error('IDB failure'));
      await expect(storage.getActiveConversationId()).resolves.toBeNull();
    });

    it('resets dbPromise when openDB fails', async () => {
      vi.resetModules();
      const failOnce = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(db = createFakeDb());
      vi.doMock('idb', () => ({ openDB: failOnce }));
      await import('idb');

      const storage = await import('../src/services/chatStorage.js');
      await storage.listConversations();
      expect(failOnce).toHaveBeenCalledTimes(1);
      await storage.listConversations();
      expect(failOnce).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('saveConversation handles null conversation', async () => {
      const storage = await loadChatStorage();
      await expect(storage.saveConversation(null)).resolves.toBe(false);
    });

    it('saveConversation handles undefined conversation', async () => {
      const storage = await loadChatStorage();
      await expect(storage.saveConversation(undefined)).resolves.toBe(false);
    });

    it('saveConversation uses fallback title when title is not a string', async () => {
      const storage = await loadChatStorage();
      await storage.saveConversation({
        id: 'c1',
        title: 123,
        messages: [],
      });
      expect(db.conversations.get('c1').title).toBe('Новый чат');
    });

    it('saveConversation uses fallback createdAt when not finite', async () => {
      const storage = await loadChatStorage();
      const before = Date.now();
      await storage.saveConversation({
        id: 'c1',
        title: 't',
        createdAt: NaN,
        messages: [],
      });
      expect(db.conversations.get('c1').createdAt).toBeGreaterThanOrEqual(before);
    });

    it('saveConversation uses fallback createdAt for messages when not finite', async () => {
      const storage = await loadChatStorage();
      const before = Date.now();
      await storage.saveConversation({
        id: 'c1',
        title: 't',
        messages: [{ role: 'user', content: 'hi', createdAt: Infinity }],
      });
      const msg = [...db.messages.values()].find((m) => m.conversationId === 'c1');
      expect(msg.createdAt).toBeGreaterThanOrEqual(before);
    });

    it('saveConversation assigns random id to messages without id', async () => {
      const storage = await loadChatStorage();
      await storage.saveConversation({
        id: 'c1',
        title: 't',
        messages: [{ role: 'user', content: 'hi' }],
      });
      const msg = [...db.messages.values()].find((m) => m.conversationId === 'c1');
      expect(msg.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('saveConversation returns false when messages array contains null', async () => {
      const storage = await loadChatStorage();
      const result = await storage.saveConversation({
        id: 'c1',
        title: 't',
        messages: [null, undefined, { role: 'user', content: 'ok' }],
      });
      expect(result).toBe(false);
    });

    it('saveConversation skips messages with non-string role', async () => {
      const storage = await loadChatStorage();
      await storage.saveConversation({
        id: 'c1',
        title: 't',
        messages: [{ role: 123, content: 'bad' }],
      });
      expect([...db.messages.values()].filter((m) => m.conversationId === 'c1')).toHaveLength(0);
    });

    it('saveConversation skips messages with non-string content', async () => {
      const storage = await loadChatStorage();
      await storage.saveConversation({
        id: 'c1',
        title: 't',
        messages: [{ role: 'user', content: null }],
      });
      expect([...db.messages.values()].filter((m) => m.conversationId === 'c1')).toHaveLength(0);
    });

    it('saveConversation defaults systemPrompt to empty string', async () => {
      const storage = await loadChatStorage();
      await storage.saveConversation({
        id: 'c1',
        title: 't',
        messages: [],
      });
      expect(db.conversations.get('c1').systemPrompt).toBe('');
    });

    it('renameConversation uses fallback title for undefined', async () => {
      const storage = await loadChatStorage();
      db.conversations.set('c1', { id: 'c1', title: 'Old', systemPrompt: '', createdAt: 1, updatedAt: 1 });
      await storage.renameConversation('c1', undefined);
      expect(db.conversations.get('c1').title).toBe('Новый чат');
    });

    it('renameConversation uses fallback title for null', async () => {
      const storage = await loadChatStorage();
      db.conversations.set('c1', { id: 'c1', title: 'Old', systemPrompt: '', createdAt: 1, updatedAt: 1 });
      await storage.renameConversation('c1', null);
      expect(db.conversations.get('c1').title).toBe('Новый чат');
    });

    it('renameConversation uses fallback title for empty string', async () => {
      const storage = await loadChatStorage();
      db.conversations.set('c1', { id: 'c1', title: 'Old', systemPrompt: '', createdAt: 1, updatedAt: 1 });
      await storage.renameConversation('c1', '');
      expect(db.conversations.get('c1').title).toBe('Новый чат');
    });

    it('listConversations returns [] for empty store', async () => {
      const storage = await loadChatStorage();
      await expect(storage.listConversations()).resolves.toEqual([]);
    });

    it('getConversation returns null for conversation not in store', async () => {
      const storage = await loadChatStorage();
      await expect(storage.getConversation('nonexistent')).resolves.toBeNull();
    });

    it('getConversation returns null when record is malformed', async () => {
      const storage = await loadChatStorage();
      db.conversations.set('bad', { id: 'bad' });
      await expect(storage.getConversation('bad')).resolves.toBeNull();
    });

    it('deleteConversation sets activeConversationId to null when no conversations remain', async () => {
      const storage = await loadChatStorage();
      db.conversations.set('c1', { id: 'c1', title: 'Only', systemPrompt: '', createdAt: 1, updatedAt: 1 });
      await storage.deleteConversation('c1');
      expect(db.meta.get('activeConversationId').value).toBeNull();
    });

    it('createConversation generates UUID format id', async () => {
      const storage = await loadChatStorage();
      const conversation = await storage.createConversation('t');
      expect(conversation.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('createConversation sets equal createdAt and updatedAt', async () => {
      const storage = await loadChatStorage();
      const conversation = await storage.createConversation('t');
      expect(conversation.createdAt).toBe(conversation.updatedAt);
    });

    it('saveConversation updates updatedAt to current time', async () => {
      const storage = await loadChatStorage();
      const before = Date.now();
      db.conversations.set('c1', { id: 'c1', title: 't', systemPrompt: '', createdAt: 1, updatedAt: 1 });
      await storage.saveConversation({ id: 'c1', title: 't', createdAt: 1, messages: [] });
      expect(db.conversations.get('c1').updatedAt).toBeGreaterThanOrEqual(before);
    });

    it('getConversation filters messages missing content field', async () => {
      const storage = await loadChatStorage();
      db.conversations.set('c1', { id: 'c1', title: 't', systemPrompt: '', createdAt: 1, updatedAt: 1 });
      db.messages.set('m1', { id: 'm1', conversationId: 'c1', role: 'user', content: 'ok', createdAt: 1 });
      db.messages.set('m2', { id: 'm2', conversationId: 'c1', role: 'user', content: undefined, createdAt: 2 });
      db.messages.set('m3', { id: 'm3', conversationId: 'c1', role: 'assistant', content: 123, createdAt: 3 });

      const result = await storage.getConversation('c1');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].id).toBe('m1');
    });

    it('getConversation filters messages missing role field', async () => {
      const storage = await loadChatStorage();
      db.conversations.set('c1', { id: 'c1', title: 't', systemPrompt: '', createdAt: 1, updatedAt: 1 });
      db.messages.set('m1', { id: 'm1', conversationId: 'c1', role: 'user', content: 'ok', createdAt: 1 });
      db.messages.set('m2', { id: 'm2', conversationId: 'c1', content: 'no role', createdAt: 2 });

      const result = await storage.getConversation('c1');
      expect(result.messages).toHaveLength(1);
    });

    it('getConversation filters messages missing id field', async () => {
      const storage = await loadChatStorage();
      db.conversations.set('c1', { id: 'c1', title: 't', systemPrompt: '', createdAt: 1, updatedAt: 1 });
      db.messages.set('m1', { id: 'm1', conversationId: 'c1', role: 'user', content: 'ok', createdAt: 1 });
      db.messages.set('m2', { conversationId: 'c1', role: 'user', content: 'no id', createdAt: 2 });

      const result = await storage.getConversation('c1');
      expect(result.messages).toHaveLength(1);
    });

    it('getConversation filters messages missing conversationId', async () => {
      const storage = await loadChatStorage();
      db.conversations.set('c1', { id: 'c1', title: 't', systemPrompt: '', createdAt: 1, updatedAt: 1 });
      db.messages.set('m1', { id: 'm1', conversationId: 'c1', role: 'user', content: 'ok', createdAt: 1 });
      db.messages.set('m2', { id: 'm2', role: 'user', content: 'no conv', createdAt: 2 });

      const result = await storage.getConversation('c1');
      expect(result.messages).toHaveLength(1);
    });

    it('getConversation filters messages missing createdAt', async () => {
      const storage = await loadChatStorage();
      db.conversations.set('c1', { id: 'c1', title: 't', systemPrompt: '', createdAt: 1, updatedAt: 1 });
      db.messages.set('m1', { id: 'm1', conversationId: 'c1', role: 'user', content: 'ok', createdAt: 1 });
      db.messages.set('m2', { id: 'm2', conversationId: 'c1', role: 'user', content: 'no ts' });

      const result = await storage.getConversation('c1');
      expect(result.messages).toHaveLength(1);
    });

    it('listConversations filters out records with missing id', async () => {
      const storage = await loadChatStorage();
      db.conversations.set('good', { id: 'good', title: 'ok', systemPrompt: '', createdAt: 1, updatedAt: 1 });
      db.conversations.set('noid', { title: 'no id', systemPrompt: '', createdAt: 2, updatedAt: 2 });

      const result = await storage.listConversations();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('good');
    });

    it('listConversations filters out records with missing title', async () => {
      const storage = await loadChatStorage();
      db.conversations.set('good', { id: 'good', title: 'ok', systemPrompt: '', createdAt: 1, updatedAt: 1 });
      db.conversations.set('notitle', { id: 'notitle', systemPrompt: '', createdAt: 2, updatedAt: 2 });

      const result = await storage.listConversations();
      expect(result).toHaveLength(1);
    });

    it('listConversations filters out records with non-finite createdAt', async () => {
      const storage = await loadChatStorage();
      db.conversations.set('good', { id: 'good', title: 'ok', systemPrompt: '', createdAt: 1, updatedAt: 1 });
      db.conversations.set('bad', { id: 'bad', title: 'x', systemPrompt: '', createdAt: NaN, updatedAt: 2 });

      const result = await storage.listConversations();
      expect(result).toHaveLength(1);
    });

    it('listConversations filters out records with non-finite updatedAt', async () => {
      const storage = await loadChatStorage();
      db.conversations.set('good', { id: 'good', title: 'ok', systemPrompt: '', createdAt: 1, updatedAt: 1 });
      db.conversations.set('bad', { id: 'bad', title: 'x', systemPrompt: '', createdAt: 1, updatedAt: Infinity });

      const result = await storage.listConversations();
      expect(result).toHaveLength(1);
    });

    it('saveConversation uses default title Новый чат for non-string title', async () => {
      const storage = await loadChatStorage();
      await storage.saveConversation({ id: 'c1', title: undefined, messages: [] });
      expect(db.conversations.get('c1').title).toBe('Новый чат');
    });

    it('saveConversation preserves conversation createdAt when finite', async () => {
      const storage = await loadChatStorage();
      await storage.saveConversation({ id: 'c1', title: 't', createdAt: 42, messages: [] });
      expect(db.conversations.get('c1').createdAt).toBe(42);
    });
  });
});
