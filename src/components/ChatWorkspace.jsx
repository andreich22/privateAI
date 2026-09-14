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

export default function ChatWorkspace({ runtime, fileName, onUnload }) {
  const [conversation, setConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTokens, setCurrentTokens] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const generationRef = useRef(false);
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

  const refreshConversations = async () => {
    setConversations(await listConversations());
  };

  const openConversation = async (id) => {
    if (generationRef.current || id === conversation?.id) return;
    const next = await getConversation(id);
    if (next) {
      setConversation(next);
      await saveConversation(next);
      await refreshConversations();
      setCurrentTokens('');
    }
  };

  const handleNewChat = async () => {
    if (generationRef.current) return;
    const next = await createConversation();
    setConversation(next);
    await refreshConversations();
    setCurrentTokens('');
    setInput('');
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
    setInput('');
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || generationRef.current || !runtime.isLoaded() || !conversation) return;

    const userText = input.trim();
    setInput('');
    setIsGenerating(true);
    generationRef.current = true;
    setCurrentTokens('');
    appendDebug(`USER: ${userText}`);

    const userMessage = { id: crypto.randomUUID(), role: 'user', content: userText, createdAt: Date.now() };
    const nextMessages = [...messages, userMessage];
    const pending = { ...conversation, messages: nextMessages };
    setConversation(pending);
    await saveConversation(pending);
    await refreshConversations();

    let fullAssistantText = '';
    try {
      await runtime.streamChat(nextMessages.map(({ role, content }) => ({ role, content })), (token) => {
        fullAssistantText += token;
        setCurrentTokens(fullAssistantText);
      });

      appendDebug(`DONE: ${fullAssistantText}`);
      const assistantMessage = { id: crypto.randomUUID(), role: 'assistant', content: fullAssistantText, createdAt: Date.now() };
      const completed = { ...pending, messages: [...nextMessages, assistantMessage] };
      setConversation(completed);
      await saveConversation(completed);
      await refreshConversations();
    } catch (err) {
      appendDebug(`CHAT ERROR: ${err.message}`);
      const errorMessage = { id: crypto.randomUUID(), role: 'assistant', content: `[Ошибка чата: ${err.message}]`, createdAt: Date.now() };
      const failed = { ...pending, messages: [...nextMessages, errorMessage] };
      setConversation(failed);
      await saveConversation(failed);
      await refreshConversations();
    } finally {
      generationRef.current = false;
      setIsGenerating(false);
      setCurrentTokens('');
    }
  };

  const handleUnload = async () => {
    if (generationRef.current) return;
    await onUnload();
  };

  return (
    <div className="chat-container">
      <header>
        <span>Модель: <strong>{fileName.split('/').pop()}</strong></span>
        <span style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleNewChat} disabled={isGenerating}>Новый чат</button>
          <button onClick={handleRename} disabled={isGenerating || !conversation}>Переименовать</button>
          <button onClick={handleDelete} disabled={isGenerating || !conversation}>Удалить</button>
          <button onClick={handleUnload} className="btn-danger" disabled={isGenerating}>Выгрузить</button>
        </span>
      </header>

      <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
        <aside style={{ width: 240, borderRight: '1px solid #333', overflowY: 'auto', padding: 8 }}>
          <div style={{ padding: '6px 8px', fontSize: 12, color: '#888' }}>История чатов</div>
          {conversations.map((item) => (
            <button
              key={item.id}
              onClick={() => openConversation(item.id)}
              disabled={isGenerating}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '9px 8px', marginBottom: 4,
                background: item.id === conversation?.id ? '#252525' : 'transparent', color: 'inherit',
                border: '1px solid #333', borderRadius: 6, cursor: isGenerating ? 'default' : 'pointer',
              }}
            >
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
              <small style={{ color: '#777' }}>{new Date(item.updatedAt).toLocaleString()}</small>
            </button>
          ))}
        </aside>

        <main style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <div style={{ padding: '8px 15px', borderBottom: '1px solid #333', color: '#aaa' }}>
            <strong>{conversation?.title || 'Загрузка...'}</strong>
          </div>
          <div className="messages-box">
            {messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className="sender">{msg.role === 'user' ? 'Вы' : 'ИИ'}</div>
                <div className="text">{msg.content}</div>
              </div>
            ))}
            {currentTokens && (
              <div className="message assistant">
                <div className="sender">ИИ</div>
                <div className="text">{currentTokens}<span className="cursor">|</span></div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div style={{ maxHeight: 120, overflow: 'auto', padding: '0 15px', background: '#0d0d0d', fontFamily: 'monospace', fontSize: 11, color: '#888', whiteSpace: 'pre-wrap' }}>
            {debugInfo}
          </div>
          <form onSubmit={handleSend} className="input-form">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isGenerating ? 'Генерация...' : '1+1 = ?'}
              disabled={isGenerating || !conversation}
            />
            <button type="submit" disabled={isGenerating || !input.trim() || !conversation}>Отправить</button>
          </form>
        </main>
      </div>
    </div>
  );
}
