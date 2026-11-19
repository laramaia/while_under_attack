# while under_attack: attack()
## Registro de Decisões de Arquitetura (ADRs)

**Status:** cada ADR tem seu próprio status · **Última atualização:** 16/11/2026

Cada decisão registra o contexto, as alternativas consideradas, a decisão
adotada e suas consequências. **Uma decisão nunca é apagada:** quando muda,
recebe o status "Substituído por ADR-XXX" e uma nova ADR é criada.

---

## Resumo

| ID | Decisão | Status |
|---|---|---|
| [ADR-001](#adr-001--dashboard-web-próprio-em-vez-de-power-bi) | Dashboard web próprio em vez de Power BI | Aceito |
| [ADR-002](#adr-002--back-end-em-python-fastapi-servindo-api-e-dashboard) | Back-end em Python (FastAPI) servindo API e dashboard | Python aceito · FastAPI proposto |
| [ADR-003](#adr-003--arquitetura-medallion-em-schemas-do-postgresql) | Arquitetura Medallion em schemas do PostgreSQL | Proposto |
| [ADR-004](#adr-004--autenticação-por-usuário-e-senha-com-contas-pré-criadas) | Autenticação por usuário e senha com contas pré-criadas | Aceito |
| [ADR-005](#adr-005--tentativa-como-unidade-de-análise-com-snapshot-do-programa) | Tentativa como unidade de análise, com snapshot do programa | Proposto |
| [ADR-006](#adr-006--catálogo-de-fases-em-json-versionado-como-fonte-única) | Catálogo de fases em JSON versionado como fonte única | Proposto |
| [ADR-007](#adr-007--envio-de-eventos-em-lote-com-fila-local-e-idempotência) | Envio de eventos em lote, com fila local e idempotência | Proposto |
| [ADR-008](#adr-008--conformidade-com-a-arquitetura-corporativa-por-capacidade-não-por-produto) | Conformidade com a arquitetura corporativa por capacidade, não por produto | Proposto |
| [ADR-009](#adr-009--gatilho-do-etl-agendado-a-cada-15-minutos-mais-execução-manual) | Gatilho do ETL: agendado a cada 15 minutos, mais execução manual | Proposto |
| [ADR-010](#adr-010--gate-de-qualidade-entre-as-camadas-dentro-da-transação-do-etl) | Gate de qualidade entre as camadas, dentro da transação do ETL | Proposto |

---

## ADR-001 — Dashboard web próprio em vez de Power BI

**Status:** Aceito · **Data:** 13/10/2026

### Contexto

O dashboard tem dois perfis (RN-004, RN-005) e precisa ser acessado fora do
jogo. Garantir no Power BI que cada pessoa veja só os próprios dados exige
compartilhamento com controle de acesso e segurança por linha, o que depende de
licenças pagas para quem visualiza. O "Publicar na Web" gera link público e não
serve para dados individuais. Embutir o Power BI no app também é recurso pago.
O professor da disciplina confirmou que o Power BI não é obrigatório: o
dashboard pode ser feito em Python ou em outra ferramenta (PD-001, resolvida).

### Alternativas consideradas

1. Power BI com segurança por linha: custo de licenças e configuração fora do
   controle da equipe.
2. Power BI Desktop apenas na demonstração: não atende ao jogador real
   acessando seus próprios dados.
3. Dashboard web consumindo a API do projeto: usa o mesmo login e as mesmas
   permissões do jogo.

### Decisão

Alternativa 3.

### Consequências

- (+) Uma única regra de permissão, aplicada na API.
- (+) Sem custo de licenças.
- (+) Os cálculos dos indicadores ficam na camada gold (SQL e Python), que pode
  ser demonstrada na banca como parte do ciclo de BI.
- (−) A equipe constrói a interface do dashboard em vez de usar uma ferramenta
  pronta.

---

## ADR-002 — Back-end em Python (FastAPI), em dois serviços sobre o mesmo banco

**Status:** **Aceito** · **Data:** 13/10/2026 · **Revisto em:** 16/11/2026

### Contexto

A Lara será responsável pelo back-end e escolheu Python. O dashboard (ADR-001)
precisa do mesmo login do jogo e das mesmas regras de acesso.

### Alternativas consideradas

1. FastAPI servindo a API e os arquivos estáticos do dashboard.
2. API em Python mais um dashboard separado em Streamlit ou Dash: exigiria um
   segundo sistema de login e uma cópia das regras de permissão.
3. Flask ou Django: viáveis; a escolha depende da familiaridade da Lara.

### Decisão

Alternativa 1, se a Lara não tiver preferência forte por outro framework. O
dashboard será feito em HTML e JavaScript sem etapa de build, servido em
`/dashboard`, e funcionará como cliente da API.

### Consequências

- (+) O FastAPI gera documentação OpenAPI automaticamente, e ela vira o
  contrato entre o back-end e o dashboard.
- (+) Validação dos dados de entrada declarada no próprio código.
- (+) Um único serviço para hospedar.
- (−) Jogo, back-end e dashboard dependem de um contrato de API estável. Se ele
  mudar sem aviso, os dois clientes quebram.

### Revisão de 16/11/2026 — confirmado FastAPI, mas são dois serviços

A **PD-011 está resolvida**: FastAPI, nos dois lados. O que mudou em relação ao
texto de 13/10 é que **não é um único serviço**, e sim dois, no mesmo banco:

| | Pasta | Porta | Responsabilidade |
|---|---|---|---|
| Back-end | `backend/` | 8001 | autentica e **escreve** na bronze |
| BI | `bi/` | 8000 | **lê** a gold, serve a API analítica e o dashboard |

A fronteira entre eles é o banco, não uma biblioteca: não há nenhum import de
um no outro. Isso foi o que permitiu a fatia de BI ficar pronta meses antes do
back-end existir, e é a razão de a decisão continuar valendo mesmo tendo
mudado de forma.

**A única exceção é o login**, que o BI **delega** por HTTP ao
`POST /login` do back-end em vez de duplicar a conferência de senha. As regras
de permissão (RN-004, RN-005) continuam num lugar só, no BI — ver ADR-001.

- (+) Cada pessoa publica e reinicia o seu serviço sem derrubar o do outro.
- (+) O back-end não precisa conhecer o catálogo de fases nem o modelo
  dimensional para funcionar.
- (−) **São dois serviços para hospedar**, não um. A PD-005 fica maior.
- (−) **O `WUA_SEGREDO` tem de ser idêntico nos dois**, porque um assina o JWT
  e o outro valida a assinatura. Se diferirem, o login responde `200` e todas as
  chamadas seguintes respondem `401` — falha longe da causa. Ver
  [`08-API-e-Integracao.md`](08-API-e-Integracao.md), seção 1.
- (−) O dashboard não autentica com o back-end fora do ar. A leitura da gold
  continua funcionando; só o login para.

> Um desenho alternativo evitaria o segredo compartilhado: o BI chamaria o
> `GET /eu` do back-end a cada requisição, ou a assinatura seria assimétrica
> (RS256, com o back-end guardando a chave privada e o BI só a pública). Para
> dois serviços da mesma equipe, HS256 com segredo compartilhado é o padrão
> aceitável e foi o escolhido. Fica registrado como o caminho natural se algum
> dia um terceiro serviço precisar validar tokens.

---

## ADR-003 — Arquitetura Medallion em schemas do PostgreSQL

**Status:** Proposto · **Data:** 13/10/2026

### Contexto

O pitch e a disciplina pedem a arquitetura Medallion. O volume é pequeno
(~10 jogadores), e a equipe não deve operar mais de um banco.

### Alternativas consideradas

1. Um PostgreSQL com três schemas: `bronze`, `silver` e `gold`.
2. Arquivos (CSV ou Parquet) por camada: mais peças soltas e sem controle de
   acesso.
3. Plataforma de dados dedicada: desproporcional ao tamanho do projeto.

### Decisão

Alternativa 1.

- `bronze.eventos`: inserção apenas, com o payload em `jsonb` (RN-016).
- `silver`: sessões e tentativas reconstruídas, tipadas e validadas.
- `gold`: modelo estrela consumido pela API do dashboard.

### Consequências

- (+) Cada camada pode ser demonstrada com uma consulta SQL na banca.
- (+) Um único banco para hospedar e fazer backup.
- (−) O ETL precisa de um gatilho (execução manual, agendada ou após a
  ingestão). **Resolvido pela ADR-009** em 16/11/2026.

---

## ADR-004 — Autenticação por usuário e senha com contas pré-criadas

**Status:** Aceito · **Data:** 13/10/2026 · **Implementada em:** 16/11/2026

### Contexto

MVP com ~10 jogadores e um perfil professor. Escolas são apenas uma expectativa
futura. Como as contas são criadas pela equipe, o e-mail não tem função e seria
um dado pessoal coletado sem necessidade.

### Decisão

- Contas criadas pela equipe por script de seed (RN-001), com perfil `jogador`
  ou `professor`.
- Login com usuário e senha (RN-002).
- Senhas guardadas com algoritmo de hash próprio para senhas (ex.: Argon2 ou
  bcrypt), nunca em texto puro.
- A API emite um token com prazo de expiração. A identidade nos eventos vem do
  token (RN-006).
- Sem autocadastro e sem recuperação de senha. Se alguém esquecer a senha, a
  equipe redefine.

### Consequências

- (+) Superfície de ataque e escopo pequenos.
- (+) Coleta mínima de dados pessoais.
- (−) Abrir para escolas exigirá revisar esta decisão (ver Visão, seção 10).

### O que ficou implementado em 16/11/2026

A autenticação provisória do BI **saiu**. O que existe agora:

| Decisão de 13/10 | Como ficou |
|---|---|
| Contas por script de seed (RN-001) | `backend/src/wua_backend/seed.py`, lendo `backend/contas.json`, idempotente (`on conflict do nothing`) |
| Login com usuário e senha (RN-002) | `POST /login` no back-end, porta 8001 |
| Hash próprio para senhas: "ex.: Argon2 ou bcrypt" | **bcrypt, custo 12** |
| Token com prazo, identidade vinda dele (RN-006) | **JWT HS256**, validade de 8 horas (`WUA_TOKEN_VALIDADE_HORAS`) |
| Sem autocadastro, sem recuperação de senha | mantido: só o seed cria conta |

Três detalhes que a decisão não previa e que foram resolvidos na
implementação:

- **Usuário inexistente e senha errada devolvem a mesma resposta**, e o
  back-end confere um hash fictício quando o usuário não existe, para que o
  tempo de resposta também não revele se a conta existe.
- **O BI valida o JWT, mas não emite.** Ele delega o login ao back-end
  (ADR-002) e valida a assinatura com o mesmo `WUA_SEGREDO`.
- **O arquivo do BI passou a se chamar `acesso.py`** em 18/11/2026 (PD-020).
  Chamava-se `auth_provisoria.py`, de quando o BI conferia a senha sozinho;
  o conteúdo deixou de ser provisório dias antes do nome. Hoje faz duas
  coisas: valida o token e aplica as permissões RN-004 e RN-005.
- **O BI separa os três motivos de `401`** (expirado, assinatura divergente,
  token inválido). O do meio existe porque os dois serviços leem o
  `WUA_SEGREDO` de `.env` diferentes: com valores diferentes o login passa e
  tudo depois dele falha, e a mensagem genérica mandava procurar no lugar
  errado. Ver a seção 3 do documento de API.

> **A troca de PBKDF2 para bcrypt não é retroativa.** Contas criadas pela
> autenticação provisória têm hash PBKDF2, que o `bcrypt.checkpw` recusa — o
> login falha sem erro visível. Como o seed não sobrescreve conta existente,
> rodá-lo não corrige: é preciso trocar o hash no banco. Foi o que se fez com
> as contas `teste` e `professor` em 16/11/2026.

---

## ADR-005 — Tentativa como unidade de análise, com snapshot do programa

**Status:** Proposto · **Data:** 13/10/2026

### Contexto

O ciclo do jogo é: montar o programa, apertar Play, morrer ou vencer, ajustar e
tentar de novo. As perguntas do dashboard giram em torno das tentativas.

### Alternativas consideradas

1. Um evento por ação de edição (arrastar, soltar, remover, mudar parâmetro):
   volume alto e reconstrução complexa.
2. Um evento no Play com o programa completo e um evento com o resultado.

### Decisão

Alternativa 2. O programa completo vai junto do evento `tentativa_executada`
(EV-04). O que mudou entre duas tentativas é calculado na camada silver,
comparando os programas.

### Consequências

- (+) Poucos eventos e um contrato simples.
- (+) **Reprocessável:** qualquer métrica nova pode ser calculada a partir dos
  programas guardados. Foi assim que o indicador de conceito aplicado (RN-019)
  pôde ser aplicado a todas as tentativas já coletadas, depois de inventado.
- (−) Não registra a ordem das edições nem edições desfeitas antes do Play.
  Aceitável para as perguntas do MVP.

---

## ADR-006 — Catálogo de fases em JSON versionado como fonte única

**Status:** Proposto · **Data:** 13/10/2026

### Contexto

O jogo precisa saber quais blocos cada fase oferece. O dashboard precisa saber
qual conceito a fase ensina e qual é a solução de referência (RN-014). Se essas
informações existirem em dois lugares, vão divergir.

### Decisão

Um arquivo `catalogo-fases.json` no repositório, lido pelo jogo e carregado no
banco pelo ETL como dimensão de fase. Formato no Catálogo de Fases. Todo evento
carrega `catalog_version`.

### Consequências

- (+) Jogo e dashboard nunca discordam sobre o que é cada fase.
- (+) Mudanças no catálogo ficam registradas no histórico do Git.
- (−) Mudar uma fase depois de coletar dados exige nova versão do catálogo,
  para não misturar tentativas de versões diferentes (RS-03).

> **A previsão desta ADR se confirmou, pelo lado ruim.** Até 16/11/2026 o jogo
> **não lia** o `catalogo-fases.json`: tinha o seu próprio
> `src/model/defaultCatalog.ts`, e as duas listas divergiram exatamente como a
> ADR advertia. O JSON foi alinhado ao catálogo do jogo na `catalog_version`
> `2026.11.1-rascunho`, mas **continuam sendo duas listas**. A ADR só se cumpre
> de fato quando o jogo passar a ler o arquivo, ou quando o arquivo for gerado
> a partir do código do jogo. Ver PD-013.

---

## ADR-007 — Envio de eventos em lote, com fila local e idempotência

**Status:** Proposto · **Data:** 13/10/2026

### Contexto

O jogo roda em celular, onde a conexão pode cair. Perder eventos de tentativas
distorce os indicadores. Reenviar sem controle os duplica.

### Decisão

- O jogo grava cada evento numa fila local antes de enviar.
- O envio é feito em lotes para a API, e o evento sai da fila apenas após
  confirmação.
- Cada evento tem `event_id` (UUID gerado no jogo). A API ignora IDs já
  recebidos (RN-015).
- Cada evento tem `seq`, um contador crescente por sessão, para ordenar os
  eventos mesmo que o relógio do celular esteja errado.

### Consequências

- (+) Quedas curtas de conexão não perdem dados.
- (+) Reenviar é seguro.
- (−) O jogo precisa de armazenamento local. O mecanismo depende de como o jogo
  será distribuído (PD-004).

> **Acrescentado em 16/11/2026:** o lote passou a ser registrado em
> `bronze.ingestao_lote`, com as contagens de recebidos, gravados, ignorados e
> rejeitados, e `bronze.eventos.lote_id` liga cada evento ao lote. A coluna é
> **anulável**: uma ingestão que não informe o lote funciona como antes.

### O lado do servidor ficou pronto em 16/11/2026

`POST /api/eventos` no back-end (porta 8001) implementa esta decisão, e foi
verificado rodando:

- **Corpo do lote:** `{"eventos": [ ... ]}`.
- **Resposta `207`** com `gravados`, `ignorados` e `rejeitados`, cada rejeitado
  com o motivo. **Um evento ruim não derruba o lote.**
- **RN-015:** `event_id` repetido entra em `ignorados`, sem erro — o jogo
  precisa tratar isso como sucesso, senão nunca tira o evento da fila.
- **Lote aberto e fechado na mesma transação** da gravação dos eventos, com as
  três contagens batendo com a resposta HTTP.

**O lado do jogo não começou:** não há nenhuma chamada HTTP em `src/`. A fila
local, o `event_id`, o `seq` e o reenvio continuam por fazer, e o mecanismo de
armazenamento ainda depende da PD-004.

Dois pontos que a implementação do servidor deixou em aberto:

- **Não há limite de tamanho do lote.** Um lote muito grande é aceito inteiro.
  Vale combinar um teto (a fila do jogo pode mandar em blocos de 50).
- **Um erro no banco ainda perde o lote inteiro**, apesar da resposta `207`
  prometer resultado por evento. Vale só para erros que a validação não pega,
  mas contradiz a promessa do formato.

---

## ADR-008 — Conformidade com a arquitetura corporativa por capacidade, não por produto

**Status:** Proposto · **Data:** 16/11/2026

### Contexto

A disciplina exige que todos os projetos atendam à **Arquitetura Corporativa de
Dados — UNIVAG**: Lakehouse Medallion com Delta Lake sobre storage de objeto,
transformação em Apache Spark (PySpark), orquestração em Apache Airflow, consumo
em modelo semântico Power BI com RLS/OLS, uma camada de IA e uma faixa de
governança transversal.

O projeto já havia decidido, na ADR-003, implementar a Medallion em schemas do
PostgreSQL, rejeitando explicitamente "plataforma de dados dedicada" por
desproporção ao tamanho do MVP. A ADR-001 já havia rejeitado o Power BI por
custo de licença, com a PD-001 confirmando que o professor da disciplina não o
exige.

O diagrama de referência nomeia ao mesmo tempo **produtos** e **capacidades**.
Tratar as duas coisas como equivalentes levaria a decisões opostas.

Fato que pesa: a última execução completa do ETL processou 527 eventos em
**0,08 segundo**.

### Alternativas consideradas

1. **Adotar os produtos literalmente** — reescrever o ETL em PySpark, migrar
   para Delta Lake, subir Airflow, reconstruir os dashboards no Power BI.
   Custo: o semestre inteiro em infraestrutura, provavelmente sem entregar
   indicador nenhum. Contraria a ADR-001 e a ADR-003.
2. **Ignorar o diagrama**, alegando que é um MVP acadêmico. Deixaria o projeto
   sem gate de qualidade, sem orquestração e sem alerta — lacunas que são
   **reais**, e não questão de porte.
3. **Adotar a arquitetura por capacidade**: implementar toda capacidade que o
   diagrama exige e que o projeto não tinha; manter as escolhas de produto já
   argumentadas, documentando cada equivalência e o custo aceito.

### Decisão

Alternativa 3. O mapa caixa por caixa está em
[`bi/docs/arquitetura-de-referencia.md`](../bi/docs/arquitetura-de-referencia.md).

Capacidades implementadas por causa desta decisão: gate de qualidade
(ADR-010), orquestração agendada (ADR-009), alerta de falha, controle de
ingestão por lote e endpoints de observabilidade.

Substituições de produto mantidas:

| Produto do diagrama | No projeto | Razão |
|---|---|---|
| Delta Lake | PostgreSQL, três schemas | Transação, imutabilidade e schema enforcement são nativos (ADR-003) |
| ~~Apache Spark~~ | **adotado em 19/11/2026** — ver abaixo | — |
| ~~Apache Airflow~~ | **adotado em 19/11/2026** — ver abaixo | — |
| Power BI | dashboard web próprio | Licença paga para RLS (ADR-001, PD-001) |
| Entra ID / AD | contas pré-criadas | Sem diretório disponível (ADR-004) |

### Revisão de 19/11/2026 — Spark e Airflow passam a ser exigidos como produto

Esta ADR abria dizendo que produto e capacidade não são a mesma coisa, e §1 do
documento de conformidade registrava a pergunta em aberto: *"se o professor
exige os produtos e não as capacidades, o escopo muda"*. **A exigência passou a
ser pelo produto.** É o fato novo que a própria ADR dizia ser necessário para
rever a decisão — sem ele, mudar seria trocar uma decisão argumentada por uma
decisão de obediência.

**O que mudou no código:**

- `airflow/dags/wua_etl.py` — DAG real, que chama a mesma `pipeline.executar`.
  Rodou de ponta a ponta: gold publicada, as 11 regras aprovadas, tarefa verde.
- `bi/src/wua_bi/etl/spark.py` — a transformação bronze → silver em PySpark,
  **ao lado** da de SQL e não no lugar dela.
- `etl comparar` — roda os dois motores sobre a mesma bronze e compara.

**O que não mudou, e é o ponto:** a ADR-003 e a ADR-010 continuam valendo. O
Spark transforma e devolve as linhas; quem escreve continua sendo a transação do
ETL, porque o `write.jdbc` do Spark não participa dela e a gold certificada
depende disso. O DAG tem **uma** tarefa pelo mesmo motivo.

**A medição que a ADR pedia, agora com os dois motores existindo:**

```
                      SQL      Spark
sessoes                46         46
tentativas            199        199
blocos                681        681
rejeitados              0          0
duracao_s           0.054      2.925
```

Mesmo resultado, **54x o tempo**. O argumento original não era errado — era
sobre proporção, e continua verdadeiro. O que mudou foi o critério: a exigência
agora é ter o produto, e ter o produto **mais** a medição é melhor do que ter
só o argumento.

O custo aceito: duas implementações da mesma transformação. É por isso que o
`etl comparar` existe — um motor novo que ninguém consegue provar equivalente
ao antigo é risco, não entrega.

### Consequências

- (+) O projeto passa a ter as capacidades que faltavam, que são lacunas reais
  independentes de porte.
- (+) Cada desvio fica documentado com alternativa, decisão e custo aceito.
- (+) As decisões anteriores continuam válidas, em vez de serem substituídas
  por obediência sem fato novo.
- (−) **Não há *time travel*.** Mitigado por a gold ser inteiramente
  reconstruível a partir da bronze imutável, e pela `catalog_version` na chave
  da `dim_fase` (RS-03).
- (−) **A reconstrução integral deixa de ser gratuita em escala.** Com milhares
  de jogadores, viraria carga incremental.
- (−) **Depende de o professor concordar com a leitura.** Se a exigência for
  dos produtos, esta ADR precisa ser substituída. Ver **PD-016**.

---

## ADR-009 — Gatilho do ETL: agendado a cada 15 minutos, mais execução manual

**Status:** Proposto · **Data:** 16/11/2026 (decisão tomada em 26/10/2026)

### Contexto

A ADR-003 registrou como consequência em aberto: *"O ETL precisa de um gatilho
(execução manual, agendada ou após a ingestão). A decisão fica para o documento
de arquitetura."* Esse documento não existe até hoje.

A decisão **foi tomada e apresentada publicamente** na apresentação "Plano de
Orquestração de Dados", em 26/10/2026, mas não virou ADR escrita nem código: o
ETL continuava apenas manual.

A arquitetura corporativa de referência exige um orquestrador que dispare o
ciclo completo: ingestão, transformação, qualidade, publicação e alertas.

### Alternativas consideradas

1. **Manual apenas.** Simples de demonstrar, mas o dado só atualiza quando
   alguém lembra, e não atende ao diagrama.
2. **Agendado a cada 15 minutos**, mantendo o manual para demonstração.
3. **Por evento**, a cada lote recebido. Dado quase em tempo real, mas acopla o
   ETL à ingestão e cria mais peças para falhar.
4. **Apache Airflow**, como o diagrama nomeia.

### Decisão

Alternativa 2, implementada em `bi/src/wua_bi/etl/orquestrador.py`.

O argumento é proporcionalidade: ~10 jogadores, execução em segundos, e 15
minutos de atraso não mudam nenhuma decisão que o professor vá tomar olhando a
tela.

Sobre a alternativa 4: o Airflow resolve dependência entre tarefas,
paralelismo, backfill e retentativa seletiva. Este ETL tem **uma** tarefa,
idempotente, que roda em 0,08 segundo. O que sobraria do Airflow seria o
relógio.

**O caminho de volta está aberto e é curto:** `pipeline.executar()` é uma
função. Migrar para Airflow é escrever um DAG de uma tarefa que a chama. Cron
do sistema ou Scheduled Job do Render funcionam do mesmo jeito.

#### 19/11/2026 — o caminho de volta foi percorrido

A alternativa 4 deixou de ser alternativa: o Airflow passou a ser exigido como
produto (ver a revisão da ADR-008). O DAG está em `airflow/dags/wua_etl.py` e
**a previsão acima se confirmou na letra** — é um DAG de uma tarefa que chama
`pipeline.executar`, e nenhuma linha do ETL mudou por causa dele.

Agora são **três gatilhos** para a mesma função, e a coluna
`bronze.etl_execucao.disparo` registra qual foi:

| Gatilho | Comando | `disparo` |
|---|---|---|
| Pessoa | `etl rodar` | `manual` |
| Agendador próprio | `etl agendar` | `agendado` |
| Airflow | o DAG `wua_etl` | `airflow` |

**Uma tarefa, e não uma por camada.** A tentação é quebrar em
`silver → qualidade → gold → publicar`, que é como um DAG de livro-texto se
parece. Isso quebraria a ADR-010: o gate só significa alguma coisa porque as
duas portas rodam dentro da **mesma transação**, e transação de banco não
atravessa tarefas do Airflow. Seriam quatro caixas no grafo e uma gold que pode
ficar pela metade. O motivo está escrito no topo do DAG, para ninguém
"melhorar" isso sem saber o que está trocando.

**O DAG levanta exceção na mão**, porque `pipeline.executar` nunca levanta — ela
devolve `Resumo(ok=False)` para o agendador próprio poder seguir rodando depois
de uma falha. Sem o `raise`, a tarefa ficaria **verde com o gate reprovando**.
Isso não é teoria: na primeira execução real o DAG falhou de verdade, porque o
`CHECK` de `disparo` ainda não aceitava `'airflow'`, e a tarefa foi para
`up_for_retry` como deveria.

### Consequências

- (+) O dashboard deixa de depender de alguém lembrar de rodar o ETL.
- (+) A dívida da ADR-003 fica paga, em documento e em código.
- (+) Nenhuma dependência nova.
- (+) Uma falha não derruba o agendador; o ciclo seguinte tenta de novo.
- (−) O agendador é um processo que precisa estar de pé. No Render gratuito,
  que hiberna após 15 minutos sem acesso, isso **não é confiável** — nesse
  cenário, usar um Scheduled Job ou um cron externo.
- (−) Não há backfill seletivo. Não faz falta: toda execução reprocessa a
  história inteira.
- (−) Até 15 minutos de atraso entre o jogador jogar e o número aparecer.

---

## ADR-010 — Gate de qualidade entre as camadas, dentro da transação do ETL

**Status:** Proposto · **Data:** 16/11/2026

### Contexto

O projeto tinha oito conferências que traduziam regras de negócio em consultas
SQL, rodadas por um comando separado.

Elas rodavam **depois** do ETL. Na prática, informavam que a gold estava errada
**sem impedir que a gold errada fosse publicada** — e, se ninguém rodasse o
comando, sem informar nada. Com o ETL passando a rodar sozinho (ADR-009), isso
piora: não há mais ninguém olhando a saída.

A arquitetura de referência coloca um losango entre a Silver e a Gold com a
legenda *"só dado aprovado pela qualidade chega à Gold"*, e chama a Gold de
*"métricas certificadas"*. Sem um gate, "certificada" não significa nada
verificável.

### Alternativas consideradas

1. **Manter a conferência depois**, e confiar em alguém rodar e reagir.
2. **Conferir depois e reverter se falhar.** Exige guardar a versão anterior e
   cria uma janela em que a gold errada está no ar.
3. **Gate dentro da transação do ETL**: avaliar as regras antes do `commit` e
   abortar a transação inteira se alguma reprovar.
4. **Gate em ferramenta externa** (Great Expectations, dbt tests). Resolve o
   mesmo problema com mais uma dependência e mais um lugar onde a regra mora.

### Decisão

Alternativa 3. São **duas portas**, não uma:

```
silver → PORTA DA SILVER → gold → PORTA DA GOLD → commit
```

Cada regra fica na porta mais cedo em que consegue rodar. As duas portas usam a
**mesma conexão** do ETL — precisam enxergar o que a transação escreveu e ainda
não publicou.

Reprovou: `rollback`. A gold continua sendo a última versão aprovada.

As regras passaram de 8 para 11, com três de **reconciliação** (`REC-001`,
`REC-002`, `REC-003`), exigência explícita da faixa de qualidade do diagrama.

> **A `REC-003` corrigiu um ponto cego da própria porta da gold**, descoberto em
> 18/11/2026. As outras regras dela têm todas a forma *"quantas linhas da gold
> violam X?"*. É uma forma boa para ler em voz alta, mas tem um defeito: numa
> gold **vazia** todas respondem zero e todas aprovam. O gate publicaria o nada
> e diria que está tudo certo.
>
> Não foi hipótese. Ao subir a `catalog_version` do catálogo, o
> `fato_tentativa` — que junta com `dim_fase` por `(fase_id, catalog_version)` —
> deixou de achar par para os eventos, e as 199 tentativas da silver viraram 0
> na gold. As seis regras aprovaram e o ETL imprimiu *"gold publicada"*.
>
> A lição que vale guardar além deste caso: **uma porta de qualidade precisa de
> pelo menos uma regra que conte o que falta**, e não só regras que conferem o
> que está lá. Reconciliação é isso, e é por isso que o diagrama corporativo a
> pede como faixa própria.

O comando `conferir` mudou de papel: passou a **ler** o boletim gravado em
`bronze.etl_qualidade`, em vez de avaliar as regras de novo por fora.

### Consequências

- (+) "Métricas certificadas" passa a ser afirmação verificável.
- (+) **Nunca existe uma gold "meio certa" no ar.** Na pior hipótese, existe
  uma gold velha — e a API avisa, por `falha_pendente`.
- (+) O resultado fica gravado por execução, então dá para ver a qualidade ao
  longo do tempo.
- (+) Demonstrável na banca em um minuto: injetar um bloco fora do catálogo,
  rodar, mostrar a gold intacta.
- (−) **Uma regra mal escrita trava a publicação.** O contrapeso é o formato:
  toda regra devolve um único número, "quantas linhas violam", e zero é
  aprovado.
- (−) O ETL ficou um pouco mais lento: 10 consultas a mais. Medido: 0,08 s do
  total.
- (−) Regras que dependem da gold só barram depois de montá-la.

---

## Histórico

| Data | Mudança |
|---|---|
| 13/10/2026 | Versão inicial, ADR-001 a ADR-007 |
| 16/11/2026 | Acrescentadas ADR-008, ADR-009 e ADR-010. Notas de situação na ADR-003 (gatilho resolvido pela ADR-009), ADR-004 (autenticação provisória em uso), ADR-006 (o jogo ainda não lê o catálogo) e ADR-007 (controle de lote). Este documento substitui o `bi/docs/adr-complemento.md`, que foi removido |
| 16/11/2026 | **O back-end passou a existir e três ADRs mudaram de estado.** ADR-002 vai a **Aceito**: PD-011 resolvida (FastAPI), mas em **dois serviços** sobre o mesmo banco, com o segredo do JWT compartilhado como consequência registrada. ADR-004 ganha o que foi implementado de fato — bcrypt custo 12, JWT HS256 de 8 h — e o aviso de que a troca de PBKDF2 não é retroativa. ADR-007 ganha o estado do servidor (pronto e testado) separado do estado do jogo (não começou) |
| 18/11/2026 | **ADR-010 ganha a `REC-003`** e o gate passa de 10 para 11 regras. A porta da gold tinha um ponto cego: todas as suas regras contavam violações, e numa gold vazia nenhuma viola nada — uma gold zerada por `catalog_version` divergente passou pelo gate e foi publicada. A nova regra reconcilia silver contra gold e conta o que falta |
| 19/11/2026 | **Spark e Airflow passam a ser exigidos como produto, e foram adotados.** A ADR-008 ganha a revisão com a medição dos dois motores lado a lado (mesmo resultado, 54x o tempo) e a ADR-009 ganha o DAG como terceiro gatilho. O `CHECK` de `bronze.etl_execucao.disparo` passou a aceitar `'airflow'` — sem isso o DAG morria na primeira linha, e foi assim que se descobriu, rodando |
