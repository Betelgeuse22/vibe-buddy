import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, SendHorizonal, Loader2, X as CloseIcon, LogOut } from "lucide-react";
import { supabase } from "./supabaseClient";
import Sidebar from "./Sidebar";
import CharacterLab from "./CharacterLab";
import WelcomeScreen from "./WelcomeScreen";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;

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

  // 🔐 АВТОРИЗАЦИЯ
  const [session, setSession] = useState(null);

  // 👤 МЕНЮ ПРОФИЛЯ
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [personalityId, setPersonalityId] = useState(null);
  const [personalities, setPersonalities] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLabOpen, setIsLabOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const messagesEndRef = useRef(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- 1. СЛУШАТЕЛЬ АВТОРИЗАЦИИ ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setPersonalityId(null);
        setIsProfileOpen(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- 2. ЗАГРУЗКА ПЕРСОНАЖЕЙ ---
  useEffect(() => {
    let isMounted = true;

    const fetchPersonalities = async () => {
      try {
        const userId = session?.user?.id;
        const url = userId
          ? `${API_URL}/personalities?user_id=${userId}`
          : `${API_URL}/personalities`;

        const res = await fetch(url);
        const data = await res.json();

        if (isMounted) setPersonalities(data);
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setIsInitialLoading(false);
      }
    };

    fetchPersonalities();

    return () => {
      isMounted = false;
    };
  }, [session]);

  // --- 3. ЗАГРУЗКА ИСТОРИИ ---
  useEffect(() => {
    const fetchHistory = async () => {
      if (isInitialLoading || !personalityId) return;

      const userId = session?.user?.id;

      if (userId) {
        // --- ВАРИАНТ А: Пользователь залогинен (Сервер) ---
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
          console.error("Ошибка загрузки истории с сервера:", e);
        }
      } else {
        // --- ВАРИАНТ Б: Гость (LocalStorage) ---
        const localData = localStorage.getItem(`guest_history_${personalityId}`);
        if (localData) {
          try {
            setMessages(JSON.parse(localData));
          } catch (e) {
            console.error("Ошибка парсинга локальной истории:", e);
            setMessages([]);
          }
        } else {
          setMessages([]);
        }
      }
    };
    fetchHistory();
  }, [personalityId, isInitialLoading, session]);

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

  // --- ФУНКЦИЯ ВЫХОДА ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsProfileOpen(false);
  };

  // --- СОЗДАНИЕ ПЕРСОНАЖА ---
  const handleCharacterAdded = (savedChar) => {
    setPersonalities((prev) => [...prev, savedChar]);
    setPersonalityId(savedChar.id);
    showToast("Новый бро создан! ✨");
  };

  // --- ОТПРАВКА СООБЩЕНИЯ ---
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const now = new Date().toISOString();
    const userMsg = { role: "user", parts: [input], time: formatTime(now), timestamp: now };

    // Сразу обновляем стейт
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    // Если гость — сохраняем в LocalStorage
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
          user_id: session?.user?.id || null, // Шлем null для гостя
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

      const finalMessages = [...newMessages, aiMsg];
      setMessages(finalMessages);

      // Если гость — обновляем LocalStorage с ответом ИИ
      if (!session?.user?.id) {
        localStorage.setItem(`guest_history_${personalityId}`, JSON.stringify(finalMessages));
      }
    } catch (e) {
      console.error("Ошибка чата:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
  const handleDeletePersona = async (id) => {
    if (window.confirm("Бро, ты уверен? Персонаж и переписка исчезнут навсегда!")) {
      try {
        const userId = session?.user?.id;
        const response = await fetch(`${API_URL}/personalities/${id}?user_id=${userId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          setPersonalities((prev) => prev.filter((p) => p.id !== id));
          if (personalityId === id) setPersonalityId(null);
          showToast("Персонаж удален", "danger");
        } else {
          showToast("Нельзя удалить чужого бота!", "danger");
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleClearHistory = async (id) => {
    if (window.confirm("Очистить историю сообщений?")) {
      const userId = session?.user?.id;
      if (userId) {
        // Чистим сервер
        await fetch(`${API_URL}/messages?personality_id=${id}&user_id=${userId}`, {
          method: "DELETE",
        });
      } else {
        // Чистим локально
        localStorage.removeItem(`guest_history_${id}`);
      }
      setMessages([]);
      showToast("История очищена 🧹");
    }
  };

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

  const isNewDay = (prevMsg, currMsg) => {
    if (!prevMsg) return true;
    const d1 = new Date(prevMsg.timestamp).toDateString();
    const d2 = new Date(currMsg.timestamp).toDateString();
    return d1 !== d2;
  };

  const formatDateLabel = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return "Сегодня";
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
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

        {/* ПРАВАЯ ЧАСТЬ ХЕДЕРА */}
        <div className='header-right'>
          {/* АВАТАРКА + МЕНЮ (Показываем только если есть юзер) */}
          {session?.user && (
            <>
              {/* Кликабельный контейнер аватара */}
              <div
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className='header-avatar-container'
              >
                {session.user.user_metadata?.avatar_url ? (
                  <img
                    src={session.user.user_metadata.avatar_url}
                    className='header-user-avatar'
                    alt='User'
                  />
                ) : (
                  <div className='header-user-avatar avatar-placeholder header-placeholder'>
                    {(session.user.user_metadata?.full_name ||
                      session.user.email ||
                      "?")[0].toUpperCase()}
                  </div>
                )}
              </div>

              {/* Выпадающее меню */}
              <AnimatePresence>
                {isProfileOpen && (
                  <>
                    <div className='profile-overlay' onClick={() => setIsProfileOpen(false)} />

                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.1 }}
                      className='header-profile-dropdown'
                    >
                      <div className='profile-email-container'>
                        <p className='profile-email-text'>{session?.user?.email}</p>
                      </div>

                      <button className='header-profile-item danger' onClick={handleLogout}>
                        <LogOut size={16} />
                        Выйти
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </>
          )}

          {/* КНОПКА БУРГЕР-МЕНЮ */}
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
                {messages.map((msg, index) => {
                  const showDate = isNewDay(messages[index - 1], msg);
                  return (
                    <React.Fragment key={`group-${index}`}>
                      {showDate && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className='date-separator'
                        >
                          <span>{formatDateLabel(msg.timestamp)}</span>
                        </motion.div>
                      )}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 80, damping: 20 }}
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
                    </React.Fragment>
                  );
                })}
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
        session={session}
        onSelect={(id) => setPersonalityId(id)}
        onAdd={() => {
          setIsLabOpen(true);
          setIsMenuOpen(false);
        }}
        onDeletePersona={handleDeletePersona}
        onClearHistory={handleClearHistory}
        getAvatarUrl={getAvatarUrl}
      />

      <CharacterLab
        isOpen={isLabOpen}
        onClose={() => setIsLabOpen(false)}
        session={session}
        onCharacterAdded={handleCharacterAdded}
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
