import React, { useState } from "react";
import { X, Sparkles, RefreshCw, ChevronDown, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { translations } from "./translations";

// Получаем URL API (теперь запрос идет отсюда)
const API_URL = import.meta.env.VITE_API_URL;

const CharacterLab = ({ isOpen, onClose, session, onCharacterAdded, lang = "ru" }) => {
  const avatarStyles = [
    { id: "avataaars", name: "Avatars" },
    { id: "lorelei", name: "Lorelei" },
    { id: "notionists", name: "Notionists" },
    { id: "open-peeps", name: "Open Peeps" },
    { id: "personas", name: "Personas" },
    { id: "bottts", name: "Bots" },
    { id: "micah", name: "Micah" },
    { id: "pixel-art", name: "Pixel Art" },
  ];

  const generateRandomSeed = () => Math.random().toString(36).substring(7);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    system_instruction: "",
    visual_style: "#0a84ff",
    avatar: `avataaars:${generateRandomSeed()}`,
  });

  const t = translations[lang].lab;

  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const [style, seed] = formData.avatar.split(":");
  const [showErrors, setShowErrors] = useState(false);

  // Добавили состояния загрузки и ошибки сервера
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState(null);

  // Вычисляем длину текста БЕЗ пробелов
  const systemTextWithoutSpaces = formData.system_instruction.replace(/\s/g, "");

  // Валидация
  const isNameValid = formData.name.trim().length > 0;
  const isDescValid = formData.description.trim().length > 0;

  // Проверяем честные 50 символов (без учета пробелов)
  const isSystemValid = systemTextWithoutSpaces.length >= 50;

  const isFormValid = isNameValid && isDescValid && isSystemValid;

  // Сколько осталось до 50 символов (без учета пробелов)
  const remaining = 50 - systemTextWithoutSpaces.length;

  const handleRandomize = () => {
    setFormData({ ...formData, avatar: `${style}:${generateRandomSeed()}` });
  };

  const handleStyleChange = (newStyle) => {
    setFormData({ ...formData, avatar: `${newStyle}:${seed}` });
    setIsStyleOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setShowErrors(true);
    setServerError(null);

    if (!isFormValid) return;

    // 1. Проверяем авторизацию
    const userId = session?.user?.id;
    if (!userId) {
      setServerError(t.lab_auth_error);
      return;
    }

    setIsLoading(true);

    // 2. Формируем полный объект
    const payload = {
      ...formData,
      is_custom: true,
      owner_id: userId, // 👈 Привязываем к юзеру
    };

    try {
      const response = await fetch(`${API_URL}/personalities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const newChar = await response.json();

        // 3. Передаем наверх готового персонажа
        onCharacterAdded(newChar);

        // Сброс формы
        onClose();
        setShowErrors(false);
        setFormData({
          name: "",
          description: "",
          system_instruction: "",
          visual_style: "#0a84ff",
          avatar: `avataaars:${generateRandomSeed()}`,
        });
      } else {
        throw new Error("Ошибка сервера при сохранении");
      }
    } catch (error) {
      console.error("Ошибка при создании бро:", error);
      setServerError("Не удалось сохранить. Попробуйте еще раз.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className='lab-overlay'>
      <div className='lab-modal'>
        <div className='lab-header'>
          <div className='lab-title'>
            <Sparkles size={20} color='var(--accent-blue)' />
            <span>{t.title}</span>
          </div>
          <button onClick={onClose} className='lab-close-btn'>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='lab-form'>
          {/* ОТОБРАЖЕНИЕ ОШИБОК СЕРВЕРА */}
          {serverError && <div className='lab-server-error'>{serverError}</div>}

          <div className='lab-field'>
            <label>{t.name}</label>
            <input
              required
              disabled={isLoading}
              className={showErrors && !isNameValid ? "input-error" : ""}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t.name_ph}
            />
          </div>

          {/* КОМПАКТНАЯ СТРОКА: Аватар + Цвет */}
          <div className='lab-row compact-appearance-row'>
            <div className='avatar-control-group'>
              <div className='avatar-mini-preview'>
                <img src={`https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`} alt='Preview' />
              </div>
              <div className='avatar-selectors'>
                {/* КАСТОМНЫЙ СЕЛЕКТОР */}
                <div className='custom-select-container'>
                  <div
                    className={`custom-select-trigger ${isStyleOpen ? "active" : ""}`}
                    onClick={() => !isLoading && setIsStyleOpen(!isStyleOpen)}
                  >
                    <span>{avatarStyles.find((s) => s.id === style)?.name}</span>
                    <ChevronDown size={14} className={isStyleOpen ? "rotate" : ""} />
                  </div>

                  <AnimatePresence>
                    {isStyleOpen && (
                      <motion.div
                        className='custom-options'
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        {avatarStyles.map((s) => (
                          <div
                            key={s.id}
                            className={`custom-option ${style === s.id ? "selected" : ""}`}
                            onClick={() => handleStyleChange(s.id)}
                          >
                            {s.name}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type='button'
                  onClick={handleRandomize}
                  className='lab-btn-icon'
                  disabled={isLoading}
                >
                  <RefreshCw size={12} />
                  <span>{t.random}</span>
                </button>
              </div>
            </div>

            {/* Группа Цвета */}
            <div className='color-control-group'>
              <label>{t.color}</label>
              <label className='color-picker-trigger'>
                <input
                  type='color'
                  className='hidden-color-input'
                  value={formData.visual_style}
                  onChange={(e) => setFormData({ ...formData, visual_style: e.target.value })}
                  disabled={isLoading}
                />
                <div
                  className='color-swatch-circle'
                  style={{ background: formData.visual_style }}
                />
                <span className='color-hex-text'>{formData.visual_style}</span>
              </label>
            </div>
          </div>

          <div className='lab-field'>
            <label>{t.prompt_1}</label>
            <input
              disabled={isLoading}
              className={showErrors && !isDescValid ? "input-error" : ""}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t.prompt_ph_1}
            />
          </div>

          <div className='lab-field'>
            <label>{t.prompt}</label>
            <textarea
              disabled={isLoading}
              className={showErrors && !isSystemValid ? "input-error" : ""}
              required
              rows='4'
              value={formData.system_instruction}
              onChange={(e) => setFormData({ ...formData, system_instruction: e.target.value })}
              placeholder={t.prompt_ph}
            />
            <span className={`field-hint ${remaining > 0 ? "hint-error" : "hint-success"}`}>
              {remaining > 0
                ? `${t.prompt_need} ${remaining} ${t.prompt_chars}` // Склеиваем локализованную строку
                : t.prompt_ready}
            </span>
          </div>

          <button
            type='submit'
            className='lab-submit-btn'
            disabled={!isFormValid || isLoading}
            style={{
              opacity: isFormValid && !isLoading ? 1 : 0.5,
              cursor: isFormValid && !isLoading ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {isLoading && <Loader2 className='animate-spin' size={18} />}
            {isLoading ? t.saving : t.save}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CharacterLab;
