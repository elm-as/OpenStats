"""Corpus de demonstration OpenStats : trois tables liees par `region`.

- `clients`  : coupe transversale (une ligne = un client) ;
- `series`   : serie temporelle journaliere (une ligne = un jour) ;
- `panel`    : panel agence x mois (une ligne = une entite x une periode).

Le decoupage en trois tables n'est pas un confort : une meme table ne peut pas
avoir une seule observation par date (exigence des modeles temporels) et
plusieurs entites par date (exigence des modeles de panel).
"""

from . import clients, panel, series

__all__ = ["clients", "panel", "series"]
