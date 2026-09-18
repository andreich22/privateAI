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
    return (
    <div className="chat-container">
      <header className="chat-header">
        <div className="brand">
          <div className="brand-mark">P</div>
          <div className="brand-copy">
            <div className="brand-name">privateAI</div>
            <div className="model-name" title={fileName}>Локально · {fileName?.split('/').pop()}</div>
          </div>
        </div>
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
            {conversations.map((item) => (
              <button
                key={item.id}
                className={`conversation-item ${item.id === conversation?.id ? 'active' : ''}`}
                onClick={() => openConversation(item.id)}
                disabled={isGenerating}
              >
                <div className="conversation-title">{item.title}</div>
                <div className="conversation-date">{new Date(item.updatedAt).toLocaleString()}</div>
              </button>
            ))}
          </div>
        </aside>

        <main className="chat-main">
          <div className="chat-titlebar">{conversation?.title || 'Загрузка...'}</div>

          <div className="settings-strip">
            <GenerationSettings
              conversation={conversation}
              onConversationChange={updateConversation}
              disabled={isGenerating}
              supported={runtime?.getGenerationCapabilities?.() || DEFAULT_CAPABILITIES}
            />
            <ExecutionSettings
              runtime={runtime}
              disabled={isGenerating}
              onApply={onApplyExecutionSettings}
            />
          </div>

          <div className="token-strip" aria-label="Статистика токенов">
            <strong>Токены</strong>
            <span>Кэш {formatTokenCount(tokenUsage.cached)}</span>
            <span>↑ {formatTokenCount(tokenUsage.input)}</span>
            <span>↓ {formatTokenCount(tokenUsage.output)}</span>
            <span>Всего {formatTokenCount(tokenUsage.total)}</span>
          </div>

          <div className="messages-box">
            {messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className="sender">{msg.role === 'user' ? 'Вы' : 'privateAI'}</div>
                <div className="text">{msg.content}</div>
                <div className="message-actions">
                  {msg.role === 'user' && (
                    <button type="button" onClick={() => handleEditMessage(msg)} disabled={isGenerating}>Изменить</button>
                  )}
                  <button type="button" onClick={() => handleDeleteMessage(msg)} disabled={isGenerating}>Удалить</button>
                </div>
              </div>
            ))}

            {currentTokens && (
              <div className="message assistant">
                <div className="sender">privateAI</div>
                <div className="text">{currentTokens}<span className="cursor">|</span></div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="debug-panel">{debugInfo}</div>

          <div className="composer-wrap">
            <form onSubmit={handleSend} className="composer">
              {editingMessageId && (
                <div className="composer-editing">
                  <span>Редактирование сообщения</span>
                  <button type="button" className="ghost-button" onClick={handleCancelEdit}>Отмена</button>
                </div>
              )}
              <div className="composer-box">
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder={editingMessageId ? 'Измените сообщение…' : (isGenerating ? 'Модель генерирует ответ…' : 'Сообщение privateAI…')}
                  disabled={isGenerating || !conversation}
                  aria-label="Сообщение"
                />
                {isGenerating ? (
                  <button type="button" className="send-button stop" onClick={handleCancelGeneration} aria-label="Остановить генерацию">■</button>
                ) : (
                  <button type="submit" className="send-button" disabled={!input.trim() || !conversation} aria-label="Отправить">↑</button>
                )}
              </div>
              <div className="composer-hint">Enter — отправить · Shift + Enter — новая строка · Данные остаются на устройстве</div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
}
