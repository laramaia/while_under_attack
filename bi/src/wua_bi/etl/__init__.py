"""ETL das tres camadas (ADR-003).

bronze -> silver -> gold. Cada etapa reconstroi a camada inteira a partir da
anterior: nao ha estado incremental para dar errado, e rodar duas vezes da o
mesmo resultado. Com o volume do MVP (~10 jogadores) isso custa segundos.

A bronze nunca e tocada (RN-016).
"""
