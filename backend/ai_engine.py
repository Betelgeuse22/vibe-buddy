import os
import json
from openai import AsyncOpenAI
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from dotenv import load_dotenv

load_dotenv()

client = AsyncOpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)

CURRENT_MODEL = "llama-3.3-70b-versatile"


class VibeResponse(BaseModel):
    text: str = Field(default="Бро, я задумался, повтори еще раз?")
    emotion: str = Field(default="chill")
    visual_hint: str = Field(default="#ccc")


def extract_content(msg: Any) -> str:
    """
    Универсальный и безопасный извлекатель текста.
    """
    # 1. Если это словарь (JSON из запроса)
    if isinstance(msg, dict):
        if "content" in msg and msg["content"]:
            return str(msg["content"])
        if "parts" in msg and isinstance(msg["parts"], list) and len(msg["parts"]) > 0:
            return str(msg["parts"][0])
        return ""

    # 2. Если это объект (SQLModel из БД или Pydantic модель)
    # Используем getattr вместо hasattr для надежности
    content = getattr(msg, "content", None)
    if content:
        return str(content)

    parts = getattr(msg, "parts", None)
    if parts and isinstance(parts, list) and len(parts) > 0:
        return str(parts[0])

    return ""

# --- ФУНКЦИЯ СУММАРИЗАЦИИ ---


async def generate_summary(
    client: Any,
    history: List[Any],
    current_summary: str = "",
    model: str = "gpt-4o-mini"
) -> str:
    """
    Генерирует сжатое досье на пользователя на основе последних сообщений.
    """

    # 1. Берем только последние N сообщений, чтобы не взорвать контекст
    # Саммари не нужно перечитывать ВСЮ историю, только то, что произошло недавно
    recent_messages = history[-10:]

    conversation_text = ""
    for m in recent_messages:
        # Универсальное извлечение данных (работает и с dict, и с Pydantic)
        role = getattr(m, "role", None) or m.get(
            "role") if isinstance(m, dict) else "unknown"

        # Обработка контента (иногда он бывает списком в GPT-4 Vision)
        content_raw = getattr(m, "content", None) or m.get(
            "content") if isinstance(m, dict) else ""
        if isinstance(content_raw, list):  # Если вдруг там мультимодальный контент
            content = " ".join([c.get('text', '')
                               for c in content_raw if c.get('type') == 'text'])
        else:
            content = str(content_raw)

        conversation_text += f"{role}: {content}\n"

    # Если диалог пустой, возвращаем старое саммари
    if not conversation_text.strip():
        return current_summary

    # 2. Улучшенный промпт для "Досье"
    # Мы просим модель работать аналитиком, а не просто "сжимать текст"
    system_prompt = (
        "You are an expert AI Memory Manager. Your goal is to maintain a concise but detailed user profile.\n"
        "Input:\n"
        "1. CURRENT PROFILE: The existing knowledge about the user.\n"
        "2. NEW DIALOGUE: Recent interaction chunks.\n\n"
        "Instructions:\n"
        "- Update the profile with NEW facts found in the dialogue (Name, Hobbies, Job, Pets, Specific Preferences).\n"
        "- CONTRADICTIONS: If new info contradicts old info, trust the new info (people change).\n"
        "- STYLE: Write in bullet points or a short paragraph. Keep it under 100 words.\n"
        "- IGNORE: Greetings, small talk, temporary context (e.g. 'I'm tired now').\n"
        "- OUTPUT: Return ONLY the updated profile text."
    )

    user_content = f"CURRENT PROFILE:\n{current_summary or 'Empty'}\n\nNEW DIALOGUE:\n{conversation_text}"

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            temperature=0.3,  # Низкая температура для точности фактов
            max_tokens=200
        )

        new_summary = response.choices[0].message.content.strip()
        print(f"✅ Memory Updated: {new_summary[:50]}...")  # Лог для отладки
        return new_summary

    except Exception as e:
        print(f"❌ Error updating memory: {e}")
        # Если упало — возвращаем старое, чтобы не потерять память
        return current_summary

# --- ГЛАВНАЯ ФУНКЦИЯ 'МОЗГА' ---


async def get_vibe_response(history_data: List[Any], db_instruction: str, current_summary: Optional[str] = None):
    memory_part = f"\n\n[USER PROFILE / SHARED HISTORY]:\n{current_summary}" if current_summary else ""

    system_prompt = (
        f"{db_instruction}"
        f"{memory_part}"
        "\n\nIMPORTANT: You are an AI friend. Respond ONLY with a JSON object containing 'text', 'emotion', and 'visual_hint'."
    )

    messages = [{"role": "system", "content": system_prompt}]

    for msg in history_data:
        content = extract_content(msg)
        if not content:
            continue  # Пропускаем пустые сообщения, чтобы не путать ИИ

        # Определяем роль для API (модель -> assistant)
        raw_role = getattr(msg, "role", None) or (
            msg.get("role") if isinstance(msg, dict) else "user")
        role = "assistant" if raw_role in ["model", "assistant"] else "user"

        messages.append({"role": role, "content": content})

    try:
        # ИСПРАВЛЕНО: completions вместо completify
        response = await client.chat.completions.create(
            model=CURRENT_MODEL,
            messages=messages,
            temperature=0.8,
            response_format={"type": "json_object"}
        )

        raw_content = response.choices[0].message.content
        return VibeResponse.model_validate_json(raw_content).model_dump()

    except Exception as e:
        print(f"❌ Ошибка в AI Engine: {e}")
        return {
            "text": "Бро, что-то мои нейроны запутались. Попробуй еще раз?",
            "emotion": "confused",
            "visual_hint": "#808080"
        }
