"""Agendador do ETL (ADR-009).

Na arquitetura de referencia corporativa quem ocupa este lugar e o Apache
Airflow. Aqui ele e um laco de 40 linhas, e a ADR-009 explica por que: o
Airflow resolve dependencia entre tarefas, paralelismo, backfill e retentativa
seletiva, e este ETL tem UMA tarefa, idempotente, que roda em segundos. O que
sobraria do Airflow seria o relogio.

O que importa guardar: **trocar o gatilho nao mexe no ETL.** `pipeline.executar`
e uma funcao; quem a chama pode ser esta linha de comando, o cron do sistema,
um Scheduled Job do Render ou um operador do Airflow. Essa foi a consequencia
registrada na ADR-003 ("o ETL precisa de um gatilho") e continua valendo: a
migracao para Airflow, se um dia fizer sentido, e escrever um DAG de uma
tarefa que chama esta mesma funcao.

Uso:

    python -m wua_bi.etl agendar                 a cada 15 min (padrao)
    python -m wua_bi.etl agendar --intervalo 5   a cada 5 min
    python -m wua_bi.etl agendar --vezes 3       roda 3 vezes e sai (teste)

Tres comportamentos que um agendador honesto precisa ter, e que este tem:

- **Roda uma vez assim que sobe**, em vez de esperar o primeiro intervalo.
  Quem liga o agendador quer ver o dado atualizado agora.
- **Uma falha nao derruba o agendador.** O ciclo seguinte tenta de novo; como
  o ETL reconstroi tudo a partir da bronze, a retentativa e so rodar outra
  vez. Nao existe "limpar antes".
- **Ctrl+C encerra limpo**, sem deixar transacao pendurada.
"""

from __future__ import annotations

import signal
import sys
import time
from datetime import datetime, timedelta

from .. import config
from . import pipeline

_parar = False


def _pedir_parada(signum, frame) -> None:  # noqa: ARG001
    global _parar
    _parar = True
    print("\nencerrando depois deste ciclo... (Ctrl+C de novo para sair agora)")
    signal.signal(signal.SIGINT, signal.SIG_DFL)


def _agora() -> str:
    return datetime.now().strftime("%H:%M:%S")


def agendar(intervalo_min: int | None = None, vezes: int | None = None) -> int:
    """Roda o ETL em intervalo fixo. Devolve o codigo de saida."""
    intervalo_min = intervalo_min or config.INTERVALO_ETL_MIN
    if intervalo_min < 1:
        print("intervalo precisa ser de pelo menos 1 minuto")
        return 2

    signal.signal(signal.SIGINT, _pedir_parada)

    print(f"agendador no ar: ETL a cada {intervalo_min} min "
          f"(ADR-009). Ctrl+C para encerrar.")

    ciclo = 0
    falhas_seguidas = 0

    while not _parar:
        ciclo += 1
        print(f"\n--- ciclo {ciclo} · {_agora()} ---")
        resumo = pipeline.executar(disparo="agendado")

        if resumo.ok:
            falhas_seguidas = 0
            print(f"ok em {resumo.duracao_s}s "
                  f"({resumo.regras_aprovadas} regras de qualidade aprovadas)")
        else:
            falhas_seguidas += 1
            print(f"FALHOU ({falhas_seguidas} seguida(s)): {resumo.erro}")

        if vezes is not None and ciclo >= vezes:
            break
        if _parar:
            break

        proximo = datetime.now() + timedelta(minutes=intervalo_min)
        print(f"proximo ciclo as {proximo.strftime('%H:%M:%S')}")

        # Dorme em pedacos para o Ctrl+C responder na hora em vez de so
        # depois de 15 minutos.
        restante = intervalo_min * 60
        while restante > 0 and not _parar:
            time.sleep(min(1, restante))
            restante -= 1

    print("agendador encerrado.")
    return 0


def main() -> None:
    sys.exit(agendar())


if __name__ == "__main__":
    main()
