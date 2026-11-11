"""Linha de comando do ETL.

    python -m wua_bi.etl criar          cria os schemas e as tabelas
    python -m wua_bi.etl semear         gera eventos sinteticos na bronze
    python -m wua_bi.etl rodar          bronze -> silver -> gold, com o gate
    python -m wua_bi.etl agendar        roda sozinho a cada 15 min (ADR-009)
    python -m wua_bi.etl conferir       mostra o boletim de qualidade
    python -m wua_bi.etl tudo           criar + semear + rodar

O gatilho do ETL ficou em aberto na ADR-003, foi decidido na apresentacao de
26/10/2026 e virou a ADR-009: agendado a cada 15 minutos, com o manual
mantido para demonstracao. Os dois comandos acima sao esses dois gatilhos, e
os dois chamam a mesma funcao (`pipeline.executar`).

As regras de qualidade nao moram mais aqui: elas sao um gate dentro da
execucao (`qualidade.py`, ADR-010). `conferir` passou a ser a LEITURA do
resultado desse gate, nao uma segunda verificacao por fora.
"""

from __future__ import annotations

import argparse
import sys

from .. import db
from . import orquestrador, pipeline, qualidade


def criar() -> None:
    print("aplicando DDL...")
    for arquivo in db.aplicar_ddl():
        print(f"  {arquivo}")


def semear(qtd: int, dias: int, semente: int) -> None:
    from ..gerador import gravar_na_bronze

    print(f"gerando eventos sinteticos ({qtd} jogadores, {dias} dias)...")
    resultado = gravar_na_bronze(qtd_jogadores=qtd, dias=dias, semente=semente, limpar=True)
    print(f"  contas: {resultado['contas']}  eventos: {resultado['eventos']}")


def rodar() -> int:
    resumo = pipeline.executar(disparo="manual")
    return 0 if resumo.ok else 1


def conferir() -> int:
    """Mostra o boletim da ultima execucao que passou pelo gate.

    Antes este comando rodava as regras de novo, por fora do ETL. Agora as
    regras rodam DENTRO da execucao e ficam gravadas em bronze.etl_qualidade;
    aqui so lemos o que ficou registrado. A diferenca importa: o que a banca
    ve neste comando e exatamente o que autorizou a gold a ser publicada, e
    nao uma segunda opiniao tirada depois.
    """
    linhas = qualidade.ultimo_boletim()
    if not linhas:
        print("nenhuma execucao registrada ainda. Rode: python -m wua_bi.etl rodar")
        return 1

    print(f"boletim de qualidade de {linhas[0]['verificada_em']:%d/%m/%Y %H:%M}:")
    porta_atual = None
    falhou = False
    for linha in linhas:
        if linha["porta"] != porta_atual:
            porta_atual = linha["porta"]
            print(f"  porta da {porta_atual}:")
        marca = "ok  " if linha["aprovada"] else "FALHA"
        if not linha["aprovada"]:
            falhou = True
        extra = "" if linha["aprovada"] else f"  ({linha['divergencias']} divergencias)"
        print(f"    [{marca}] {linha['regra']} {linha['descricao']}{extra}")

    return 1 if falhou else 0


def main() -> None:
    parser = argparse.ArgumentParser(prog="wua_bi.etl", description=__doc__)
    parser.add_argument(
        "comando",
        choices=["criar", "semear", "rodar", "agendar", "tudo", "conferir"],
    )
    parser.add_argument("--jogadores", type=int, default=10)
    parser.add_argument("--dias", type=int, default=21)
    parser.add_argument("--semente", type=int, default=42)
    parser.add_argument("--intervalo", type=int, default=None,
                        help="minutos entre execucoes no modo agendar")
    parser.add_argument("--vezes", type=int, default=None,
                        help="quantos ciclos rodar antes de sair (teste)")
    args = parser.parse_args()

    codigo = 0

    if args.comando in ("criar", "tudo"):
        criar()
    if args.comando in ("semear", "tudo"):
        semear(args.jogadores, args.dias, args.semente)
    if args.comando in ("rodar", "tudo"):
        codigo = rodar()
    if args.comando == "agendar":
        codigo = orquestrador.agendar(args.intervalo, args.vezes)
    if args.comando in ("conferir", "tudo") and codigo == 0:
        print()
        codigo = conferir()

    sys.exit(codigo)


if __name__ == "__main__":
    main()
