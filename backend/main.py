# uvicorn main:app --reload

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List
from pydantic import BaseModel
from sqlmodel import select, Session

# Импортируем наши модели и базу
from models import Personality, Message
from database import init_db, get_session
from ai_engine import get_vibe_response


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Поехали! Инициализация базы данных...")
    init_db()
    yield
    print("🛑 Сервер останавливается...")

app = FastAPI(lifespan=lifespan)

# Настройка CORS — здесь всё верно, разрешаем фронтенду доступ
origins = [
    "http://localhost:5173",
    "https://vibe-buddy.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Схемы данных


class ChatMessage(BaseModel):
    role: str   # 'user' или 'assistant'
    parts: List[str]


class ChatRequest(BaseModel):
    history: List[ChatMessage]
    personality_id: int = 1

# --- ЭНДПОИНТЫ ---


@app.get("/personalities")
def get_personalities(db: Session = Depends(get_session)):
    return db.exec(select(Personality)).all()


@app.get("/messages")
def get_messages(personality_id: int, db: Session = Depends(get_session)):
    # Фильтруем сообщения по ID персонажа
    statement = select(Message).where(Message.personality_id ==
                                      personality_id).order_by(Message.timestamp.asc())
    results = db.exec(statement).all()

    return [
        {
            "role": m.role,
            "parts": [m.content],
            "theme": m.visual_hint,
            "time": m.timestamp.isoformat()
        } for m in results
    ]


@app.post("/chat")
async def chat(request: ChatRequest, db: Session = Depends(get_session)):
    # 1. Находим персонажа
    statement = select(Personality).where(
        Personality.id == request.personality_id)
    personality = db.exec(statement).first()

    if not personality:
        raise HTTPException(status_code=404, detail="Персонаж не найден")

    # 2. Сохраняем сообщение пользователя (ВАЖНО: добавляем personality_id!)
    user_text = request.history[-1].parts[0]
    db.add(Message(
        role="user",
        content=user_text,
        personality_id=request.personality_id  # ТЕПЕРЬ МЫ ЗАПИСЫВАЕМ КТО ЭТО ПИСАЛ
    ))
    db.commit()

    # 3. Получаем ответ от ИИ
    response_data = await get_vibe_response(request.history, personality.system_instruction)

    # 4. Сохраняем ответ ИИ (ВАЖНО: добавляем personality_id!)
    db.add(Message(
        role="assistant",
        content=response_data["text"],
        emotion=response_data["emotion"],
        visual_hint=response_data["visual_hint"],
        personality_id=request.personality_id  # ТЕПЕРЬ МЫ ЗАПИСЫВАЕМ ЧЕЙ ЭТО ОТВЕТ
    ))
    db.commit()

    return response_data


@app.get("/health")
def health_check():
    return {"status": "alive", "db": "connected"}
