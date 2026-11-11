"""silver -> gold: dimensoes, fatos e os indicadores do dashboard.

Os indicadores sao calculados aqui, em SQL, e gravados. A API so faz SELECT e
o JavaScript so desenha. Essa separacao e o que a ADR-001 promete poder
mostrar na banca.

Indicadores implementados:
    RN-011  fase concluida na primeira vitoria
    RN-012  tentativas ate vencer (interrompidas em indicador separado)
    RN-013  rejogar fase concluida nao altera os indicadores de aprendizagem
    RN-014  eficiencia do codigo
    RN-008  as duas causas de derrota
"""

from __future__ import annotations

import psycopg

from ..catalogo import Catalogo, catalogo_padrao

# ---------------------------------------------------------------------------
# Dimensoes
# ---------------------------------------------------------------------------

SQL_DIM_JOGADOR = """
insert into gold.dim_jogador (jogador_id, nome_exibicao, perfil)
select jogador_id, nome_exibicao, perfil from app.jogador
"""

# A dim_data cobre so os dias em que houve tentativa. Nao existe calendario
# futuro: com o volume do MVP isso so criaria linhas vazias.
SQL_DIM_DATA = """
insert into gold.dim_data (data_sk, data, ano, mes, dia, dia_semana, nome_mes)
select distinct
    to_char(d, 'YYYYMMDD')::int,
    d::date,
    extract(year  from d)::int,
    extract(month from d)::int,
    extract(day   from d)::int,
    extract(isodow from d)::int,
    to_char(d, 'TMMonth')
from (select distinct date_trunc('day', iniciada_em) as d from silver.tentativa) dias
"""

# ---------------------------------------------------------------------------
# Fatos
# ---------------------------------------------------------------------------

# Base comum dos dois fatos: cada tentativa conclusiva ja marcada com o numero
# da primeira vitoria daquele jogador naquela fase.
#
# Tentativa sem EV-05 (resultado nulo) fica de fora: ela nao terminou, entao
# nao ha resultado unico para analisar (RN-007).
SQL_BASE = """
with conclusivas as (
    select
        t.*,
        min(t.numero_tentativa) filter (where t.resultado = 'vitoria')
            over (partition by t.jogador_id, t.fase_id) as num_primeira_vitoria
    from silver.tentativa t
    where t.resultado is not null
)
select
    c.*,
    -- RN-013: o que vier depois da primeira vitoria e rejogo e nao conta nos
    -- indicadores de aprendizagem.
    (c.num_primeira_vitoria is not null
     and c.numero_tentativa <= c.num_primeira_vitoria)        as ate_vencer,
    (c.numero_tentativa = c.num_primeira_vitoria)             as e_primeira_vitoria
from conclusivas c
"""

SQL_FATO_TENTATIVA = f"""
insert into gold.fato_tentativa (
    tentativa_id, jogador_sk, fase_sk, conceito_sk, data_sk, resultado_sk,
    numero_tentativa, tempo_edicao_ms, duracao_execucao_ms, qtd_blocos,
    qtd_pilhas_executaveis, profundidade_max, tamanho_referencia,
    programa_concluido, bloco_em_execucao_id, bloco_em_execucao_tipo,
    causa_derrota, e_primeira_vitoria, usou_bloco_conceito, origem
)
with base as ({SQL_BASE})
select
    b.tentativa_id,
    j.jogador_sk,
    f.fase_sk,
    f.conceito_sk,
    to_char(b.iniciada_em, 'YYYYMMDD')::int,
    r.resultado_sk,
    b.numero_tentativa,
    b.tempo_edicao_ms,
    b.duracao_execucao_ms,
    b.qtd_blocos,
    b.qtd_pilhas_executaveis,
    b.profundidade_max,
    f.tamanho_referencia,
    b.programa_concluido,
    b.bloco_em_execucao_id,
    pb.tipo,
    b.causa_derrota,
    coalesce(b.e_primeira_vitoria, false),
    -- o programa usou o bloco que representa o conceito da fase? Nulo
    -- quando o conceito nao se resume a um bloco, porque ai a pergunta nao
    -- se coloca.
    case when f.bloco_conceito is not null then exists (
        select 1 from silver.programa_bloco u
        where u.tentativa_id = b.tentativa_id
          and u.tipo = f.bloco_conceito
          and u.pilha_executavel          -- bloco em pilha solta nao executa (RN-018)
    ) end,
    b.origem
from base b
join gold.dim_jogador  j on j.jogador_id = b.jogador_id
join gold.dim_fase     f on f.fase_id = b.fase_id
                        and f.catalog_version = b.catalog_version
join gold.dim_resultado r on r.resultado = b.resultado
-- resolve o id do bloco para o tipo dele, que e o que o dashboard mostra
left join silver.programa_bloco pb on pb.tentativa_id = b.tentativa_id
                                  and pb.bloco_id = b.bloco_em_execucao_id
"""

# O grao real dos indicadores de aprendizagem: jogador x fase.
SQL_FATO_PROGRESSO = f"""
insert into gold.fato_progresso_fase (
    jogador_sk, fase_sk, conceito_sk, concluida, data_sk_primeira_vitoria,
    tentativas_ate_vencer, interrompidas_ate_vencer, eficiencia_codigo,
    qtd_blocos_primeira_vitoria, tamanho_referencia, aplicou_conceito,
    derrotas_programa_curto, derrotas_parou_em_bloco,
    tempo_edicao_ate_vencer_ms, total_tentativas, ultima_tentativa_em
)
with base as ({SQL_BASE}),
agregado as (
    select
        b.jogador_id,
        b.fase_id,
        b.catalog_version,

        -- RN-011: a fase e concluida na primeira vitoria
        bool_or(b.resultado = 'vitoria')                        as concluida,

        -- RN-012: conta vitorias e derrotas ate a primeira vitoria, inclusive.
        count(*) filter (where b.ate_vencer and b.resultado in ('vitoria', 'derrota'))
                                                                as tentativas_ate_vencer,
        -- RN-012: interrompida nao entra no numero acima. O jogador pode ter
        -- apertado Stop so para ajustar o programa.
        count(*) filter (where b.ate_vencer and b.resultado = 'interrompida')
                                                                as interrompidas_ate_vencer,

        -- RN-014: a eficiencia olha o programa da PRIMEIRA vitoria
        max(b.qtd_blocos)      filter (where b.e_primeira_vitoria) as qtd_blocos_1a,
        max(b.iniciada_em)     filter (where b.e_primeira_vitoria) as data_1a,
        -- so uma tentativa por jogador e fase tem e_primeira_vitoria, entao
        -- o agregado e so um jeito de tirar a linha do grupo. Postgres nao
        -- tem max() para uuid; por texto da no mesmo com uma linha so.
        max(b.tentativa_id::text) filter (where b.e_primeira_vitoria) as tentativa_1a,

        -- RN-008
        count(*) filter (where b.ate_vencer and b.causa_derrota = 'programa_curto')
                                                                as derrotas_programa_curto,
        count(*) filter (where b.ate_vencer and b.causa_derrota = 'parou_em_bloco')
                                                                as derrotas_parou_em_bloco,

        sum(b.tempo_edicao_ms) filter (where b.ate_vencer)       as tempo_edicao_ate_vencer,

        -- RN-013: estes dois contam tudo, inclusive o rejogo, e por isso nao
        -- sao indicadores de aprendizagem.
        count(*)                                                as total_tentativas,
        max(b.iniciada_em)                                      as ultima_tentativa_em
    from base b
    group by b.jogador_id, b.fase_id, b.catalog_version
)
select
    j.jogador_sk,
    f.fase_sk,
    f.conceito_sk,
    a.concluida,
    to_char(a.data_1a, 'YYYYMMDD')::int,
    case when a.concluida then a.tentativas_ate_vencer end,
    case when a.concluida then a.interrompidas_ate_vencer end,
    -- RN-014: blocos da referencia / blocos do programa vencedor.
    -- 1,0 = tao enxuto quanto a referencia.
    case when a.qtd_blocos_1a > 0
         then round(f.tamanho_referencia::numeric / a.qtd_blocos_1a, 3) end,
    a.qtd_blocos_1a,
    f.tamanho_referencia,
    -- ja calculado por tentativa; aqui so se pega o da primeira vitoria
    t.usou_bloco_conceito,
    a.derrotas_programa_curto,
    a.derrotas_parou_em_bloco,
    case when a.concluida then a.tempo_edicao_ate_vencer end,
    a.total_tentativas,
    a.ultima_tentativa_em
from agregado a
join gold.dim_jogador j on j.jogador_id = a.jogador_id
join gold.dim_fase    f on f.fase_id = a.fase_id
                       and f.catalog_version = a.catalog_version
left join gold.fato_tentativa t on t.tentativa_id = a.tentativa_1a::uuid
"""


def reconstruir(conexao: psycopg.Connection, cat: Catalogo | None = None) -> dict[str, int]:
    cat = cat or catalogo_padrao()
    cursor = conexao.cursor()

    # A gold tambem e derivada. Como tudo e refeito, as chaves substitutas
    # mudam a cada execucao: nada fora da gold guarda um *_sk.
    cursor.execute("""
        truncate gold.fato_progresso_fase, gold.fato_tentativa, gold.dim_jogador,
                 gold.dim_fase, gold.dim_conceito, gold.dim_data
        restart identity cascade
    """)

    cursor.execute(SQL_DIM_JOGADOR)
    jogadores = cursor.rowcount

    cursor.executemany(
        "insert into gold.dim_conceito (conceito_id, nome, ordem) values (%s, %s, %s)",
        [(c.conceito_id, c.nome, c.ordem) for c in cat.conceitos],
    )

    # dim_fase guarda a catalog_version: mudar uma fase depois de coletar dados
    # cria uma linha nova em vez de reescrever a antiga (ADR-006, RS-03).
    cursor.executemany(
        """
        insert into gold.dim_fase (
            fase_id, catalog_version, ordem, titulo, conceito_sk,
            tamanho_referencia, papel, bloco_conceito
        )
        select %s, %s, %s, %s, c.conceito_sk, %s, %s, %s
        from gold.dim_conceito c where c.conceito_id = %s
        """,
        [(f.fase_id, cat.catalog_version, f.ordem, f.titulo, f.tamanho_referencia,
          cat.papel(f), cat.bloco_do_conceito(f), f.conceito_id)
         for f in cat.fases],
    )

    cursor.execute(SQL_DIM_DATA)
    datas = cursor.rowcount

    cursor.execute(SQL_FATO_TENTATIVA)
    tentativas = cursor.rowcount

    cursor.execute(SQL_FATO_PROGRESSO)
    progresso = cursor.rowcount

    return {
        "dim_jogador": jogadores,
        "dim_conceito": len(cat.conceitos),
        "dim_fase": len(cat.fases),
        "dim_data": datas,
        "fato_tentativa": tentativas,
        "fato_progresso_fase": progresso,
    }
