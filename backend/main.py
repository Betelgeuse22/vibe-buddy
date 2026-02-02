import uuid
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List, Optional
from pydantic import BaseModel
from sqlmodel import select, Session, delete, or_

# Наши модули
from models import Personality, Message, Conversation
from database import init_db, get_session
from ai_engine import get_vibe_response, generate_summary


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Инициализация БД при старте
    init_db()
    yield

app = FastAPI(
    title="Vibe Buddy API",
    version="7.0.0",
    lifespan=lifespan
)

# --- НАСТРОЙКА CORS ---
origins = [
    "http://localhost:5173",
    "https://vibe-buddy.vercel.app"
]
# --- НАСТРОЙКА CORS (Stage 7.1: Super Flexible) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://vibe-buddy.vercel.app",
        # Добавляем на случай, если Vercel меняет домены (preview-развертывания)
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DTOs (Схемы данных для API) ---


class ChatMessage(BaseModel):
    role: str
    parts: List[str]


class ChatRequest(BaseModel):
    history: List[ChatMessage]
    personality_id: int
    user_id: Optional[uuid.UUID] = None


class PersonalityCreate(BaseModel):
    name: str
    description: str
    system_instruction: str
    visual_style: str
    avatar: str
    is_custom: bool = True
    owner_id: Optional[uuid.UUID] = None

# --- ЭНДПОИНТЫ: ПЕРСОНАЖИ ---


@app.get("/personalities")
def get_personalities(user_id: Optional[uuid.UUID] = None, db: Session = Depends(get_session)):
    """Получаем список доступных 'бро': системных + созданных юзером."""
    query = select(Personality).where(
        or_(
            Personality.is_custom == False,
            Personality.owner_id == user_id
        )
    )
    return db.exec(query).all()


@app.post("/personalities", response_model=Personality)
def create_personality(data: PersonalityCreate, db: Session = Depends(get_session)):
    """Создаем нового кастомного персонажа."""
    new_p = Personality(**data.dict())
    db.add(new_p)
    db.commit()
    db.refresh(new_p)
    return new_p


@app.delete("/personalities/{p_id}")
def delete_personality(p_id: int, user_id: Optional[uuid.UUID] = Query(None), db: Session = Depends(get_session)):
    """Удаляем персонажа, если мы его владельцы."""
    persona = db.get(Personality, p_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Друг не найден")

    if persona.is_custom:
        if str(persona.owner_id) != str(user_id):
            raise HTTPException(status_code=403, detail="Это не твой бро!")
    else:
        raise HTTPException(
            status_code=403, detail="Системных персонажей нельзя удалять")

    # Удаляем и сообщения, и самого персонажа
    db.exec(delete(Message).where(Message.personality_id == p_id))
    db.delete(persona)
    db.commit()
    return {"status": "success"}

# --- ЭНДПОИНТЫ: ЧАТ И ПАМЯТЬ ---


@app.get("/messages")
def get_messages(personality_id: int, user_id: Optional[uuid.UUID] = None, db: Session = Depends(get_session)):
    """Загружаем историю сообщений для конкретной пары Юзер-Бот."""
    if not user_id:
        return []

    statement = select(Message).where(
        Message.personality_id == personality_id,
        Message.user_id == user_id
    ).order_by(Message.timestamp.asc())

    results = db.exec(statement).all()
    return [
        {
            "role": m.role,
            "parts": [m.content],
            "theme": m.visual_hint,
            "time": m.timestamp.isoformat() + "Z"
        } for m in results
    ]


@app.post("/chat")
async def chat(request: ChatRequest, db: Session = Depends(get_session)):
    """Главный движок общения с ИИ и управления памятью."""

    # 1. Проверка персонажа
    personality = db.exec(select(Personality).where(
        Personality.id == request.personality_id)).first()
    if not personality:
        raise HTTPException(status_code=404, detail="Персонаж не найден")

    current_summary = ""
    conversation = None

    # 2. Работа с личным диалогом
    if request.user_id:
        user_uuid_str = str(request.user_id)

        # Ищем или создаем запись Conversation
        conversation = db.exec(select(Conversation).where(
            Conversation.user_id == user_uuid_str,
            Conversation.personality_id == request.personality_id
        )).first()

        if not conversation:
            conversation = Conversation(
                user_id=user_uuid_str,
                personality_id=request.personality_id,
                summary=""
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)

        current_summary = conversation.summary

        # Сохраняем входящее сообщение юзера (с привязкой к диалогу!)
        db.add(Message(
            role="user",
            content=request.history[-1].parts[0],
            personality_id=request.personality_id,
            user_id=request.user_id,
            conversation_id=conversation.id  # <-- Важная связка
        ))
        db.commit()

    # 3. Получаем ответ от AI Engine
    response_data = await get_vibe_response(
        request.history,
        personality.system_instruction,
        current_summary
    )

    # 4. Сохраняем ответ ИИ и проверяем память
    if request.user_id and conversation:
        # Сначала сохраняем ответ ассистента в базу
        db.add(Message(
            role="assistant",
            content=response_data["text"],
            emotion=response_data["emotion"],
            visual_hint=response_data["visual_hint"],
            personality_id=request.personality_id,
            user_id=request.user_id,
            conversation_id=conversation.id  # <-- Важная связка
        ))
        db.commit()

        # Теперь считаем актуальное кол-во сообщений из базы
        history_in_db = db.exec(select(Message).where(
            Message.user_id == request.user_id,
            Message.personality_id == request.personality_id
        )).all()

        count = len(history_in_db)
        print(f"📊 Сообщений в базе: {count}")

        # 5. Триггер суммаризации (каждые 20 сообщений)
        if count > 0 and count % 20 == 0:
            print(f"🧠 Генерирую саммари для {personality.name}...")
            new_summary = await generate_summary(history_in_db, conversation.summary)

            if new_summary:
                conversation.summary = new_summary
                db.add(conversation)
                db.commit()
                db.refresh(conversation)
                print(f"✅ Память обновлена!")

    return response_data


@app.delete("/messages")
def clear_messages(personality_id: int, user_id: Optional[uuid.UUID] = None, db: Session = Depends(get_session)):
    """Очистка истории чата (саммари при этом сохраняется в Conversation)."""
    if not user_id:
        raise HTTPException(status_code=401, detail="Нужен ID пользователя")

    db.exec(delete(Message).where(
        Message.personality_id == personality_id,
        Message.user_id == user_id
    ))
    db.commit()
    return {"status": "history cleared"}


@app.get("/ping")
def ping():
    return {"status": "online", "version": "7.0.0"}
