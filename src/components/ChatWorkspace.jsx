import React, { useState, useRef, useEffect } from 'react';
import { streamChat, getChatHistory, simpleCompletion, addMessageToHistory } from '../services/aiService';

export default function ChatWorkspace({ fileName, onUnload }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTokens, setCurrentTokens] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTokens]);

  const appendDebug = (text) => {
    setDebugInfo(prev => prev + '\n[' + new Date().toLocaleTimeString() + '] ' + text);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userText = input.trim();
    setInput('');
    setIsGenerating(true);
    setCurrentTokens('');
    appendDebug('USER: ' + userText);

    addMessageToHistory('user', userText);
    setMessages(prev => [...prev, { role: 'user', text: userText }]);

    const fullAssistantText = useRef('');
    fullAssistantText.current = '';

    try {
      // Try chat completion first
      await streamChat(getChatHistory(), (token) => {
        fullAssistantText.current += token;
        setCurrentTokens(fullAssistantText.current);
      });

      appendDebug('DONE: ' + fullAssistantText.current);
      addMessageToHistory('assistant', fullAssistantText.current);
      setMessages(prev => [...prev, { role: 'assistant', text: fullAssistantText.current }]);
    } catch (err) {
      appendDebug('CHAT ERROR: ' + err.message);
      setMessages(prev => [...prev, { role: 'assistant', text: '[Ошибка чата: ' + err.message + ']' }]);

      // Try raw completion as fallback
      try {
        appendDebug('TRYING RAW COMPLETION...');
        const rawText = await rawGenerate(userText);
        appendDebug('RAW DONE: ' + rawText);
        addMessageToHistory('assistant', rawText);
        setMessages(prev => [...prev, { role: 'assistant', text: rawText }]);
      } catch (err2) {
        appendDebug('RAW ERROR: ' + err2.message);
        setMessages(prev => [...prev, { role: 'assistant', text: '[Ошибка: ' + err2.message + ']' }]);
      }
    } finally {
      setIsGenerating(false);
      setCurrentTokens('');
    }
  };

  async function rawGenerate(prompt) {
    let fullText = '';
    await simpleCompletion(prompt, (token) => {
      fullText += token;
      setCurrentTokens(fullText);
      appendDebug('RAW TOKEN: ' + token);
    });
    return fullText;
  }

  return (
    <div className="chat-container">
      <header>
        <span>Модель: <strong>{fileName.split('/').pop()}</strong></span>
        <button onClick={onUnload} className="btn-danger">Выгрузить</button>
      </header>
      <div className="messages-box">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="sender">{msg.role === 'user' ? 'Вы' : 'ИИ'}</div>
            <div className="text">{msg.text}</div>
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
          onChange={e => setInput(e.target.value)} 
          placeholder={isGenerating ? "Генерация..." : "1+1 = ?"} 
          disabled={isGenerating}
        />
        <button type="submit" disabled={isGenerating || !input.trim()}>Отправить</button>
      </form>
    </div>
  );
}
