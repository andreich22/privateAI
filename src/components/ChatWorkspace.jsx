import React, { useEffect, useRef, useState } from 'react';

export default function ChatWorkspace({ runtime, fileName, onUnload }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTokens, setCurrentTokens] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const generationRef = useRef(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTokens]);

  const appendDebug = (text) => {
    setDebugInfo((prev) => `${prev}\n[${new Date().toLocaleTimeString()}] ${text}`.slice(-8000));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || generationRef.current || !runtime.isLoaded()) return;

    const userText = input.trim();
    setInput('');
    setIsGenerating(true);
    generationRef.current = true;
    setCurrentTokens('');
    appendDebug(`USER: ${userText}`);

    const nextMessages = [...messages, { role: 'user', content: userText }];
    setMessages(nextMessages);

    let fullAssistantText = '';
    try {
      await runtime.streamChat(nextMessages, (token) => {
        fullAssistantText += token;
        setCurrentTokens(fullAssistantText);
      });

      appendDebug(`DONE: ${fullAssistantText}`);
      setMessages((prev) => [...prev, { role: 'assistant', content: fullAssistantText }]);
    } catch (err) {
      appendDebug(`CHAT ERROR: ${err.message}`);
      setMessages((prev) => [...prev, { role: 'assistant', content: `[Ошибка чата: ${err.message}]` }]);
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
        <button onClick={handleUnload} className="btn-danger" disabled={isGenerating}>Выгрузить</button>
      </header>
      <div className="messages-box">
        {messages.map((msg, idx) => (
          <div key={`${msg.role}-${idx}`} className={`message ${msg.role}`}>
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
          disabled={isGenerating}
        />
        <button type="submit" disabled={isGenerating || !input.trim()}>Отправить</button>
      </form>
    </div>
  );
}
