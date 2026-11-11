"""Linha de comando do ETL.

    python -m wua_bi.etl criar          cria os schemas e as tabelas
    python -m wua_bi.etl semear         gera eventos sinteticos na bronze
    python -m wua_bi.etl rodar          bronze -> silver -> gold
    python -m wua_bi.etl tudo           criar + semear + rodar
    python -m wua_bi.etl conferir       confere os indicadores contra as regras

O gatilho do ETL ficou em aberto na ADR-003. Aqui ele e manual, de proposito:
e o mais simples de operar e o mais facil de demonstrar.
"""

from __future__ import annotations

import argparse
import sys
import time

from .. import db
from ..catalogo import catalogo_padrao
from . import gold, silver


def _registrar(conexao, etapa: str, inicio: float, resultado: dict[str, int]) -> None:
    conexao.execute(
        """
        insert into bronze.etl_execucao (etapa, iniciada_em, terminada_em, linhas_gravadas)
        values (%s, to_timestamp(%s), now(), %s)
        """,
        (etapa, inicio, sum(resultado.values())),
    )


def criar() -> None:
    print("aplicando DDL...")
    for arquivo in db.aplicar_ddl():
        print(f"  {arquivo}")


def semear(qtd: int, dias: int, semente: int) -> None:
    from ..gerador import gravar_na_bronze

    print(f"gerando eventos sinteticos ({qtd} jogadores, {dias} dias)...")
    resultado = gravar_na_bronze(qtd_jogadores=qtd, dias=dias, semente=semente, limpar=True)
    print(f"  contas: {resultado['contas']}  eventos: {resultado['eventos']}")


def rodar() -> None:
    cat = catalogo_padrao()
    problemas = cat.validar()
    if problemas:
        print("catalogo invalido:", *problemas, sep="\n  ")
        sys.exit(1)

    print(f"catalogo {cat.catalog_version}: {len(cat.fases)} fases")

    with db.conectar() as conexao:
        inicio = time.time()
        resultado = silver.reconstruir(conexao, cat)
        _registrar(conexao, "silver", inicio, resultado)
        print("silver:", ", ".join(f"{k}={v}" for k, v in resultado.items()))

        inicio = time.time()
        resultado = gold.reconstruir(conexao, cat)
        _registrar(conexao, "gold", inicio, resultado)
        print("gold:  ", ", ".join(f"{k}={v}" for k, v in resultado.items()))

        conexao.commit()


# Conferencias que traduzem as regras de negocio em consultas. Servem de teste
# e de roteiro para a banca: cada linha cita a regra que esta verificando.
CONFERENCIAS = [
    ("RN-011 fase concluida tem primeira vitoria registrada",
     """select count(*) from gold.fato_progresso_fase
        where concluida and data_sk_primeira_vitoria is null"""),

    ("RN-012 tentativas ate vencer so existe em fase concluida",
     """select count(*) from gold.fato_progresso_fase
        where (tentativas_ate_vencer is not null) <> concluida"""),

    ("RN-012 interrompidas nao somam em tentativas ate vencer",
     """select count(*) from gold.fato_progresso_fase p
        where p.concluida and p.tentativas_ate_vencer <> (
            select count(*) from gold.fato_tentativa t
            join gold.dim_resultado r on r.resultado_sk = t.resultado_sk
            where t.jogador_sk = p.jogador_sk and t.fase_sk = p.fase_sk
              and r.e_conclusiva
              and t.numero_tentativa <= (
                  select min(t2.numero_tentativa) from gold.fato_tentativa t2
                  where t2.jogador_sk = p.jogador_sk and t2.fase_sk = p.fase_sk
                    and t2.e_primeira_vitoria))"""),

    ("RN-014 eficiencia = referencia / blocos da primeira vitoria",
     """select count(*) from gold.fato_progresso_fase
        where qtd_blocos_primeira_vitoria is not null
          and eficiencia_codigo
              <> round(tamanho_referencia::numeric / qtd_blocos_primeira_vitoria, 3)"""),

    ("RN-007 toda tentativa no fato tem exatamente um resultado",
     """select count(*) from gold.fato_tentativa where resultado_sk is null"""),

    ("RN-008 derrota sempre tem causa classificada",
     """select count(*) from gold.fato_tentativa t
        join gold.dim_resultado r on r.resultado_sk = t.resultado_sk
        where r.resultado = 'derrota' and t.causa_derrota is null"""),

    ("RN-015 nao ha event_id repetido na bronze",
     """select count(*) from (
            select event_id from bronze.eventos group by event_id having count(*) > 1
        ) x"""),

    ("Catalogo: nenhum bloco do programa ficou sem categoria",
     """select count(*) from silver.programa_bloco where categoria is null"""),
]


def conferir() -> None:
    falhou = False
    for descricao, sql in CONFERENCIAS:
        (linha,) = db.consultar(sql)
        divergencias = next(iter(linha.values()))
        marca = "ok  " if divergencias == 0 else "FALHA"
        if divergencias:
            falhou = True
        print(f"  [{marca}] {descricao}" + (f"  ({divergencias} divergencias)" if divergencias else ""))

    if falhou:
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(prog="wua_bi.etl", description=__doc__)
    parser.add_argument("comando",
                        choices=["criar", "semear", "rodar", "tudo", "conferir"])
    parser.add_argument("--jogadores", type=int, default=10)
    parser.add_argument("--dias", type=int, default=21)
    parser.add_argument("--semente", type=int, default=42)
    args = parser.parse_args()

    if args.comando in ("criar", "tudo"):
        criar()
    if args.comando in ("semear", "tudo"):
        semear(args.jogadores, args.dias, args.semente)
    if args.comando in ("rodar", "tudo"):
        rodar()
    if args.comando in ("conferir", "tudo"):
        print("conferindo indicadores:")
        conferir()


if __name__ == "__main__":
    main()
