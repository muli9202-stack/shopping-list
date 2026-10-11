import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// The single-file Artifact build with its library, served locally, and a simulated `sample`
// capability (Claude through the viewer's account). Runs only when ARTIFACT_URL is set.
const url = process.env.ARTIFACT_URL;
test.skip(!url, 'artifact page not served');
const fakeSpeech = readFileSync(new URL('./fake-speech.js', import.meta.url), 'utf8');
const letters = async (page: Page, sel: string) => ((await page.locator(sel).first().textContent()) ?? '').replace(/[֑-ׇ]/g, '');

async function open(page: Page, withClaude: boolean) {
  await page.addInitScript(fakeSpeech);
  if (withClaude)
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
  // Like the real viewer: no network except the page's own files.
  await page.route(/^https:\/\/(?!fonts\.)/, (r) => r.abort('blockedbyclient'));
  await page.goto(url!);
  await page.getByRole('button', { name: 'התחל שיחה' }).first().click();
}
const type = async (page: Page, text: string) => {
  await page.locator('.type-box input').fill(text);
  await page.locator('.type-box input').press('Enter');
};

test('artifact: Claude via the chat account answers from the page, verified', async ({ page }) => {
  await open(page, true);
  await expect(page.locator('.badge', { hasText: 'Claude בחשבון שלך' })).toBeVisible();
  await type(page, 'בוא נלמד ברכות דף ב עמוד א');
  await expect(page.locator('.amud-badge')).toHaveText('דף ב׳ עמוד א׳');
  await expect.poll(() => page.evaluate(() => (window as any).__speech.log.spoken.join(' ')), { timeout: 20_000 }).toContain('מה קשה לך כאן');
  await expect(page.locator('.segment.hl')).toHaveAttribute('data-seg', '2');
  const calls = await page.evaluate(() => (window as any).__sampleCalls);
  expect(calls[0][0].content).toContain('אתה „החברותא”');
});

test('artifact library: any daf in Shas with Tosafot, any Mishnah, Torah with Ramban', async ({ page }) => {
  await open(page, false);
  await type(page, 'פתח בבא מציעא דף כא עמוד ב');
  await expect(page.locator('.amud-badge')).toHaveText('דף כ״א עמוד ב׳');
  await expect.poll(() => letters(page, '.edition')).toContain('ספרייה מקומית');
  await page.getByRole('button', { name: 'עצור את החברותא' }).click();
  await type(page, 'תראה את תוספות');
  await expect(page.locator('.commentary-pane .comment').first()).toBeVisible();
  await page.getByRole('button', { name: 'עצור את החברותא' }).click();
  await type(page, 'פתח נדה דף עג עמוד א');
  await expect(page.locator('.amud-badge')).toHaveText('דף ע״ג עמוד א׳');
  await page.getByRole('button', { name: 'עצור את החברותא' }).click();
  await type(page, 'נלמד משנה עוקצין פרק ג משנה יב');
  await expect.poll(() => letters(page, '.text-head h2')).toContain('עוקצ');
  await expect(page.locator('.segment.focus')).toHaveAttribute('data-seg', '12');
  await page.getByRole('button', { name: 'עצור את החברותא' }).click();
  await type(page, 'פתח שמות פרק יב');
  await expect.poll(() => letters(page, '.text-head h2')).toContain('שמות');
  await page.getByRole('button', { name: 'עצור את החברותא' }).click();
  await type(page, 'פתח רמב״ן');
  await expect(page.locator('.commentary-pane .comment').first()).toBeVisible();
});
