import os
from openai import AsyncOpenAI  # Используем универсальный стандарт
from dotenv import load_dotenv

load_dotenv()

# Инициализируем клиента для Groq
client = AsyncOpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"  # Указываем путь к Groq
)


async def get_vibe_response(history_data):
    try:
        messages = [
            {"role": "system", "content": os.getenv("SYSTEM_INSTRUCTIONS")}]

        for msg in history_data:
            role = "assistant" if msg.role == "model" else "user"
            messages.append({"role": role, "content": msg.parts[0]})

        # ОБНОВЛЕННЫЕ МОДЕЛИ 2026 ГОДА
        # 1. llama-3.3-70b-versatile (Умная, замена 3.1-70b)
        # 2. llama-3.1-8b-instant (Очень быстрая)

        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",  # <--- Поменяли здесь
            messages=messages,
            temperature=0.8,
            max_tokens=500
        )

        return response.choices[0].message.content

    except Exception as e:
        # Если 3.3 вдруг тоже закапризничает, попробуем instant-версию
        print(f"Ошибка модели: {e}")
        try:
            fallback = await client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=messages
            )
            return fallback.choices[0].message.content
        except:
            return "Бро, в Groq тоже бывают перегрузки. Дай мне 5 секунд! ☕"
