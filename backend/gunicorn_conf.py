import multiprocessing

# Serveur Bind
bind = "0.0.0.0:10000"

# Configuration des workers
# Formule standard: 2 * nombre de cœurs + 1
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "gthread"
threads = 4

# Optimisation pour les tâches d'analyse lourdes
timeout = 120  # Laisse 2 minutes maximum pour une grosse analyse PCA/Séries temporelles
keepalive = 5

# Logs
accesslog = "-"
errorlog = "-"
loglevel = "info"
