"""Configuracao do back-end lida do ambiente ou do .env."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

RAIZ_BACKEND = Path(__file__).resolve().parents[2]

load_dotenv(RAIZ_BACKEND / ".env")

# A fronteira entre back-end e BI e o banco de dados Postgres (ADR-001, ADR-002).
DB_URL = os.getenv("WUA_DB_URL", "postgresql://wua:wua_dev@localhost:55432/wua")

# Porta padrao 8001 para rodar junto com a API do BI (porta 8000) na mesma maquina.
PORTA = int(os.getenv("WUA_PORTA", "8001"))
