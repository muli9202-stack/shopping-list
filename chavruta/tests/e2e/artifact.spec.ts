import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// The single-file Artifact build, with a simulated `sample` capability (Claude through the
// viewer's account). Runs only when ARTIFACT_PAGE points at the wrapped page.
const page_ = process.env.ARTIFACT_PAGE;
test.skip(!page_, 'artifact page not built');
const fakeSpeech = readFileSync(new URL('./fake-speech.js', import.meta.url), 'utf8');

test('artifact: Claude via the chat account answers from the page, verified', async ({ page }) => {
  await page.addInitScript(fakeSpeech);
  await page.addInitScript(() => {
    const lines = [
      { t: 'say', kind: 'quote', text: 'וחכמים אומרים: עד חצות.', cite: 'Berakhot 2a:2', quote: 'וחכמים אומרים עד חצות', hl: { seg: 2 } },
      { t: 'say', kind: 'question', text: 'מה קשה לך כאן?' },
    ];
    const text = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
    (window as any).__sampleCalls = [];
    (window as any).claude = {
      use: async (name: string) =>
        name === 'sample'
          ? async (input: unknown, opts: any) => {
              (window as any).__sampleCalls.push(input);
              for (const chunk of text.match(/[\s\S]{1,30}/g)!) {
                await new Promise((r) => setTimeout(r, 10));
                opts.onText?.({ text: '', delta: chunk });
              }
              return { text, truncated: false };
            }
          : null,
    };
  });
  await page.route('https://www.sefaria.org/**', (r) => r.abort('blockedbyclient'));
  await page.goto(`file://${page_}`);
  await expect(page.locator('.badge', { hasText: 'Claude בחשבון שלך' })).toBeVisible();
  await expect(page.getByRole('button', { name: /מיקרופון/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'התחל שיחה' }).first().click();
  await page.locator('.type-box input').fill('בוא נלמד ברכות דף ב עמוד א');
  await page.locator('.type-box input').press('Enter');
  await expect(page.locator('.amud-badge')).toHaveText('דף ב׳ עמוד א׳');
  await expect.poll(() => page.evaluate(() => (window as any).__speech.log.spoken.join(' ')), { timeout: 20_000 }).toContain('מה קשה לך כאן');
  await expect(page.locator('.segment.hl')).toHaveAttribute('data-seg', '2');
  const calls = await page.evaluate(() => (window as any).__sampleCalls);
  expect(calls[0][0].content).toContain('אתה „החברותא”');
  await page.screenshot({ path: `${process.env.SHOTS_DIR ?? '/tmp'}/artifact-light.png` });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: `${process.env.SHOTS_DIR ?? '/tmp'}/artifact-dark.png` });
});
