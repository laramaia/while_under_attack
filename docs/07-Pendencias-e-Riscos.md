# while under_attack: attack()
## Pendências e Riscos

**Status:** Ativo · **Última atualização:** 16/11/2026

Documento vivo. Uma pendência resolvida vira decisão (RN ou ADR) e recebe o
status Resolvida, com o link.

---

## Pendências de decisão

### Abertas

| ID | Pendência | Afeta | Impacto |
|---|---|---|---|
| PD-002 | Composição atual da equipe e responsáveis (ETL, hospedagem, testes, documentação) | Plano | **Alto** |
| PD-003 | Prazo final e marcos (banca, Feira dos PEIs) | Plano | **Alto** |
| PD-004 | Forma de distribuição do jogo: navegador, PWA ou APK | ADR-007, login | Médio |
| PD-005 | Onde hospedar **a API**; existe orçamento? *(o banco já foi resolvido — ver abaixo)* | Implantação | **Alto** |
| PD-006 | Lista oficial de conceitos, fases e soluções de referência | Catálogo, RN-014 | **Alto** |
| PD-008 | Editar o programa durante a pausa encerra a tentativa? | RN-009, EV-05 | Médio |
| PD-009 | Com várias pilhas executáveis, todas executam? Em paralelo ou em sequência? Pilhas sem bloco de evento são ignoradas, como propõe a RN-018? | Contrato de eventos, RN-018 | Médio |
| PD-010 | Fases são liberadas em ordem ou ficam todas abertas? | RN-017 | Médio |
| PD-011 | Lara confirma FastAPI ou prefere Flask ou Django? | ADR-002 | Médio |
| PD-012 | Se algum testador for menor de idade: termo de consentimento dos responsáveis | LGPD | **Alto se houver** |
| **PD-014** | **`corpo` × `inner`: o Contrato de Eventos usa `corpo` para o conteúdo dos blocos em C, o jogo guarda em `inner`.** O jogo traduz na hora de enviar, ou mudamos o contrato? | Contrato de eventos | Médio |
| **PD-015** | **Base legal e tempo de retenção dos eventos.** Por quanto tempo os dados ficam guardados e com que fundamento são coletados | LGPD | **Alto** |
| **PD-016** | **A exigência da arquitetura corporativa é dos produtos (Airflow, Spark, Delta Lake) ou das capacidades?** | ADR-008 | **Alto** |
| **PD-017** | **Existirá bloco de repetição com condição (o "enquanto")?** | Catálogo, PD-006 | **Alto** |
| **PD-018** | **O jogo não tem conceito de fase.** Como ele vai saber em que fase está, para mandar `fase_id`? | Contrato de eventos, **todos os indicadores** | **Alto — bloqueia a coleta** |

### Resolvidas

| ID | Pendência | Resolução |
|---|---|---|
| PD-001 | Confirmar com o professor da disciplina que dashboard sem Power BI e sem DAX atende à avaliação | **Resolvida em 13/10/2026:** Power BI não é obrigatório; Python ou outra ferramenta são aceitos (ADR-001) |
| PD-007 | Lista oficial de categorias de bloco | **Resolvida em 13/10/2026:** Evento, Ação, Condicional e Repetição |
| PD-013 | Quais condições existem para os blocos condicionais, se haverá "senão", e quais os identificadores técnicos dos blocos e parâmetros no código | **Parcialmente resolvida em 16/11/2026:** os identificadores e as categorias do `catalogo-fases.json` passaram a ser os do jogo. Ver abaixo o que falta |

---

## Detalhe das pendências novas e das que mudaram

### PD-013 — o que foi resolvido e o que falta

**Resolvido.** O `catalogo-fases.json` (versão `2026.11.1-rascunho`) usa os
identificadores e as categorias de `src/model/defaultCatalog.ts`. Antes usava
nomes propostos (`ao_clicar_em_play`, `andar`, `atacar`, `se`, `repetir`,
`enquanto`) que nunca existiram no código.

**Falta:**

- A **lista de condições** continua vazia: o `BlockTemplate` do jogo não tem
  campo de condição.
- O **ramo "senão"**: o rótulo diz "Se / Senão", mas o `BlockInstance` tem um
  único `inner`.
- **Parâmetros**: o `repeat` é "Repetir 3x" fixo. Vai ganhar quantidade
  editável?
- **As duas listas continuam separadas.** Ver Catálogo de Fases, seção 5: ou o
  jogo passa a ler o JSON, ou o JSON passa a ser gerado do código.

### PD-005 — o banco já está resolvido; falta a API

**Resolvido em 16/11/2026:** a Lara criou o banco do projeto no
[Neon](https://neon.com), plano gratuito, e o BI está conectado nele. As três
camadas da Medallion (`bronze`, `silver`, `gold`) e o schema operacional `app`
foram aplicados lá, com as garantias conferidas no próprio banco: gatilho de
imutabilidade da bronze (RN-016), `unique (event_id)` (RN-015), o `check` dos
cinco tipos de evento e as chaves estrangeiras.

**Continua aberto:** onde a API vai rodar. A recomendação registrada é o
[Render](https://render.com), Web Service gratuito, com duas ressalvas já
conhecidas: ele hiberna após 15 minutos sem acesso (abrir o link alguns minutos
antes da apresentação) e, hibernando, **não serve para hospedar o agendador do
ETL** — nesse cenário o gatilho da ADR-009 precisa ser um Scheduled Job ou um
cron externo.

**Duas coisas de segurança que vieram junto:**

1. A string de conexão é um **segredo** e não entra no repositório. Ela fica no
   `bi/.env`, que o `.gitignore` cobre. Quem for rodar o projeto pede a
   conexão à equipe.
2. O usuário em uso é o `neondb_owner`, que é o **dono** do banco. Para o MVP
   serve, mas o ideal é o BI ter um usuário só de leitura nas camadas que ele
   lê e escrita só em `silver` e `gold` — a bronze ele nunca precisa alterar
   (RN-016).

### PD-014 — `corpo` × `inner`

**Precisa ser decidido antes de o jogo começar a enviar eventos.** Depois de
começar, mudar o formato do programa é mudança incompatível de contrato e exige
incrementar o `schema_version`.

### PD-015 — base legal e retenção

Hoje ninguém escreveu por quanto tempo os eventos ficam guardados nem com que
fundamento são coletados. A coleta já é mínima por decisão (ADR-004) e o nome
exibido nunca é o nome completo (RN-003), mas **isso não substitui a base
legal**. Anda junto com a PD-012.

### PD-016 — produtos ou capacidades?

A ADR-008 decidiu atender à Arquitetura Corporativa de Dados **por capacidade**,
justificando produto a produto onde o projeto escolheu outro caminho. Se a
exigência for dos produtos, a ADR-008 precisa ser substituída e **o escopo do
semestre muda bastante**.

É a pergunta que deveria ser feita ao professor da disciplina **antes** de
qualquer outro trabalho nessa frente.

### PD-017 — o bloco de repetição com condição

Não existe bloco `enquanto` na Palette. O conceito `repeticao_condicional` saiu
do catálogo em 16/11/2026, porque um conceito sem bloco que o represente quebra
o indicador da RN-019. O catálogo foi de 6 fases e 5 conceitos para 5 e 4.

Aberta como [issue #2](https://github.com/laramaia/while_under_attack/issues/2).
Se o bloco entrar, o conceito e as fases voltam.

---

### PD-018 — o jogo não tem conceito de fase

**Levantada em 16/11/2026**, ao preparar o Contrato de Eventos para quem vai
escrever o envio. Apareceu nas duas pontas ao mesmo tempo: na análise do
back-end e na conferência do lado do BI.

**O que foi verificado no código do jogo** (`origin/main`, commit `0127da5`):

- As palavras `fase`, `level`, `stage` e `fase_id` **não aparecem em lugar
  nenhum** de `src/`.
- Existem quatro cenas: `BootScene`, `StartScene`, `MenuScene` e `BattleScene`.
  A `BattleScene` monta o catálogo de blocos direto, sem saber qual fase está
  rodando.
- O jogo **não lê** o `catalogo-fases.json`.

Ou seja: hoje existe **um combate**, não uma progressão de fases.

#### Por que isto é mais grave que a PD-013

A `fase_id` está em quase tudo que o BI calcula:

| Indicador | Depende da fase porque |
|---|---|
| Tentativas até vencer (RN-012) | é contado por jogador **× fase** |
| Eficiência do código (RN-014) | compara com a solução de referência **da fase** |
| Conceito aplicado (RN-019) | olha o bloco que **a fase** ensina |
| Funil do professor (O4) | é literalmente "em que fases eles param" |
| Introdução × reforço (RN-020) | compara duas fases do mesmo conceito |

Sem fase, o **EV-03 (`fase_iniciada`) não existe** e o **EV-04 chega sem
`fase_id`**. A silver manda a tentativa para a quarentena com o motivo "fase
fora do catálogo" — um caminho que o ETL já implementa, mas como exceção, não
como caso normal.

**A consequência prática para o cronograma:** o jogo precisa de fases **antes**
de precisar de telemetria. Escrever o envio de eventos antes disso produz
eventos que o ETL recusa.

#### O que precisa ser decidido

1. **Quem define as fases?** A PD-006 (lista oficial de conceitos, fases e
   soluções de referência) continua aberta, e agora ela bloqueia o jogo também,
   não só o BI.
2. **Como o jogo sabe em que fase está?** O caminho que a ADR-006 previa é o
   jogo ler o `catalogo-fases.json` — que também fecharia a divergência da
   PD-013 de vez (ver Catálogo de Fases, seção 5).
3. **O que a `BattleScene` recebe?** Hoje ela monta tudo sozinha. Precisaria
   receber ao menos o `fase_id`, os `blocos_disponiveis` e o inimigo daquela
   fase.

#### Enquanto não é resolvido

O gerador sintético continua produzindo eventos com `fase_id` conforme o
catálogo, então o ETL, a gold e o dashboard seguem sendo desenvolvidos e
demonstrados. O que **não** é possível é coletar dado real de jogador.

---

## Riscos

| ID | Risco | Mitigação | Situação |
|---|---|---|---|
| RS-01 | Jogo e back-end concentrados na mesma pessoa viram gargalo | Fechar o contrato de eventos cedo, para que jogo e dashboard possam avançar em paralelo, com dados simulados | **Funcionou.** O BI ficou pronto antes do back-end existir, alimentado pelo gerador sintético |
| RS-02 | Com ~10 jogadores, os gráficos ficam pouco expressivos | Dados sintéticos apenas em desenvolvimento, claramente marcados e separados. **A demonstração usa dados reais** | **Meio cumprida.** A separação existe (coluna `origem` e faixa amarela no dashboard). A segunda metade **não**: não existem dados reais, porque o jogo ainda não envia e a ingestão não existe |
| RS-03 | Mudar uma fase depois de coletar dados invalida comparações | `catalog_version` em todo evento (ADR-006) | Em uso: o catálogo foi de `2026.10.1-rascunho` para `2026.11.1-rascunho` |
| RS-04 | Dashboard escrito com ajuda de IA sem dono na equipe fica difícil de defender na banca | Uma pessoa da equipe revisa e consegue explicar cada parte antes do merge | **Em curso.** O trabalho está no PR #1, em dois commits separados por assunto justamente para a revisão ser possível. O código cita as regras pelo número |
| RS-05 | Relógio do celular errado bagunça a ordem dos eventos | `seq` por sessão e `received_at` no servidor (ADR-007) | Implementado no ETL |
| **RS-06** | **Backup nunca testado.** O plano é o histórico de 7 dias do Neon, mas ninguém tentou restaurar. Há um ambiente só: não existe separação entre dev e produção | Testar uma restauração antes da banca; ao publicar, criar dois bancos no mesmo projeto Neon (`wua_dev` e `wua_prod`), mudando só a `WUA_DB_URL`. Custo zero | **Aberto.** Depende da PD-005 |

### Sobre o RS-02, com a banca à vista

A mitigação registrada diz que **a demonstração usa dados reais**, e hoje isso
não é possível. É risco de cronograma, não de código: depende de o endpoint de
ingestão existir e de o jogo enviar.

Vale a equipe combinar um plano B. Apresentar com dado sintético e a faixa
amarela visível é honesto — mas contraria o que a própria equipe escreveu, e é
melhor decidir isso antes da banca do que durante.

---

## Histórico

| Data | Mudança |
|---|---|
| 13/10/2026 | Versão inicial, PD-001 a PD-013 e RS-01 a RS-05 |
| 16/11/2026 | PD-013 passa a **parcialmente resolvida**. Acrescentadas **PD-014** (`corpo` × `inner`), **PD-015** (base legal e retenção), **PD-016** (produtos ou capacidades) e **PD-017** (bloco de repetição com condição). Acrescentado o risco **RS-06** (backup nunca testado, ambiente único). Coluna *Situação* nos riscos, com o estado real de cada mitigação |
| 16/11/2026 | **PD-005** passa a parcialmente resolvida: o banco do projeto está no Neon e o BI está conectado nele. Acrescentada a **PD-018** (o jogo não tem conceito de fase), levantada ao preparar o Contrato de Eventos para quem vai escrever o envio |
