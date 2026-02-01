from sqlmodel import Field, SQLModel, Relationship
from typing import List, Optional
from datetime import datetime
import uuid  # 👈 ВАЖНО: Импортируем UUID для работы с Auth

# 1. Личности (Макс, Лия и т.д.)


class Personality(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: str = Field(default="Твой новый бро")
    system_instruction: str
    visual_style: str       # Hex-код
    avatar: str = Field(default="👤")

    # 📌 Логика доступа:
    # Если is_custom = False -> Это системный бот (видят все).
    # Если is_custom = True  -> Это личный бот, проверяем owner_id.
    is_custom: bool = Field(default=True)

    # Кто создал этого бота? (Если None — значит создал Админ/Система)
    owner_id: Optional[uuid.UUID] = Field(default=None, index=True)
    summary: Optional[str] = Field(default=None)

# 3. Контейнер для чата (Сессия диалога)


class Conversation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    personality_id: int = Field(foreign_key="personality.id")

    # 🔒 Чей это диалог?
    # Только этот юзер может видеть этот чат
    user_id: uuid.UUID = Field(index=True)

# 2. История сообщений


class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    role: str                # user или assistant
    content: str
    emotion: Optional[str] = None
    visual_hint: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Связи
    conversation_id: Optional[int] = Field(
        default=None, foreign_key="conversation.id")
    personality_id: Optional[int] = Field(
        default=None, foreign_key="personality.id")

    # 🔒 Дублируем владельца для быстрого доступа и RLS (Row Level Security)
    # Это позволит базе данных мгновенно отсекать чужие сообщения
    user_id: uuid.UUID = Field(index=True)
