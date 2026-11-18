"""Autenticacao por usuario e senha com hash bcrypt e token JWT (ADR-004, RN-002, RN-006).

Este modulo implementa a autenticacao real do back-end:
- Conferencia de senha contra o hash bcrypt gravado pelo seed em app.jogador (ADR-004).
- Emissao e validacao de token JWT assinado (HS256) com prazo de expiracao.
- Dependencia FastAPI `usuario_atual` que extrai a identidade do jogador a partir do
  cabecalho Authorization: Bearer <token> (RN-006).

IMPORTANTE (ADR-001): As funcoes de autorizacao do dashboard (`exigir_acesso_a` para
RN-004 e `exigir_professor` para RN-005) NAO sao duplicadas aqui; elas permanecem em
um lugar so, em `bi/src/wua_bi/api/auth_provisoria.py`.
"""

from __future__ import annotations

import time
from dataclasses import dataclass

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import config, db

ALGORITMO_JWT = "HS256"

# Hash bcrypt fixo apenas para manter tempo constante quando o usuario nao existe,
# evitando revelar se o usuario esta cadastrado por diferenca de tempo (ADR-004).
_HASH_FICTICIO = bcrypt.hashpw(b"senha-ficticia-tempo-constante", bcrypt.gensalt(rounds=12))

_esquema_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Usuario:
    """Mesma estrutura usada pelo BI para manter compatibilidade entre servicos."""

    jogador_id: int
    usuario: str
    nome_exibicao: str
    perfil: str

    @property
    def e_professor(self) -> bool:
        return self.perfil == "professor"


def _verificar_senha(senha: str, senha_hash: str) -> bool:
    """Confere a senha em texto contra o hash bcrypt (ADR-004)."""
    try:
        return bcrypt.checkpw(senha.encode("utf-8"), senha_hash.encode("utf-8"))
    except ValueError:
        # Caso a conta tenha um hash legado nao-bcrypt (ex.: PBKDF2 do gerador sintetico),
        # falha de forma segura sem levantar erro 500.
        return False


def autenticar(usuario: str, senha: str) -> Usuario | None:
    """Autentica por usuario e senha (RN-002, ADR-004).

    Devolve None tanto quando o usuario nao existe quanto quando a senha esta
    incorreta, para que o chamador devolva mensagem unica sem revelar se a
    conta existe.
    """
    linhas = db.consultar(
        "select jogador_id, usuario, nome_exibicao, perfil, senha_hash "
        "from app.jogador where usuario = %(usuario)s",
        {"usuario": usuario},
    )
    if not linhas:
        # Executa verificacao ficticia para nao vazar existencia do usuario pelo tempo.
        bcrypt.checkpw(senha.encode("utf-8"), _HASH_FICTICIO)
        return None

    linha = linhas[0]
    if not _verificar_senha(senha, linha["senha_hash"]):
        return None

    return Usuario(
        jogador_id=linha["jogador_id"],
        usuario=linha["usuario"],
        nome_exibicao=linha["nome_exibicao"],
        perfil=linha["perfil"],
    )


def emitir_token(usuario: Usuario) -> str:
    """Emite um JWT HS256 com prazo de validade (ADR-004, RN-006)."""
    agora = int(time.time())
    payload = {
        "sub": str(usuario.jogador_id),
        "jogador_id": usuario.jogador_id,
        "usuario": usuario.usuario,
        "perfil": usuario.perfil,
        "iat": agora,
        "exp": agora + config.VALIDADE_TOKEN_SEGUNDOS,
    }
    return jwt.encode(payload, config.SEGREDO, algorithm=ALGORITMO_JWT)


def ler_token(token: str) -> dict:
    """Valida a assinatura e a expiracao do JWT, levantando 401 se invalido."""
    try:
        return jwt.decode(token, config.SEGREDO, algorithms=[ALGORITMO_JWT])
    except jwt.InvalidTokenError:
        # Mensagem generica: nao distingue assinatura invalida, expiracao ou usuario.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token invalido ou expirado",
        )


def usuario_atual(
    credencial: HTTPAuthorizationCredentials | None = Depends(_esquema_bearer),
) -> Usuario:
    """Dependencia FastAPI que identifica o jogador pelo token Bearer (RN-006)."""
    if credencial is None or not credencial.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token invalido ou expirado",
        )

    dados = ler_token(credencial.credentials)
    jogador_id = dados.get("jogador_id")
    if not isinstance(jogador_id, int):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token invalido ou expirado",
        )

    linhas = db.consultar(
        "select jogador_id, usuario, nome_exibicao, perfil "
        "from app.jogador where jogador_id = %(id)s",
        {"id": jogador_id},
    )
    if not linhas:
        # Mesma mensagem generica para nao revelar se o id existe no banco.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token invalido ou expirado",
        )

    linha = linhas[0]
    return Usuario(
        jogador_id=linha["jogador_id"],
        usuario=linha["usuario"],
        nome_exibicao=linha["nome_exibicao"],
        perfil=linha["perfil"],
    )
