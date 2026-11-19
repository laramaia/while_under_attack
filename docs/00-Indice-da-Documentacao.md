# while under_attack: attack()
## Índice da Documentação

**Status geral:** Rascunho · **Última atualização:** 16/11/2026

Este conjunto de documentos é a referência oficial do projeto. Quando código e
documentação divergirem, a divergência é um bug: corrija um dos dois e registre
a decisão.

> **Estes documentos passaram a viver no repositório, em Markdown, em
> 16/11/2026.** Antes eram `.docx` avulsos, com a última revisão de 13/10/2026 —
> o que fazia o texto envelhecer sem que ninguém percebesse. Aqui eles mudam no
> mesmo commit que muda o código, e o histórico fica no Git.
>
> Os `.docx` originais continuam valendo como registro do que foi entregue em
> 13/10, mas **a versão viva é esta**.

---

## Mapa dos documentos

| Documento | Arquivo | Status |
|---|---|---|
| Índice da documentação | `00-Indice-da-Documentacao.md` | Rascunho |
| Documento de Visão | `01-Documento-de-Visao.md` | Rascunho |
| Glossário do domínio | `02-Glossario-do-Dominio.md` | Rascunho |
| Catálogo de regras de negócio | `03-Regras-de-Negocio.md` | Rascunho |
| Decisões de arquitetura (ADRs) | `04-Registro-de-Decisoes-ADR.md` | Ver status em cada ADR |
| Contrato de eventos do jogo | `05-Contrato-de-Eventos.md` | **Em revisão** |
| Catálogo de fases | `06-Catalogo-de-Fases.md` | Rascunho |
| Pendências e riscos | `07-Pendencias-e-Riscos.md` | **Ativo** |
| **API e integração** | **`08-API-e-Integracao.md`** | **Ativo** |

O documento **08** é novo e nasceu de uma lacuna concreta: o Contrato de
Eventos diz *o que* o jogo envia, mas não dizia *para onde*. Ele lista as rotas
reais dos dois serviços, o caminho completo de um evento e o que cada parte
valida.

### Documentos técnicos da fatia de BI

Vivem junto do código que descrevem, em `bi/`:

| Documento | O que tem |
|---|---|
| [`bi/README.md`](../bi/README.md) | como rodar, as três camadas, o gate de qualidade, a API, o dashboard e a relação entre o catálogo e o jogo |
| [`bi/docs/arquitetura-de-referencia.md`](../bi/docs/arquitetura-de-referencia.md) | conformidade com a Arquitetura Corporativa de Dados — UNIVAG, caixa por caixa, mais governança (LGPD, linhagem, continuidade) |

---

## ADRs

| ID | Decisão | Status |
|---|---|---|
| ADR-001 | Dashboard web próprio em vez de Power BI | Aceito |
| ADR-002 | Back-end em Python (FastAPI), em dois serviços sobre o mesmo banco | **Aceito** |
| ADR-003 | Arquitetura Medallion em schemas do PostgreSQL | Proposto |
| ADR-004 | Autenticação por usuário e senha com contas pré-criadas | Aceito |
| ADR-005 | Tentativa como unidade de análise, com snapshot do programa | Proposto |
| ADR-006 | Catálogo de fases em JSON versionado como fonte única | Proposto |
| ADR-007 | Envio de eventos em lote, com fila local e idempotência | Proposto |
| **ADR-008** | **Conformidade com a arquitetura corporativa por capacidade, não por produto** | **Proposto** |
| **ADR-009** | **Gatilho do ETL: agendado a cada 15 minutos, mais execução manual** | **Proposto** |
| **ADR-010** | **Gate de qualidade entre as camadas, dentro da transação do ETL** | **Proposto** |

---

## Próximos documentos

O que ainda não existe, e o que saiu desta lista desde 13/10:

| Documento | Situação |
|---|---|
| Especificação de Requisitos (RF/RNF) e casos de uso | não existe |
| Documento de Arquitetura com diagramas de contexto, componentes e implantação | **parcialmente coberto** por `bi/docs/arquitetura-de-referencia.md`, que mapeia o projeto contra a arquitetura corporativa. Faltam os diagramas |
| Contrato da API (OpenAPI) | **existe, gerado**: cada serviço publica o seu em `/docs` e `/openapi.json` — o back-end na porta 8001, o BI na 8000. As rotas dos dois estão escritas também em `08-API-e-Integracao.md`, que é o que se lê sem subir nada |
| Modelo de dados das camadas bronze, silver e gold (DDL) | **existe**: `bi/db/01_bronze.sql`, `02_silver.sql`, `03_gold.sql`, comentados regra por regra |
| Plano de testes e matriz de rastreabilidade | **parcialmente coberto**: as 11 regras do gate de qualidade (`bi/src/wua_bi/etl/qualidade.py`) citam a RN que cada uma verifica. Falta o plano formal |
| Convenções de identificadores | abaixo |

---

## Convenções de identificadores

| Prefixo | Uso | Exemplo |
|---|---|---|
| RF / RNF | Requisito funcional / não funcional | RF-001 |
| RN | Regra de negócio | RN-012 |
| ADR | Decisão de arquitetura | ADR-005 |
| EV | Tipo de evento do jogo | EV-04 |
| PD | Pendência de decisão | PD-013 |
| RS | Risco | RS-04 |
| O | Objetivo do projeto | O3 |
| F | Fase do jogo | F01 |

As regras de qualidade do ETL reaproveitam o identificador da regra que
verificam (`RN-014`), e as que não saem de nenhuma regra têm prefixo próprio:
`CAT-` para catálogo e `REC-` para reconciliação.

---

## Histórico

| Data | Mudança |
|---|---|
| 13/10/2026 | Versão inicial dos oito documentos, em `.docx` |
| 16/11/2026 | Convertidos para Markdown e movidos para `docs/` no repositório. Acrescentadas ADR-008, ADR-009 e ADR-010; atualizado o estado dos "próximos documentos"; registrados os documentos técnicos da fatia de BI |
| 16/11/2026 | **O back-end passou a existir.** Novo documento **08 — API e Integração**, com as rotas dos dois serviços. ADR-002 passa a **Aceito** (PD-011 resolvida: FastAPI, em dois serviços). ADR-004 atualizada com o que foi implementado de verdade: bcrypt custo 12 e JWT HS256 |
