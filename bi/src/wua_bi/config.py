"""Configuracao lida do ambiente (ou do .env)."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

RAIZ_BI = Path(__file__).resolve().parents[2]

load_dotenv(RAIZ_BI / ".env")

DB_URL = os.getenv("WUA_DB_URL", "postgresql://wua:wua_dev@localhost:55432/wua")

# Caminho relativo no .env e resolvido contra a pasta bi/, nao contra o
# diretorio de onde o comando foi chamado.
CAMINHO_CATALOGO = (RAIZ_BI / os.getenv("WUA_CATALOGO", "../catalogo-fases.json")).resolve()

SEGREDO = os.getenv("WUA_SEGREDO", "segredo-de-desenvolvimento")

DIR_DDL = RAIZ_BI / "db"
DIR_DASHBOARD = RAIZ_BI / "dashboard"

# Contrato de Eventos, secao 3: o jogo pode fechar sem enviar o EV-02, entao a
# silver tambem encerra a sessao depois deste tempo sem eventos. Valor proposto
# no documento; ainda nao validado com dados reais.
MINUTOS_INATIVIDADE_SESSAO = 30

# ---------------------------------------------------------------------------
# Orquestracao (ADR-009)
#
# Na arquitetura de referencia quem dispara o ciclo e o Airflow. Aqui o
# intervalo e o mesmo que a equipe decidiu na apresentacao de 26/10/2026, e o
# agendador e proprio - a justificativa esta na ADR-009.
# ---------------------------------------------------------------------------
INTERVALO_ETL_MIN = int(os.getenv("WUA_ETL_INTERVALO_MIN", "15"))

# Observabilidade: para onde vai o aviso quando uma execucao falha. Vazio =
# so stderr e a coluna erro da bronze.etl_execucao. Aceita qualquer URL que
# receba um POST com JSON (Discord, Slack, Teams, um script proprio).
ALERTA_WEBHOOK = os.getenv("WUA_ALERTA_WEBHOOK", "").strip()
