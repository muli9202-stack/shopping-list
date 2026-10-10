import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fakeSpeech = readFileSync(new URL('./fake-speech.js', import.meta.url), 'utf8');

async function setup(page: Page, opts: { msPerChar?: number; settings?: Record<string, unknown> } = {}) {
  await page.addInitScript(
    ([ms, settings]) => {
      (window as unknown as { __msPerChar: number }).__msPerChar = ms as number;
      if (!localStorage.getItem('chavruta')) {
        localStorage.setItem('chavruta', JSON.stringify({ state: { settings: { endOfTurnMs: 250, ...(settings as object) } }, version: 1 }));
      }
    },
    [opts.msPerChar ?? 18, opts.settings ?? {}],
  );
  await page.addInitScript(fakeSpeech);
  // No network to Sefaria: the app must work from its built-in snapshot.
  await page.route('https://www.sefaria.org/**', (r) => r.abort('internetdisconnected'));
  await page.goto('./');
  await page.getByRole('button', { name: 'התחל שיחה' }).first().click();
  await expect(page.locator('.caption')).toContainText('מה נלמד היום', { timeout: 15_000 });
}

const hear = (page: Page, text: string) => page.evaluate((t) => (window as unknown as { __speech: { hear: (t: string) => void } }).__speech.hear(t), text);
const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __speech: { log: { spoken: string[] } } }).__speech.log.spoken);
const state = (page: Page) => page.locator('.avatar-state');
/** Text of a locator without niqqud (mark order differs between sources). */
const letters = async (loc: ReturnType<Page['locator']>) => ((await loc.textContent()) ?? '').replace(/[\u0591-\u05C7]/g, '');

function boxesOverlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

test('voice request opens Berakhot 2a, the chavruta stays beside the page and starts learning', async ({ page }) => {
  await setup(page);
  await hear(page, 'בוא נלמד ברכות דף ב׳ עמוד א׳');
  await expect(page.locator('.text-head h2')).toContainText('ברכות ב׳');
  await expect(page.locator('.amud-badge')).toHaveText('דף ב׳ עמוד א׳');
  await expect(page.locator('.segment').first()).toContainText('מֵאֵימָתַי');
  // The chavruta reads the first line and highlights it.
  await expect(page.locator('.segment.hl').first()).toHaveAttribute('data-seg', '1');
  await expect.poll(async () => (await spoken(page)).join(' ')).toContain('מֵאֵימָתַי קוֹרִין');
  // Avatar and page are both visible and do not overlap.
  const avatar = await page.locator('.avatar-frame').boundingBox();
  const text = await page.locator('.text-pane').boundingBox();
  expect(avatar && text && !boxesOverlap(avatar, text)).toBe(true);
  await expect(page.locator('.ai-note')).toContainText('חברותא מבוססת בינה מלאכותית');
});

test('amud א and amud ב are different pages', async ({ page }) => {
  await setup(page);
  await hear(page, 'פתח ברכות דף ב עמוד ב');
  await expect(page.locator('.amud-badge')).toHaveText('דף ב׳ עמוד ב׳');
  await expect.poll(() => letters(page.locator('.segment').first())).toContain('דילמא ביאת אורו');
  await page.getByRole('button', { name: 'עמוד קודם' }).click();
  await expect(page.locator('.amud-badge')).toHaveText('דף ב׳ עמוד א׳');
  await expect(page.locator('.segment').first()).toContainText('מֵאֵימָתַי');
});

test('interrupting mid-sentence stops speech and the mouth, explains the word, then returns', async ({ page }) => {
  await setup(page, { msPerChar: 60 });
  await hear(page, 'בוא נלמד ברכות דף ב עמוד א');
  await expect(state(page)).toContainText('מדבר');
  // Wait until the chavruta is in the middle of a line.
  await page.waitForFunction(() => (window as unknown as { __speech: { log: { current: string | null } } }).__speech.log.current?.includes('מִשָּׁעָה'), null, { timeout: 30_000 });
  const cancelledBefore = await page.evaluate(() => (window as unknown as { __speech: { log: { cancelled: number } } }).__speech.log.cancelled);
  await page.evaluate(() => (window as unknown as { __speech: { interim: (t: string) => void } }).__speech.interim('רגע'));
  // Speech is cancelled and the mouth closes at once.
  await expect.poll(() => page.evaluate(() => (window as unknown as { __speech: { log: { cancelled: number } } }).__speech.log.cancelled)).toBeGreaterThan(cancelledBefore);
  await expect(state(page)).toContainText('מקשיב');
  await expect(page.locator('ellipse[cx="120"][cy="131"]')).toHaveAttribute('ry', '0.60');
  // The cut line is marked in the transcript as not heard.
  await expect(page.locator('.cut-mark').first()).toBeVisible();

  await hear(page, 'רגע, מה פירוש המילה בתרומתן?');
  await expect.poll(() => letters(page.locator('.w.sel'))).toBe('בתרומתן');
  await expect.poll(async () => (await spoken(page)).join(' ')).toContain('בתרומה שלהם');
  // …and goes back to the line that was cut off, from its beginning.
  await expect.poll(async () => (await spoken(page)).join(' '), { timeout: 30_000 }).toContain('נחזור למה שאמרנו');
  await expect.poll(async () => (await spoken(page)).filter((s) => s.includes('מִשָּׁעָה שֶׁהַכֹּהֲנִים')).length, { timeout: 30_000 }).toBeGreaterThan(0);
});

test('"פתח רש״י" opens Rashi beside the Gemara, tied to the line, and the chavruta reads from it', async ({ page }) => {
  await setup(page);
  await hear(page, 'פתח ברכות דף ב עמוד א');
  await expect(page.locator('.segment').first()).toBeVisible();
  await page.getByRole('button', { name: 'עצור את החברותא' }).click();
  await hear(page, 'פתח רש״י');
  const pane = page.locator('.commentary-pane');
  await expect(pane.getByRole('tab', { name: 'רש״י' })).toBeVisible();
  await expect(pane.locator('[data-seg="1"]')).toContainText('עד סוף האשמורה הראשונה');
  await expect(pane.locator('[data-ref="Rashi on Berakhot 2a:1:2"]')).toBeVisible();
  // Rashi has no comment on line 2 (וחכמים אומרים עד חצות).
  await expect(pane.locator('.c-group[data-seg="2"]')).toHaveCount(0);
  await expect.poll(async () => (await spoken(page)).join(' ')).toContain('כהנים שנטמאו וטבלו');
  // Page, commentary and chavruta are all on screen together.
  for (const sel of ['.text-pane', '.commentary-pane', '.avatar-frame']) await expect(page.locator(sel)).toBeInViewport();
});

test('illustration appears next to the page and its points open the source', async ({ page }) => {
  await setup(page);
  await hear(page, 'פתח ברכות דף ב עמוד א');
  await expect(page.locator('.segment').first()).toBeVisible();
  await hear(page, 'תעשה לי המחשה כדי שאבין');
  const il = page.locator('.illustration');
  await expect(il.locator('.badge')).toHaveText('המחשה להסבר');
  await expect(il).toContainText('רבן גמליאל');
  await expect(il.locator('.assumptions')).toContainText('שליש הלילה');
  await expect(page.locator('.avatar-frame')).toBeInViewport();
  await il.getByText('חצות', { exact: true }).click();
  await expect(page.locator('.segment.hl')).toHaveAttribute('data-seg', '2');
  await hear(page, 'תראה את ההבדל בין השיטות');
  await expect(il.locator('table')).toContainText('חכמים');
  await hear(page, 'מה ישתנה אם נשנה את המקרה?');
  await expect(il.locator('.changed')).toContainText('ארבע משמרות');
});

test('continue from where we stopped, also after moving to another amud', async ({ page }) => {
  await setup(page, { msPerChar: 60 });
  await hear(page, 'בוא נלמד ברכות דף ב עמוד א');
  await page.waitForFunction(() => (window as unknown as { __speech: { log: { current: string | null } } }).__speech.log.current?.includes('מִשָּׁעָה'), null, { timeout: 30_000 });
  await page.getByRole('button', { name: 'עצור את החברותא' }).click();
  await hear(page, 'עבור לדף הבא');
  await expect(page.locator('.amud-badge')).toHaveText('דף ב׳ עמוד ב׳');
  await page.getByRole('button', { name: 'עצור את החברותא' }).click();
  await hear(page, 'תחזור למקום שבו עצרנו');
  await expect(page.locator('.amud-badge')).toHaveText('דף ב׳ עמוד א׳');
  await expect.poll(async () => (await spoken(page)).filter((s) => s.includes('מִשָּׁעָה שֶׁהַכֹּהֲנִים')).length, { timeout: 30_000 }).toBeGreaterThan(0);
  await expect(page.locator('.segment.hl')).toHaveAttribute('data-seg', '1');
});

test('"show me where it is written" marks the cited source; a cite chip opens it', async ({ page }) => {
  await setup(page);
  await hear(page, 'פתח ברכות דף ב עמוד א');
  await expect.poll(async () => (await spoken(page)).join(' '), { timeout: 30_000 }).toContain('שליש הלילה');
  await page.getByRole('button', { name: 'עצור את החברותא' }).click();
  await hear(page, 'תראה לי איפה זה כתוב');
  await expect(page.locator('.comment.mark')).toHaveAttribute('data-ref', /Rashi on Berakhot 2a:1:/);
  await page.locator('.cite', { hasText: 'Berakhot 2a:1' }).first().click();
  await expect(page.locator('.segment.hl')).toHaveAttribute('data-seg', '1');
});

test('an unclear tractate name is confirmed before opening', async ({ page }) => {
  await setup(page);
  await hear(page, 'פתח ברחות דף ב עמוד א');
  await expect(page.locator('.clarify')).toContainText('התכוונת');
  await expect(page.locator('.text-pane')).toHaveCount(0);
  await hear(page, 'כן');
  await expect(page.locator('.amud-badge')).toHaveText('דף ב׳ עמוד א׳');
});

test('a missing amud number is asked about, not guessed', async ({ page }) => {
  await setup(page);
  await hear(page, 'פתח ברכות דף ב');
  await expect(page.locator('.clarify')).toContainText('עמוד א׳ או עמוד ב׳');
  await page.locator('.clarify').getByRole('button', { name: 'עמוד ב׳' }).click();
  await expect(page.locator('.amud-badge')).toHaveText('דף ב׳ עמוד ב׳');
});

test('without internet a source outside the snapshot is reported, not invented', async ({ page }) => {
  await setup(page);
  await hear(page, 'פתח שבת דף ל עמוד א');
  await expect(page.locator('.error-bar')).toContainText('אין חיבור לספריא');
  await expect(page.locator('.text-pane')).toHaveCount(0);
});

test('a wrong claim is corrected gently from the Mishnah; a non-existent quote is not produced', async ({ page }) => {
  await setup(page);
  await hear(page, 'פתח ברכות דף ב עמוד א');
  await expect(page.locator('.segment').first()).toBeVisible();
  await page.getByRole('button', { name: 'עצור את החברותא' }).click();
  await hear(page, 'רבן גמליאל אומר עד חצות, נכון?');
  await expect.poll(async () => (await spoken(page)).join(' ')).toContain('לא בדיוק');
  await expect(page.locator('.segment.hl')).toHaveAttribute('data-seg', '3');
  await hear(page, 'תצטט לי איפה כתוב "עד רביע הלילה"');
  await expect.poll(async () => (await spoken(page)).join(' ')).toContain('לא מצאתי');
});

test('switching source while an answer is being prepared does not mark the new page', async ({ page }) => {
  await setup(page);
  await hear(page, 'פתח ברכות דף ב עמוד א');
  await expect(page.locator('.segment').first()).toBeVisible();
  await page.getByRole('button', { name: 'עצור את החברותא' }).click();
  // A slow brain whose answer highlights line 5 of the page it was asked about.
  await page.evaluate(() => {
    const w = window as unknown as { __chavruta: { engine: { setBrain: (b: unknown) => void } } };
    w.__chavruta.engine.setBrain({
      demo: true,
      async *respond(req: { kind: string }) {
        if (req.kind !== 'chat') return;
        await new Promise((r) => setTimeout(r, 1500));
        yield { t: 'say', kind: 'explain', text: 'תשובה ישנה על השורה החמישית.', hl: { seg: 5 } };
      },
    });
  });
  await page.locator('.type-box input').fill('מה הפשט כאן?');
  await page.locator('.type-box input').press('Enter');
  await page.getByRole('button', { name: 'עמוד הבא' }).click();
  await expect(page.locator('.amud-badge')).toHaveText('דף ב׳ עמוד ב׳');
  await page.waitForTimeout(2500);
  await expect(page.locator('.segment.hl[data-seg="5"]')).toHaveCount(0);
  expect((await spoken(page)).join(' ')).not.toContain('תשובה ישנה');
});

test('Claude mode: streamed answer is verified, an invented quote is not spoken as a quote', async ({ page }) => {
  await setup(page, { settings: { apiKey: 'sk-ant-test', model: 'claude-opus-5-5' } });
  const lines = [
    { t: 'say', kind: 'quote', text: 'וחכמים אומרים: עד חצות.', cite: 'Berakhot 2a:2', quote: 'וחכמים אומרים עד חצות', hl: { seg: 2 } },
    { t: 'say', kind: 'commentator', text: 'רש״י אומר: עד רביע הלילה.', cite: 'Rashi on Berakhot 2a:1:2', quote: 'עד רביע הלילה' },
    { t: 'say', kind: 'question', text: 'מה קשה לך כאן?' },
  ];
  const text = `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`;
  const sse = [
    ['message_start', { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 4000, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
    ...text.match(/[\s\S]{1,40}/g)!.map((chunk) => ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: chunk } }]),
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 300 } }],
    ['message_stop', { type: 'message_stop' }],
  ]
    .map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`)
    .join('');
  const requests: string[] = [];
  await page.route('https://api.anthropic.com/**', async (route) => {
    requests.push(route.request().postData() ?? '');
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse });
  });
  await hear(page, 'פתח ברכות דף ב עמוד א');
  await expect.poll(async () => (await spoken(page)).join(' '), { timeout: 30_000 }).toContain('מה קשה לך כאן');
  const said = (await spoken(page)).join(' ');
  expect(said).toContain('וחכמים אומרים');
  expect(said).not.toContain('עד רביע הלילה');
  expect(said).toContain('לא מצאתי את הלשון');
  // The request carried the page text and asked for the server-side fallback.
  const body = JSON.parse(requests[0]);
  expect(body.model).toBe('claude-opus-5-5');
  expect(body.fallbacks).toBe('default');
  expect(JSON.stringify(body.messages)).toContain('[1] מאימתי קורין');
  await expect(page.locator('.segment.hl')).toHaveAttribute('data-seg', '2');
});

test('phone layout: the chavruta strip sits above the text and does not cover it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await hear(page, 'פתח ברכות דף ב עמוד א');
  await expect(page.locator('.segment').first()).toBeVisible();
  const avatar = await page.locator('.avatar-frame').boundingBox();
  const text = await page.locator('.text-pane').boundingBox();
  expect(avatar && text && !boxesOverlap(avatar, text)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
