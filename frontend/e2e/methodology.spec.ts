import { test } from '@playwright/test';

const OUT = process.env.AUDIT_OUT || '.';
const log = (s: string) => console.log('METHODO ' + s);

test('analyse méthodique itérative', async ({ page }) => {
  test.setTimeout(360000);
  const errs: string[] = [];
  const bad: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  page.on('response', r => { if (r.status() >= 400) bad.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });

  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto('/analyzer');
  await page.waitForSelector('text=/Méthodologie itérative/i', { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/me-01-initial.png` });
  log('onglet Analyse méthodique ouvert par défaut');

  // Choix d'une cible numérique si disponible
  const select = page.locator('select').first();
  const options = await select.locator('option').allTextContents();
  log(`colonnes proposées : ${options.length - 1}`);
  const numericGuess = options.find(o => /prix|score|satisfaction|valeur|montant|pib|note|taux/i.test(o));
  if (numericGuess) {
    await select.selectOption({ label: numericGuess });
    log(`cible choisie : ${numericGuess}`);
  }

  const t0 = Date.now();
  await page.locator('button', { hasText: /Lancer l.analyse/i }).first().click();
  log('exécution lancée');

  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/me-02-running.png` });

  await page.waitForSelector('text=/Interprétation/i', { timeout: 300000 }).catch(() => log('!! fin non atteinte'));
  await page.waitForTimeout(2500);
  log(`terminé en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await page.screenshot({ path: `${OUT}/me-03-done.png` });

  // Combien d'étapes marquées terminées ?
  const stageButtons = page.locator('nav ol li button');
  log(`étapes listées : ${await stageButtons.count()}`);

  // Parcours des étapes, comptage des graphes Plotly rendus
  const targets = [
    ['Analyse univariée', 'univariee'],
    ['Analyse bivariée', 'bivariee'],
    ['Diagnostic', 'diagnostic'],
    ['Transformations', 'boucle'],
    ['Modélisation', 'modelisation'],
  ];
  for (const [label, slug] of targets) {
    const item = page.locator('nav ol li button', { hasText: new RegExp(label, 'i') }).first();
    if (!(await item.count())) { log(`${label} : absent`); continue; }
    await item.click();
    await page.waitForTimeout(2200);
    const plots = await page.locator('.js-plotly-plot').count();
    const tables = await page.locator('table.ui-table').count();
    log(`${label} : ${plots} graphe(s) Plotly, ${tables} tableau(x)`);
    await page.screenshot({ path: `${OUT}/me-04-${slug}.png` });
  }

  // La boucle : itérations visibles ?
  await page.locator('nav ol li button', { hasText: /Transformations/i }).first().click();
  await page.waitForTimeout(1500);
  const iterations = await page.locator('text=/Itération \\d/').count();
  log(`itérations affichées : ${iterations}`);
  const kept = await page.locator('text=/retenue/').count();
  const cancelled = await page.locator('text=/annulée/').count();
  log(`  retenues=${kept} annulées=${cancelled}`);

  // Panneau d'application des corrections
  const applyPanel = page.locator('text=/Appliquer les corrections au dataset/i').first();
  if (await applyPanel.count()) {
    await applyPanel.click();
    await page.waitForTimeout(900);
    const checkboxes = await page.locator('input[type="checkbox"]').count();
    log(`panneau d'application : ${checkboxes} case(s) à cocher`);
    await page.screenshot({ path: `${OUT}/me-05-apply.png` });
  } else {
    log('panneau d\'application absent (aucune correction retenue)');
  }

  // Thème clair
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/me-06-light.png` });

  log(`ERREURS CONSOLE (${errs.length}): ${JSON.stringify([...new Set(errs)].slice(0, 6))}`);
  log(`HTTP>=400 (${bad.length}): ${JSON.stringify([...new Set(bad)].slice(0, 6))}`);
});
