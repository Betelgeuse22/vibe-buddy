import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const WelcomeScreen = ({ onOpenSidebar, isLoading }) => {
  const [stage, setStage] = useState("text");

  // Устанавливаем 100, если данные уже загружены, иначе 0
  const [progress, setProgress] = useState(isLoading ? 0 : 100);

  useEffect(() => {
    let interval;

    if (isLoading) {
      // Стандартная схема "прогрева"
      setProgress(30);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev < 90) return prev + Math.random() * 2;
          return prev;
        });
      }, 800);
    } else {
      // Если уже загружено — мгновенно 100
      setProgress(100);
    }

    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    const timer = setTimeout(() => setStage("logo"), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className='welcome-screen'>
      <AnimatePresence mode='wait'>
        {stage === "text" ? (
          <motion.h2
            key='welcome-text'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, position: "absolute" }}
            transition={{ duration: 0.8 }}
            className='welcome-quote'
          >
            Выбери, с кем завайбим сегодня...
          </motion.h2>
        ) : (
          <motion.div
            key='welcome-logo'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className='welcome-logo-area'
          >
            <img src='/logo-light.png' alt='Logo' className='main-logo-img' />
            <h1 className='logo-text'>VibeBuddy</h1>

            {/* ШКАЛА: Показываем только если прогресс меньше 100 */}
            {progress < 100 && (
              <>
                <div className='progress-container'>
                  <motion.div
                    className='progress-bar'
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: "easeOut", duration: 0.5 }}
                  />
                </div>
                <p className='logo-sub'>Пробуждаю нейронные связи...</p>
              </>
            )}

            {/* Если всё готово, показываем финальный текст и кнопку */}
            {progress === 100 && (
              <>
                <p className='logo-sub'>Все друзья в сборе</p>
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className='start-btn'
                  onClick={onOpenSidebar}
                >
                  Выбрать друга
                </motion.button>
              </>
            )}
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
