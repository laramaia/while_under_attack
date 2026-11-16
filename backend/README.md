# Back-end do while under_attack

Serviço responsável pela autenticação de usuários (ADR-004) e pela ingestão dos
eventos enviados pelo jogo na camada bronze (`bronze.eventos` e
`bronze.ingestao_lote`, ADR-007).

A fronteira entre `backend/` e `bi/` é exclusivamente o banco de dados
PostgreSQL — não há código compartilhado entre as duas pastas. As tabelas
(`app.jogador`, `bronze.eventos` e `bronze.ingestao_lote`) são criadas pelo BI
(`bi/db/01_bronze.sql`); o back-end apenas lê e escreve nelas.

## Pré-requisitos

- Python 3.11+
- Banco PostgreSQL acessível via `WUA_DB_URL` (com o schema já criado por
  `python -m wua_bi.etl criar` na pasta `bi/`)

## Como rodar

Usa a porta **8001** para poder rodar ao mesmo tempo que a API do BI (que usa a
porta 8000):

```bash
cd backend
cp .env.example .env          # ajuste a WUA_DB_URL se necessário
python -m venv .venv && .venv/Scripts/pip install -e .
.venv/Scripts/python -m uvicorn wua_backend.main:app --reload --port 8001
```

No Linux ou macOS, troque `.venv/Scripts/` por `.venv/bin/`.

## Endpoints disponíveis

- `GET http://localhost:8001/saude` — devolve `{"status": "ok", "banco": "ok"}`
  quando a conexão com o Postgres responde.
- `GET http://localhost:8001/docs` — documentação interativa gerada pelo FastAPI.
