import { useState, useEffect, useRef } from 'react'
import './App.css'

// URL твоего бэкенда (берется из .env файла)
const API_URL = import.meta.env.VITE_API_URL;

function App() {
  // --- СОСТОЯНИЯ (STATES) ---
  const [input, setInput] = useState('');           // Текст, который ты сейчас пишешь в инпуте
  const [messages, setMessages] = useState([]);     // Массив всех сообщений в текущем чате
  const [isLoading, setIsLoading] = useState(false); // Правда, если мы ждем ответа от ИИ (для лоадера)
  const [personalityId, setPersonalityId] = useState(1); // ID выбранного персонажа (1 - Макс, 2 - Алиса)
  const [personalities, setPersonalities] = useState([]); // Список всех доступных персонажей из базы
  const [isInitialLoading, setIsInitialLoading] = useState(true); // Правда только при самой первой загрузке (нужно для "будильника" Render)

  // --- ССЫЛКИ (REFS) ---
  const messagesEndRef = useRef(null); // "Якорь" в конце списка сообщений для авто-скролла

  // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (UTILS) ---

  // Превращает непонятную дату из БД в красивые "12:30"
  const formatTime = (isoString) => {
    // Если isoString пустой (новое сообщение), берем текущее время
    const date = isoString ? new Date(isoString) : new Date();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Плавно прокручивает чат к самому последнему сообщению
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // --- ЭФФЕКТЫ (EFFECTS) ---

  // ЭФФЕКТ 1: Срабатывает ОДИН РАЗ при открытии сайта.
  // Его задача — разбудить бэкенд и получить список имен (Макс, Алиса...).
  useEffect(() => {
    const initApp = async () => {
      setIsInitialLoading(true);
      try {
        const res = await fetch(`${API_URL}/personalities`);
        const data = await res.json();
        setPersonalities(data);
        
        // Если база не пуста, автоматически выбираем первого персонажа
        if (data.length > 0) {
          setPersonalityId(data[0].id);
        }
      } catch (e) {
        console.error("Ошибка пробуждения:", e);
      } finally {
        setIsInitialLoading(false); // Убираем надпись "Пробуждаю друзей"
      }
    };
    initApp();
  }, []); 


  // ЭФФЕКТ 2: Срабатывает каждый раз, когда меняется личность (клик по кнопке).
  // Его задача — подтянуть историю переписки именно для этого персонажа.
  useEffect(() => {
    const fetchHistory = async () => {
      // Не идем в базу, пока приложение еще грузится или не выбран ID
      if (isInitialLoading || !personalityId) return;

      try {
        const res = await fetch(`${API_URL}/messages?personality_id=${personalityId}`);
        const data = await res.json();
        
        // Превращаем формат БД в формат понятный для нашего UI
        const formatted = data.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : msg.role,
          parts: msg.parts,
          theme: msg.theme, // Цвет границы (визуальный стиль)
          time: formatTime(msg.time)
        }));
        setMessages(formatted);
      } catch (e) {
        console.error("Ошибка загрузки истории:", e);
      }
    };

    fetchHistory();
  }, [personalityId, isInitialLoading]);


  // ЭФФЕКТ 3: Следит за списком сообщений.
  // Как только пришло новое сообщение — прокручивает экран вниз.
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);


  // --- ГЛАВНАЯ ЛОГИКА (HANDLERS) ---

  // Функция отправки сообщения
  const sendMessage = async () => {
    if (!input.trim()) return; // Не отправляем пустоту

    // 1. Сразу добавляем сообщение юзера на экран
    const userMsg = { role: 'user', parts: [input], time: formatTime() };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput(''); // Очищаем поле ввода
    setIsLoading(true); // Включаем "..." анимацию

    try {
      // 2. Стучимся к ИИ на бэкенд
      const res = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          history: updatedHistory.map(m => ({role: m.role, parts: m.parts})),
          personality_id: personalityId 
        })
      });

      const data = await res.json();
      
      // 3. Добавляем ответ ИИ на экран
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
      setIsLoading(false); // Выключаем "..."
    }
  };

  // Ищем объект текущего персонажа в общем списке по его ID
  const currentPersona = personalities.find(p => p.id === personalityId);

  // --- ОТРИСОВКА (RENDER) ---
  return (
    <div className="chat-container">
      {/* Шапка приложения */}
      <header>
        <div className="logo">
          <h1>Vibe Buddy</h1>
          <span className="status-dot"></span>
        </div>

        {/* Секция выбора персонажа */}
        <div className="personality-selector">
          {isInitialLoading ? (
            <span className="loading-text">Пробуждаю друзей... 💤</span>
          ) : (
            personalities.map((p) => (
              <button 
                key={p.id}
                className={personalityId === p.id ? 'active' : ''} 
                onClick={() => setPersonalityId(p.id)}
              >
                {p.name}
              </button>
            ))
          )}
        </div>

        <button onClick={() => setMessages([])} className="reset-btn">Clear UI</button>
      </header>

      {/* Список сообщений (окно чата) */}
      <div className="messages-list">
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`message-bubble ${msg.role === 'user' ? 'user' : 'ai'}`}
            // Сообщению ИИ красим левую границу в цвет темы персонажа
            style={msg.role === 'model' ? { borderLeft: `4px solid ${msg.theme || '#ccc'}` } : {}}
          >
            <div className="text-content">{msg.parts[0]}</div>
            <div className="message-footer">
              <span className="message-time">{msg.time}</span>
            </div>
          </div>
        ))}
        {/* Индикатор того, что ИИ "думает" */}
        {isLoading && <div className="message-bubble ai loading">...</div>}
        {/* Пустой див, к которому мы всегда скроллимся */}
        <div ref={messagesEndRef} />
      </div>

      {/* Зона ввода сообщения */}
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