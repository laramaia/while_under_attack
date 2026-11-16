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

| | O que é | Onde |
|---|---|---|
| **Jogo** | Phaser 4 + TypeScript, para celular. Palette, Workspace, arrastar e soltar, execução | [`src/`](src/), [`public/`](public/) |
| **Inteligência de Negócios** | Arquitetura Medallion, ETL, modelo dimensional, API de leitura e dois dashboards | [`bi/`](bi/) |

O **back-end** (autenticação e ingestão dos eventos) ainda não existe. A
fronteira entre ele e o BI é **o banco, não uma biblioteca**: o back-end
escreve em `bronze.eventos`, o BI só lê. Foi assim que o BI pôde ficar pronto
antes.

---

## Estrutura

```
docs/                  os oito documentos oficiais do projeto
catalogo-fases.json    fases, conceitos e blocos — fonte única (ADR-006)

src/                   o jogo (Phaser + TypeScript)
  model/               catálogo de blocos, templates, grupos
  editor/              Palette, Workspace, instâncias de bloco
  scenes/              Boot, Start, Menu, Battle
public/                imagens e assets

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
.venv/bin/python -m wua_bi.etl tudo
```

```bash
.venv/bin/python -m uvicorn wua_bi.api.main:app --reload
```

Dashboard em <http://localhost:8000/dashboard/>, documentação da API em
<http://localhost:8000/docs>. Contas de teste criadas pelo seed: usuário e
senha iguais — `professor`, `ana`, `bruno`, `carla`, `diego`, `elisa`,
`felipe`, `gabi`, `hugo`, `ines`, `joao`.

O [`bi/README.md`](bi/README.md) explica as camadas, o gate de qualidade, o
agendamento e as decisões do dashboard.

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
| Jogo: Palette, Workspace, arrastar e soltar | em andamento |
| Jogo: fases | **não existe o conceito** — há uma `BattleScene`, não uma progressão (PD-018) |
| Jogo: envio de eventos | **não começou** |
| Back-end: autenticação e ingestão | **não existe** |
| BI: ETL, modelo dimensional, API, dashboards | pronto e rodando |

Enquanto o jogo não envia eventos, o dashboard roda com **dados sintéticos**,
gerados conforme o Contrato de Eventos e marcados com `origem = 'sintetico'`.
A tela mostra uma faixa amarela avisando disso.

As pendências que mais seguram o projeto estão em
[Pendências e Riscos](docs/07-Pendencias-e-Riscos.md); as de impacto alto hoje
são a **PD-018** (o jogo não tem fases, e `fase_id` está em quase todo
indicador), a **PD-006** (as fases oficiais), a **PD-003** (prazo e marcos) e
a **PD-017** (se vai existir o bloco de repetição com condição).

---

## A equipe

| Pessoa | Responsabilidade |
|---|---|
| Heloisa | Inteligência de Negócios: ETL, modelo dimensional, API de leitura e dashboards |
| Lara | Back-end |
| Mateo | Palette do jogo |

A composição completa e quem responde por hospedagem, testes e documentação
continua em aberto (**PD-002**).
