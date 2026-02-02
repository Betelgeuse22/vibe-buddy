import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, SendHorizonal, Loader2, X as CloseIcon, LogOut } from "lucide-react";
import { supabase } from "./supabaseClient";

// Наши компоненты
import Sidebar from "./Sidebar";
import CharacterLab from "./CharacterLab";
import WelcomeScreen from "./WelcomeScreen";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;
const tg = window.Telegram?.WebApp; // SDK Телеграма

// Вспомогательный компонент уведомлений
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
  // --- 1. СОСТОЯНИЕ (STATE) ---
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState(null);

  // Данные персонажей
  const [personalities, setPersonalities] = useState([]);
  const [personalityId, setPersonalityId] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Состояния интерфейса
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLabOpen, setIsLabOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const messagesEndRef = useRef(null);

  // --- 2. ЭФФЕКТЫ (EFFECTS) ---

  // Инициализация Telegram SDK
  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor(tg.themeParams.header_bg_color || "#1a1a1a");
    }
  }, []);

  // Слушатель авторизации Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setPersonalityId(null);
        setMessages([]);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Загрузка списка "бро"
  useEffect(() => {
    const fetchPersonalities = async () => {
      try {
        const userId = session?.user?.id;
        const url = userId
          ? `${API_URL}/personalities?user_id=${userId}`
          : `${API_URL}/personalities`;
        const res = await fetch(url);
        const data = await res.json();
        setPersonalities(data);
      } catch (e) {
        console.error("Ошибка загрузки списка:", e);
      } finally {
        setIsInitialLoading(false);
      }
    };
    fetchPersonalities();
  }, [session]);

  // Загрузка истории (Сервер или LocalStorage)
  useEffect(() => {
    const fetchHistory = async () => {
      if (!personalityId) return;
      const userId = session?.user?.id;

      if (userId) {
        try {
          const res = await fetch(
            `${API_URL}/messages?personality_id=${personalityId}&user_id=${userId}`,
          );
          const data = await res.json();
          setMessages(
            data.map((msg) => ({
              role: msg.role === "assistant" ? "model" : msg.role,
              parts: msg.parts,
              theme: msg.theme,
              time: formatTime(msg.time),
              timestamp: msg.time,
            })),
          );
        } catch (e) {
          console.error("Ошибка истории:", e);
        }
      } else {
        const local = localStorage.getItem(`guest_history_${personalityId}`);
        setMessages(local ? JSON.parse(local) : []);
      }
    };
    fetchHistory();
  }, [personalityId, session]);

  // Скролл вниз
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.parentElement.scrollTop =
        messagesEndRef.current.parentElement.scrollHeight;
    }
  }, [messages, isLoading]);

  // --- 3. ЛОГИКА (HANDLERS) ---

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsProfileOpen(false);
    showToast("Вы вышли из системы", "info");
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const now = new Date().toISOString();
    const userMsg = { role: "user", parts: [input], time: formatTime(now), timestamp: now };
    const newMessages = [...messages, userMsg];

    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    if (!session?.user?.id) {
      localStorage.setItem(`guest_history_${personalityId}`, JSON.stringify(newMessages));
    }

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: newMessages.map((m) => ({ role: m.role, parts: m.parts })),
          personality_id: personalityId,
          user_id: session?.user?.id || null,
        }),
      });

      const data = await res.json();
      const aiTime = new Date().toISOString();
      const aiMsg = {
        role: "model",
        parts: [data.text],
        theme: data.visual_hint,
        time: formatTime(aiTime),
        timestamp: aiTime,
      };

      setMessages((prev) => [...prev, aiMsg]);
      if (!session?.user?.id) {
        localStorage.setItem(
          `guest_history_${personalityId}`,
          JSON.stringify([...newMessages, aiMsg]),
        );
      }
    } catch (e) {
      showToast("Ошибка связи с ИИ", "danger");
    } finally {
      setIsLoading(false);
    }
  };

  // --- 4. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
  const formatTime = (iso) =>
    new Date(iso || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const getAvatarUrl = (avatarStr, name) => {
    if (avatarStr?.includes(":")) {
      const [style, seed] = avatarStr.split(":");
      return `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`;
    }
    return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(name || "buddy")}`;
  };

  const currentPersona = personalities.find((p) => p.id === personalityId);

  // --- 5. РЕНДЕР (UI) ---
  return (
    <div className='chat-container'>
      <header>
        <div
          className='header-left'
          onClick={() => setPersonalityId(null)}
          style={{ cursor: "pointer" }}
        >
          <h1 className='header-title'>VibeBuddy</h1>
        </div>

        <div className='header-center'>
          <AnimatePresence mode='wait'>
            {currentPersona && (
              <motion.div
                key={currentPersona.id}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className='header-persona-info'
              >
                <img
                  src={getAvatarUrl(currentPersona.avatar, currentPersona.name)}
                  className='header-avatar-mini'
                  alt=''
                />
                <span className='header-persona-name'>{currentPersona.name}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className='header-right'>
          {session?.user && (
            <div className='profile-section'>
              <div
                className='header-avatar-container'
                onClick={() => setIsProfileOpen(!isProfileOpen)}
              >
                {session.user.user_metadata?.avatar_url ? (
                  <img
                    src={session.user.user_metadata.avatar_url}
                    className='header-user-avatar'
                    alt='User'
                  />
                ) : (
                  <div className='header-user-avatar avatar-placeholder'>
                    {(session.user.user_metadata?.full_name ||
                      session.user.email ||
                      "?")[0].toUpperCase()}
                  </div>
                )}
              </div>

              <AnimatePresence>
                {isProfileOpen && (
                  <>
                    <div className='profile-overlay' onClick={() => setIsProfileOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className='header-profile-dropdown'
                    >
                      <div className='profile-email-container'>
                        <p className='profile-email-text'>{session.user.email}</p>
                      </div>
                      <button className='header-profile-item danger' onClick={handleLogout}>
                        <LogOut size={16} /> Выйти
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
          <button className='menu-trigger-btn' onClick={() => setIsMenuOpen(true)}>
            <Menu size={24} />
          </button>
        </div>
      </header>

      <main className='messages-list'>
        <AnimatePresence mode='wait'>
          {!personalityId ? (
            <WelcomeScreen
              key='welcome'
              onOpenSidebar={() => setIsMenuOpen(true)}
              isLoading={isInitialLoading}
            />
          ) : (
            <motion.div
              key='chat'
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className='chat-sub-container'
            >
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`message-bubble ${msg.role === "user" ? "user" : "ai"}`}
                  style={msg.role === "model" ? { borderLeft: `4px solid ${msg.theme}` } : {}}
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
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </main>

      <footer className='input-area'>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!personalityId}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder={personalityId ? "Напиши бро..." : "Выбери друга в меню"}
        />
        <button
          className='send-btn'
          onClick={sendMessage}
          disabled={isLoading || !input.trim() || !personalityId}
        >
          <SendHorizonal size={20} />
        </button>
      </footer>

      <Sidebar
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        personalities={personalities}
        currentId={personalityId}
        session={session}
        onSelect={(id) => {
          setPersonalityId(id);
          setIsMenuOpen(false);
        }}
        onAdd={() => {
          setIsLabOpen(true);
          setIsMenuOpen(false);
        }}
        onClearHistory={(id) => {
          if (window.confirm("Очистить историю?")) {
            if (session?.user?.id) {
              fetch(`${API_URL}/messages?personality_id=${id}&user_id=${session.user.id}`, {
                method: "DELETE",
              });
            } else {
              localStorage.removeItem(`guest_history_${id}`);
            }
            setMessages([]);
            showToast("История очищена 🧹");
          }
        }}
        getAvatarUrl={getAvatarUrl}
      />

      <CharacterLab
        isOpen={isLabOpen}
        onClose={() => setIsLabOpen(false)}
        session={session}
        onCharacterAdded={(char) => {
          setPersonalities((p) => [...p, char]);
          setPersonalityId(char.id);
        }}
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
