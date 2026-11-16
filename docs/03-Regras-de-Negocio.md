# while under_attack: attack()
## Catálogo de Regras de Negócio

**Status:** Rascunho · **Última atualização:** 16/11/2026

**"Aceita"** = confirmada pela equipe · **"Proposta"** = aguarda validação ·
**"Pendente"** = depende de decisão.

> **Leia isto antes de mudar qualquer regra marcada como Proposta.** Várias
> delas já estão implementadas no ETL — implementar a proposta é como se
> destrava o trabalho. A coluna *Onde vive* diz o que precisa ser refeito se a
> equipe mudar de ideia. As mais caras de mudar são a **RN-014** (eficiência) e
> a **RN-012** (tentativas até vencer), porque atravessam o ETL, a gold e as
> duas telas.

---

## Contas e acesso

| ID | Regra | Status | Onde vive |
|---|---|---|---|
| RN-001 | Contas são criadas somente pela equipe. Não existe autocadastro. | Aceita | seed |
| RN-002 | O login usa usuário e senha. O sistema não coleta e-mail. | Aceita | `app.jogador` |
| RN-003 | O nome exibido de um jogador é o primeiro nome ou um apelido, nunca o nome completo. | Proposta | `app.jogador.nome_exibicao` |
| RN-004 | O jogador acessa somente os próprios dados. | Aceita | `api/auth_provisoria.py` → `exigir_acesso_a` |
| RN-005 | O professor acessa os dados de todos os jogadores do MVP. | Aceita | `api/auth_provisoria.py` → `exigir_professor` |
| RN-006 | A identidade do jogador em um evento vem do token de autenticação, nunca do corpo da requisição. | Proposta | endpoint de ingestão (back-end) |

> **RN-003 é prioridade.** Envolve dado pessoal e há a PD-012 sobre menores de
> idade. Deveria sair de "Proposta" antes de as contas reais serem criadas.

---

## Execução e resultado

| ID | Regra | Status | Onde vive |
|---|---|---|---|
| RN-007 | Uma tentativa começa quando o jogador aperta Play e termina com um único resultado: vitória, derrota ou interrompida. | Aceita | `silver.tentativa`, restrição `tentativa_finalizada_coerente` |
| RN-008 | Se o programa termina sem derrotar o inimigo, o inimigo ataca até o guerreiro morrer. O resultado é derrota. | Aceita | `etl/silver.py` → `_causa_derrota` |
| RN-009 | Stop encerra a tentativa como interrompida. Pause apenas suspende a execução. Editar o programa durante a pausa: ver PD-008. | Parcialmente aceita | — |
| RN-010 | A tentativa é vitória quando a vida do inimigo chega a zero. | Aceita | — |
| RN-011 | Uma fase é concluída na primeira vitória do jogador nela. | Proposta | `etl/gold.py` → `concluida` |
| RN-018 | Somente pilhas que começam com um bloco de evento são executadas. Blocos soltos no Workspace são ignorados na execução, mas continuam registrados no programa. | Proposta (PD-009) | `programa.py` → `pilha_executavel` |

> **RN-018 mudou de significado em 16/11/2026.** O jogo tem **dois** blocos de
> evento (`on-flag` e `on-start`), não um. Quais pilhas executam quando há mais
> de um, e em que ordem, continua sendo a PD-009. O ETL hoje considera
> executável qualquer pilha que comece por um bloco que o catálogo marque com
> `inicia_pilha`.

---

## Indicadores

| ID | Regra | Status | Onde vive |
|---|---|---|---|
| RN-012 | "Tentativas até vencer" conta vitórias e derrotas até a primeira vitória, inclusive. Interrompidas são contadas em indicador separado, porque o jogador pode ter parado só para ajustar. | Proposta | `etl/gold.py` |
| RN-013 | Rejogar uma fase já concluída não altera os indicadores de aprendizagem dessa fase. | Proposta | `etl/gold.py` → filtro `ate_vencer` |
| RN-014 | Eficiência do código = blocos da solução de referência ÷ blocos do programa da primeira vitória. Contam todas as instâncias, inclusive as aninhadas e o bloco de evento, da mesma forma na referência e no programa. | Proposta | `etl/gold.py`, `programa.py` |
| **RN-019** | **O jogador aplicou o conceito de uma fase quando o programa da primeira vitória usa o bloco que representa aquele conceito.** O bloco do conceito é o que a fase de introdução acrescenta à Palette em relação à fase anterior. Numa fase de reforço, é o bloco da fase que introduziu o conceito. Quando o conceito não se resume a um bloco — "combinação" é usar um bloco dentro do outro — o indicador não se aplica. | **Proposta** | `catalogo.py` → `bloco_do_conceito`; `gold.dim_fase.bloco_conceito` |
| **RN-020** | **Uma fase cujo `conceito_id` já apareceu numa fase anterior é fase de reforço; a primeira a usar aquele conceito é fase de introdução.** Espera-se que um reforço custe *menos* tentativas que a introdução; quando custa mais, ou o reforço está difícil demais, ou o conceito não pegou na introdução. | **Proposta** | `catalogo.py` → `papel`; `gold.dim_fase.papel` |

### Sobre a RN-019 e a RN-020

As duas **nasceram no desenvolvimento do BI, não de uma regra existente**, e
estão sendo escritas aqui porque a definição não deveria morar só no código —
era uma pendência registrada no próprio `bi/README.md`.

A RN-019 existe para uma pergunta que nenhum outro indicador responde: *dá para
vencer a fase de repetição empilhando o mesmo ataque três vezes*. O jogador
passa, a eficiência do código nem sempre acusa, e o conceito ficou para trás.

**As duas precisam de validação da equipe.** Se forem recusadas, saem do
dashboard: a RN-019 some do painel de conceitos das duas telas, e a RN-020
deixa de distinguir introdução de reforço nos destaques do professor.

---

## Dados

| ID | Regra | Status | Onde vive |
|---|---|---|---|
| RN-015 | Um evento com `event_id` já recebido é ignorado sem erro: o mesmo evento nunca é contado duas vezes. | Proposta | `db/01_bronze.sql` → `unique (event_id)` |
| RN-016 | Eventos gravados na camada bronze nunca são alterados nem apagados. | Proposta | `db/01_bronze.sql` → gatilho `trg_eventos_imutavel` |

---

## Progressão

| ID | Regra | Status | Onde vive |
|---|---|---|---|
| RN-017 | Uma fase só é liberada após a conclusão da anterior. | Pendente (PD-010) | assumida pelo gerador sintético |

> Se a equipe decidir o contrário, **o funil do professor muda de
> significado**, porque ele pressupõe progressão linear.

---

## Histórico

| Data | Mudança |
|---|---|
| 13/10/2026 | Versão inicial com RN-001 a RN-018 |
| 16/11/2026 | Acrescentadas **RN-019** (conceito aplicado) e **RN-020** (introdução e reforço), ambas como Proposta, tirando do código definições que só viviam lá. Acrescentada a coluna *Onde vive* em todas as regras. Nota sobre a RN-018 passar a lidar com dois blocos de evento |
