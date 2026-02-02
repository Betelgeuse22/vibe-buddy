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


async def generate_summary(history: List[Any], current_summary: str = ""):
    full_text = f"Existing Memory: {current_summary if current_summary else 'None'}\n\nRecent History:\n"

    for m in history:
        # Получаем роль максимально безопасно
        raw_role = getattr(m, "role", None) or (
            m.get("role") if isinstance(m, dict) else "user")
        content = extract_content(m)
        if content:
            full_text += f"{raw_role}: {content}\n"

    prompt = (
        "You are a memory module. Create a concise summary of the conversation. "
        "Update the existing memory with NEW personal facts about the user. "
        "KEEP: Name, job, pets, mood patterns. DISCARD: Small talk. "
        "Stay within 5-8 sentences. Write in 3rd person."
    )

    try:
        response = await client.chat.completions.create(
            model=CURRENT_MODEL,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"History to analyze:\n{full_text}"}
            ],
            temperature=0.3
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"❌ Саммари упало: {e}")
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
