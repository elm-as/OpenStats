# ELMAS.md — Charte de développement ElmasCore

> Ce fichier est la signature d'un projet ElmasCore. Il définit les règles non négociables
> à respecter par tout humain ou tout agent IA qui contribue à ce dépôt. Il doit être lu
> avant toute génération de code, toute refonte, tout ajout de dépendance.
>
> "From Data to Systems" — un projet ElmasCore se reconnaît à sa rigueur, pas à sa rapidité d'exécution.

---

## 1. Architecture

- L'architecture existante du projet fait autorité. On ne la contourne pas, on ne la
  duplique pas en parallèle, on ne crée pas un second pattern "plus simple" à côté de
  celui en place.
- Toute modification structurelle (nouveau dossier racine, changement de convention de
  nommage, nouvelle couche) doit être justifiée en une phrase avant d'être appliquée, pas
  après.
- Séparation stricte des responsabilités : UI, logique métier, accès aux données et
  configuration ne vivent jamais dans le même fichier. Un composant qui fait une requête
  réseau, calcule une règle métier et gère son propre style est un composant à corriger,
  pas un raccourci acceptable.
- Pas de dépendance ajoutée "parce que c'est plus rapide". Toute nouvelle librairie doit
  répondre à un besoin qu'aucune brique déjà présente ne couvre.

### Où va le code

- L'organisation est **par domaine métier**, pas par type technique. `students/`,
  `payments/`, `attendance/` plutôt que `components/`, `hooks/`, `utils/` en vrac à la
  racine. Le type technique (composant, service, hook) est un sous-dossier à l'intérieur
  du domaine, jamais l'inverse.
- Chaque nouveau fichier a un seul dossier "logique" possible avant d'être créé. Si
  l'endroit où le ranger est ambigu, c'est que le découpage du domaine doit être précisé
  d'abord — on ne le pose pas "quelque part" en attendant.
- Le flux de dépendances est à sens unique : UI → services/logique métier → accès aux
  données. Une couche basse (accès données) n'importe jamais une couche haute (UI). Aucune
  dépendance circulaire, jamais, même "temporairement".
- `utils/`, `helpers/`, `misc/`, `common/` sont interdits comme fourre-tout. Si une
  fonction n'a pas de domaine clair, c'est qu'elle est mal nommée ou mal pensée, pas
  qu'elle mérite un dossier générique.

## 2. Taille et complexité du code

- **350 lignes maximum par fichier**, sans exception de confort. Un fichier qui approche
  cette limite est un signal : il fait probablement plusieurs choses et doit être découpé
  avant d'être étendu, pas après.
- Une fonction, une responsabilité. Si une fonction a besoin d'un commentaire pour expliquer
  "d'abord on fait X, puis Y, puis Z", c'est qu'elle doit devenir trois fonctions.
- Pas de duplication silencieuse : si une logique existe déjà ailleurs dans le projet, on
  la réutilise ou on l'extrait, on ne la recopie pas.

## 3. Choix technique

- On choisit **la meilleure stack pour le problème posé, jamais la plus rapide à sortir**.
  React par défaut parce que "c'est ce que toutes les IA proposent" n'est pas un choix,
  c'est un réflexe — et un réflexe n'est jamais une justification technique valable dans
  un projet ElmasCore.
- Le choix de stack se justifie par : la nature du produit (desktop, mobile, temps réel,
  data-intensif, offline-first…), la cible réelle, la maintenabilité à 2 ans, et le coût
  d'exploitation — jamais par la familiarité de l'outil qui génère le code.
- Avant d'écrire la première ligne, on nomme explicitement pourquoi cette stack et pas une
  autre. Si la réponse est "parce que c'est le plus rapide à mettre en place", on
  recommence la réflexion.

## 4. UI / UX

- Aucune interface ElmasCore ne doit ressembler à un template SaaS générique généré par
  IA : palette indigo/violet par défaut, cartes blanches arrondies avec icône-dans-carré,
  pills flottantes partout, dégradés décoratifs. Si l'interface pourrait appartenir à
  n'importe quel autre produit, elle est à refaire.
- Chaque projet a sa propre identité visuelle, ancrée dans son sujet réel (son
  utilisateur, son métier, son vocabulaire), pas dans un kit de composants par défaut.
  Palette, typographie et structure se décident pour ce produit précis.
- Densité et lisibilité priment sur la décoration. Un outil de gestion utilisé tous les
  jours n'a pas besoin d'ombres portées, de radius excessifs ou d'animations
  d'atterrissage — il a besoin d'être clair en une seconde.
- Chiffres, montants, identifiants : toujours en police à chiffres tabulaires, alignés
  correctement. Ce n'est pas un détail, c'est un signe de sérieux.

## 5. Nommage des fichiers et des fonctions

- **Fichiers** : le nom décrit ce que contient le fichier, jamais son type générique.
  `student-payment-status.ts` et non `utils.ts`. `AttendanceTable.tsx` et non
  `Table2.tsx` ou `NewTable.tsx`. Un nom de fichier générique (`helpers`, `misc`, `temp`,
  `final`, `v2`) est un rejet automatique.
- Convention de casse fixée une fois par projet et respectée partout : composants en
  `PascalCase`, fichiers logiques/services en `kebab-case`, jamais les deux mélangés dans
  le même dossier.
- **Fonctions** : `verbe + nom`, qui décrit ce que la fonction fait, pas comment elle le
  fait. `calculateLatePaymentPenalty`, pas `doCalc` ou `processData`.
  - Fonctions booléennes : préfixe `is`, `has`, `can` (`isOverdue`, `hasUnpaidBalance`).
  - Gestionnaires d'événements : préfixe `handle` en interne, `on` en prop exposée
    (`handleSubmit` implémente, `onSubmit` est le nom de la prop).
  - Fonctions asynchrones : le nom seul doit suffire à savoir qu'il faut `await` — pas de
    convention cachée, un simple bon nom métier (`fetchStudentRecord`, pas `getData`).
- Aucune abréviation qui n'est pas un standard du domaine (`id`, `url` sont ok ; `stdRec`,
  `pmt`, `calc` ne le sont pas).
- Un nom qui a besoin d'un commentaire à côté pour être compris est un nom à refaire, pas
  un nom à commenter.

## 6. Commentaires

- Un commentaire explique **pourquoi**, jamais **quoi**. Le code dit déjà quoi ; s'il ne
  le dit pas assez clairement, on renomme ou on restructure, on ne compense pas avec un
  commentaire.
- Interdiction du commentaire qui reformule la ligne juste en dessous
  (`// on incrémente le compteur` au-dessus de `count++`).
- Toute règle métier non évidente (seuil, exception réglementaire, cas particulier
  imposé par l'utilisateur) est commentée — c'est là que le commentaire a de la valeur,
  parce que le "pourquoi" n'est pas dans le code.
- Pas de code commenté laissé en place "au cas où". Le contrôle de version garde
  l'historique ; un fichier ne garde pas de cadavres.
- `// TODO` autorisé uniquement avec le contexte de ce qui manque, jamais un `// TODO`
  seul sans explication.
- Commentaire de documentation (JSDoc/TSDoc ou équivalent) obligatoire sur toute fonction
  exportée qui touche à une règle métier (calcul de moyenne, de recouvrement, de statut
  financier…) : ce qu'elle prend, ce qu'elle retourne, les cas limites gérés.

## 7. Qualité et maintenabilité générale

- Toute erreur est gérée explicitement, jamais avalée silencieusement.
- Pas de duplication de logique métier entre fichiers : une règle vit à un seul endroit.
- Le code doit pouvoir être repris par quelqu'un d'autre que son auteur sans réunion
  d'explication préalable.

## 8. Sécurité et données

- Aucune donnée sensible (clé API, identifiant, mot de passe) en dur dans le code ou
  versionnée. Toujours via variables d'environnement ou secret manager.
- Toute donnée utilisateur (élève, client, transaction) est traitée comme sensible par
  défaut, même en phase de prototype.

## 9. Documentation et livraison

- Un README à jour à la racine : ce que fait le projet, comment le lancer, comment
  contribuer. Un projet sans README à jour n'est pas considéré comme livrable.
- Les décisions structurantes (choix de stack, changement d'architecture) sont
  consignées, pas seulement discutées dans un chat qui disparaît.

## 10. Résolution de bugs et cycle GitHub (CLI)

À chaque fois qu'un bug est signalé par l'utilisateur et qu'une correction est apportée :
- Aucun aller-retour manuel sur l'interface web de GitHub. L'intégralité du cycle est automatisée via la CLI `gh`.
- Déroulé obligatoire du workflow :
  1. **Créer l'issue** :
     `gh issue create --title "<titre clair du bug>" --body "<description succincte du problème, cause et reproduction>"`
  2. **Créer la branche et pousser le fix** :
     Créer une branche dédiée (ex: `fix/<sujet>`), commiter le fix en liant l'issue (`Fixes #<id>`), et pousser vers le remote.
  3. **Créer la Pull Request** :
     `gh pr create --fill`
  4. **Merger et nettoyer la branche** :
     `gh pr merge --delete-branch` (ou avec l'option de fusion adaptée, ex. `--squash` ou `--merge`), puis se repositionner sur `main` et effectuer `git pull`.

---

*Ces règles s'appliquent à tout agent IA (Claude Code, Cursor, etc.) travaillant sur ce
dépôt, au même titre qu'à tout contributeur humain. En cas de conflit entre une
instruction ponctuelle et ce fichier, ce fichier fait foi sauf mention explicite du
contraire par le porteur du projet.*

— **Elmas**, ElmasCore
