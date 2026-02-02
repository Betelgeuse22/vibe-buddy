import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, SendHorizonal, X as CloseIcon, LogOut } from "lucide-react";
import { supabase } from "./supabaseClient";

// Наши компоненты
import Sidebar from "./Sidebar";
import CharacterLab from "./CharacterLab";
import WelcomeScreen from "./WelcomeScreen";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;
const tg = window.Telegram?.WebApp;

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
  const [session, setSession] = useState(null);
  const [personalities, setPersonalities] = useState([]);
  const [personalityId, setPersonalityId] = useState(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLabOpen, setIsLabOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const messagesEndRef = useRef(null);

  const getDateLabel = (isoString) => {
    const date = new Date(isoString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Сегодня";
    if (date.toDateString() === yesterday.toDateString()) return "Вчера";

    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  };

  function setVh() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty("--vh", `${vh}px`);
  }

  setVh();
  window.addEventListener("resize", setVh);

  // --- 1. ТЕЛЕГРАМ: НАСТРОЙКА, ТЕМА И ПОЛНЫЙ ЭКРАН ---
  useEffect(() => {
    if (tg) {
      tg.ready();

      // 1. Включаем полноэкранный режим (для версий 8.0+)
      try {
        if (tg.isVersionAtLeast("8.0") && tg.requestFullscreen) {
          tg.requestFullscreen();
        } else {
          tg.expand();
        }
      } catch (err) {
        tg.expand();
      }

      tg.isVerticalSwipesEnabled = false;

      // 2. Настройка цветов (смешиваем статус-бар с фоном приложения)
      const tp = tg.themeParams;
      tg.setHeaderColor(tp.header_bg_color || "#1a1a1a"); //
      tg.setBackgroundColor(tp.bg_color || "#1a1a1a");

      const root = document.documentElement;
      root.style.setProperty("--tg-bg", tp.bg_color);
      root.style.setProperty("--tg-text", tp.text_color);
      root.style.setProperty("--tg-hint", tp.hint_color);
      root.style.setProperty("--tg-accent", tp.button_color);
      root.style.setProperty("--tg-secondary-bg", tp.secondary_bg_color);

      // 3. Ультимативная функция для безопасных зон
      const applySafeAreas = () => {
        // safeAreaInset - зона системных индикаторов (часы, заряд)
        const top = tg.safeAreaInset?.top || 0;
        const bottom = tg.safeAreaInset?.bottom || 0;

        // contentSafeAreaInset - зона, свободная от кнопок Telegram (Закрыть, Меню)
        const contentTop = tg.contentSafeAreaInset?.top || 0;

        root.style.setProperty("--safe-top", `${top}px`);
        root.style.setProperty("--safe-bottom", `${bottom}px`);
        root.style.setProperty("--content-safe-top", `${contentTop}px`);
      };

      // Вызываем сразу и подписываемся на изменения (смена ориентации, скрытие панелей)
      applySafeAreas();
      tg.onEvent("safeAreaChanged", applySafeAreas); //
      tg.onEvent("contentSafeAreaChanged", applySafeAreas);

      // 4. Логика сессии
      if (tg.initDataUnsafe?.user) {
        const u = tg.initDataUnsafe.user;
        const displayName = u.username
          ? `@${u.username}`
          : `${u.first_name} ${u.last_name || ""}`.trim();

        setSession({
          user: {
            id: `tg-${u.id}`,
            email: displayName,
            user_metadata: {
              full_name: u.first_name,
              avatar_url: u.photo_url || null,
            },
          },
        });
      }

      // Чистим слушатели при размонтировании
      return () => {
        tg.offEvent("safeAreaChanged", applySafeAreas);
        tg.offEvent("contentSafeAreaChanged", applySafeAreas);
      };
    }
  }, []);

  // --- 2. АВТОРИЗАЦИЯ SUPABASE (Для веба) ---
  useEffect(() => {
    // Если мы в Telegram — мы "выселяем" Supabase из памяти,
    // чтобы он не пытался реанимировать старые сессии Google
    if (tg?.initDataUnsafe?.user) {
      const clearSupabaseSession = async () => {
        // Это очистит localStorage от битых токенов именно для этого домена
        await supabase.auth.signOut();
        console.log("🧹 Сессия Supabase очищена для режима Telegram");
      };
      clearSupabaseSession();
      return; // Выходим и больше ничего не делаем в этом эффекте
    }

    // Логика для веб-версии (Google Auth) остается прежней
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setPersonalityId(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- 3. ЗАГРУЗКА ДАННЫХ ---
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
        console.error(e);
      } finally {
        setIsInitialLoading(false);
      }
    };
    fetchPersonalities();
  }, [session]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!personalityId || !session?.user?.id) return;
      try {
        const res = await fetch(
          `${API_URL}/messages?personality_id=${personalityId}&user_id=${session.user.id}`,
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
        console.error(e);
      }
    };
    fetchHistory();
  }, [personalityId, session]);

  // --- 4. ЛОГИКА ОЖИДАНИЯ (Artificial Latency) ---
  const simulateTypingDelay = (text) => {
    // Базовая секунда + 30мс за символ, но не более 3 секунд
    const delay = Math.min(1000 + text.length * 30, 3000);
    return new Promise((resolve) => setTimeout(resolve, delay));
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred("medium");

    const now = new Date().toISOString();
    const userMsg = { role: "user", parts: [input], time: formatTime(now), timestamp: now };
    const newMessages = [...messages, userMsg];

    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

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

      // Ждем, пока "пропечатает" 🤖
      await simulateTypingDelay(data.text);

      if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");

      const aiMsg = {
        role: "model",
        parts: [data.text],
        theme: data.visual_hint,
        time: formatTime(new Date().toISOString()),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e) {
      showToast("Ошибка связи с ИИ", "danger");
    } finally {
      setIsLoading(false);
    }
  };

  // --- 5. ТЕЛЕГРАМ: MAIN BUTTON ---
  useEffect(() => {
    if (tg?.MainButton) {
      if (input.trim() && personalityId && !isLoading) {
        tg.MainButton.setText("ОТПРАВИТЬ");
        tg.MainButton.show();
      } else {
        tg.MainButton.hide();
      }
    }
  }, [input, personalityId, isLoading]);

  useEffect(() => {
    const handleMainBtn = () => sendMessage();
    tg?.MainButton?.onClick(handleMainBtn);
    return () => tg?.MainButton?.offClick(handleMainBtn);
  }, [input, messages]);

  // --- ВСПОМОГАТЕЛЬНОЕ ---
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.parentElement.scrollTop =
        messagesEndRef.current.parentElement.scrollHeight;
    }
  }, [messages, isLoading]);

  const formatTime = (iso) =>
    new Date(iso || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const showToast = (m, t = "success") => {
    setToast({ message: m, type: t });
    setTimeout(() => setToast(null), 3000);
  };

  const getAvatarUrl = (avatarStr, name) => {
    if (avatarStr?.includes(":")) {
      const [style, seed] = avatarStr.split(":");
      return `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`;
    }
    return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(name || "buddy")}`;
  };

  const getSafeUserAvatar = (session) => {
    const url = session?.user?.user_metadata?.avatar_url;

    if (url && url.startsWith("http")) return url;

    const seed = session?.user?.user_metadata?.full_name || session?.user?.email || "user";

    return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
  };

  const currentPersona = personalities.find((p) => p.id === personalityId);

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
                    src={getSafeUserAvatar(session)}
                    className='header-user-avatar'
                    alt='User'
                    referrerPolicy='no-referrer'
                    onError={(e) => {
                      e.currentTarget.src = getAvatarUrl(
                        "avataaars",
                        session.user.user_metadata?.full_name || "user",
                      );
                    }}
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
                      {!tg?.initDataUnsafe?.user && (
                        <button
                          className='header-profile-item danger'
                          onClick={() => {
                            supabase.auth.signOut();
                            setIsProfileOpen(false);
                          }}
                        >
                          <LogOut size={16} /> Выйти
                        </button>
                      )}
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
            <WelcomeScreen onOpenSidebar={() => setIsMenuOpen(true)} isLoading={isInitialLoading} />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className='chat-sub-container'
            >
              {messages.map((msg, i) => {
                // Логика определения разделителя
                const msgDate = new Date(msg.timestamp).toDateString();
                const prevMsgDate =
                  i > 0 ? new Date(messages[i - 1].timestamp).toDateString() : null;
                const isNewDay = msgDate !== prevMsgDate;

                return (
                  <React.Fragment key={i}>
                    {isNewDay && (
                      <div className='date-divider'>
                        <span>{getDateLabel(msg.timestamp)}</span>
                      </div>
                    )}

                    <div
                      className={`message-bubble ${msg.role === "user" ? "user" : "ai"}`}
                      style={msg.role === "model" ? { borderLeft: `4px solid ${msg.theme}` } : {}}
                    >
                      <div className='text-content'>{msg.parts[0]}</div>
                      <div className='message-footer'>
                        <span className='message-time'>{msg.time}</span>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              {isLoading && (
                <div className='message-bubble ai loading'>
                  <div className='typing-indicator'>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
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
          placeholder='Напиши бро...'
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
            fetch(`${API_URL}/messages?personality_id=${id}&user_id=${session?.user?.id}`, {
              method: "DELETE",
            });
            setMessages([]);
            showToast("История очищена 🧹");
          }
        }}
        onDeletePersona={async (id) => {
          if (window.confirm("Удалить этого бро навсегда?")) {
            try {
              const res = await fetch(`${API_URL}/personalities/${id}`, { method: "DELETE" });
              if (res.ok) {
                setPersonalities((prev) => prev.filter((p) => p.id !== id));
                if (personalityId === id) setPersonalityId(null);
                showToast("Персонаж удален", "info");
              }
            } catch (e) {
              showToast("Не удалось удалить", "danger");
            }
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
