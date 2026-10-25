import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import UserError from './UserError';

const DEFAULT_CAPABILITIES = { temperature: true, top_p: true, max_tokens: true };
const EMPTY_TOKEN_USAGE = { cached: null, input: null, output: null, total: null };

function formatTokenCount(value, language) {
  return value === null || value === undefined ? '—' : value.toLocaleString(language);
}

export default function ChatWorkspace({ runtime, fileName, onUnload, onApplyExecutionSettings, onSelectModel, onLoadFromHF, modelError }) {
  const { t, i18n } = useTranslation();
  const [conversation, setConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [input, setInput] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTokens, setCurrentTokens] = useState('');
  const [tokenUsage, setTokenUsage] = useState(EMPTY_TOKEN_USAGE);
  const [debugInfo, setDebugInfo] = useState('');
  const [sendNotice, setSendNotice] = useState('');
  const generationRef = useRef(false);
  const partialResponseRef = useRef('');
  const chatEndRef = useRef(null);

  const messages = conversation?.messages || [];
  const modelReady = Boolean(runtime?.isLoaded?.());
  const modelShortName = fileName?.split('/').pop() || '';

  useEffect(() => {
    if (modelReady) setSendNotice('');
  }, [modelReady]);

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
    setDebugInfo((prev) => `${prev}\n[${new Date().toLocaleTimeString(i18n.language)}] ${text}`.slice(-8000));
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
    const title = window.prompt(t('chat.renamePrompt'), conversation.title);
    if (title === null) return;
    const updated = await renameConversation(conversation.id, title);
    if (updated) {
      setConversation((prev) => ({ ...prev, ...updated }));
      await refreshConversations();
    }
  };

  const handleDelete = async () => {
    if (!conversation || generationRef.current) return;
    if (!window.confirm(t('chat.deleteConversationConfirm', { title: conversation.title }))) return;
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
    if (!window.confirm(t('chat.deleteMessageConfirm'))) return;
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
    if (!input.trim() || generationRef.current || !conversation) return;
    if (!modelReady) {
      setSendNotice(t('chat.sendWithoutModel'));
      return;
    }
    setSendNotice('');

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
        const errorMessage = { id: crypto.randomUUID(), role: 'assistant', content: t('chat.generationFailed'), createdAt: Date.now() };
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
        <div className="brand"><div className="brand-mark">P</div><div className="brand-copy"><div className="brand-name">privateAI</div><div className="model-name" title={fileName || t('chat.modelNotSelected')}>{modelReady ? `${t('chat.local')} · ${modelShortName}` : fileName ? `${t('chat.notLoaded')} · ${modelShortName}` : t('chat.modelNotSelected')}</div></div></div>
        <div className="header-actions">
          <button className="ghost-button" onClick={handleRename} disabled={isGenerating || !conversation}>{t('chat.rename')}</button>
          <button className="ghost-button" onClick={handleDelete} disabled={isGenerating || !conversation}>{t('chat.delete')}</button>
          <button className="danger-button" onClick={handleUnload} disabled={isGenerating || !modelReady}>{t('chat.unload')}</button>
        </div>
      </header>
      <div className="chat-shell">
        <aside className="chat-sidebar">
          <button className="new-chat" onClick={handleNewChat} disabled={isGenerating}>{t('chat.newChat')}</button>
          <div className="sidebar-label">{t('chat.yourChats')}</div>
          <div className="conversation-list">
            {conversations.map((item) => <button key={item.id} className={`conversation-item ${item.id === conversation?.id ? 'active' : ''}`} onClick={() => openConversation(item.id)} disabled={isGenerating}><div className="conversation-title">{item.title}</div><div className="conversation-date">{new Date(item.updatedAt).toLocaleString(i18n.language)}</div></button>)}
          </div>
        </aside>
        <main className="chat-main">
          <div className="chat-titlebar">{conversation?.title || t('chat.loading')}</div>
          <div className="token-strip" aria-label={t('chat.tokenStats')}><strong>{t('chat.tokens')}</strong><span>{t('chat.cache')} {formatTokenCount(tokenUsage.cached, i18n.language)}</span><span>↑ {formatTokenCount(tokenUsage.input, i18n.language)}</span><span>↓ {formatTokenCount(tokenUsage.output, i18n.language)}</span><span>{t('chat.total')} {formatTokenCount(tokenUsage.total, i18n.language)}</span></div>
          {!modelReady && (
            <div className="model-missing-banner" role="status">
              <div className="model-missing-copy">
                <strong>{fileName ? t('chat.modelNotLoaded') : t('chat.modelNotSelected')}</strong>
                <span>{fileName ? t('chat.modelNotLoadedDetail', { name: modelShortName }) : t('chat.chooseModelDetail')}</span>
                <UserError error={modelError} className="model-missing-error" />
              </div>
              <div className="model-missing-actions">
                {onSelectModel && <button type="button" className="btn-sub" onClick={onSelectModel}>{t('common.chooseGguf')}</button>}
                {onLoadFromHF && <button type="button" className="btn-sub" onClick={onLoadFromHF}>{t('common.downloadModel')}</button>}
              </div>
            </div>
          )}
          <div className="messages-box">
            {messages.map((msg) => <div key={msg.id} className={`message ${msg.role}`}><div className="sender">{msg.role === 'user' ? t('chat.user') : 'privateAI'}</div><div className="text">{msg.content}</div><div className="message-actions">{msg.role === 'user' && <button type="button" onClick={() => handleEditMessage(msg)} disabled={isGenerating}>{t('chat.edit')}</button>}<button type="button" onClick={() => handleDeleteMessage(msg)} disabled={isGenerating}>{t('chat.messageDelete')}</button></div></div>)}
            {currentTokens && <div className="message assistant"><div className="sender">privateAI</div><div className="text">{currentTokens}<span className="cursor">|</span></div></div>}
            <div ref={chatEndRef} />
          </div>
          <div className="debug-panel">{debugInfo}</div>
          <div className="composer-wrap">
            <form onSubmit={handleSend} className="composer">
              {editingMessageId && <div className="composer-editing"><span>{t('chat.editing')}</span><button type="button" className="ghost-button" onClick={handleCancelEdit}>{t('chat.cancelEdit')}</button></div>}
              {sendNotice && <div className="composer-notice" role="alert">{sendNotice}</div>}
              <div className="composer-box">
                <textarea rows={1} value={input} onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`; }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder={editingMessageId ? t('chat.editPlaceholder') : (isGenerating ? t('chat.generatingPlaceholder') : t('chat.messagePlaceholder'))} disabled={isGenerating || !conversation} aria-label={t('chat.messageLabel')} />
                {isGenerating ? <button type="button" className="send-button stop" onClick={handleCancelGeneration} aria-label={t('chat.stopGeneration')}>■</button> : <button type="submit" className="send-button" disabled={!input.trim() || !conversation} aria-label={t('chat.send')}>↑</button>}
              </div>
              <div className="composer-hint">{modelReady ? t('chat.composerHintReady') : t('chat.composerHintNoModel')}</div>
            </form>
          </div>
        </main>
        <aside className="settings-sidebar" aria-label={t('chat.settings')}>
          <div className="settings-sidebar-header">
            <div className="settings-sidebar-title">{t('chat.settings')}</div>
            <div className="settings-sidebar-subtitle">{t('chat.settingsDescription')}</div>
          </div>
          <div className="settings-sidebar-content">
            <GenerationSettings conversation={conversation} onConversationChange={updateConversation} disabled={isGenerating} supported={runtime?.getGenerationCapabilities?.() || DEFAULT_CAPABILITIES} />
            <ExecutionSettings runtime={runtime} disabled={isGenerating} onApply={onApplyExecutionSettings} />
          </div>
        </aside>
      </div>
    </div>
  )
};