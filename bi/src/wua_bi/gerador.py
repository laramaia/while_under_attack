"""Gerador de eventos sinteticos.

Existe por causa do RS-01: o contrato de eventos foi fechado cedo justamente
para que o dashboard pudesse avancar em paralelo ao jogo, com dados simulados.
Enquanto o jogo nao envia eventos de verdade, e daqui que a bronze se alimenta.

Tudo o que sai daqui entra na bronze com origem = 'sintetico' (RS-02). Quando
o jogo comecar a enviar, a unica coisa que muda e a origem da bronze: ETL,
gold, API e dashboard continuam iguais.

Os eventos respeitam o Contrato de Eventos, secao 2 e secao 3. Se o contrato
mudar, este arquivo quebra junto com o ETL, que e o comportamento desejado.
"""

from __future__ import annotations

import copy
import hashlib
import json
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator

from . import config, db
from .catalogo import Catalogo, Fase, catalogo_padrao
from .programa import contar_blocos

SCHEMA_VERSION = 1
GAME_VERSION = "0.3.0-sintetico"

# Perfis de jogador. "habilidade" alta = vence em menos tentativas e com um
# programa mais perto da solucao de referencia.
NOMES = [
    ("ana", "Ana", 0.85),
    ("bruno", "Bruno", 0.70),
    ("carla", "Carla", 0.55),
    ("diego", "Diego", 0.40),
    ("elisa", "Elisa", 0.75),
    ("felipe", "Felipe", 0.30),
    ("gabi", "Gabi", 0.60),
    ("hugo", "Hugo", 0.45),
    ("ines", "Ines", 0.80),
    ("joao", "Joao", 0.35),
]


def _hash_senha(senha: str) -> str:
    """Hash provisorio das contas de teste.

    A ADR-004 pede Argon2 ou bcrypt. Aqui vale PBKDF2 da biblioteca padrao
    porque sao contas de desenvolvimento e nao queremos uma dependencia a mais
    so para isso. Quando o back-end assumir a autenticacao, isto sai.
    """
    sal = b"wua-dev"
    return hashlib.pbkdf2_hmac("sha256", senha.encode(), sal, 100_000).hex()


# ---------------------------------------------------------------------------
# Construcao dos programas
# ---------------------------------------------------------------------------

def _renumerar(programa: dict[str, Any]) -> dict[str, Any]:
    """Da ids b1, b2, ... ao programa inteiro.

    O contrato permite reiniciar os ids a cada tentativa (secao 4), e e isso
    que o jogo deve fazer.
    """
    contador = iter(range(1, 10_000))

    def visitar(sequencia: list[dict[str, Any]]) -> None:
        for bloco in sequencia:
            bloco["id"] = f"b{next(contador)}"
            for campo in ("corpo", "senao"):
                if bloco.get(campo):
                    visitar(bloco[campo])

    for pilha in programa["pilhas"]:
        visitar(pilha)
    return programa


def _pilha_principal(programa: dict[str, Any]) -> list[dict[str, Any]]:
    return programa["pilhas"][0]


def _programa_curto(fase: Fase, rng: random.Random) -> dict[str, Any]:
    """Programa que acaba antes de derrubar o inimigo.

    Gera a derrota da RN-008: o programa termina, o inimigo ataca ate o
    guerreiro morrer.
    """
    programa = copy.deepcopy(fase.solucao_referencia)
    pilha = _pilha_principal(programa)
    # mantem o bloco de evento e corta o resto pela metade
    corte = rng.randint(1, max(1, len(pilha) - 1))
    programa["pilhas"][0] = pilha[:corte]
    return _renumerar(programa)


def _programa_errado(fase: Fase, rng: random.Random) -> dict[str, Any]:
    """Programa com tamanho plausivel mas logica errada.

    Gera a outra derrota da RN-008: a execucao para num bloco especifico.
    """
    programa = copy.deepcopy(fase.solucao_referencia)
    pilha = _pilha_principal(programa)

    if len(pilha) > 2 and rng.random() < 0.5:
        # ordem trocada: ataca antes de chegar perto
        i = rng.randrange(1, len(pilha) - 1)
        pilha[i], pilha[i + 1] = pilha[i + 1], pilha[i]
    else:
        # parametro errado: anda de menos ou repete de menos
        for bloco in pilha:
            if "params" in bloco:
                chave = next(iter(bloco["params"]))
                bloco["params"][chave] = max(1, bloco["params"][chave] - rng.randint(1, 2))
                break

    return _renumerar(programa)


def _desenrolar(pilha: list[dict[str, Any]], bloco_conceito: str, rng: random.Random) -> bool:
    """Troca o bloco que a fase ensina pelo seu corpo repetido na mao.

    E o que um jogador faz quando vence a fase sem ter entendido o conceito:
    em vez de "repetir 3 vezes [atacar]", ele empilha "atacar" tres vezes. O
    programa funciona, fica maior que a referencia e nao usa o bloco novo —
    exatamente o caso que o indicador de conceito aplicado existe para achar.
    """
    for i, bloco in enumerate(pilha):
        if bloco.get("tipo") != bloco_conceito:
            continue

        corpo = bloco.get("corpo") or []
        if bloco_conceito == "repetir":
            vezes = (bloco.get("params") or {}).get("vezes", 3)
        elif bloco_conceito == "enquanto":
            vezes = rng.randint(3, 5)
        else:  # "se": o jogador simplesmente faz a acao sempre
            vezes = 1

        pilha[i:i + 1] = [copy.deepcopy(b) for _ in range(vezes) for b in corpo]
        return True

    return False


def _programa_vencedor(
    fase: Fase, rng: random.Random, habilidade: float, bloco_conceito: str | None
) -> dict[str, Any]:
    """Programa que vence, mais ou menos enxuto conforme a habilidade.

    Alimenta a RN-014: quanto mais blocos a mais em relacao a referencia,
    menor a eficiencia do codigo.
    """
    programa = copy.deepcopy(fase.solucao_referencia)
    pilha = _pilha_principal(programa)

    # quem tem menos habilidade as vezes vence contornando o conceito
    if bloco_conceito and rng.random() < (1 - habilidade) * 0.55:
        _desenrolar(pilha, bloco_conceito, rng)

    # quem tem menos habilidade deixa blocos redundantes no programa
    excedentes = max(0, int(round((1 - habilidade) * rng.uniform(0, 6))))
    for _ in range(excedentes):
        pilha.insert(rng.randrange(1, len(pilha) + 1), {"tipo": "atacar"})

    # as vezes sobra uma pilha solta no Workspace, sem bloco de evento.
    # Ela conta no programa mas nao executa (RN-018).
    if rng.random() < 0.15:
        programa["pilhas"].append([{"tipo": "andar", "params": {"passos": 1}}])

    return _renumerar(programa)


# ---------------------------------------------------------------------------
# Simulacao
# ---------------------------------------------------------------------------

class _Relogio:
    """Avanca o tempo da simulacao e devolve o instante em ISO 8601 UTC."""

    def __init__(self, inicio: datetime) -> None:
        self.agora = inicio

    def avancar(self, segundos: float) -> datetime:
        self.agora += timedelta(seconds=segundos)
        return self.agora


def _envelope(
    event_type: str,
    session_id: str,
    seq: int,
    quando: datetime,
    catalog_version: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Envelope comum do Contrato de Eventos, secao 2.

    `_received_at` nao faz parte do envelope: quem grava e a API. Vai junto
    aqui so para o gerador simular o atraso entre acontecer no celular e
    chegar no servidor, que e o que o ETL usa para ordenar (RS-05).
    """
    return {
        "event_id": str(uuid.uuid4()),
        "event_type": event_type,
        "schema_version": SCHEMA_VERSION,
        "catalog_version": catalog_version,
        "game_version": GAME_VERSION,
        "session_id": session_id,
        "seq": seq,
        "occurred_at": quando.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "payload": payload,
        "_received_at": quando + timedelta(seconds=random.Random(seq).uniform(0.2, 4)),
    }


def _simular_fase(
    fase: Fase,
    habilidade: float,
    rng: random.Random,
    relogio: _Relogio,
    session_id: str,
    proximo_seq: Iterator[int],
    catalog_version: str,
    bloco_conceito: str | None,
) -> tuple[list[dict[str, Any]], bool]:
    """Tentativas de um jogador numa fase, ate vencer ou desistir."""
    eventos: list[dict[str, Any]] = [
        _envelope("fase_iniciada", session_id, next(proximo_seq),
                  relogio.avancar(rng.uniform(2, 15)), catalog_version,
                  {"fase_id": fase.fase_id})
    ]

    # Quantas tentativas o jogador faz nesta visita a fase antes de largar e
    # voltar noutra sessao. Fase mais avancada cansa mais rapido.
    maximo = max(1, min(5, int(round((2 + fase.ordem * 0.5) * (1.6 - habilidade)
                                     + rng.uniform(-1, 1)))))

    # Chance de a tentativa dar certo. Cai com a ordem da fase e sobe com a
    # habilidade: e isso que faz uns jogadores travarem no meio da progressao
    # e o funil do professor ter o que mostrar.
    chance_vitoria = min(0.90, max(0.06, 0.12 + habilidade * 0.85 - fase.ordem * 0.07))
    venceu = False

    for _ in range(maximo):
        if rng.random() < chance_vitoria:
            resultado = "vitoria"
            programa = _programa_vencedor(fase, rng, habilidade, bloco_conceito)
        elif rng.random() < 0.12:
            resultado = "interrompida"
            programa = _programa_errado(fase, rng)
        elif rng.random() < 0.45:
            resultado = "derrota"
            programa = _programa_curto(fase, rng)
        else:
            resultado = "derrota"
            programa = _programa_errado(fase, rng)

        tentativa_id = str(uuid.uuid4())
        tempo_edicao_ms = int(rng.uniform(8, 70) * 1000 * (1.4 - habilidade))

        eventos.append(_envelope(
            "tentativa_executada", session_id, next(proximo_seq),
            relogio.avancar(tempo_edicao_ms / 1000), catalog_version,
            {
                "tentativa_id": tentativa_id,
                "fase_id": fase.fase_id,
                "programa": programa,
                "tempo_edicao_ms": tempo_edicao_ms,
            },
        ))

        duracao_ms = int(rng.uniform(3, 20) * 1000)

        if resultado == "vitoria":
            # RN-010: a vida do inimigo chegou a zero
            payload_fim = {
                "resultado": "vitoria",
                "vida_guerreiro_final": rng.randint(10, 100),
                "vida_inimigo_final": 0,
                "programa_concluido": rng.random() < 0.8,
            }
            venceu = True
        elif resultado == "interrompida":
            # RN-009: Stop encerra a tentativa
            payload_fim = {
                "resultado": "interrompida",
                "vida_guerreiro_final": rng.randint(20, 100),
                "vida_inimigo_final": rng.randint(10, 100),
                "programa_concluido": False,
            }
            duracao_ms = int(rng.uniform(1, 6) * 1000)
        else:
            # RN-008: as duas causas de derrota. programa_concluido = true
            # significa que o programa acabou e o inimigo atacou depois.
            curto = contar_blocos(programa) < fase.tamanho_referencia
            payload_fim = {
                "resultado": "derrota",
                "vida_guerreiro_final": 0,
                "vida_inimigo_final": rng.randint(5, 90),
                "programa_concluido": curto,
            }

        # EV-05: bloco_em_execucao_id e nulo quando o programa ja tinha acabado
        if payload_fim["programa_concluido"]:
            payload_fim["bloco_em_execucao_id"] = None
        else:
            # o bloco de evento so inicia a pilha: a execucao nunca para nele
            pilha = _pilha_principal(programa)[1:] or _pilha_principal(programa)
            payload_fim["bloco_em_execucao_id"] = rng.choice(pilha)["id"]

        payload_fim["tentativa_id"] = tentativa_id
        payload_fim["fase_id"] = fase.fase_id
        payload_fim["duracao_execucao_ms"] = duracao_ms

        eventos.append(_envelope(
            "tentativa_finalizada", session_id, next(proximo_seq),
            relogio.avancar(duracao_ms / 1000), catalog_version, payload_fim,
        ))

        if resultado == "vitoria":
            # RN-013: rejogar nao altera os indicadores. Simulamos o rejogo de
            # vez em quando, justamente para o ETL ter de ignora-lo.
            if rng.random() < 0.15:
                continue
            break

    return eventos, venceu


def gerar(
    qtd_jogadores: int = 10,
    dias: int = 21,
    semente: int = 42,
    catalogo: Catalogo | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Devolve (contas, eventos). Nao grava nada."""
    cat = catalogo or catalogo_padrao()
    rng = random.Random(semente)

    contas = [
        {"usuario": u, "nome_exibicao": n, "perfil": "jogador", "habilidade": h}
        for u, n, h in NOMES[:qtd_jogadores]
    ]
    contas.append(
        {"usuario": "professor", "nome_exibicao": "Professor", "perfil": "professor",
         "habilidade": 0.0}
    )

    fases = sorted(cat.fases, key=lambda f: f.ordem)
    eventos: list[dict[str, Any]] = []
    inicio = datetime.now(timezone.utc) - timedelta(days=dias)

    for conta in contas:
        if conta["perfil"] != "jogador":
            continue  # professor nao joga (Glossario)

        habilidade = conta["habilidade"]
        relogio = _Relogio(inicio + timedelta(hours=rng.uniform(0, 24)))
        fase_atual = 0
        eventos_do_jogador: list[dict[str, Any]] = []

        # cada jogador joga em algumas sessoes ao longo do periodo
        for _ in range(rng.randint(3, 7)):
            if fase_atual >= len(fases):
                break

            session_id = str(uuid.uuid4())
            seq = iter(range(1, 100_000))
            relogio.avancar(rng.uniform(6, 48) * 3600)

            eventos_do_jogador.append(_envelope(
                "sessao_iniciada", session_id, next(seq), relogio.agora,
                cat.catalog_version, {},
            ))

            # 1 a 3 fases por sessao
            for _ in range(rng.randint(1, 3)):
                if fase_atual >= len(fases):
                    break
                evs, venceu = _simular_fase(
                    fases[fase_atual], habilidade, rng, relogio, session_id,
                    seq, cat.catalog_version, cat.bloco_do_conceito(fases[fase_atual]),
                )
                eventos_do_jogador.extend(evs)
                if venceu:
                    # RN-017 / PD-010: a proxima fase so abre apos a conclusao
                    fase_atual += 1
                else:
                    break  # travou nesta fase, volta na proxima sessao

            # Contrato de Eventos EV-02: nem sempre o app consegue enviar o
            # encerramento. Em 30% das sessoes ele some, e a silver fecha a
            # sessao por inatividade.
            if rng.random() < 0.70:
                motivo = rng.choice(["logout", "app_em_segundo_plano"])
                eventos_do_jogador.append(_envelope(
                    "sessao_encerrada", session_id, next(seq),
                    relogio.avancar(rng.uniform(5, 60)), cat.catalog_version,
                    {"motivo": motivo},
                ))

        eventos.append({"usuario": conta["usuario"], "eventos": eventos_do_jogador})

    _encostar_no_presente(eventos)
    return contas, eventos


def _encostar_no_presente(por_jogador: list[dict[str, Any]]) -> None:
    """Desloca todos os eventos para que o mais recente caia perto de hoje.

    Sem isso a simulacao termina onde o acaso a deixou, as vezes semanas atras,
    e o dashboard mostra a turma inteira como parada. O deslocamento e o mesmo
    para todos, entao a distancia entre os jogadores se mantem: uns continuam
    ativos, outros aparecem parados, que e o que o indicador deve pegar.
    """
    todos = [e for bloco in por_jogador for e in bloco["eventos"]]
    if not todos:
        return

    ultimo = max(e["_received_at"] for e in todos)
    deslocamento = (datetime.now(timezone.utc) - timedelta(hours=6)) - ultimo

    for evento in todos:
        evento["_received_at"] += deslocamento
        quando = datetime.fromisoformat(evento["occurred_at"].replace("Z", "+00:00"))
        evento["occurred_at"] = (
            (quando + deslocamento).isoformat().replace("+00:00", "Z")
        )


def gravar_na_bronze(
    qtd_jogadores: int = 10,
    dias: int = 21,
    semente: int = 42,
    limpar: bool = False,
) -> dict[str, int]:
    """Cria as contas de teste e grava os eventos na bronze."""
    cat = catalogo_padrao()
    problemas = cat.validar()
    if problemas:
        raise ValueError("catalogo invalido:\n  " + "\n  ".join(problemas))

    contas, por_jogador = gerar(qtd_jogadores, dias, semente, cat)
    total = 0

    with db.conectar() as conexao, conexao.cursor() as cursor:
        if limpar:
            # A bronze e imutavel (RN-016), entao desligamos o gatilho de
            # proposito e so para o dado sintetico. Dado real nunca passa por
            # aqui: o filtro e por origem.
            cursor.execute("alter table bronze.eventos disable trigger trg_eventos_imutavel")
            cursor.execute("delete from bronze.eventos where origem = 'sintetico'")
            cursor.execute("alter table bronze.eventos enable trigger trg_eventos_imutavel")
            # Os lotes sinteticos saem junto com os eventos deles, senao a
            # reconciliacao REC-002 passa a comparar lotes velhos com eventos
            # novos e reprova o gate sem haver problema nenhum.
            cursor.execute("delete from bronze.ingestao_lote where origem = 'sintetico'")

        ids: dict[str, int] = {}
        for conta in contas:
            cursor.execute(
                """
                insert into app.jogador (usuario, senha_hash, nome_exibicao, perfil)
                values (%(usuario)s, %(senha_hash)s, %(nome_exibicao)s, %(perfil)s)
                on conflict (usuario) do update
                    set nome_exibicao = excluded.nome_exibicao
                returning jogador_id
                """,
                {
                    "usuario": conta["usuario"],
                    "senha_hash": _hash_senha(conta["usuario"]),
                    "nome_exibicao": conta["nome_exibicao"],
                    "perfil": conta["perfil"],
                },
            )
            ids[conta["usuario"]] = cursor.fetchone()["jogador_id"]

        for bloco in por_jogador:
            jogador_id = ids[bloco["usuario"]]

            # Um lote por jogador, imitando o que o endpoint de ingestao fara
            # (ADR-007: o jogo envia em lote). Isso existe por dois motivos:
            # deixa a reconciliacao REC-002 com dado de verdade para comparar,
            # e serve de implementacao de referencia para o back-end - as
            # contagens abaixo sao as mesmas que o POST /api/eventos precisa
            # devolver (gravados / ignorados / rejeitados).
            cursor.execute(
                """
                insert into bronze.ingestao_lote
                    (jogador_id, origem, eventos_recebidos, detalhe)
                values (%s, 'sintetico', %s, %s)
                returning lote_id
                """,
                (jogador_id, len(bloco["eventos"]),
                 json.dumps({"fonte": "gerador sintetico", "usuario": bloco["usuario"]})),
            )
            lote_id = cursor.fetchone()["lote_id"]

            gravados = 0
            for evento in bloco["eventos"]:
                cursor.execute(
                    """
                    insert into bronze.eventos (
                        event_id, event_type, schema_version, catalog_version,
                        game_version, session_id, seq, occurred_at, payload,
                        jogador_id, received_at, origem, lote_id
                    ) values (
                        %(event_id)s, %(event_type)s, %(schema_version)s,
                        %(catalog_version)s, %(game_version)s, %(session_id)s,
                        %(seq)s, %(occurred_at)s, %(payload)s, %(jogador_id)s,
                        %(received_at)s, 'sintetico', %(lote_id)s
                    )
                    on conflict (event_id) do nothing
                    """,
                    {**evento,
                     "payload": json.dumps(evento["payload"]),
                     "jogador_id": jogador_id,
                     "received_at": evento["_received_at"],
                     "lote_id": lote_id},
                )
                gravados += cursor.rowcount

            # on conflict do nothing: o que nao gravou foi duplicado (RN-015).
            cursor.execute(
                """
                update bronze.ingestao_lote
                   set eventos_gravados = %s, eventos_ignorados = %s
                 where lote_id = %s
                """,
                (gravados, len(bloco["eventos"]) - gravados, lote_id),
            )
            total += gravados

        conexao.commit()

    return {"contas": len(contas), "eventos": total}
