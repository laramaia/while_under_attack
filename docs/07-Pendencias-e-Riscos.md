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
| PD-009 | Com várias pilhas executáveis, todas executam? Em paralelo ou em sequência? Pilhas sem bloco de evento são ignoradas, como propõe a RN-018? | Contrato de eventos, RN-018 | Médio |
| PD-010 | Fases são liberadas em ordem ou ficam todas abertas? | RN-017 | Médio |
| PD-012 | Se algum testador for menor de idade: termo de consentimento dos responsáveis | LGPD | **Alto se houver** |
| **PD-015** | **Base legal e tempo de retenção dos eventos.** Por quanto tempo os dados ficam guardados e com que fundamento são coletados | LGPD | **Alto** |
| **PD-016** | **A exigência da arquitetura corporativa é dos produtos (Airflow, Spark, Delta Lake) ou das capacidades?** | ADR-008 | **Alto** |
| **PD-017** | **Existirá bloco de repetição com condição (o "enquanto")?** | Catálogo, PD-006 | **Alto** |
| **PD-018** | **De onde o jogo vai tirar o `fase_id`?** As fases estão sendo criadas no jogo; falta combinar se os identificadores saem do `catalogo-fases.json` ou são definidos no código | Contrato de eventos, ADR-006 | Médio |
| **PD-019** | **Qual o teto de eventos por lote?** Hoje não há limite: um lote de qualquer tamanho é aceito inteiro | ADR-007, ingestão | Médio |
| **PD-020** | **Quem renomeia o `auth_provisoria.py`?** O conteúdo já não é provisório — valida o JWT e aplica RN-004 e RN-005 — mas o nome diz o contrário | ADR-004, legibilidade | Baixo |

### Resolvidas

| ID | Pendência | Resolução |
|---|---|---|
| PD-001 | Confirmar com o professor da disciplina que dashboard sem Power BI e sem DAX atende à avaliação | **Resolvida em 13/10/2026:** Power BI não é obrigatório; Python ou outra ferramenta são aceitos (ADR-001) |
| PD-007 | Lista oficial de categorias de bloco | **Resolvida em 13/10/2026:** Evento, Ação, Condicional e Repetição |
| PD-011 | Lara confirma FastAPI ou prefere Flask ou Django? | **Resolvida em 16/11/2026:** FastAPI nos dois lados, em **dois serviços** sobre o mesmo banco — `backend/` na porta 8001 e `bi/` na 8000. Ver ADR-002 |
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

#### Relação com a PD-006

Quais fases existem, com que conceito e que solução de referência, continua
sendo a **PD-006**, aberta desde 13/10. Enquanto ela não fecha, o catálogo
mantém o sufixo `-rascunho` e os `fase_id` de hoje (`F01` a `F05`) são
provisórios.

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
