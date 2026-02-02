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
    init_db()
    yield

app = FastAPI(title="Vibe Buddy API", version="7.1.0", lifespan=lifespan)

# --- НАСТРОЙКА CORS ---
origins = [
    "http://localhost:5173",
    "https://vibe-buddy.vercel.app",
    "https://web.telegram.org",
    "https://t.me",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- DTOs (Схемы данных) ---


class ChatMessage(BaseModel):
    role: str
    parts: List[str]


class ChatRequest(BaseModel):
    history: List[ChatMessage]
    personality_id: int
    user_id: Optional[str] = None  # 👈 Теперь принимаем как строку (str)


class PersonalityCreate(BaseModel):
    name: str
    description: str
    system_instruction: str
    visual_style: str
    avatar: str
    is_custom: bool = True
    owner_id: Optional[str] = None  # 👈 Тоже строка

# --- ЭНДПОИНТЫ: ПЕРСОНАЖИ ---


@app.get("/personalities")
def get_personalities(user_id: Optional[str] = None, db: Session = Depends(get_session)):
    # Приводим к строке, если ID пришел
    uid_str = str(user_id) if user_id else None

    query = select(Personality).where(
        or_(
            Personality.is_custom == False,
            Personality.owner_id == uid_str
        )
    )
    return db.exec(query).all()


@app.post("/personalities")
def create_personality(item: PersonalityCreate, db: Session = Depends(get_session)):
    try:
        # Создаем объект модели для базы данных
        new_persona = Personality.model_validate(item)

        # Гарантируем, что ID владельца — строка (на всякий случай)
        if new_persona.owner_id:
            new_persona.owner_id = str(new_persona.owner_id)

        db.add(new_persona)
        db.commit()
        db.refresh(new_persona)

        print(
            f"✅ Создан новый персонаж: {new_persona.name} для {new_persona.owner_id}")
        return new_persona

    except Exception as e:
        db.rollback()  # Откатываем изменения, если что-то пошло не так
        print(f"❌ Ошибка при создании персонажа: {e}")
        raise HTTPException(
            status_code=500, detail=f"Database error: {str(e)}")


@app.delete("/personalities/{p_id}")
def delete_personality(p_id: int, db: Session = Depends(get_session)):
    personality = db.get(Personality, p_id)
    if not personality:
        raise HTTPException(status_code=404, detail="Персонаж не найден")

    # Также удаляем все сообщения, связанные с этим персонажем
    db.exec(delete(Message).where(Message.personality_id == p_id))

    db.delete(personality)
    db.commit()
    return {"status": "deleted"}

# --- ЭНДПОИНТЫ: ЧАТ И ПАМЯТЬ ---


@app.get("/messages")
def get_messages(personality_id: int, user_id: Optional[str] = None, db: Session = Depends(get_session)):
    if not user_id:
        return []

    # 🔑 ГЛАВНЫЙ ФИКС: Принудительная конвертация в строку
    uid_str = str(user_id)

    statement = select(Message).where(
        Message.personality_id == personality_id,
        Message.user_id == uid_str
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
    personality = db.exec(select(Personality).where(
        Personality.id == request.personality_id)).first()
    if not personality:
        raise HTTPException(status_code=404, detail="Персонаж не найден")

    current_summary = ""
    conversation = None

    if request.user_id:
        # 🔑 Приводим ID к строке (для Google UUID и Telegram ID одинаково)
        uid_str = str(request.user_id)

        conversation = db.exec(select(Conversation).where(
            Conversation.user_id == uid_str,
            Conversation.personality_id == request.personality_id
        )).first()

        if not conversation:
            conversation = Conversation(
                user_id=uid_str,
                personality_id=request.personality_id,
                summary=""
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)

        current_summary = conversation.summary

        # Сохраняем сообщение юзера
        db.add(Message(
            role="user",
            content=request.history[-1].parts[0],
            personality_id=request.personality_id,
            user_id=uid_str
        ))
        db.commit()

    response_data = await get_vibe_response(
        request.history,
        personality.system_instruction,
        current_summary
    )

    if conversation and len(request.history) % 20 == 0:
        new_summary = await generate_summary(request.history, conversation.summary)
        conversation.summary = new_summary
        db.add(conversation)
        db.commit()

    if request.user_id:
        db.add(Message(
            role="assistant",
            content=response_data["text"],
            emotion=response_data["emotion"],
            visual_hint=response_data["visual_hint"],
            personality_id=request.personality_id,
            user_id=str(request.user_id)
        ))
        db.commit()

    return response_data


@app.delete("/messages")
def clear_messages(personality_id: int, user_id: Optional[str] = None, db: Session = Depends(get_session)):
    if not user_id:
        raise HTTPException(status_code=401, detail="Нужен ID пользователя")

    db.exec(delete(Message).where(
        Message.personality_id == personality_id,
        Message.user_id == str(user_id)
    ))
    db.commit()
    return {"status": "history cleared"}


@app.get("/ping")
def ping():
    return {"status": "online", "version": "7.1.0"}
