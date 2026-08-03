import os
import sys
import socket

# Définir l'environnement local avant d'importer app
os.environ["LOCAL_DEV_MODE"] = "true"

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

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    else:
        port = find_free_port()

    # Affichage formaté lu par Electron main.js
    print(f"OPENSTATS_PORT={port}", flush=True)

    app = create_app()
    app.run(
        host="127.0.0.1",
        port=port,
        threaded=True,
        debug=False,
        use_reloader=False,
    )
