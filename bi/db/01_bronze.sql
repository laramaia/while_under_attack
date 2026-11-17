-- ---------------------------------------------------------------------------
-- Camada BRONZE - evento bruto, como chegou do jogo (ADR-003)
--
-- Regras implementadas aqui:
--   RN-015  event_id repetido e ignorado sem erro  -> unique(event_id)
--   RN-016  evento gravado nunca e alterado nem apagado -> trigger de imutabilidade
--   RN-006  jogador_id vem do token, nunca do corpo -> coluna preenchida pela API
--   RS-02   dado sintetico sempre separado do real -> coluna origem
-- ---------------------------------------------------------------------------

create schema if not exists bronze;

-- Schema operacional do back-end (autenticacao, contas). NAO faz parte da
-- Medallion: fica aqui so para o ETL conseguir montar a dim_jogador enquanto
-- o back-end (ADR-002/ADR-004) nao existe. Quando existir, esta tabela e
-- substituida pela tabela de contas real.
create schema if not exists app;

create table if not exists app.jogador (
    jogador_id      serial primary key,
    usuario         text not null unique,
    senha_hash      text not null,                  -- nunca em texto puro (ADR-004)
    nome_exibicao   text not null,                  -- primeiro nome ou apelido (RN-003)
    perfil          text not null check (perfil in ('jogador', 'professor')),
    criado_em       timestamptz not null default now()
);

comment on table app.jogador is
    'Contas pre-criadas pela equipe (RN-001). Propriedade do back-end; o BI so le.';


create table if not exists bronze.eventos (
    id              bigserial primary key,

    -- envelope comum (Contrato de Eventos, secao 2)
    event_id        uuid        not null,
    event_type      text        not null,
    schema_version  integer     not null,
    catalog_version text        not null,
    game_version    text        not null,
    session_id      uuid        not null,
    seq             integer     not null check (seq >= 1),
    occurred_at     timestamptz not null,
    payload         jsonb       not null,

    -- campos que o jogo nao envia (Contrato de Eventos, secao 2)
    jogador_id      integer     not null references app.jogador (jogador_id),
    received_at     timestamptz not null default now(),

    -- controle do BI
    origem          text        not null default 'jogo'
                    check (origem in ('jogo', 'sintetico')),

    constraint eventos_event_id_unico unique (event_id),
    constraint eventos_tipo_conhecido check (event_type in (
        'sessao_iniciada',      -- EV-01
        'sessao_encerrada',     -- EV-02
        'fase_iniciada',        -- EV-03
        'tentativa_executada',  -- EV-04
        'tentativa_finalizada'  -- EV-05
    ))
);

comment on table bronze.eventos is
    'Append-only. Um evento do jogo por linha, payload cru em jsonb (RN-016).';
comment on column bronze.eventos.seq is
    'Contador por sessao. Ordena os eventos quando o relogio do celular erra (ADR-007, RS-05).';
comment on column bronze.eventos.origem is
    'sintetico = gerado para desenvolvimento, nunca entra na demonstracao (RS-02).';

create index if not exists ix_eventos_sessao      on bronze.eventos (session_id, seq);
create index if not exists ix_eventos_tipo        on bronze.eventos (event_type);
create index if not exists ix_eventos_jogador     on bronze.eventos (jogador_id);
create index if not exists ix_eventos_tentativa   on bronze.eventos ((payload ->> 'tentativa_id'));


-- RN-016: a bronze e imutavel. Corrigir dado errado se faz reprocessando a
-- silver, nunca editando a bronze.
create or replace function bronze.impedir_alteracao() returns trigger as $$
begin
    raise exception 'bronze.eventos e imutavel: % proibido (RN-016)', tg_op;
end;
$$ language plpgsql;

drop trigger if exists trg_eventos_imutavel on bronze.eventos;
create trigger trg_eventos_imutavel
    before update or delete on bronze.eventos
    for each row execute function bronze.impedir_alteracao();


-- Controle de execucoes do ETL. Serve para mostrar na banca quando cada
-- camada foi reconstruida e quantas linhas sairam de cada etapa.
--
-- Arquitetura de referencia, faixa "Observabilidade": e daqui que saem as
-- metricas e os logos de execucao que o painel e o alerta de falha leem.
-- clock_timestamp() e nao now(): o ETL inteiro roda numa transacao so, e
-- now() devolve a hora de INICIO da transacao. Com now() todas as etapas
-- ficariam com o mesmo horario e a duracao de todas daria zero - uma metrica
-- de observabilidade que mente.
create table if not exists bronze.etl_execucao (
    execucao_id     bigserial primary key,
    etapa           text not null check (etapa in ('silver', 'gold')),
    iniciada_em     timestamptz not null default clock_timestamp(),
    terminada_em    timestamptz,
    linhas_lidas    integer,
    linhas_gravadas integer,
    erro            text
);

alter table bronze.etl_execucao
    alter column iniciada_em set default clock_timestamp();

-- A tabela acima ja existia aceitando so 'silver' e 'gold'. O gate de
-- qualidade (ADR-010) e um terceiro passo da mesma execucao e precisa de
-- lugar no log, entao a restricao e reescrita aqui em vez de na criacao,
-- para bancos que ja estao de pe.
alter table bronze.etl_execucao
    drop constraint if exists etl_execucao_etapa_check;
alter table bronze.etl_execucao
    add constraint etl_execucao_etapa_check
    check (etapa in ('silver', 'gold', 'qualidade'));

alter table bronze.etl_execucao
    add column if not exists disparo text not null default 'manual'
    check (disparo in ('manual', 'agendado'));

comment on column bronze.etl_execucao.disparo is
    'Quem chamou o ETL: a pessoa ou o agendador (ADR-009).';


-- ---------------------------------------------------------------------------
-- Controle de ingestao por lote
--
-- Arquitetura de referencia, caixa "INGESTAO -> Tabela de controle
-- (lote · watermark · contagens)". O projeto nao faz extracao de fonte
-- externa: a fonte empurra os eventos em lote (ADR-007). O que o lote precisa
-- registrar, entao, nao e watermark de leitura, e sim o que cada POST trouxe e
-- o que foi aproveitado - que e o numero com que se reconcilia a bronze
-- depois.
--
-- Quem escreve nesta tabela e o endpoint de ingestao, ou seja, o BACK-END.
-- O BI so le. Enquanto o endpoint nao existe, o gerador sintetico escreve um
-- lote por execucao para o caminho ficar exercitado.
-- ---------------------------------------------------------------------------
create table if not exists bronze.ingestao_lote (
    lote_id         bigserial primary key,
    recebido_em     timestamptz not null default now(),
    jogador_id      integer references app.jogador (jogador_id),
    origem          text not null default 'jogo'
                    check (origem in ('jogo', 'sintetico')),

    -- contagens: o que o lote trouxe e o que aconteceu com cada evento.
    -- gravados + ignorados + rejeitados deve fechar com recebidos.
    eventos_recebidos   integer not null default 0,
    eventos_gravados    integer not null default 0,
    eventos_ignorados   integer not null default 0,   -- duplicados (RN-015)
    eventos_rejeitados  integer not null default 0,   -- envelope invalido

    detalhe         jsonb
);

comment on table bronze.ingestao_lote is
    'Um lote de ingestao por linha (ADR-007). Escrita pelo back-end; o BI so le.';

-- O evento aponta para o lote que o trouxe. Nulo nos eventos gravados antes
-- desta tabela existir e em qualquer ingestao que nao informe o lote: a coluna
-- e rastreabilidade, nao obrigacao, para nao quebrar o contrato ja combinado
-- com o back-end.
alter table bronze.eventos
    add column if not exists lote_id bigint references bronze.ingestao_lote (lote_id);

create index if not exists ix_eventos_lote on bronze.eventos (lote_id);


-- ---------------------------------------------------------------------------
-- Resultado do gate de qualidade (ADR-010)
--
-- Arquitetura de referencia, losango "so dado aprovado pela qualidade chega a
-- Gold" e caixa "Qualidade de dados (regras · quarentena · reconciliacao)".
--
-- A quarentena ja existia: silver.evento_rejeitado. O que faltava era o
-- registro de QUE regra rodou, QUANDO e com que resultado - sem isso nao da
-- para dizer que a gold e "certificada".
-- ---------------------------------------------------------------------------
-- Aqui now() e de proposito, ao contrario da tabela acima: todas as regras de
-- uma mesma execucao precisam compartilhar o horario para serem lidas como um
-- boletim so. Quem identifica a execucao, porem, e o execucao_id - e por ele
-- que as consultas agrupam.
create table if not exists bronze.etl_qualidade (
    id              bigserial primary key,
    execucao_id     bigint references bronze.etl_execucao (execucao_id),
    verificada_em   timestamptz not null default now(),
    porta           text not null check (porta in ('silver', 'gold')),
    regra           text not null,
    descricao       text not null,
    divergencias    integer not null,
    aprovada        boolean not null
);

comment on table bronze.etl_qualidade is
    'Uma linha por regra de qualidade por execucao. Reprovou, a gold nao e publicada (ADR-010).';

create index if not exists ix_qualidade_execucao on bronze.etl_qualidade (execucao_id);
