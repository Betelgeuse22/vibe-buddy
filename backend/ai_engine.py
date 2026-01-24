import os
import json
from openai import AsyncOpenAI
from pydantic import BaseModel, ValidationError, Field
from dotenv import load_dotenv

load_dotenv()

client = AsyncOpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)


class VibeResponse(BaseModel):
    text: str = Field(default="Бро, я задумался, повтори еще раз?")
    emotion: str = Field(default="chill")
    visual_hint: str = Field(default="#ccc")

# ДОБАВИЛИ: Аргумент db_instruction


async def get_vibe_response(history_data, db_instruction: str):
    """
    history_data: список сообщений из фронтенда
    db_instruction: инструкция личности, полученная из PostgreSQL (Supabase)
    """

    # Теперь мы не лезем в .env, а берем то, что прислал main.py из базы
    system_prompt = (
        f"{db_instruction} "
        "\n\nIMPORTANT: You must ALWAYS return a JSON object with EXACTLY these three fields: "
        "1. 'text' (string) "
        "2. 'emotion' (string) "
        "3. 'visual_hint' (hex color string). "
        "Do not omit any fields! Respond only in JSON."
    )

    messages = [{"role": "system", "content": system_prompt}]

    for msg in history_data:
        # Приводим роли к стандарту OpenAI: 'user' или 'assistant'
        role = "assistant" if msg.role in ["model", "assistant"] else "user"
        # msg.parts[0] — это текст сообщения из твоего Pydantic-класса ChatMessage
        messages.append({"role": role, "content": msg.parts[0]})

    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.8,
            response_format={"type": "json_object"}
        )

        raw_content = response.choices[0].message.content
        validated_data = VibeResponse.model_validate_json(raw_content)

        return validated_data.model_dump()

    except ValidationError as ve:
        print(f"❌ Ошибка структуры JSON: {ve}")
        return {"text": "Ой, я немного запутался в своих чувствах...", "emotion": "confused", "visual_hint": "gray"}
    except Exception as e:
        print(f"❌ Ошибка API: {e}")
        return {"text": "Бро, что-то связь барахлит. Глянь консоль.", "emotion": "offline", "visual_hint": "red"}
