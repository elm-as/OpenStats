import { test, expect } from '@playwright/test';

/**
 * Smoke test — vérifie que l'app charge et que la page de login s'affiche.
 * Pas de backend requis pour ce test.
 */
test.describe('Smoke', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/.+/);
    // Champ email + mot de passe visibles
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('protected route redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/');
    // Doit rediriger vers /login (ProtectedRoute)
    await expect(page).toHaveURL(/\/login/);
  });
});
