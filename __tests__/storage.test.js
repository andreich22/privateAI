import { describe, expect, it } from 'vitest';
import {
  CHAT_DB,
  FILE_DB,
  STORAGE_SCHEMA_VERSION,
  isConversationRecord,
  isMessageRecord,
} from '../src/services/storage.js';

describe('storage schema', () => {
  it('uses explicit schema versions for all IndexedDB stores', () => {
    expect(STORAGE_SCHEMA_VERSION).toBe(3);
    expect(CHAT_DB.version).toBe(STORAGE_SCHEMA_VERSION);
    expect(FILE_DB.version).toBe(2);
    expect(CHAT_DB.stores).toEqual({
      conversations: 'conversations',
      messages: 'messages',
      meta: 'meta',
    });
  });

  it('rejects malformed conversation records instead of blocking recovery', () => {
    expect(isConversationRecord({ id: 'c1', title: 'Chat', createdAt: 1, updatedAt: 2 })).toBe(true);
    expect(isConversationRecord({ id: 'c1', title: null, createdAt: 1, updatedAt: 2 })).toBe(false);
    expect(isConversationRecord(null)).toBe(false);
  });

  it('rejects malformed message records instead of blocking recovery', () => {
    expect(isMessageRecord({
      id: 'm1', conversationId: 'c1', role: 'user', content: 'hello', createdAt: 1,
    })).toBe(true);
    expect(isMessageRecord({ id: 'm1', conversationId: 'c1', role: 'user' })).toBe(false);
  });
});
