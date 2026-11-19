# while under_attack: attack()
## Catálogo de Fases

**Status:** Rascunho · **Última atualização:** 18/11/2026

Define o formato de [`catalogo-fases.json`](../catalogo-fases.json) (ADR-006).

**O que já está fechado:** as categorias de bloco (PD-007, resolvida em
13/10/2026) e os **identificadores técnicos dos blocos**, alinhados ao código do
jogo em 16/11/2026.

**O que continua aberto:** o conteúdo das fases (PD-006), a lista de condições e
o ramo "senão" (PD-013).

---

## 1. Categorias e blocos (como estão no jogo)

Fonte: `src/model/defaultCatalog.ts`, commit `0127da5`.

| Categoria | Identificador | Função | Blocos |
|---|---|---|---|
| Evento | `event` | Inicia a execução de uma pilha | `on-flag` (Ao clicar em play), `on-start` (Ao iniciar fase) |
| Ação | `action` | Faz o guerreiro agir | `attack` (Atacar), `defend` (Defender), `advance` (Avançar) |
| Repetição | `repeat` | Repete o corpo | `repeat` (Repetir 3x) |
| Condicional | `condition` | Executa o corpo conforme uma condição | `if-else` (Se / Senão) |

### Três coisas que mudaram desde 13/10/2026

**São dois blocos de evento, não um.** O documento dizia "Ao clicar em Play
(único por enquanto)". O jogo tem `on-flag` e `on-start`.

> **E em 16/11/2026 o motor de execução respondeu o que acontece com eles: só
> o `on-flag` executa.** O `ProgramRunner` filtra `roots` por
> `template.id === 'on-flag'`; uma pilha encabeçada por `on-start` nunca roda.
> O bloco continua na Palette desde a primeira fase. Como este catálogo marca
> os dois com `inicia_pilha: true`, o ETL conta como executável uma pilha que o
> jogo ignora — é a **PD-021**, aberta como [issue #4](https://github.com/laramaia/while_under_attack/issues/4), e ela mexe
> na RN-014 e na RN-019.
>
> A outra metade da PD-009 ficou respondida: havendo várias pilhas com
> `on-flag`, **todas executam, em sequência**, na ordem em que foram soltas no
> Workspace. E pilhas sem bloco de evento são ignoradas, como a RN-018 previa.

**Existe um bloco `defend` que nenhuma fase planejada usava.** Ele está na
Palette desde a primeira fase. Não aparece em nenhuma solução de referência, o
que é normal — `blocos_disponiveis` é o que a Palette mostra, a referência é o
programa ideal.

**Não existe bloco de repetição com condição.** Ver a seção 4.

---

## 2. Formato do arquivo

```json
{
  "catalog_version": "2026.11.2-rascunho",

  "conceitos": [
    { "conceito_id": "evento", "nome": "Evento", "ordem": 1 },
    { "conceito_id": "sequencia", "nome": "Sequencia", "ordem": 2 }
  ],

  "tipos_de_bloco": [
    { "tipo": "on-flag", "categoria": "event",
      "rotulo": "Ao clicar em play", "inicia_pilha": true },
    { "tipo": "attack", "categoria": "action", "rotulo": "Atacar" },
    { "tipo": "repeat", "categoria": "repeat", "rotulo": "Repetir 3x",
      "tem_corpo": true, "vezes_fixas": 3 },
    { "tipo": "if-else", "categoria": "condition", "rotulo": "Se / Senao",
      "tem_corpo": true, "tem_condicao": false }
  ],

  "condicoes": [],

  "fases": [
    {
      "fase_id": "F02",
      "ordem": 2,
      "titulo": "Fora de alcance",
      "conceito_id": "sequencia",
      "blocos_disponiveis": ["on-flag", "advance", "attack"],
      "solucao_referencia": { "pilhas": [[
        { "id": "r1", "tipo": "on-flag" },
        { "id": "r2", "tipo": "advance" },
        { "id": "r3", "tipo": "attack" }
      ]] }
    }
  ]
}
```

| Campo | Regra |
|---|---|
| `catalog_version` | Muda sempre que uma fase já jogada for alterada (RS-03). O sufixo `-rascunho` indica que o conteúdo das fases ainda depende da PD-006. |
| `conceitos` | Lista oficial de conceitos, em ordem de ensino. |
| `tipos_de_bloco` | Todos os blocos que existem no jogo, com categoria e rótulo. |
| `rotulo` | Nome como o jogador o lê na Palette. **O dashboard lê daqui**, via `GET /api/catalogo` — não mantém uma segunda lista. |
| `inicia_pilha` | O bloco é um "hat": começa uma pilha. É o que a RN-018 usa. Tradução direta do `shape: 'hat'` do jogo. |
| `tem_corpo` | O bloco é um "c-block": contém outros dentro. |
| `vezes_fixas` | Quantas vezes o bloco repete o corpo, quando não há parâmetro editável. |
| `tem_condicao` | Se o bloco usa uma condição. **Hoje sempre `false`.** |
| `condicoes` | Condições disponíveis. **Hoje vazia** (PD-013). |
| `blocos_disponiveis` | Subconjunto de blocos que a Palette mostra nesta fase. A RN-019 deduz o bloco do conceito pelo que a fase acrescenta em relação às anteriores. **A ordem não importa** — até 18/11/2026 importava, e era um problema: ver a seção 3.1. |
| `solucao_referencia` | Programa completo, no mesmo formato do contrato de eventos. O tamanho de referência é **calculado contando os blocos dele** (RN-014), em vez de digitado à mão. |

> **`inicia_pilha` não é opcional na prática.** Sem nenhum bloco declarando-o, a
> RN-018 consideraria que nenhuma pilha executa e o ETL recusa o catálogo na
> validação. Foi assim que se descobriu que o ETL procurava a categoria pelo
> nome `"evento"`, que o jogo chama de `event`.

---

## 3. Fases de introdução e de reforço

**Nem toda fase ensina um conceito novo.** Algumas existem para reforçar o que a
anterior ensinou, quando o conteúdo é mais avançado.

A regra está na **RN-020** e não exige campo novo no catálogo:

> Uma fase cujo `conceito_id` já apareceu numa fase anterior é **fase de
> reforço**. A primeira a usar aquele conceito é **fase de introdução**.

Duas consequências:

- **Duas fases podem compartilhar o mesmo `conceito_id` de propósito.** Não é
  erro de digitação.
- **Numa fase de reforço, o indicador de conceito aplicado (RN-019) usa o bloco
  da fase que introduziu o conceito** — que é justamente onde mais interessa
  saber se o conceito pegou.

A distinção muda o que se espera da fase: um reforço deveria custar *menos* que
a introdução. Quando custa mais, ou o reforço está difícil demais, ou o
conceito não pegou na introdução.

> Esta ideia **nasceu no ETL** e não existia neste documento até 16/11/2026,
> que era uma divergência registrada. Agora está aqui e na RN-020, as duas
> aguardando validação da equipe.

### 3.1 Qual bloco representa o conceito, quando a fase abre mais de um

A RN-019 pergunta se o jogador venceu **usando** o bloco que a fase ensina. Para
isso é preciso saber qual bloco é esse, e o catálogo o deduz: é o que a fase
acrescenta à Palette em relação a todas as anteriores.

Quase sempre é um bloco só, e não há o que decidir. Mas em 18/11/2026, ao
reescrever as duas primeiras fases com o que elas de fato usam, a fase da
repetição passou a abrir **dois** de uma vez — `defend` e `repeat` —, porque
nenhuma fase anterior os oferecia.

A regra de desempate até então era *"o último da lista"*. Ela funcionou por
sorte: `repeat` estava escrito depois de `defend`. Reordenar os dois nomes no
JSON — coisa que ninguém trataria como mudança de comportamento — trocaria o
bloco do conceito da fase para `defend`, e o indicador "venceu aplicando o
conceito?" passaria a medir outra coisa, sem erro, sem aviso e sem nada no gate
de qualidade que pegasse.

**O desempate agora é a solução de referência:** entre os blocos novos, vale o
que a própria solução usa. A referência da fase da repetição usa `repeat` e não
usa `defend`, e isso não depende de ordem nenhuma. Quando nenhum bloco novo
aparece na referência, o catálogo responde "não sei" (`null`) em vez de chutar
— é mais honesto um indicador ausente do que um indicador errado.

---

## 4. Progressão (a validar — PD-006)

Esta é a progressão que **os blocos existentes conseguem ensinar**:

| Fase | Título | Conceito | Bloco novo | Ideia de desafio |
|---|---|---|---|---|
| F01 | Primeiros passos | Evento | — | Uma ação só: apertar play e ver o programa rodar |
| F02 | Fora de alcance | Sequência | `advance` | O inimigo para longe: avançar antes de atacar |
| F03 | Golpe atrás de golpe | Repetição com número fixo | `repeat` | Inimigo que aguenta vários ataques, sem copiar blocos |
| F04 | Ele aguenta mais | *(reforço da F03)* | — | Repetir com mais de um bloco no corpo |
| F05 | Só quando der | Condicional | `if-else` | Atacar somente quando der |
| F06 | Duelo longo | Combinação | — | Condicional dentro de repetição |

**A F01 e a F02 são as que o jogo tem.** Foram descritas pela equipe do jogo em
18/11/2026 e o catálogo passou a segui-las. Da F03 em diante a progressão
continua sendo proposta (PD-006).

### Por que a F01 não ensina sequência

A primeira versão deste catálogo dava `sequencia` à F01. Com a F01 reduzida ao
que ela realmente é — `on-flag` + `attack` —, isso deixou de se sustentar:
**com uma ação só não há ordem para errar.** O que a F01 ensina é que um
programa começa por um bloco de evento e roda quando se aperta play. Daí o
conceito `evento`.

Quem ensina sequência é a F02, onde avançar antes de atacar é a diferença entre
acertar e não alcançar. Por isso `sequencia` passou a ser dela.

A alternativa considerada era deixar as duas em `sequencia`, fazendo da F02 uma
fase de reforço. **Ela foi descartada por duas consequências no dashboard, as
duas verificadas antes de decidir:**

1. **Um alerta falso, permanente.** O destaque de reforço compara a fase de
   reforço com a introdução e avisa quando o reforço custa mais. A F02 é
   objetivamente mais difícil que a F01 — três blocos contra dois, e ordem que
   importa —, então o painel do professor mostraria *"F02 deveria ser mais
   fácil que F01"* para sempre, por construção.
2. **Um indicador morto.** Numa fase de reforço, o bloco do conceito vem da
   fase que **introduziu** o conceito. A introdução seria a F01, que não
   acrescenta bloco nenhum (é a primeira, não há com o que comparar). A F02
   ficaria com `bloco_conceito = null` e perderia o indicador "venceu aplicando
   o conceito?" — justamente na fase em que `advance` é o conceito.

### O conceito que teve de sair: repetição com condição

A versão anterior deste documento listava uma etapa **"Repetição com condição —
repetir até o inimigo cair (o 'while' do nome do jogo)"**.

**Ela saiu**, porque o jogo não tem bloco de repetição com condição. A única
repetição é `repeat`, com três vezes fixas.

O motivo de sair, e não ficar como aspiração: o indicador de conceito aplicado
(RN-019) pergunta se o jogador venceu *usando* o bloco que a fase ensina. Um
conceito sem bloco que o represente não tem como ser medido, e manter a fase
produziria um indicador vazio no dashboard.

**Se a equipe criar o bloco, o conceito e as fases voltam.** A pergunta está
registrada como **PD-017** e aberta como
[issue #2](https://github.com/laramaia/while_under_attack/issues/2).

Vale notar que o nome do projeto — *while under_attack* — promete um `while`
que a Palette ainda não tem.

> Uma versão mais antiga citava "variáveis" como etapa final. Saiu porque a
> Palette não tem blocos de variável. Volta somente se a equipe criar essa
> categoria.

---

## 5. As fases do jogo estão sendo criadas

Em 18/11/2026 o jogo tem **duas** fases, a F01 e a F02, e foi a partir delas
que este catálogo foi reescrito. Da F03 em diante o que existe é a proposta da
seção 4.

Duas coisas continuam em aberto enquanto o resto é construído:

**De onde sai o `fase_id`** — do catálogo, como a ADR-006 previa, ou do código
do jogo. É a **PD-018**, a mesma armadilha da PD-013: duas listas para a mesma
coisa, feitas em lugares diferentes. Hoje o jogo tem as fases em
`src/model/level.ts`, que **nenhum código usa**
([issue #13](https://github.com/laramaia/while_under_attack/issues/13)), e o
`fase_id` sai de uma constante global.

**A Palette ainda não filtra por fase.** O jogador vê todos os blocos em todas
as fases. O `blocos_disponiveis` deste catálogo descreve o que a fase *deveria*
oferecer, e é essa lista que o ETL lê para deduzir o bloco do conceito — não o
que está na tela. Enquanto as duas não coincidirem, a RN-019 mede a intenção do
catálogo, não a experiência do jogador.

> **Um aviso sobre a F02, para quem for ler o indicador.** Vencer a F02 exige
> `advance`: sem avançar o golpe não alcança. Então "venceu aplicando o
> conceito?" vai dar 100% sempre, não porque a turma aprendeu, mas porque não
> havia alternativa. O indicador só tem informação quando dá para **contornar**
> o bloco — como na F03, onde é possível vencer empilhando três `attack` em vez
> de usar `repeat`. Na F02 ele não mente; ele só não diz nada.

---

## 6. O catálogo e o jogo continuam sendo duas listas

A ADR-006 diz que o `catalogo-fases.json` é a **fonte única**, lida pelo jogo e
pelo ETL. Hoje isso **não é verdade**: o jogo tem o seu próprio
`src/model/defaultCatalog.ts`, e foi o JSON que se alinhou a ele, não o
contrário.

Enquanto forem duas listas, elas podem divergir de novo. Dois caminhos para
fechar de verdade, ambos para a equipe decidir (PD-013):

1. **O jogo passa a ler o `catalogo-fases.json`.** É o que a ADR-006 previa.
2. **O JSON passa a ser gerado a partir do `defaultCatalog.ts`**, por um script
   no build. O jogo continua como está e o arquivo nunca mais atrasa.

Enquanto isso, a oitava regra do gate de qualidade (`CAT-001`, "nenhum bloco do
programa ficou sem categoria") é a rede de proteção: se o jogo mandar um bloco
que o catálogo não conhece, **a gold não é publicada** e o problema aparece na
hora, em vez de virar número errado no dashboard.

> **A segunda divergência já aconteceu, e em dois dias.** Em 16/11/2026 a
> `main` trocou o campo `color` por `colorKey` no `BlockTemplate`. Os
> identificadores, rótulos, categorias e formatos não mudaram — conferi os sete
> blocos um a um e batem — mas ninguém avisou, e só se descobriu olhando. Na
> mesma conferência apareceu que **os rótulos `Avançar` e `Se / Senão` estavam
> sem acento neste catálogo**: erro meu ao transcrever, corrigido no mesmo dia.
> O dashboard lê os rótulos daqui via `GET /api/catalogo`, então ele estava
> escrevendo "Avancar" na tela enquanto o jogo escrevia "Avançar".
>
> Nenhum dos dois casos seria pego pelo `CAT-001`, porque o bloco existe e tem
> categoria. **A rede de proteção cobre bloco desconhecido, não rótulo
> divergente.**

---

## Histórico

| Data | Mudança |
|---|---|
| 13/10/2026 | Versão inicial. Categorias de bloco confirmadas (PD-007) |
| 16/11/2026 | Seção 1 reescrita com os blocos e identificadores reais do jogo. Formato do arquivo atualizado com `rotulo`, `inicia_pilha`, `tem_corpo` e `vezes_fixas`. Nova seção 3 documentando fases de introdução e reforço (RN-020), que antes só existiam no ETL. Progressão reduzida a quatro conceitos: **repetição com condição saiu por não haver bloco** (PD-017). Novas seções 5 e 6: de onde sai o `fase_id` das fases em construção (**PD-018**) e o catálogo e o jogo ainda serem duas listas |
| 16/11/2026 | **O motor de execução entrou na `main`.** Seção 1 ganha o que ele faz de fato: só o `on-flag` executa (**PD-021**) e várias pilhas com `on-flag` rodam em sequência. Rótulos `Avançar` e `Se / Senão` corrigidos — estavam sem acento, divergindo do jogo. Seção 6 registra que a troca de `color` por `colorKey` passou sem aviso |
| 18/11/2026 | **A F01 e a F02 do jogo entraram no catálogo**, descritas pela equipe do jogo, e as fases seguintes andaram uma posição (são seis agora). A F01 passou a ter o conceito `evento` e a `sequencia` passou para a F02, com o porquê e a alternativa descartada na seção 4. Nova seção 3.1: o bloco do conceito deixou de depender da ordem do JSON e passa a ser desempatado pela solução de referência. O `on-start` saiu de `blocos_disponiveis` de todas as fases — está na Palette e não executa ([issue #4](https://github.com/laramaia/while_under_attack/issues/4)). Seção 5 reescrita: a Palette ainda não filtra por fase, e o indicador de conceito da F02 é sempre 100% por construção. `catalog_version` **2026.11.2-rascunho** |
