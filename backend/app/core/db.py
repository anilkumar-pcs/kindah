from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from fastapi import Request
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    """Declarative base for all module-owned tables."""


class Database:
    def __init__(self, url: str, connect_timeout_seconds: int = 3) -> None:
        connect_args: dict[str, Any] = {}
        if url.startswith("postgresql"):
            connect_args["connect_timeout"] = connect_timeout_seconds
        self.engine: Engine = create_engine(
            url,
            pool_pre_ping=True,
            connect_args=connect_args,
        )
        self._session_factory: sessionmaker[Session] = sessionmaker(
            bind=self.engine,
            autoflush=False,
            expire_on_commit=False,
        )

    def session(self) -> Session:
        return self._session_factory()

    def check(self) -> None:
        with self.engine.connect() as connection:
            connection.execute(text("SELECT 1"))

    def dispose(self) -> None:
        self.engine.dispose()


def get_db_session(request: Request) -> Iterator[Session]:
    database: Database = request.app.state.db
    session = database.session()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
