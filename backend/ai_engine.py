import os
import json
from openai import AsyncOpenAI
from pydantic import BaseModel, ValidationError, Field
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv()

# Инициализируем клиента
client = AsyncOpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)

# Выносим актуальную модель 2026 года в константу
CURRENT_MODEL = "llama-3.3-70b-versatile"


class VibeResponse(BaseModel):
    text: str = Field(default="Бро, я задумался, повтори еще раз?")
    emotion: str = Field(default="chill")
    visual_hint: str = Field(default="#ccc")

# --- ФУНКЦИЯ СУММАРИЗАЦИИ (СЖАТИЕ ПАМЯТИ) ---


async def generate_summary(history_data: List, current_summary: Optional[str] = None):
    """
    Использует Llama 4 для создания интеллектуального архива диалога.
    Безопасно обрабатывает и объекты БД, и словари.
    """
    content_list = []
    for m in history_data:
        # Безопасное извлечение роли и текста
        if hasattr(m, 'role'):
            role = m.role
            parts = m.parts
        else:
            role = m.get('role', 'user')
            parts = m.get('parts', [""])

        text = parts[0] if parts else ""
        content_list.append(f"{role}: {text}")

    content_to_summarize = "\n".join(content_list)

    prompt = (
        "Create a concise summary of the conversation. "
        "STRATEGY: Update the existing memory with new information. "
        "1. NEVER discard permanent personal facts about the user (names, pets, preferences, job). "
        "2. Discard temporary small talk or finished topics. "
        "3. Keep the summary within 8-10 sentences if there are many important facts. "
        f"\nOld Memory to update: {current_summary if current_summary else 'None'}"
    )

    try:
        response = await client.chat.completions.create(
            model=CURRENT_MODEL,
            messages=[
                {"role": "system", "content": "You are a highly efficient memory assistant. Synthesize facts while preserving personality context."},
                {"role": "user", "content": f"{prompt}\n\nChat history:\n{content_to_summarize}"}
            ],
            temperature=0.3
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"❌ Ошибка при создании саммари: {e}")
        return current_summary

# --- ГЛАВНАЯ ФУНКЦИЯ "МОЗГА" ---


async def get_vibe_response(history_data, db_instruction: str, current_summary: Optional[str] = None):
    """
    Генерирует ответ персонажа, учитывая его 'душу' и долгосрочную память.
    """

    memory_context = f"\n\nPERMANENT MEMORY OF PAST EVENTS: {current_summary}" if current_summary else ""

    system_prompt = (
        f"{db_instruction} "
        f"{memory_context}"
        "\n\nIMPORTANT: You must ALWAYS return a JSON object with EXACTLY these three fields: "
        "1. 'text' (string) "
        "2. 'emotion' (string) "
        "3. 'visual_hint' (hex color string). "
        "Respond ONLY in valid JSON format."
    )

    messages = [{"role": "system", "content": system_prompt}]

    for msg in history_data:
        # Безопасная проверка: объект это или словарь
        if hasattr(msg, 'role'):
            role_val = msg.role
            parts = msg.parts
        else:
            role_val = msg.get('role', 'user')
            parts = msg.get('parts', [""])

        content_val = parts[0] if parts else ""

        # Приведение роли к стандарту Groq
        role = "assistant" if role_val in ["model", "assistant"] else "user"
        messages.append({"role": role, "content": content_val})

    try:
        response = await client.chat.completions.create(
            model=CURRENT_MODEL,
            messages=messages,
            temperature=0.85,
            response_format={"type": "json_object"}
        )

        raw_content = response.choices[0].message.content
        validated_data = VibeResponse.model_validate_json(raw_content)
        return validated_data.model_dump()

    except Exception as e:
        print(f"❌ Ошибка API: {e}")
        return {"text": "Бро, мои нейроны запутались. Попробуй еще раз?", "emotion": "offline", "visual_hint": "red"}
