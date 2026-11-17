"""Uma execucao do ETL, do inicio ao commit.

Arquitetura de referencia, faixa do Airflow: "orquestra o ciclo completo:
ingestao · transformacao · qualidade · publicacao · refresh · alertas". Este
modulo e o ciclo; quem o dispara (a pessoa ou o agendador) esta em
`orquestrador.py`.

A ordem e:

    silver -> porta da silver -> gold -> porta da gold -> commit

Tudo numa transacao so. Isso ja era verdade antes do gate existir e e o que
torna o gate possivel: reprovou, `rollback`, e a gold publicada continua
sendo a ultima que passou. Nunca existe uma gold "meio certa" no ar.

Separar este arquivo da linha de comando (`__main__.py`) tem um motivo
pratico: o agendador e a API precisam rodar o ETL sem simular um comando de
terminal.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from .. import alertas, db
from ..catalogo import Catalogo, catalogo_padrao
from . import gold, qualidade, silver
from .qualidade import QualidadeReprovada


@dataclass
class Resumo:
    """O que uma execucao produziu. O agendador imprime isto."""

    ok: bool
    disparo: str
    silver: dict[str, int] = field(default_factory=dict)
    gold: dict[str, int] = field(default_factory=dict)
    regras_aprovadas: int = 0
    regras_reprovadas: list[str] = field(default_factory=list)
    erro: str | None = None
    duracao_s: float = 0.0


def _abrir(conexao, etapa: str, disparo: str) -> int:
    linha = conexao.execute(
        """
        insert into bronze.etl_execucao (etapa, disparo)
        values (%s, %s)
        returning execucao_id
        """,
        (etapa, disparo),
    ).fetchone()
    return linha["execucao_id"]


def _fechar(conexao, execucao_id: int, lidas: int | None, gravadas: int | None) -> None:
    conexao.execute(
        """
        update bronze.etl_execucao
           set terminada_em = clock_timestamp(), linhas_lidas = %s, linhas_gravadas = %s
         where execucao_id = %s
        """,
        (lidas, gravadas, execucao_id),
    )


def _registrar_falha(etapa: str, disparo: str, erro: str) -> None:
    """Grava a falha numa transacao NOVA.

    A transacao do ETL ja voltou atras quando chegamos aqui - se o registro
    fosse feito nela, ele voltaria junto e a falha nao deixaria rastro. Este e
    o unico lugar do ETL que escreve fora da transacao principal, e e de
    proposito.
    """
    try:
        with db.conectar() as conexao:
            conexao.execute(
                """
                insert into bronze.etl_execucao
                    (etapa, disparo, terminada_em, erro)
                values (%s, %s, clock_timestamp(), %s)
                """,
                (etapa, disparo, erro[:2000]),
            )
            conexao.commit()
    except Exception as falha_ao_registrar:  # noqa: BLE001
        # Se nem isso deu, o banco provavelmente esta fora. O alerta ainda sai.
        print(f"  (nao foi possivel registrar a falha no banco: {falha_ao_registrar})")


def executar(disparo: str = "manual", cat: Catalogo | None = None,
             silencioso: bool = False) -> Resumo:
    """Roda o ciclo completo. Nunca levanta: devolve o Resumo com ok=False."""
    inicio_total = time.time()
    resumo = Resumo(ok=False, disparo=disparo)

    def diga(*args: Any) -> None:
        if not silencioso:
            print(*args)

    cat = cat or catalogo_padrao()
    problemas = cat.validar()
    if problemas:
        resumo.erro = "catalogo invalido: " + "; ".join(problemas)
        diga(resumo.erro)
        alertas.avisar("catalogo invalido", resumo.erro)
        _registrar_falha("silver", disparo, resumo.erro)
        return resumo

    diga(f"catalogo {cat.catalog_version}: {len(cat.fases)} fases")

    etapa_atual = "silver"
    try:
        with db.conectar() as conexao:
            # Aberta primeiro para que as duas portas tenham a que se ligar.
            exec_qualidade = _abrir(conexao, "qualidade", disparo)

            # --- transformacao: bronze -> silver -------------------------
            etapa_atual = "silver"
            exec_silver = _abrir(conexao, "silver", disparo)
            resumo.silver = silver.reconstruir(conexao, cat)
            _fechar(conexao, exec_silver, None, sum(resumo.silver.values()))
            diga("silver:", ", ".join(f"{k}={v}" for k, v in resumo.silver.items()))

            # --- porta da silver -----------------------------------------
            etapa_atual = "qualidade"
            aprovadas_silver = qualidade.passar_pela_porta(
                conexao, "silver", qualidade.REGRAS_SILVER, exec_qualidade)
            diga(f"porta da silver: {len(aprovadas_silver)} regras, todas aprovadas")

            # --- transformacao: silver -> gold ---------------------------
            etapa_atual = "gold"
            exec_gold = _abrir(conexao, "gold", disparo)
            resumo.gold = gold.reconstruir(conexao, cat)
            _fechar(conexao, exec_gold, None, sum(resumo.gold.values()))
            diga("gold:  ", ", ".join(f"{k}={v}" for k, v in resumo.gold.items()))

            # --- porta da gold -------------------------------------------
            etapa_atual = "qualidade"
            aprovadas_gold = qualidade.passar_pela_porta(
                conexao, "gold", qualidade.REGRAS_GOLD, exec_qualidade)
            diga(f"porta da gold:   {len(aprovadas_gold)} regras, todas aprovadas")

            total = len(aprovadas_silver) + len(aprovadas_gold)
            _fechar(conexao, exec_qualidade, total, total)
            resumo.regras_aprovadas = total

            # --- publicacao ----------------------------------------------
            conexao.commit()
            diga("gold publicada.")

        resumo.ok = True

    except QualidadeReprovada as reprovacao:
        # A transacao ja voltou atras ao sair do `with`. A gold continua sendo
        # a ultima versao aprovada - que e exatamente o comportamento que o
        # losango do diagrama promete.
        resumo.regras_reprovadas = [r.regra.codigo for r in reprovacao.reprovadas]
        resumo.erro = str(reprovacao)
        diga(f"QUALIDADE REPROVOU na porta da {reprovacao.porta}. "
             f"A gold NAO foi publicada e continua na versao anterior.")
        for r in reprovacao.reprovadas:
            diga(f"  [FALHA] {r.regra.codigo} {r.regra.descricao} "
                 f"({r.divergencias} divergencias)")
        _registrar_falha("qualidade", disparo, resumo.erro)
        alertas.avisar(
            "o gate de qualidade reprovou - a gold NAO foi atualizada",
            resumo.erro + "\nA gold continua na ultima versao aprovada.",
        )

    except Exception as erro:  # noqa: BLE001
        resumo.erro = f"{type(erro).__name__}: {erro}"
        diga(f"ETL FALHOU na etapa {etapa_atual}: {resumo.erro}")
        _registrar_falha(etapa_atual, disparo, resumo.erro)
        alertas.avisar(f"o ETL falhou na etapa {etapa_atual}", resumo.erro)

    resumo.duracao_s = round(time.time() - inicio_total, 2)
    return resumo
