"""Seed de contas em app.jogador (RN-001, RN-002, RN-003, ADR-004).

As contas sao pre-criadas por script (RN-001), sem autocadastro e sem coleta
de e-mail (RN-002). O nome_exibicao deve ser primeiro nome ou apelido, nunca
nome completo (RN-003). A senha e gravada com hash bcrypt (ADR-004).

Uso:
    python -m wua_backend.seed
    python -m wua_backend.seed --arquivo caminho/para/contas.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import bcrypt

from . import config, db

ARQUIVO_PADRAO = config.RAIZ_BACKEND / "contas.json"
PERFIS_VALIDOS = {"jogador", "professor"}


def gerar_hash_senha(senha: str) -> str:
    """Gera hash forte com bcrypt (ADR-004)."""
    # Custo 12 oferece bom equilibrio entre seguranca e tempo de resposta.
    sal = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(senha.encode("utf-8"), sal).decode("utf-8")


def validar_conta(conta: dict[str, Any], indice: int) -> None:
    """Valida os campos obrigatorios e as regras RN-002 e RN-003."""
    campos = ("usuario", "senha", "nome_exibicao", "perfil")
    for campo in campos:
        valor = conta.get(campo)
        if not isinstance(valor, str) or not valor.strip():
            raise ValueError(f"Conta #{indice}: campo '{campo}' obrigatorio e nao vazio.")

    usuario = conta["usuario"].strip()
    if " " in usuario:
        raise ValueError(f"Conta '{usuario}': usuario nao pode conter espacos (RN-002).")

    # RN-003: primeiro nome ou apelido, nunca nome completo (sem espacos).
    nome_exibicao = conta["nome_exibicao"].strip()
    if " " in nome_exibicao:
        raise ValueError(
            f"Conta '{usuario}': nome_exibicao '{nome_exibicao}' parece nome completo; "
            "use apenas primeiro nome ou apelido (RN-003)."
        )

    perfil = conta["perfil"].strip()
    if perfil not in PERFIS_VALIDOS:
        raise ValueError(
            f"Conta '{usuario}': perfil '{perfil}' invalido; "
            "use 'jogador' ou 'professor' (ADR-004)."
        )


def carregar_contas(caminho: Path) -> list[dict[str, Any]]:
    """Carrega e valida a lista de contas de um arquivo JSON externo."""
    if not caminho.exists():
        raise FileNotFoundError(
            f"Arquivo de contas nao encontrado: {caminho}\n"
            "Copie contas.example.json para contas.json (ou passe --arquivo)."
        )

    dados = json.loads(caminho.read_text(encoding="utf-8"))
    if not isinstance(dados, list) or not dados:
        raise ValueError("O arquivo de contas deve conter uma lista JSON nao vazia.")

    for indice, item in enumerate(dados, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Conta #{indice} deve ser um objeto JSON.")
        validar_conta(item, indice)

    return dados


def semear_contas(contas: list[dict[str, Any]]) -> dict[str, int]:
    """Insere contas novas em app.jogador sem duplicar nem sobrescrever existentes (RN-001)."""
    criadas = 0
    existentes = 0

    with db.conectar() as conexao, conexao.cursor() as cursor:
        for conta in contas:
            usuario = conta["usuario"].strip()
            nome_exibicao = conta["nome_exibicao"].strip()
            perfil = conta["perfil"].strip()
            senha_hash = gerar_hash_senha(conta["senha"])

            # RN-001 e ADR-004: insere apenas se o usuario ainda nao existir,
            # preservando contas ja existentes (inclusive as sinteticas do BI).
            cursor.execute(
                """
                insert into app.jogador (usuario, senha_hash, nome_exibicao, perfil)
                values (%(usuario)s, %(senha_hash)s, %(nome_exibicao)s, %(perfil)s)
                on conflict (usuario) do nothing
                returning jogador_id
                """,
                {
                    "usuario": usuario,
                    "senha_hash": senha_hash,
                    "nome_exibicao": nome_exibicao,
                    "perfil": perfil,
                },
            )
            if cursor.fetchone() is not None:
                criadas += 1
            else:
                existentes += 1

        conexao.commit()

    return {"criadas": criadas, "existentes": existentes}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Cria contas iniciais em app.jogador com hash bcrypt (RN-001, ADR-004)."
    )
    parser.add_argument(
        "--arquivo",
        type=Path,
        default=ARQUIVO_PADRAO,
        help="Caminho do arquivo JSON com as contas (padrao: backend/contas.json).",
    )
    args = parser.parse_args(argv)

    try:
        contas = carregar_contas(args.arquivo)
        resultado = semear_contas(contas)
    except Exception as erro:  # noqa: BLE001
        print(f"Erro ao semear contas: {erro}", file=sys.stderr)
        return 1

    print(
        f"Seed concluido: {resultado['criadas']} conta(s) criada(s), "
        f"{resultado['existentes']} ja existia(m)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
