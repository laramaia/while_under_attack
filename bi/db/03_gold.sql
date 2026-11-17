-- ---------------------------------------------------------------------------
-- Camada GOLD - modelo estrela consumido pela API do dashboard (ADR-003).
--
-- Os indicadores sao calculados AQUI, nao na API e nao no JavaScript
-- (ADR-001). A API so faz SELECT.
--
-- Duas tabelas de fato, porque os indicadores tem dois graos diferentes:
--   fato_tentativa       -> 1 linha por tentativa (ADR-005)
--   fato_progresso_fase  -> 1 linha por jogador x fase, que e o grao real de
--                           "tentativas ate vencer" (RN-012) e de
--                           "eficiencia do codigo" (RN-014)
-- ---------------------------------------------------------------------------

create schema if not exists gold;

drop table if exists gold.fato_progresso_fase cascade;
drop table if exists gold.fato_tentativa      cascade;
drop table if exists gold.dim_resultado       cascade;
drop table if exists gold.dim_data            cascade;
drop table if exists gold.dim_fase            cascade;
drop table if exists gold.dim_conceito        cascade;
drop table if exists gold.dim_jogador         cascade;


create table gold.dim_jogador (
    jogador_sk      serial primary key,
    jogador_id      integer not null unique,
    nome_exibicao   text not null,          -- nunca o nome completo (RN-003)
    perfil          text not null
);


create table gold.dim_conceito (
    conceito_sk     serial primary key,
    conceito_id     text not null unique,
    nome            text not null,
    ordem           integer not null
);


-- A chave natural inclui a catalog_version: mudar uma fase depois de coletar
-- dados cria uma linha nova, para nao misturar tentativas de versoes
-- diferentes do catalogo (ADR-006, RS-03).
create table gold.dim_fase (
    fase_sk             serial primary key,
    fase_id             text not null,
    catalog_version     text not null,
    ordem               integer not null,
    titulo              text not null,
    conceito_sk         integer not null references gold.dim_conceito (conceito_sk),

    -- contado a partir da solucao_referencia do catalogo, nunca digitado
    -- a mao (Catalogo de Fases, secao 2)
    tamanho_referencia  integer not null,

    -- "introducao" se a fase apresenta o conceito, "reforco" se o repete.
    -- Nem toda fase ensina algo novo: algumas existem para fixar o que a
    -- anterior ensinou (ver catalogo.py).
    papel               text not null default 'introducao'
                        check (papel in ('introducao', 'reforco')),

    -- o bloco que representa o conceito da fase. Numa fase de reforco e o
    -- bloco da fase que introduziu o conceito. Nulo quando o conceito nao se
    -- resume a um bloco (ex.: "combinacao").
    bloco_conceito      text,

    unique (fase_id, catalog_version)
);


create table gold.dim_data (
    data_sk     integer primary key,        -- aaaammdd
    data        date not null unique,
    ano         integer not null,
    mes         integer not null,
    dia         integer not null,
    dia_semana  integer not null,
    nome_mes    text not null
);


create table gold.dim_resultado (
    resultado_sk    serial primary key,
    resultado       text not null unique,

    -- RN-012: so vitoria e derrota contam em "tentativas ate vencer".
    -- Interrompida entra num indicador separado, porque o jogador pode ter
    -- parado so para ajustar o programa.
    e_conclusiva    boolean not null
);

insert into gold.dim_resultado (resultado, e_conclusiva) values
    ('vitoria',      true),
    ('derrota',      true),
    ('interrompida', false);


create table gold.fato_tentativa (
    tentativa_id            uuid primary key,   -- dimensao degenerada

    jogador_sk              integer not null references gold.dim_jogador (jogador_sk),
    fase_sk                 integer not null references gold.dim_fase (fase_sk),
    conceito_sk             integer not null references gold.dim_conceito (conceito_sk),
    data_sk                 integer not null references gold.dim_data (data_sk),
    resultado_sk            integer not null references gold.dim_resultado (resultado_sk),

    numero_tentativa        integer not null,
    tempo_edicao_ms         integer,
    duracao_execucao_ms     integer,

    qtd_blocos              integer not null,
    qtd_pilhas_executaveis  integer not null,
    profundidade_max        integer not null,
    tamanho_referencia      integer not null,

    -- RN-008 / EV-05
    programa_concluido      boolean,
    bloco_em_execucao_id    text,
    -- o id do bloco so vale dentro da tentativa; o tipo e o que responde
    -- "em que bloco o jogador trava", entao e resolvido no ETL
    bloco_em_execucao_tipo  text,
    causa_derrota           text,

    -- marca a tentativa que define os indicadores de aprendizagem da fase
    -- (RN-011: a fase e concluida na primeira vitoria)
    e_primeira_vitoria      boolean not null default false,

    -- o programa usou o bloco que representa o conceito da fase? Nulo
    -- quando o conceito nao se resume a um bloco.
    usou_bloco_conceito     boolean,

    origem                  text not null
);

create index ix_fato_tentativa_jogador on gold.fato_tentativa (jogador_sk, fase_sk);
create index ix_fato_tentativa_fase    on gold.fato_tentativa (fase_sk);


create table gold.fato_progresso_fase (
    jogador_sk                          integer not null references gold.dim_jogador (jogador_sk),
    fase_sk                             integer not null references gold.dim_fase (fase_sk),
    conceito_sk                         integer not null references gold.dim_conceito (conceito_sk),

    -- RN-011
    concluida                           boolean not null,
    data_sk_primeira_vitoria            integer references gold.dim_data (data_sk),

    -- RN-012: vitorias e derrotas ate a primeira vitoria, inclusive.
    -- Nulo enquanto a fase nao foi concluida.
    tentativas_ate_vencer               integer,
    -- RN-012: indicador separado, nao soma no de cima
    interrompidas_ate_vencer            integer,

    -- RN-014: blocos da solucao de referencia / blocos do programa da
    -- primeira vitoria. 1,0 = tao enxuto quanto a referencia.
    eficiencia_codigo                   numeric(5, 3),
    qtd_blocos_primeira_vitoria         integer,
    tamanho_referencia                  integer not null,

    -- o programa da primeira vitoria aplicou o conceito que a fase ensina?
    aplicou_conceito                    boolean,

    -- RN-008: de que jeito o jogador perdeu ate vencer. Responde "onde travei".
    derrotas_programa_curto             integer not null default 0,
    derrotas_parou_em_bloco             integer not null default 0,

    tempo_edicao_ate_vencer_ms          bigint,

    -- RN-013: rejogar uma fase concluida nao altera os indicadores acima.
    -- Estes dois contam tudo, inclusive o rejogo, e por isso nao sao
    -- indicadores de aprendizagem.
    total_tentativas                    integer not null,
    ultima_tentativa_em                 timestamptz,

    primary key (jogador_sk, fase_sk)
);

comment on table gold.fato_progresso_fase is
    'Grao: jogador x fase. Os indicadores de aprendizagem olham so as '
    'tentativas ate a primeira vitoria, inclusive (RN-012, RN-013, RN-014).';


-- Visao de apoio para o perfil professor: uma linha por fase, ja agregada.
-- Responde a pergunta do Documento de Visao: "em que fases eles param".
create or replace view gold.vw_fase_resumo as
select
    f.fase_sk,
    f.fase_id,
    f.ordem,
    f.titulo,
    c.conceito_id,
    c.nome                                                as conceito_nome,
    f.tamanho_referencia,
    f.papel,
    f.bloco_conceito,
    count(distinct p.jogador_sk)                          as jogadores_que_chegaram,
    count(distinct p.jogador_sk) filter (where p.concluida) as jogadores_que_concluiram,
    percentile_cont(0.5) within group (order by p.tentativas_ate_vencer)
                                                          as mediana_tentativas_ate_vencer,
    avg(p.eficiencia_codigo)                              as eficiencia_media,
    -- quantos venceram aplicando o conceito que a fase ensina
    count(*) filter (where p.aplicou_conceito)            as aplicaram_conceito,
    count(*) filter (where p.aplicou_conceito is not null) as com_conceito_avaliavel,
    sum(p.derrotas_programa_curto)                        as derrotas_programa_curto,
    sum(p.derrotas_parou_em_bloco)                        as derrotas_parou_em_bloco,
    sum(p.total_tentativas)                               as total_tentativas
from gold.dim_fase f
join gold.dim_conceito c on c.conceito_sk = f.conceito_sk
left join gold.fato_progresso_fase p on p.fase_sk = f.fase_sk
group by f.fase_sk, f.fase_id, f.ordem, f.titulo, c.conceito_id, c.nome,
         f.tamanho_referencia, f.papel, f.bloco_conceito;
