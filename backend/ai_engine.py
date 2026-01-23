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

# 1. Схема данных (наш контракт)


class VibeResponse(BaseModel):
    text: str = Field(default="Бро, я задумался, повтори еще раз?")
    emotion: str = Field(default="chill")
    visual_hint: str = Field(default="#ccc")


async def get_vibe_response(history_data):
    # Подготавливаем системную инструкцию
    # В 2026 году в системный промпт лучше явно вшивать описание JSON
    system_prompt = (
        f"{os.getenv('SYSTEM_INSTRUCTIONS')} "
        "IMPORTANT: You must ALWAYS return a JSON object with EXACTLY these three fields: "
        "1. 'text' (string) "
        "2. 'emotion' (string) "
        "3. 'visual_hint' (hex color string). "
        "Do not omit any fields!"
    )

    messages = [{"role": "system", "content": system_prompt}]

    for msg in history_data:
        role = "assistant" if msg.role == "model" else "user"
        messages.append({"role": role, "content": msg.parts[0]})

    try:
        # 2. Вызов модели с требованием JSON
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.8,
            # Включаем JSON Mode (стандарт OpenAI/Groq)
            response_format={"type": "json_object"}
        )

        raw_content = response.choices[0].message.content

        # 3. Валидация через Pydantic
        # Мы превращаем строку в объект Python
        validated_data = VibeResponse.model_validate_json(raw_content)

        # Возвращаем словарь (FastAPI сам преобразует его в JSON для фронтенда)
        return validated_data.model_dump()

    except ValidationError as ve:
        print(f"Ошибка структуры JSON: {ve}")
        return {"text": "Ой, я немного запутался в своих чувствах...", "emotion": "confused", "visual_hint": "gray"}
    except Exception as e:
        print(f"Ошибка API: {e}")
        return {"text": "Бро, что-то связь барахлит.", "emotion": "offline", "visual_hint": "red"}
