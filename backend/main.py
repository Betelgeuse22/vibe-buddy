from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List
from pydantic import BaseModel
from sqlmodel import select, Session, delete

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

# DTOs


class ChatMessage(BaseModel):
    role: str
    parts: List[str]


class ChatRequest(BaseModel):
    history: List[ChatMessage]
    personality_id: int


class PersonalityCreate(BaseModel):
    name: str
    description: str
    system_instruction: str
    visual_style: str
    avatar: str

# --- ЭНДПОИНТЫ ---


@app.get("/personalities")
def get_personalities(db: Session = Depends(get_session)):
    return db.exec(select(Personality)).all()


@app.get("/messages")
def get_messages(personality_id: int, db: Session = Depends(get_session)):
    statement = select(Message).where(Message.personality_id ==
                                      personality_id).order_by(Message.timestamp.asc())
    results = db.exec(statement).all()
    return [{"role": m.role, "parts": [m.content], "theme": m.visual_hint, "time": m.timestamp.isoformat() + "Z"} for m in results]


@app.post("/chat")
async def chat(request: ChatRequest, db: Session = Depends(get_session)):
    personality = db.exec(select(Personality).where(
        Personality.id == request.personality_id)).first()
    if not personality:
        raise HTTPException(status_code=404, detail="Персонаж не найден")

    db.add(Message(role="user",
           content=request.history[-1].parts[0], personality_id=request.personality_id))
    db.commit()

    response_data = await get_vibe_response(request.history, personality.system_instruction)

    db.add(Message(role="assistant", content=response_data["text"], emotion=response_data["emotion"],
           visual_hint=response_data["visual_hint"], personality_id=request.personality_id))
    db.commit()
    return response_data


@app.post("/personalities", response_model=Personality)
def create_personality(data: PersonalityCreate, db: Session = Depends(get_session)):
    new_p = Personality(**data.dict(), is_custom=True)
    db.add(new_p)
    db.commit()
    db.refresh(new_p)
    return new_p

# Очистка истории конкретного персонажа


@app.delete("/messages")
def clear_messages(personality_id: int, db: Session = Depends(get_session)):
    db.exec(delete(Message).where(Message.personality_id == personality_id))
    db.commit()
    return {"status": "success"}

# Полное удаление персонажа и его истории


@app.delete("/personalities/{p_id}")
def delete_personality(p_id: int, db: Session = Depends(get_session)):
    persona = db.get(Personality, p_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Друг не найден")

    if not persona.is_custom:
        raise HTTPException(
            status_code=403,
            detail="Попытка удаления системного персонажа! Доступ запрещен."
        )

    db.exec(delete(Message).where(Message.personality_id == p_id))
    db.delete(persona)
    db.commit()
    return {"status": "success", "message": "Персонаж удален"}


@app.get("/ping")
def ping(): return {"status": "ok"}
