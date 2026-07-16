"""
Service Marketplace — catalogue local de templates et extensions.
"""

from __future__ import annotations

from app.extensions import db
from app.models.marketplace import MarketplaceItem

_BUILTIN_TEMPLATES = [
    {
        "name": "Analyse Descriptive Rapide",
        "description": "Pipeline complet d'analyse descriptive : statistiques, corrélations, VIF et visualisations automatiques.",
        "category": "template",
        "item_type": "descriptive",
        "icon": "bar-chart-3",
        "featured": True,
        "tags": ["descriptives", "corrélations", "visualisation", "débutant"],
        "payload": {
            "nodes": [
                {"id": "src", "type": "dataset", "position": {"x": 100, "y": 200}, "data": {"importMode": "existing", "file": ""}},
                {"id": "desc", "type": "descriptiveNumeric", "position": {"x": 400, "y": 100}, "data": {}},
                {"id": "cat", "type": "descriptiveCategorical", "position": {"x": 400, "y": 250}, "data": {}},
                {"id": "corr", "type": "correlation", "position": {"x": 700, "y": 100}, "data": {}},
                {"id": "vif", "type": "vif", "position": {"x": 700, "y": 280}, "data": {}},
                {"id": "vis", "type": "visualization", "position": {"x": 1000, "y": 200}, "data": {"chartType": "correlationHeatmap"}},
            ],
            "edges": [
                {"source": "src", "target": "desc"},
                {"source": "src", "target": "cat"},
                {"source": "desc", "target": "corr"},
                {"source": "desc", "target": "vif"},
                {"source": "corr", "target": "vis"},
            ],
        },
    },
    {
        "name": "Pipeline de Classification",
        "description": "Pipeline ML complet : nettoyage auto, entraînement compétitif multi-modèles, SHAP et matrice de confusion.",
        "category": "template",
        "item_type": "classification",
        "icon": "brain-circuit",
        "featured": True,
        "tags": ["classification", "machine learning", "SHAP", "avancé"],
        "payload": {
            "nodes": [
                {"id": "src", "type": "dataset", "position": {"x": 100, "y": 200}, "data": {"importMode": "existing", "file": ""}},
                {"id": "clean", "type": "cleaning", "position": {"x": 400, "y": 200}, "data": {}},
                {"id": "classify", "type": "classification", "position": {"x": 700, "y": 200}, "data": {}},
                {"id": "vis", "type": "visualization", "position": {"x": 1000, "y": 200}, "data": {"chartType": "confusionMatrix"}},
            ],
            "edges": [
                {"source": "src", "target": "clean"},
                {"source": "clean", "target": "classify"},
                {"source": "classify", "target": "vis"},
            ],
        },
    },
    {
        "name": "Prévision de Séries Temporelles",
        "description": "Analyse de série temporelle univariée : décomposition, stationnarité, ARIMA/SARIMA et prévisions.",
        "category": "template",
        "item_type": "timeseries",
        "icon": "trending-up",
        "featured": True,
        "tags": ["séries temporelles", "prévision", "ARIMA", "intermédiaire"],
        "payload": {
            "nodes": [
                {"id": "src", "type": "dataset", "position": {"x": 100, "y": 200}, "data": {"importMode": "existing", "file": ""}},
                {"id": "stationarity", "type": "testStationarity", "position": {"x": 400, "y": 100}, "data": {}},
                {"id": "ts", "type": "timeseries", "position": {"x": 700, "y": 200}, "data": {"forecastSteps": 10}},
                {"id": "vis", "type": "visualization", "position": {"x": 1000, "y": 200}, "data": {"chartType": "tsForecast"}},
            ],
            "edges": [
                {"source": "src", "target": "stationarity"},
                {"source": "src", "target": "ts"},
                {"source": "ts", "target": "vis"},
            ],
        },
    },
    {
        "name": "Analyse Factorielle (PCA)",
        "description": "Analyse en Composantes Principales avec scree plot, biplot et cercle de corrélations.",
        "category": "template",
        "item_type": "pca",
        "icon": "layers",
        "featured": False,
        "tags": ["PCA", "factorielle", "réduction dimension", "intermédiaire"],
        "payload": {
            "nodes": [
                {"id": "src", "type": "dataset", "position": {"x": 100, "y": 200}, "data": {"importMode": "existing", "file": ""}},
                {"id": "pca", "type": "pca", "position": {"x": 400, "y": 200}, "data": {"nComponents": 5}},
                {"id": "vis1", "type": "visualization", "position": {"x": 700, "y": 100}, "data": {"chartType": "screePlot"}},
                {"id": "vis2", "type": "visualization", "position": {"x": 700, "y": 300}, "data": {"chartType": "pcaBiplot"}},
            ],
            "edges": [
                {"source": "src", "target": "pca"},
                {"source": "pca", "target": "vis1"},
                {"source": "pca", "target": "vis2"},
            ],
        },
    },
    {
        "name": "Nettoyage et Préparation Automatique",
        "description": "Pipeline de préparation des données : détection des types, nettoyage auto, gestion des valeurs manquantes.",
        "category": "template",
        "item_type": "cleaning",
        "icon": "brush",
        "featured": False,
        "tags": ["nettoyage", "préparation", "débutant"],
        "payload": {
            "nodes": [
                {"id": "src", "type": "dataset", "position": {"x": 100, "y": 200}, "data": {"importMode": "existing", "file": ""}},
                {"id": "typing", "type": "typing", "position": {"x": 400, "y": 200}, "data": {}},
                {"id": "clean", "type": "cleaning", "position": {"x": 700, "y": 200}, "data": {}},
                {"id": "output", "type": "output", "position": {"x": 1000, "y": 200}, "data": {}},
            ],
            "edges": [
                {"source": "src", "target": "typing"},
                {"source": "typing", "target": "clean"},
                {"source": "clean", "target": "output"},
            ],
        },
    },
    {
        "name": "Simulation Monte Carlo",
        "description": "Analyse de sensibilité et simulation Monte Carlo pour évaluer la robustesse des prédictions.",
        "category": "template",
        "item_type": "simulation",
        "icon": "dices",
        "featured": False,
        "tags": ["simulation", "monte carlo", "sensibilité", "avancé"],
        "payload": {
            "nodes": [
                {"id": "src", "type": "dataset", "position": {"x": 100, "y": 200}, "data": {"importMode": "existing", "file": ""}},
                {"id": "regression", "type": "regression", "position": {"x": 400, "y": 200}, "data": {}},
                {"id": "sim", "type": "simulation", "position": {"x": 700, "y": 200}, "data": {"nSimulations": 1000}},
                {"id": "vis", "type": "visualization", "position": {"x": 1000, "y": 200}, "data": {"chartType": "monteCarloDistribution"}},
            ],
            "edges": [
                {"source": "src", "target": "regression"},
                {"source": "regression", "target": "sim"},
                {"source": "sim", "target": "vis"},
            ],
        },
    },
]


def seed_marketplace():
    """Insère les templates intégrés si la table est vide."""
    if MarketplaceItem.query.count() > 0:
        return
    for tmpl in _BUILTIN_TEMPLATES:
        item = MarketplaceItem(**tmpl)
        db.session.add(item)
    db.session.commit()


def list_items(category: str = None, item_type: str = None, featured: bool = None,
               page: int = 1, per_page: int = 20, search: str = None) -> dict:
    """Liste les items de la marketplace avec filtres et pagination."""
    query = MarketplaceItem.query.order_by(MarketplaceItem.featured.desc(), MarketplaceItem.downloads.desc())
    if category:
        query = query.filter_by(category=category)
    if item_type:
        query = query.filter_by(item_type=item_type)
    if featured is not None:
        query = query.filter_by(featured=featured)
    if search:
        query = query.filter(
            (MarketplaceItem.name.ilike(f"%{search}%")) |
            (MarketplaceItem.description.ilike(f"%{search}%")) |
            (MarketplaceItem.tags.contains([search]))
        )
    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return {
        "items": [it.to_dict(include_payload=(it.category == 'template')) for it in items],
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": max(1, (total + per_page - 1) // per_page),
    }


def get_item(item_id: str) -> dict | None:
    """Récupère un item avec son payload."""
    item = db.session.get(MarketplaceItem, item_id)
    return item.to_dict() if item else None


def export_item(item_id: str) -> dict | None:
    """Exporte un item au format JSON transférable."""
    item = db.session.get(MarketplaceItem, item_id)
    if item is None:
        return None
    item.downloads += 1
    db.session.commit()
    return item.to_dict()


def import_item(data: dict) -> dict:
    """Importe un item depuis un JSON."""
    existing = MarketplaceItem.query.filter_by(name=data["name"]).first()
    if existing:
        existing.description = data.get("description", existing.description)
        existing.payload = data["payload"]
        existing.version = data.get("version", existing.version)
        existing.tags = data.get("tags", existing.tags or [])
        db.session.commit()
        return existing.to_dict()
    item = MarketplaceItem(
        name=data["name"],
        description=data.get("description", ""),
        category=data.get("category", "template"),
        item_type=data.get("item_type", "other"),
        author=data.get("author", "Importé"),
        version=data.get("version", "1.0.0"),
        icon=data.get("icon", "package"),
        tags=data.get("tags", []),
        payload=data["payload"],
    )
    db.session.add(item)
    db.session.commit()
    return item.to_dict()
