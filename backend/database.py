import os
from sqlmodel import create_engine, Session, SQLModel
from dotenv import load_dotenv

load_dotenv()

sqlite_url = os.getenv("DATABASE_URL")

# Engine — это главный объект, который управляет соединениями
# echo=True покажет в консоли, какой SQL генерирует код
engine = create_engine(sqlite_url, echo=True)


def init_db():
    # Эта команда берет все модели из models.py и создает таблицы в Supabase
    import models
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
