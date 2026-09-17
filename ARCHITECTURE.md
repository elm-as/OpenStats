# Moteurs d'analyse — conception et garanties

Ce document décrit les deux moteurs qui produisent des résultats statistiques, leurs
garanties, et les décisions de conception qui les distinguent. Il s'adresse à quiconque
modifie `backend/app/core/pipeline/` ou `backend/app/core/exploration/`.

Pour les règles générales du dépôt, voir [ELMAS.md](ELMAS.md).

---

## Deux moteurs, deux questions

Ils se ressemblent en surface — tous deux prennent une cible et produisent des résultats.
Ils répondent à des questions différentes, et cette différence justifie qu'ils coexistent.

| | **Explorateur** (`core/exploration/`) | **Analyse méthodique** (`core/pipeline/`) |
|---|---|---|
| Question | Qu'y a-t-il d'intéressant ici ? | Ces données sont-elles exploitables, et que peut-on en prédire ? |
| Effet sur les données | **Aucun** — il observe | Il **transforme**, après validation de l'utilisateur |
| Déroulement | Recherche adaptative : chaque trouvaille en débloque d'autres | 11 étapes, avec une boucle entre correction et re-diagnostic |
| Sortie | `Finding` : effet, p-value, intérêt | `Issue` → `Remedy` → modèle comparé |
| Garde-fou principal | FDR sur toute la session | Conditions d'arrêt de la boucle |

Ce qu'ils **partagent** vit dans `core/measurements.py` : asymétrie, valeurs extrêmes,
lacunes, doublons, corrélations fortes, colonnes constantes, identifiants déguisés,
normalité, déséquilibre de classes.

> Ces mesures ont existé en double pendant un temps, une fois dans chaque moteur. Les deux
> implémentations avaient déjà divergé — l'une gardait contre un IQR nul, l'autre non.
> **Une mesure, un seul endroit.**

---

## Explorateur adaptatif

### Le mécanisme

```
contexte + classement des covariables (information mutuelle)
   ↓
choisir la sonde au meilleur rapport intérêt/coût parmi celles débloquées
   ↓
exécuter → récolter des Findings → mettre à jour les faits établis
   ↓
les nouveaux faits débloquent de nouvelles sondes ──┐
   └───────────────────────────────────────────────┘
```

Ce sont les **faits** qui pilotent tout. Une sonde déclare `yields` (ce qu'elle établit) et
`triggered_by` (ce qui la débloque). `association_linéaire` ouvre la redondance, l'interaction
et Granger ; `différence_groupes` ouvre la segmentation ; `modèle_utile` ouvre le VIF.

Deux jeux de données n'activent donc ni les mêmes sondes ni le même ordre.

### Pourquoi l'information mutuelle

Le classement des covariables (`exploration/covariates.py`) n'utilise pas la corrélation
de Pearson mais l'information mutuelle, qui capte les liaisons non linéaires. Sur une
relation quadratique testée, `MI = 1.00` contre `r = −0.23` : Pearson ne voit rien.

### Contrôle des fausses découvertes

Chercher jusqu'à trouver produit mécaniquement des faux positifs. Trois dispositions :

1. **Toutes** les hypothèses testées sont comptées, y compris celles qui n'ont rien donné.
2. Benjamini-Hochberg s'applique à l'ensemble de la session, pas test par test
   (délégué à `statsmodels.stats.multitest`, validé contre lui sur plusieurs tirages).
3. Le dénominateur est affiché à l'utilisateur.

Les mesures descriptives (information mutuelle, importance de variable) n'ont pas de
p-value : elles sont marquées *descriptives* et exclues de la correction, pas comptées
comme des tests réussis.

### Classement des découvertes

`interest = |effet| × confiance × nouveauté`. La nouveauté pénalise un finding portant sur
des variables déjà couvertes : sans elle, dix variantes du même signal occuperaient les dix
premières places.

---

## Analyse méthodique

### Les onze étapes

```
1 comprendre le problème      7 transformations  ─┐
2 comprendre les données      8 re-diagnostic  ───┘ boucle tant que la qualité progresse
3 nettoyage / qualité         9 modélisation
4 analyse univariée          10 validation
5 analyse bivariée           11 interprétation
6 diagnostics
```

L'étape 4 est **rejouée après correction** : c'est ce qui rend l'effet des transformations
visible côte à côte.

### La boucle, et ses conditions d'arrêt

C'est la pièce délicate. Sans garde-fous, elle tourne indéfiniment ou dégrade les données.
Quatre conditions la bornent (`pipeline/remediation.py`) :

1. plus aucun problème non résolu ;
2. plafond d'itérations atteint ;
3. la gravité cumulée ne diminue plus — **l'itération est alors annulée**, et le rapport le
   dit (`kept: false`) au lieu de laisser croire que les corrections tiennent ;
4. un remède déjà tenté sur une colonne n'est jamais rejoué.

Deux règles supplémentaires, apprises par les tests :

- **Une seule transformation de forme par colonne et par session.** Enchaîner un log puis un
  Box-Cox sur la même série n'a pas de sens statistique.
- **La cible ne peut jamais être supprimée.** Garde-fou à la sélection du remède *et* à son
  application, quel que soit l'appelant.

### Diagnostics et remèdes couplés

Chaque `Issue` porte ses `Remedy` candidats. L'étape 7 se contente de choisir parmi ce que
l'étape 6 a proposé — il n'y a pas de table de correspondance ad hoc entre problèmes et
corrections. Les remèdes s'appuient sur le catalogue de transformations existant
(`core/transformations_apply.py`), jamais sur une implémentation parallèle.

### Comparaison de modèles

15 modèles supervisés, 6 prévisionnistes (`pipeline/models.py`, `pipeline/temporal_models.py`).
Trois principes :

- **Toute exclusion porte son motif** : « bibliothèque absente », « 80 observations minimum
  requises », « ne s'applique pas à ce type de problème ».
- **Une référence naïve accompagne tout score** — moyenne pour la régression, classe
  majoritaire pour la classification, persistance pour les séries. Un R² de 0,3 peut être
  excellent ou catastrophique ; sans référence, on ne sait pas lequel.
- **La validation respecte le temps.** Origine glissante pour les prévisions,
  `TimeSeriesSplit` pour les données temporelles tabulaires. Une validation croisée
  mélangeant les périodes entraînerait le modèle sur le futur.

Sur l'ordre ARIMA : `d` est fixé par test de racine unitaire, **pas** par comparaison d'AIC.
Des AIC calculés sur des séries différenciées différemment ne portent pas sur les mêmes
données et ne sont pas comparables.

---

## Prise en compte du profilage

Un type déclaré par l'utilisateur fait autorité sur l'inférence de pandas, et la colonne est
**réellement convertie** (`pipeline/schema.py`) :

- une colonne d'années entières déclarée *temporelle* devient une vraie série de dates —
  pandas ne le fera jamais seul, et sans cela aucun test de stationnarité ne s'applique ;
- un code numérique déclaré *catégoriel* cesse d'être traité comme une grandeur ;
- un *identifiant* est retiré du périmètre d'analyse ;
- le jeu est trié sur l'axe temporel — un test de stationnarité sur des lignes en désordre ne
  mesure rien.

Un type déclaré inapplicable (« temporel » sur du texte libre) est **signalé**, pas appliqué
en silence.

---

## Génération de code

Un assembleur commun (`code_generation/emitter.py`) sert Python, R et Jupyter. Il garantit :

- **l'ordre du graphe**, par tri topologique sur les arêtes — pas l'ordre de création des
  nœuds sur le canvas ;
- **les imports collectés** depuis les nœuds et émis en tête ;
- **les identifiants échappés** — une colonne nommée `l'année` ne casse pas le script ;
- **un nœud non traduit lève**, au lieu de produire un `print` muet donnant un script qui
  tourne sans rien calculer.

La **fidélité** est testée numériquement : le script généré doit reproduire ce que
l'application a calculé, pas quelque chose qui y ressemble. Le moteur décale les séries
négatives avant `log`/`log1p`/`sqrt`/`boxcox` ; le code généré fait de même.

---

## Discipline d'interception des exceptions

`core/statistical_attempt.py` définit le **seul** motif autorisé pour intercepter un échec
de calcul, avec une liste **fermée** d'erreurs (`ValueError`, `LinAlgError`,
`ZeroDivisionError`…). `AttributeError`, `NameError` et `ImportError` en sont exclus : ce
sont des défauts de programmation, et les masquer transformerait un bug en résultat
silencieusement faux.

```python
outcome = attempt(adfuller, series, autolag="AIC")
if not outcome:
    notes.append(f"ADF indisponible : {outcome.reason}")
    return []
```

`tests/core/test_exception_discipline.py` parcourt l'AST et refuse tout `except Exception`,
`except:` nu ou `pass` muet dans le code d'analyse. Deux exemptions nommées existent — les
sommets de threads SSE, où l'interception large est la seule façon d'éviter que le client
attende indéfiniment — et le test vérifie qu'elles journalisent la trace complète.

---

## Points ouverts

- **La boucle de correction ignore la performance prédictive.** Elle peut différencier une
  série et faire baisser le R² d'un modèle linéaire. Faire entrer le score dans le critère
  d'acceptation d'une itération est possible maintenant que la comparaison de modèles existe.
- **Sept fichiers dépassent 350 lignes**, dont `pipeline/stages.py` (880). À découper.
- **Le générateur R n'est pas exécuté par les tests** — R absent de l'environnement.
- **228 `except Exception` subsistent dans le code historique.** Le module et le test de
  discipline sont conçus pour s'y étendre : ajouter les chemins à `SUPERVISED`, traiter
  fichier par fichier.
