# python -m uvicorn main:app --reload
# http://127.0.0.1:8000/chat?text=Привет, проверка связи! Ты тут?


from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ai_engine import get_vibe_response
from pydantic import BaseModel  # Добавили для работы с данными
from typing import List

app = FastAPI()

# Список разрешенных адресов
origins = [
    "http://localhost:5173",          # Локальный React (Vite)
    "https://vibe-buddy.vercel.app",  # Твой фронтенд на Vercel
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Создаем структуру данных для истории


class Message(BaseModel):
    role: str  # 'user' или 'model'
    parts: List[str]  # сам текст


class ChatRequest(BaseModel):
    history: List[Message]


@app.post("/chat")  # Поменяли GET на POST, так как данных будет много
async def chat(request: ChatRequest):
    # Теперь данные лежат в request.history
    response = await get_vibe_response(request.history)
    return response
