import os
from app import create_app

app = create_app()

if __name__ == "__main__":
    # Changer le CWD vers le dossier backend pour que le watchdog
    # ne surveille que le code du projet (pas site-packages, pas frontend)
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "5000"))

    app.run(
        host=host,
        debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
        port=port,
        use_reloader=os.getenv("FLASK_DEBUG", "false").lower() == "true",
        # Utiliser stat reloader au lieu de watchdog (plus lent mais plus stable)
        reloader_type="stat",
        exclude_patterns=["*.pyc", "*/site-packages/*"],
        threaded=True,
    )
