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
| RN-001 | Contas são criadas somente pela equipe. Não existe autocadastro. | Aceita | `backend/src/wua_backend/seed.py` |
| RN-002 | O login usa usuário e senha. O sistema não coleta e-mail. | Aceita | `backend/.../auth.py` → `autenticar`; `app.jogador` não tem coluna de e-mail |
| RN-003 | O nome exibido de um jogador é o primeiro nome ou um apelido, nunca o nome completo. | **Aceita** | `backend/.../seed.py` → `validar_conta` recusa `nome_exibicao` com espaço |
| RN-004 | O jogador acessa somente os próprios dados. | Aceita | `bi/.../api/auth_provisoria.py` → `exigir_acesso_a` |
| RN-005 | O professor acessa os dados de todos os jogadores do MVP. | Aceita | `bi/.../api/auth_provisoria.py` → `exigir_professor` |
| RN-006 | A identidade do jogador em um evento vem do token de autenticação, nunca do corpo da requisição. | **Aceita** | `backend/.../ingestao.py` → `ingerir_lote` usa o `jogador_id` do token |
| **RN-022** | **A partida de quem entra com perfil `professor` não gera telemetria.** O professor pode jogar — para conhecer a fase, para demonstrar em aula —, mas essa partida não abre sessão e não emite evento nenhum. Ver abaixo. | **Proposta** | `src/scenes/LoginScene.ts` → `iniciarSessao` só é chamado quando `perfil === 'jogador'` |

### Sobre a RN-022, e por que ela precisa estar escrita

A regra **nasceu do código**, em 18/11/2026: ao revisar a tela de login, o
`iniciarSessao` estava dentro de um `if (sessao.perfil === 'jogador')`.

Verificado rodando: entrei como `professor`, joguei 20 s com o relógio
disparando tentativas, e a bronze ficou com **zero eventos** desse jogador —
só a conta de jogador tinha evento.

**A decisão está certa.** A partida do professor não é aprendizagem de
ninguém: ele já sabe a resposta, e entra na fase para preparar a aula ou para
mostrar como se faz. Se essas tentativas entrassem nos indicadores, iriam
parar no funil de fases (O4), nas tentativas até vencer (RN-012) e na média da
turma — e o professor estaria, sem querer, enviesando o próprio painel que usa
para decidir o que reexplicar.

Está escrita aqui porque **comportamento que só existe no código não sobrevive
a uma refatoração**. Sem a regra, a leitura natural de quem encontrar aquele
`if` é "falta chamar o `iniciarSessao` para o professor" — e o conserto seria
o estrago.

> **O que a regra não decide.** Se mais tarde fizer sentido o professor jogar
> *sendo medido* (num treinamento, por exemplo), isso não é um `if` a menos: é
> uma conta de jogador para ele. Misturar os dois perfis numa conta só quebra
> a RN-004 e a RN-005, que separam quem vê o quê.

> **A RN-003 saiu de "Proposta" em 16/11/2026** e passou a ser verificada em
> código: o seed recusa a conta se o `nome_exibicao` tiver espaço, com a
> mensagem citando a regra. Não é uma checagem perfeita — um nome composto sem
> espaço passaria — mas impede o caso que importa, que é colar o nome completo.
> A PD-012 (menores de idade) continua aberta.

> **A RN-006 também foi verificada rodando**, e não só lida no código: um
> evento enviado com `jogador_id: 999` no corpo foi gravado com o `jogador_id`
> do token. O mesmo vale para `origem`, que o back-end ignora e o banco
> preenche com `'jogo'` (RS-02).

---

## Execução e resultado

| ID | Regra | Status | Onde vive |
|---|---|---|---|
| RN-007 | Uma tentativa começa quando o jogador aperta Play e termina com um único resultado: vitória, derrota ou interrompida. | Aceita | `silver.tentativa`, restrição `tentativa_finalizada_coerente` |
| RN-008 | Se o programa termina sem derrotar o inimigo, o inimigo ataca até o guerreiro morrer. O resultado é derrota. | Aceita | `src/game/GameArea.ts` → `enemyAttacksUntilHeroDies`; `etl/silver.py` → `_causa_derrota` |
| RN-009 | Stop encerra a tentativa como interrompida. Pause apenas suspende a execução. Editar o programa durante a pausa: ver PD-008. | Parcialmente aceita | — |
| RN-010 | A tentativa é vitória quando a vida do inimigo chega a zero. | Aceita | — |
| RN-011 | Uma fase é concluída na primeira vitória do jogador nela. | Proposta | `etl/gold.py` → `concluida` |
| RN-018 | Somente pilhas que começam com um bloco de evento são executadas. Blocos soltos no Workspace são ignorados na execução, mas continuam registrados no programa. | Proposta (PD-009) | `programa.py` → `pilha_executavel` |

> **RN-018 mudou de significado em 16/11/2026.** O jogo tem **dois** blocos de
> evento (`on-flag` e `on-start`), não um. O ETL hoje considera executável
> qualquer pilha que comece por um bloco que o catálogo marque com
> `inicia_pilha`.

> ### ⚠️ O motor de execução discorda da RN-018 num ponto
>
> O `ProgramRunner` entrou na `main` em 16/11/2026 e respondeu boa parte da
> PD-009. Testado rodando:
>
> | Caso | O jogo faz | A RN-018 diz |
> |---|---|---|
> | Pilha sem bloco de evento | ignora | ignora ✔ |
> | Várias pilhas com `on-flag` | executa **todas, em sequência**, na ordem do `roots` | não dizia; agora está respondido |
> | Pilha começando com **`on-start`** | **não executa nada** | considera executável ✘ |
>
> O runner filtra `roots.filter(b => b.template.id === 'on-flag')`. O
> `on-start` está na Palette desde a primeira fase, o jogador pode arrastá-lo,
> e a pilha que ele encabeça **nunca roda**.
>
> **Por que isso é problema do BI e não só do jogo:** o `pilha_executavel` da
> silver marcaria essa pilha como executável, os blocos dela entrariam no
> `qtd_blocos` e a eficiência da RN-014 compararia a solução de referência com
> blocos que nunca rodaram. Pior, a RN-019 poderia dar ao jogador o crédito de
> ter aplicado o conceito usando um `repeat` que o jogo nunca executou.
>
> Três saídas, e é decisão da equipe (**PD-021**, [issue #4](https://github.com/laramaia/while_under_attack/issues/4)): o jogo passa a executar
> `on-start` também; ou `on-start` sai da Palette; ou ele perde o
> `inicia_pilha` no `catalogo-fases.json` e a RN-018 passa a falar de um bloco
> só. **Enquanto não se decidir, o indicador mente para qualquer jogador que
> use o `on-start`.**

---

## Indicadores

| ID | Regra | Status | Onde vive |
|---|---|---|---|
| RN-012 | "Tentativas até vencer" conta vitórias e derrotas até a primeira vitória, inclusive. Interrompidas são contadas em indicador separado, porque o jogador pode ter parado só para ajustar. | Proposta | `etl/gold.py` |
| RN-013 | Rejogar uma fase já concluída não altera os indicadores de aprendizagem dessa fase. | Proposta | `etl/gold.py` → filtro `ate_vencer` |
| RN-014 | Eficiência do código = blocos da solução de referência ÷ blocos do programa da primeira vitória. Contam todas as instâncias, inclusive as aninhadas e o bloco de evento, da mesma forma na referência e no programa. | Proposta | `etl/gold.py`, `programa.py` |
| **RN-019** | **O jogador aplicou o conceito de uma fase quando o programa da primeira vitória usa o bloco que representa aquele conceito.** O bloco do conceito é o que a fase de introdução acrescenta à Palette em relação às fases anteriores; quando ela acrescenta mais de um, vale o que a **solução de referência usa**. Numa fase de reforço, é o bloco da fase que introduziu o conceito. Quando o conceito não se resume a um bloco — "combinação" é usar um bloco dentro do outro — o indicador não se aplica. | **Proposta** | `catalogo.py` → `bloco_do_conceito`; `gold.dim_fase.bloco_conceito` |
| **RN-020** | **Uma fase cujo `conceito_id` já apareceu numa fase anterior é fase de reforço; a primeira a usar aquele conceito é fase de introdução.** Espera-se que um reforço custe *menos* tentativas que a introdução; quando custa mais, ou o reforço está difícil demais, ou o conceito não pegou na introdução. | **Proposta** | `catalogo.py` → `papel`; `gold.dim_fase.papel` |
| **RN-021** | **A tentativa disparada pelo tempo limite da fase, e não pelo jogador, não conta nos indicadores de aprendizagem.** Estourar o tempo não é uma solução errada: é não ter tentado a tempo. A tentativa continua registrada no fato e no `total_tentativas` — ela aconteceu —, mas fica fora de "tentativas até vencer" (RN-012), das causas de derrota (RN-008) e do tempo montando. **Exceção:** se a própria vitória veio de um Play do jogo, ela conta: o programa estava certo, só faltou apertar o botão. O jogo informa isso no campo opcional `disparo` do EV-04. | **Proposta** | `etl/silver.py`, `etl/gold.py` → filtro `ate_vencer`; `silver.tentativa.disparo` |

### Sobre a RN-021, e o que ela custou medir

A RN-021 nasceu de uma pergunta do lado do jogo em 17/11/2026: a fase vai ter
tempo limite de 15 s e, esgotado, **o jogo aperta Play sozinho** com o que
estiver no Workspace.

Medi a distorção antes de decidir, com dois jogadores sintéticos que montaram
**exatamente o mesmo programa vencedor**, um deles depois de dois Play
automáticos com o Workspace vazio:

| Indicador | Sem Play automático | Com dois |
|---|---|---|
| Tentativas até vencer (RN-012) | 1 | **3** |
| Derrotas por programa curto (RN-008) | 0 | **2** |
| Tempo montando | 21 s | **51 s** |
| Eficiência (RN-014) | 1,000 | 1,000 — não afetada |

Três vezes pior, para o mesmo aprendizado. E as duas derrotas falsas alimentam
o alerta que o painel do professor mostra quando os programas terminam cedo
demais — um aviso que mandaria o professor explicar melhor a fase, quando o
problema era o relógio.

Com o campo `disparo` preenchido, os três indicadores voltam aos valores de
quem não estourou o tempo.

> **A RN-013 já protegia parte disso.** O que vem depois da primeira vitória é
> rejogo e nunca contou. A RN-021 cobre o que vem **antes**, que era o buraco.

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
| RN-015 | Um evento com `event_id` já recebido é ignorado sem erro: o mesmo evento nunca é contado duas vezes. | **Aceita** | `bi/db/01_bronze.sql` → `unique (event_id)`; `backend/.../ingestao.py` → `on conflict do nothing` e contagem em `ignorados` |
| RN-016 | Eventos gravados na camada bronze nunca são alterados nem apagados. | Aceita | `bi/db/01_bronze.sql` → gatilho `trg_eventos_imutavel` |

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
| 16/11/2026 | **O back-end passou a existir e quatro regras saíram de "Proposta".** RN-003 e RN-006 vão a **Aceita** com o arquivo que as verifica; RN-015 ganha a implementação do lado do servidor. A coluna *Onde vive* passa a usar o caminho completo, porque agora há dois projetos Python no repositório e `api/` sozinho ficou ambíguo |
| 16/11/2026 | **O motor de execução do jogo entrou na `main`.** A RN-018 ganha o resultado do teste: pilhas sem bloco de evento são ignoradas como a regra previa, várias pilhas com `on-flag` executam em sequência (parte da PD-009 respondida), mas uma pilha encabeçada por **`on-start` não executa** — divergência registrada como **PD-021** |
| 17/11/2026 | **Acrescentada a RN-021**: a tentativa que o tempo limite dispara não conta nos indicadores de aprendizagem. Veio de uma pergunta do lado do jogo, e a distorção foi medida antes de decidir. A regra de qualidade **RN-012b** foi reescrita para verificar a definição nova — ela barrou a primeira versão da mudança, que era o esperado |
| 18/11/2026 | **Acrescentada a RN-022**: a partida de quem entra como `professor` não gera telemetria. A regra nasceu do código da tela de login ([PR #12](https://github.com/laramaia/while_under_attack/pull/12)) e foi verificada rodando — professor jogando 20 s, zero eventos na bronze. Está escrita porque sem ela a leitura natural daquele `if` é "falta chamar o `iniciarSessao`", e o conserto seria o estrago. **RN-008 confirmada em código**: o jogo passou a fazer o inimigo atacar até o guerreiro morrer, e a derrota por programa curto chega na silver classificada |
| 18/11/2026 | **RN-019** ganha o desempate: quando a fase abre mais de um bloco novo, o bloco do conceito é o que a solução de referência usa. Até aqui a regra era "o último da lista", e a lista é um campo de JSON — reordená-la sem querer trocava o conceito da fase e mudava um indicador sem que nada acusasse. Apareceu de verdade ao reescrever o catálogo: a fase da repetição passou a abrir `defend` e `repeat` juntos |
