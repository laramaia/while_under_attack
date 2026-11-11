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
create table if not exists bronze.etl_execucao (
    execucao_id     bigserial primary key,
    etapa           text not null check (etapa in ('silver', 'gold')),
    iniciada_em     timestamptz not null default now(),
    terminada_em    timestamptz,
    linhas_lidas    integer,
    linhas_gravadas integer,
    erro            text
);
