# E2E tests (Playwright)

## Installation initiale (une fois)

```powershell
npx playwright install
```

## Exécution

```powershell
# Frontend uniquement (smoke)
npm run test:e2e

# Mode UI interactif
npx playwright test --ui

# Un seul fichier
npx playwright test smoke
```

## Notes

- `playwright.config.ts` lance automatiquement `npm run dev` (port 3000)
- Le backend (port 5000) doit tourner pour les parcours qui touchent l'API
- Les traces et screenshots sont conservés en cas d'échec dans `playwright-report/`

## Parcours à ajouter

- [ ] Login → dashboard (avec backend)
- [ ] Upload dataset → workflow profile
- [ ] Lancer une analyse simple (descriptif)
- [ ] Génération de rapport
