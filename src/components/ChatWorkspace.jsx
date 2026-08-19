import React, { useState, useRef, useEffect, useCallback } from 'react';
import { streamChat, addMessageToHistory, getChatHistory } from '../services/aiService';

export default function ChatWorkspace({ fileName, onUnload }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTokens, setCurrentTokens] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTokens]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userText = input.trim();
    setInput('');
    setIsGenerating(true);
    setCurrentTokens('');

    addMessageToHistory('user', userText);
    setMessages(prev => [...prev, { role: 'user', text: userText }]);

    const fullAssistantText = useRef('');
    fullAssistantText.current = '';

    try {
      await streamChat(getChatHistory(), (token) => {
        fullAssistantText.current += token;
        setCurrentTokens(fullAssistantText.current);
      });

      addMessageToHistory('assistant', fullAssistantText.current);
      setMessages(prev => [...prev, { role: 'assistant', text: fullAssistantText.current }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', text: '[Ошибка генерации]' }]);
    } finally {
      setIsGenerating(false);
      setCurrentTokens('');
    }
  };

  return (
    <div className="chat-container">
      <header>
        <span>Активная модель: <strong>{fileName}</strong></span>
        <button onClick={onUnload} className="btn-danger">Выгрузить модель</button>
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
      <form onSubmit={handleSend} className="input-form">
        <input 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          placeholder={isGenerating ? "ИИ генерирует ответ..." : "Введите сообщение..."} 
          disabled={isGenerating}
        />
        <button type="submit" disabled={isGenerating || !input.trim()}>Отправить</button>
      </form>
    </div>
  );
}
