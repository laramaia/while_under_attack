"""Acesso ao Postgres."""

from __future__ import annotations

import threading
from contextlib import contextmanager
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row

from . import config


@contextmanager
def conectar() -> Iterator[psycopg.Connection]:
    """Conexao NOVA, com a semantica de transacao do psycopg.

    O ETL depende disto: sair do `with` sem erro faz commit, com erro faz
    rollback, e e nisso que a ADR-010 se apoia para dizer que a gold so e
    publicada se as duas portas aprovarem. Nao reusar conexao aqui e
    deliberado -- uma conexao compartilhada traria transacao compartilhada.
    """
    with psycopg.connect(config.DB_URL, row_factory=dict_row) as conexao:
        yield conexao


# ---------------------------------------------------------------------------
# Conexao reaproveitada, so para LEITURA (o caminho da API)
#
# Abrir conexao com o Neon custa caro: medido em 22/11/2026, entre 1,7 e 2,0
# segundos para conectar e rodar um `select 1`. A tela do jogador faz seis
# consultas e a do professor nove -- com uma conexao nova em cada uma, a
# primeira pintura passava de cinco segundos, e nesse tempo a tela fica
# vazia. Foi o que a equipe relatou como "entro e nao acontece nada": nao
# estava quebrado, estava lento sem dizer que estava carregando.
#
# Uma conexao por THREAD, e nao uma so global: o FastAPI roda rota sincrona
# num threadpool, e conexao do psycopg nao e segura para uso simultaneo.
# Cada thread guarda a sua e reaproveita; se ela morreu (rede caiu, o Neon
# hibernou), a proxima chamada abre outra.
# ---------------------------------------------------------------------------

_local = threading.local()


def _conexao_de_leitura() -> psycopg.Connection:
    conexao = getattr(_local, "conexao", None)
    if conexao is not None and not conexao.closed:
        return conexao

    conexao = psycopg.connect(config.DB_URL, row_factory=dict_row, autocommit=True)
    _local.conexao = conexao
    return conexao


def consultar(sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Consulta de leitura, na conexao reaproveitada da thread.

    `autocommit` porque aqui nao ha escrita: sem ele, cada consulta abriria
    uma transacao que ficaria aberta ate a proxima, segurando snapshot no
    servidor sem necessidade.
    """
    try:
        with _conexao_de_leitura().cursor() as cursor:
            cursor.execute(sql, params or {})
            return cursor.fetchall()
    except psycopg.Error:
        # A conexao guardada pode ter morrido entre uma chamada e outra. Joga
        # fora e tenta uma vez com uma nova -- se falhar de novo, o erro sobe
        # e a API responde o que tem de responder.
        conexao = getattr(_local, "conexao", None)
        if conexao is not None:
            try:
                conexao.close()
            except Exception:
                pass
            _local.conexao = None

        with _conexao_de_leitura().cursor() as cursor:
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
