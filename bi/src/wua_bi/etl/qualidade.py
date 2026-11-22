"""Gate de qualidade entre as camadas (ADR-010).

Na arquitetura de referencia corporativa existe um losango entre a Silver e a
Gold com a legenda "so dado aprovado pela qualidade chega a Gold". Aqui esta
esse losango.

Antes deste modulo as oito conferencias existiam, mas rodavam DEPOIS do ETL,
num comando separado (`etl conferir`). Elas diziam que a gold estava errada
sem impedir que a gold errada fosse publicada. A diferenca entre conferir e
barrar e o que este arquivo resolve.

Como funciona:

    silver -> PORTA DA SILVER -> gold -> PORTA DA GOLD -> commit

As duas portas rodam dentro da MESMA transacao do ETL. Se qualquer regra
reprovar, a transacao inteira volta atras e nada e publicado: a gold continua
sendo a ultima versao aprovada, em vez de virar uma versao ruim. E isso que
autoriza chamar a gold de "metricas certificadas" como o diagrama chama.

Por que duas portas e nao uma: parte das regras le tabelas da gold (RN-011,
RN-012, RN-014...), entao so pode rodar depois que a gold e montada. Parte le
bronze e silver e pode barrar antes, poupando o trabalho. A regra vai na porta
mais cedo em que ela consegue rodar.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

import psycopg

from .. import config

# O mesmo recorte que a silver usa. Sem ele, a REC-001 compararia a bronze
# inteira com uma silver filtrada e reprovaria toda execucao.
E_SO_JOGO = "" if config.INCLUIR_SINTETICO else "and origem = 'jogo'"


@dataclass(frozen=True)
class Regra:
    """Uma regra de qualidade.

    O SQL devolve UM numero: quantas linhas violam a regra. Zero e aprovado.
    Escrever sempre assim deixa as regras comparaveis e faceis de ler em voz
    alta na banca: "quantas fases concluidas nao tem primeira vitoria? zero".
    """

    codigo: str
    descricao: str
    sql: str


@dataclass(frozen=True)
class Resultado:
    regra: Regra
    divergencias: int

    @property
    def aprovada(self) -> bool:
        return self.divergencias == 0


# ---------------------------------------------------------------------------
# Porta da silver: roda depois da silver e antes da gold
# ---------------------------------------------------------------------------

REGRAS_SILVER: list[Regra] = [
    Regra(
        "RN-015",
        "nao ha event_id repetido na bronze",
        """select count(*) from (
               select event_id from bronze.eventos
               group by event_id having count(*) > 1
           ) x""",
    ),
    Regra(
        "CAT-001",
        "nenhum bloco do programa ficou sem categoria",
        "select count(*) from silver.programa_bloco where categoria is null",
    ),
    # Reconciliacao (faixa "Qualidade de dados" do diagrama): todo EV-04 da
    # bronze tem que ter virado uma tentativa na silver ou ter ido para a
    # quarentena. Se a conta nao fecha, a silver perdeu evento em silencio -
    # que e exatamente o tipo de erro que ninguem percebe olhando o grafico.
    Regra(
        "REC-001",
        "reconciliacao: todo EV-04 da bronze virou tentativa ou quarentena",
        # O `origem = 'jogo'` tem de estar aqui tambem, e nao e detalhe: desde
        # 22/11/2026 a silver so processa partida de gente (config.
        # INCLUIR_SINTETICO). Sem o mesmo filtro, esta regra compararia a
        # bronze INTEIRA com uma silver filtrada e reprovaria toda execucao
        # -- a reconciliacao tem de olhar os dois lados do mesmo recorte.
        """select abs(
               (select count(*) from bronze.eventos
                 where event_type = 'tentativa_executada'
                   {E_SO_JOGO})
             - (select count(*) from silver.tentativa)
             - (select count(*) from silver.evento_rejeitado
                 where event_type = 'tentativa_executada')
           )""",
    ),
    # Reconciliacao da ingestao: o que os lotes dizem ter gravado tem que bater
    # com o que esta na bronze apontando para lote. Eventos sem lote_id nao
    # entram na conta (ver a coluna em db/01_bronze.sql).
    Regra(
        "REC-002",
        "reconciliacao: contagem dos lotes bate com a bronze",
        """select abs(
               coalesce((select sum(eventos_gravados) from bronze.ingestao_lote), 0)
             - (select count(*) from bronze.eventos where lote_id is not null)
           )""",
    ),
]


# ---------------------------------------------------------------------------
# Porta da gold: roda depois da gold e antes do commit
# ---------------------------------------------------------------------------

REGRAS_GOLD: list[Regra] = [
    Regra(
        "RN-011",
        "fase concluida tem primeira vitoria registrada",
        """select count(*) from gold.fato_progresso_fase
           where concluida and data_sk_primeira_vitoria is null""",
    ),
    Regra(
        "RN-012a",
        "tentativas ate vencer so existe em fase concluida",
        """select count(*) from gold.fato_progresso_fase
           where (tentativas_ate_vencer is not null) <> concluida""",
    ),
    Regra(
        "RN-012b",
        "tentativas ate vencer exclui interrompida e Play do jogo",
        # Recalcula o numero a partir do fato, por um caminho diferente do que
        # o gold usou para monta-lo. Tem que cair nas mesmas tres exclusoes:
        # resultado nao conclusivo (RN-012), o que veio depois da primeira
        # vitoria (RN-013) e o Play que o jogo deu sozinho (RN-021) -- este
        # ultimo exceto quando foi a propria vitoria.
        """select count(*) from gold.fato_progresso_fase p
           where p.concluida and p.tentativas_ate_vencer <> (
               select count(*) from gold.fato_tentativa t
               join gold.dim_resultado r on r.resultado_sk = t.resultado_sk
               where t.jogador_sk = p.jogador_sk and t.fase_sk = p.fase_sk
                 and r.e_conclusiva
                 and (t.disparo = 'jogador' or t.e_primeira_vitoria)
                 and t.numero_tentativa <= (
                     select min(t2.numero_tentativa) from gold.fato_tentativa t2
                     where t2.jogador_sk = p.jogador_sk and t2.fase_sk = p.fase_sk
                       and t2.e_primeira_vitoria))""",
    ),
    Regra(
        "RN-014",
        "eficiencia = referencia / blocos da primeira vitoria",
        """select count(*) from gold.fato_progresso_fase
           where qtd_blocos_primeira_vitoria is not null
             and eficiencia_codigo
                 <> round(tamanho_referencia::numeric / qtd_blocos_primeira_vitoria, 3)""",
    ),
    Regra(
        "RN-007",
        "toda tentativa no fato tem exatamente um resultado",
        "select count(*) from gold.fato_tentativa where resultado_sk is null",
    ),
    Regra(
        "RN-008",
        "derrota sempre tem causa classificada",
        """select count(*) from gold.fato_tentativa t
           join gold.dim_resultado r on r.resultado_sk = t.resultado_sk
           where r.resultado = 'derrota' and t.causa_derrota is null""",
    ),
    # Reconciliacao silver -> gold, irma da REC-001. Toda tentativa analisada
    # na silver tem que ter chegado ao fato.
    #
    # Esta regra nasceu de um buraco real, achado em 18/11/2026 ao subir a
    # catalog_version do catalogo. O fato_tentativa junta com dim_fase por
    # (fase_id, catalog_version); quando o jogo manda uma catalog_version que
    # o catalogo do BI nao tem mais, o join nao acha par e a tentativa some --
    # sem erro, sem quarentena, sem nada.
    #
    # O teste: silver com 199 tentativas, gold com ZERO, e as seis regras
    # desta porta aprovadas, porque todas perguntam "quantas linhas da gold
    # violam X?" e numa gold vazia a resposta e sempre zero. A porta deixou
    # passar uma gold vazia e o ETL imprimiu "gold publicada". O dashboard
    # mostraria zero em tudo, e o gate -- que existe exatamente para isso --
    # teria dito que estava tudo bem.
    #
    # Uma regra que conta o que FALTA, em vez de conferir o que esta la,
    # e a unica que nao passa de graca quando nao ha nada.
    #
    # O filtro `resultado is not null` nao e detalhe: uma tentativa que ficou
    # sem EV-05 (a aba fechou no meio, por exemplo) entra na silver e NAO vai
    # para o fato, de proposito -- e o SQL_BASE da gold que decide isso. Sem
    # este filtro a regra reprovaria a gold inteira por causa de uma tentativa
    # inacabada, que e comportamento esperado e nao defeito.
    Regra(
        "REC-003",
        "reconciliacao: toda tentativa conclusiva da silver chegou ao fato",
        """select abs(
               (select count(*) from silver.tentativa
                 where resultado is not null)
             - (select count(*) from gold.fato_tentativa)
           )""",
    ),
]


REGRAS_SILVER = [
    Regra(r.codigo, r.descricao, r.sql.format(E_SO_JOGO=E_SO_JOGO))
    if "{E_SO_JOGO}" in r.sql else r
    for r in REGRAS_SILVER
]


class QualidadeReprovada(Exception):
    """Levantada quando uma porta reprova. Derruba a transacao do ETL."""

    def __init__(self, porta: str, reprovadas: list[Resultado]) -> None:
        self.porta = porta
        self.reprovadas = reprovadas
        detalhe = "; ".join(
            f"{r.regra.codigo} ({r.divergencias} divergencias)" for r in reprovadas
        )
        super().__init__(f"porta da {porta} reprovou: {detalhe}")


def avaliar(conexao: psycopg.Connection, regras: Iterable[Regra]) -> list[Resultado]:
    """Roda as regras NA TRANSACAO ABERTA.

    Usar a conexao do ETL, e nao uma nova, e o ponto inteiro: as regras
    precisam enxergar o que a transacao acabou de escrever e ainda nao
    publicou. Uma conexao nova so veria a versao antiga e aprovaria qualquer
    coisa.
    """
    resultados: list[Resultado] = []
    with conexao.cursor() as cursor:
        for regra in regras:
            cursor.execute(regra.sql)
            (linha,) = cursor.fetchall()
            divergencias = int(next(iter(linha.values())))
            resultados.append(Resultado(regra, divergencias))
    return resultados


def registrar(
    conexao: psycopg.Connection,
    execucao_id: int | None,
    porta: str,
    resultados: list[Resultado],
) -> None:
    """Grava o resultado de cada regra em bronze.etl_qualidade.

    Grava inclusive quando reprova - mas, como a transacao vai voltar atras,
    quem persiste o registro de uma reprovacao e o chamador, numa transacao
    separada (ver `etl.pipeline`).
    """
    if not resultados:
        return
    with conexao.cursor() as cursor:
        cursor.executemany(
            """
            insert into bronze.etl_qualidade
                (execucao_id, porta, regra, descricao, divergencias, aprovada)
            values (%s, %s, %s, %s, %s, %s)
            """,
            [
                (execucao_id, porta, r.regra.codigo, r.regra.descricao,
                 r.divergencias, r.aprovada)
                for r in resultados
            ],
        )


def passar_pela_porta(
    conexao: psycopg.Connection,
    porta: str,
    regras: Iterable[Regra],
    execucao_id: int | None = None,
) -> list[Resultado]:
    """Avalia, registra e levanta se alguma regra reprovar."""
    resultados = avaliar(conexao, regras)
    registrar(conexao, execucao_id, porta, resultados)
    reprovadas = [r for r in resultados if not r.aprovada]
    if reprovadas:
        raise QualidadeReprovada(porta, reprovadas)
    return resultados


def ultimo_boletim(conexao: psycopg.Connection | None = None) -> list[dict[str, Any]]:
    """O resultado das regras na ultima execucao que chegou a ser gravada."""
    from .. import db

    sql = """
    select q.porta, q.regra, q.descricao, q.divergencias, q.aprovada, q.verificada_em
    from bronze.etl_qualidade q
    where q.execucao_id = (select max(execucao_id) from bronze.etl_qualidade)
    order by q.porta desc, q.regra
    """
    if conexao is None:
        return db.consultar(sql)
    with conexao.cursor() as cursor:
        cursor.execute(sql)
        return cursor.fetchall()
