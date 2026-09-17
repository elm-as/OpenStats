import { test } from '@playwright/test';

const OUT = process.env.AUDIT_OUT || '.';
const log = (s: string) => console.log('VIZ ' + s);

test('heatmap et comparaison de modèles', async ({ page }) => {
  test.setTimeout(400000);
  const errs: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });

  await page.setViewportSize({ width: 1500, height: 980 });
  await page.goto('/analyzer');
  await page.waitForSelector('text=/Méthodologie itérative/i', { timeout: 60000 });
  await page.waitForTimeout(3000);

  const select = page.locator('select').first();
  const options = await select.locator('option').allTextContents();
  const target = options.find(o => /pib|prix|score|satisfaction/i.test(o));
  if (target) { await select.selectOption({ label: target }); log(`cible : ${target}`); }

  await page.locator('button', { hasText: /Lancer l.analyse/i }).first().click();
  await page.waitForSelector('text=/Prolonger l.analyse/i', { timeout: 330000 })
    .catch(() => log('!! analyse non terminée'));
  await page.waitForTimeout(2500);

  // Heatmap : triangle inférieur avec valeurs
  await page.locator('nav ol li button', { hasText: /Analyse bivariée/i }).first().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/viz-01-heatmap.png` });

  const annotations = await page.evaluate(() => {
    const plot = document.querySelector('.js-plotly-plot') as any;
    if (!plot?.data) return null;
    const heat = plot.data.find((t: any) => t.type === 'heatmap');
    if (!heat) return null;
    const cells = (heat.z ?? []).flat();
    const filled = cells.filter((v: unknown) => v !== null && v !== undefined).length;
    return {
      total: cells.length,
      filled,
      hasText: Array.isArray(heat.text),
      template: heat.texttemplate ?? null,
    };
  });
  log(`heatmap : ${JSON.stringify(annotations)}`);
  if (annotations) {
    const half = annotations.total / 2;
    log(`  triangle inférieur seul : ${annotations.filled < half} (${annotations.filled}/${annotations.total} cases)`);
    log(`  valeurs écrites : ${annotations.hasText && annotations.template === '%{text}'}`);
  }

  // Modélisation : comparaison de modèles
  await page.locator('nav ol li button', { hasText: /Modélisation/i }).first().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/viz-02-modeles.png`, fullPage: true });

  const tables = await page.locator('table.ui-table').count();
  const rows = await page.locator('table.ui-table tbody tr').count();
  const plots = await page.locator('.js-plotly-plot').count();
  log(`modélisation : ${tables} tableau(x), ${rows} lignes, ${plots} graphe(s)`);

  const headline = await page.locator('div.min-h-\\[0\\], p').first().innerText().catch(() => '');
  const body = await page.locator('body').innerText();
  const hasBaseline = /référence/i.test(body);
  const hasRecommend = /recommandé/i.test(body);
  log(`  mention d'une référence : ${hasBaseline} | modèles recommandés listés : ${hasRecommend}`);

  log(`ERREURS CONSOLE (${errs.length}): ${JSON.stringify([...new Set(errs)].slice(0, 5))}`);
});
