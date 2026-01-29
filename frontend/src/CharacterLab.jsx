import React, { useState } from "react";
import { X, Sparkles, RefreshCw, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CharacterLab = ({ isOpen, onClose, onCharacterCreated }) => {
  const avatarStyles = [
    { id: "avataaars", name: "Avataaars" },
    { id: "lorelei", name: "Lorelei" },
    { id: "notionists", name: "Notionists" },
    { id: "open-peeps", name: "Open Peeps" },
    { id: "personas", name: "Personas" },
    { id: "bottts", name: "Bottts" },
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

  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const [style, seed] = formData.avatar.split(":");
  const [showErrors, setShowErrors] = useState(false);

  // Валидация
  const isNameValid = formData.name.trim().length > 0;
  const isDescValid = formData.description.trim().length > 0;
  const isSystemValid = formData.system_instruction.trim().length >= 50;
  const isFormValid = isNameValid && isDescValid && isSystemValid;

  const remaining = 50 - formData.system_instruction.length;

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

    if (!isFormValid) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/personalities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const newChar = await response.json();
        onCharacterCreated(newChar);
        onClose();
        setShowErrors(false);
        setFormData({
          name: "",
          description: "",
          system_instruction: "",
          visual_style: "#0a84ff",
          avatar: `avataaars:${generateRandomSeed()}`,
        });
      }
    } catch (error) {
      console.error("Ошибка при создании бро:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className='lab-overlay'>
      <div className='lab-modal'>
        <div className='lab-header'>
          <div className='lab-title'>
            <Sparkles size={20} color='var(--accent-blue)' />
            <span>Character Lab</span>
          </div>
          <button onClick={onClose} className='lab-close-btn'>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='lab-form'>
          <div className='lab-field'>
            <label>Имя бро</label>
            <input
              required
              className={showErrors && !isNameValid ? "input-error" : ""}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder='Напр: Кибер-Кот'
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
                    onClick={() => setIsStyleOpen(!isStyleOpen)}
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

                <button type='button' onClick={handleRandomize} className='lab-btn-icon'>
                  <RefreshCw size={12} />
                  <span>Рандом</span>
                </button>
              </div>
            </div>

            {/* Группа Цвета (теперь вся область кликабельна) */}
            <div className='color-control-group'>
              <label>Тема</label>
              <label className='color-picker-trigger'>
                <input
                  type='color'
                  className='hidden-color-input'
                  value={formData.visual_style}
                  onChange={(e) => setFormData({ ...formData, visual_style: e.target.value })}
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
            <label>Кто он? (Описание)</label>
            <input
              className={showErrors && !isDescValid ? "input-error" : ""}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder='Коротко о характере...'
            />
          </div>

          <div className='lab-field'>
            <label>Системная инструкция (Душа)</label>
            <textarea
              className={showErrors && !isSystemValid ? "input-error" : ""}
              required
              rows='4'
              value={formData.system_instruction}
              onChange={(e) => setFormData({ ...formData, system_instruction: e.target.value })}
              placeholder='Напиши, как он должен общаться...'
            />
            <span className={`field-hint ${remaining > 0 ? "hint-error" : "hint-success"}`}>
              {remaining > 0
                ? `Нужно еще минимум ${remaining} симв. для крутого вайба`
                : "Вайб настроен! ✨"}
            </span>
          </div>

          <button
            type='submit'
            className='lab-submit-btn'
            style={{
              opacity: isFormValid ? 1 : 0.5,
              cursor: isFormValid ? "pointer" : "not-allowed",
            }}
          >
            Создать персонажа
          </button>
        </form>
      </div>
    </div>
  );
};

export default CharacterLab;
