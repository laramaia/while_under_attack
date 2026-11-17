# Prompts para o Mateo usar com o Gemini CLI

Sequência de prompts para ajudar a **Lara** na parte do **back-end** do
`while under_attack: attack()`.

**Leia isto antes de começar.** O back-end **não existe ainda** — não é
"arrumar a lógica", é **escrever do zero**. O que falta, segundo o
[README](README.md) e o [07-Pendências](docs/07-Pendencias-e-Riscos.md):

1. O endpoint de ingestão `POST /api/eventos` (sem ele, nenhum dado real entra)
2. A autenticação de verdade: seed de contas, login, token (hoje roda com um
   substituto provisório dentro do BI)
3. O registro de lote em `bronze.ingestao_lote` (novo, veja
   `bi/docs/arquitetura-de-referencia.md`, seção 7.3)

Tudo o que vem **depois** da tabela `bronze.eventos` já está pronto e rodando
(ETL, modelo dimensional, API de leitura, dois dashboards). **Não mexer nisso.**

---

## Antes do primeiro prompt

> **O Mateo ainda não é colaborador do repositório.** Isso **não** impede ele de
> trabalhar. O git é local: dá para clonar, criar branch, editar e **commitar**
> sem acesso nenhum ao GitHub. A única operação que precisa de permissão é o
> `git push` — e ela fica para depois, na seção
> [Quando o acesso sair](#quando-o-acesso-sair), no fim deste arquivo.

### Passo 1 — pegar o repositório

O repositório é **público**, então o clone funciona sem credencial nenhuma —
ser colaborador só é necessário para escrever nele:

```
git clone https://github.com/laramaia/while_under_attack.git
cd while_under_attack
git checkout bi/inteligencia-de-negocios
```

A branch `bi/inteligencia-de-negocios` é onde está o trabalho atual, incluindo
este arquivo. A `main` está atrasada em relação a ela.

### Passo 2 — a branch dele e a identidade

```
git checkout -b mateo/backend-ingestao
git config user.name "Mateo <sobrenome>"
git config user.email "<email-do-github-dele>"
```

O `git config` sem `--global` vale só neste repositório. Vale usar **o mesmo
e-mail da conta GitHub dele**: assim, quando os commits forem publicados, o
GitHub reconhece a autoria e os commits aparecem no nome dele — que é o que
prova a participação dele no trabalho.

### Passo 3 — o Gemini

```
node --version            # precisa ser 20 ou maior
npm install -g @google/gemini-cli
gemini
```

O `gemini` tem que ser aberto **de dentro da pasta do repositório** — ele só
enxerga os arquivos da pasta onde foi iniciado.

---

## Prompt 0 — regras permanentes (salvar como `GEMINI.md`)

Este não é para colar no chat: é para criar um arquivo `GEMINI.md` na raiz do
repositório, com este conteúdo. O Gemini CLI lê esse arquivo sozinho em toda
sessão, e assim o Mateo não precisa repetir as regras.

```
# Regras deste repositório

Projeto: while under_attack: attack() — jogo educativo de programação em blocos
mais uma fatia de Inteligência de Negócios. Projeto de faculdade (PEI, Grupo 4).

## Idioma e estilo
- Fale comigo sempre em português do Brasil.
- Nomes de função, variável, tabela e coluna em português, como o resto do projeto.
- Comentários em código (.py, .sql, .ts) SEM acentos — é o padrão já usado no
  repositório. Markdown COM acentos normalmente.
- Todo trecho de código que implementa uma regra do projeto leva o identificador
  dela em comentário: RN-006, ADR-004, PD-013, RS-05 etc.

## A documentação manda
- Os documentos em docs/ são a referência do projeto. Quando o código divergir
  da documentação, isso é um bug: me avise antes de escolher um dos lados.
- O Glossário (docs/02) é o único lugar onde os termos são definidos. Use os
  termos de lá, não invente sinônimos.

## Fronteiras
- A fatia de BI (pasta bi/) está PRONTA e funcionando. Não altere nada dentro de
  bi/src/wua_bi/etl/, bi/src/wua_bi/api/consultas.py nem bi/dashboard/ sem me
  pedir permissão explícita antes.
- NUNCA apague nem mova as funções exigir_acesso_a() e exigir_professor() de
  bi/src/wua_bi/api/auth_provisoria.py. Elas são a RN-004 e a RN-005 e precisam
  continuar existindo num lugar só (ADR-001).
- A tabela bronze.eventos é imutável (RN-016): um gatilho recusa update e delete.

## Como trabalhar
- Antes de escrever código, me diga em 3 ou 4 linhas o que vai fazer e em quais
  arquivos. Espere eu confirmar.
- Mudanças pequenas e verificáveis, uma de cada vez. Nada de refatorar o projeto
  inteiro de uma vez.
- Ao terminar cada tarefa, me explique em português simples o que você fez e por
  quê — alguém da equipe precisa conseguir defender isso numa banca (RS-04).
- Não faça commit sozinho: me mostre o diff e a mensagem proposta, e espere eu
  aprovar. Depois de aprovada, pode rodar o commit.
- NUNCA rode git push, git pull, git fetch nem git merge com o remoto. Eu ainda
  não tenho acesso de escrita a este repositório, e o commit local basta.
- Nunca rode git reset --hard, git checkout -- . nem git clean. Se precisar
  desfazer algo, me diga o que fazer e eu decido.
```

---

## Prompt 1 — entender o projeto

```
Você vai me ajudar neste repositório. Antes de qualquer coisa, leia nesta ordem
e sem pular nada:

1. README.md (a raiz)
2. docs/00-Indice-da-Documentacao.md
3. docs/01-Documento-de-Visao.md
4. docs/02-Glossario-do-Dominio.md
5. docs/03-Regras-de-Negocio.md
6. docs/04-Registro-de-Decisoes-ADR.md

Depois me responda, em português e de forma objetiva:

- O que é este projeto e qual problema ele resolve?
- Quem são os atores e o que cada parte da equipe faz?
- Quais são as duas metades do sistema e onde cada uma mora no repositório?
- Qual é a fronteira entre o back-end e a fatia de BI, e por que ela foi
  desenhada assim?
- Liste as regras de negócio (RN) e as decisões (ADR) que um back-end de
  autenticação e ingestão de eventos precisa obedecer. Para cada uma, uma linha
  dizendo o que ela exige na prática.

Não escreva nenhum código ainda. Só leia e me responda.
```

---

## Prompt 2 — entender exatamente o que falta

```
Agora leia estes quatro, que são os que descrevem a parte que falta:

1. docs/05-Contrato-de-Eventos.md
2. docs/07-Pendencias-e-Riscos.md
3. bi/README.md
4. bi/docs/arquitetura-de-referencia.md — com atenção especial à seção 7.3

E leia também estes dois arquivos de código, que são a referência do que vou
construir:

- bi/db/01_bronze.sql (as tabelas app.jogador, bronze.eventos e
  bronze.ingestao_lote — repare no gatilho de imutabilidade)
- bi/src/wua_bi/gerador.py (procure por "ingestao_lote": ali existe uma
  implementação de referência que abre o lote, grava os eventos com lote_id e
  fecha com as contagens — é exatamente o que o endpoint de ingestão precisa
  fazer)

Me devolva:

a) Uma lista do que o back-end precisa entregar, em ordem de dependência, com um
   título curto para cada item.
b) Para o endpoint POST /api/eventos: a lista dos campos do envelope, quais vêm
   do jogo e quais o servidor preenche, e as três regras que ele precisa cumprir.
c) Quais pendências (PD) em aberto podem me travar ou me fazer refazer trabalho,
   e o que precisa ser decidido pela equipe em cada uma.
d) Uma pergunta objetiva que eu preciso levar para a equipe antes de começar a
   codar — se houver mais de uma, liste todas.

Continue sem escrever código.
```

> **Nota para a equipe:** a pergunta do item (d) que já sabemos que vai aparecer
> é **onde o back-end vai morar** — numa pasta nova `backend/` na raiz, ou
> dentro de `bi/`. A recomendação é `backend/` na raiz, porque a fronteira
> combinada entre back-end e BI é o **banco**, não uma biblioteca. O Prompt 4 já
> assume isso; se a equipe decidir diferente, é só trocar o caminho lá.

---

## Prompt 3 — subir o ambiente e ver o sistema funcionando

```
Vamos subir o ambiente local antes de escrever qualquer coisa. Siga o bi/README.md.

O que eu preciso que você faça:

1. Me diga quais programas preciso ter instalado (versões incluídas) e como
   confiro cada um.
2. Me dê os comandos, um de cada vez, para: criar o .env a partir do
   bi/.env.example, subir o Postgres local pelo docker compose, criar o
   ambiente virtual do Python, instalar o pacote e rodar o ETL completo.
3. Rode os comandos comigo, um por vez, e interprete a saída de cada um. Se der
   erro, me explique a causa antes de tentar consertar.

Sobre qual banco usar: eu tenho acesso aos dois.

- O banco do projeto, no Neon, é o banco compartilhado da equipe. A string de
  conexão está com a Lara e com a Heloisa; eu coloco ela no meu .env local.
- O banco local do docker-compose sobe com um comando e é descartável.

Trabalhe no banco que eu indicar no começo de cada sessão. Se eu não disser
nada, pergunte antes de rodar qualquer comando que escreva dados.

Duas regras ao usar o banco da equipe:
- A tabela bronze.eventos é imutável por gatilho (RN-016): o que entrar nela não
  sai com delete. Então teste de carga, lote repetido e evento inventado eu
  prefiro fazer no banco local, e usar o Neon para a validação final.
- Nunca escreva a string de conexão dentro de um arquivo versionado, nem a
  repita na tela. O lugar dela é o .env, que já está no .gitignore.

No fim, quero ter o ETL rodado com dados sintéticos e a API de leitura no ar.
Me diga qual endereço abrir no navegador e com qual conta de teste entrar para
ver o dashboard do professor.
```

---

## Prompt 4 — esqueleto do back-end

```
Agora vamos começar o back-end. Ele vai ficar numa pasta nova chamada backend/
na raiz do repositório, separada da pasta bi/: a fronteira entre os dois é o
banco de dados, não código compartilhado.

Nesta etapa, só o esqueleto:

- backend/ com um pacote Python próprio e seu próprio arquivo de dependências
- Uma aplicação FastAPI (a ADR-002 registra Python; a PD-011 deixa o framework
  em aberto, e o FastAPI é o que o projeto já usa no BI)
- Leitura da URL do banco por variável de ambiente, no mesmo formato que o BI
  usa (WUA_DB_URL), com um .env.example próprio e o .env no .gitignore
- Um endpoint GET /saude que devolve {"status": "ok", "banco": "ok"} e confirma
  que a conexão com o Postgres funciona
- Um README curto em backend/ explicando como rodar

Regras desta etapa:
- Não criar nenhuma tabela. As tabelas app.jogador, bronze.eventos e
  bronze.ingestao_lote já existem em bi/db/01_bronze.sql e são criadas pelo
  comando do BI. O back-end só escreve nelas.
- Não alterar nada dentro de bi/.
- A porta do back-end tem que ser diferente da porta da API do BI, para os dois
  rodarem ao mesmo tempo na minha máquina.

Antes de criar os arquivos, me mostre a estrutura de pastas que você pretende
criar e espere eu confirmar.
```

---

## Prompt 5 — contas e seed (RN-001, RN-003, ADR-004)

```
Agora o seed de contas de verdade, dentro de backend/.

Requisitos, tirados da documentação:
- RN-001: as contas são pré-criadas por script. Não existe autocadastro.
- RN-003: nome_exibicao é primeiro nome ou apelido, nunca o nome completo.
- ADR-004: a senha é guardada com hash forte — Argon2 ou bcrypt. O hash PBKDF2
  que está hoje em bi/src/wua_bi/api/auth_provisoria.py é provisório e não serve.
- O perfil é 'jogador' ou 'professor'.

O que fazer:
- Um comando de seed no back-end que insere as contas na tabela app.jogador,
  usando bcrypt (ou Argon2, se você justificar a escolha), e que pode rodar mais
  de uma vez sem duplicar conta.
- As contas e as senhas iniciais vêm de um arquivo de configuração ou de
  parâmetros do comando, nunca escritas no meio do código.
- Mostre no final quantas contas foram criadas e quantas já existiam.

Atenção: o gerador sintético do BI (bi/src/wua_bi/gerador.py) também cria contas
de teste com o hash antigo. Me explique o que acontece se as duas coisas rodarem
no mesmo banco, e como evitar que uma quebre a outra. Não altere o gerador sem
me perguntar.

Depois de implementar, rode o seed no banco local e me mostre o resultado com
uma consulta SQL que liste usuario, nome_exibicao e perfil (nunca o hash).
```

---

## Prompt 6 — login e token de verdade

```
Agora a autenticação real, dentro de backend/.

Leia primeiro bi/src/wua_bi/api/auth_provisoria.py inteiro, incluindo a
docstring do topo, e repare que o arquivo tem duas partes bem diferentes:

PODE SER SUBSTITUÍDO: autenticar(), emitir_token(), _ler_token() e o hash.
NÃO PODE SER APAGADO NEM DUPLICADO: exigir_acesso_a() e exigir_professor(). São
a RN-004 e a RN-005, e a ADR-001 escolheu o dashboard próprio justamente para
essa regra viver num lugar só.

O que implementar no back-end:
- POST /login recebendo usuario e senha, conferindo contra o hash do seed, e
  devolvendo token, jogador_id, nome_exibicao e perfil — exatamente esses
  nomes, porque é o que o dashboard já espera.
- Token com prazo de validade e assinatura. Pode ser JWT; justifique a escolha.
- Uma dependência do FastAPI que lê o cabeçalho Authorization: Bearer <token> e
  devolve um objeto com jogador_id, usuario, nome_exibicao e perfil — a mesma
  forma da dataclass Usuario que já existe no BI, para o resto continuar
  funcionando sem mudar.
- Token inválido ou expirado responde 401, com mensagem que não revela se o
  usuário existe.

Não toque em bi/ nesta etapa. Depois de pronto, me mostre como testar o login
pela linha de comando com curl, usando uma das contas do seed.
```

---

## Prompt 7 — o endpoint de ingestão (o item mais importante)

```
Agora o POST /api/eventos, que é a peça que destrava o projeto inteiro.

Leia de novo, com atenção:
- docs/05-Contrato-de-Eventos.md, seções 2, 3, 4 e 7
- bi/docs/arquitetura-de-referencia.md, seção 7.3
- bi/db/01_bronze.sql
- a parte do bi/src/wua_bi/gerador.py que abre e fecha o lote

O endpoint recebe um LOTE de eventos (ADR-007), no formato {"eventos": [ ... ]}.

As regras, todas obrigatórias:

1. RN-006 — jogador_id vem do token, NUNCA do corpo da requisição. Se o corpo
   mandar jogador_id, ignore.
2. RN-015 — event_id repetido é aceito sem erro e não gravado de novo
   (on conflict (event_id) do nothing). NÃO devolva erro no duplicado: se
   devolver, o jogo nunca tira o evento da fila e reenvia para sempre.
3. Envelope inválido ou event_type desconhecido é rejeitado, mas sem derrubar o
   lote inteiro: responda 207 com {"gravados": N, "ignorados": N,
   "rejeitados": [{"event_id": "...", "motivo": "..."}]}.
4. Valide o payload de cada um dos cinco tipos de evento com um modelo Pydantic
   por tipo. O campo mais importante é o "programa" do EV-04: grave no jsonb
   exatamente como veio, aninhado, sem achatar nem reordenar (ADR-005) — é dele
   que saem a contagem da RN-014 e a tabela silver.programa_bloco.
5. received_at fica no padrão now() do banco. Não escreva esse campo (RS-05).
6. origem fica no padrão 'jogo'. 'sintetico' é só do gerador (RS-02).
7. Registre o lote: abra uma linha em bronze.ingestao_lote com
   eventos_recebidos e o jogador_id do token, grave cada evento com esse
   lote_id, e feche o lote com as três contagens. As contagens da tabela são as
   mesmas da resposta 207.

Antes de escrever, me mostre: os modelos Pydantic que você vai criar, o passo a
passo da função e como vai tratar a transação. Espere eu confirmar.
```

---

## Prompt 8 — provar que funciona ponta a ponta

```
Agora vamos testar de verdade, com o banco local.

1. Monte um lote de exemplo com os cinco tipos de evento, seguindo o exemplo da
   seção 5 do docs/05-Contrato-de-Eventos.md e usando identificadores de bloco
   reais (os de src/model/defaultCatalog.ts). Use uma conta do seed.
2. Faça login, pegue o token e mande o lote para o POST /api/eventos. Me mostre
   a resposta.
3. MANDE O MESMO LOTE DE NOVO. A segunda resposta tem que vir com tudo em
   "ignorados" e não gravar nada. Confirme com uma consulta SQL contando as
   linhas de bronze.eventos antes e depois.
4. Mande um lote com um evento bom e um evento com event_type inventado. A
   resposta tem que gravar o bom e rejeitar o ruim, sem derrubar o lote.
5. Consulte bronze.ingestao_lote e confira que gravados + ignorados +
   rejeitados fecha com eventos_recebidos em todos os lotes.
6. Rode o ETL do BI sobre esses dados reais e depois o boletim de qualidade:
   python -m wua_bi.etl rodar
   python -m wua_bi.etl conferir
   Se alguma conferência falhar, me explique qual regra falhou e por quê antes
   de tentar consertar.
7. Olhe a tabela silver.evento_rejeitado e me diga se sobrou alguma coisa lá.

Escreva também testes automatizados para os casos 3 e 4, que são os que mais
importam. Me diga como rodá-los.

Quando tudo isso passar no banco local, me avise: aí eu aponto o .env para o
banco da equipe no Neon e repetimos só os passos 1, 2 e 6, uma vez, para provar
que funciona no banco de verdade. Os passos 3, 4 e 5 ficam fora, porque eles
gravam lote repetido e evento inválido de propósito e a bronze é imutável.
```

---

## Prompt 9 — ligar o dashboard no login novo

> Só fazer depois de combinar com a Heloisa (dona do BI) e com a Lara — esta é a
> única etapa que mexe em arquivos da fatia de BI.

```
Com o login do back-end funcionando, o dashboard precisa passar a usar ele em
vez da autenticação provisória.

Primeiro me mostre, sem alterar nada:
- onde bi/dashboard/app.js faz o login e guarda o token
- o que exatamente mudaria para ele apontar para o back-end
- o que acontece com as chamadas seguintes, que vão com Authorization: Bearer

Depois me diga qual é o caminho MENOS invasivo: mudar o endereço no app.js, ou
fazer a API do BI validar o token emitido pelo back-end. Compare os dois em
três linhas cada e recomende um.

Só implemente depois que eu disser qual. E mantenha exigir_acesso_a() e
exigir_professor() exatamente onde estão.
```

---

## Prompt 10 — documentar (isto conta nota)

```
Última etapa: deixar a documentação coerente com o que foi feito. Neste projeto,
divergência entre código e documentação é tratada como bug.

1. Leia de novo docs/07-Pendencias-e-Riscos.md e me diga quais pendências o
   trabalho de hoje resolveu ou mudou de status — a PD-011 (framework do
   back-end) é uma candidata óbvia.
2. Proponha (sem aplicar) as alterações em:
   - README.md, tabela "Estado"
   - docs/07-Pendencias-e-Riscos.md
   - docs/05-Contrato-de-Eventos.md, se alguma coisa do contrato mudou na prática
   Me mostre o texto exato de cada mudança para eu aprovar uma por uma.
3. Escreva um resumo de meia página, em português simples, com: o que o
   back-end faz agora, quais decisões você tomou e por quê, e o que ainda falta.
   É esse texto que a Lara vai usar para entender e defender o trabalho (RS-04).
4. Liste qualquer divergência que você tenha encontrado entre a documentação e o
   código e que NÃO consertamos — não deixe nada escondido.
```

---

## Prompt 11 — fechar o trabalho

```
Me ajude a fechar este trabalho no git. Eu ainda não tenho acesso de escrita ao
repositório, então vamos commitar LOCALMENTE e deixar o push para depois.

1. Mostre o que mudou (git status e git diff --stat) e me explique cada arquivo
   da lista em uma linha.
2. Confirme que eu estou na branch mateo/backend-ingestao e não em outra.
3. Confirme que nenhum arquivo .env, nenhuma senha e nenhuma string de conexão
   entrou no que vai ser commitado. Se entrou, pare e me avise.
4. Proponha uma mensagem de commit no estilo das mensagens que já existem neste
   repositório — olhe o git log para pegar o padrão (português, imperativo,
   sem emoji, citando o identificador da regra ou pendência quando couber).
5. Depois que eu aprovar a mensagem, faça o commit. Só o commit.
6. NÃO rode git push. Não tenho permissão ainda e o comando vai falhar.

Pode fazer vários commits assim, um por tarefa, ao longo dos dias. Eles ficam
guardados na minha máquina até eu ganhar acesso.
```

> **Importante:** commits locais existem só no computador do Mateo. Se a máquina
> dele morrer, o trabalho morre junto. Enquanto o acesso não sai, vale ele rodar
> `git bundle create ~/backup-wua.bundle --all` de vez em quando e guardar esse
> arquivo em outro lugar — é o repositório inteiro, com histórico, num arquivo só.

---

## Prompts de resgate (quando travar)

Cole qualquer um destes quando o agente se perder:

```
Pare. Você está indo além do que eu pedi. Me diga em 3 linhas o que você mudou
até agora e desfaça o que não fazia parte da tarefa.
```

```
Esse erro eu não entendo. Antes de tentar consertar, me explique: o que o erro
está dizendo, em que arquivo e linha, e quais são as duas causas mais prováveis.
```

```
Releia o docs/05-Contrato-de-Eventos.md e me diga se o que você acabou de
escrever obedece ao contrato campo a campo. Aponte qualquer diferença.
```

```
Você alterou algum arquivo dentro de bi/? Se sim, liste quais e por quê — essa
pasta é de outra pessoa da equipe e está pronta.
```

```
Resuma em 10 linhas o estado atual: o que já funciona, o que está pela metade e
qual é o próximo passo. Vou fechar o terminal e preciso retomar depois.
```

```
Eu ainda não tenho acesso de escrita a este repositório. Confirme que você não
rodou nenhum comando git que fale com o remoto, e que meus commits estão todos
na branch mateo/backend-ingestao.
```

---

## Quando o acesso sair

A Heloisa ou a Lara adicionam o Mateo em **Settings → Collaborators**, no
GitHub. Ele aceita o convite por e-mail. Só então os commits sobem — e sobem
todos de uma vez, com data e autoria originais: o git guarda quando cada commit
foi feito, não quando foi publicado.

Como ele clonou do GitHub, o remoto já está configurado. Só falta:

```
git fetch origin
```

```
git rebase origin/bi/inteligencia-de-negocios
```

```
git push -u origin mateo/backend-ingestao
```

O `push` só vai funcionar depois que o convite de colaborador for aceito. Antes
disso ele responde `403` — o que é esperado, não é erro de configuração.

### Sobre o rebase

A branch `bi/inteligencia-de-negocios` vai ter andado enquanto ele trabalhava
offline. O `rebase` pega os commits dele e reaplica em cima do que mudou, para
o histórico ficar numa linha só em vez de um emaranhado.

Se der conflito, **não é para resolver no chute**. Prompt para colar:

```
O rebase deu conflito. Para cada arquivo em conflito, me mostre os dois lados e
me explique o que cada um estava tentando fazer. Não resolva nada ainda: eu
preciso entender antes, e talvez precise perguntar para quem escreveu o outro
lado. Se o conflito for em arquivo dentro de bi/, pare imediatamente e me avise
— essa pasta é de outra pessoa.
```

Se ele preferir não arriscar o rebase, `git push -u origin mateo/backend-ingestao`
sem rebase nenhum também funciona. O histórico fica menos limpo, e os conflitos
aparecem na hora de abrir o Pull Request — o que é até melhor, porque aí a
equipe inteira vê.

### Depois do push

Abrir um **Pull Request** de `mateo/backend-ingestao` para
`bi/inteligencia-de-negocios`, não para a `main`. A descrição pode ser o resumo
de meia página que saiu do Prompt 10 — ele já foi escrito exatamente para isso.

E o RS-04 vale aqui: alguém da equipe precisa conseguir **explicar cada parte
na banca**. O Pull Request é onde essa revisão acontece.
