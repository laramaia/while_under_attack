# while under_attack: attack()
## Documento de Visão

**Status:** Rascunho · **Última atualização:** 16/11/2026
Termos definidos no [Glossário](02-Glossario-do-Dominio.md).

---

## 1. Problema

O jogo ensina lógica de programação, mas descarta tudo o que acontece durante
as partidas. O jogador sabe apenas se venceu ou morreu: não vê em quais
conceitos trava, se está precisando de menos tentativas com o tempo, nem se o
código que o fez vencer é enxuto ou maior que o necessário. Quem acompanha um
grupo de jogadores também não tem como enxergar em que fases eles param.

---

## 2. Objetivos

| ID | Objetivo |
|---|---|
| O1 | Ensinar lógica de programação com montagem de blocos, em fases de complexidade crescente |
| O2 | Registrar cada tentativa do jogador de forma confiável e rastreável |
| O3 | Devolver ao jogador um diagnóstico do próprio aprendizado |
| O4 | Oferecer ao perfil Professor uma visão consolidada de todos os jogadores |
| O5 | Cumprir o ciclo completo de BI exigido pela disciplina: requisitos, Medallion, ETL, modelo dimensional e dashboard |

---

## 3. Atores

| Ator | Descrição | No MVP |
|---|---|---|
| Jogador | Joga as fases e consulta o próprio diagnóstico | ~10 contas de teste |
| Professor | Perfil com visão geral de todos os jogadores | Usado pela equipe ou pelo professor da disciplina na demonstração |
| Equipe | Cria contas, mantém o catálogo de fases e executa o ETL | Fora do sistema (operação manual) |

---

## 4. Contexto

Projeto de extensão (PEI) que une o jogo do grupo ao trabalho final da
disciplina de Inteligência de Negócios, cujo tema é dashboards.

O jogo existia em GameMaker como quiz de 4 alternativas e está sendo refeito em
Phaser, para celular, com mecânica de blocos inspirada no Scratch e progressão
inspirada em jogos como *The Farmer Was Replaced*. O objetivo de toda fase é
derrotar o inimigo.

> **Atenção ao material de divulgação.** O `storytelling-while-under-attack.pdf`
> descreve a versão **antiga** — quiz de quatro alternativas, dez segundos por
> decisão, venda na Play Store. Isso não é mais o produto. Se o material for
> usado na banca, precisa ser reescrito para a mecânica de blocos, ou a banca
> vai ouvir duas descrições incompatíveis do mesmo jogo.
>
> Importa para o BI: indicadores como *eficiência do código* e *conceito
> aplicado* **não existem** num quiz, onde a única coisa mensurável é acertar
> ou errar.

---

## 5. Visão geral da solução

- **Jogo (Phaser, mobile):** o jogador monta o programa e aperta Play; o jogo
  envia eventos para a API.
- **API (Python):** autentica, aplica as permissões e recebe os eventos. Também
  serve o dashboard.
- **Banco PostgreSQL:** guarda os dados nas camadas bronze, silver e gold.
- **ETL (Python):** transforma bronze → silver → gold, com um **gate de
  qualidade** entre as camadas: a gold só é publicada se as regras passarem
  (ADR-010).
- **Orquestração:** o ETL roda **agendado a cada 15 minutos**, com execução
  manual mantida para demonstração (ADR-009). Falha gera aviso.
- **Dashboard web:** visão do jogador e visão do professor, com o mesmo login
  do jogo.

A fronteira entre o back-end e o BI é **o banco, não uma biblioteca**: o
back-end escreve em `bronze.eventos`, o BI só lê. Nenhum dos dois importa o
código do outro.

Detalhes e justificativas: ADR-001 a ADR-010.

### Conformidade com a arquitetura corporativa

A disciplina exige que o projeto atenda à **Arquitetura Corporativa de Dados —
UNIVAG** (Lakehouse Medallion com Delta Lake, Spark, Airflow, Power BI e uma
faixa de governança transversal).

O projeto adota essa arquitetura **por capacidade, não por produto** (ADR-008):
toda capacidade que o diagrama exige está implementada, e cada escolha de
produto diferente está justificada com alternativa, decisão e custo aceito. O
mapa caixa por caixa está em
[`bi/docs/arquitetura-de-referencia.md`](../bi/docs/arquitetura-de-referencia.md).

---

## 6. Escopo do MVP

### Dentro do escopo

- Fases progressivas, cada uma ensinando um conceito.
- Palette e Workspace com arrastar e soltar, com blocos das categorias Evento,
  Ação, Condicional e Repetição.
- Execução com Play, Pause e Stop.
- Login com contas pré-criadas.
- Registro e envio dos eventos de jogo.
- ETL nas três camadas, com gate de qualidade e execução agendada.
- Dashboard com perfis Jogador e Professor.

### Fora do escopo

- Autocadastro e recuperação de senha.
- Escolas, turmas e vínculo entre professor e jogador.
- Ranking, multiplayer e conquistas.
- Power BI (ADR-001).
- Publicação nas lojas de aplicativos (depende de PD-004).
- Edição do catálogo de fases pelo aplicativo.
- **Camada de Inteligência Artificial** (ML, RAG, agentes). A arquitetura de
  referência a prevê, mas com ~10 jogadores e ~150 tentativas qualquer modelo
  aprenderia ruído. As duas pré-condições do diagrama já estão satisfeitas, se
  um dia houver dado: a gold é certificada pelo gate e a API de leitura já
  aplica permissão por perfil.

---

## 7. Benefícios esperados

- O jogador sabe o que revisar antes de seguir.
- A equipe descobre quais fases estão difíceis demais ou mal explicadas, e o
  jogo melhora com dados reais.
- A disciplina recebe um ciclo de BI construído sobre uma fonte própria e real.

---

## 8. Premissas

- Até ~10 jogadores no MVP.
- Os jogadores têm internet na maior parte do tempo; quedas curtas são
  toleradas (ADR-007).
- A equipe cria as contas antes dos testes.

---

## 9. Restrições

- Prazo do semestre (data final: PD-003).
- Equipe pequena, com jogo e back-end sob a mesma pessoa (RS-01).
- Hipótese: orçamento zero para hospedagem e licenças (PD-005).
- A entrega acadêmica precisa demonstrar o ciclo de BI.
- **O jogo ainda não envia eventos.** Em 16/11/2026 não há código de envio no
  repositório, e o endpoint de ingestão não existe. Tudo o que o dashboard
  mostra vem do gerador sintético — ver RS-02.

---

## 10. Visão futura (fora do MVP)

Uso por escolas com turmas, autocadastro e vínculo entre professor e jogador.
Quando isso entrar no escopo, revisar ADR-004, RN-001 a RN-005 e as obrigações
da LGPD para dados de menores.

---

## Histórico

| Data | Mudança |
|---|---|
| 13/10/2026 | Versão inicial |
| 16/11/2026 | Seção 5 atualizada com o gate de qualidade, a orquestração agendada e a fronteira back-end/BI; nova subseção sobre a conformidade com a arquitetura corporativa; IA registrada explicitamente fora do escopo; aviso sobre o material de pitch na seção 4; restrição acrescentada na seção 9 sobre o jogo ainda não enviar eventos |
