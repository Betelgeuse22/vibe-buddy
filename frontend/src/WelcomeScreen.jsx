import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { translations } from "./translations";

const WelcomeScreen = ({ onOpenSidebar, isLoading, theme = "dark", lang = "ru" }) => {
  const [stage, setStage] = useState("text");
  const t = translations[lang].welcome;

  // Устанавливаем 100, если данные уже загружены, иначе 0
  const [progress, setProgress] = useState(isLoading ? 0 : 100);
  useEffect(() => {
    let interval;

    if (isLoading) {
      setProgress(30);
      interval = setInterval(() => {
        setProgress((prev) => {
          // Если меньше 80% — идем бодро
          if (prev < 80) return prev + Math.random() * 5;
          // После 85% — замедляемся, но НЕ останавливаемся, ползем до 98%
          if (prev < 98) return prev + Math.random() * 0.5;
          return prev;
        });
      }, 400); // Сделали интервал чаще (400мс вместо 800мс) для плавности
    } else {
      // Когда isLoading = false, выстреливаем до 100
      setProgress(100);
    }

    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    const timer = setTimeout(() => setStage("logo"), 3000);
    return () => clearTimeout(timer);
  }, []);

  const logoSrc = theme === "dark" ? "/logo-light.png" : "/logo-dark.png";

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
            {t.quote}
          </motion.h2>
        ) : (
          <motion.div
            key='welcome-logo'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className='welcome-logo-area'
          >
            <img src={logoSrc} alt='Logo' className='main-logo-img' />
            <h1 className='logo-text'>VibeBuddy</h1>

            {/* ШКАЛА: Показываем только если прогресс меньше 100 */}
            {progress < 100 && (
              <>
                <div className='progress-container'>
                  <motion.div
                    className='progress-bar'
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{
                      // Применяем кривую "выстрела" (backOut эффект)
                      ease: [0.34, 1.56, 0.64, 1],
                      // Если прогресс 100, делаем анимацию короче (0.3с), чтобы она "залетала"
                      duration: progress === 100 ? 0.3 : 0.5,
                    }}
                  />
                </div>
                <p className='logo-sub'>{t.loading}</p>
              </>
            )}

            {/* Если всё готово, показываем финальный текст и кнопку */}
            {progress === 100 && (
              <>
                <p className='logo-sub'>{t.ready}</p>
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className='start-btn'
                  onClick={onOpenSidebar}
                >
                  {t.action}
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
