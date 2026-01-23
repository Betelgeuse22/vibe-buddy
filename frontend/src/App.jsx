 // npm run dev
 // http://localhost:5173

import { useState, useEffect, useRef } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Вспомогательная функция для получения времени
  const getCurrentTime = () => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    // 1. Создаем сообщение пользователя с меткой времени
    const userMsg = { 
      role: 'user', 
      parts: [input],
      time: getCurrentTime()
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput('');
    setIsLoading(true);

    // 2. Очистка данных для API (бэкенд ждет только role и parts)
    const cleanHistory = updatedHistory.map(msg => ({
      role: msg.role,
      parts: msg.parts
    }));

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: cleanHistory })
      });

      if (!res.ok) throw new Error('Ошибка сервера');

      const data = await res.json();
      
      // 3. Создаем сообщение бота
      // Мы сохраняем emotion и theme для будущей БД и текущего цвета,
      // но на экран будем выводить только время.
      const aiMsg = { 
        role: 'model', 
        parts: [data.text],      
        emotion: data.emotion,    
        theme: data.visual_hint,
        time: getCurrentTime()
      };

      setMessages([...updatedHistory, aiMsg]);
    } catch (error) {
      console.error("Ошибка:", error);
      const errorMsg = { 
        role: 'model', 
        parts: ["Бро, что-то связь барахлит..."], 
        time: getCurrentTime(),
        theme: "#ff4d4f" 
      };
      setMessages([...updatedHistory, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <header>
        <div className="logo">
          <h1>Vibe Buddy</h1>
          <span className="status-dot"></span>
        </div>
        <button onClick={() => setMessages([])} className="reset-btn">Сброс</button>
      </header>

      <div className="messages-list">
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`message-bubble ${msg.role === 'user' ? 'user' : 'ai'}`}
            // Используем theme для окраски левой границы сообщения бота
            style={msg.role === 'model' ? { borderLeft: `4px solid ${msg.theme || '#ccc'}` } : {}}
          >
            <div className="text-content">
              {msg.parts[0]}
            </div>
            
            {/* Вместо текста эмоции теперь всегда выводим время */}
            <div className="message-footer">
              <span className="message-time">{msg.time}</span>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="message-bubble ai loading">
            <span className="dot">.</span><span className="dot">.</span><span className="dot">.</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Напиши своему бро..."
        />
        <button className="send-btn" onClick={sendMessage} disabled={isLoading}>
          {isLoading ? '⏳' : '🚀'}
        </button>
      </div>
    </div>
  );
}

export default App;