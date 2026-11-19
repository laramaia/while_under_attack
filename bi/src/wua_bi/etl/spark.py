"""Motor alternativo da transformacao bronze -> silver, em PySpark (ADR-008).

Por que existe
--------------

A arquitetura de referencia da UNIVAG nomeia **Apache Spark** na caixa de
transformacao. Ate 18/11/2026 o projeto atendia essa caixa por capacidade e
nao por produto (ADR-008): a transformacao existia, em SQL e Python, e o
documento de conformidade justificava a troca pelo volume -- 553 eventos em
fracoes de segundo, contra uma JVM inteira de sobrecarga.

A exigencia passou a ser pelo produto. Este modulo e a resposta: **a mesma
transformacao, no motor que o diagrama pede**, lado a lado com a de SQL, e
nao no lugar dela.

Manter os dois nao e indecisao. E o que permite afirmar, com medicao em vez
de opiniao, que os dois chegam ao mesmo resultado -- `etl comparar` roda os
dois e compara linha a linha. Um motor novo que ninguem consegue provar
equivalente ao antigo e um risco, nao uma entrega.

O que e feito em Spark, e o que nao e
-------------------------------------

Em Spark fica o trabalho que tem forma de conjunto, que e para o que ele
serve: agregar eventos por sessao, juntar EV-04 com EV-05, achar
`tentativa_id` repetido e numerar as tentativas por jogador e fase com uma
window function.

Fora do Spark fica a leitura do programa (`programa.ler_programa`), que e
**recursiva** -- um bloco contem blocos. Isso nao e operacao de DataFrame, e
forcar seria escrever uma UDF que chama a mesma funcao Python, com o custo
da serializacao e nenhum ganho. Reusar a funcao direto tem uma vantagem que
a UDF nao teria: os blocos sao contados pelo mesmo codigo nos dois motores,
entao e impossivel divergirem.

A escrita tambem fica fora. **E de proposito, e e a parte que mais importa
nao perder:** a ADR-010 garante que o gate de qualidade significa alguma
coisa porque as duas portas rodam dentro da MESMA transacao do ETL. O
`write.jdbc` do Spark abre conexao propria e faz commit proprio -- nao
participa dessa transacao. Se a silver fosse escrita por ele, uma reprovacao
na porta da gold faria rollback do que o ETL escreveu e deixaria de pe o que
o Spark escreveu. A gold ficaria consistente e a silver nao.

Entao o Spark transforma e devolve as linhas; quem escreve e a transacao do
ETL, como antes. Com este volume, trazer o resultado para o driver custa
menos que uma piscada -- e esse custo ser irrelevante **e** a medicao que a
ADR-008 pedia.
"""

from __future__ import annotations

import json
import os
from typing import Any

import psycopg

from .. import config
from ..catalogo import Catalogo, catalogo_padrao
from ..programa import ler_programa

APP_NAME = "wua-bi-silver"

# O driver JDBC do Postgres nao vem com o PySpark. Esta coordenada e resolvida
# na primeira execucao e fica no cache do Ivy (~/.ivy2); depois disso a sessao
# sobe sem rede.
PACOTE_JDBC = "org.postgresql:postgresql:42.7.4"


def _url_jdbc(db_url: str) -> tuple[str, dict[str, str]]:
    """Traduz a WUA_DB_URL (libpq) para o formato que o JDBC espera.

    As duas apontam para o mesmo banco; o que muda e a sintaxe. O usuario e a
    senha saem da URL e viram propriedades, porque o JDBC nao os aceita
    embutidos de forma confiavel em todos os drivers.
    """
    from urllib.parse import urlsplit

    p = urlsplit(db_url)
    porta = f":{p.port}" if p.port else ""
    url = f"jdbc:postgresql://{p.hostname}{porta}{p.path}"
    props = {
        "user": p.username or "",
        "password": p.password or "",
        "driver": "org.postgresql.Driver",
    }
    if "sslmode=require" in (p.query or ""):
        url += "?sslmode=require"
    return url, props


def sessao_spark(master: str = "local[*]"):
    """Abre a SparkSession. Erra cedo e claro quando falta JAVA_HOME."""
    from pyspark.sql import SparkSession

    if not os.environ.get("JAVA_HOME"):
        raise RuntimeError(
            "JAVA_HOME nao esta definido. O PySpark precisa de uma JVM 17 ou 21 "
            "(a 4.x nao sobe na 23). No macOS: "
            'export JAVA_HOME=$(/usr/libexec/java_home -v 21)'
        )

    return (
        SparkSession.builder.master(master)
        .appName(APP_NAME)
        .config("spark.jars.packages", PACOTE_JDBC)
        # Com 553 eventos, o padrao de 200 particoes de shuffle cria 200
        # tarefas para processar algumas centenas de linhas. O tempo vira
        # agendamento, nao calculo.
        .config("spark.sql.shuffle.partitions", "4")
        .config("spark.ui.enabled", "false")
        .getOrCreate()
    )


def transformar(spark, agora, cat: Catalogo) -> dict[str, Any]:
    """bronze -> (sessoes, tentativas, blocos, rejeitados), tudo em memoria.

    `agora` vem do BANCO, nao do relogio da maquina que roda o Spark. O
    `SQL_SESSAO` usa `now()` do Postgres para decidir o corte de inatividade;
    se aqui usasse o relogio local, duas maquinas com relogios diferentes
    classificariam a mesma sessao de formas diferentes -- e a comparacao
    entre os dois motores acusaria uma diferenca que nao e de motor.
    """
    from pyspark.sql import Window
    from pyspark.sql import functions as F

    url, props = _url_jdbc(config.DB_URL)
    eventos = (
        spark.read.format("jdbc")
        .option("url", url)
        .option("dbtable", "bronze.eventos")
        .options(**props)
        .load()
    )
    eventos = eventos.withColumn("p", F.from_json(F.col("payload").cast("string"),
                                                  "map<string,string>"))

    # --- sessoes: mesma agregacao do SQL_SESSAO -------------------------
    agregado = eventos.groupBy("session_id").agg(
        F.max("jogador_id").alias("jogador_id"),
        F.min("occurred_at").alias("iniciada_em"),
        F.max("occurred_at").alias("ultimo_evento"),
        F.count(F.lit(1)).alias("qtd_eventos"),
        F.count(F.when(F.col("event_type") == "tentativa_executada", 1))
         .alias("qtd_tentativas"),
        F.max(F.when(F.col("event_type") == "sessao_encerrada",
                     F.col("p")["motivo"])).alias("motivo_evento"),
        F.max("catalog_version").alias("catalog_version"),
        F.max("game_version").alias("game_version"),
        F.max("origem").alias("origem"),
    )

    corte = F.lit(agora) - F.expr(f"INTERVAL {config.MINUTOS_INATIVIDADE_SESSAO} MINUTES")
    classificado = agregado.withColumn(
        "motivo_encerramento",
        F.when(F.col("motivo_evento").isNotNull(), F.col("motivo_evento"))
         .when(F.col("ultimo_evento") < corte, F.lit("inatividade")),
    )
    sessoes = classificado.select(
        "session_id", "jogador_id", "iniciada_em",
        F.when(F.col("motivo_encerramento").isNotNull(),
               F.col("ultimo_evento")).alias("encerrada_em"),
        "motivo_encerramento",
        F.when(F.col("motivo_encerramento").isNotNull(),
               F.round((F.col("ultimo_evento").cast("double")
                        - F.col("iniciada_em").cast("double")) / 60.0, 2))
         .alias("duracao_min"),
        "qtd_eventos", "qtd_tentativas", "catalog_version", "game_version", "origem",
    ).collect()

    # --- EV-04 e EV-05 ---------------------------------------------------
    ev05 = eventos.where(F.col("event_type") == "tentativa_finalizada").select(
        F.col("p")["tentativa_id"].alias("tentativa_id"),
        F.col("p")["resultado"].alias("resultado"),
        F.col("p")["duracao_execucao_ms"].cast("int").alias("duracao_execucao_ms"),
        F.col("p")["vida_guerreiro_final"].cast("int").alias("vida_guerreiro_final"),
        F.col("p")["vida_inimigo_final"].cast("int").alias("vida_inimigo_final"),
        F.col("p")["programa_concluido"].cast("boolean").alias("programa_concluido"),
        F.col("p")["bloco_em_execucao_id"].alias("bloco_em_execucao_id"),
        F.col("occurred_at").alias("finalizada_em"),
    )

    ev04 = eventos.where(F.col("event_type") == "tentativa_executada").select(
        F.col("p")["tentativa_id"].alias("tentativa_id"),
        F.col("p")["fase_id"].alias("fase_id"),
        F.col("p")["programa"].alias("programa_json"),
        F.col("p")["tempo_edicao_ms"].cast("int").alias("tempo_edicao_ms"),
        # RN-021: campo opcional; ausente significa Play do jogador.
        F.coalesce(F.col("p")["disparo"], F.lit("jogador")).alias("disparo"),
        "session_id", "jogador_id", "catalog_version", "origem",
        "occurred_at", "received_at", "seq",
        F.col("event_id").cast("string").alias("event_id"),
    )

    # tentativa_id repetido: o primeiro por (received_at, seq) vale, o resto
    # vira registro de problema. A window faz em Spark o que o loop fazia com
    # um `set` de ja-vistos.
    ordem = Window.partitionBy("tentativa_id").orderBy("received_at", "seq")
    ev04 = ev04.withColumn("ocorrencia", F.row_number().over(ordem))

    fases_validas = {f.fase_id for f in cat.fases}
    ev04 = ev04.withColumn(
        "motivo_rejeicao",
        F.when(F.col("ocorrencia") > 1, F.lit("tentativa_id repetido"))
         .when(~F.col("fase_id").isin(list(fases_validas)),
               F.lit("fase fora do catalogo")),
    )

    rejeitados = [
        (r["event_id"], "tentativa_executada", r["motivo_rejeicao"],
         r["tentativa_id"] if r["motivo_rejeicao"] == "tentativa_id repetido"
         else r["fase_id"])
        for r in ev04.where(F.col("motivo_rejeicao").isNotNull())
                     .orderBy("received_at", "seq").collect()
    ]

    aceitas = ev04.where(F.col("motivo_rejeicao").isNull())

    # numero_tentativa por jogador e fase, na ordem de chegada
    janela = Window.partitionBy("jogador_id", "fase_id").orderBy("received_at", "seq")
    aceitas = aceitas.withColumn("numero_tentativa", F.row_number().over(janela))

    linhas = (aceitas.join(ev05, on="tentativa_id", how="left")
                     .orderBy("received_at", "seq").collect())

    return {"sessoes": sessoes, "tentativas": linhas, "rejeitados": rejeitados}


def medir(cat: Catalogo | None = None, master: str = "local[*]") -> dict[str, Any]:
    """Roda a transformacao em Spark e devolve as contagens e o tempo.

    Nao escreve nada. Serve para o `etl comparar` e para a banca ver o motor
    rodando sem arriscar a silver publicada.
    """
    import time

    cat = cat or catalogo_padrao()
    with psycopg.connect(config.DB_URL) as con:
        agora = con.execute("select now()").fetchone()[0]

    spark = sessao_spark(master)
    spark.sparkContext.setLogLevel("ERROR")
    try:
        inicio = time.time()
        saida = transformar(spark, agora, cat)
        tipos = cat.tipos_de_evento
        blocos = 0
        for linha in saida["tentativas"]:
            programa = json.loads(linha["programa_json"])
            blocos += len(ler_programa(programa, tipos).blocos)
        duracao = time.time() - inicio
    finally:
        spark.stop()

    return {
        "sessoes": len(saida["sessoes"]),
        "tentativas": len(saida["tentativas"]),
        "blocos": blocos,
        "rejeitados": len(saida["rejeitados"]),
        "duracao_s": round(duracao, 3),
        "motor": f"pyspark ({master})",
    }


def comparar(cat: Catalogo | None = None, master: str = "local[*]") -> dict[str, Any]:
    """Roda os DOIS motores sobre a mesma bronze e compara.

    O motor de SQL roda dentro de uma transacao que termina em ROLLBACK: a
    silver publicada nao e tocada. Sem isso, comparar os motores seria um
    comando capaz de estragar o que esta publicado, e ninguem rodaria na
    vespera da apresentacao -- que e justamente quando se quer rodar.
    """
    import time

    from . import silver

    cat = cat or catalogo_padrao()

    # --- motor de SQL, sem publicar -------------------------------------
    # db.conectar() e nao psycopg.connect(): o silver.reconstruir le as linhas
    # por nome de coluna, e isso depende do row_factory=dict_row que vive la.
    from .. import db

    with db.conectar() as con:
        inicio = time.time()
        contagens_sql = silver.reconstruir(con, cat)
        duracao_sql = time.time() - inicio
        con.rollback()

    # --- motor de Spark --------------------------------------------------
    resultado_spark = medir(cat, master)

    chaves = ("sessoes", "tentativas", "blocos", "rejeitados")
    iguais = all(contagens_sql.get(k) == resultado_spark.get(k) for k in chaves)

    return {
        "iguais": iguais,
        "sql": {**{k: contagens_sql.get(k) for k in chaves},
                "duracao_s": round(duracao_sql, 3)},
        "spark": {**{k: resultado_spark.get(k) for k in chaves},
                  "duracao_s": resultado_spark["duracao_s"]},
        "diferencas": [k for k in chaves
                       if contagens_sql.get(k) != resultado_spark.get(k)],
    }
