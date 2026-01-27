import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

const WelcomeScreen = ({ onOpenSidebar }) => {
  const [stage, setStage] = useState("text"); // 'text' -> 'logo'

  useEffect(() => {
    // Через 3 секунды переключаем текст на логотип
    const timer = setTimeout(() => setStage("logo"), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className='welcome-screen'>
      <AnimatePresence mode='wait'>
        {stage === "text" ? (
          <motion.h2
            key='welcome-text'
            initial={{ opacity: 0, y: 5 }} // Уменьшили y для стабильности
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5, position: "absolute" }} // Добавили absolute на выход
            transition={{ duration: 0.8, ease: "easeInOut" }} // Сделали переход мягче
            className='welcome-quote'
          >
            Выбери, с кем завайбим сегодня...
          </motion.h2>
        ) : (
          <motion.div
            key='welcome-logo'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className='welcome-logo-area'
          >
            <div className='logo-glow'>
              <img
                src='/logo-light.png'
                size={60}
                alt='VibeBuddy Logo'
                color='var(--accent-blue)'
                className='main-logo-img'
              />
              {/* <Sparkles size={60} color='var(--accent-blue)' /> */}
            </div>
            <h1 className='logo-text'>VibeBuddy</h1>
            <p className='logo-sub'>Твой ИИ-круг общения</p>

            <button className='start-btn' onClick={onOpenSidebar}>
              Открыть список друзей
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WelcomeScreen;

{
  /* <img
  src='/logo-light.png'
  size={60}
  alt='VibeBuddy Logo'
  color='var(--accent-blue)'
  className='main-logo-img'
/>; */
}
