"""Acesso ao Postgres."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row

from . import config


@contextmanager
def conectar() -> Iterator[psycopg.Connection]:
    with psycopg.connect(config.DB_URL, row_factory=dict_row) as conexao:
        yield conexao


def consultar(sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    with conectar() as conexao, conexao.cursor() as cursor:
        cursor.execute(sql, params or {})
        return cursor.fetchall()
