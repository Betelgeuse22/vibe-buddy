import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, SendHorizonal, Loader2, X as CloseIcon } from "lucide-react";
import Sidebar from "./Sidebar";
import CharacterLab from "./CharacterLab";
import WelcomeScreen from "./WelcomeScreen";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;

// Компонент уведомления (Toast)
const Toast = ({ message, type, onClose }) => (
  <motion.div
    initial={{ y: 50, opacity: 0, x: "-50%" }}
    animate={{ y: 0, opacity: 1, x: "-50%" }}
    exit={{ y: 50, opacity: 0, x: "-50%" }}
    className={`toast toast-${type}`}
  >
    <span>{message}</span>
    <button onClick={onClose}>
      <CloseIcon size={14} />
    </button>
  </motion.div>
);

function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [personalityId, setPersonalityId] = useState(null);
  const [personalities, setPersonalities] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLabOpen, setIsLabOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const messagesEndRef = useRef(null);

  // Утилита для показа тоста
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- ФУНКЦИИ ОБРАБОТКИ ---

  const handleGoogleLogin = () => {
    showToast("Скоро: Авторизация через Google", "success");
  };

  const handleNewCharacter = (newChar) => {
    setPersonalities((prev) => [...prev, newChar]);
    showToast("Новый бро создан! ✨");
  };

  const handleDeletePersona = async (id) => {
    if (window.confirm("Бро, ты уверен? Этот персонаж и вся переписка исчезнут навсегда!")) {
      try {
        const response = await fetch(`${API_URL}/personalities/${id}`, { method: "DELETE" });
        if (response.ok) {
          setPersonalities((prev) => prev.filter((p) => p.id !== id));
          if (personalityId === id) setPersonalityId(null);
          showToast("Персонаж удален", "danger");
        }
      } catch (e) {
        console.error("Ошибка при удалении бро:", e);
      }
    }
  };

  const handleClearHistory = async (id) => {
    if (window.confirm("Очистить всю историю сообщений с этим персонажем?")) {
      try {
        const response = await fetch(`${API_URL}/messages?personality_id=${id}`, {
          method: "DELETE",
        });
        if (response.ok) {
          if (personalityId === id) setMessages([]);
          showToast("История очищена 🧹");
        }
      } catch (e) {
        console.error("Ошибка при очистке истории:", e);
      }
    }
  };

  // Универсальная функция получения аватарки
  const getAvatarUrl = (avatarStr, name) => {
    if (avatarStr?.includes(":")) {
      const [style, seed] = avatarStr.split(":");
      return `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`;
    }
    return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(name || "default")}`;
  };

  const formatTime = (isoString) => {
    const date = isoString ? new Date(isoString) : new Date();
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const scrollToBottom = () => {
    const el = messagesEndRef.current;
    if (el) el.parentElement.scrollTop = el.parentElement.scrollHeight;
  };

  // --- ЭФФЕКТЫ ---

  useEffect(() => {
    let isMounted = true;
    const initApp = async () => {
      fetch(`${API_URL}/ping`).catch(() => {});
      try {
        const res = await fetch(`${API_URL}/personalities`);
        const data = await res.json();
        if (isMounted) setPersonalities(data);
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setIsInitialLoading(false);
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
        setMessages(
          data.map((msg) => ({
            role: msg.role === "assistant" ? "model" : msg.role,
            parts: msg.parts,
            theme: msg.theme,
            time: formatTime(msg.time),
          })),
        );
      } catch (e) {
        console.error(e);
      }
    };
    fetchHistory();
  }, [personalityId, isInitialLoading]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    };
    setVh();
    window.addEventListener("resize", setVh);
    return () => window.removeEventListener("resize", setVh);
  }, []);

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
      setMessages((prev) => [
        ...prev,
        { role: "model", parts: ["Ошибка связи 😵"], time: formatTime() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const currentPersona = personalities.find((p) => p.id === personalityId);

  return (
    <div className='chat-container' style={{ height: "calc(var(--vh, 1vh) * 100)" }}>
      <header>
        <div
          className='header-left'
          onClick={() => {
            setPersonalityId(null);
            setMessages([]);
          }}
          style={{ cursor: "pointer" }}
        >
          <h1 className='header-title'>VibeBuddy</h1>
        </div>

        <div className='header-center'>
          <AnimatePresence mode='wait'>
            {personalityId && (
              <motion.div
                key={personalityId}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className='header-persona-info'
              >
                <img
                  src={getAvatarUrl(currentPersona?.avatar, currentPersona?.name)}
                  className='header-avatar-mini'
                  alt=''
                />
                <span className='header-persona-name'>{currentPersona?.name}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className='header-right'>
          <button className='menu-trigger-btn' onClick={() => setIsMenuOpen(true)}>
            <Menu size={24} />
          </button>
        </div>
      </header>

      <div className='messages-list'>
        <AnimatePresence mode='wait'>
          {!personalityId ? (
            <WelcomeScreen
              key='welcome'
              isLoading={isInitialLoading}
              onOpenSidebar={() => setIsMenuOpen(true)}
            />
          ) : (
            <motion.div
              key='chat'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className='chat-sub-container'
            >
              {messages.length === 0 && !isLoading && (
                <div className='empty-chat-hint'>Начни общение с {currentPersona?.name}</div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className={`message-bubble ${msg.role === "user" ? "user" : "ai"}`}
                    style={
                      msg.role === "model"
                        ? { borderLeft: `4px solid ${msg.theme || "#0a84ff"}` }
                        : {}
                    }
                  >
                    <div className='text-content'>{msg.parts[0]}</div>
                    <div className='message-footer'>
                      <span className='message-time'>{msg.time}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className='message-bubble ai loading'
                >
                  <Loader2 size={16} className='spin' />
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <div className='input-area'>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!personalityId}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder={personalityId ? `Напиши ${currentPersona?.name}...` : "Выбери друга в меню"}
        />
        <button
          className='send-btn'
          onClick={sendMessage}
          disabled={isLoading || !input.trim() || !personalityId}
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
        onAdd={() => {
          setIsLabOpen(true);
          setIsMenuOpen(false);
        }}
        onDeletePersona={handleDeletePersona}
        onClearHistory={handleClearHistory}
        onLogin={handleGoogleLogin}
        getAvatarUrl={getAvatarUrl}
      />

      <CharacterLab
        isOpen={isLabOpen}
        onClose={() => setIsLabOpen(false)}
        onCharacterCreated={handleNewCharacter}
      />

      <AnimatePresence>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
