# BI do while under_attack

A fatia de Inteligência de Negócios do projeto: as três camadas da arquitetura
Medallion, o ETL que as alimenta, o modelo dimensional e o dashboard com os
perfis Jogador e Professor.

Cumpre o objetivo **O5** do Documento de Visão: requisitos → Medallion → ETL →
modelo dimensional → dashboard, construído sobre uma fonte de dados própria.

---

## O que é de quem

| Parte | Dono | Situação |
|---|---|---|
| Jogo em Phaser, envio dos eventos | jogo | em andamento, fora desta pasta |
| Autenticação e ingestão dos eventos na bronze | back-end | ainda não existe |
| **ETL bronze → silver → gold** | **BI** | **aqui** |
| **Modelo dimensional (gold)** | **BI** | **aqui** |
| **Endpoints de leitura do dashboard** | **BI** | **aqui** |
| **Dashboard (Jogador e Professor)** | **BI** | **aqui** |

Enquanto o back-end não existe, esta pasta traz dois substitutos **claramente
marcados como provisórios**, para que o BI não fique parado (RS-01):

- `src/wua_bi/gerador.py` — gera eventos sintéticos conformes ao Contrato de
  Eventos e os grava na bronze com `origem = 'sintetico'`.
- `src/wua_bi/api/auth_provisoria.py` — login e token. **As permissões (RN-004 e
  RN-005) não são provisórias**: elas ficam na API, num lugar só, como decidido
  na ADR-001.

Quando o back-end chegar, os dois saem e nada mais muda: o ETL, a gold, as
consultas e o dashboard continuam iguais.

---

## Onde o banco fica

O código só precisa de uma coisa: uma string de conexão Postgres em
`WUA_DB_URL`. Onde esse Postgres mora é escolha de quem está rodando, e **nada
no projeto obriga a instalar Docker**.

### Opção A — Postgres gratuito na nuvem (recomendada)

Não instala nada na máquina, funciona em qualquer computador e já resolve
parte da PD-005. O [Neon](https://neon.com) tem plano gratuito permanente, sem
cartão, com o banco suspendendo sozinho quando ninguém usa — de sobra para os
~10 jogadores do MVP.

1. Crie um projeto no Neon e copie a string de conexão.
2. Cole no `.env`, mantendo o `sslmode=require` que ele já traz:

```
WUA_DB_URL=postgresql://usuario:senha@ep-algo.neon.tech/wua?sslmode=require
```

Depois disso é só `python -m wua_bi.etl tudo`. A primeira consulta depois de um
tempo parado demora alguns segundos, porque o banco estava suspenso.

### Opção B — Postgres local com Docker

Para quem quer tudo offline e já tem Docker: `docker compose up -d` sobe um
Postgres na porta 55432, que é o padrão do `.env.example`. Para desligar,
`docker compose down` (os dados ficam no volume; `down -v` apaga também).

### Opção C — Postgres instalado na máquina

Também funciona. Crie um banco e aponte a `WUA_DB_URL` para ele.

## Rodando

Precisa de Python 3.11+ e de um banco (acima).

```bash
cd bi
cp .env.example .env          # ajuste a WUA_DB_URL
python -m venv .venv && .venv/Scripts/pip install -e .
.venv/Scripts/python -m wua_bi.etl tudo
.venv/Scripts/python -m uvicorn wua_bi.api.main:app --reload
```

No Linux ou macOS, troque `.venv/Scripts/` por `.venv/bin/`.

O dashboard fica em <http://localhost:8000/dashboard/> e a documentação da API,
gerada pelo FastAPI, em <http://localhost:8000/docs>.

Contas de teste criadas pelo `semear`: usuário e senha iguais — `ana`, `bruno`,
`carla`, `diego`, `elisa`, `felipe`, `gabi`, `hugo`, `ines`, `joao` e
`professor`.

## Publicando de graça

Para a banca ou para os testes com jogadores reais, dá para pôr tudo no ar sem
pagar nada e sem cartão:

| Peça | Onde | Observação |
| --- | --- | --- |
| Banco | [Neon](https://neon.com), plano gratuito | permanente; suspende quando ocioso |
| API + dashboard | [Render](https://render.com), Web Service gratuito | hiberna após 15 min sem acesso |

O serviço gratuito do Render dorme quando ninguém acessa e leva de 30 a 60
segundos para acordar. **Antes da apresentação, abra o link uns minutos
antes** para o primeiro acesso não ser o da banca.

Comando de start no Render:

```
uvicorn wua_bi.api.main:app --host 0.0.0.0 --port $PORT
```

Com as variáveis `WUA_DB_URL` e `WUA_SEGREDO` configuradas no painel. O
`docker-compose.yml` não é usado nessa configuração.

Duas armadilhas conhecidas: o Postgres gratuito do próprio Render expira em 30
dias (por isso o banco fica no Neon), e o Railway e o Fly.io não têm mais plano
gratuito contínuo — só crédito de teste.

### Comandos do ETL

| Comando | O que faz |
|---|---|
| `python -m wua_bi.etl criar` | cria schemas e tabelas (seguro de repetir) |
| `python -m wua_bi.etl semear` | gera eventos sintéticos na bronze |
| `python -m wua_bi.etl rodar` | bronze → silver → gold |
| `python -m wua_bi.etl conferir` | confere os indicadores contra as regras de negócio |
| `python -m wua_bi.etl tudo` | os quatro, na ordem |

O gatilho do ETL ficou em aberto na ADR-003. Aqui ele é **manual**, de
propósito: é o mais simples de operar e o mais fácil de demonstrar. Cada
execução reconstrói a silver e a gold inteiras a partir da bronze — não há
estado incremental para dar errado, e rodar duas vezes dá o mesmo resultado.

---

## As camadas

### bronze (`db/01_bronze.sql`)

`bronze.eventos`: um evento por linha, envelope em colunas e `payload` em
`jsonb`. Só inserção.

- `unique (event_id)` — RN-015, o mesmo evento nunca é contado duas vezes.
- Gatilho que recusa `update` e `delete` — RN-016, a bronze é imutável. Corrigir
  dado errado se faz **reprocessando a silver**, nunca editando a bronze.
- `origem` separa dado real de sintético — RS-02.

O schema `app` guarda as contas. Não faz parte da Medallion: está aqui só para o
ETL montar a `dim_jogador` enquanto o back-end não existe.

### silver (`db/02_silver.sql`)

- `silver.sessao` — sessões reconstruídas. Fecha no EV-02 ou, se ele nunca
  chegou, depois de 30 min sem eventos (Contrato de Eventos, seção 3).
- `silver.tentativa` — junta o EV-04 com o EV-05 pelo `tentativa_id`. Calcula o
  número da tentativa, o tamanho do programa e a **causa da derrota** (RN-008):
  o programa acabou antes (`programa_curto`) ou a execução parou num bloco
  (`parou_em_bloco`).
- `silver.programa_bloco` — o programa explodido, **uma linha por instância de
  bloco**, com pai, profundidade e categoria. É daqui que sai a contagem de
  blocos da RN-014 e qualquer análise sobre quais blocos o jogador usa.
- `silver.evento_rejeitado` — evento que a silver não conseguiu aproveitar
  (EV-05 sem EV-04, fase fora do catálogo). Nada é apagado da bronze; o problema
  fica registrado para ser investigado.

### gold (`db/03_gold.sql`)

Modelo estrela com **duas tabelas de fato**, porque os indicadores têm dois
grãos diferentes:

- `gold.fato_tentativa` — uma linha por tentativa (ADR-005).
- `gold.fato_progresso_fase` — uma linha por **jogador × fase**, que é o grão
  real de "tentativas até vencer" (RN-012) e de "eficiência do código" (RN-014).

Dimensões: `dim_jogador`, `dim_fase`, `dim_conceito`, `dim_data` e
`dim_resultado`. A `dim_fase` tem a `catalog_version` na chave natural: mudar
uma fase depois de coletar dados cria uma linha nova em vez de reescrever a
antiga (ADR-006, RS-03).

**Os indicadores são calculados no ETL, em SQL, e gravados.** A API só faz
`SELECT` e o JavaScript só desenha. Se um número está errado, o lugar de
corrigir é a camada gold.

---

## Onde mora cada regra de negócio

| Regra | Onde está implementada |
|---|---|
| RN-004, RN-005 | `api/auth_provisoria.py` → `exigir_acesso_a`, `exigir_professor` |
| RN-007 | `silver.tentativa`, restrição `tentativa_finalizada_coerente` |
| RN-008 | `etl/silver.py` → `_causa_derrota` |
| RN-011 | `etl/gold.py` → `concluida` em `fato_progresso_fase` |
| RN-012 | `etl/gold.py` → `tentativas_ate_vencer` e `interrompidas_ate_vencer` |
| RN-013 | `etl/gold.py` → o filtro `ate_vencer` no `SQL_BASE` |
| RN-014 | `etl/gold.py` → `eficiencia_codigo`; contagem em `programa.py` |
| RN-015 | `db/01_bronze.sql` → `unique (event_id)` |
| RN-016 | `db/01_bronze.sql` → gatilho `trg_eventos_imutavel` |
| RN-018 | `programa.py` → `pilha_executavel` |

`python -m wua_bi.etl conferir` traduz oito dessas regras em consultas e falha
se alguma for violada. Serve de teste e de roteiro para a banca.

---

## O dashboard

HTML e JavaScript sem etapa de build, servidos pela própria API em `/dashboard`
(ADR-002). Gráficos com Chart.js via CDN.

**Jogador** (objetivo O3) — quantas tentativas até vencer cada fase comparadas
com a mediana da turma; se venceu **aplicando o conceito** que a fase ensina ou
contornando; o quanto o código é enxuto em relação à solução de referência;
**onde travou**, separando as duas causas de derrota e dizendo em qual tipo de
bloco a execução parou; e as mesmas coisas em tabela.

**Professor** (objetivo O4) — um painel de **destaques** com os pontos de
atenção lidos dos indicadores; o funil de fases, que responde literalmente "em
que fases eles param"; a atividade da turma por dia; a mediana de tentativas
por fase; a taxa de vitória por número da tentativa; quantos venceram aplicando
o conceito de cada fase; um heatmap jogador × fase; a lista de jogadores; e os
blocos em que a turma mais trava. O professor também pode abrir a tela de
qualquer jogador pela aba "Por jogador" (RN-005).

### Filtros

A barra de filtros (período e conceito) vale para a atividade e a taxa de
vitória, que são por tentativa. O funil, o heatmap e a tabela de jogadores
**ignoram os filtros de propósito**: "tentativas até vencer" e "eficiência" são
por definição medidas até a primeira vitória (RN-012, RN-014), então recortá-las
por período daria um número que não quer dizer nada.

### Introdução e reforço

**Nem toda fase ensina um conceito novo.** Algumas existem para reforçar o que a
fase anterior ensinou, quando o conteúdo é mais avançado. O ETL distingue as
duas coisas, e isso não exige campo novo no catálogo: **uma fase cujo
`conceito_id` já apareceu numa fase anterior é uma fase de reforço.** A coluna
`gold.dim_fase.papel` guarda isso.

A distinção muda o que se espera da fase. Um reforço deveria custar *menos* que
a fase que introduziu o conceito; quando custa mais, ou o reforço está difícil
demais, ou o conceito não pegou na introdução. Os destaques comparam as duas e
dizem qual dos casos é.

### Conceito aplicado

Indicador novo, que não estava nas regras de negócio. Cada conceito tem um bloco
que o representa — deduzido do catálogo, pela diferença entre a Palette da fase
que o introduziu e a da anterior. O ETL marca se o programa da primeira vitória
usou esse bloco (`gold.dim_fase.bloco_conceito`).

Serve para uma pergunta que a eficiência do código sozinha não responde: dá para
vencer a fase de repetição empilhando o mesmo ataque três vezes, e aí o jogador
passou sem ter aprendido o conceito. Nos dados sintéticos isso aparece em F04,
onde parte da turma venceu o "enquanto" desenrolando o laço na mão.

Numa fase de reforço o indicador usa o bloco da fase que introduziu o conceito —
que é justamente onde mais interessa saber se o conceito pegou. Conceito que não
se resume a um bloco, como "combinação" (usar um bloco dentro do outro), fica de
fora: não há bloco que o represente.

### Cores

As cores saem de uma paleta validada para daltonismo e contraste nos dois temas;
quem mexer nos gráficos deve usar os tokens de `estilo.css` em vez de escolher
tons novos. Nos destaques e no painel de conceitos a cor nunca é o único sinal:
vem sempre com ícone e com o rótulo escrito.

---

## Duas decisões que a equipe precisa tomar sobre o dashboard

**A mediana da turma na tela do jogador.** A tela do jogador mostra, ao lado do
número dele, a mediana da turma na mesma fase. Isso dá uma referência que o
número sozinho não dá — "precisei de 5, a turma precisou de 2" é mais útil que
"precisei de 5". Não é o dado de nenhum jogador em particular, então não contraria
a RN-004 na letra, mas **é uma informação sobre os outros que o jogador não tinha
antes**. Com ~10 jogadores a mediana também é mais frágil do que seria numa turma
grande. Se a equipe não quiser, basta remover a segunda série do gráfico
`graficoTentativas` e a coluna `mediana_turma` da consulta — nada mais depende disso.

**O indicador de conceito aplicado** não sai de nenhuma RN existente. Se a
equipe concordar com ele, vale virar uma regra numerada, porque hoje a
definição de "bloco que a fase introduz" mora só no código (`catalogo.py`).

## O que ainda depende da equipe

- **PD-006** — `catalogo-fases.json` (na raiz do repositório) está numa versão
  **provisória**, montada a partir da hipótese de progressão do Catálogo de
  Fases. As seis fases, os conceitos e as soluções de referência precisam ser
  confirmados. A `catalog_version` termina em `-rascunho` justamente para isso.
  A F05 está ali como exemplo de **fase de reforço**, para o indicador ter o que
  mostrar; o Catálogo de Fases ainda não descreve esse tipo de fase, e vale
  acrescentar essa ideia ao documento.
- **PD-013** — os identificadores técnicos dos blocos (`andar`, `atacar`,
  `enquanto`...) são propostas e precisam bater com os do código do jogo. Hoje
  o `defaultCatalog.ts` do jogo usa outros nomes (`advance`, `defend`,
  `if-else`), e as categorias também divergem do documento: são duas listas
  diferentes para a mesma coisa.
- **PD-011** — a escolha do framework não afeta esta pasta: o dashboard é
  cliente REST e funciona igual com FastAPI, Flask ou Django.
- **PD-005** — o `docker-compose.yml` é só para desenvolvimento. Onde o banco
  vai rodar de verdade continua em aberto.
- **PD-010** — o gerador assume que a fase seguinte só abre depois da anterior
  (RN-017). Se a equipe decidir o contrário, o funil do professor muda de
  significado.
