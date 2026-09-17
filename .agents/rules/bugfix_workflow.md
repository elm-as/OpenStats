# Règle : Workflow de Résolution de Bugs (GitHub CLI)

À chaque fois qu'un bug est signalé par l'utilisateur et qu'il est corrigé :
Ne jamais passer par l'interface web de GitHub. L'ensemble des étapes s'exécute via la CLI `gh` et Git :

1. **Création de l'issue** :
   ```bash
   gh issue create --title "<titre du bug>" --body "<description concise du bug, cause et reproduction>"
   ```

2. **Branche et commit du fix** :
   ```bash
   git checkout -b fix/<nom-du-fix>
   git add <fichiers-modifies>
   git commit -m "fix: <message> (closes #<numero_issue>)"
   git push -u origin fix/<nom-du-fix>
   ```

3. **Création de la Pull Request** :
   ```bash
   gh pr create --fill
   ```

4. **Merge et suppression de branche** :
   ```bash
   gh pr merge --delete-branch --squash
   git checkout main
   git pull
   ```
