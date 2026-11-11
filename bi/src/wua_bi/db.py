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


def executar_arquivo(conexao: psycopg.Connection, caminho) -> None:
    conexao.execute(caminho.read_text(encoding="utf-8"))


def aplicar_ddl() -> list[str]:
    """Roda os tres arquivos de DDL na ordem. Seguro de repetir."""
    aplicados: list[str] = []
    arquivos = sorted(config.DIR_DDL.glob("*.sql"))
    with conectar() as conexao:
        for arquivo in arquivos:
            executar_arquivo(conexao, arquivo)
            aplicados.append(arquivo.name)
        conexao.commit()
    return aplicados
