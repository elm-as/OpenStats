import os
from app import create_app

app = create_app()

if __name__ == "__main__":
    # Changer le CWD vers le dossier backend pour que le watchdog
    # ne surveille que le code du projet (pas site-packages, pas frontend)
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    app.run(
        host="0.0.0.0",
        debug=os.getenv("FLASK_DEBUG", "false").lower() == "true",
        port=int(os.getenv("PORT", "5000")),
        use_reloader=os.getenv("FLASK_DEBUG", "false").lower() == "true",
        # Utiliser stat reloader au lieu de watchdog (plus lent mais plus stable)
        reloader_type="stat",
        exclude_patterns=["*.pyc", "*/site-packages/*"],
        threaded=True,
    )
