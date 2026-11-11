"""bronze -> silver: reconstroi sessoes, tentativas e programas."""

from __future__ import annotations

import json
from typing import Any

import psycopg

from .. import config
from ..catalogo import Catalogo, catalogo_padrao
from ..programa import ler_programa

# ---------------------------------------------------------------------------
# Sessoes
# ---------------------------------------------------------------------------

# Uma sessao e o periodo continuo de uso (Glossario). Ela termina no EV-02 ou,
# se ele nunca chegou, depois de MINUTOS_INATIVIDADE_SESSAO sem eventos
# (Contrato de Eventos, secao 3). Sessao cujo ultimo evento e recente demais
# fica em aberto: pode ser que o jogador ainda esteja jogando.
SQL_SESSAO = """
insert into silver.sessao (
    session_id, jogador_id, iniciada_em, encerrada_em, motivo_encerramento,
    duracao_min, qtd_eventos, qtd_tentativas, catalog_version, game_version, origem
)
with agregado as (
    select
        session_id,
        max(jogador_id)                                              as jogador_id,
        min(occurred_at)                                             as iniciada_em,
        max(occurred_at)                                             as ultimo_evento,
        count(*)                                                     as qtd_eventos,
        count(*) filter (where event_type = 'tentativa_executada')   as qtd_tentativas,
        max(payload ->> 'motivo') filter (where event_type = 'sessao_encerrada')
                                                                     as motivo_evento,
        max(catalog_version)                                         as catalog_version,
        max(game_version)                                            as game_version,
        max(origem)                                                  as origem
    from bronze.eventos
    group by session_id
),
classificado as (
    select
        a.*,
        case
            when a.motivo_evento is not null then a.motivo_evento
            when a.ultimo_evento < now() - make_interval(mins => %(minutos)s) then 'inatividade'
        end as motivo_encerramento
    from agregado a
)
select
    session_id,
    jogador_id,
    iniciada_em,
    case when motivo_encerramento is not null then ultimo_evento end as encerrada_em,
    motivo_encerramento,
    case when motivo_encerramento is not null
         then round(extract(epoch from (ultimo_evento - iniciada_em)) / 60.0, 2)
    end as duracao_min,
    qtd_eventos,
    qtd_tentativas,
    catalog_version,
    game_version,
    origem
from classificado
"""


# ---------------------------------------------------------------------------
# Tentativas
# ---------------------------------------------------------------------------

SQL_EV04 = """
select
    e.payload ->> 'tentativa_id'                as tentativa_id,
    e.payload ->> 'fase_id'                     as fase_id,
    e.payload ->  'programa'                    as programa,
    (e.payload ->> 'tempo_edicao_ms')::int      as tempo_edicao_ms,
    e.session_id, e.jogador_id, e.catalog_version, e.origem,
    e.occurred_at, e.received_at, e.seq, e.event_id
from bronze.eventos e
where e.event_type = 'tentativa_executada'
order by e.received_at, e.seq
"""

SQL_EV05 = """
select
    e.payload ->> 'tentativa_id'                    as tentativa_id,
    e.payload ->> 'resultado'                       as resultado,
    (e.payload ->> 'duracao_execucao_ms')::int      as duracao_execucao_ms,
    (e.payload ->> 'vida_guerreiro_final')::int     as vida_guerreiro_final,
    (e.payload ->> 'vida_inimigo_final')::int       as vida_inimigo_final,
    (e.payload ->> 'programa_concluido')::boolean   as programa_concluido,
    e.payload ->> 'bloco_em_execucao_id'            as bloco_em_execucao_id,
    e.occurred_at                                   as finalizada_em,
    e.event_id
from bronze.eventos e
where e.event_type = 'tentativa_finalizada'
"""


def _causa_derrota(resultado: str | None, programa_concluido: bool | None) -> str | None:
    """RN-008: separa as duas causas de derrota.

    O Contrato de Eventos (EV-05) diz que programa_concluido e
    bloco_em_execucao_id existem exatamente para isso: ou o programa acabou e
    o inimigo atacou ate o guerreiro morrer, ou a execucao parou num bloco.
    """
    if resultado != "derrota":
        return None
    return "programa_curto" if programa_concluido else "parou_em_bloco"


def reconstruir(conexao: psycopg.Connection, cat: Catalogo | None = None) -> dict[str, int]:
    cat = cat or catalogo_padrao()
    tipos_de_evento = cat.tipos_de_evento
    cursor = conexao.cursor()

    # a silver e derivada: joga fora e refaz
    cursor.execute("truncate silver.programa_bloco, silver.tentativa, "
                   "silver.sessao, silver.evento_rejeitado cascade")

    cursor.execute(SQL_SESSAO, {"minutos": config.MINUTOS_INATIVIDADE_SESSAO})
    sessoes = cursor.rowcount

    cursor.execute(SQL_EV05)
    fins: dict[str, dict[str, Any]] = {linha["tentativa_id"]: linha for linha in cursor.fetchall()}

    cursor.execute(SQL_EV04)
    inicios = cursor.fetchall()

    rejeitados: list[tuple[str, str, str, str]] = []
    vistos: set[str] = set()
    contagem: dict[tuple[int, str], int] = {}
    tentativas: list[dict[str, Any]] = []
    blocos: list[tuple] = []

    for inicio in inicios:
        tentativa_id = inicio["tentativa_id"]

        # Mesmo tentativa_id em dois EV-04 nao deveria acontecer. Se acontecer,
        # o primeiro vale e o resto vira registro de problema.
        if tentativa_id in vistos:
            rejeitados.append((str(inicio["event_id"]), "tentativa_executada",
                               "tentativa_id repetido", tentativa_id))
            continue
        vistos.add(tentativa_id)

        fase = cat.fase(inicio["fase_id"])
        if fase is None:
            # EV-03/EV-04: a fase deve existir no catalogo da catalog_version
            # informada. Se nao existe, nao da para analisar a tentativa.
            rejeitados.append((str(inicio["event_id"]), "tentativa_executada",
                               "fase fora do catalogo", inicio["fase_id"]))
            continue

        lido = ler_programa(inicio["programa"], tipos_de_evento)

        chave = (inicio["jogador_id"], inicio["fase_id"])
        contagem[chave] = contagem.get(chave, 0) + 1

        fim = fins.get(tentativa_id)
        resultado = fim["resultado"] if fim else None

        tentativas.append({
            "tentativa_id": tentativa_id,
            "session_id": inicio["session_id"],
            "jogador_id": inicio["jogador_id"],
            "fase_id": inicio["fase_id"],
            "catalog_version": inicio["catalog_version"],
            "numero_tentativa": contagem[chave],
            "iniciada_em": inicio["occurred_at"],
            "finalizada_em": fim["finalizada_em"] if fim else None,
            "resultado": resultado,
            "tempo_edicao_ms": inicio["tempo_edicao_ms"],
            "duracao_execucao_ms": fim["duracao_execucao_ms"] if fim else None,
            "vida_guerreiro_final": fim["vida_guerreiro_final"] if fim else None,
            "vida_inimigo_final": fim["vida_inimigo_final"] if fim else None,
            "programa_concluido": fim["programa_concluido"] if fim else None,
            "bloco_em_execucao_id": fim["bloco_em_execucao_id"] if fim else None,
            "programa": json.dumps(inicio["programa"]),
            "qtd_blocos": lido.qtd_blocos,
            "qtd_pilhas": lido.qtd_pilhas,
            "qtd_pilhas_executaveis": lido.qtd_pilhas_executaveis,
            "profundidade_max": lido.profundidade_max,
            "causa_derrota": _causa_derrota(
                resultado, fim["programa_concluido"] if fim else None),
            "origem": inicio["origem"],
        })

        for bloco in lido.blocos:
            blocos.append((
                tentativa_id, bloco.bloco_id, bloco.pilha_indice, bloco.bloco_pai_id,
                bloco.posicao, bloco.profundidade, bloco.tipo, cat.categoria(bloco.tipo),
                bloco.condicao_tipo,
                json.dumps(bloco.params) if bloco.params is not None else None,
                bloco.pilha_executavel,
            ))

    # EV-05 sem o EV-04 correspondente: o jogo mandou o fim e o comeco se
    # perdeu. Nao da para montar a tentativa.
    for tentativa_id, fim in fins.items():
        if tentativa_id not in vistos:
            rejeitados.append((str(fim["event_id"]), "tentativa_finalizada",
                               "tentativa_finalizada sem tentativa_executada", tentativa_id))

    if tentativas:
        cursor.executemany(
            """
            insert into silver.tentativa (
                tentativa_id, session_id, jogador_id, fase_id, catalog_version,
                numero_tentativa, iniciada_em, finalizada_em, resultado,
                tempo_edicao_ms, duracao_execucao_ms, vida_guerreiro_final,
                vida_inimigo_final, programa_concluido, bloco_em_execucao_id,
                programa, qtd_blocos, qtd_pilhas, qtd_pilhas_executaveis,
                profundidade_max, causa_derrota, origem
            ) values (
                %(tentativa_id)s, %(session_id)s, %(jogador_id)s, %(fase_id)s,
                %(catalog_version)s, %(numero_tentativa)s, %(iniciada_em)s,
                %(finalizada_em)s, %(resultado)s, %(tempo_edicao_ms)s,
                %(duracao_execucao_ms)s, %(vida_guerreiro_final)s,
                %(vida_inimigo_final)s, %(programa_concluido)s,
                %(bloco_em_execucao_id)s, %(programa)s, %(qtd_blocos)s,
                %(qtd_pilhas)s, %(qtd_pilhas_executaveis)s, %(profundidade_max)s,
                %(causa_derrota)s, %(origem)s
            )
            """,
            tentativas,
        )

    if blocos:
        cursor.executemany(
            """
            insert into silver.programa_bloco (
                tentativa_id, bloco_id, pilha_indice, bloco_pai_id, posicao,
                profundidade, tipo, categoria, condicao_tipo, params, pilha_executavel
            ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            blocos,
        )

    if rejeitados:
        cursor.executemany(
            """
            insert into silver.evento_rejeitado (event_id, event_type, motivo, detalhe)
            values (%s, %s, %s, to_jsonb(%s::text))
            on conflict (event_id) do nothing
            """,
            rejeitados,
        )

    return {
        "sessoes": sessoes,
        "tentativas": len(tentativas),
        "blocos": len(blocos),
        "rejeitados": len(rejeitados),
    }
