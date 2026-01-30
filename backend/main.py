from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List, Optional
from pydantic import BaseModel
from sqlmodel import select, Session, delete, or_
import uuid  # 👈 1. Важный импорт

from models import Personality, Message
from database import init_db, get_session
from ai_engine import get_vibe_response


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(lifespan=lifespan)

# CORS
origins = ["http://localhost:5173", "https://vibe-buddy.vercel.app"]
app.add_middleware(CORSMiddleware, allow_origins=origins,
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- DTOs (Схемы данных) ---


class ChatMessage(BaseModel):
    role: str
    parts: List[str]


class ChatRequest(BaseModel):
    history: List[ChatMessage]
    personality_id: int
    # 👇 Кто пишет сообщение? (Если None - значит гость)
    user_id: Optional[uuid.UUID] = None


class PersonalityCreate(BaseModel):
    name: str
    description: str
    system_instruction: str
    visual_style: str
    avatar: str
    is_custom: bool = True
    # 👇 Кто создатель?
    owner_id: Optional[uuid.UUID] = None

# --- ЭНДПОИНТЫ ---


@app.get("/personalities")
def get_personalities(user_id: Optional[uuid.UUID] = None, db: Session = Depends(get_session)):
    """
    Возвращает:
    1. Системных персонажей (is_custom=False)
    2. ЛИБО персонажей, созданных этим юзером (owner_id=user_id)
    """
    query = select(Personality).where(
        or_(
            Personality.is_custom == False,
            Personality.owner_id == user_id
        )
    )
    return db.exec(query).all()


@app.get("/messages")
def get_messages(
    personality_id: int,
    user_id: Optional[uuid.UUID] = None,  # 👈 Фильтруем по юзеру
    db: Session = Depends(get_session)
):
    # Если юзер не передан, возвращаем пустоту (защита приватности)
    # Или можно разрешить читать общие чаты, если захочешь
    if not user_id:
        return []

    statement = select(Message).where(
        Message.personality_id == personality_id,
        Message.user_id == user_id  # 🔒 ТОЛЬКО сообщения этого юзера
    ).order_by(Message.timestamp.asc())

    results = db.exec(statement).all()
    return [{"role": m.role, "parts": [m.content], "theme": m.visual_hint, "time": m.timestamp.isoformat() + "Z"} for m in results]


@app.post("/chat")
async def chat(request: ChatRequest, db: Session = Depends(get_session)):
    personality = db.exec(select(Personality).where(
        Personality.id == request.personality_id)).first()

    if not personality:
        raise HTTPException(status_code=404, detail="Персонаж не найден")

    # 🔒 Если нет user_id (гость), мы пока не сохраняем историю в БД,
    # чтобы не ломать логику required полей.
    # Либо можно создать временного юзера.
    # Для MVP: Если есть user_id - сохраняем. Если нет - просто отвечаем.

    if request.user_id:
        # 1. Сохраняем сообщение юзера
        db.add(Message(
            role="user",
            content=request.history[-1].parts[0],
            personality_id=request.personality_id,
            user_id=request.user_id
        ))
        db.commit()

    # Генерация ответа
    response_data = await get_vibe_response(request.history, personality.system_instruction)

    if request.user_id:
        # 2. Сохраняем ответ ИИ
        db.add(Message(
            role="assistant",
            content=response_data["text"],
            emotion=response_data["emotion"],
            visual_hint=response_data["visual_hint"],
            personality_id=request.personality_id,
            user_id=request.user_id
        ))
        db.commit()

    return response_data


@app.post("/personalities", response_model=Personality)
def create_personality(data: PersonalityCreate, db: Session = Depends(get_session)):
    # Pydantic сам распакует owner_id из data.dict()
    new_p = Personality(**data.dict())
    db.add(new_p)
    db.commit()
    db.refresh(new_p)
    return new_p


@app.delete("/messages")
def clear_messages(
    personality_id: int,
    # 👈 Обязательно проверяем чей чат чистим
    user_id: Optional[uuid.UUID] = None,
    db: Session = Depends(get_session)
):
    if not user_id:
        raise HTTPException(status_code=401, detail="Неавторизованный запрос")

    # Удаляем только сообщения ЭТОГО пользователя с ЭТИМ ботом
    statement = delete(Message).where(
        Message.personality_id == personality_id,
        Message.user_id == user_id
    )
    db.exec(statement)
    db.commit()
    return {"status": "success"}


@app.delete("/personalities/{p_id}")
def delete_personality(p_id: int, user_id: Optional[uuid.UUID] = Query(None), db: Session = Depends(get_session)):
    persona = db.get(Personality, p_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Друг не найден")

    # Защита: удалить может только владелец
    if persona.is_custom:
        if str(persona.owner_id) != str(user_id):  # Сравниваем как строки для надежности
            raise HTTPException(
                status_code=403, detail="Это не твой бро, ты не можешь его удалить!")
    else:
        raise HTTPException(
            status_code=403, detail="Нельзя удалять системных персонажей")

    # Удаляем сообщения (каскадно или вручную)
    db.exec(delete(Message).where(Message.personality_id == p_id))
    db.delete(persona)
    db.commit()
    return {"status": "success", "message": "Персонаж удален"}


@app.get("/ping")
def ping(): return {"status": "ok"}
