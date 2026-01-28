import React, { useState } from "react";
import { X, Sparkles } from "lucide-react";

const CharacterLab = ({ isOpen, onClose, onCharacterCreated }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    system_instruction: "",
    visual_style: "#0a84ff",
    avatar: "🤖",
  });

  // 1. Считаем символы для подсказки
  const minLength = 50;
  const currentLength = formData.system_instruction.length;
  const remaining = minLength - currentLength;

  // Состояние: нажимал ли пользователь кнопку "Создать"
  const [showErrors, setShowErrors] = useState(false);

  // Валидация отдельных полей
  const isNameValid = formData.name.trim().length > 0;
  const isDescValid = formData.description.trim().length > 0;
  const isAvatarValid = formData.avatar.trim().length > 0;
  const isSystemValid = formData.system_instruction.trim().length >= 50;

  const isFormValid = isNameValid && isDescValid && isAvatarValid && isSystemValid;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setShowErrors(true); // Включаем отображение ошибок при попытке отправки

    // Если хотя бы одно поле не проходит проверку — прерываем отправку
    if (!isNameValid || !isDescValid || !isAvatarValid || !isSystemValid) {
      return;
    }

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
        // Сбрасываем всё при успехе
        setShowErrors(false);
        setFormData({
          name: "",
          description: "",
          system_instruction: "",
          visual_style: "#0a84ff",
          avatar: "🤖",
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
        {/* Header */}
        <div className='lab-header'>
          <div className='lab-title'>
            <Sparkles size={20} color='var(--accent-blue)' />
            <span>Character Lab</span>
          </div>
          <button onClick={onClose} className='lab-close-btn'>
            <X size={24} />
          </button>
        </div>

        {/* Form */}
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

          <div className='lab-row'>
            <div className='lab-field'>
              <label>Аватар</label>
              <input
                className='text-center'
                value={formData.avatar}
                onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
              />
            </div>
            <div className='lab-field'>
              <label>Цвет темы</label>
              <input
                type='color'
                className='color-input'
                value={formData.visual_style}
                onChange={(e) => setFormData({ ...formData, visual_style: e.target.value })}
              />
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
