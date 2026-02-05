import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, SendHorizonal, X as CloseIcon, LogOut, Mic } from "lucide-react";
import { supabase } from "./supabaseClient";
import { translations } from "./translations";

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
  const [lang, setLang] = useState(() => localStorage.getItem("lang") || "ru");
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const shouldSendRef = useRef(false);

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const triggerHaptic = (type = "medium") => {
    if (tg?.isVersionAtLeast?.("6.1") && tg?.HapticFeedback) {
      if (type === "success" || type === "danger") {
        tg.HapticFeedback.notificationOccurred(type);
      } else {
        tg.HapticFeedback.impactOccurred(type);
      }
    }
  };

  const messagesEndRef = useRef(null);
  const t = translations[lang] || translations.ru;

  const getDateLabel = (isoString) => {
    const date = new Date(isoString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const t = translations[lang]; // Берем текущий язык

    if (date.toDateString() === today.toDateString()) return t.today;
    if (date.toDateString() === yesterday.toDateString()) return t.yesterday;

    return date.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
      day: "numeric",
      month: "long",
    });
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme); // Сохраняем тему
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("lang", lang); // Сохраняем язык
  }, [lang]);

  useEffect(() => {
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };

    setVh();
    window.addEventListener("resize", setVh);
    window.addEventListener("orientationchange", setVh);

    return () => {
      window.removeEventListener("resize", setVh);
      window.removeEventListener("orientationchange", setVh);
    };
  }, []);

  // --- 1. ТЕЛЕГРАМ: НАСТРОЙКА, ТЕМА И ПОЛНЫЙ ЭКРАН ---
  useEffect(() => {
    // Проверяем: мы реально в Телеге или просто в браузере со скриптом?
    const isActualTelegram = tg && tg.initData !== "";

    if (isActualTelegram) {
      tg.ready();
      document.body.classList.add("is-tg"); // Вешаем метку только для ТГ

      // 1. Fullscreen
      try {
        if (tg.isVersionAtLeast?.("8.0") && tg.requestFullscreen) {
          tg.requestFullscreen();
        } else {
          tg.expand();
        }
      } catch (e) {
        tg.expand();
      }

      tg.isVerticalSwipesEnabled = false;

      // 2. Цвета и вьюпорт
      const tp = tg.themeParams;
      tg.setHeaderColor(tp.header_bg_color || "#1a1a1a");
      const root = document.documentElement;

      const applyViewportHeight = () => {
        if (tg.viewportHeight) {
          root.style.setProperty("--tg-vh", `${tg.viewportHeight * 0.01}px`);
        }
      };

      const applySafeAreas = () => {
        root.style.setProperty("--safe-top", `${tg.safeAreaInset?.top || 0}px`);
        root.style.setProperty("--safe-bottom", `${tg.safeAreaInset?.bottom || 0}px`);
        root.style.setProperty("--content-safe-top", `${tg.contentSafeAreaInset?.top || 0}px`);
        root.style.setProperty(
          "--content-safe-bottom",
          `${tg.contentSafeAreaInset?.bottom || 0}px`,
        );
      };

      applyViewportHeight();
      applySafeAreas();
      tg.onEvent("viewportChanged", applyViewportHeight);
      tg.onEvent("safeAreaChanged", applySafeAreas);

      // 3. Сессия
      if (tg.initDataUnsafe?.user) {
        const u = tg.initDataUnsafe.user;
        setSession({
          user: {
            id: `tg-${u.id}`,
            email: u.username ? `@${u.username}` : `${u.first_name}`,
            user_metadata: { full_name: u.first_name, avatar_url: u.photo_url || null },
          },
        });
      }

      return () => {
        document.body.classList.remove("is-tg");
        tg.offEvent("viewportChanged", applyViewportHeight);
        tg.offEvent("safeAreaChanged", applySafeAreas);
      };
    } else {
      // ЕСЛИ МЫ В CHROME: Чистим всё, что мог наворотить скрипт
      document.body.classList.remove("is-tg");
      document.documentElement.style.setProperty("--tg-vh", "1vh");
      document.documentElement.style.setProperty("--content-safe-top", "0px");
      document.documentElement.style.setProperty("--content-safe-bottom", "0px");
      document.documentElement.style.setProperty("--safe-top", "0px");
      document.documentElement.style.setProperty("--safe-bottom", "0px");
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

  // --- 4. ОТПРАВКА СООБЩЕНИЯ ---

  const sendMessage = async (overrideInput) => {
    const text = overrideInput || input;
    if (!text.trim() || isLoading) return;

    const currentPersona = personalities.find((p) => p.id === personalityId);
    const currentTheme = currentPersona?.visual_style || "#ccc";

    triggerHaptic("medium");

    const now = new Date().toISOString();
    const userMsg = { role: "user", parts: [text], time: formatTime(now), timestamp: now };

    // 1. Сразу добавляем сообщение юзера и пустую заглушку для ИИ
    const aiMsgPlaceholder = {
      role: "model",
      parts: [""],
      time: formatTime(now),
      timestamp: now,
      theme: currentTheme,
      isStreaming: true, // Пометка, что сообщение еще "растет"
    };

    setMessages((prev) => [...prev, userMsg, aiMsgPlaceholder]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: [...messages, userMsg].map((m) => ({ role: m.role, parts: m.parts })),
          personality_id: personalityId,
          user_id: session?.user?.id || null,
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true }); // Добавь { stream: true }

        // Правильная обработка потока данных
        const lines = chunk.split("\n"); // Сплитим по одной строке
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;

          const content = trimmedLine.replace("data: ", "");
          if (content === "[DONE]") break;

          accumulatedText += content;

          // Обновляем стейт
          setMessages((prev) => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            if (lastIndex >= 0) {
              updated[lastIndex] = {
                ...updated[lastIndex], // Сохраняем тему, время и роль!
                parts: [accumulatedText],
              };
            }
            return updated;
          });
        }
      }

      // 3. Финализируем (убираем флаг стриминга)
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].isStreaming = false;
        return updated;
      });

      triggerHaptic("success");
    } catch (e) {
      showToast(t.toast_ai_error, "danger");
    } finally {
      setIsLoading(false);
    }
  };

  // --- 6. ГОЛОСОВОЙ ВВОД ---

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 1. Стандартная запись для Whisper (наш бэкенд)
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);

      // 2. Инициализируем "живое" распознавание (браузерное)
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true; // Не останавливаться после первой паузы
        recognitionRef.current.interimResults = true; // 👈 ГЛАВНОЕ: показывать промежуточные результаты
        recognitionRef.current.lang = lang === "ru" ? "ru-RU" : "en-US";

        recognitionRef.current.onresult = (event) => {
          let interimTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              // Если фраза закончена, добавляем в инпут
              setInput(event.results[i][0].transcript);
            } else {
              // Если фраза еще произносится, показываем её "призрачно"
              interimTranscript += event.results[i][0].transcript;
              setInput(interimTranscript); // Текст "бежит" в инпуте!
            }
          }
        };

        recognitionRef.current.start();
      }

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const formData = new FormData();
        formData.append("file", audioBlob, "voice.wav");

        setIsLoading(true);
        try {
          const res = await fetch(`${API_URL}/chat/transcribe`, { method: "POST", body: formData });
          const data = await res.json();

          if (data.text) {
            if (shouldSendRef.current) {
              // Если была нажата кнопка отправки — шлем в чат
              sendMessage(data.text);
            } else {
              // Если просто остановили микрофон — кладем в инпут
              setInput(data.text);
            }
          }
        } catch (e) {
          showToast("Ошибка Whisper", "danger");
        } finally {
          setIsLoading(false);
          shouldSendRef.current = false; // Сбрасываем флаг
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      showToast("Микрофон недоступен", "danger");
    }
  };

  const stopRecording = (autoSend = false) => {
    if (mediaRecorderRef.current && isRecording) {
      shouldSendRef.current = autoSend; // Запоминаем, нужно ли отправить сразу
      mediaRecorderRef.current.stop();
      recognitionRef.current?.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // --- 5. ТЕЛЕГРАМ: MAIN BUTTON ---
  useEffect(() => {
    if (tg?.MainButton) {
      if (input.trim() && personalityId && !isLoading) {
        tg.MainButton.setText(t.send);
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
                          <LogOut size={16} /> {t.logout}
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
            <WelcomeScreen
              lang={lang}
              setLang={setLang}
              theme={theme}
              setTheme={setTheme}
              onOpenSidebar={() => setIsMenuOpen(true)}
              isLoading={isInitialLoading}
            />
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
        <button
          className={`mic-btn ${isRecording ? "recording" : ""}`}
          onClick={toggleRecording} // 👈 Одно нажатие для всего
          disabled={!personalityId || isLoading}
        >
          <Mic size={20} color={isRecording ? "var(--accent-red)" : "var(--text-muted)"} />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          // Если идет загрузка (расшифровка), меняем плейсхолдер
          placeholder={
            isLoading ? "Думаю над словами..." : isRecording ? "Слушаю..." : t.placeholder
          }
          disabled={!personalityId || isRecording || isLoading}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          className='send-btn'
          onClick={() => {
            if (isRecording) {
              stopRecording(true); // Остановить и отправить
            } else {
              sendMessage(); // Обычная отправка текста
            }
          }}
          // Кнопка активна, если есть текст ИЛИ если идет запись
          disabled={isLoading || !personalityId || (!input.trim() && !isRecording)}
        >
          <SendHorizonal size={20} />
        </button>
      </footer>

      <Sidebar
        lang={lang}
        setLang={setLang}
        theme={theme}
        setTheme={setTheme}
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
          if (!session) {
            showToast(t.lab_auth_error, "danger");
            return;
          }
          setIsLabOpen(true);
          setIsMenuOpen(false);
        }}
        onClearHistory={(id) => {
          if (window.confirm(t.confirm_clear)) {
            fetch(`${API_URL}/messages?personality_id=${id}&user_id=${session?.user?.id}`, {
              method: "DELETE",
            });
            setMessages([]);
            showToast(t.toast_cleared);
          }
        }}
        onDeletePersona={async (id) => {
          if (window.confirm(t.confirm_delete)) {
            try {
              const res = await fetch(`${API_URL}/personalities/${id}`, { method: "DELETE" });
              if (res.ok) {
                setPersonalities((prev) => prev.filter((p) => p.id !== id));
                if (personalityId === id) setPersonalityId(null);
                showToast(t.toast_deleted, "danger");
              }
            } catch (e) {
              showToast(t.toast_delete_error, "danger");
            }
          }
        }}
        getAvatarUrl={getAvatarUrl}
      />

      <CharacterLab
        lang={lang}
        isOpen={isLabOpen}
        onClose={() => setIsLabOpen(false)}
        session={session}
        onCharacterAdded={(char) => {
          setPersonalities((p) => [...p, char]);
          setPersonalityId(char.id);
          showToast(t.toast_created, "success");
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
