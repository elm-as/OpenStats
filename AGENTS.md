# Instructions & Règles de Développement

Voir la charte complète dans [ELMAS.md](file:///c:/Users/elmas/Desktop/Stats/ELMAS.md).

## Workflow obligatoire : Résolution de bugs & cycle GitHub CLI

À chaque fois qu'un bug est signalé par l'utilisateur et corrigé :
Ne jamais faire d'allers-retours sur l'interface web de GitHub. Tout est automatisé via la CLI `gh` :

1. **Créer l'issue** :
   ```bash
   gh issue create --title "<titre du bug>" --body "<description concise du bug et reproduction>"
   ```
2. **Créer la branche et commiter** :
   ```bash
   git checkout -b fix/<identifiant-ou-nom-du-bug>
   # modifications & validation
   git add <fichiers>
   git commit -m "fix: <description> (closes #<issue_id>)"
   git push -u origin fix/<identifiant-ou-nom-du-bug>
   ```
3. **Créer la Pull Request** :
   ```bash
   gh pr create --fill
   ```
4. **Merger et nettoyer la branche** :
   ```bash
   gh pr merge --delete-branch --squash
   git checkout main
   git pull
   ```
