import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Menu, SendHorizonal, Loader2 } from "lucide-react";
import Sidebar from "./Sidebar";
import CharacterLab from "./CharacterLab";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [personalityId, setPersonalityId] = useState(null);
  const [personalities, setPersonalities] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLabOpen, setIsLabOpen] = useState(false);

  const handleNewCharacter = (newChar) => {
    setPersonalities((prev) => [...prev, newChar]);
  };

  const messagesEndRef = useRef(null);

  const formatTime = (isoString) => {
    const date = isoString ? new Date(isoString) : new Date();
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const scrollToBottom = () => {
    const el = messagesEndRef.current;
    if (el) {
      el.parentElement.scrollTop = el.parentElement.scrollHeight;
    }
  };

  useEffect(() => {
    let isMounted = true;
    const initApp = async () => {
      fetch(`${API_URL}/ping`).catch(() => {});
      try {
        const res = await fetch(`${API_URL}/personalities`);
        if (!res.ok) throw new Error("Failed to load personalities");
        const data = await res.json();
        if (!isMounted) return;
        setPersonalities(data);
        if (data.length > 0) {
          setPersonalityId(data[0].id);
        }
      } catch (e) {
        console.error("Ошибка инициализации:", e);
      } finally {
        if (isMounted) {
          setIsInitialLoading(false);
        }
      }
    };
    initApp();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      if (isInitialLoading || !personalityId) return;
      try {
        const res = await fetch(`${API_URL}/messages?personality_id=${personalityId}`);
        const data = await res.json();
        const formatted = data.map((msg) => ({
          role: msg.role === "assistant" ? "model" : msg.role,
          parts: msg.parts,
          theme: msg.theme,
          time: formatTime(msg.time),
        }));
        setMessages(formatted);
      } catch (e) {
        console.error("Ошибка истории:", e);
      }
    };
    fetchHistory();
  }, [personalityId, isInitialLoading]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = { role: "user", parts: [input], time: formatTime() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: [...messages, userMsg].map((m) => ({ role: m.role, parts: m.parts })),
          personality_id: personalityId ?? undefined,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "model", parts: [data.text], theme: data.visual_hint, time: formatTime() },
      ]);
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        { role: "model", parts: ["Бро, я что-то завис 😵"], time: formatTime() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearUI = () => {
    setMessages([]);
    setIsMenuOpen(false);
  };

  const handleGoogleLogin = () => {
    alert("Скоро: Авторизация через Google");
  };

  const currentPersona = personalities.find((p) => p.id === personalityId);

  return (
    <div className='chat-container'>
      <header>
        <div className='header-left'>
          <h1 className='header-title'>VibeBuddy</h1>
        </div>
        <div className='header-center'>
          <h1 className='header-title' style={{ fontWeight: 400, opacity: 0.8 }}>
            {isInitialLoading ? "" : currentPersona?.name}
          </h1>
        </div>
        <div className='header-right'>
          <button className='menu-trigger-btn' onClick={() => setIsMenuOpen(true)}>
            <Menu size={24} />
          </button>
        </div>
      </header>

      <div className='messages-list'>
        {isInitialLoading ? (
          <motion.div className='loader-wrapper' initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Loader2 className='spin' size={40} />
            <span className='loader-text'>Пробуждаю друзей...</span>
          </motion.div>
        ) : (
          <>
            {messages.length === 0 && !isLoading && (
              <div className='empty-chat-hint'>Начни общение с {currentPersona?.name || "ИИ"}</div>
            )}
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`message-bubble ${msg.role === "user" ? "user" : "ai"}`}
                style={
                  msg.role === "model" ? { borderLeft: `4px solid ${msg.theme || "#e5e5ea"}` } : {}
                }
              >
                <div className='text-content'>{msg.parts[0]}</div>
                <div className='message-footer'>
                  <span className='message-time'>{msg.time}</span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className='message-bubble ai loading'>
                <Loader2 size={16} className='spin' />
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className='input-area'>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isLoading && !isInitialLoading) {
              sendMessage();
            }
          }}
          placeholder={`Напиши ${currentPersona?.name || ""}...`}
        />

        <button
          className='send-btn'
          onClick={sendMessage}
          disabled={isLoading || isInitialLoading || !input.trim()}
        >
          <SendHorizonal size={20} />
        </button>
      </div>

      <Sidebar
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        personalities={personalities}
        currentId={personalityId}
        onSelect={(id) => setPersonalityId(id)}
        // ТУТ ИСПРАВЛЕНИЕ: привязываем открытие Лаборатории к onAdd
        onAdd={() => {
          setIsLabOpen(true); // Открываем форму
          setIsMenuOpen(false); // Закрываем сайдбар, чтобы не мешал
        }}
        onClear={handleClearUI}
        onLogin={handleGoogleLogin}
      />
      <CharacterLab
        isOpen={isLabOpen}
        onClose={() => setIsLabOpen(false)}
        onCharacterCreated={handleNewCharacter}
      />
    </div>
  );
}

export default App;
