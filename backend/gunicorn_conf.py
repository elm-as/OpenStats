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
# Un pipeline Canvas complet (ACP + clustering + régression + classification)
# peut durer 3-5 minutes sur un dataset moyen avec un seul worker
timeout = 300  # 5 minutes pour les pipelines Canvas complexes
keepalive = 5

# Logs
accesslog = "-"
errorlog = "-"
loglevel = "info"
