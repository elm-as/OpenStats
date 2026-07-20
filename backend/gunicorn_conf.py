import os

# Serveur Bind
bind = "0.0.0.0:" + os.getenv("PORT", "10000")

# Configuration des workers
# Sur Render (surtout en Free/Starter avec 512MB RAM), cpu_count() peut renvoyer
# un grand nombre et causer un OOM Kill (Out Of Memory). On limite donc à 1 ou 2.
workers = int(os.getenv("WEB_CONCURRENCY", "1"))
worker_class = "gthread"
threads = int(os.getenv("WEB_THREADS", "2"))

# Optimisation pour les tâches d'analyse lourdes
timeout = 120  # Laisse 2 minutes maximum pour une grosse analyse PCA/Séries temporelles
keepalive = 5

# Logs
accesslog = "-"
errorlog = "-"
loglevel = "info"
