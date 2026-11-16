"""Aplicacao principal do back-end (ADR-002, PD-011).

Responsavel pela autenticacao (ADR-004) e pela ingestao de eventos na camada
bronze (ADR-007, RN-015, RN-016). Nao cria tabelas: escreve nas tabelas ja
criadas pelo BI em bi/db/01_bronze.sql.

    uvicorn wua_backend.main:app --reload --port 8001
"""

from __future__ import annotations

from typing import Any

from fastapi import Depends, FastAPI, HTTPException, status
from pydantic import BaseModel

from . import auth, db

app = FastAPI(
    title="while under_attack - Back-end",
    version="0.1.0",
    description=(
        "Back-end de autenticacao e ingestao de eventos na camada bronze "
        "(ADR-002, PD-011). Comunica-se com o BI exclusivamente pelo banco "
        "de dados Postgres."
    ),
    openapi_tags=[
        {"name": "acesso", "description": "Autenticacao por usuario e senha e identidade via JWT (ADR-004, RN-002, RN-006)."},
        {"name": "operacao", "description": "Verificacao de disponibilidade e conexao com o banco."},
    ],
)


class PedidoLogin(BaseModel):
    usuario: str
    senha: str


@app.post("/login", tags=["acesso"])
def login(pedido: PedidoLogin) -> dict[str, Any]:
    """Autentica o usuario contra o hash bcrypt e devolve o token JWT (ADR-004, RN-002)."""
    usuario = auth.autenticar(pedido.usuario, pedido.senha)
    if usuario is None:
        # Mensagem unica: nao revela se o usuario existe no banco (ADR-004).
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="usuario ou senha invalidos",
        )

    return {
        "token": auth.emitir_token(usuario),
        "jogador_id": usuario.jogador_id,
        "nome_exibicao": usuario.nome_exibicao,
        "perfil": usuario.perfil,
    }


@app.get("/eu", tags=["acesso"])
def eu(usuario: auth.Usuario = Depends(auth.usuario_atual)) -> dict[str, Any]:
    """Devolve a identidade lida do cabecalho Authorization: Bearer <token> (RN-006)."""
    return {
        "jogador_id": usuario.jogador_id,
        "usuario": usuario.usuario,
        "nome_exibicao": usuario.nome_exibicao,
        "perfil": usuario.perfil,
    }


@app.get("/saude", tags=["operacao"])
def saude() -> dict[str, Any]:
    """Confirma que o servico esta no ar e que a conexao com o Postgres funciona."""
    try:
        db.consultar("select 1 as ok")
        return {"status": "ok", "banco": "ok"}
    except Exception:  # noqa: BLE001
        # Sem detalhes internos em endpoint publico.
        raise HTTPException(503, "banco indisponivel")
