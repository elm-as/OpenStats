import { test, expect } from '@playwright/test';

const OUT = process.env.AUDIT_OUT || '.';
const log = (s: string) => console.log('CHAIN ' + s);

test('analyse → canvas → code', async ({ page }) => {
  test.setTimeout(360000);
  const errs: string[] = [];
  const bad: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 180)); });
  page.on('response', r => { if (r.status() >= 400) bad.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`); });

  await page.setViewportSize({ width: 1500, height: 950 });
  await page.goto('/analyzer');
  await page.waitForSelector('text=/Méthodologie itérative/i', { timeout: 60000 });
  await page.waitForTimeout(3000);

  const select = page.locator('select').first();
  const options = await select.locator('option').allTextContents();
  const target = options.find(o => /pib|prix|score|satisfaction|valeur/i.test(o));
  if (target) { await select.selectOption({ label: target }); log(`cible : ${target}`); }

  await page.locator('button', { hasText: /Lancer l.analyse/i }).first().click();
  await page.waitForSelector('text=/Prolonger l.analyse/i', { timeout: 300000 })
    .catch(() => log('!! actions de prolongement absentes'));
  await page.waitForTimeout(2000);
  log('analyse terminée');

  // Le bandeau de synthèse
  const summary = await page.locator('text=/Variable expliquée/i').count();
  const progress = await page.locator('[role="progressbar"]').count();
  log(`bandeau de synthèse : ${summary > 0} | barre de progression : ${progress > 0}`);
  await page.screenshot({ path: `${OUT}/ch-01-synthese.png` });

  // Export Python
  const download1 = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
  await page.locator('button', { hasText: /^Python/ }).first().click();
  const py = await download1;
  log(`export Python : ${py ? py.suggestedFilename() : 'échec'}`);

  // Export R
  const download2 = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
  await page.locator('button', { hasText: /^R$/ }).first().click();
  const r = await download2;
  log(`export R : ${r ? r.suggestedFilename() : 'échec'}`);

  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/ch-02-exports.png` });

  // Conversion en canvas
  await page.locator('button', { hasText: /Ouvrir dans le canvas/i }).first().click();
  await page.waitForTimeout(6000);
  log(`URL après conversion : ${new URL(page.url()).pathname}${new URL(page.url()).search}`);
  const nodes = await page.locator('.react-flow__node').count();
  const edges = await page.locator('.react-flow__edge').count();
  log(`canvas : ${nodes} nœuds, ${edges} arêtes`);
  await page.screenshot({ path: `${OUT}/ch-03-canvas.png` });
  expect(nodes).toBeGreaterThan(2);

  log(`ERREURS CONSOLE (${errs.length}): ${JSON.stringify([...new Set(errs)].slice(0, 5))}`);
  log(`HTTP>=400 (${bad.length}): ${JSON.stringify([...new Set(bad)].slice(0, 5))}`);
});
