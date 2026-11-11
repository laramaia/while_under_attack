# Conformidade com a Arquitetura Corporativa de Dados — UNIVAG

**Status:** Proposto · **Data:** 10/11/2026 · **Responsável:** fatia de BI (Grupo 4)

Este documento responde a uma pergunta só: **o *while under_attack* atende à
arquitetura corporativa de dados exigida?** Vai caixa por caixa do diagrama de
referência, diz o que o projeto faz hoje, o que mudou para atender e o que foi
deliberadamente não adotado — com a justificativa, porque é isso que a banca
cobra.

---

## 1. A leitura que o documento adota

O diagrama de referência nomeia **produtos** (Airflow, Spark, Delta Lake, Power
BI, Entra ID) e **capacidades** (orquestrar, transformar, versionar, barrar
dado ruim, controlar acesso por perfil). Produtos e capacidades não são a mesma
coisa, e tratá-los como se fossem levaria este projeto a um lugar ruim.

> **A decisão deste documento: o projeto adota a arquitetura por capacidade, e
> justifica produto a produto onde escolheu outro caminho.** Está registrada na
> ADR-008.

Três fatos sustentam essa escolha, e os três são verificáveis:

1. **O volume é de ~10 jogadores.** A última execução completa processou 527
   eventos em **0,08 segundo**. Spark existe para paralelizar trabalho que não
   cabe numa máquina; aqui o trabalho cabe num piscar de olhos.
2. **A `ADR-003` já havia rejeitado "plataforma de dados dedicada" por
   desproporção**, antes deste diagrama chegar. Mudar agora sem fato novo seria
   trocar uma decisão argumentada por uma decisão de obediência.
3. **O diagrama é de arquitetura corporativa.** Ele descreve o alvo de uma
   instituição com SQL Server, Moodle e múltiplas equipes. Um MVP acadêmico que
   o copiasse literalmente gastaria todo o semestre montando infraestrutura e
   não entregaria indicador nenhum.

O que **não** é aceitável é usar a desproporção como desculpa para não ter a
capacidade. Era aí que o projeto estava falhando, e é isso que mudou.

---

## 2. Mapa caixa por caixa

Legenda: ✅ atendido · 🔧 atendido por mudança feita agora · ⚠️ atendido por
equivalente, com justificativa · ⬜ fora do escopo do MVP, documentado

### Ingestão

| Caixa do diagrama | No projeto | |
|---|---|---|
| **FONTES** — SQL Server, API AVA (Moodle), arquivos CSV/XLSX | A fonte é **própria**: os eventos do jogo (`Contrato de Eventos`, 5 tipos). O objetivo **O5** da disciplina exigia construir o pipeline sobre fonte própria, não sobre dataset pronto | ⚠️ |
| **Conectores Python** | O jogo **empurra** os eventos por HTTP; não há extração a puxar de fonte externa | ⚠️ |
| **Full · Watermark · Change Tracking · CDC** | Não se aplica: não há tabela de origem para comparar. O equivalente de "só o que é novo" é a idempotência por `event_id` (RN-015) | ⚠️ |
| **Paginação e checkpoint** | `ADR-007`: fila local no jogo, envio em lote, evento sai da fila só após confirmação. É o checkpoint, do lado de quem envia | ✅ |
| **Tabela de controle (lote · watermark · contagens)** | **Criada agora**: `bronze.ingestao_lote`, com `eventos_recebidos / gravados / ignorados / rejeitados` por lote, e `bronze.eventos.lote_id` ligando cada evento ao lote que o trouxe | 🔧 |

### Lakehouse

| Caixa do diagrama | No projeto | |
|---|---|---|
| **DELTA LAKE** — storage objeto, Parquet, log de transações, catálogo | **PostgreSQL com três schemas** (`ADR-003`). O que o Delta entrega e o projeto precisa — transação, imutabilidade, histórico — o Postgres entrega nativamente. Ver §4 | ⚠️ |
| **APACHE SPARK (PySpark)** | **SQL no Postgres + Python**. A transformação é a mesma; o motor é proporcional ao volume. Ver §4 | ⚠️ |
| **BRONZE** — dados brutos + metadados de lote, append-only | `bronze.eventos`: append-only garantido por **gatilho** que recusa `update` e `delete` (RN-016), `payload` cru em `jsonb`, `unique(event_id)` (RN-015). Metadados de lote **adicionados agora** (`lote_id`) | 🔧 |
| **SILVER** — tratados e integrados, pseudonimizados | `silver.sessao`, `silver.tentativa`, `silver.programa_bloco` reconstruídos e tipados. Pseudonimização: ver §5.1 | ✅ |
| **Gate de qualidade** (losango: *"só dado aprovado pela qualidade chega à Gold"*) | **Era a maior lacuna do projeto e foi fechada agora.** Ver §3.1 | 🔧 |
| **GOLD** — star schema, métricas certificadas | Modelo estrela com duas tabelas de fato e cinco dimensões. "Certificada" passou a ter significado verificável: a gold só é publicada se as 10 regras passarem | 🔧 |

### Orquestração

| Caixa do diagrama | No projeto | |
|---|---|---|
| **APACHE AIRFLOW** — orquestra ingestão, transformação, qualidade, publicação, refresh e alertas | **Agendador próprio** (`etl agendar`), a cada 15 min, mais o gatilho manual. Decisão apresentada em 26/10/2026, nunca implementada — **implementada agora** e registrada na ADR-009. Ver §3.2 | 🔧 |
| **Dispara extrações** | O agendador chama uma função (`pipeline.executar`), não um comando. Trocar o gatilho por cron, Scheduled Job do Render ou um DAG do Airflow não mexe em nenhuma linha do ETL | ✅ |
| **Alertas** | **Implementado agora**: `alertas.py`, com stderr + coluna `erro` no banco + webhook opcional. Ver §3.3 | 🔧 |

### Consumo

| Caixa do diagrama | No projeto | |
|---|---|---|
| **Modelo semântico Power BI** | **Dashboard web próprio** (`ADR-001`). Não é desvio não autorizado: a `PD-001` foi **resolvida em 13/10/2026** pelo professor da disciplina — *"Power BI não é obrigatório; Python ou outra ferramenta são aceitos"* | ⚠️ |
| **RLS / OLS por perfil** | `exigir_acesso_a()` e `exigir_professor()` na API: jogador vê só o próprio (RN-004), professor vê todos (RN-005). A `ADR-001` escolheu o dashboard próprio **justamente** para essa regra viver num lugar só — no Power BI exigiria licença paga por quem visualiza | ✅ |
| **Relatórios e painéis** | Duas telas: Jogador (O3) e Professor (O4) | ✅ |
| **API analítica (somente leitura)** | `wua_bi.api`: só `SELECT`. Os indicadores são calculados no ETL e gravados na gold | ✅ |
| **Inteligência Artificial** — ML, RAG, agentes, só dados certificados, APIs com escopo | **Fora do escopo do MVP.** Ver §6 | ⬜ |

---

## 3. O que mudou no projeto

Cinco mudanças, todas implementadas e verificadas em 10/11/2026.

### 3.1. Gate de qualidade entre silver e gold (ADR-010)

**O problema.** As oito conferências existiam, mas rodavam **depois** do ETL,
num comando separado (`etl conferir`). Elas diziam que a gold estava errada
**sem impedir que a gold errada fosse publicada**. O diagrama pede um losango
que barra; o projeto tinha um aviso que reclama.

**O que foi feito.** As regras viraram duas portas dentro da execução:

```
silver → PORTA DA SILVER → gold → PORTA DA GOLD → commit
```

As duas rodam **na mesma transação** do ETL. Reprovou, `rollback`: nada é
publicado e a gold continua sendo a última versão aprovada. Nunca existe uma
gold "meio certa" no ar.

Por que duas portas e não uma: parte das regras lê tabelas da gold e só pode
rodar depois de montá-la; parte lê bronze e silver e pode barrar antes. Cada
regra fica na porta mais cedo em que consegue rodar.

**Onde:** `src/wua_bi/etl/qualidade.py` e `pipeline.py`.

**As regras passaram de 8 para 10.** As duas novas são de **reconciliação**,
que é uma palavra do próprio diagrama:

| Regra | O que confere |
|---|---|
| `REC-001` | Todo EV-04 da bronze virou tentativa na silver **ou** foi para a quarentena. Se a conta não fecha, a silver perdeu evento em silêncio |
| `REC-002` | O que os lotes de ingestão dizem ter gravado bate com o que está na bronze |

**A prova de que barra.** Foi injetado na bronze um programa com um bloco fora
do catálogo e o ETL foi executado:

```
silver: sessoes=43, tentativas=191, blocos=683, rejeitados=0
QUALIDADE REPROVOU na porta da silver. A gold NAO foi publicada.
  [FALHA] CAT-001 nenhum bloco do programa ficou sem categoria (1 divergencias)

gold.fato_tentativa: 190   ← inalterada
silver.tentativa:    190   ← voltou atrás
```

A silver chegou a montar 191 tentativas dentro da transação, a regra barrou e
tudo voltou. Código de saída `1`, erro gravado em `bronze.etl_execucao.erro`,
alerta disparado. **Este é o roteiro de demonstração do gate na banca.**

### 3.2. Orquestração agendada (ADR-009)

`python -m wua_bi.etl agendar` roda o ciclo completo a cada 15 minutos. O
intervalo é o que a equipe decidiu na apresentação de 26/10/2026 e que até
hoje não tinha virado nem código nem documento — **as duas dívidas estão
pagas**.

Três comportamentos que um agendador honesto precisa ter, e que este tem:
roda uma vez assim que sobe (quem liga quer ver o dado agora), uma falha não
derruba o agendador (o ciclo seguinte tenta de novo, e como o ETL reconstrói
tudo a partir da bronze a retentativa é só rodar outra vez), e `Ctrl+C`
encerra limpo.

```bash
python -m wua_bi.etl agendar                 # a cada 15 min
python -m wua_bi.etl agendar --intervalo 5   # a cada 5 min
python -m wua_bi.etl agendar --vezes 3       # 3 ciclos e sai (teste)
```

### 3.3. Alerta de falha

`src/wua_bi/alertas.py`. Três destinos, do mais barato ao mais caro: **stderr**
sempre, **`bronze.etl_execucao.erro`** sempre (fica no banco, então a API
consegue dizer "a última execução falhou" sem ler arquivo), e **um POST para
`WUA_ALERTA_WEBHOOK`** se a variável estiver configurada.

O terceiro é opcional de propósito: a equipe não precisa contratar nada para o
aviso funcionar, e quem quiser ligar no Discord ou no Slack da turma cola a URL
no `.env`. Nenhuma dependência nova — `urllib` é da biblioteca padrão.

### 3.4. Controle de ingestão por lote

`bronze.ingestao_lote` + `bronze.eventos.lote_id`. É a caixa *"Tabela de
controle (lote · watermark · contagens)"* do diagrama.

Como o projeto não extrai de fonte externa, o que o lote precisa registrar não
é watermark de leitura, e sim **o que cada POST trouxe e o que foi
aproveitado** — que é o número com que se reconcilia a bronze depois.

**Isto afeta o back-end.** Ver §7.

### 3.5. Observabilidade na API

Quatro endpoints novos. Ver §7.

---

## 4. O que não foi adotado, e por quê

Esta seção é a que a banca vai perguntar. Cada linha tem a alternativa
considerada, a decisão e o custo aceito.

### Delta Lake → PostgreSQL com três schemas

O Delta Lake resolve quatro problemas em cima de arquivos soltos num storage de
objeto: **transação**, **versionamento (time travel)**, **schema enforcement** e
**leitura eficiente em volume**. O projeto não tem arquivos soltos num storage —
tem um banco relacional, onde três desses quatro já vêm de fábrica:

| O que o Delta dá | Como o projeto tem |
|---|---|
| Transação ACID sobre arquivos | O Postgres é ACID. O ETL inteiro roda numa transação |
| Imutabilidade do dado bruto | Gatilho `trg_eventos_imutavel` recusa `update` e `delete` (RN-016) |
| Schema enforcement | Tipos, `check` constraints e chaves estrangeiras na DDL |
| Time travel | **Não tem.** Ver o custo abaixo |
| Leitura paralela em volume | Não necessário: 527 eventos, 0,08 s |

**O custo aceito:** não há *time travel* — não dá para consultar "como estava a
gold na terça". Para este projeto isso quase não pesa, porque **a gold é
inteiramente reconstruível a partir da bronze**, que é imutável: para voltar no
tempo, basta rodar o ETL com o catálogo daquela versão. A `catalog_version` na
chave natural da `dim_fase` (`ADR-006`, `RS-03`) é o que preserva a comparação
histórica, que era o motivo real de querer time travel aqui.

### Apache Spark → SQL no Postgres + Python

Spark existe para dividir trabalho que não cabe numa máquina. O trabalho aqui
cabe em 0,08 segundo. Rodar PySpark single-node, como o próprio diagrama admite
para o piloto, adicionaria uma JVM, um `spark-submit` e uma dependência pesada
para produzir o mesmo resultado mais devagar.

**O custo aceito:** se o projeto crescer para milhares de jogadores, a
reconstrução integral deixa de ser gratuita e vira carga incremental. Essa é a
resposta honesta sobre o limite da escolha, e já estava registrada antes deste
documento.

### Power BI → dashboard web próprio

Já decidido na `ADR-001` e **autorizado pelo professor da disciplina** na
`PD-001` (13/10/2026). O motivo não foi preferência técnica: garantir no Power
BI que cada jogador veja só os próprios dados exige segurança por linha, que
**depende de licença paga para quem visualiza**. "Publicar na Web" gera link
público e não serve para dado individual.

### Entra ID / AD → autenticação própria com contas pré-criadas

`ADR-004`. Não há diretório institucional disponível para o projeto, e o MVP
tem ~10 contas criadas pela equipe, sem autocadastro. O RBAC do diagrama existe
em escala proporcional: dois papéis (`jogador`, `professor`), aplicados num
lugar só. Ver §5.2.

---

## 5. Governança transversal

A faixa inferior do diagrama tem seis caixas. Esta seção responde cada uma.

### 5.1. Segurança e LGPD — classificação e pseudonimização

**Classificação dos dados pessoais do projeto.** O projeto coleta pouquíssimo
dado pessoal, e isso é decisão registrada, não acaso (`ADR-004`: *"coleta
mínima de dados pessoais"*).

| Dado | Onde | Classificação | Tratamento |
|---|---|---|---|
| `usuario` | `app.jogador` | Identificador interno | Criado pela equipe, sem relação obrigatória com nome real |
| `senha_hash` | `app.jogador` | **Credencial** | Hash, nunca texto puro (`ADR-004`). Hoje PBKDF2 provisório; a ADR pede Argon2 ou bcrypt |
| `nome_exibicao` | `app.jogador` → `gold.dim_jogador` | **Dado pessoal** | Primeiro nome ou apelido, **nunca o nome completo** (RN-003) |
| `jogador_id` | todas as camadas | Pseudônimo | É o identificador que atravessa bronze, silver e gold |
| E-mail | — | — | **Não é coletado** (RN-002). Não existe campo |
| Telemetria de jogo | `bronze.eventos` | Dado de uso | Vinculado ao `jogador_id`, não ao nome |

**A pseudonimização que o diagrama pede na silver já existe por construção:**
da bronze para baixo, **nenhuma tabela carrega nome** — o vínculo é sempre
`jogador_id`. O nome aparece uma única vez, na `gold.dim_jogador`, porque o
professor precisa saber de quem é a linha (RN-005). Se a equipe quiser endurecer
isso, o ponto único de corte é `SQL_DIM_JOGADOR` em `etl/gold.py`.

**Pendências de LGPD que este documento não resolve:**

- **`PD-012`** — termo de consentimento dos responsáveis se algum testador for
  menor de idade. Está aberta e é de **impacto alto**. Como o jogo é educativo e
  o público natural são estudantes, **é provável que se aplique.**
- **`RN-003` ainda está como "Proposta"**, e é a regra que impede o nome
  completo de entrar. Envolvendo dado pessoal, vale confirmá-la antes de criar
  as contas reais.
- **Base legal e retenção** não estão definidas: ninguém escreveu por quanto
  tempo os eventos ficam guardados nem com que fundamento são coletados.

### 5.2. Identidade e segredos — RBAC e cofre

| Caixa | No projeto |
|---|---|
| Entra ID / AD | Não disponível. Contas pré-criadas (`ADR-004`), ver §4 |
| **RBAC** | Dois papéis, `jogador` e `professor`, na coluna `app.jogador.perfil`. Aplicados em `exigir_acesso_a()` e `exigir_professor()` — **um lugar só**, que é o argumento da `ADR-001` |
| **Cofre de segredos** | Hoje: `WUA_DB_URL` e `WUA_SEGREDO` em `.env`, fora do Git (`.gitignore`). Na publicação, viram variáveis de ambiente no painel do Render, que é o cofre proporcional ao projeto |

**Alerta registrado:** o `WUA_SEGREDO` do token provisório **não pode ir para o
repositório**. O `.gitignore` já cobre, e foi conferido.

### 5.3. Catálogo e linhagem

O diagrama pede *metastore* e *OpenLineage*. O projeto tem o equivalente em
escala, e em dois lugares:

**Catálogo de dados.** O `catalogo-fases.json` é a **fonte única** sobre o que é
cada fase, conceito e bloco (`ADR-006`), versionado em Git e carregado no banco
pelo ETL. Todo evento carrega a `catalog_version` que valia quando aconteceu.
Mais o `02-Glossario-do-Dominio`, que é o único lugar onde os termos são
definidos.

**Linhagem.** Rastreável de ponta a ponta, por construção:

```
bronze.eventos.event_id
  └─ silver.tentativa        (via payload->>'tentativa_id', EV-04 + EV-05)
      ├─ silver.programa_bloco   (uma linha por instância de bloco)
      └─ gold.fato_tentativa     (uma linha por tentativa)
          └─ gold.fato_progresso_fase  (jogador × fase)
```

Cada linha da gold volta até o evento que a originou, porque **nada é agregado
sem guardar a chave**. E `bronze.ingestao_lote.lote_id` estende a linhagem um
passo acima: dá para dizer de qual POST veio cada evento.

**O que falta de verdade:** nada disso está num formato que uma ferramenta leia
(OpenLineage é um padrão JSON). Para o tamanho do projeto, a linhagem escrita
acima mais os comentários do código citando as regras pelo número cumprem a
função. Se a disciplina exigir o formato, é trabalho de um dia.

### 5.4. Qualidade de dados — regras, quarentena, reconciliação

As três palavras da caixa, e onde cada uma está:

| | Onde |
|---|---|
| **Regras** | 10 regras em `etl/qualidade.py`, cada uma citando a RN que verifica |
| **Quarentena** | `silver.evento_rejeitado` — EV-05 sem EV-04, fase fora do catálogo, `tentativa_id` repetido. **Nada é apagado da bronze**; o problema fica registrado com o motivo |
| **Reconciliação** | `REC-001` e `REC-002`, criadas agora (§3.1) |

### 5.5. Observabilidade — métricas, logs, alertas

| | Onde |
|---|---|
| **Métricas** | `bronze.etl_execucao`: etapa, gatilho, início, fim, linhas gravadas. Duração real, com `clock_timestamp()` |
| **Logs** | Saída do ETL no stdout; erro persistido na coluna `erro` |
| **Alertas** | `alertas.py` (§3.3) |
| **Exposição** | `GET /api/execucoes`, `GET /api/qualidade`, `GET /api/saude` (§7) |

> **Detalhe que vale saber explicar:** `bronze.etl_execucao` usa
> `clock_timestamp()` e não `now()`. No Postgres, `now()` devolve a hora de
> **início da transação** — e como o ETL inteiro roda numa transação só, com
> `now()` todas as etapas ficariam com o mesmo horário e a duração de todas
> daria zero. Era uma métrica que mentia. Já `bronze.etl_qualidade` usa `now()`
> **de propósito**, porque as regras de uma execução precisam compartilhar o
> horário para serem lidas como um boletim só.

### 5.6. Continuidade — backup, DR, dev/hml/prod

**Esta é a caixa mais fraca do projeto, e o documento não a esconde.**

| | Situação |
|---|---|
| **Backup** | Não configurado. O Neon (plano gratuito) mantém histórico de restauração de 7 dias, o que serve ao MVP — mas **ninguém testou restaurar** |
| **DR** | Não se aplica na escala. O que protege o projeto é outra coisa: **a bronze é imutável e a gold é inteiramente reconstruível a partir dela.** Perder silver e gold custa um `etl rodar` |
| **dev / hml / prod** | Hoje existe **um ambiente só**. Há a separação que de fato importa para não mentir no gráfico — a coluna `origem` (`jogo` / `sintetico`) e a faixa amarela no dashboard (`RS-02`) — mas isso é separação de *dado*, não de *ambiente* |
| **Código** | Versionado em Git desde 06/11/2026 |

**Recomendação:** quando publicar (Neon + Render), criar **dois bancos no mesmo
projeto Neon** — `wua_dev` e `wua_prod` — mudando só a `WUA_DB_URL`. Custo zero,
e fecha a caixa com honestidade. A `PD-005` (onde hospedar) continua aberta e
é pré-requisito.

---

## 6. Inteligência Artificial — fora do escopo, e por quê

O diagrama prevê ML, RAG e agentes consumindo **somente dados certificados**,
por **APIs com escopo**, e grifa que *"IA nunca acessa as fontes diretamente"*.

**Não está no escopo do MVP** e não entra agora: o projeto tem ~10 jogadores e
190 tentativas. Qualquer modelo treinado nisso aprenderia ruído, e apresentar
isso como inteligência seria desonesto com a banca.

O que vale registrar é que **a arquitetura não impede, e as duas pré-condições
do diagrama já estão satisfeitas**:

- *"somente dados certificados"* — a gold só é publicada se passar pelo gate
  (§3.1). Uma IA que leia a gold está lendo dado certificado por construção.
- *"acesso via APIs com escopo"* / *"IA nunca acessa as fontes diretamente"* —
  a API de leitura já é a única porta, e já aplica RN-004 e RN-005. Um
  consumidor de IA entraria por ela, com um perfil, e herdaria as permissões.

**Candidato natural, se um dia houver dado:** prever quais jogadores vão travar
numa fase antes de travarem, usando `tentativas_ate_vencer`, `eficiencia_codigo`
e `aplicou_conceito` das fases anteriores. É um problema de classificação
simples e o dado já está modelado para ele.

---

## 7. O que mudou na API — e o que a documentação precisa dizer

**Sim, a documentação da API muda.** Em três frentes.

### 7.1. Endpoints novos (quatro)

O FastAPI gera o OpenAPI sozinho, então `/docs` já mostra todos. O que foi
feito à mão: as rotas ganharam **tags** (`acesso`, `jogador`, `professor`,
`operacao`) e descrições, para a documentação gerada ficar legível como
contrato — que é o que a `ADR-002` promete.

| Endpoint | Perfil | Para que serve |
|---|---|---|
| `GET /api/saude` | **sem token** | Liveness. Devolve só `{"status":"ok","banco":"ok"}`, **nenhum dado de ninguém**. Existe porque o plano gratuito do Render hiberna e precisa de um caminho barato para ser acordado antes da apresentação, e porque um alerta externo precisa de algo para consultar sem credencial |
| `GET /api/qualidade` | professor | Boletim do último gate: uma linha por regra, com a porta e as divergências. É o resultado que autorizou a gold que está no ar |
| `GET /api/execucoes` | professor | Últimas execuções do ETL: etapa, gatilho (`manual`/`agendado`), duração e erro |
| `GET /api/ingestao` | professor | Contagens dos lotes: recebidos, gravados, ignorados, rejeitados |

### 7.2. `GET /api/procedencia` ganhou campos

Não quebra nada: só acrescenta.

| Campo novo | O que diz |
|---|---|
| `gold_certificada` | se a gold no ar passou pelo gate |
| `regras_qualidade` | quantas regras rodaram |
| `qualidade_verificada_em` | quando |
| `falha_pendente` | a última falha ainda não superada, ou `null` |

**Oportunidade para o dashboard, ainda não feita:** hoje a faixa amarela avisa
"dado sintético". Com `falha_pendente` dá para avisar também *"a última
atualização falhou às 14:32; estes números podem estar velhos"* — que é o que
mais importa quando o ETL roda sozinho e ninguém está olhando o terminal.

### 7.3. O contrato com o back-end muda — a Lara precisa saber

Esta é a parte que **não é só do BI**.

**O que mudou:** `bronze.eventos` ganhou a coluna `lote_id`, e existe a tabela
`bronze.ingestao_lote`. **Quem escreve nelas é o endpoint de ingestão, ou seja,
o back-end.**

**É compatível com o que já estava combinado.** `lote_id` é **anulável** de
propósito: uma ingestão que não informe o lote continua funcionando exatamente
como antes. A coluna é rastreabilidade, não obrigação — o guia do back-end não
fica inválido.

**O que o `POST /api/eventos` deveria passar a fazer:**

1. Abrir uma linha em `bronze.ingestao_lote` com `eventos_recebidos` = tamanho
   do lote e o `jogador_id` do token.
2. Gravar cada evento com esse `lote_id`.
3. Fechar o lote com as contagens finais.

E aqui está o detalhe que economiza trabalho dela: **as três contagens são
exatamente o que a resposta `207` do guia já precisava devolver.**

```json
{ "gravados": 11, "ignorados": 2, "rejeitados": [ ... ] }
```

`gravados` = `eventos_gravados`, `ignorados` = `eventos_ignorados` (os
duplicados da RN-015), `rejeitados` = `eventos_rejeitados`. O back-end já ia
contar isso; agora também grava.

**Há uma implementação de referência para copiar:** o gerador sintético
(`src/wua_bi/gerador.py`) já abre lote, grava com `lote_id` e fecha com as
contagens. São ~25 linhas e o padrão `on conflict (event_id) do nothing` para
contar duplicados está lá.

**E há um motivo para ela querer isso, não só uma obrigação:** com o lote
registrado, quando um número no dashboard parecer errado dá para perguntar *de
qual POST veio esse evento* — e a regra `REC-002` avisa sozinha se as contagens
do back-end não baterem com o que está na bronze.

---

## 8. O que ainda depende da equipe

Nenhum destes é código; todos são decisão.

| | O que falta | Quem decide |
|---|---|---|
| 1 | **Confirmar a leitura do §1** — se o professor exige os *produtos* (Airflow, Spark, Delta) e não as capacidades, o escopo muda e esta conversa precisa acontecer **antes** de qualquer outra coisa | professor da disciplina |
| 2 | **`PD-012`** — termo de consentimento para menores de idade. Impacto alto e provavelmente se aplica | equipe |
| 3 | **`RN-003`** sair de "Proposta" — é a regra que impede nome completo. Envolve dado pessoal | equipe |
| 4 | **`PD-005`** — onde hospedar. Pré-requisito para separar dev de prod (§5.6) | equipe |
| 5 | **`PD-013`** — identificadores de bloco. Continua sendo a única pendência que **quebra** o sistema quando o dado real chegar | equipe do jogo + BI |
| 6 | **Base legal e retenção** dos eventos — por quanto tempo e com que fundamento | equipe |
| 7 | **Testar uma restauração de backup** no Neon, uma vez, antes da banca | BI |

---

## Anexo — como demonstrar cada caixa na banca

| Pergunta provável | Comando ou tela |
|---|---|
| "Cadê a Medallion?" | `\dn` no psql: schemas `bronze`, `silver`, `gold` |
| "A bronze é mesmo imutável?" | `delete from bronze.eventos limit 1` → erro citando a RN-016 |
| "Como vocês garantem qualidade?" | `python -m wua_bi.etl conferir` → boletim das 10 regras |
| "E se o dado estiver ruim?" | O teste do §3.1: injetar bloco inválido, rodar, mostrar a gold intacta |
| "Quem dispara o ETL?" | `python -m wua_bi.etl agendar --vezes 2 --intervalo 1` |
| "E se falhar de madrugada?" | `select etapa, erro from bronze.etl_execucao where erro is not null` |
| "Onde está o controle de acesso?" | `auth_provisoria.py` → `exigir_acesso_a` / `exigir_professor`, e entrar como jogador tentando ver outro |
| "Qual a linhagem deste número?" | §5.3, descendo do `event_id` até a `fato_progresso_fase` |
| "Por que não Spark?" | §4, com o tempo de execução real: 0,08 s |
