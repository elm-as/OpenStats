import os
import sys
import socket
import secrets
import threading
import multiprocessing

# Définir l'environnement local avant d'importer app
os.environ["LOCAL_DEV_MODE"] = "true"
# Indispensable en mode Electron (`Origin: file://` ou `null`) même si un `.env` local existe
os.environ["CORS_ORIGINS"] = "*"

# Jeton de session éphémère pour authentifier la communication locale
if not os.environ.get("OPENSTATS_SESSION_TOKEN"):
    os.environ["OPENSTATS_SESSION_TOKEN"] = secrets.token_hex(32)

# Définir le répertoire de données dans AppData
app_data_dir = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "OpenStats")
os.makedirs(app_data_dir, exist_ok=True)
data_dir = os.path.join(app_data_dir, "data")
uploads_dir = os.path.join(app_data_dir, "uploads")
reports_dir = os.path.join(app_data_dir, "reports")

for d in [data_dir, uploads_dir, reports_dir]:
    os.makedirs(d, exist_ok=True)

os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(data_dir, 'openstats.db')}"
os.environ["DATA_DIR"] = data_dir
os.environ["UPLOAD_FOLDER"] = uploads_dir
os.environ["REPORTS_DIR"] = reports_dir

from app import create_app

def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def start_parent_watchdog():
    """Arrête le backend si Electron ferme ou crashe (EOF sur stdin)."""
    if os.environ.get("OPENSTATS_WATCH_PARENT_STDIN") != "1":
        return

    try:
        stdin_fd = sys.stdin.fileno() if sys.stdin is not None else -1
    except (AttributeError, OSError, ValueError):
        return
    if stdin_fd < 0:
        return

    def _watch():
        try:
            while os.read(stdin_fd, 1):
                pass
        except OSError:
            pass
        os._exit(0)

    threading.Thread(target=_watch, daemon=True, name="parent-stdin-watchdog").start()


if __name__ == "__main__":
    # Indispensable pour multiprocessing.spawn dans un binaire PyInstaller sous Windows
    multiprocessing.freeze_support()

    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    else:
        port = find_free_port()

    # Affichage formaté lu par Electron main.js
    print(f"OPENSTATS_PORT={port}", flush=True)
    print(f"OPENSTATS_SESSION_TOKEN={os.environ['OPENSTATS_SESSION_TOKEN']}", flush=True)

    app = create_app()
    # Démarrer le watchdog stdin APRÈS create_app() pour éviter tout verrou CRT/stdio
    # avec le chargement des extensions natives C (numpy/pandas) sous Windows.
    start_parent_watchdog()
    app.run(
        host="127.0.0.1",
        port=port,
        threaded=True,
        debug=False,
        use_reloader=False,
    )
