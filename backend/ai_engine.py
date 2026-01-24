import os
import json
from openai import AsyncOpenAI
from pydantic import BaseModel, ValidationError, Field
from dotenv import load_dotenv

# Загружаем переменные из .env (GROQ_API_KEY)
load_dotenv()

# Инициализируем клиента для работы с Groq API
# Мы используем AsyncOpenAI, чтобы сервер не "замирал", пока ждет ответа от нейросети
client = AsyncOpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)

# --- СХЕМА ВАЛИДАЦИИ (CONTRACT) ---
# Pydantic класс гарантирует, что ИИ не пришлет нам лишнего мусора.
# Если какое-то поле будет отсутствовать, сработают значения по умолчанию (default).


class VibeResponse(BaseModel):
    text: str = Field(default="Бро, я задумался, повтори еще раз?")
    emotion: str = Field(default="chill")
    visual_hint: str = Field(default="#ccc")

# --- ГЛАВНАЯ ФУНКЦИЯ "МОЗГА" ---


async def get_vibe_response(history_data, db_instruction: str):
    """
    history_data: список сообщений от пользователя и ИИ (из фронтенда)
    db_instruction: личный промпт персонажа (из нашей базы Supabase)
    """

    # 1. Формируем "Личность".
    # Склеиваем инструкцию из базы с жестким требованием возвращать только JSON.
    system_prompt = (
        f"{db_instruction} "
        "\n\nIMPORTANT: You must ALWAYS return a JSON object with EXACTLY these three fields: "
        "1. 'text' (string) "
        "2. 'emotion' (string) "
        "3. 'visual_hint' (hex color string). "
        "Do not omit any fields! Respond only in JSON."
    )

    # Начальный список сообщений для отправки в нейросеть
    messages = [{"role": "system", "content": system_prompt}]

    # 2. Конвертируем историю сообщений под стандарт OpenAI/Groq
    # Наш фронтенд присылает 'model', а Groq ждет 'assistant'
    for msg in history_data:
        role = "assistant" if msg.role in ["model", "assistant"] else "user"
        # Сообщение попадает в список в чистом текстовом виде
        messages.append({"role": role, "content": msg.parts[0]})

    try:
        # 3. Запрос к нейросети (Llama 3.3 70B)
        # temperature=0.8 дает персонажу немного "творческой свободы" и вайба
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.8,
            # Заставляем модель выдать именно JSON
            response_format={"type": "json_object"}
        )

        # Вытаскиваем текстовое содержимое из ответа API
        raw_content = response.choices[0].message.content

        # 4. Проверка данных через Pydantic.
        # Если ИИ прислал кривой JSON, Pydantic это поймает.
        validated_data = VibeResponse.model_validate_json(raw_content)

        # Превращаем объект класса обратно в обычный словарь (dict) для бэкенда
        return validated_data.model_dump()

    except ValidationError as ve:
        # Сработает, если ИИ выдал JSON, но забыл какое-то поле (например, 'emotion')
        print(f"❌ Ошибка структуры JSON: {ve}")
        return {"text": "Ой, я немного запутался в своих чувствах...", "emotion": "confused", "visual_hint": "gray"}

    except Exception as e:
        # Сработает, если API Groq упало или кончились токены
        print(f"❌ Ошибка API: {e}")
        return {"text": "Бро, что-то связь барахлит. Глянь консоль.", "emotion": "offline", "visual_hint": "red"}
