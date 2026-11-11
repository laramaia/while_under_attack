-- ---------------------------------------------------------------------------
-- Camada SILVER - sessoes e tentativas reconstruidas, tipadas e validadas
-- (ADR-003). Tudo aqui e derivado da bronze e pode ser jogado fora e
-- reconstruido a qualquer momento.
--
-- Regras implementadas aqui:
--   RN-007  uma tentativa tem um unico resultado
--   RN-008  derrota com programa concluido = programa curto demais
--   RN-018  so pilha que comeca com bloco de evento executa
--   ADR-005 a tentativa e a unidade de analise; o programa vem em snapshot
-- ---------------------------------------------------------------------------

create schema if not exists silver;

drop table if exists silver.programa_bloco   cascade;
drop table if exists silver.tentativa        cascade;
drop table if exists silver.sessao           cascade;
drop table if exists silver.evento_rejeitado cascade;


create table silver.sessao (
    session_id                uuid primary key,
    jogador_id                integer not null,
    iniciada_em               timestamptz not null,
    encerrada_em              timestamptz,
    motivo_encerramento       text check (motivo_encerramento in
                                  ('logout', 'app_em_segundo_plano', 'inatividade')),
    duracao_min               numeric,
    qtd_eventos               integer not null,
    qtd_tentativas            integer not null default 0,
    catalog_version           text not null,
    game_version              text not null,
    origem                    text not null
);

comment on column silver.sessao.motivo_encerramento is
    'inatividade = o EV-02 nunca chegou e a silver fechou a sessao por tempo '
    '(30 min sem eventos, Contrato de Eventos secao 3).';


create table silver.tentativa (
    tentativa_id              uuid primary key,
    session_id                uuid not null references silver.sessao (session_id),
    jogador_id                integer not null,
    fase_id                   text not null,
    catalog_version           text not null,

    -- calculado aqui, nunca enviado pelo jogo (Contrato de Eventos, EV-04)
    numero_tentativa          integer not null,

    iniciada_em               timestamptz not null,
    finalizada_em             timestamptz,
    resultado                 text check (resultado in ('vitoria', 'derrota', 'interrompida')),

    tempo_edicao_ms           integer,
    duracao_execucao_ms       integer,
    vida_guerreiro_final      integer,
    vida_inimigo_final        integer,
    programa_concluido        boolean,
    bloco_em_execucao_id      text,

    -- derivado do programa (ADR-005)
    programa                  jsonb not null,
    qtd_blocos                integer not null,
    qtd_pilhas                integer not null,
    qtd_pilhas_executaveis    integer not null,
    profundidade_max          integer not null,

    -- RN-008: separa as duas causas de derrota usando programa_concluido
    -- e bloco_em_execucao_id (Contrato de Eventos, EV-05)
    causa_derrota             text check (causa_derrota in
                                  ('programa_curto', 'parou_em_bloco')),

    origem                    text not null,

    -- RN-007: tentativa sem EV-05 fica com resultado nulo (sessao caiu antes
    -- de enviar). Nao e erro, e dado incompleto, e o gold ignora.
    constraint tentativa_finalizada_coerente
        check ((resultado is null) = (finalizada_em is null))
);

comment on column silver.tentativa.numero_tentativa is
    'Ordem da tentativa do jogador naquela fase, contando todas (1, 2, 3...).';
comment on column silver.tentativa.qtd_blocos is
    'Todas as instancias, inclusive aninhadas e o bloco de evento (RN-014).';

create index ix_tentativa_jogador_fase on silver.tentativa (jogador_id, fase_id, numero_tentativa);
create index ix_tentativa_resultado    on silver.tentativa (resultado);


-- O programa explodido: uma linha por instancia de bloco. E daqui que saem a
-- contagem de blocos (RN-014) e qualquer analise de "quais blocos o jogador usa".
create table silver.programa_bloco (
    tentativa_id              uuid not null references silver.tentativa (tentativa_id) on delete cascade,
    bloco_id                  text not null,
    pilha_indice              integer not null,
    bloco_pai_id              text,
    posicao                   integer not null,
    profundidade              integer not null,
    tipo                      text not null,
    categoria                 text,
    condicao_tipo             text,
    params                    jsonb,

    -- RN-018: pilha que nao comeca com bloco de evento continua registrada,
    -- mas nao executa.
    pilha_executavel          boolean not null,

    primary key (tentativa_id, bloco_id)
);

create index ix_programa_bloco_tipo on silver.programa_bloco (tipo);


-- Evento que a silver nao conseguiu aproveitar. Nao se apaga nada da bronze
-- (RN-016): o problema fica registrado aqui para ser investigado.
create table silver.evento_rejeitado (
    event_id        uuid primary key,
    event_type      text not null,
    motivo          text not null,
    detalhe         jsonb,
    rejeitado_em    timestamptz not null default now()
);
