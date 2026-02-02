import os
import json
from openai import AsyncOpenAI
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from dotenv import load_dotenv

load_dotenv()

# Инициализируем асинхронного клиента
client = AsyncOpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)

# Актуальная модель
CURRENT_MODEL = "llama-3.3-70b-versatile"


class VibeResponse(BaseModel):
    text: str = Field(default="Бро, я задумался, повтори еще раз?")
    emotion: str = Field(default="chill")
    visual_hint: str = Field(default="#ccc")


def extract_content(msg: Any) -> str:
    """
    Универсальный помощник для извлечения текста из сообщения.
    Поддерживает: объекты БД (.content), Pydantic схемы (.parts) и словари.
    """
    # 1. Если это объект из БД (SQLModel)
    if hasattr(msg, "content") and msg.content:
        return msg.content

    # 2. Если это объект из API запроса (Pydantic)
    if hasattr(msg, "parts") and msg.parts:
        return msg.parts[0]

    # 3. Если это обычный словарь (JSON)
    if isinstance(msg, dict):
        if "content" in msg:
            return msg["content"]
        if "parts" in msg:
            return msg["parts"][0]

    return str(msg)

# --- ФУНКЦИЯ СУММАРИЗАЦИИ (СЖАТИЕ ПАМЯТИ) ---


async def generate_summary(history: List[Any], current_summary: str = ""):
    """
    Сжимает историю диалога в краткое саммари, чтобы персонаж не забывал важное.
    """
    full_text = f"Existing Memory: {current_summary if current_summary else 'None'}\n\nRecent History:\n"

    for m in history:
        role = getattr(m, "role", "user")
        content = extract_content(m)
        full_text += f"{role}: {content}\n"

    prompt = (
        "You are a memory module. Create a concise summary of the conversation. "
        "STRATEGY: Update the existing memory with NEW facts from the history. "
        "1. KEEP: Names, preferences, important life events, user's occupation. "
        "2. DISCARD: Greetings, temporary mood, small talk, closed topics. "
        "3. LIMIT: Stay within 5-8 clear sentences. "
        "Write in 3rd person."
    )

    try:
        response = await client.chat.completions.create(
            model=CURRENT_MODEL,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"Update memory based on this:\n{full_text}"}
            ],
            temperature=0.3
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"❌ Ошибка при создании саммари: {e}")
        return current_summary

# --- ГЛАВНАЯ ФУНКЦИЯ 'МОЗГА' ---


async def get_vibe_response(history_data: List[Any], db_instruction: str, current_summary: Optional[str] = None):
    """
    Генерирует ответ персонажа, учитывая его инструкцию и долгосрочную память.
    """

    # Добавляем память в системный промпт
    memory_part = f"\n\nYOUR MEMORY OF USER: {current_summary}" if current_summary else ""

    system_prompt = (
        f"{db_instruction}"
        f"{memory_part}"
        "\n\nIMPORTANT: Return ONLY a JSON object with: 'text', 'emotion', 'visual_hint'."
    )

    messages = [{"role": "system", "content": system_prompt}]

    for msg in history_data:
        # Извлекаем текст через универсальную функцию
        content = extract_content(msg)

        # Определяем роль (нормализация для Groq)
        raw_role = getattr(msg, "role", "user") if hasattr(
            msg, "role") else msg.get("role", "user")
        role = "assistant" if raw_role in ["model", "assistant"] else "user"

        if content:
            messages.append({"role": role, "content": content})

    try:
        response = await client.chat.completions.create(
            model=CURRENT_MODEL,
            messages=messages,
            temperature=0.8,  # Больше вайба и креатива
            response_format={"type": "json_object"}
        )

        raw_content = response.choices[0].message.content
        # Валидация через Pydantic
        validated_data = VibeResponse.model_validate_json(raw_content)
        return validated_data.model_dump()

    except Exception as e:
        print(f"❌ Ошибка в AI Engine: {e}")
        return {
            "text": "Бро, что-то мои нейроны запутались. Давай еще раз?",
            "emotion": "confused",
            "visual_hint": "#808080"
        }
