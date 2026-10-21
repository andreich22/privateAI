import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChatContainer } from '@gravity-ui/aikit';
import {
  createConversation,
  deleteConversation,
  getActiveConversationId,
  getConversation,
  listConversations,
  renameConversation,
  saveConversation,
} from '../services/chatStorage';
import { loadGenerationSettings } from '../services/generationSettings';
import GenerationSettings from './GenerationSettings';
import ExecutionSettings from './ExecutionSettings';

const DEFAULT_CAPABILITIES = { temperature: true, top_p: true, max_tokens: true };
const EMPTY_TOKEN_USAGE = { cached: null, input: null, output: null, total: null };
const STREAMING_PLACEHOLDER_ID = 'streaming-placeholder';

function formatTokenCount(value) {
  return value === null || value === undefined ? '—' : value.toLocaleString('ru-RU');
}

function toIsoTimestamp(createdAt) {
  return Number.isFinite(createdAt) ? new Date(createdAt).toISOString() : new Date().toISOString();
}

function toChatType(conversation) {
  const lastMessage = conversation.messages?.[conversation.messages.length - 1];
  return {
    id: conversation.id,
    name: conversation.title,
    createTime: toIsoTimestamp(conversation.createdAt),
    lastMessage: typeof lastMessage?.content === 'string' ? lastMessage.content.slice(0, 120) : undefined,
  };
}

function toAikitMessage(message) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: toIsoTimestamp(message.createdAt),
  };
}

function setNativeTextareaValue(textarea, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  if (setter) setter.call(textarea, value);
  else textarea.value = value;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

export default function ChatWorkspace({ runtime, fileName, onUnload, onApplyExecutionSettings, onSelectModel, onLoadFromHF, modelError }) {
  const [conversation, setConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState(null);
  const [tokenUsage, setTokenUsage] = useState(EMPTY_TOKEN_USAGE);
  const [debugInfo, setDebugInfo] = useState('');
  const [sendNotice, setSendNotice] = useState('');
  const generationRef = useRef(false);
  const partialResponseRef = useRef('');
  const inputRef = useRef(null);

  const messages = conversation?.messages || [];
  const modelReady = Boolean(runtime?.isLoaded?.());
  const modelShortName = fileName?.split('/').pop() || '';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let activeId = await getActiveConversationId();
        let active = activeId ? await getConversation(activeId) : null;
        if (!active) active = await createConversation();
        if (cancelled) return;
        setConversation(active);
        setConversations(await listConversations());
      } catch (err) {
        if (!cancelled) appendDebug(`STORAGE ERROR: ${err.message}`);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const appendDebug = (text) => {
    setDebugInfo((prev) => `${prev}\n[${new Date().toLocaleTimeString()}] ${text}`.slice(-8000));
  };

  const refreshConversations = async () => setConversations(await listConversations());

  const updateConversation = async (next) => {
    setConversation(next);
    await saveConversation(next);
    await refreshConversations();
  };

  const clearPromptInput = () => {
    if (inputRef.current) setNativeTextareaValue(inputRef.current, '');
  };

  const resetChatScratch = () => {
    setStreamingText(null);
    setTokenUsage(EMPTY_TOKEN_USAGE);
    setEditingMessageId(null);
    setSendNotice('');
  };

  const openConversation = async (id) => {
    if (generationRef.current || id === conversation?.id) return;
    const next = await getConversation(id);
    if (next) {
      setConversation(next);
      await saveConversation(next);
      await refreshConversations();
      resetChatScratch();
    }
  };

  const handleNewChat = async () => {
    if (generationRef.current) return;
    const next = await createConversation();
    setConversation(next);
    await refreshConversations();
    resetChatScratch();
  };

  const handleRename = async () => {
    if (!conversation || generationRef.current) return;
    const title = window.prompt('Название чата:', conversation.title);
    if (title === null) return;
    const updated = await renameConversation(conversation.id, title);
    if (updated) {
      setConversation((prev) => ({ ...prev, ...updated }));
      await refreshConversations();
    }
  };

  const handleDeleteChat = async (target) => {
    const chat = target || conversation;
    if (!chat || generationRef.current) return;
    const title = chat.title || chat.name || '';
    if (!window.confirm(`Удалить чат «${title}»?`)) return;
    const next = await deleteConversation(chat.id);
    const wasActive = !target || conversation?.id === chat.id;
    if (wasActive) {
      const active = next ? await getConversation(next.id) : await createConversation();
      setConversation(active);
      resetChatScratch();
    }
    await refreshConversations();
  };

  const handleDeleteMessage = async (message) => {
    if (!conversation || generationRef.current || !message?.id) return;
    if (!window.confirm('Удалить это сообщение?')) return;
    const next = {
      ...conversation,
      messages: messages.filter((item) => item.id !== message.id),
    };
    await updateConversation(next);
    if (editingMessageId === message.id) {
      setEditingMessageId(null);
      clearPromptInput();
    }
  };

  const handleEditMessage = (message) => {
    if (!conversation || generationRef.current || message?.role !== 'user') return;
    setEditingMessageId(message.id);
    setSendNotice('');
    const textarea = inputRef.current;
    if (textarea) {
      setNativeTextareaValue(textarea, message.content);
      textarea.focus();
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    clearPromptInput();
  };

  const handleCancelGeneration = async () => {
    if (!generationRef.current) return;
    appendDebug('CANCEL: stopping generation');
    runtime?.cancelGeneration?.();
  };

  const handleSend = async (data) => {
    const userText = (data?.content || '').trim();
    if (!userText || generationRef.current || !conversation) return;
    if (!modelReady) {
      setSendNotice('Модель не выбрана. Выберите локальный GGUF-файл или скачайте модель, чтобы отправить сообщение.');
      return;
    }
    setSendNotice('');

    const editingIndex = editingMessageId
      ? messages.findIndex((message) => message.id === editingMessageId && message.role === 'user')
      : -1;
    const baseMessages = editingIndex >= 0 ? messages.slice(0, editingIndex) : messages;

    setEditingMessageId(null);
    setIsGenerating(true);
    generationRef.current = true;
    partialResponseRef.current = '';
    setStreamingText('');
    setTokenUsage(EMPTY_TOKEN_USAGE);
    appendDebug(`USER: ${userText}`);

    const userMessage = { id: crypto.randomUUID(), role: 'user', content: userText, createdAt: Date.now() };
    const nextMessages = [...baseMessages, userMessage];
    const pending = { ...conversation, messages: nextMessages };
    setConversation(pending);
    await saveConversation(pending);
    await refreshConversations();

    let fullAssistantText = '';
    try {
      const promptMessage = conversation.systemPrompt?.trim()
        ? [{ role: 'system', content: conversation.systemPrompt.trim() }, ...nextMessages.map(({ role, content }) => ({ role, content }))]
        : nextMessages.map(({ role, content }) => ({ role, content }));
      const result = await runtime.streamChat(promptMessage, (token) => {
        fullAssistantText += token;
        partialResponseRef.current = fullAssistantText;
        setStreamingText(fullAssistantText);
      }, loadGenerationSettings());

      if (result?.usage) setTokenUsage(result.usage);
      appendDebug(`DONE: ${fullAssistantText}`);
      const assistantMessage = { id: crypto.randomUUID(), role: 'assistant', content: fullAssistantText, createdAt: Date.now() };
      const completed = { ...pending, messages: [...nextMessages, assistantMessage] };
      setConversation(completed);
      await saveConversation(completed);
      await refreshConversations();
    } catch (err) {
      const wasCancelled = err?.name === 'AbortError';
      if (wasCancelled) {
        const partial = partialResponseRef.current;
        appendDebug(`CANCELLED: ${partial ? `preserved ${partial.length} chars` : 'no generated text'}`);
        if (partial) {
          const partialMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: partial,
            createdAt: Date.now(),
            generationStatus: 'cancelled',
          };
          const cancelledConversation = { ...pending, messages: [...nextMessages, partialMessage] };
          setConversation(cancelledConversation);
          await saveConversation(cancelledConversation);
          await refreshConversations();
        }
      } else {
        appendDebug(`CHAT ERROR: ${err.message}`);
        const errorMessage = { id: crypto.randomUUID(), role: 'assistant', content: `[Ошибка чата: ${err.message}]`, createdAt: Date.now() };
        const failed = { ...pending, messages: [...nextMessages, errorMessage] };
        setConversation(failed);
        await saveConversation(failed);
        await refreshConversations();
      }
    } finally {
      generationRef.current = false;
      setIsGenerating(false);
      setStreamingText(null);
      partialResponseRef.current = '';
    }
  };

  const handleUnload = async () => {
    if (generationRef.current) return;
    await onUnload?.();
  };

  const aikitMessages = useMemo(() => {
    const mapped = messages.map(toAikitMessage);
    if (streamingText !== null) {
      mapped.push({
        id: STREAMING_PLACEHOLDER_ID,
        role: 'assistant',
        content: streamingText,
        timestamp: new Date().toISOString(),
      });
    }
    return mapped;
  }, [messages, streamingText]);

  const chatTypeList = useMemo(() => conversations.map(toChatType), [conversations]);
  const activeChat = useMemo(() => (conversation ? toChatType(conversation) : null), [conversation]);

  const chatStatus = isGenerating ? 'streaming' : 'ready';

  const contextItems = [
    { id: 'tokens-cache', content: `Кэш ${formatTokenCount(tokenUsage.cached)}` },
    { id: 'tokens-input', content: `↑ ${formatTokenCount(tokenUsage.input)}` },
    { id: 'tokens-output', content: `↓ ${formatTokenCount(tokenUsage.output)}` },
    { id: 'tokens-total', content: `Всего ${formatTokenCount(tokenUsage.total)}` },
  ];

  const topPanelOpen = Boolean(debugInfo || editingMessageId || sendNotice);

  const userActions = [
    { type: 'edit', label: 'Изменить', children: 'Изменить', onClick: handleEditMessage },
    { type: 'delete', label: 'Удалить', children: 'Удалить', onClick: handleDeleteMessage },
  ];
  const assistantActions = [
    { type: 'delete', label: 'Удалить', children: 'Удалить', onClick: handleDeleteMessage },
  ];

  const modelStatusText = !modelReady
    ? (fileName ? `Не загружена · ${modelShortName}` : 'Модель не выбрана')
    : `Локально · ${modelShortName}`;

  return (
    <div className="chat-container">
      <div className="chat-shell">
        <main className="chat-main">
          {!modelReady && (
            <div className="model-missing-banner" role="status">
              <div className="model-missing-copy">
                <strong>{fileName ? 'Модель не загружена' : 'Модель не выбрана'}</strong>
                <span>{fileName ? `Файл ${modelShortName} выбран, но не загружен. Загрузите его снова или выберите другую модель.` : 'Выберите локальный GGUF-файл или скачайте модель, чтобы начать общение.'}</span>
                {modelError && <span className="model-missing-error" role="alert">{modelError}</span>}
              </div>
              <div className="model-missing-actions">
                {onSelectModel && <button type="button" className="btn-sub" onClick={onSelectModel}>Выбрать GGUF файл</button>}
                {onLoadFromHF && <button type="button" className="btn-sub" onClick={onLoadFromHF}>Скачать модель (HF)</button>}
              </div>
            </div>
          )}
          <ChatContainer
            className="aikit-chat"
            qa={{ prefix: 'private-ai' }}
            chats={chatTypeList}
            activeChat={activeChat}
            messages={aikitMessages}
            status={chatStatus}
            onSendMessage={handleSend}
            onSelectChat={(chat) => openConversation(chat.id)}
            onCreateChat={handleNewChat}
            onDeleteChat={(chat) => handleDeleteChat(chat)}
            onCancel={handleCancelGeneration}
            shouldParseIncompleteMarkdown
            showActionsOnHover
            contextItems={contextItems}
            texts={{
              promptPlaceholder: 'Сообщение privateAI…',
              submitSendTooltip: 'Отправить',
              submitCancelTooltip: 'Остановить генерацию',
              submitButtonCancelableText: 'Остановить',
              headerNewChatTooltip: 'Новый чат',
              headerHistoryTooltip: 'История чатов',
              headerMenuTooltip: 'Ещё',
              emptyStateTitle: 'Локальный чат с ИИ',
              emptyStateDescription: 'Модель работает прямо в браузере. Данные не покидают устройство.',
              historySearchPlaceholder: 'Поиск чатов…',
              disclaimerText: 'Данные остаются на устройстве',
            }}
            messageListConfig={{
              userActions,
              assistantActions,
              showTimestamp: true,
            }}
            headerProps={{
              icon: <div className="brand-mark" aria-hidden="true">P</div>,
              preview: (
                <div className="model-name" title={fileName || 'Модель не выбрана'}>{modelStatusText}</div>
              ),
              additionalActions: [
                <button key="unload" type="button" className="danger-button" onClick={handleUnload} disabled={isGenerating || !modelReady}>Выгрузить</button>,
              ],
              menuItems: [
                { id: 'rename', label: 'Переименовать', onClick: handleRename, disabled: isGenerating || !conversation },
                { id: 'delete-chat', label: 'Удалить чат', onClick: () => handleDeleteChat(), disabled: isGenerating || !conversation },
              ],
            }}
            promptInputProps={{
              view: 'full',
              bodyProps: { inputRef },
              topPanel: {
                isOpen: topPanelOpen,
                children: (
                  <div className="chat-top-panel">
                    {editingMessageId && (
                      <div className="composer-editing">
                        <span>Редактирование сообщения</span>
                        <button type="button" className="ghost-button" onClick={handleCancelEdit}>Отмена</button>
                      </div>
                    )}
                    {sendNotice && <div className="composer-notice" role="alert">{sendNotice}</div>}
                    {debugInfo && <div className="debug-panel">{debugInfo}</div>}
                  </div>
                ),
              },
            }}
          />
        </main>
        <aside className="settings-sidebar" aria-label="Настройки">
          <div className="settings-sidebar-header">
            <div className="settings-sidebar-title">Настройки</div>
            <div className="settings-sidebar-subtitle">Параметры текущей модели и генерации</div>
          </div>
          <div className="settings-sidebar-content">
            <GenerationSettings conversation={conversation} onConversationChange={updateConversation} disabled={isGenerating} supported={runtime?.getGenerationCapabilities?.() || DEFAULT_CAPABILITIES} />
            <ExecutionSettings runtime={runtime} disabled={isGenerating} onApply={onApplyExecutionSettings} />
          </div>
        </aside>
      </div>
    </div>
  );
};
