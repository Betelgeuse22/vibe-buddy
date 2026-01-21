 // npm run dev
 // http://localhost:5173

import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Создаем "маячок" (референс) для конца списка
  const messagesEndRef = useRef(null);

  // 2. Функция, которая заставляет браузер прокрутить к "маячку"
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 3. Следим за массивом messages: как только он меняется, скроллим вниз
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]); // Скроллим и когда пришло сообщение, и когда бот начал "думать"

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = { role: 'user', parts: [input] };
    const updatedHistory = [...messages, userMsg];
    
    setMessages(updatedHistory);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('https://vibe-buddy.onrender.com/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedHistory)
      });

      const data = await res.json();
      const aiMsg = { role: 'model', parts: [data.ai_response] };
      setMessages([...updatedHistory, aiMsg]);
    } catch (error) {
      console.error("Ошибка:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <header>
        <h1>Vibe Buddy ✨</h1>
        <button onClick={() => setMessages([])} className="reset-btn">Сброс</button>
      </header>

      <div className="messages-list">
        {messages.map((msg, index) => (
          <div key={index} className={`message-bubble ${msg.role === 'user' ? 'user' : 'ai'}`}>
            {msg.parts[0]}
          </div>
        ))}
        
        {/* Индикатор загрузки тоже должен быть внутри списка */}
        {isLoading && (
          <div className="message-bubble ai loading">
            <span className="dot">.</span><span className="dot">.</span><span className="dot">.</span>
          </div>
        )}

        {/* 4. Тот самый "невидимый маячок" в самом низу */}
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