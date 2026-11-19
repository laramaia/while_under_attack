# Pitch da banca — 3 minutos, 4 integrantes

**while under_attack: attack()** · Projeto Extensionista Integrador — Grupo 4

Os slides estão em <https://claude.ai/artifact/LfPbhoZ6273iNVs8Fzgucr> e as falas
abaixo também estão nas notas de cada slide.

---

## Relógio

**Cada pessoa fala uma vez só, na ordem, e não volta.** Como são seis slides e
quatro pessoas, duas falas cobrem dois slides seguidos — o slide vira, mas quem
está falando continua.

| Quando | Fala | Quem | Slides | Duração |
|---|---|---|---|---|
| 0:00 | 1 | **Joao Manoel** | Capa · O problema | 50s |
| 0:50 | 2 | **Mateo** | A solução | 35s |
| 1:25 | 3 | **Heloisa** | O caminho do dado | 45s |
| 2:10 | 4 | **Lara** | O que o dado responde · Fecho | 50s |

Está escrito para **2:50**. Os dez segundos de folga são para as pausas e as
três trocas de pessoa — não encha esse espaço.

> **A fala 3 é o tema do semestre.** É onde as três camadas aparecem com nome e
> função, e é a parte que a banca mais vai querer puxar.

---

## Fala 1 — Joao Manoel · dois slides · 0:00 · 50s

*Na capa ele aparece como **Analista de Governança de Dados**.*

### Slide "Capa" (20s)

> Boa tarde. Nosso projeto se chama **while under_attack**. É um jogo de
> programação em blocos — e é também um estudo sobre uma pergunta que a sala de
> aula quase nunca responde: **o aluno aprendeu mesmo, ou só acertou?**

*Diga o nome do projeto devagar, deixe a pergunta no ar um segundo, e siga — você
continua falando.*

### Slide "O problema" (30s)

> Ensinar lógica de programação tem um problema antigo. O professor vê quem
> terminou, **não quem entendeu**.
>
> Duas crianças chegam na mesma resposta: uma usou o conceito que a aula
> ensinou, a outra contornou. Na tela, as duas acertaram.
>
> E quando a turma trava, ele descobre tarde — pela prova.
>
> **Não falta exercício. Falta evidência.**

*A última frase é o gancho do pitch inteiro. Pause nela e entregue a palavra.*

---

## Fala 2 — Mateo · a solução · 0:50 · 35s

> A nossa resposta é um jogo. O jogador monta um programa com blocos —
> **avançar, atacar, repetir** — e o guerreiro executa exatamente o que ele
> montou. Se a ordem está errada, o golpe não alcança. Se o programa é curto
> demais, o inimigo sobra em pé.
>
> São seis fases, cada uma ensinando um conceito: evento, sequência, repetição,
> condicional.
>
> Mas o jogo não é o produto. **O produto é o que ele registra** — cada
> tentativa, cada bloco, cada derrota vira dado.

*Os blocos são a sua parte no projeto: fale deles com propriedade, gesticulando
as três ações. A última frase é a ponte para a Heloisa.*

---

## Fala 3 — Heloisa · o caminho do dado · 1:25 · 45s

> Cada partida emite **cinco tipos de evento**, e eles passam por três camadas —
> a arquitetura **Medallion**, em PostgreSQL.
>
> Na **bronze** fica o evento exatamente como chegou, imutável: a gente não
> corrige dado, a gente reprocessa.
>
> Da bronze a **silver** reconstrói o que aconteceu — sessões, tentativas e cada
> bloco que o jogador encaixou.
>
> E a **gold** é o modelo dimensional: um **modelo estrela**, duas tabelas de
> fato e cinco dimensões, que é o que o dashboard lê.
>
> Entre a silver e a gold existe um **portão**: onze regras de qualidade, dentro
> da mesma transação. Se uma só reprova, nada é publicado.
>
> A transformação roda em **Apache Spark**, orquestrada por **Apache Airflow**.

*Diga "bronze", "silver" e "gold" apontando para os cartões, um de cada vez — é o
que o professor quer ouvir. Aponte para o cartão laranja ao dizer "portão".
Ao terminar, passe a palavra para a Lara.*

**Se sobrar tempo**, a frase que fecha a ideia: *"é por isso que a gente pode
chamar o dado de certificado — é verificável, não é adjetivo"*.

---

## Fala 4 — Lara · dois slides · 2:10 · 50s

### Slide "O que o dado responde" (35s)

> No fim da esteira, dois dashboards. O do **jogador** mostra onde ele travou e
> qual conceito revisar. O do **professor** mostra a turma inteira: em que fase
> ela para, quantas tentativas até vencer, e — o indicador que mais importa —
> **quantos venceram usando o conceito e quantos contornaram**.
>
> Foi assim que o próprio dashboard nos avisou de uma fase que estava sendo
> vencida sem o conceito que ela ensina. O jogo estava cobrando a coisa errada.

*Diga a última frase devagar e siga direto para o fecho — você continua falando.*

### Slide "Fecho" (15s)

> **O jogo ensina. O dado diz se funcionou.** E quando não funciona, ele diz
> onde — enquanto ainda dá tempo de mudar a aula.
>
> Obrigada.

*Fecha o círculo aberto na capa. Pause um segundo antes. Se puderem, deem um
passo à frente juntos.*

---

## Se a banca perguntar

As quatro primeiras são da **Heloisa** — é a fatia dela, e é de onde a maioria
das perguntas vem. Combinem antes o gesto de passar a pergunta para ela.

**"Como funciona o gate de qualidade?"**
São onze regras, cada uma citando a regra de negócio que verifica. Rodam dentro
da transação do ETL: se uma reprova, tudo volta atrás e a gold continua na última
versão aprovada. O boletim da última execução fica gravado no banco — dá para
mostrar na hora.

**"Por que modelo estrela e não uma tabela só?"**
Porque as perguntas do professor e as do jogador são diferentes: uma olha a
turma por fase, a outra olha a trajetória de uma pessoa. Duas tabelas de fato
(tentativa e progresso por fase) sobre as mesmas cinco dimensões respondem as
duas sem duplicar regra.

**"Por que não Power BI?"**
Licença paga para o controle de acesso por perfil que o projeto precisa. Está
registrado como decisão de arquitetura, com alternativa e custo aceito.

**"Spark para esse volume?"**
A arquitetura de referência pede o produto, e ele está lá. Rodamos os dois
motores lado a lado e medimos: **mesmo resultado, 60x o tempo**. Ter o número é
melhor do que ter só o argumento — e a decisão fica defensável nos dois sentidos.

**"E a LGPD?"**
Sem autocadastro, sem coleta de e-mail, apelido no lugar do nome completo, e o
jogador só acessa os próprios dados — a regra de permissão vive num lugar só.

---

## Antes de subir no palco

- [ ] Ensaiar cronometrado **duas vezes** — o estouro quase sempre está na fala 3
- [ ] Joao Manoel e Lara: treinar a virada de slide **sem parar de falar**
- [ ] Combinar o gesto de passar uma pergunta técnica para a Heloisa
- [ ] Combinar quem passa o slide (uma pessoa só, do começo ao fim)
- [ ] Abrir o dashboard numa aba, caso peçam para ver
- [ ] Incluir o Joao Manoel (Analista de Governança de Dados) na tabela de papéis do README — a capa já traz o papel dele, o README ainda não
