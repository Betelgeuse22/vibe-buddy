from sqlmodel import Field, SQLModel, Relationship
from typing import List, Optional
from datetime import datetime

# 1. Личности (Макс, Лия и т.д.)


class Personality(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    system_instruction: str  # Тот самый промпт "вайбового друга"
    visual_style: str        # Hex-код или название темы

# 2. История сообщений


class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    role: str                # user или assistant
    content: str
    emotion: Optional[str] = None
    visual_hint: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Связь с конкретным диалогом
    conversation_id: Optional[int] = Field(
        default=None, foreign_key="conversation.id")
    personality_id: Optional[int] = Field(
        default=None, foreign_key="personality.id")

# 3. Контейнер для чата (чтобы сохранять сессии)


class Conversation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    personality_id: int = Field(foreign_key="personality.id")
