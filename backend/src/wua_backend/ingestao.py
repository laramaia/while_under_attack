"""Ingestao de lotes de eventos na camada bronze (ADR-005, ADR-007, RN-006, RN-015, RN-016, RS-02, RS-05).

Implementa o Contrato de Eventos (docs/05-Contrato-de-Eventos.md, secoes 2, 3, 4 e 7)
e o controle de ingestao por lote (bi/docs/arquitetura-de-referencia.md, secao 7.3).
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

from . import db

TIPOS_EVENTO_CONHECIDOS = {
    "sessao_iniciada",       # EV-01
    "sessao_encerrada",      # EV-02
    "fase_iniciada",         # EV-03
    "tentativa_executada",   # EV-04
    "tentativa_finalizada",  # EV-05
}


# ---------------------------------------------------------------------------
# Modelos Pydantic do Programa (Contrato de Eventos, secao 4; ADR-005)
# ---------------------------------------------------------------------------

class BlocoPrograma(BaseModel):
    """Instancia de bloco dentro de uma pilha do programa (secao 4)."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    tipo: str = Field(min_length=1)
    corpo: list[BlocoPrograma] | None = None
    senao: list[BlocoPrograma] | None = None
    params: dict[str, Any] | None = None
    condicao: dict[str, Any] | None = None


class Programa(BaseModel):
    """Snapshot estruturado do programa no momento do Play (ADR-005, RN-014, RN-018)."""

    model_config = ConfigDict(extra="forbid")

    pilhas: list[list[BlocoPrograma]]


# Resolve referencia recursiva de BlocoPrograma -> list[BlocoPrograma].
BlocoPrograma.model_rebuild()


# ---------------------------------------------------------------------------
# Modelos Pydantic por tipo de evento (Contrato de Eventos, secao 3)
# ---------------------------------------------------------------------------

class PayloadSessaoIniciada(BaseModel):
    """EV-01: sessao_iniciada. Payload vazio {}."""

    model_config = ConfigDict(extra="forbid")


class PayloadSessaoEncerrada(BaseModel):
    """EV-02: sessao_encerrada."""

    model_config = ConfigDict(extra="forbid")

    motivo: Literal["logout", "app_em_segundo_plano"]


class PayloadFaseIniciada(BaseModel):
    """EV-03: fase_iniciada."""

    model_config = ConfigDict(extra="forbid")

    fase_id: str = Field(min_length=1)


class PayloadTentativaExecutada(BaseModel):
    """EV-04: tentativa_executada (ADR-005, RN-007)."""

    model_config = ConfigDict(extra="forbid")

    tentativa_id: UUID
    fase_id: str = Field(min_length=1)
    programa: Programa
    tempo_edicao_ms: int = Field(ge=0)
    disparo: Literal["jogador", "tempo_esgotado"] | None = None


class PayloadTentativaFinalizada(BaseModel):
    """EV-05: tentativa_finalizada (RN-007, RN-008, RN-009, RN-010)."""

    model_config = ConfigDict(extra="forbid")

    tentativa_id: UUID
    fase_id: str = Field(min_length=1)
    resultado: Literal["vitoria", "derrota", "interrompida"]
    duracao_execucao_ms: int = Field(ge=0)
    vida_guerreiro_final: int = Field(ge=0)
    vida_inimigo_final: int = Field(ge=0)
    programa_concluido: bool
    bloco_em_execucao_id: str | None = None

    @model_validator(mode="after")
    def _coerencia_programa_concluido(self) -> PayloadTentativaFinalizada:
        # Contrato de Eventos, secao 3 (EV-05): null se programa_concluido = true.
        if self.programa_concluido and self.bloco_em_execucao_id is not None:
            raise ValueError(
                "bloco_em_execucao_id deve ser null quando programa_concluido = true"
            )
        return self


MODELOS_PAYLOAD: dict[str, type[BaseModel]] = {
    "sessao_iniciada": PayloadSessaoIniciada,
    "sessao_encerrada": PayloadSessaoEncerrada,
    "fase_iniciada": PayloadFaseIniciada,
    "tentativa_executada": PayloadTentativaExecutada,
    "tentativa_finalizada": PayloadTentativaFinalizada,
}


# ---------------------------------------------------------------------------
# Envelope comum e pedido de lote (Contrato de Eventos, secoes 2 e 7; ADR-007)
# ---------------------------------------------------------------------------

class EnvelopeEvento(BaseModel):
    """Envelope comum de todo evento (Contrato de Eventos, secao 2).

    Usa extra='ignore' de proposito: se o corpo trouxer jogador_id, received_at,
    origem ou lote_id, esses campos sao ignorados (RN-006, RS-02, RS-05).
    """

    model_config = ConfigDict(extra="ignore")

    event_id: UUID
    event_type: str
    schema_version: int
    catalog_version: str = Field(min_length=1)
    game_version: str = Field(min_length=1)
    session_id: UUID
    seq: int = Field(ge=1)
    occurred_at: datetime
    payload: dict[str, Any]

    @field_validator("event_type")
    @classmethod
    def _validar_tipo(cls, valor: str) -> str:
        if valor not in TIPOS_EVENTO_CONHECIDOS:
            raise ValueError("event_type desconhecido")
        return valor

    @field_validator("schema_version")
    @classmethod
    def _validar_schema_version(cls, valor: int) -> int:
        if valor != 1:
            raise ValueError("schema_version nao suportada (esperado: 1)")
        return valor


class PedidoLoteEventos(BaseModel):
    """Corpo do POST /api/eventos (ADR-007).

    A lista aceita itens brutos (Any) para que um evento malformado nao derrube
    o lote inteiro com 422; cada item e validado individualmente e reportado na
    resposta 207.
    """

    eventos: list[Any]


def _resumir_erro_validacao(erro: ValidationError) -> str:
    """Extrai um motivo curto e legivel do ValidationError do Pydantic."""
    detalhes = erro.errors()
    if not detalhes:
        return "evento invalido"

    primeiro = detalhes[0]
    msg = primeiro.get("msg", "evento invalido")
    if msg.startswith("Value error, "):
        msg = msg[len("Value error, "):]

    loc = ".".join(str(p) for p in primeiro.get("loc", ()))
    if loc and loc not in msg:
        return f"{loc}: {msg}"
    return msg


def validar_evento_bruto(item: Any) -> tuple[EnvelopeEvento | None, dict[str, Any] | None, str | None]:
    """Valida envelope e payload de um item do lote.

    Devolve (envelope_validado, payload_bruto_original, motivo_erro).
    O payload_bruto_original e preservado sem alteracao para que o campo
    `programa` do EV-04 seja gravado em jsonb exatamente como veio (ADR-005).
    """
    if not isinstance(item, dict):
        return None, None, "evento deve ser um objeto JSON"

    try:
        envelope = EnvelopeEvento.model_validate(item)
    except ValidationError as erro:
        return None, None, _resumir_erro_validacao(erro)

    modelo_payload = MODELOS_PAYLOAD[envelope.event_type]
    try:
        modelo_payload.model_validate(envelope.payload)
    except ValidationError as erro:
        return None, None, f"payload invalido ({envelope.event_type}): {_resumir_erro_validacao(erro)}"

    # ADR-005: preserva o dicionario original do payload (incluindo `programa`
    # aninhado exatamente como veio do jogo).
    payload_original = item["payload"]
    return envelope, payload_original, None


def ingerir_lote(eventos_brutos: list[Any], jogador_id: int) -> dict[str, Any]:
    """Valida e grava um lote de eventos na camada bronze (ADR-007, RN-006, RN-015, RN-016).

    - RN-006: `jogador_id` vem exclusivamente do token de autenticacao.
    - RN-015: `event_id` repetido e ignorado com `on conflict (event_id) do nothing`.
    - ADR-005: `payload` (e o `programa` do EV-04) e gravado em `jsonb` como veio.
    - RS-05: `received_at` nao e enviado no INSERT, usando o `default now()` do banco.
    - RS-02: `origem` nao e enviada no INSERT, usando o `default 'jogo'` do banco.
    - ADR-007 / REC-002: abre e fecha a linha em `bronze.ingestao_lote` na mesma transacao.
    """
    validos: list[tuple[EnvelopeEvento, dict[str, Any]]] = []
    rejeitados: list[dict[str, str]] = []

    for item in eventos_brutos:
        envelope, payload_original, motivo = validar_evento_bruto(item)
        if envelope is None or payload_original is None:
            event_id_bruto = ""
            if isinstance(item, dict) and item.get("event_id") is not None:
                event_id_bruto = str(item.get("event_id"))
            rejeitados.append({
                "event_id": event_id_bruto,
                "motivo": motivo or "evento invalido",
            })
        else:
            validos.append((envelope, payload_original))

    gravados = 0
    ignorados = 0

    with db.conectar() as conexao, conexao.cursor() as cursor:
        # 1. Abre o lote em bronze.ingestao_lote (ADR-007).
        # origem fica no padrao 'jogo' (RS-02) e recebido_em no padrao now().
        cursor.execute(
            """
            insert into bronze.ingestao_lote (jogador_id, eventos_recebidos)
            values (%(jogador_id)s, %(eventos_recebidos)s)
            returning lote_id
            """,
            {
                "jogador_id": jogador_id,
                "eventos_recebidos": len(eventos_brutos),
            },
        )
        lote_id = cursor.fetchone()["lote_id"]

        # 2. Grava cada evento valido na bronze apontando para lote_id.
        # Nao informa received_at (RS-05) nem origem (RS-02) para usar os
        # defaults do banco: now() e 'jogo'.
        for envelope, payload_original in validos:
            with conexao.transaction():
                cursor.execute(
                    """
                    insert into bronze.eventos (
                        event_id, event_type, schema_version, catalog_version,
                        game_version, session_id, seq, occurred_at, payload,
                        jogador_id, lote_id
                    ) values (
                        %(event_id)s, %(event_type)s, %(schema_version)s,
                        %(catalog_version)s, %(game_version)s, %(session_id)s,
                        %(seq)s, %(occurred_at)s, %(payload)s,
                        %(jogador_id)s, %(lote_id)s
                    )
                    on conflict (event_id) do nothing
                    """,
                    {
                        "event_id": str(envelope.event_id),
                        "event_type": envelope.event_type,
                        "schema_version": envelope.schema_version,
                        "catalog_version": envelope.catalog_version,
                        "game_version": envelope.game_version,
                        "session_id": str(envelope.session_id),
                        "seq": envelope.seq,
                        "occurred_at": envelope.occurred_at,
                        "payload": json.dumps(payload_original),
                        "jogador_id": jogador_id,
                        "lote_id": lote_id,
                    },
                )
                if cursor.rowcount == 1:
                    gravados += 1
                else:
                    # RN-015: event_id repetido ignorado sem erro.
                    ignorados += 1

        # 3. Fecha o lote com as tres contagens finais (ADR-007, REC-002).
        detalhe = json.dumps({"rejeitados": rejeitados}) if rejeitados else None
        cursor.execute(
            """
            update bronze.ingestao_lote
               set eventos_gravados   = %(gravados)s,
                   eventos_ignorados  = %(ignorados)s,
                   eventos_rejeitados = %(rejeitados)s,
                   detalhe            = %(detalhe)s
             where lote_id = %(lote_id)s
            """,
            {
                "gravados": gravados,
                "ignorados": ignorados,
                "rejeitados": len(rejeitados),
                "detalhe": detalhe,
                "lote_id": lote_id,
            },
        )

        conexao.commit()

    return {
        "gravados": gravados,
        "ignorados": ignorados,
        "rejeitados": rejeitados,
    }
