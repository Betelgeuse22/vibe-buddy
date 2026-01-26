from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List
from pydantic import BaseModel
from sqlmodel import select, Session

# Наши внутренние модули
from models import Personality, Message  # Схемы таблиц базы данных
from database import init_db, get_session  # Настройки подключения к БД
from ai_engine import get_vibe_response   # Функция обращения к нейросети

# --- ЖИЗНЕННЫЙ ЦИКЛ (LIFESPAN) ---
# Этот блок выполняется один раз: при запуске сервера и при его выключении


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 Поехали! Инициализация базы данных...")
    init_db()  # Создаем таблицы в Supabase, если их еще нет
    yield
    print("🛑 Сервер останавливается...")

app = FastAPI(lifespan=lifespan)

# --- БЕЗОПАСНОСТЬ (CORS) ---
# Разрешаем нашему фронтенду (на Vercel или localhost) делать запросы к этому API
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

# --- СХЕМЫ ДАННЫХ ДЛЯ ЗАПРОСОВ (DTO) ---
# Описываем, в каком виде фронтенд пришлет нам данные


class ChatMessage(BaseModel):
    role: str   # 'user' или 'model'
    parts: List[str]


class ChatRequest(BaseModel):
    history: List[ChatMessage]  # Список прошлых сообщений для контекста
    personality_id: int = 1     # Кому именно мы пишем (по умолчанию Максу)


class PersonalityCreate(BaseModel):
    name: str
    description: str
    system_instruction: str
    visual_style: str
    avatar: str

# --- ЭНДПОИНТЫ (МАРШРУТЫ) ---

# 1. Получить список всех друзей (Макс, Алиса и др.)


@app.get("/personalities")
def get_personalities(db: Session = Depends(get_session)):
    # Выполняем SQL: SELECT * FROM personality
    return db.exec(select(Personality)).all()

# 2. Получить историю сообщений конкретного персонажа


@app.get("/messages")
def get_messages(personality_id: int, db: Session = Depends(get_session)):
    # Выполняем SQL: SELECT * FROM message WHERE personality_id = X
    statement = select(Message).where(Message.personality_id ==
                                      personality_id).order_by(Message.timestamp.asc())
    results = db.exec(statement).all()

    return [
        {
            "role": m.role,
            "parts": [m.content],
            "theme": m.visual_hint,
            # Добавляем 'Z' для корректного времени на фронте
            "time": m.timestamp.isoformat() + "Z"
        } for m in results
    ]

# 3. ГЛАВНЫЙ ЭНДПОИНТ: Отправить сообщение и получить ответ


@app.post("/chat")
async def chat(request: ChatRequest, db: Session = Depends(get_session)):
    # Шаг 1: Ищем личность в базе, чтобы взять её секретную инструкцию (промпт)
    statement = select(Personality).where(
        Personality.id == request.personality_id)
    personality = db.exec(statement).first()

    if not personality:
        raise HTTPException(status_code=404, detail="Персонаж не найден")

    # Шаг 2: Сохраняем в базу то, что написал пользователь
    user_text = request.history[-1].parts[0]
    db.add(Message(
        role="user",
        content=user_text,
        personality_id=request.personality_id
    ))
    db.commit()  # Фиксируем изменения в Supabase

    # Шаг 3: Отправляем историю + инструкцию в "мозг" (ai_engine.py)
    response_data = await get_vibe_response(request.history, personality.system_instruction)

    # Шаг 4: Сохраняем то, что ответил ИИ
    db.add(Message(
        role="assistant",
        content=response_data["text"],
        emotion=response_data["emotion"],
        visual_hint=response_data["visual_hint"],
        personality_id=request.personality_id
    ))
    db.commit()

    # Шаг 5: Возвращаем ответ ИИ фронтенду
    return response_data

# 4. Проверка связи


@app.get("/health")
def health_check():
    return {"status": "alive", "db": "connected"}

# 5. Добавляем эндпоинт-пинг на бэкенд


@app.get("/ping")
def ping():
    return {"status": "ok"}


# 6. Добавление эндпоинта создания

@app.post("/personalities", response_model=Personality)
def create_personality(data: PersonalityCreate, db: Session = Depends(get_session)):
    # Создаем объект модели на основе присланных данных
    new_personality = Personality(
        name=data.name,
        description=data.description,
        system_instruction=data.system_instruction,
        visual_style=data.visual_style,
        avatar=data.avatar,
        is_custom=True  # Помечаем, что это пользовательский персонаж
    )

    db.add(new_personality)
    db.commit()      # Сохраняем в Supabase
    db.refresh(new_personality)  # Получаем созданный ID обратно

    return new_personality
