"""Autenticacao PROVISORIA do dashboard.

A autenticacao e do back-end (ADR-002, ADR-004): contas pre-criadas, senha com
hash, token com prazo. Este arquivo existe so para o dashboard nao ficar parado
esperando, e deve ser trocado pelo login de verdade assim que ele existir.

O que NAO e provisorio e a aplicacao das permissoes:

    RN-004  o jogador acessa somente os proprios dados
    RN-005  o professor acessa os dados de todos os jogadores

Isso e verificado em `exigir_acesso_a`, na API, que e exatamente o que a
ADR-001 queria: uma unica regra de permissao, num lugar so.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .. import config, db

VALIDADE_SEGUNDOS = 8 * 3600

_esquema = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Usuario:
    jogador_id: int
    usuario: str
    nome_exibicao: str
    perfil: str

    @property
    def e_professor(self) -> bool:
        return self.perfil == "professor"


def _hash_senha(senha: str) -> str:
    # Mesma funcao do gerador, que cria as contas de teste. A ADR-004 pede
    # Argon2 ou bcrypt no sistema de verdade.
    return hashlib.pbkdf2_hmac("sha256", senha.encode(), b"wua-dev", 100_000).hex()


def _assinar(dados: bytes) -> str:
    assinatura = hmac.new(config.SEGREDO.encode(), dados, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(assinatura).decode().rstrip("=")


def emitir_token(usuario: Usuario) -> str:
    corpo = json.dumps({
        "jogador_id": usuario.jogador_id,
        "usuario": usuario.usuario,
        "expira_em": int(time.time()) + VALIDADE_SEGUNDOS,
    }, separators=(",", ":")).encode()
    parte = base64.urlsafe_b64encode(corpo).decode().rstrip("=")
    return f"{parte}.{_assinar(corpo)}"


def _ler_token(token: str) -> dict:
    try:
        parte, assinatura = token.split(".", 1)
        corpo = base64.urlsafe_b64decode(parte + "=" * (-len(parte) % 4))
    except (ValueError, Exception):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token invalido")

    if not hmac.compare_digest(_assinar(corpo), assinatura):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token invalido")

    dados = json.loads(corpo)
    if dados["expira_em"] < time.time():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token expirado")
    return dados


def autenticar(usuario: str, senha: str) -> Usuario | None:
    linhas = db.consultar(
        "select jogador_id, usuario, nome_exibicao, perfil, senha_hash "
        "from app.jogador where usuario = %(usuario)s",
        {"usuario": usuario},
    )
    if not linhas:
        return None

    linha = linhas[0]
    if not hmac.compare_digest(linha["senha_hash"], _hash_senha(senha)):
        return None

    return Usuario(linha["jogador_id"], linha["usuario"],
                   linha["nome_exibicao"], linha["perfil"])


def usuario_atual(
    credencial: HTTPAuthorizationCredentials | None = Depends(_esquema),
) -> Usuario:
    if credencial is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "faca login")

    dados = _ler_token(credencial.credentials)
    linhas = db.consultar(
        "select jogador_id, usuario, nome_exibicao, perfil from app.jogador "
        "where jogador_id = %(id)s",
        {"id": dados["jogador_id"]},
    )
    if not linhas:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "conta nao existe mais")

    linha = linhas[0]
    return Usuario(linha["jogador_id"], linha["usuario"],
                   linha["nome_exibicao"], linha["perfil"])


def exigir_acesso_a(alvo_id: int, usuario: Usuario) -> None:
    """RN-004 e RN-005, num lugar so.

    O professor le os dados de todos os jogadores do MVP. O jogador le os
    proprios e mais nada.
    """
    if usuario.e_professor or usuario.jogador_id == alvo_id:
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN,
                        "o jogador acessa somente os proprios dados (RN-004)")


def exigir_professor(usuario: Usuario) -> None:
    """RN-005: a visao consolidada e so do perfil professor."""
    if not usuario.e_professor:
        raise HTTPException(status.HTTP_403_FORBIDDEN,
                            "visao disponivel apenas para o perfil professor (RN-005)")
