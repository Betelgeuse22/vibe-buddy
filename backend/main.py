# python -m uvicorn main:app --reload
# http://127.0.0.1:8000/chat?text=Привет, проверка связи! Ты тут?


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ai_engine import get_vibe_response
from pydantic import BaseModel  # Добавили для работы с данными
from typing import List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Создаем структуру данных для истории


class Message(BaseModel):
    role: str  # 'user' или 'model'
    parts: List[str]  # сам текст


@app.post("/chat")  # Поменяли GET на POST, так как данных будет много
async def chat(history: List[Message]):
    # history — это весь наш список сообщений из React
    ai_answer = await get_vibe_response(history)
    return {"ai_response": ai_answer}
