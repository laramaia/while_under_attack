"""Aplicacao principal do back-end (ADR-002, PD-011).

Responsavel pela autenticacao (ADR-004) e pela ingestao de eventos na camada
bronze (ADR-007, RN-015, RN-016). Nao cria tabelas: escreve nas tabelas ja
criadas pelo BI em bi/db/01_bronze.sql.

    uvicorn wua_backend.main:app --reload --port 8001
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException

from . import db

app = FastAPI(
    title="while under_attack - Back-end",
    version="0.1.0",
    description=(
        "Back-end de autenticacao e ingestao de eventos na camada bronze "
        "(ADR-002, PD-011). Comunica-se com o BI exclusivamente pelo banco "
        "de dados Postgres."
    ),
    openapi_tags=[
        {"name": "operacao", "description": "Verificacao de disponibilidade e conexao com o banco."},
    ],
)


@app.get("/saude", tags=["operacao"])
def saude() -> dict[str, Any]:
    """Confirma que o servico esta no ar e que a conexao com o Postgres funciona."""
    try:
        db.consultar("select 1 as ok")
        return {"status": "ok", "banco": "ok"}
    except Exception:  # noqa: BLE001
        # Sem detalhes internos em endpoint publico.
        raise HTTPException(503, "banco indisponivel")
