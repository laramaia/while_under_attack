"""Script de teste de ponta a ponta da ingestao de eventos (ADR-007, RN-006, RN-015).

Faz login em /login, monta um lote com 1 evento valido, 1 duplicado (RN-015)
e 1 evento invalido, envia para POST /api/eventos e imprime o status HTTP e
o corpo da resposta 207.
"""

from __future__ import annotations

import json
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

URL_BASE = "http://localhost:8001"
ARQUIVO_CONTAS = Path(__file__).resolve().parent / "contas.json"


def _requisicao_json(
    url: str,
    corpo: dict[str, Any],
    token: str | None = None,
) -> tuple[int, dict[str, Any]]:
    cabecalhos = {"Content-Type": "application/json"}
    if token:
        cabecalhos["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(
        url,
        data=json.dumps(corpo).encode("utf-8"),
        headers=cabecalhos,
        method="POST",
    )
    with urllib.request.urlopen(req) as resposta:
        dados = json.loads(resposta.read().decode("utf-8"))
        return resposta.status, dados


def main() -> None:
    contas = json.loads(ARQUIVO_CONTAS.read_text(encoding="utf-8"))
    conta = contas[0]

    # 1. Login para obter o token JWT (ADR-004, RN-006).
    status_login, dados_login = _requisicao_json(
        f"{URL_BASE}/login",
        {"usuario": conta["usuario"], "senha": conta["senha"]},
    )
    token = dados_login["token"]
    print(f"Login HTTP {status_login} -> jogador_id={dados_login['jogador_id']} ({dados_login['nome_exibicao']})")

    # 2. Monta o lote com 3 eventos (ADR-007).
    agora_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    session_id = str(uuid.uuid4())
    event_id_valido = str(uuid.uuid4())
    event_id_invalido = str(uuid.uuid4())

    evento_valido = {
        "event_id": event_id_valido,
        "event_type": "sessao_iniciada",
        "schema_version": 1,
        "catalog_version": "2026.11.1-rascunho",
        "game_version": "0.3.0",
        "session_id": session_id,
        "seq": 1,
        "occurred_at": agora_iso,
        "payload": {},
    }

    # RN-015: exatamente o mesmo evento (mesmo event_id) para testar deduplicacao.
    evento_duplicado = dict(evento_valido)

    # Evento com event_type desconhecido para testar rejeicao individual na resposta 207.
    evento_invalido = {
        "event_id": event_id_invalido,
        "event_type": "evento_inexistente",
        "schema_version": 1,
        "catalog_version": "2026.11.1-rascunho",
        "game_version": "0.3.0",
        "session_id": session_id,
        "seq": 2,
        "occurred_at": agora_iso,
        "payload": {},
    }

    lote = {"eventos": [evento_valido, evento_duplicado, evento_invalido]}

    # 3. Envia o lote para POST /api/eventos com Authorization: Bearer <token>.
    status_ingestao, resposta_ingestao = _requisicao_json(
        f"{URL_BASE}/api/eventos",
        lote,
        token=token,
    )

    # 4. Imprime HTTP Status e JSON da resposta.
    print(f"HTTP Status: {status_ingestao}")
    print(json.dumps(resposta_ingestao, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
