"""Acesso ao dashboard: quem entrou e o que pode ver (ADR-001, ADR-002, ADR-004).

Este arquivo se chamou `auth_provisoria.py` ate 18/11/2026, de quando o BI
conferia a senha sozinho. Essa parte saiu ha dias -- quem autentica e o
back-end --, mas o nome continuou dizendo "provisoria" e virou a PD-020.
Renomear fecha a pendencia e tira do caminho a duvida de quem abre o arquivo
esperando codigo temporario.

A autenticacao (conferencia de senha bcrypt e emissao do JWT) agora e feita
pelo servico de back-end em `POST /login` (ADR-002, ADR-004). Este modulo:
- Repassa o pedido de login do dashboard para o back-end (`autenticar`).
- Valida o token JWT emitido pelo back-end usando `WUA_SEGREDO` (`_ler_token`,
  `usuario_atual`).

As regras de permissao continuam vivendo num lugar so, aqui (ADR-001):

    RN-004  o jogador acessa somente os proprios dados
    RN-005  o professor acessa os dados de todos os jogadores
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .. import config, db

ALGORITMO_JWT = "HS256"

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


def _ler_token(token: str) -> dict[str, Any]:
    """Valida a assinatura e o prazo do JWT emitido pelo back-end (ADR-004, RN-006).

    Os tres `except` nao sao intercambiaveis, e a ORDEM importa: tanto
    `ExpiredSignatureError` quanto `InvalidSignatureError` descendem de
    `InvalidTokenError`, entao o generico tem de vir por ultimo ou os dois
    primeiros nunca sao alcancados.

    O do meio existe por um caso concreto (issue #17). Quem assina o token e o
    back-end; quem confere e este servico; os dois leem `WUA_SEGREDO` de
    arquivos `.env` diferentes. Quando os valores discordam, o login
    FUNCIONA -- a senha e conferida la -- e todo pedido seguinte cai aqui.
    Com a mensagem generica "token invalido", que e a mesma de um token
    adulterado, a pessoa procura defeito na permissao, na consulta ou no
    banco. Foi onde eu procurei. O login ter passado empurra a suspeita para
    o lado errado, e nada na tela sugere configuracao.

    `InvalidSignatureError` quer dizer uma coisa so: o token esta bem formado
    e a assinatura nao bate com ESTE segredo. Nao ha ambiguidade a preservar,
    e dizer isso nao vaza nada -- o segredo nao aparece, so o nome da
    variavel de ambiente que as duas pontas tem de compartilhar.
    """
    try:
        return jwt.decode(token, config.SEGREDO, algorithms=[ALGORITMO_JWT])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token expirado")
    except jwt.InvalidSignatureError:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "assinatura do token nao confere: o WUA_SEGREDO deste servico e o "
            "do back-end precisam ser o mesmo valor (ADR-002, ADR-004)",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token invalido")


def autenticar(usuario: str, senha: str) -> dict[str, Any] | None:
    """Delega o login ao back-end em POST /login (ADR-002, ADR-004).

    Devolve o dicionario {"token", "jogador_id", "nome_exibicao", "perfil"}
    quando as credenciais sao validas, ou None quando o back-end responde 401.
    """
    try:
        resposta = httpx.post(
            f"{config.BACKEND_URL}/login",
            json={"usuario": usuario, "senha": senha},
            timeout=5.0,
        )
    except httpx.RequestError:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "servico de autenticacao indisponivel",
        )

    if resposta.status_code == status.HTTP_401_UNAUTHORIZED:
        return None

    if resposta.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "erro ao consultar servico de autenticacao",
        )

    return resposta.json()


def usuario_atual(
    credencial: HTTPAuthorizationCredentials | None = Depends(_esquema),
) -> Usuario:
    if credencial is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "faca login")

    dados = _ler_token(credencial.credentials)
    jogador_id = dados.get("jogador_id")
    if not isinstance(jogador_id, int):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token invalido")

    linhas = db.consultar(
        "select jogador_id, usuario, nome_exibicao, perfil from app.jogador "
        "where jogador_id = %(id)s",
        {"id": jogador_id},
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
