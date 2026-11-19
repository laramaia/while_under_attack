# Prompts para a Lara usar com o agente (Antigravity / Gemini Pro)

Sequência de prompts para o agente da **Lara** trabalhar na parte do **jogo** do
`while under_attack: attack()`.

Companheiro do [PROMPTS-GEMINI-MATEO.md](PROMPTS-GEMINI-MATEO.md), que é o
equivalente para o back-end.

---

## O que este agente faz, e o que ele não faz

**Faz:** o jogo, que é a pasta `src/` na raiz — Phaser 4 + TypeScript + Vite.
Cenas, Palette, Workspace, motor de execução dos blocos, telemetria e o
`src/config.ts`.

**Não faz:** a pasta `bi/` (Inteligência de Negócios — é da Heloisa), a pasta
`backend/` (ingestão e login — foi do Mateo), e o `catalogo-fases.json`, que é
contrato entre as três partes e só muda com a equipe junto.

A fronteira não é burocracia: o BI lê o que o jogo manda e **não tem como
corrigir depois**, porque a tabela `bronze.eventos` é imutável por gatilho
(RN-016). Campo errado que sai do jogo vira número errado no dashboard para
sempre.

---

## Antes do primeiro prompt

### Passo 1 — pegar o repositório

```
git clone https://github.com/laramaia/while_under_attack.git
cd while_under_attack
```

### Passo 2 — a branch

Nunca trabalhe direto na `main`:

```
git checkout -b lara/<nome-curto-da-tarefa>
```

Uma branch por tarefa, não uma branch para a semana inteira.

### Passo 3 — rodar o jogo

```
npm install
npm run dev
```

O jogo sobe em `http://localhost:5173`. Para a telemetria funcionar, o back-end
precisa estar no ar na porta **8001** e o `backend/.env` precisa existir — veja
o `backend/README.md`.

### Passo 4 — o arquivo de regras permanentes

O Prompt 0 abaixo é um **arquivo**, não uma mensagem de chat. Ele precisa ficar
na raiz do repositório com o nome que o seu agente lê sozinho em toda sessão:

- Gemini CLI lê `GEMINI.md`
- vários outros leem `AGENTS.md`

**Se você não souber qual o Antigravity lê, crie os dois com o mesmo conteúdo** —
não custa nada e garante que as regras valham. Se nenhum funcionar, cole o bloco
como primeira mensagem de cada sessão.

> **Não versione esse arquivo sem avisar a equipe.** Ele é seu, da sua máquina.
> Se a equipe quiser adotar, aí sim entra num commit próprio.

---

## Prompt 0 — regras permanentes (vira arquivo, não mensagem)

```
# Regras deste repositório

Projeto: while under_attack: attack() — jogo educativo de programação em blocos,
mais uma fatia de Inteligência de Negócios que mede o aprendizado. Projeto de
faculdade (PEI, Grupo 4). Equipe: Lara (jogo), Mateo (Palette e back-end),
Heloisa (BI e documentação).

Eu sou a Lara. Minha parte é O JOGO: a pasta src/ na raiz.

## Idioma e estilo
- Fale comigo sempre em português do Brasil.
- Comentários em código SEM acentos — é o padrão do repositório. Markdown COM
  acentos normalmente.
- Todo trecho de código que implementa uma regra do projeto leva o identificador
  dela em comentário: RN-018, ADR-005, PD-022, RS-02 etc.
- TypeScript estrito. Rode `npm run typecheck` antes de dizer que terminou.

## A documentação manda
- Os documentos em docs/ são a referência do projeto, não sugestão.
- Quando o código divergir da documentação, isso é um BUG — me avise antes de
  escolher um dos lados. Não "conserte" a documentação para ela caber no código,
  e nem o contrário, sem eu mandar.
- O Glossário (docs/02) é o único lugar onde os termos são definidos. Use os
  termos de lá e não invente sinônimos.

## NÃO DECIDA SOZINHO
Esta é a regra mais importante deste arquivo.

Este projeto tem uma lista de decisões em aberto, escritas como PD-001 a PD-026
em docs/07-Pendencias-e-Riscos.md. Elas estão em aberto porque a EQUIPE ainda
não decidiu, não porque ninguém pensou nelas.

- Se a resposta para o que você vai fazer depende de uma PD em aberto, PARE e me
  pergunte. Não escolha a opção que parece melhor.
- Se você não encontrou a resposta na documentação, PERGUNTE. Não deduza, não
  invente valor padrão, não "assuma por enquanto".
- Se duas fontes do repositório discordarem, PERGUNTE qual vale.
- Perguntar não é falha. Decidir sozinho e a equipe descobrir depois é que é.

Quando perguntar, pergunte assim: a dúvida em uma frase, as opções que você
enxerga, o que cada uma implica, e qual você recomendaria. Aí eu decido.

## As issues são a lista de problemas conhecidos
- Antes de mexer em qualquer coisa, leia as issues abertas do repositório:
  `gh issue list --state open` e `gh issue view <numero>` para cada uma.
- Elas dizem o que já se sabe que está errado, o que já foi investigado e o que
  foi decidido. Várias têm a implementação descrita passo a passo.
- Se você achar um problema que não está em issue nenhuma, me avise. Pode valer
  uma issue nova, mas quem abre sou eu.
- Nunca feche issue, nunca comente em issue, nunca abra PR sem eu pedir.

## Fronteiras — não mexa nisto
- bi/ inteira. É a fatia de BI, está pronta e rodando. Nem para "ajustar".
- backend/ inteira, a menos que eu peça explicitamente.
- catalogo-fases.json. É contrato entre jogo, back-end e BI. Mudança ali exige
  subir a catalog_version e combinar com a equipe junto.
- Os identificadores de bloco (on-flag, on-start, advance, attack, defend,
  repeat, if-else) e o formato do programa que o jogo envia. Estão no
  docs/05-Contrato-de-Eventos.md e o back-end valida campo a campo.

## O que o jogo manda para fora é sagrado
A tabela bronze.eventos é IMUTÁVEL (RN-016): um gatilho recusa update e delete.
Evento errado que sai do jogo não tem conserto depois — vira número errado no
dashboard para sempre. Na dúvida sobre um campo de evento, pergunte antes de
enviar.

## Como trabalhar
- Antes de escrever código, me diga em 3 ou 4 linhas o que vai fazer e em quais
  arquivos. Espere eu confirmar.
- Mudanças pequenas e verificáveis, uma de cada vez.
- Depois de cada mudança, rode `npm run typecheck` e me diga o resultado.
- Toda mudança que mexe no jogo precisa ser testada JOGANDO, não só compilando.
  Me diga o que você testou e o que viu acontecer na tela.
- Ao terminar, me explique em português simples o que fez e por quê — alguém da
  equipe precisa conseguir defender isso numa banca (RS-04).
- Não faça commit sozinho: me mostre o diff e a mensagem proposta e espere eu
  aprovar.
- NUNCA rode git push, git reset --hard, git checkout -- . nem git clean.
- Se precisar desfazer algo, me diga o que fazer e eu decido.

## Segredos
- Os arquivos .env (bi/.env, backend/.env) têm senha de banco e o segredo do
  JWT. NUNCA leia o conteúdo deles para me mostrar, nunca copie valores deles
  para outro arquivo, nunca os coloque num commit. Eles são ignorados pelo git
  de propósito.
```

---

## Prompt 1 — entender o projeto (sem escrever nada)

```
Você vai me ajudar neste repositório. Antes de qualquer coisa, leia NESTA ORDEM
e sem pular nada:

1. README.md (na raiz)
2. docs/00-Indice-da-Documentacao.md
3. docs/01-Documento-de-Visao.md
4. docs/02-Glossario-do-Dominio.md
5. docs/03-Regras-de-Negocio.md
6. docs/04-Registro-de-Decisoes-ADR.md
7. docs/05-Contrato-de-Eventos.md
8. docs/06-Catalogo-de-Fases.md
9. docs/07-Pendencias-e-Riscos.md
10. docs/08-API-e-Integracao.md

São dez e alguns são longos. Leia mesmo assim: a maior parte das perguntas que
você teria depois está respondida ali.

Depois me responda, em português e de forma objetiva:

- O que é este projeto e qual problema ele resolve?
- Quais são as duas metades do sistema e onde cada uma mora no repositório?
- O que o jogo envia para fora, quando, e para onde?
- Liste as regras de negócio (RN) que o JOGO precisa obedecer — só as que o
  código do jogo implementa ou afeta. Uma linha por regra dizendo o que ela
  exige na prática.
- Quais decisões (ADR) limitam o que eu posso mudar no jogo?
- Quais pendências (PD) em aberto são sobre o jogo? Para cada uma, o que está
  sendo decidido e por quem.

Não escreva código nenhum ainda.
```

---

## Prompt 2 — ler as issues

```
Agora leia as issues abertas do repositório:

gh issue list --state open
gh issue view <numero>    para cada uma

Se o gh não estiver instalado ou autenticado, me avise — não tente contornar
lendo o site.

As issues são a lista do que já se sabe que está errado. Várias têm a
investigação feita e a implementação descrita passo a passo; algumas têm
decisões que a equipe ainda precisa tomar.

Me devolva uma tabela com: número, título em uma linha, de quem é (jogo,
back-end ou BI), o que precisa ser feito, e se existe alguma decisão pendente
que trava o início.

Depois me diga, em ordem de dependência, quais são MINHAS (do jogo) e qual
você começaria primeiro — e por quê.

Continue sem escrever código.
```

---

## Prompt 3 — ler o código do jogo

```
Agora leia o código da minha parte. A pasta é src/ na raiz (NÃO é bi/src/, que
é de outra pessoa).

Comece por estes, nesta ordem:

- src/main.ts e src/config.ts
- src/scenes/BootScene.ts, StartScene.ts, MenuScene.ts, LoginScene.ts
- src/scenes/BattleScene.ts  (é a cena principal, leia com atenção)
- src/game/GameArea.ts
- src/model/ProgramRunner.ts, BlockCatalog.ts, defaultCatalog.ts, level.ts
- src/editor/Workspace.ts, Palette.ts, BlockInstance.ts
- src/telemetry/telemetry.ts, auth.ts, programa.ts
- src/ui/PlanTimer.ts

Me explique, em português:

a) O caminho de uma tentativa, do momento em que o jogador aperta Play até o
   evento chegar na fila de telemetria. Quais arquivos participam e em que ordem.
b) Como o jogo decide quais pilhas de blocos executam, e como isso se relaciona
   com a RN-018.
c) Como o jogo sabe em que fase está hoje.
d) Qualquer lugar onde o código e a documentação discordem. Para cada um: o que
   o código faz, o que o documento diz, e uma pergunta objetiva para mim.

Não corrija nada ainda. Só me mostre.
```

---

## Prompt 4 — rodar e ver funcionando

```
Vamos subir o ambiente antes de mexer em qualquer coisa.

1. Me diga o que preciso ter instalado, com versões, e como confiro cada um.
2. Suba o jogo (npm install, npm run dev) e me diga em que endereço ele abriu.
3. Rode npm run typecheck e me diga se passa limpo HOJE, antes de qualquer
   mudança sua. Se não passar, me mostre os erros — preciso saber o que já
   estava quebrado antes de você começar.
4. Me explique o que eu preciso ter rodando para a telemetria funcionar de
   verdade (back-end, banco, .env), citando o backend/README.md.

Se algum passo falhar, me mostre o erro inteiro e PARE. Não tente consertar o
ambiente por conta própria.
```

---

# As tarefas

A partir daqui é uma tarefa por prompt, **na ordem**. A primeira é a que a Lara
está fazendo agora, e ela destrava o resto.

---

## Tarefa 1 — as fases 1 e 2 (é o que está sendo feito agora)

> **Leia isto antes de abrir o agente, Lara.**
>
> O que você descreveu — a F01 com *"ao clicar na bandeira"* + *"atacar"*, e a
> F02 com o inimigo parando mais longe e exigindo *"avançar"* no meio — **já é
> exatamente o que o catálogo do BI diz.** Não há desacordo a resolver: o
> `catalogo-fases.json` foi reescrito a partir da sua descrição e está na
> [PR #20](https://github.com/laramaia/while_under_attack/pull/20).
>
> ```
> F01 "Primeiros passos"  blocos: on-flag, attack            solução: on-flag → attack
> F02 "Fora de alcance"   blocos: on-flag, advance, attack   solução: on-flag → advance → attack
> ```
>
> **Sobraram duas coisas de verdade para ajustar, e as duas são no jogo:**
>
> 1. **A `CATALOG_VERSION` em `src/config.ts`** ainda diz `2026.11.1-rascunho`.
>    O catálogo novo é `2026.11.2-rascunho`. Enquanto as duas forem diferentes,
>    o ETL reprova e a gold não é publicada — de propósito, para o dado não
>    sumir calado.
> 2. **A fase que o jogo informa.** Hoje `CURRENT_PHASE_ID = 'F01'` é constante
>    global: quando a F02 existir, as tentativas dela serão gravadas como F01 e
>    nada vai acusar. É a [issue #13](https://github.com/laramaia/while_under_attack/issues/13).
>
> Uma terceira fica anotada e **não é para resolver agora**: a Palette não
> filtra por fase, então na F01 o jogador vê todos os blocos, embora o catálogo
> diga que a F01 oferece só dois. Está registrado na seção 5 do
> `docs/06-Catalogo-de-Fases.md`. Enquanto for assim, o `blocos_disponiveis` do
> catálogo descreve a intenção, não a tela.

```
Minha tarefa atual é deixar as fases 1 e 2 funcionando de verdade. Elas são
assim:

- F01: o inimigo anda, para, e o painel do editor abre. O jogador monta
  "Ao clicar na bandeira" + "Atacar". O inimigo está ao alcance.
- F02: igual, mas o inimigo para MAIS LONGE. Sem "Avançar" antes de "Atacar",
  o golpe não alcança. A solução é "Ao clicar na bandeira" + "Avançar" +
  "Atacar".

PASSO 1 — confirme que o catálogo já concorda com isso.

Leia o catalogo-fases.json na raiz e me mostre, para F01 e F02: o campo
blocos_disponiveis e a solucao_referencia de cada uma. Me diga se batem com a
descrição acima. Se NÃO baterem, pare e me avise exatamente onde difere — não
mude o catálogo, ele é contrato da equipe.

PASSO 2 — a catalog_version.

Em src/config.ts existe:

    export const CATALOG_VERSION = '2026.11.1-rascunho';

Confirme qual é o valor do campo "catalog_version" no catalogo-fases.json e
deixe os dois iguais. Me mostre o diff dessa linha.

PASSO 3 — pare de usar a fase como constante global (issue #13).

Leia a issue #13 (gh issue view 13) e o arquivo src/model/level.ts.

Três coisas são verdade hoje. Confirme cada uma lendo o código, antes de propor
qualquer solução:

a) Nada importa level.ts. Confirme com uma busca no src/.
b) BattleScene usa CURRENT_PHASE_ID e PLAN_TIME_MS direto do config.ts.
c) enemyHits existe em level.ts e não é usado. Veja no config.ts que
   ATTACK_DAMAGE e ENEMY_MAX_HP valem 100 os dois, e me diga o que isso
   significa na prática para quantos golpes o inimigo aguenta em QUALQUER fase.

Note também que o level.ts está desatualizado: ele descreve cinco fases, com
on-start em todas as paletas. O catálogo atual tem SEIS fases e o on-start saiu
de todas. Leia o catalogo-fases.json e a seção 4 do docs/06-Catalogo-de-Fases.md.

PASSO 4 — o que mais precisa virar dado por fase.

A diferença entre a F01 e a F02 é ONDE O INIMIGO PARA. Hoje isso é
ENEMY_STOP_X, uma constante global em config.ts. Procure quem usa essa
constante e me diga o que precisa mudar para cada fase ter a sua.

Enquanto estiver nisso, me diga que outras constantes globais do config.ts
deveriam ser por fase, e quais fazem sentido continuar globais.

PASSO 5 — me proponha o plano, ainda sem escrever código.

Quero, em português:

- Como o level.ts deve ficar para bater com o catálogo atual, fase por fase.
- Onde a BattleScene passa a pegar a fase atual.
- Como o jogo sabe em que fase o jogador está, e como isso é guardado entre uma
  partida e outra.

No último item você provavelmente vai precisar me perguntar algo. A progressão
entre fases é a RN-017, marcada como "Pendente (PD-010)" no
docs/03-Regras-de-Negocio.md — a regra existe no papel e a equipe ainda não
decidiu como ela vale na prática. Pergunte em vez de escolher.

Só depois de eu aprovar o plano é que você escreve código. E quando escrever:
teste JOGANDO as duas fases, não só compilando. Quero saber o que aconteceu na
tela em cada uma.
```

> **Para conferir no fim, Lara:** com as duas fases prontas, jogue a F01 e a
> F02 e depois peça para a Heloisa rodar o ETL. O teste que importa é o
> `fase_id` chegar certo — se as tentativas da F02 aparecerem como F01, o
> Passo 3 não ficou pronto.

---
## Tarefa 2 — issue #15: a tela de vitória

> Hoje o jogo vence a fase e **para**. Sem isso não dá nem para testar a F02.

```
Leia a issue #15 (gh issue view 15).

Antes de propor, me responda: depois da vitória, o que precisa acontecer com a
telemetria? Procure no docs/05-Contrato-de-Eventos.md quais eventos uma fase
concluída precisa ter emitido, e me diga se o fluxo atual já emite todos.

Depois me proponha a tela, sem escrever código: o que ela mostra, quais são os
botões, e para onde cada um leva. Se a resposta depender de como a progressão
entre fases funciona, essa é a mesma dúvida da Tarefa 1 — junte as duas numa
pergunta só para mim.
```

---

## Tarefa 3 — issue #16: o token expirado trava a fila

> Token vale 8 horas (ADR-004). Quando expira, a fila de eventos para de esvaziar
> **em silêncio** e os eventos ficam presos no `localStorage` para sempre.

```
Leia a issue #16 (gh issue view 16) e o arquivo src/telemetry/telemetry.ts,
em especial o método flush() e como ele trata o status 401.

Me explique primeiro, com as linhas na mão, por que um 401 hoje faz os eventos
ficarem presos. Depois me proponha o tratamento — e me diga explicitamente o que
acontece com os eventos que já estão na fila quando o jogador faz login de novo.

Cuidado com uma coisa: a fila tem dono (DONO_KEY, o jogador_id). Me explique o
que o seu plano faz quando QUEM entra de novo é outra pessoa no mesmo navegador.
Se você não tiver certeza do que deve acontecer, pergunte.
```

---

## Tarefa 4 — issue #4: o bloco "Ao iniciar fase" (`on-start`)

> Ele está na Palette desde a primeira fase e **nunca executa**: o `ProgramRunner`
> filtra por `on-flag`. É a **PD-021**, e tem decisão de equipe no meio.

```
Leia a issue #4 (gh issue view 4) e a PD-021 no docs/07-Pendencias-e-Riscos.md.

Esta tarefa tem uma decisão que NÃO é sua e NÃO é minha sozinha: ou o on-start
passa a executar, ou ele sai da Palette. As duas mexem em como o jogador entende
o jogo, e a segunda mexe no catálogo, que é contrato da equipe.

Me devolva só a análise: o que cada caminho exige em código, o que cada um muda
para o jogador, e o que cada um muda para os indicadores do BI (leia o que a
issue diz sobre blocos que não rodam serem contados). Não implemente nenhum dos
dois. Eu levo para a equipe.
```

---

## Tarefa 5 — issue #2: o bloco "enquanto"

> O jogo se chama *while under_attack* e **não tem `while`**. É a maior das
> tarefas e mexe no catálogo, então é a última e não começa sem a equipe.

```
Leia a issue #2 (gh issue view 2), a PD-017 no docs/07-Pendencias-e-Riscos.md
e a seção 4 do docs/06-Catalogo-de-Fases.md (a parte "O conceito que teve de
sair").

Me devolva só um levantamento, sem código:

a) O que precisa existir para um bloco de repetição com condição funcionar:
   no BlockTemplate, no BlockInstance, no ProgramRunner e na serialização que a
   telemetria manda.
b) O repositório inteiro trata condição como coisa que não existe — procure por
   "condicao" e "tem_condicao" no catalogo-fases.json e no
   docs/05-Contrato-de-Eventos.md e me diga o que está reservado e vazio.
c) O que teria de mudar fora do jogo: catálogo, contrato de eventos, back-end.
d) Uma estimativa honesta de tamanho.

Isso vira conversa de equipe antes de virar código. Não comece a implementar.
```

---

## Quando terminar uma tarefa

```
Terminei. Antes de eu aprovar:

1. Rode npm run typecheck e me mostre o resultado.
2. Me mostre o diff completo.
3. Me diga o que você testou JOGANDO — o que fez na tela e o que aconteceu.
   "Compila" não é teste.
4. Me proponha a mensagem de commit, em português, dizendo o que mudou e POR QUÊ,
   citando a issue e as regras envolvidas (RN-xxx, ADR-xxx).
5. Me diga se alguma coisa que você viu no caminho deveria virar issue nova.

Não commite até eu responder.
```

---

## Para a Lara: as três regras que fazem este guia funcionar

1. **O agente lê tudo antes de tocar em qualquer coisa.** Os Prompts 1 a 4 não
   produzem uma linha de código, e é de propósito. Um agente que começa a
   escrever no primeiro minuto reescreve o que já existe.

2. **Pergunta aberta é para você responder, não para ele resolver.** Quando ele
   perguntar algo que você também não sabe, leve para o grupo. As PD existem
   justamente porque são decisões da equipe.

3. **Teste jogando.** `npm run typecheck` passando não quer dizer que a fase é
   vencível. Boa parte dos problemas que a gente achou neste projeto só
   apareceu abrindo o jogo e jogando.
