export const STORAGE_SCHEMA_VERSION = 3;
export const CHAT_DB = {
  name: 'private-ai',
  version: STORAGE_SCHEMA_VERSION,
  stores: {
    conversations: 'conversations',
    messages: 'messages',
    meta: 'meta',
  },
};

export const FILE_DB = {
  name: 'LocalReactAIVault',
  version: 2,
  store: 'FileHandles',
  key: 'gguf_model_handle',
};

export function isStorageError(error) {
  return Boolean(error) && (
    error.name === 'QuotaExceededError' ||
    error.name === 'InvalidStateError' ||
    error.name === 'TransactionInactiveError' ||
    error.name === 'UnknownError' ||
    error.name === 'AbortError' ||
    error.name === 'NotFoundError'
  );
}

export function isConversationRecord(value) {
  return Boolean(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    Number.isFinite(value.createdAt) &&
    Number.isFinite(value.updatedAt);
}

export function isMessageRecord(value) {
  return Boolean(value) &&
    typeof value.id === 'string' &&
    typeof value.conversationId === 'string' &&
    typeof value.role === 'string' &&
    typeof value.content === 'string' &&
    Number.isFinite(value.createdAt);
}

export function logStorageError(operation, error) {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(`[storage] ${operation} failed`, error);
  }
}
