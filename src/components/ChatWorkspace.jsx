import React, { useEffect, useRef, useState } from 'react';
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

function formatTokenCount(value) {
  return value === null || value === undefined ? '—' : value.toLocaleString('ru-RU');
}

export default function ChatWorkspace({ runtime, fileName, onUnload, onApplyExecutionSettings }) {
  const [conversation, setConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [input, setInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTokens, setCurrentTokens] = useState('');
  const [tokenUsage, setTokenUsage] = useState(EMPTY_TOKEN_USAGE);
  const [debugInfo, setDebugInfo] = useState('');
  const generationRef = useRef(false);
  const partialResponseRef = useRef('');
  const chatEndRef = useRef(null);

  const messages = conversation?.messages || [];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTokens]);

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

  const openConversation = async (id) => {
    if (generationRef.current || id === conversation?.id) return;
    const next = await getConversation(id);
    if (next) {
      setConversation(next);
      await saveConversation(next);
      await refreshConversations();
      setCurrentTokens('');
      setTokenUsage(EMPTY_TOKEN_USAGE);
      setEditingMessageId(null);
      setInput('');
    }
  };

  const handleNewChat = async () => {
    if (generationRef.current) return;
    const next = await createConversation();
    setConversation(next);
    await refreshConversations();
    setCurrentTokens('');
    setTokenUsage(EMPTY_TOKEN_USAGE);
    setInput('');
    setEditingMessageId(null);
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

  const handleDelete = async () => {
    if (!conversation || generationRef.current) return;
    if (!window.confirm(`Удалить чат «${conversation.title}»?`)) return;
    const next = await deleteConversation(conversation.id);
    const active = next ? await getConversation(next.id) : await createConversation();
    setConversation(active);
    await refreshConversations();
    setCurrentTokens('');
    setTokenUsage(EMPTY_TOKEN_USAGE);
    setInput('');
    setEditingMessageId(null);
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
      setInput('');
    }
  };

  const handleEditMessage = (message) => {
    if (!conversation || generationRef.current || message?.role !== 'user') return;
    setEditingMessageId(message.id);
    setInput(message.content);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setInput('');
  };

  const handleCancelGeneration = () => {
    if (!generationRef.current) return;
    appendDebug('CANCEL: stopping generation');
    runtime?.cancelGeneration?.();
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || generationRef.current || !runtime?.isLoaded?.() || !conversation) return;

    const userText = input.trim();
    const editingIndex = editingMessageId
      ? messages.findIndex((message) => message.id === editingMessageId && message.role === 'user')
      : -1;
    const baseMessages = editingIndex >= 0 ? messages.slice(0, editingIndex) : messages;

    setInput('');
    setEditingMessageId(null);
    setIsGenerating(true);
    generationRef.current = true;
    partialResponseRef.current = '';
    setCurrentTokens('');
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
        setCurrentTokens(fullAssistantText);
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
      setCurrentTokens('');
      partialResponseRef.current = '';
    }
  };

  const handleUnload = async () => {
    if (generationRef.current) return;
    await onUnload?.();
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div className="brand"><div className="brand-mark">P</div><div className="brand-copy"><div className="brand-name">privateAI</div><div className="model-name" title={fileName}>Локально · {fileName?.split('/').pop()}</div></div></div>
        <div className="header-actions">
          <button className="ghost-button" onClick={handleRename} disabled={isGenerating || !conversation}>Переименовать</button>
          <button className="ghost-button" onClick={handleDelete} disabled={isGenerating || !conversation}>Удалить</button>
          <button className="danger-button" onClick={handleUnload} disabled={isGenerating}>Выгрузить</button>
        </div>
      </header>
      <div className="chat-shell">
        <aside className="chat-sidebar">
          <button className="new-chat" onClick={handleNewChat} disabled={isGenerating}>Новый чат</button>
          <div className="sidebar-label">Ваши чаты</div>
          <div className="conversation-list">
            {conversations.map((item) => <button key={item.id} className={`conversation-item ${item.id === conversation?.id ? 'active' : ''}`} onClick={() => openConversation(item.id)} disabled={isGenerating}><div className="conversation-title">{item.title}</div><div className="conversation-date">{new Date(item.updatedAt).toLocaleString()}</div></button>)}
          </div>
        </aside>
        <main className="chat-main">
          <div className="chat-titlebar">{conversation?.title || 'Загрузка...'}</div>
          <div className="settings-strip">
            <GenerationSettings conversation={conversation} onConversationChange={updateConversation} disabled={isGenerating} supported={runtime?.getGenerationCapabilities?.() || DEFAULT_CAPABILITIES} />
            <ExecutionSettings runtime={runtime} disabled={isGenerating} onApply={onApplyExecutionSettings} />
          </div>
          <div className="token-strip" aria-label="Статистика токенов"><strong>Токены</strong><span>Кэш {formatTokenCount(tokenUsage.cached)}</span><span>↑ {formatTokenCount(tokenUsage.input)}</span><span>↓ {formatTokenCount(tokenUsage.output)}</span><span>Всего {formatTokenCount(tokenUsage.total)}</span></div>
          <div className="messages-box">
            {messages.map((msg) => <div key={msg.id} className={`message ${msg.role}`}><div className="sender">{msg.role === 'user' ? 'Вы' : 'privateAI'}</div><div className="text">{msg.content}</div><div className="message-actions">{msg.role === 'user' && <button type="button" onClick={() => handleEditMessage(msg)} disabled={isGenerating}>Изменить</button>}<button type="button" onClick={() => handleDeleteMessage(msg)} disabled={isGenerating}>Удалить</button></div></div>)}
            {currentTokens && <div className="message assistant"><div className="sender">privateAI</div><div className="text">{currentTokens}<span className="cursor">|</span></div></div>}
            <div ref={chatEndRef} />
          </div>
          <div className="debug-panel">{debugInfo}</div>
          <div className="composer-wrap">
            <form onSubmit={handleSend} className="composer">
              {editingMessageId && <div className="composer-editing"><span>Редактирование сообщения</span><button type="button" className="ghost-button" onClick={handleCancelEdit}>Отмена</button></div>}
              <div className="composer-box">
                <textarea rows={1} value={input} onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`; }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder={editingMessageId ? 'Измените сообщение…' : (isGenerating ? 'Модель генерирует ответ…' : 'Сообщение privateAI…')} disabled={isGenerating || !conversation} aria-label="Сообщение" />
                {isGenerating ? <button type="button" className="send-button stop" onClick={handleCancelGeneration} aria-label="Остановить генерацию">■</button> : <button type="submit" className="send-button" disabled={!input.trim() || !conversation} aria-label="Отправить">↑</button>}
              </div>
              <div className="composer-hint">Enter — отправить · Shift + Enter — новая строка · Данные остаются на устройстве</div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
