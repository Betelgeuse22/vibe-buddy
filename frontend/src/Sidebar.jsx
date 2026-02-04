import React, { useState } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import {
  Sun,
  Moon,
  Languages,
  Trash2,
  Users,
  Plus,
  X,
  MoreVertical,
  Paintbrush,
  LogOut,
  Settings,
} from "lucide-react";
import { translations } from "./translations";
import { supabase } from "./supabaseClient";

const GoogleIcon = () => (
  <svg width='18' height='18' viewBox='0 0 18 18' xmlns='http://www.w3.org/2000/svg'>
    <path
      d='M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z'
      fill='#4285F4'
    />
    <path
      d='M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957273V13.0418C2.43818 15.9832 5.48182 18 9 18Z'
      fill='#34A853'
    />
    <path
      d='M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957273C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957273 13.0418L3.96409 10.71Z'
      fill='#FBBC05'
    />
    <path
      d='M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957273 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z'
      fill='#EA4335'
    />
  </svg>
);

const Sidebar = ({
  isOpen,
  onClose,
  personalities,
  currentId,
  session,
  onSelect,
  onAdd,
  onDeletePersona,
  onClearHistory,
  getAvatarUrl,
  lang = "ru",
  setLang,
  theme = "dark",
  setTheme,
}) => {
  const controls = useDragControls();
  const [activeMenu, setActiveMenu] = useState(null);
  const t = translations[lang] || translations.ru;

  const tg = window.Telegram?.WebApp;

  const handleAction = (callback, id) => {
    callback(id);
    setActiveMenu(null);
  };

  const getSafeUserAvatar = (session) => {
    const url = session?.user?.user_metadata?.avatar_url;
    if (url && url.startsWith("http")) return url;
    const seed = session?.user?.user_metadata?.full_name || session?.user?.email || "user";
    return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { queryParams: { access_type: "offline", prompt: "consent" } },
      redirectTo: window.location.origin,
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className='sidebar-overlay'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className='sidebar'
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            drag='x'
            dragConstraints={{ left: 0, right: 300 }}
            dragElastic={0.05}
            onDragEnd={(e, info) => {
              if (info.offset.x > 80 || info.velocity.x > 400) onClose();
            }}
          >
            <div className='sidebar-drag-handle' onTouchStart={(e) => controls.start(e)} />

            <div className='sidebar-header'>
              <div className='sidebar-auth-section'>
                <p className='sidebar-section-title'>{t.account}</p>
                {!session ? (
                  <button className='google-auth-btn' onClick={handleGoogleLogin}>
                    <GoogleIcon />
                    <span>{t.login_google}</span>
                  </button>
                ) : (
                  <div className='user-profile-card'>
                    <div className='user-info'>
                      {session.user.user_metadata.avatar_url ? (
                        <img
                          src={getSafeUserAvatar(session)}
                          alt='User'
                          className='user-avatar'
                          referrerPolicy='no-referrer'
                        />
                      ) : (
                        <div className='user-avatar avatar-placeholder'>
                          {(session.user.user_metadata.full_name || session.user.email || "?")[0]}
                        </div>
                      )}
                      <div className='user-text'>
                        <span className='user-name'>
                          {session.user.user_metadata.full_name || t.user_default}
                        </span>
                        <span className='user-email'>{session.user.email}</span>
                      </div>
                    </div>
                    {!tg?.initDataUnsafe?.user && (
                      <button className='logout-btn' onClick={handleLogout}>
                        <LogOut size={14} /> {t.logout || "Выйти"}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button className='menu-trigger-btn' onClick={onClose} style={{ marginTop: "-10px" }}>
                <X size={24} />
              </button>
            </div>

            <div className='sidebar-content'>
              <div className='sidebar-section'>
                <p className='sidebar-section-title'>
                  <Users size={14} /> {t.sidebar_title}
                </p>
                <div className='personality-list'>
                  {personalities.map((p) => (
                    <div
                      key={p.id}
                      className={`personality-item ${p.id === currentId ? "active" : ""}`}
                      style={p.id === currentId ? { borderColor: p.visual_style } : {}}
                    >
                      <div
                        className='personality-clickable-area'
                        onClick={() => {
                          onSelect(p.id);
                          onClose();
                        }}
                      >
                        <div className='persona-avatar-wrapper'>
                          <img
                            src={getAvatarUrl(p.avatar, p.name)}
                            alt={p.name}
                            className='persona-avatar-img'
                          />
                          {p.id === currentId && (
                            <span
                              className='persona-status-dot'
                              style={{
                                background: p.visual_style,
                                boxShadow: `0 0 8px ${p.visual_style}`,
                              }}
                            />
                          )}
                        </div>
                        <span className='persona-name'>{p.name}</span>
                      </div>

                      <div className='persona-menu-container'>
                        <button
                          className={`persona-more-btn ${activeMenu === p.id ? "active" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenu(activeMenu === p.id ? null : p.id);
                          }}
                        >
                          <MoreVertical size={18} />
                        </button>
                        <AnimatePresence>
                          {activeMenu === p.id && (
                            <>
                              <motion.div
                                className='menu-close-overlay'
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setActiveMenu(null)}
                              />
                              <motion.div
                                className='persona-dropdown'
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              >
                                {p.is_custom && (
                                  <button
                                    onClick={() => handleAction(onDeletePersona, p.id)}
                                    className='dropdown-item danger'
                                  >
                                    <Trash2 size={16} /> <span>{t.delete}</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleAction(onClearHistory, p.id)}
                                  className='dropdown-item'
                                >
                                  <Paintbrush size={16} /> <span>{t.clear_history}</span>
                                </button>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button className='add-friend-btn' onClick={onAdd}>
                <Plus size={20} />
                <span>{t.add_buddy}</span>
              </button>

              {/* 👇 ПЕРЕНЕСЛИ НАСТРОЙКИ ВНУТРЬ SIDEBAR-CONTENT */}
              <div className='sidebar-settings'>
                {/* Заголовок блока в стиле "Твои друзья" */}
                <p className='sidebar-section-title'>
                  <Settings size={14} /> {t.settings}
                </p>

                <div className='settings-row'>
                  {/* Язык */}
                  <button
                    className={`settings-btn ${lang === "en" ? "active" : ""}`}
                    onClick={() => setLang(lang === "ru" ? "en" : "ru")}
                  >
                    <Languages size={22} /> {/* 👈 Увеличили до 24 */}
                  </button>

                  {/* Тема */}
                  <button
                    className={`settings-btn theme-toggle ${theme}`}
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  >
                    {theme === "dark" ? <Sun size={22} /> : <Moon size={22} />}{" "}
                    {/* 👈 Увеличили до 24 */}
                  </button>
                </div>
              </div>
            </div>

            <div className='sidebar-footer'>
              <div className='app-version'>Vibe Buddy v0.89</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Sidebar;
