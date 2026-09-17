import { test } from '@playwright/test';

const OUT = process.env.AUDIT_OUT || '.';
const log = (s: string) => console.log('EXPLORER ' + s);

test('explorateur adaptatif', async ({ page }) => {
  test.setTimeout(300000);
  const errs: string[] = [];
  const bad: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  page.on('response', r => { if (r.status() >= 400) bad.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });

  // Thème sombre d'abord
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/explorer');
  await page.waitForSelector('text=/Explorateur/i', { timeout: 60000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/ex-01-initial-dark.png`, fullPage: true });
  log('page chargée (sombre)');

  // Choix de la cible
  const select = page.locator('select').first();
  await select.selectOption({ label: 'prix_cacao' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/ex-02-plan.png`, fullPage: true });

  const plan = await page.locator('text=/Plan d/i').count();
  log(`panneau plan present=${plan > 0}`);

  // Lancer l'exploration
  const t0 = Date.now();
  await page.locator('button', { hasText: /^Explorer$/ }).first().click();
  log('exploration lancée');

  // Capture pendant la recherche
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/ex-03-running.png`, fullPage: true });

  await page.waitForSelector('text=/hypothèse.*testée/i', { timeout: 200000 })
    .catch(() => log('!! panneau honnêteté jamais apparu'));
  log(`terminé en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/ex-04-results-dark.png`, fullPage: true });

  // Contenu
  const cards = await page.locator('article').count();
  log(`cartes de découverte : ${cards}`);
  const honesty = await page.locator('text=/hypothèse/i').first().innerText().catch(() => '');
  log(`honnêteté : ${honesty.replace(/\s+/g, ' ').slice(0, 160)}`);

  const traceItems = await page.locator('ol li').count();
  log(`étapes de raisonnement : ${traceItems}`);
  const unlocked = await page.locator('text=/débloquée par/i').count();
  log(`étapes débloquées par un fait : ${unlocked}`);

  const facts = await page.locator('text=/Ce que je sais/i').count();
  log(`bandeau de faits présent=${facts > 0}`);

  // Déplier une découverte
  await page.locator('article button').first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/ex-05-expanded.png`, fullPage: true });

  // Thème clair — le point faible identifié à l'audit
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/ex-06-results-light.png`, fullPage: true });
  log('capture thème clair prise');

  log(`ERREURS CONSOLE (${errs.length}): ${JSON.stringify([...new Set(errs)].slice(0, 8))}`);
  log(`HTTP>=400 (${bad.length}): ${JSON.stringify([...new Set(bad)].slice(0, 8))}`);
});
