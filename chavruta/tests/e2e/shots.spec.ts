import { test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Not a test: captures screenshots of the main screens for review (SHOTS_DIR=… to enable).
const dir = process.env.SHOTS_DIR;
test.skip(!dir, 'screenshots only on request');
const fakeSpeech = readFileSync(new URL('./fake-speech.js', import.meta.url), 'utf8');

for (const [name, size] of [
  ['desktop', { width: 1440, height: 900 }],
  ['phone', { width: 390, height: 844 }],
] as const) {
  test(`screens ${name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.addInitScript(() => localStorage.setItem('chavruta', JSON.stringify({ state: { settings: { endOfTurnMs: 200 } }, version: 1 })));
    await page.addInitScript(fakeSpeech);
    await page.route('https://www.sefaria.org/**', (r) => r.abort('internetdisconnected'));
    await page.goto('./');
    await page.screenshot({ path: `${dir}/${name}-1-start.png` });
    await page.getByRole('button', { name: 'התחל שיחה' }).first().click();
    await page.waitForTimeout(400);
    await page.evaluate(() => (window as any).__speech.hear('בוא נלמד ברכות דף ב עמוד א'));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${dir}/${name}-2-learning.png` });
    await page.getByRole('button', { name: 'עצור את החברותא' }).click();
    await page.evaluate(() => (window as any).__speech.hear('פתח רש״י'));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${dir}/${name}-3-rashi.png` });
    await page.getByRole('button', { name: 'עצור את החברותא' }).click();
    await page.evaluate(() => (window as any).__speech.hear('תעשה לי המחשה כדי שאבין'));
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${dir}/${name}-4-illustration.png` });
  });
}
