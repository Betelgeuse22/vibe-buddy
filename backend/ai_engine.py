import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()
os.environ["PYTHONUTF8"] = "1"

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Читаем инструкцию из .env.
# Если вдруг она там не найдется, добавим запасной вариант (fallback)
system_prompt = os.getenv("SYSTEM_INSTRUCTIONS", "Ты — чилловый бро.")

VIBE_CONFIG = types.GenerateContentConfig(
    system_instruction=system_prompt,
    temperature=0.8,
)


async def get_vibe_response(history_data):
    formatted_history = []
    for msg in history_data:
        role = 'user' if msg.role == 'user' else 'model'
        formatted_history.append(
            types.Content(
                role=role,
                parts=[types.Part(text=str(p)) for p in msg.parts]
            )
        )

    # Мы используем ТОЛЬКО те имена, которые были в твоём списке 'check_models'
    # 'gemini-flash-latest' — это самый надёжный вариант
    models_to_try = ["gemini-flash-latest",
                     "gemini-2.0-flash", "gemini-2.0-flash-lite"]

    for model_name in models_to_try:
        try:
            print(
                f"--- Попытка запроса к модели из твоего списка: {model_name} ---")
            response = client.models.generate_content(
                model=model_name,
                config=VIBE_CONFIG,
                contents=formatted_history
            )
            return response.text
        except Exception as e:
            error_str = str(e).encode('utf-8', errors='ignore').decode('utf-8')
            print(f"Ошибка {model_name}: {error_str[:150]}...")
            continue  # Пробуем следующую модель из списка

    return "Бро, Google в Германии сегодня очень строг. Дай ему минуту отдыха! ☕"
