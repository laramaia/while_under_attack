# while under_attack: attack()
## Glossário do Domínio

**Status:** Rascunho · **Última atualização:** 16/11/2026

Este é o **único lugar onde os termos são definidos**. O código os usa com
precisão: se um termo mudar aqui, o código muda junto.

---

## Pessoas e acesso

| Termo | Definição |
|---|---|
| **Jogador** | Pessoa com conta de perfil `jogador`. Joga e vê apenas os próprios dados (RN-004). |
| **Professor** | Perfil com acesso de leitura aos dados de todos os jogadores do MVP (RN-005). Não joga. |
| **Conta** | Usuário e senha criados pela equipe, com um perfil (`jogador` ou `professor`). |
| **Sessão** | Período contínuo de uso do jogo por um jogador. Termina em logout ou após inatividade (ver Contrato de Eventos). |

## Fases e conceitos

| Termo | Definição |
|---|---|
| **Fase** | Desafio com um inimigo a derrotar, identificado por `fase_id`. Cada fase ensina um conceito. |
| **Conceito** | Tema de lógica que a fase ensina (ex.: sequência, repetição). Lista oficial: PD-006. |
| **Fase de introdução** | Fase que apresenta um conceito pela primeira vez. |
| **Fase de reforço** | Fase cujo `conceito_id` **já apareceu numa fase anterior**. Existe para reforçar o que a anterior ensinou (RN-020). Não exige campo novo no catálogo: o papel sai do próprio `conceito_id`. |
| **Catálogo de fases** | Arquivo JSON versionado que descreve todas as fases (ADR-006). |
| **Solução de referência** | Programa considerado ideal pela equipe para a fase, registrado no catálogo. |

## Blocos e programas

| Termo | Definição |
|---|---|
| **Tipo de bloco** | Comando disponível na Palette (ex.: Avançar, Repetir 3x). Cada tipo pertence a uma categoria. |
| **Instância de bloco** | Uma cópia de um tipo de bloco colocada no Workspace, com id próprio dentro do programa. |
| **Categoria de bloco** | Agrupamento do bloco por função e cor. São quatro: Evento, Ação, Condicional e Repetição (PD-007, resolvida). Os identificadores técnicos são os do jogo: `event`, `action`, `condition`, `repeat`. |
| **Bloco de evento** | Bloco que inicia a execução de uma pilha — o "hat" da Palette. Hoje existem **dois**: "Ao clicar em play" (`on-flag`) e "Ao iniciar fase" (`on-start`). No catálogo são os que declaram `inicia_pilha`. |
| **Bloco em C** | Bloco que contém outros dentro de si (Repetir, Se). No catálogo declara `tem_corpo`; no contrato de eventos o conteúdo vai em `corpo`. |
| **Condição** | Pergunta de verdadeiro ou falso que um bloco condicional ou de repetição usaria (ex.: inimigo à frente). **Nenhuma existe ainda**: o modelo de blocos do jogo não tem campo de condição. Lista oficial: PD-013. |
| **Parâmetro** | Valor editável de uma instância. **Nenhum existe ainda**: o `repeat` do jogo é "Repetir 3x" fixo. Ver PD-013. |
| **Palette** | Painel onde ficam os blocos disponíveis na fase, de onde o jogador os arrasta para o Workspace. |
| **Workspace** | Área onde o jogador monta de fato o que o guerreiro vai fazer. |
| **Pilha** | Sequência de blocos encaixados verticalmente no Workspace. |
| **Programa** | Conteúdo completo do Workspace no momento do Play. |

## Tentativas e resultados

| Termo | Definição |
|---|---|
| **Tentativa** | Uma execução do programa: começa no Play e termina com um resultado (RN-007). É a unidade de análise do projeto (ADR-005). |
| **Resultado** | Como a tentativa terminou: `vitoria`, `derrota` ou `interrompida`. |
| **Vitória** | A vida do inimigo chegou a zero (RN-010). |
| **Derrota** | A vida do guerreiro chegou a zero, inclusive após o programa acabar (RN-008). |
| **Interrompida** | O jogador encerrou a execução com Stop (RN-009). |
| **Fase concluída** | Fase em que o jogador obteve ao menos uma vitória (RN-011). |

## Indicadores

| Termo | Definição |
|---|---|
| **Tentativas até vencer** | Quantidade de tentativas com resultado `vitoria` ou `derrota` até a primeira vitória, inclusive (RN-012). |
| **Interrompidas até vencer** | Indicador separado. Não soma no de cima, porque o jogador pode ter parado só para ajustar. |
| **Eficiência do código** | Blocos da solução de referência ÷ blocos do programa vencedor (RN-014). `1,0` significa tão enxuto quanto a referência. |
| **Conceito aplicado** | Se o programa da primeira vitória usou o bloco que representa o conceito da fase, ou se o jogador contornou (RN-019). |
| **Causa da derrota** | `programa_curto` (o programa acabou e o inimigo seguiu atacando) ou `parou_em_bloco` (a execução travou num bloco). Vem da RN-008. |

## Dados e pipeline

| Termo | Definição |
|---|---|
| **Evento** | Registro imutável de algo que aconteceu no jogo, enviado à API. |
| **Bronze / Silver / Gold** | Camadas de dados: bruta, tratada e pronta para análise (ADR-003). |
| **Lote de ingestão** | Conjunto de eventos que chegou num mesmo envio (ADR-007). Registrado em `bronze.ingestao_lote` com as contagens de recebidos, gravados, ignorados e rejeitados. |
| **Gate de qualidade** | Conjunto de regras avaliadas **dentro da transação do ETL**, entre as camadas. Se qualquer uma reprovar, a transação volta atrás e a gold não é publicada (ADR-010). |
| **Quarentena** | `silver.evento_rejeitado`: onde fica o evento que a silver não conseguiu aproveitar, com o motivo. Nada é apagado da bronze. |
| **Reconciliação** | Conferência de que as contagens batem entre as camadas — todo EV-04 da bronze virou tentativa ou quarentena, e os lotes batem com a bronze. |
| **Gold certificada** | Gold que passou pelo gate. É o que autoriza chamar os indicadores de confiáveis. |
| **Origem** | `jogo` ou `sintetico`. Separa dado real de dado gerado para desenvolvimento (RS-02). |

---

## Histórico

| Data | Mudança |
|---|---|
| 13/10/2026 | Versão inicial |
| 16/11/2026 | Glossário organizado por tema. Acrescentados: fase de introdução e de reforço, bloco em C, conceito aplicado, causa da derrota, lote de ingestão, gate de qualidade, quarentena, reconciliação, gold certificada e origem. Atualizados **categoria de bloco** (identificadores reais do jogo), **bloco de evento** (são dois), **condição** e **parâmetro** (nenhum existe ainda) |
