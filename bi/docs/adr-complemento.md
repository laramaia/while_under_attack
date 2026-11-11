# ADRs novas — ADR-008 a ADR-010

**Escritas em 10/11/2026** para entrar no `04-Registro-de-Decisoes-ADR.docx` da
equipe. Seguem o formato das ADRs existentes: contexto, alternativas
consideradas, decisão e consequências.

A **ADR-009** não é uma decisão nova: ela registra a decisão que a equipe já
tomou na apresentação de 26/10/2026 e que nunca virou documento. A `ADR-003`
tinha deixado o gatilho do ETL explicitamente em aberto.

---

## Resumo para a tabela do documento

| ID | Decisão | Status |
|---|---|---|
| ADR-008 | Conformidade com a arquitetura corporativa por capacidade, não por produto | Proposto |
| ADR-009 | Gatilho do ETL: agendado a cada 15 minutos, mais execução manual | Proposto |
| ADR-010 | Gate de qualidade entre as camadas, dentro da transação do ETL | Proposto |

---

## ADR-008 — Conformidade com a arquitetura corporativa por capacidade, não por produto

**Status:** Proposto
**Data:** 10/11/2026

### Contexto

A disciplina exige que todos os projetos atendam à Arquitetura Corporativa de
Dados da instituição: Lakehouse Medallion com Delta Lake sobre storage de
objeto, transformação em Apache Spark (PySpark), orquestração em Apache
Airflow, consumo em modelo semântico Power BI com RLS/OLS, uma camada de IA e
uma faixa de governança transversal.

O projeto já havia decidido, na `ADR-003`, implementar a Medallion em schemas
do PostgreSQL, rejeitando explicitamente "plataforma de dados dedicada" por
desproporção ao tamanho do MVP (~10 jogadores). A `ADR-001` já havia rejeitado
o Power BI por custo de licença para segurança por linha, com a `PD-001`
confirmando em 13/10/2026 que o professor da disciplina não o exige.

O diagrama de referência nomeia ao mesmo tempo **produtos** (Airflow, Spark,
Delta Lake, Power BI, Entra ID) e **capacidades** (orquestrar o ciclo, separar
camadas, barrar dado ruim antes da publicação, controlar acesso por perfil,
observar execuções, governar dado pessoal). Tratar as duas coisas como
equivalentes levaria a decisões opostas.

Fato que pesa na decisão: a última execução completa do ETL processou 527
eventos em **0,08 segundo**.

### Alternativas consideradas

1. **Adotar os produtos literalmente** — reescrever o ETL em PySpark, migrar as
   camadas para Delta Lake sobre storage de objeto, subir Airflow e reconstruir
   os dashboards no Power BI.
   Custo: o semestre inteiro em infraestrutura, provavelmente sem entregar
   indicador nenhum. Contraria a `ADR-001` (licença paga para RLS) e a
   `ADR-003`. Em Spark single-node, produz o mesmo resultado mais devagar.
2. **Ignorar o diagrama** e seguir como estava, alegando que é um MVP
   acadêmico. Deixaria o projeto sem gate de qualidade, sem orquestração e sem
   alerta — lacunas que são **reais**, e não questão de porte.
3. **Adotar a arquitetura por capacidade**: implementar toda capacidade que o
   diagrama exige e que o projeto não tinha; manter as escolhas de produto já
   argumentadas, documentando cada equivalência e o custo aceito.

### Decisão

Alternativa 3.

Cada caixa do diagrama recebe uma resposta explícita — atendida, atendida por
equivalente com justificativa, ou fora do escopo com motivo — no documento
`bi/docs/arquitetura-de-referencia.md`.

As capacidades que faltavam foram implementadas: gate de qualidade (`ADR-010`),
orquestração agendada (`ADR-009`), alerta de falha, controle de ingestão por
lote e endpoints de observabilidade.

As substituições de produto mantidas, todas já argumentadas:

| Produto do diagrama | No projeto | Razão |
|---|---|---|
| Delta Lake | PostgreSQL, três schemas | Transação, imutabilidade e schema enforcement são nativos. `ADR-003` |
| Apache Spark | SQL + Python | 527 eventos em 0,08 s |
| Apache Airflow | agendador próprio | `ADR-009` |
| Power BI | dashboard web próprio | Licença paga para RLS. `ADR-001`, `PD-001` |
| Entra ID / AD | contas pré-criadas | Sem diretório disponível. `ADR-004` |

### Consequências

- (+) O projeto passa a ter as capacidades que faltavam — gate, orquestração,
  alerta e observabilidade — que são lacunas reais, independentes de porte.
- (+) Cada desvio fica documentado com alternativa, decisão e custo aceito, que
  é o formato que a banca cobra.
- (+) As decisões anteriores (`ADR-001`, `ADR-003`, `ADR-004`) continuam
  válidas, em vez de serem substituídas por obediência sem fato novo.
- (−) **Não há *time travel*.** Não dá para consultar como estava a gold numa
  data passada. Mitigado por a gold ser inteiramente reconstruível a partir da
  bronze imutável, e pela `catalog_version` na chave da `dim_fase` (`RS-03`).
- (−) **A reconstrução integral deixa de ser gratuita em escala.** Com milhares
  de jogadores, viraria carga incremental.
- (−) **Depende de o professor concordar com a leitura.** Se a exigência for
  dos produtos, e não das capacidades, esta ADR precisa ser substituída.

---

## ADR-009 — Gatilho do ETL: agendado a cada 15 minutos, mais execução manual

**Status:** Proposto
**Data:** 10/11/2026 (decisão tomada em 26/10/2026)

### Contexto

A `ADR-003` registrou como consequência em aberto: *"O ETL precisa de um
gatilho (execução manual, agendada ou após a ingestão). A decisão fica para o
documento de arquitetura."* Esse documento não existe até hoje.

A decisão **foi tomada e apresentada publicamente** na apresentação "Plano de
Orquestração de Dados", em 26/10/2026, mas não virou ADR escrita nem código: o
ETL continuava apenas manual.

A arquitetura corporativa de referência exige um orquestrador (Airflow) que
dispare o ciclo completo: ingestão, transformação, qualidade, publicação e
alertas.

### Alternativas consideradas

1. **Manual apenas** — um comando rodado por uma pessoa. Simples de demonstrar,
   mas o dado só atualiza quando alguém lembra, e não atende ao diagrama.
2. **Agendado a cada 15 minutos**, mantendo o manual para demonstração.
3. **Por evento**, disparando o ETL a cada lote recebido. Dado quase em tempo
   real, mas acopla o ETL à ingestão e cria mais peças para falhar.
4. **Apache Airflow**, como o diagrama nomeia.

### Decisão

Alternativa 2, implementada em `src/wua_bi/etl/orquestrador.py`.

O argumento é proporcionalidade: ~10 jogadores, execução em segundos, e 15
minutos de atraso não mudam nenhuma decisão que o professor vá tomar olhando a
tela. O custo de errar é baixo, porque **trocar de gatilho não mexe no ETL**.

Sobre a alternativa 4: o Airflow resolve dependência entre tarefas,
paralelismo, backfill e retentativa seletiva. Este ETL tem **uma** tarefa,
idempotente, que roda em 0,08 segundo. O que sobraria do Airflow seria o
relógio — e o custo seria subir um scheduler, um webserver e um banco de
metadados para operá-lo.

**O caminho de volta está aberto e é curto:** `pipeline.executar()` é uma
função. Migrar para Airflow é escrever um DAG de uma tarefa que a chama.
Cron do sistema ou Scheduled Job do Render funcionam do mesmo jeito.

### Consequências

- (+) O dashboard deixa de depender de alguém lembrar de rodar o ETL.
- (+) A dívida da `ADR-003` fica paga, em documento e em código.
- (+) Nenhuma dependência nova: `signal` e `time` são da biblioteca padrão.
- (+) Uma falha não derruba o agendador; o ciclo seguinte tenta de novo. Como o
  ETL reconstrói tudo a partir da bronze, retentar é só rodar outra vez.
- (−) O agendador é um processo que precisa estar de pé. No Render gratuito,
  que hiberna após 15 minutos sem acesso, isso **não é confiável** — nesse
  cenário, usar um Scheduled Job ou um cron externo.
- (−) Não há backfill seletivo nem execução por intervalo de datas. Não faz
  falta: toda execução reprocessa a história inteira.
- (−) Até 15 minutos de atraso entre o jogador jogar e o número aparecer.

---

## ADR-010 — Gate de qualidade entre as camadas, dentro da transação do ETL

**Status:** Proposto
**Data:** 10/11/2026

### Contexto

O projeto tinha oito conferências que traduziam regras de negócio em consultas
SQL, rodadas pelo comando `python -m wua_bi.etl conferir`.

Elas rodavam **depois** do ETL, como comando separado. Na prática, informavam
que a gold estava errada **sem impedir que a gold errada fosse publicada** —
e, se ninguém rodasse o comando, sem informar nada. Com o ETL passando a rodar
sozinho (`ADR-009`), isso piora: não há mais ninguém olhando a saída.

A arquitetura de referência coloca um losango entre a Silver e a Gold com a
legenda *"só dado aprovado pela qualidade chega à Gold"*, e chama a Gold de
*"métricas certificadas"*. Sem um gate, "certificada" não significa nada
verificável.

### Alternativas consideradas

1. **Manter a conferência depois**, e confiar em alguém rodar e reagir.
2. **Conferir depois e reverter se falhar** — publicar e desfazer. Exige
   guardar a versão anterior e cria uma janela em que a gold errada está no ar.
3. **Gate dentro da transação do ETL**: avaliar as regras antes do `commit` e
   abortar a transação inteira se alguma reprovar.
4. **Gate em ferramenta externa** (Great Expectations, dbt tests). Resolve o
   mesmo problema com mais uma dependência e mais um lugar onde a regra mora.

### Decisão

Alternativa 3, em `src/wua_bi/etl/qualidade.py` e `pipeline.py`.

São **duas portas**, não uma:

```
silver → PORTA DA SILVER → gold → PORTA DA GOLD → commit
```

Cada regra fica na porta mais cedo em que consegue rodar: as que leem bronze e
silver barram antes de montar a gold; as que leem a gold rodam depois dela e
antes do `commit`. As duas portas usam a **mesma conexão** do ETL, e não uma
nova — precisam enxergar o que a transação escreveu e ainda não publicou.

Reprovou: `rollback`. A gold continua sendo a última versão aprovada.

As regras passaram de 8 para 10, com duas de **reconciliação** (`REC-001`,
`REC-002`), que é uma exigência explícita da faixa de qualidade do diagrama.

O comando `conferir` continua existindo, mas mudou de papel: passou a **ler** o
boletim gravado em `bronze.etl_qualidade`, em vez de avaliar as regras de novo
por fora. O que a banca vê nele é exatamente o que autorizou a publicação, e
não uma segunda opinião tirada depois.

### Consequências

- (+) "Métricas certificadas" passa a ser afirmação verificável: a gold no ar
  passou pelas 10 regras.
- (+) **Nunca existe uma gold "meio certa" no ar.** Na pior hipótese, existe
  uma gold velha — e a API avisa, por `falha_pendente`.
- (+) O resultado fica gravado por execução, então dá para ver a qualidade ao
  longo do tempo, e não só agora.
- (+) Demonstrável na banca em um minuto: injetar um bloco fora do catálogo,
  rodar, mostrar a gold intacta.
- (−) **Uma regra mal escrita trava a publicação.** O risco é real e o
  contrapeso é o formato: toda regra devolve um único número, "quantas linhas
  violam", e zero é aprovado.
- (−) O ETL ficou um pouco mais lento: 10 consultas a mais por execução. Medido:
  0,08 s do total.
- (−) Regras que dependem da gold só barram depois de montá-la. É desperdício de
  trabalho numa reprovação, aceito porque a reconstrução custa centésimos de
  segundo.
