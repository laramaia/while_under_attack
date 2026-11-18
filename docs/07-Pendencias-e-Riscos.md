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
| PD-005 | Onde hospedar **os dois serviços**; existe orçamento? *(o banco já foi resolvido — ver abaixo)* | Implantação | **Alto** |
| PD-006 | Lista oficial de conceitos, fases e soluções de referência | Catálogo, RN-014 | **Alto** |
| PD-008 | Editar o programa durante a pausa encerra a tentativa? | RN-009, EV-05 | Médio |
| PD-010 | Fases são liberadas em ordem ou ficam todas abertas? | RN-017 | Médio |
| PD-012 | Se algum testador for menor de idade: termo de consentimento dos responsáveis | LGPD | **Alto se houver** |
| **PD-015** | **Base legal e tempo de retenção dos eventos.** Por quanto tempo os dados ficam guardados e com que fundamento são coletados | LGPD | **Alto** |
| **PD-016** | **A exigência da arquitetura corporativa é dos produtos (Airflow, Spark, Delta Lake) ou das capacidades?** | ADR-008 | **Alto** |
| **PD-017** | **Existirá bloco de repetição com condição (o "enquanto")?** | Catálogo, PD-006 | **Alto** |
| **PD-018** | **De onde o jogo vai tirar o `fase_id`?** As fases estão sendo criadas no jogo; falta combinar se os identificadores saem do `catalogo-fases.json` ou são definidos no código | Contrato de eventos, ADR-006 | Médio |
| **PD-019** | **Qual o teto de eventos por lote?** Hoje não há limite: um lote de qualquer tamanho é aceito inteiro | ADR-007, ingestão | Médio |
| **PD-020** | **Quem renomeia o `auth_provisoria.py`?** O conteúdo já não é provisório — valida o JWT e aplica RN-004 e RN-005 — mas o nome diz o contrário | ADR-004, legibilidade | Baixo |
| **PD-021** | **O bloco `on-start` está na Palette e nunca executa.** O motor do jogo só dispara pilhas que começam com `on-flag`. Ou o jogo passa a executá-lo, ou ele sai da Palette, ou perde o `inicia_pilha` no catálogo. Aberta como [issue #4](https://github.com/laramaia/while_under_attack/issues/4) | RN-018, RN-014, RN-019 | **Alto** |
| **PD-022** | **O tempo limite da fase é o mesmo para todas ou é por fase?** Se for por fase, o número tem que morar no `catalogo-fases.json` e virar coluna em `gold.dim_fase`. Ver abaixo. Aberta como [issue #8](https://github.com/laramaia/while_under_attack/issues/8) | RN-021, catálogo, `dim_fase` | **Alto** |
| **PD-023** | **Dá para jogar sem login?** Hoje não existe tela de login e o jogo começa direto. Enquanto não se decidir isso, ninguém sabe o que o jogo deve fazer quando o back-end estiver fora do ar. Ver abaixo. Aberta como [issue #7](https://github.com/laramaia/while_under_attack/issues/7) | RN-001, ADR-004, telemetria | **Alto** |

### Resolvidas

| ID | Pendência | Resolução |
|---|---|---|
| PD-001 | Confirmar com o professor da disciplina que dashboard sem Power BI e sem DAX atende à avaliação | **Resolvida em 13/10/2026:** Power BI não é obrigatório; Python ou outra ferramenta são aceitos (ADR-001) |
| PD-007 | Lista oficial de categorias de bloco | **Resolvida em 13/10/2026:** Evento, Ação, Condicional e Repetição |
| PD-011 | Lara confirma FastAPI ou prefere Flask ou Django? | **Resolvida em 16/11/2026:** FastAPI nos dois lados, em **dois serviços** sobre o mesmo banco — `backend/` na porta 8001 e `bi/` na 8000. Ver ADR-002 |
| PD-009 | Com várias pilhas executáveis, todas executam? Em paralelo ou em sequência? Pilhas sem bloco de evento são ignoradas? | **Parcialmente resolvida em 16/11/2026, pelo código:** todas as pilhas com `on-flag` executam, **em sequência**, na ordem do `roots`; pilhas sem bloco de evento são ignoradas, como a RN-018 previa. Ficou de fora o `on-start` — ver **PD-021** |
| PD-013 | Quais condições existem para os blocos condicionais, se haverá "senão", e quais os identificadores técnicos dos blocos e parâmetros no código | **Parcialmente resolvida em 16/11/2026:** os identificadores e as categorias do `catalogo-fases.json` passaram a ser os do jogo. Ver abaixo o que falta |
| **PD-014** | **`corpo` × `inner`** | **Resolvida em 16/11/2026:** fica **`corpo`**, como o contrato sempre disse, e **o jogo traduz** o `inner` ao serializar o programa. O back-end já aceita `corpo`, verificado com programa aninhado |

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

### PD-005 — o banco já está resolvido; faltam os dois serviços

**Resolvido em 16/11/2026:** a Lara criou o banco do projeto no
[Neon](https://neon.com), plano gratuito, e o BI está conectado nele. As três
camadas da Medallion (`bronze`, `silver`, `gold`) e o schema operacional `app`
foram aplicados lá, com as garantias conferidas no próprio banco: gatilho de
imutabilidade da bronze (RN-016), `unique (event_id)` (RN-015), o `check` dos
cinco tipos de evento e as chaves estrangeiras.

**Continua aberto:** onde os serviços vão rodar — e desde 16/11/2026 **são
dois**, não um: o back-end (porta 8001) e o BI (porta 8000). A recomendação
registrada é o [Render](https://render.com), Web Service gratuito, com duas
ressalvas já conhecidas: ele hiberna após 15 minutos sem acesso (abrir o link
alguns minutos antes da apresentação) e, hibernando, **não serve para hospedar
o agendador do ETL** — nesse cenário o gatilho da ADR-009 precisa ser um
Scheduled Job ou um cron externo.

Serem dois muda a conta: **dois Web Services gratuitos hibernam
independentemente**, e o dashboard não autentica com o back-end dormindo. No dia
da banca, acordar os dois.

**Quatro coisas de segurança que vieram junto:**

1. A string de conexão é um **segredo** e não entra no repositório. Ela fica no
   `bi/.env`, que o `.gitignore` cobre. Quem for rodar o projeto pede a
   conexão à equipe.
2. O usuário em uso é o `neondb_owner`, que é o **dono** do banco. Para o MVP
   serve, mas o ideal é o BI ter um usuário só de leitura nas camadas que ele
   lê e escrita só em `silver` e `gold` — a bronze ele nunca precisa alterar
   (RN-016). O back-end é o inverso: escreve na bronze e não precisa de
   `silver` nem `gold`.
3. **As senhas das contas de teste são iguais ao nome de usuário.** É convenção
   documentada e inofensiva enquanto nada está publicado. No dia em que a API
   subir para o Render elas viram adivinháveis por qualquer pessoa da internet.
   **Trocar antes de publicar** — vale para `teste`, `professor` e para o que o
   `backend/contas.json` criar.
4. **O CORS do back-end está em `allow_origins=["*"]` com
   `allow_credentials=True`.** Em desenvolvimento é o efeito desejado, e com
   token em cabeçalho (não em cookie) o risco é baixo. Antes de publicar, virar
   lista explícita com as origens do jogo e do dashboard. Conferido: hoje
   qualquer origem recebe `access-control-allow-origin` de volta.

### PD-014 — `corpo` × `inner` (resolvida)

**Resolvida em 16/11/2026, e no prazo certo: antes de o jogo começar a enviar.**
Depois de começar, mudar o formato do programa seria mudança incompatível de
contrato e exigiria incrementar o `schema_version`.

**Fica `corpo`**, como o Contrato de Eventos sempre disse. O back-end aceita
`corpo` e grava o programa no `jsonb` exatamente como veio (ADR-005) —
verificado com um programa de `repeat` com bloco aninhado, que a silver
reconstruiu certo (`bloco_pai_id` e `profundidade`).

O `BlockInstance` do jogo continua com `inner`, e **a tradução fica no jogo**,
na função que serializa o programa. Foi decidido desse lado por um motivo
prático: a ingestão já está pronta e o contrato já está publicado, enquanto o
serializador do jogo ainda não existe — é mais barato nascer certo do que
mudar os dois lados.

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

### PD-018 — de onde o jogo vai tirar o `fase_id`

**Levantada em 16/11/2026**, enquanto as fases estavam sendo criadas no jogo.
Não é um impedimento: é a combinação que vale fazer **antes** de o envio de
eventos ser escrito, porque depois fica cara.

#### A situação

O jogo ainda não tem fases — em `src/` não há `fase`, `level` nem `stage`, e a
`BattleScene` monta o catálogo de blocos direto. Isso **está sendo feito**. O
que falta combinar não é *se* vão existir fases, e sim **de onde sai o
identificador de cada uma**.

#### Por que importa combinar agora

O `fase_id` atravessa quase tudo que o BI calcula:

| Indicador | Depende da fase porque |
|---|---|
| Tentativas até vencer (RN-012) | é contado por jogador **× fase** |
| Eficiência do código (RN-014) | compara com a solução de referência **da fase** |
| Conceito aplicado (RN-019) | olha o bloco que **a fase** ensina |
| Funil do professor (O4) | é literalmente "em que fases eles param" |
| Introdução × reforço (RN-020) | compara duas fases do mesmo conceito |

Se o jogo mandar um `fase_id` que não existe no catálogo da `catalog_version`
informada, a silver manda a tentativa para a quarentena
(`silver.evento_rejeitado`, motivo "fase fora do catálogo"). Não se perde nada
— a bronze é imutável e basta reprocessar depois de acertar o catálogo — mas o
dado não aparece no dashboard até lá.

É a mesma armadilha da PD-013, que já aconteceu uma vez com os identificadores
de bloco: duas listas para a mesma coisa, feitas em lugares diferentes. Vale
não repetir com as fases.

#### O que combinar

1. **Os `fase_id` saem do `catalogo-fases.json`?** É o que a ADR-006 previa: o
   jogo lê o arquivo e o dashboard usa o mesmo. Fecharia de vez a divergência
   da PD-013 — ver Catálogo de Fases, seção 6.
2. **Ou o jogo define as fases no código**, e o catálogo passa a ser gerado a
   partir dele? Também resolve, desde que haja **uma** fonte.
3. **O que a `BattleScene` recebe por fase?** No mínimo o `fase_id`; junto
   viriam os `blocos_disponiveis` e o inimigo.

Qual das duas primeiras não importa tanto quanto **ser só uma**.

#### Atualização de 17/11/2026: o jogo escolheu a opção 1, de fato

A telemetria que entrou na `main` manda `fase_id` lido de uma constante:

```typescript
// src/config.ts
export const CURRENT_PHASE_ID = 'F01';
```

`F01` é exatamente o primeiro identificador do `catalogo-fases.json`, então na
prática **a opção 1 foi escolhida** e as duas listas batem. Testado: o evento
atravessa a silver sem cair na quarentena.

Mas a pendência **continua aberta**, porque a constante é uma só e o jogo tem
cinco fases pela frente. Falta a parte que importa: a `BattleScene` receber o
`fase_id` de quem a abriu, em vez de ler uma constante global. Enquanto for
constante, trocar de fase significa editar o `config.ts` — e no dia em que
alguém esquecer, todas as tentativas vão para a fase errada **sem erro
nenhum**, porque `F01` existe no catálogo. Esse é o tipo de divergência que o
dashboard não consegue detectar.

#### Relação com a PD-006

Quais fases existem, com que conceito e que solução de referência, continua
sendo a **PD-006**, aberta desde 13/10. Enquanto ela não fecha, o catálogo
mantém o sufixo `-rascunho` e os `fase_id` de hoje (`F01` a `F05`) são
provisórios.

---

### PD-021 — o `on-start` está na Palette e nunca executa

Levantada em 16/11/2026, ao rodar o `ProgramRunner` que entrou na `main`.
Aberta como [issue #4](https://github.com/laramaia/while_under_attack/issues/4).

O motor de execução do jogo faz:

```typescript
const startBlocks = roots.filter((block) => block.template.id === 'on-flag');
```

Só `on-flag`. O `on-start` ("Ao iniciar fase") continua na Palette, o jogador
pode arrastá-lo para o Workspace e empilhar blocos debaixo dele — e **nada
acontece ao apertar Play**. Testado: uma pilha só com `on-start` imprime
"Nenhum bloco 'Ao clicar em play' encontrado no Workspace!".

**Por que isso é caro para os indicadores.** O `catalogo-fases.json` marca os
dois com `inicia_pilha: true`, então a silver considera a pilha executável:

| Indicador | O que aconteceria |
|---|---|
| `qtd_blocos` (RN-014) | conta blocos que nunca rodaram |
| Eficiência (RN-014) | compara a solução de referência com um programa que não executou |
| Conceito aplicado (RN-019) | dá crédito por um `repeat` que o jogo ignorou |
| `qtd_pilhas_executaveis` | conta uma pilha a mais |

**O gate de qualidade não pega isso**, porque o dado é internamente
consistente: não há regra que saiba o que o jogo decidiu executar. É o tipo de
erro que só aparece olhando o jogo e o ETL lado a lado.

Três saídas, nenhuma difícil, mas é decisão da equipe:

1. **O jogo passa a executar `on-start` também.** Coerente com os dois blocos
   existirem, mas aí qual a diferença entre eles?
2. **`on-start` sai da Palette.** Se não tem função, não devia estar lá.
3. **`on-start` perde o `inicia_pilha`** no catálogo, e a RN-018 passa a falar
   de um bloco só. Alinha o BI ao jogo sem mexer no jogo.

A terceira é a mais barata e eu posso fazê-la sozinha, mas é a que silencia a
pergunta em vez de respondê-la: o bloco continuaria na Palette sem fazer nada.

### Um defeito no Workspace, que não é pendência de decisão

Não é decisão de ninguém, é bug, mas afeta os dados e por isso fica
registrado aqui, e aberto como [issue #5](https://github.com/laramaia/while_under_attack/issues/5).
Em `Workspace.removeBlockInstance`, apagar o **primeiro**
bloco de uma pilha some com o resto dela:

| O que se apaga | O que acontece |
|---|---|
| bloco do meio | a pilha se religa certo ✔ |
| último bloco | certo ✔ |
| **primeiro bloco (o `on-flag`)** | o `roots` fica **vazio**; os blocos de baixo continuam na tela e no `activeBlocks`, mas somem do programa ✘ |

Testado no jogo rodando. O `prevBlock` dos blocos restantes continua apontando
para o bloco removido, e nenhum deles é promovido a raiz.

**Para o BI isso é pior do que parecer um bug de tela:** quem serializa o
programa lê o `roots`, então o evento registraria um programa **vazio**
enquanto o jogador vê blocos no Workspace. Número errado, sem nada que o
denuncie.

> **Corrigido em 17/11/2026** pela Lara, em `bab601a`, e verificado com o jogo
> rodando: apagar o primeiro bloco promove o seguinte a raiz, e o `prevBlock`
> dele vai para `null`. A correção trata também o bloco que está dentro de um
> C-block, caso que a issue não tinha previsto. Issue #5 fechada.

---

### PD-022 — o tempo limite é o mesmo para todas as fases?

Aberta como [issue #8](https://github.com/laramaia/while_under_attack/issues/8).

**Levantada em 17/11/2026**, junto com a RN-021. O lado do jogo falou em
**15 s**, e a RN-021 já está implementada nas três camadas esperando o campo
`disparo`. O que **não** está combinado é de onde sai esse número.

#### Por que não é detalhe de interface

Se o tempo for **por fase**, ele é propriedade da fase, igual ao
`tamanho_referencia`. Então:

- precisa de um campo novo no `catalogo-fases.json` (`tempo_limite_s`),
- precisa virar coluna em `gold.dim_fase`,
- e a `catalog_version` sobe, porque o formato do catálogo mudou.

Se for **global**, nada disso acontece: é uma constante no `config.ts` do jogo
e o BI não fica sabendo — nem precisa.

A diferença some se ninguém decidir agora e alguém **codificar 15 s no jogo**:
o número fica enterrado no código, e no dia em que a fase 5 precisar de 40 s
não há lugar para dizer isso.

#### Recomendação

**Por fase, no catálogo.** O custo hoje é uma linha por fase no JSON e uma
coluna em `dim_fase`; depois custa uma migração e um reprocessamento. E a
pergunta "a fase que mais estoura o tempo é a mais difícil?" só tem resposta se
o tempo de cada fase for um dado, não uma constante.

Enquanto não se decide, **o jogo pode usar 15 s para todas** — é o mesmo
comportamento nos dois casos enquanto o número não variar. O que não dá é
mandar o `disparo` sem combinar isto, porque aí o indicador nasce sem contexto.

#### O que não depende desta decisão

O campo `disparo` do EV-04 **já está pronto e testado** nas três camadas,
qualquer que seja a resposta. Ver Contrato de Eventos, EV-04.

---

### PD-023 — dá para jogar sem login?

Aberta como [issue #7](https://github.com/laramaia/while_under_attack/issues/7).

**Levantada em 17/11/2026**, ao conferir por que nenhum evento chega ao
back-end. Não existe tela de login: a `StartScene` tem um botão "Jogar" que vai
direto para a `BattleScene`. Como `telemetry.iniciarSessao(token)` nunca é
chamado, **todo evento que o jogo monta é descartado na hora** — ver
API e Integração, seção 8.

#### As três perguntas que ninguém respondeu ainda

1. **O login é obrigatório para jogar?** A RN-001 diz que não há autocadastro,
   mas não diz que não se joga sem conta.
2. **E se o back-end estiver fora do ar?** No Render o serviço hiberna depois
   de 15 min parado e a primeira chamada demora. O jogo trava na tela de login,
   deixa jogar sem telemetria, ou espera?
3. **O token vale 8 h (ADR-004). E quando expira no meio da partida?** Hoje o
   `flush()` trata `401` como "tentar de novo depois" e **mantém os eventos na
   fila**. Isso está certo para queda de rede, mas com token expirado a fila
   cresce no `localStorage` para sempre e nada mais é enviado, em silêncio.

#### Recomendação

**Login obrigatório, e o jogo não começa sem ele.** É o mais simples de
explicar na banca e o único que garante que todo evento tem dono — sem
`jogador_id` não existe RN-004 ("cada um só vê os próprios dados") nem nenhum
indicador por jogador.

Para o `401`: tratar como "sessão acabou", mandar de volta para o login e
chamar `iniciarSessao` de novo com o token novo. A fila sobrevive no
`localStorage` e é enviada na sequência — o desenho da telemetria já aguenta
isso, só falta quem decida.

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
| 16/11/2026 | **PD-005** passa a parcialmente resolvida: o banco do projeto está no Neon e o BI está conectado nele. Acrescentada a **PD-018** (de onde o jogo tira o `fase_id`), levantada enquanto as fases estavam sendo criadas no jogo |
| 16/11/2026 | **O back-end passou a existir** (branch `mateo/backend-ingestao`), foi rodado de ponta a ponta e duas pendências fecharam: **PD-011** (FastAPI, em dois serviços) e **PD-014** (`corpo`, com o jogo traduzindo). Acrescentadas **PD-019** (teto do lote) e **PD-020** (renomear o `auth_provisoria.py`). A **PD-005** cresceu: são dois serviços para hospedar, e vieram com ela a troca das senhas de teste e o CORS aberto |
| 16/11/2026 | **O motor de execução dos blocos entrou na `main`.** A **PD-009** passa a parcialmente resolvida pelo próprio código: pilhas com `on-flag` executam todas, em sequência; pilhas sem bloco de evento são ignoradas. Acrescentada a **PD-021**: o `on-start` está na Palette e nunca executa, e isso faz os indicadores contarem blocos que não rodaram. Registrado também o defeito do `Workspace.removeBlockInstance` |
| 17/11/2026 | **PD-022** (o tempo limite é global ou por fase?) e **PD-023** (dá para jogar sem login?) acrescentadas, as duas com recomendação e abertas como issues [#8](https://github.com/laramaia/while_under_attack/issues/8) e [#7](https://github.com/laramaia/while_under_attack/issues/7). PD-018 atualizada: o jogo escolheu de fato o `fase_id` do catálogo (`CURRENT_PHASE_ID = 'F01'`), mas continua aberta porque é constante global e o jogo tem cinco fases pela frente. O defeito do Workspace foi corrigido pela Lara em `bab601a` e verificado |
