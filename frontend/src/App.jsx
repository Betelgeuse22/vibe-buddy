import { useState, useEffect, useRef } from 'react'
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogIn, UserPlus, Trash2, Users, SendHorizonal, Plus } from 'lucide-react';
import './App.css'

const API_URL = import.meta.env.VITE_API_URL; 

// --- КОМПОНЕНТ SIDEBAR (Вынесен отдельно для чистоты) ---
const Sidebar = ({ isOpen, onClose, personalities, currentId, onSelect, onAdd, onClear }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            className="sidebar-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div 
            className="sidebar"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="sidebar-header">
              <div className="sidebar-profile">
                <div className="profile-avatar">G</div>
                <div className="profile-info">
                  <span className="profile-name">Гость</span>
                  <button className="auth-btn"><LogIn size={14} /> Войти</button>
                </div>
              </div>
              <button className="menu-trigger-btn" onClick={onClose}>
                <X size={24} color="white" />
              </button>
            </div>

            <div className="sidebar-content">
              <div className="sidebar-section">
                <p className="sidebar-section-title"><Users size={14} /> Твои друзья</p>
                <div className="personality-list">
                  {personalities.map((p) => (
                    <button 
                      key={p.id} 
                      className={`personality-item ${p.id === currentId ? 'active' : ''}`}
                      onClick={() => { onSelect(p.id); onClose(); }}
                    >
                      <span className="persona-emoji">{p.avatar_url || '👤'}</span>
                      <span className="persona-name">{p.name}</span>
                      {p.id === currentId && <div className="active-indicator" />}
                    </button>
                  ))}
                </div>
              </div>

              <button className="add-friend-btn" onClick={onAdd}>
                <Plus size={20} />
                <span>Создать друга</span>
              </button>
            </div>

            <div className="sidebar-footer">
              <button className="sidebar-btn danger" onClick={onClear}>
                <Trash2 size={18} />
                <span>Очистить историю</span>
              </button>
              <div className="app-version">Vibe Buddy v1.2</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// --- ОСНОВНОЙ КОМПОНЕНТ APP ---
function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [personalityId, setPersonalityId] = useState(null); 
  const [personalities, setPersonalities] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false); 

  const messagesEndRef = useRef(null);

  const formatTime = (isoString) => {
    const date = isoString ? new Date(isoString) : new Date();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const scrollToBottom = () => {
  const el = messagesEndRef.current;
  if (el) {
    el.parentElement.scrollTop = el.parentElement.scrollHeight;
  }
};

  useEffect(() => {
    const initApp = async () => {
      setIsInitialLoading(true);
      const wakeUpServer = async () => {
        try {
          const response = await fetch(`${API_URL}/ping`);
          return response.ok;
        } catch { return false; }
      };

      let isAwake = false;
      while (!isAwake) {
        isAwake = await wakeUpServer();
        if (!isAwake) await new Promise(res => setTimeout(res, 3000));
      }

      try {
        const res = await fetch(`${API_URL}/personalities`);
        const data = await res.json();
        setPersonalities(data);
        if (data.length > 0) setPersonalityId(data[0].id);
      } catch (e) { console.error("Ошибка загрузки:", e); }
      finally { setIsInitialLoading(false); }
    };
    initApp();
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      if (isInitialLoading || !personalityId) return;
      try {
        const res = await fetch(`${API_URL}/messages?personality_id=${personalityId}`);
        const data = await res.json();
        const formatted = data.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : msg.role,
          parts: msg.parts,
          theme: msg.theme,
          time: formatTime(msg.time)
        }));
        setMessages(formatted);
      } catch (e) { console.error("Ошибка истории:", e); }
    };
    fetchHistory();
  }, [personalityId, isInitialLoading]);

  useEffect(() => { scrollToBottom(); }, [messages, isLoading]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
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
      setMessages([...updatedHistory, { 
        role: 'model', 
        parts: [data.text],      
        theme: data.visual_hint,
        time: formatTime() 
      }]);
    } catch (e) { console.error("Ошибка чата:", e); }
    finally { setIsLoading(false); }
  };

  const handleClearUI = () => {
    setMessages([]);
    setIsMenuOpen(false);
  };

  const currentPersona = personalities.find(p => p.id === personalityId);

  return (
    <div className="chat-container">
      <header>
  <div className="header-left">
    <div className="pulse-dot" title="В сети"></div>
  </div>
  
  {/* Исправил опечатку: было heread-center -> стало header-center */}
  <div className="header-center">
    <h1 className="header-title">
      {isInitialLoading ? 'Загрузка...' : (currentPersona?.name || 'Vibe Buddy')}
    </h1>
  </div>
  
  <div className="header-right">
    <button className="menu-trigger-btn" onClick={() => setIsMenuOpen(true)}>
      <Menu size={24} />
    </button>
  </div>
</header>
      <div className="messages-list">
        {messages.length === 0 && !isLoading && (
          <div className="empty-chat-hint">Начни общение с {currentPersona?.name || 'ИИ'}</div>
        )}
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`message-bubble ${msg.role === 'user' ? 'user' : 'ai'}`}
            style={msg.role === 'model' ? { borderLeft: `4px solid ${msg.theme || '#e5e5ea'}` } : {}}
          >
            <div className="text-content">{msg.parts[0]}</div>
            <div className="message-footer"><span className="message-time">{msg.time}</span></div>
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
          placeholder={isInitialLoading ? "Пробуждаю сервер..." : `Напиши ${currentPersona?.name || ''}...`}
          disabled={isInitialLoading}
        />
        <button className="send-btn" onClick={sendMessage} disabled={isLoading || isInitialLoading}>
          <SendHorizonal size={20} />
        </button>
      </div>
       {/* --- ИСПОЛЬЗУЕМ ВЫНЕСЕННЫЙ КОМПОНЕНТ SIDEBAR --- */}
      <Sidebar 
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        personalities={personalities}
        currentId={personalityId}
        onSelect={(id) => setPersonalityId(id)}
        onAdd={() => alert("Тут будет создание персонажа!")}
        onClear={handleClearUI}
      />
    </div>
  );
}

export default App;