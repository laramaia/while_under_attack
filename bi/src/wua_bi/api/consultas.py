"""As consultas do dashboard.

Todas leem a gold e nenhuma calcula indicador: o calculo ja foi feito no ETL
(ADR-001). Se um numero esta errado, o lugar de corrigir e a camada gold, nao
aqui e nem no JavaScript.
"""

from __future__ import annotations

from typing import Any

from .. import db

# ---------------------------------------------------------------------------
# Visao do jogador (O3)
# ---------------------------------------------------------------------------

RESUMO_JOGADOR = """
select
    count(*) filter (where p.concluida)                      as fases_concluidas,
    (select count(*) from gold.dim_fase)                     as fases_no_catalogo,
    coalesce(sum(p.total_tentativas), 0)                     as total_tentativas,
    round(avg(p.tentativas_ate_vencer), 1)                   as media_tentativas_ate_vencer,
    round(avg(p.eficiencia_codigo), 2)                       as eficiencia_media,
    coalesce(sum(p.interrompidas_ate_vencer), 0)             as interrompidas,
    round(coalesce(sum(p.tempo_edicao_ate_vencer_ms), 0) / 60000.0, 1) as minutos_montando
from gold.fato_progresso_fase p
where p.jogador_sk = %(jogador_sk)s
"""

# Uma linha por fase do catalogo, inclusive as que o jogador ainda nao jogou:
# o dashboard precisa mostrar o caminho inteiro, nao so o que ja aconteceu.
PROGRESSO_JOGADOR = """
select
    f.fase_id,
    f.ordem,
    f.titulo,
    c.nome                              as conceito,
    f.tamanho_referencia,
    f.papel,
    f.bloco_conceito,
    coalesce(p.concluida, false)        as concluida,
    p.tentativas_ate_vencer,
    p.interrompidas_ate_vencer,
    p.eficiencia_codigo,
    p.qtd_blocos_primeira_vitoria,
    p.aplicou_conceito,
    p.derrotas_programa_curto,
    p.derrotas_parou_em_bloco,
    p.total_tentativas,
    p.ultima_tentativa_em,
    -- Mediana da turma na mesma fase, para o jogador ter com o que se
    -- comparar. E um agregado, nao o dado de outro jogador: ver a nota
    -- sobre a RN-004 no README.
    turma.mediana_turma,
    turma.eficiencia_turma
from gold.dim_fase f
join gold.dim_conceito c on c.conceito_sk = f.conceito_sk
left join gold.fato_progresso_fase p
       on p.fase_sk = f.fase_sk and p.jogador_sk = %(jogador_sk)s
left join lateral (
    select
        percentile_cont(0.5) within group (order by o.tentativas_ate_vencer)
                                        as mediana_turma,
        round(avg(o.eficiencia_codigo), 2) as eficiencia_turma
    from gold.fato_progresso_fase o
    where o.fase_sk = f.fase_sk and o.concluida
) turma on true
order by f.ordem
"""

# Cada tentativa na ordem em que aconteceu. E com isto que o jogador ve se
# esta precisando de menos tentativas com o tempo (Documento de Visao, item 1).
LINHA_DO_TEMPO_JOGADOR = """
select
    f.fase_id,
    f.ordem                 as fase_ordem,
    t.numero_tentativa,
    r.resultado,
    t.qtd_blocos,
    t.tamanho_referencia,
    t.causa_derrota,
    t.e_primeira_vitoria,
    d.data,
    round(t.tempo_edicao_ms / 1000.0)      as segundos_montando,
    round(t.duracao_execucao_ms / 1000.0)  as segundos_executando
from gold.fato_tentativa t
join gold.dim_fase      f on f.fase_sk = t.fase_sk
join gold.dim_resultado r on r.resultado_sk = t.resultado_sk
join gold.dim_data      d on d.data_sk = t.data_sk
where t.jogador_sk = %(jogador_sk)s
order by f.ordem, t.numero_tentativa
"""

# RN-008: onde o jogador trava. Separa as duas causas de derrota e, quando a
# execucao parou num bloco, diz em qual TIPO de bloco foi.
ONDE_TRAVOU = """
select
    coalesce(t.bloco_em_execucao_tipo, '(programa acabou antes)') as bloco,
    t.causa_derrota,
    count(*) as derrotas
from gold.fato_tentativa t
join gold.dim_resultado r on r.resultado_sk = t.resultado_sk
where t.jogador_sk = %(jogador_sk)s
  and r.resultado = 'derrota'
group by 1, 2
order by derrotas desc
"""

# Conceitos a revisar: agrega o progresso por conceito, na ordem de ensino.
CONCEITOS_JOGADOR = """
select
    c.conceito_id,
    c.nome,
    c.ordem,
    count(*)                                        as fases,
    count(*) filter (where p.concluida)             as fases_concluidas,
    round(avg(p.tentativas_ate_vencer), 1)          as media_tentativas,
    round(avg(p.eficiencia_codigo), 2)              as eficiencia_media
from gold.dim_conceito c
join gold.dim_fase f on f.conceito_sk = c.conceito_sk
left join gold.fato_progresso_fase p
       on p.fase_sk = f.fase_sk and p.jogador_sk = %(jogador_sk)s
group by c.conceito_id, c.nome, c.ordem
order by c.ordem
"""

# ---------------------------------------------------------------------------
# Visao do professor (O4)
# ---------------------------------------------------------------------------

RESUMO_PROFESSOR = """
select
    (select count(*) from gold.dim_jogador where perfil = 'jogador') as jogadores,
    (select count(*) from gold.dim_fase)                             as fases,
    (select count(*) from gold.fato_tentativa)                       as tentativas,
    (select count(*) from gold.fato_progresso_fase where concluida)  as fases_concluidas,
    (select round(avg(eficiencia_codigo), 2)
       from gold.fato_progresso_fase where concluida)                as eficiencia_media,
    (select count(*) from silver.sessao)                             as sessoes
"""

# O funil: quantos jogadores chegaram a cada fase e quantos concluiram.
# Responde "em que fases eles param" (Documento de Visao, item 1).
FUNIL_FASES = """
select
    fase_id, ordem, titulo, conceito_nome, tamanho_referencia, papel, bloco_conceito,
    jogadores_que_chegaram,
    jogadores_que_concluiram,
    jogadores_que_chegaram - jogadores_que_concluiram as travados,
    mediana_tentativas_ate_vencer,
    round(eficiencia_media, 2) as eficiencia_media,
    aplicaram_conceito,
    com_conceito_avaliavel,
    derrotas_programa_curto,
    derrotas_parou_em_bloco,
    total_tentativas
from gold.vw_fase_resumo
order by ordem
"""

# Atividade da turma ao longo do tempo. Diferente dos indicadores de
# aprendizagem, esta consulta e por tentativa, entao aceita filtro de periodo.
ATIVIDADE = """
select
    d.data,
    count(*) filter (where r.resultado = 'vitoria')      as vitorias,
    count(*) filter (where r.resultado = 'derrota')      as derrotas,
    count(*) filter (where r.resultado = 'interrompida') as interrompidas,
    count(distinct t.jogador_sk)                         as jogadores_ativos
from gold.fato_tentativa t
join gold.dim_data      d on d.data_sk = t.data_sk
join gold.dim_resultado r on r.resultado_sk = t.resultado_sk
join gold.dim_fase      f on f.fase_sk = t.fase_sk
join gold.dim_conceito  c on c.conceito_sk = t.conceito_sk
-- o cast na primeira aparicao e necessario: sem ele o Postgres nao consegue
-- deduzir o tipo de um parametro que pode vir nulo
where (%(desde)s::date is null or d.data >= %(desde)s::date)
  and (%(conceito)s::text is null or c.conceito_id = %(conceito)s)
group by d.data
order by d.data
"""

# Na enesima tentativa, que fracao das vezes o jogador vence? Mostra quanto a
# turma aprende tentando: se a taxa sobe, as derrotas estao ensinando algo.
VITORIA_POR_TENTATIVA = """
select
    t.numero_tentativa,
    count(*)                                        as tentativas,
    count(*) filter (where r.resultado = 'vitoria') as vitorias,
    round(100.0 * count(*) filter (where r.resultado = 'vitoria')
          / nullif(count(*), 0), 1)                 as taxa_vitoria
from gold.fato_tentativa t
join gold.dim_resultado r on r.resultado_sk = t.resultado_sk
join gold.dim_fase      f on f.fase_sk = t.fase_sk
join gold.dim_conceito  c on c.conceito_sk = t.conceito_sk
where r.e_conclusiva
  and t.numero_tentativa <= 8
  and (%(conceito)s::text is null or c.conceito_id = %(conceito)s)
group by t.numero_tentativa
order by t.numero_tentativa
"""

# Os conceitos disponiveis para o filtro.
CONCEITOS_FILTRO = """
select conceito_id, nome, ordem from gold.dim_conceito order by ordem
"""

JOGADORES_PROFESSOR = """
select
    j.jogador_id,
    j.nome_exibicao,
    count(*) filter (where p.concluida)              as fases_concluidas,
    max(f.ordem) filter (where p.concluida)          as fase_mais_longe,
    coalesce(sum(p.total_tentativas), 0)             as tentativas,
    round(avg(p.tentativas_ate_vencer), 1)           as media_tentativas_ate_vencer,
    round(avg(p.eficiencia_codigo), 2)               as eficiencia_media,
    max(p.ultima_tentativa_em)                       as ultima_atividade
from gold.dim_jogador j
left join gold.fato_progresso_fase p on p.jogador_sk = j.jogador_sk
left join gold.dim_fase f on f.fase_sk = p.fase_sk
where j.perfil = 'jogador'
group by j.jogador_id, j.nome_exibicao
order by fases_concluidas desc nulls last, tentativas
"""

# Jogador x fase: uma celula por par, para enxergar de relance quem travou onde.
HEATMAP_PROFESSOR = """
select
    j.nome_exibicao,
    j.jogador_id,
    f.fase_id,
    f.ordem,
    p.concluida,
    p.tentativas_ate_vencer,
    p.total_tentativas,
    p.eficiencia_codigo
from gold.dim_jogador j
cross join gold.dim_fase f
left join gold.fato_progresso_fase p
       on p.jogador_sk = j.jogador_sk and p.fase_sk = f.fase_sk
where j.perfil = 'jogador'
order by j.nome_exibicao, f.ordem
"""

# Quais tipos de bloco mais aparecem nas derrotas, somando todos os jogadores.
# Indica qual conceito a fase esta explicando mal.
BLOCOS_PROBLEMATICOS = """
select
    f.fase_id,
    coalesce(t.bloco_em_execucao_tipo, '(programa acabou antes)') as bloco,
    count(*) as derrotas
from gold.fato_tentativa t
join gold.dim_fase f on f.fase_sk = t.fase_sk
join gold.dim_resultado r on r.resultado_sk = t.resultado_sk
where r.resultado = 'derrota'
group by f.fase_id, 2
order by derrotas desc
limit 20
"""

# ---------------------------------------------------------------------------
# Procedencia dos dados (RS-02)
# ---------------------------------------------------------------------------

# O dashboard precisa dizer, na cara, se esta mostrando dado real ou sintetico.
PROCEDENCIA = """
select
    coalesce(max(e.catalog_version), '-')                   as catalog_version,
    count(*)                                                as eventos,
    count(*) filter (where e.origem = 'sintetico')          as eventos_sinteticos,
    max(e.received_at)                                      as ultimo_evento,
    (select max(terminada_em) from bronze.etl_execucao)     as ultimo_etl,
    (select count(*) from silver.evento_rejeitado)          as eventos_rejeitados
from bronze.eventos e
"""


def _um(sql: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    linhas = db.consultar(sql, params)
    return linhas[0] if linhas else {}


def resumo_jogador(jogador_sk: int) -> dict[str, Any]:
    return _um(RESUMO_JOGADOR, {"jogador_sk": jogador_sk})


def jogador_sk_de(jogador_id: int) -> int | None:
    linhas = db.consultar(
        "select jogador_sk from gold.dim_jogador where jogador_id = %(id)s",
        {"id": jogador_id},
    )
    return linhas[0]["jogador_sk"] if linhas else None


# ---------------------------------------------------------------------------
# Destaques
# ---------------------------------------------------------------------------

# Cada destaque e uma leitura dos numeros que ja estao na gold, com o limiar
# escrito aqui em cima para poder ser discutido. Nao e estatistica: e o
# professor olhando a tabela e dizendo "esta fase esta cara demais".
LIMIAR_FUNIL = 0.30          # fracao dos que chegaram e nao concluiram
LIMIAR_CONCEITO = 0.70       # fracao que venceu aplicando o conceito
LIMIAR_EFICIENCIA = 0.70     # eficiencia media da fase
DIAS_PARADO = 7


# Uma fase de reforco repete um conceito que ja foi ensinado, entao a
# expectativa e que custe MENOS que a fase que o introduziu. Quando custa
# mais, ou o reforco esta dificil demais, ou o conceito nao pegou na
# introducao. As duas leituras interessam a quem desenha as fases.
SQL_REFORCO = """
select
    reforco.fase_id                             as fase_reforco,
    reforco.titulo                              as titulo_reforco,
    intro.fase_id                               as fase_intro,
    reforco.conceito_nome,
    reforco.mediana_tentativas_ate_vencer       as mediana_reforco,
    intro.mediana_tentativas_ate_vencer         as mediana_intro
from gold.vw_fase_resumo reforco
join gold.vw_fase_resumo intro
  on intro.conceito_id = reforco.conceito_id
 and intro.papel = 'introducao'
where reforco.papel = 'reforco'
  and reforco.mediana_tentativas_ate_vencer is not null
  and intro.mediana_tentativas_ate_vencer is not null
"""


def _tentativas(quantidade: float) -> str:
    return f"{quantidade:g} tentativa" + ("" if quantidade == 1 else "s")


def _destaques_de_reforco() -> list[dict[str, Any]]:
    achados: list[dict[str, Any]] = []

    for linha in db.consultar(SQL_REFORCO):
        reforco = float(linha["mediana_reforco"])
        intro = float(linha["mediana_intro"])

        if reforco > intro:
            achados.append({
                "nivel": "atencao",
                "titulo": f"{linha['fase_reforco']} deveria ser mais fácil que "
                          f"{linha['fase_intro']}",
                "texto": f"“{linha['titulo_reforco']}” reforça "
                         f"{linha['conceito_nome'].lower()}, mas custa "
                         f"{_tentativas(reforco)} contra {intro:g} da fase que "
                         f"ensinou o conceito. Ou o reforço está difícil demais, "
                         f"ou o conceito não pegou na introdução.",
            })
        else:
            achados.append({
                "nivel": "info",
                "titulo": f"O reforço em {linha['fase_reforco']} está funcionando",
                "texto": f"{_tentativas(reforco)} contra {intro:g} em "
                         f"{linha['fase_intro']}: a turma resolve o mesmo "
                         f"conceito com menos tentativas na segunda vez.",
            })

    return achados


def destaques() -> list[dict[str, Any]]:
    """Achados que valem uma olhada, em ordem de gravidade."""
    achados: list[dict[str, Any]] = []

    for fase in db.consultar(FUNIL_FASES):
        chegaram = fase["jogadores_que_chegaram"] or 0
        travados = fase["travados"] or 0

        if chegaram >= 3 and travados / chegaram >= LIMIAR_FUNIL:
            achados.append({
                "nivel": "critico",
                "titulo": f"{fase['fase_id']} esta segurando a turma",
                "texto": f"{travados} de {chegaram} jogadores chegaram a "
                         f"“{fase['titulo']}” e nao conseguiram concluir.",
            })

        avaliaveis = fase["com_conceito_avaliavel"] or 0
        aplicaram = fase["aplicaram_conceito"] or 0
        if avaliaveis >= 3 and aplicaram / avaliaveis < LIMIAR_CONCEITO:
            achados.append({
                "nivel": "atencao",
                "titulo": f"{fase['fase_id']} esta sendo vencida sem o conceito",
                "texto": f"So {aplicaram} de {avaliaveis} usaram o bloco "
                         f"“{fase['bloco_conceito']}” para vencer. Os outros "
                         f"contornaram, entao a fase nao esta cobrando "
                         f"{fase['conceito_nome'].lower()}.",
            })

        eficiencia = fase["eficiencia_media"]
        if eficiencia is not None and float(eficiencia) < LIMIAR_EFICIENCIA:
            achados.append({
                "nivel": "atencao",
                "titulo": f"Programas longos em {fase['fase_id']}",
                "texto": f"A eficiência media e {eficiencia}: os programas "
                         f"vencedores tem bem mais blocos que a solucao de "
                         f"referencia.",
            })

        if (fase["derrotas_programa_curto"] or 0) > 2 * (fase["derrotas_parou_em_bloco"] or 1):
            achados.append({
                "nivel": "info",
                "titulo": f"Em {fase['fase_id']} o programa acaba cedo demais",
                "texto": f"{fase['derrotas_programa_curto']} derrotas foram por "
                         f"o programa terminar com o inimigo vivo. Pode ser que "
                         f"a fase nao deixe claro quanto dano falta.",
            })

    achados += _destaques_de_reforco()

    parados = db.consultar(
        """
        select j.nome_exibicao,
               extract(day from now() - max(p.ultima_tentativa_em))::int as dias
        from gold.fato_progresso_fase p
        join gold.dim_jogador j on j.jogador_sk = p.jogador_sk
        group by j.nome_exibicao
        having max(p.ultima_tentativa_em) < now() - make_interval(days => %(dias)s)
        order by dias desc
        """,
        {"dias": DIAS_PARADO},
    )
    if parados:
        nomes = ", ".join(p["nome_exibicao"] for p in parados[:5])
        achados.append({
            "nivel": "info",
            "titulo": f"{len(parados)} jogadores parados ha mais de {DIAS_PARADO} dias",
            "texto": nomes + ("..." if len(parados) > 5 else ""),
        })

    ordem = {"critico": 0, "atencao": 1, "info": 2}
    achados.sort(key=lambda a: ordem[a["nivel"]])
    return achados


def procedencia() -> dict[str, Any]:
    dados = _um(PROCEDENCIA)
    eventos = dados.get("eventos") or 0
    sinteticos = dados.get("eventos_sinteticos") or 0
    dados["so_sintetico"] = eventos > 0 and sinteticos == eventos
    dados["tem_sintetico"] = sinteticos > 0
    return dados
