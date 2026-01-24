import { useState, useEffect, useRef } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [personalityId, setPersonalityId] = useState(1);
  const [personalities, setPersonalities] = useState([]);
  const messagesEndRef = useRef(null);

  // Форматирование времени
  const formatTime = (isoString) => {
    const date = isoString ? new Date(isoString) : new Date();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ЭФФЕКТ 1: Загружаем список личностей ОДИН раз при старте
  useEffect(() => {
    const fetchPersonalities = async () => {
      try {
        const res = await fetch(`${API_URL}/personalities`);
        const data = await res.json();
        setPersonalities(data);
        if (data.length > 0) setPersonalityId(data[0].id);
      } catch (e) {
        console.error("Ошибка загрузки личностей:", e);
      }
    };
    fetchPersonalities();
  }, []);

  // ЭФФЕКТ 2: Загружаем историю КАЖДЫЙ РАЗ, когда меняется персонаж
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        // Мы передаем personality_id как query-параметр
        const res = await fetch(`${API_URL}/messages?personality_id=${personalityId}`);
        const data = await res.json();
        
        const formatted = data.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : msg.role,
          parts: msg.parts,
          theme: msg.visual_hint,
          time: formatTime(msg.time)
        }));
        setMessages(formatted);
      } catch (e) {
        console.error("Ошибка загрузки истории:", e);
      }
    };

    fetchHistory();
  }, [personalityId]); // Следим за сменой ID персонажа

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = { role: 'user', parts: [input], time: formatTime() };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          history: updatedHistory.map(m => ({role: m.role, parts: m.parts})),
          personality_id: personalityId 
        })
      });

      const data = await res.json();
      const aiMsg = { 
        role: 'model', 
        parts: [data.text],      
        theme: data.visual_hint,
        time: formatTime() 
      };

      setMessages([...updatedHistory, aiMsg]);
    } catch (e) {
      console.error("Ошибка чата:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const currentPersona = personalities.find(p => p.id === personalityId);

  return (
    <div className="chat-container">
      <header>
        <div className="logo">
          <h1>Vibe Buddy</h1>
          {/* Твой зеленый огонек вернулся! */}
          <span className="status-dot"></span>
        </div>

        <div className="personality-selector">
          {personalities.map((p) => (
            <button 
              key={p.id}
              className={personalityId === p.id ? 'active' : ''} 
              onClick={() => setPersonalityId(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>

        <button onClick={() => setMessages([])} className="reset-btn">Clear UI</button>
      </header>

      <div className="messages-list">
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`message-bubble ${msg.role === 'user' ? 'user' : 'ai'}`}
            style={msg.role === 'model' ? { borderLeft: `4px solid ${msg.theme || '#ccc'}` } : {}}
          >
            <div className="text-content">{msg.parts[0]}</div>
            <div className="message-footer">
              <span className="message-time">{msg.time}</span>
            </div>
          </div>
        ))}
        {isLoading && <div className="message-bubble ai loading">...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder={`Напиши ${currentPersona?.name || 'другу'}...`}
        />
        <button className="send-btn" onClick={sendMessage} disabled={isLoading}>🚀</button>
      </div>
    </div>
  );
}

export default App;