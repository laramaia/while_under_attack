# while under_attack: attack()

Jogo educativo de **programação em blocos** com tema de combate medieval, e a
fatia de **Inteligência de Negócios** que transforma o que o jogador faz no jogo
em indicadores de aprendizagem.

Projeto Extensionista Integrador (PEI) — **Grupo 4**.

---

## A ideia

O jogador monta um programa arrastando blocos da Palette para o Workspace e
aperta Play. O guerreiro executa o programa e luta. Vence quando a vida do
inimigo chega a zero; perde quando a do guerreiro chega — inclusive quando o
programa acaba cedo demais e o inimigo continua atacando. Ele tenta quantas
vezes quiser.

Cada fase ensina um conceito de lógica, em complexidade crescente.

**O detalhe que define o projeto:** vencer uma fase não prova que o jogador
aprendeu o conceito. Dá para vencer a fase de repetição empilhando o mesmo
ataque três vezes, sem nunca usar o bloco "Repetir". O jogador passa, mas o
conceito ficou para trás.

A fatia de BI existe para **distinguir esses dois casos**.

---

## As duas metades

| | O que é | Onde | Porta |
|---|---|---|---|
| **Jogo** | Phaser 4 + TypeScript, para celular. Palette, Workspace, arrastar e soltar, execução | [`src/`](src/), [`public/`](public/) | 5173 |
| **Back-end** | FastAPI. Autentica com bcrypt e JWT, e recebe os eventos do jogo na camada bronze | [`backend/`](backend/) | 8001 |
| **Inteligência de Negócios** | Arquitetura Medallion, ETL, modelo dimensional, API de leitura e dois dashboards | [`bi/`](bi/) | 8000 |

A fronteira entre o back-end e o BI é **o banco, não uma biblioteca**: não há
nenhum import de um no outro. O back-end escreve em `bronze.eventos`, o BI só
lê. Foi assim que o BI pôde ficar pronto antes de o back-end existir.

A única conversa direta entre os dois é o login: o BI **delega** ao back-end em
vez de duplicar a conferência de senha. Para onde vai cada chamada está em
[API e Integração](docs/08-API-e-Integracao.md).

---

## Estrutura

```
docs/                  os nove documentos oficiais do projeto
catalogo-fases.json    fases, conceitos e blocos — fonte única (ADR-006)

src/                   o jogo (Phaser + TypeScript)
  model/               catálogo de blocos, templates, grupos
  editor/              Palette, Workspace, instâncias de bloco
  scenes/              Boot, Start, Menu, Battle
public/                imagens e assets

backend/               autenticação e ingestão de eventos
  src/wua_backend/
    auth.py            bcrypt + JWT, dependência Bearer
    seed.py            criação das contas, sem autocadastro
    ingestao.py        POST /api/eventos → bronze, com controle de lote

bi/                    a fatia de Inteligência de Negócios
  db/                  DDL das três camadas: bronze, silver, gold
  src/wua_bi/
    etl/               bronze → silver → gold, gate de qualidade, agendador
    api/               API de leitura + permissões por perfil
    gerador.py         eventos sintéticos, enquanto o jogo não envia
  dashboard/           telas do Jogador e do Professor
  docs/                conformidade com a arquitetura corporativa
```

---

## Rodando

### O jogo

```bash
npm install
```

```bash
npm run dev
```

### A fatia de BI

Precisa de Python 3.11+ e de um Postgres (local, em Docker ou na nuvem).

```bash
cd bi && cp .env.example .env && docker compose up -d
```

```bash
python -m venv .venv && .venv/bin/pip install -e .
```

```bash
.venv/bin/python -m wua_bi.etl criar && .venv/bin/python -m wua_bi.etl rodar
```

```bash
.venv/bin/python -m uvicorn wua_bi.api.main:app --reload --port 8000
```

Dashboard em <http://localhost:8000/dashboard/>, documentação da API em
<http://localhost:8000/docs>.

### O back-end

Cria as tabelas? **Não** — elas vêm do `bi/db/`, então rode o BI primeiro.

```bash
cd backend && cp .env.example .env && cp contas.example.json contas.json
```

```bash
python -m venv .venv && .venv/bin/pip install -e .
```

```bash
.venv/bin/python -m wua_backend.seed
```

```bash
.venv/bin/python -m uvicorn wua_backend.main:app --reload --port 8001
```

> **O `WUA_SEGREDO` tem de ser a mesma string em `bi/.env` e em
> `backend/.env`.** Um assina o token, o outro valida a assinatura. Se os dois
> diferirem, o login responde `200` e todas as chamadas seguintes respondem
> `401` — a falha aparece longe da causa.

Contas de teste no banco do projeto: usuário e senha iguais — `teste` e
`professor`. **O dashboard não autentica sem o back-end no ar**, porque delega
o login a ele.

O [`bi/README.md`](bi/README.md) explica as camadas, o gate de qualidade, o
agendamento e as decisões do dashboard. As rotas dos dois serviços estão em
[API e Integração](docs/08-API-e-Integracao.md).

---

## Documentação

Os documentos oficiais estão em [`docs/`](docs/) e são **a referência do
projeto**. Quando código e documentação divergirem, a divergência é um bug:
corrija um dos dois e registre a decisão.

| Documento | Para quê |
|---|---|
| [Índice](docs/00-Indice-da-Documentacao.md) | o mapa dos documentos e as convenções de identificadores |
| [Documento de Visão](docs/01-Documento-de-Visao.md) | problema, objetivos, atores, escopo do MVP |
| [Glossário](docs/02-Glossario-do-Dominio.md) | **o único lugar onde os termos são definidos** |
| [Regras de Negócio](docs/03-Regras-de-Negocio.md) | RN-001 a RN-020, com o status de cada uma |
| [ADRs](docs/04-Registro-de-Decisoes-ADR.md) | ADR-001 a ADR-010: contexto, alternativas, decisão e consequências |
| [Contrato de Eventos](docs/05-Contrato-de-Eventos.md) | o que o jogo envia, campo a campo |
| [Catálogo de Fases](docs/06-Catalogo-de-Fases.md) | formato do `catalogo-fases.json`, blocos e progressão |
| [Pendências e Riscos](docs/07-Pendencias-e-Riscos.md) | o que ainda não foi decidido, e o que pode dar errado |
| [API e Integração](docs/08-API-e-Integracao.md) | **as rotas dos dois serviços** e o caminho completo de um evento |

Dois documentos técnicos acompanham o código do BI:
[arquitetura de referência](bi/docs/arquitetura-de-referencia.md) (conformidade
com a Arquitetura Corporativa de Dados — UNIVAG) e o próprio
[`bi/README.md`](bi/README.md).

**Os identificadores aparecem em comentários no código inteiro.** Quando ler
`RN-014` ou `ADR-005` num arquivo `.py` ou `.sql`, a regra está nos documentos
acima — é o que torna as decisões defensáveis na banca.

---

## Estado

| Parte | Situação |
|---|---|
| Jogo: Palette, Workspace, arrastar e soltar | pronto |
| Jogo: encaixe dos blocos (`nextBlock`, `inner`) | pronto |
| Jogo: execução do programa | **parcial** — percorre as pilhas e repete 3x; só o `on-flag` dispara (PD-021) e o `if-else` não executa o corpo |
| Jogo: vida, vitória e derrota | **pronto** — `HERO_MAX_HP`, `ENEMY_MAX_HP`, e o EV-05 já sai com resultado |
| Jogo: módulo de telemetria | **pronto** — fila local, lote, 207, `corpo` e reuso do `tentativa_id` |
| Jogo: enviar de verdade | **falta ligar o login** — `telemetry.iniciarSessao()` não é chamado em lugar nenhum, então nada sai da fila ([#7](https://github.com/laramaia/while_under_attack/issues/7)) |
| Jogo: fases | em construção. O `fase_id` já sai do catálogo, mas é constante global — uma fase só (PD-018) |
| Jogo: tempo limite da fase | **falta no jogo** (RN-021, [#8](https://github.com/laramaia/while_under_attack/issues/8)). O campo `disparo` já está pronto e testado nas três camadas |
| Jogo: RN-008, derrota quando o programa acaba curto | **falta** — sem ela a tentativa não gera EV-05 e some do dashboard ([#9](https://github.com/laramaia/while_under_attack/issues/9)) |
| Back-end: autenticação com bcrypt e JWT | **pronto e testado** |
| Back-end: ingestão de eventos na bronze | **pronto e testado** |
| BI: ETL, modelo dimensional, API, dashboards | pronto e rodando |

**O caminho inteiro já foi percorrido de ponta a ponta** em 16/11/2026, com
eventos montados à mão no formato do contrato: login → `POST /api/eventos` →
bronze → ETL → silver → gate de qualidade → gold → dashboard, com as 10 regras
de qualidade aprovadas.

Em 17/11/2026 o jogo ganhou o módulo de telemetria, que monta o envelope, mantém
fila local e envia em lote para a porta 8001. **Falta um fio:** ninguém chama
`telemetry.iniciarSessao(token)`, e sem sessão o módulo não registra nem envia
nada. Esse fio é o login do jogo ([#7](https://github.com/laramaia/while_under_attack/issues/7)).

### O que falta, com o detalhe de como fazer

Cada lacuna tem uma issue que diz o que mandar, em que formato, o que já está
pronto do outro lado e como conferir que funcionou. **Quem for implementar deve
ler a issue antes:** várias dessas coisas já foram decididas e testadas, e
refazê-las de outro jeito quebra o que hoje passa no gate de qualidade.

| O que falta | Issue |
|---|---|
| Tela de login e `iniciarSessao` — **destrava as outras duas** | [#7](https://github.com/laramaia/while_under_attack/issues/7) |
| Tempo limite da fase e campo `disparo` (RN-021) | [#8](https://github.com/laramaia/while_under_attack/issues/8) |
| EV-05 quando o programa acaba com o inimigo vivo (RN-008) | [#9](https://github.com/laramaia/while_under_attack/issues/9) |
| Trocar as senhas de teste antes do deploy | [#10](https://github.com/laramaia/while_under_attack/issues/10) |
| `on-start` na Palette sem executar (PD-021) | [#4](https://github.com/laramaia/while_under_attack/issues/4) |
| Bloco de repetição com condição (PD-017) | [#2](https://github.com/laramaia/while_under_attack/issues/2) |

Enquanto o jogo não envia eventos, o dashboard roda com **dados sintéticos**,
gerados conforme o Contrato de Eventos e marcados com `origem = 'sintetico'`.
A tela mostra uma faixa amarela avisando disso.

As pendências que mais seguram o projeto estão em
[Pendências e Riscos](docs/07-Pendencias-e-Riscos.md); as de impacto alto hoje
são a **PD-006** (as fases oficiais), a **PD-003** (prazo e marcos), a
**PD-017** (se vai existir o bloco de repetição com condição), a **PD-022** (o
tempo limite é global ou por fase?) e a **PD-023** (dá para jogar sem login?).

---

## A equipe

| Pessoa | Responsabilidade |
|---|---|
| Heloisa | Inteligência de Negócios: ETL, modelo dimensional, API de leitura e dashboards |
| Lara | Back-end |
| Mateo | Palette do jogo; back-end de autenticação e ingestão |

A composição completa e quem responde por hospedagem, testes e documentação
continua em aberto (**PD-002**).
