import { describe, expect, it } from 'vitest';
import { parseCommand } from '../../src/core/commands';
import { targetToSefaria } from '../../src/core/refs';

const sefariaOf = (text: string) => {
  const i = parseCommand(text);
  if (i.type !== 'open') throw new Error(`expected open, got ${JSON.stringify(i)}`);
  return targetToSefaria(i.target);
};

describe('opening sources by voice', () => {
  it.each([
    ['בוא נלמד ברכות דף ב׳ עמוד א׳', 'Berakhot 2a'],
    ['פתח גמרא ברכות דף ב עמוד א', 'Berakhot 2a'],
    ['פתח ברכות דף ב עמוד ב', 'Berakhot 2b'],
    ['תפתח ברכות דף ב ע"ב', 'Berakhot 2b'],
    ['תפתח ברכות ב: בבקשה', 'Berakhot 2b'],
    ['נלמד בבא מציעא דף כ״א עמוד א', 'Bava Metzia 21a'],
    ['פתח בבא מציעא דף עשרים ואחת עמוד ב', 'Bava Metzia 21b'],
    ['פתח ברכות דף בית עמוד אלף', 'Berakhot 2a'],
    ['פתח ברכות דף 3 עמוד א', 'Berakhot 3a'],
    ['פתח את ברוכוס דף ב עמוד א', null], // Ashkenazi pronunciation is exact in the variants table
    ['נלמד משנה ברכות פרק א משנה א', 'Mishnah Berakhot 1:1'],
    ['פתח משנה ברכות א ב', 'Mishnah Berakhot 1:2'],
    ['פתח בראשית פרק א', 'Genesis 1'],
    ['פתח בראשית פרק א פסוק ה', 'Genesis 1:5'],
  ])('%s → %s', (text, ref) => {
    if (ref === null) {
      expect(sefariaOf(text)).toBe('Berakhot 2a');
      return;
    }
    expect(sefariaOf(text)).toBe(ref);
  });

  it('keeps amud א and ב apart', () => {
    expect(sefariaOf('פתח שבת דף ל עמוד א')).toBe('Shabbat 30a');
    expect(sefariaOf('פתח שבת דף ל עמוד ב')).toBe('Shabbat 30b');
  });

  it('asks which amud when none was said', () => {
    const i = parseCommand('פתח ברכות דף ב');
    expect(i.type).toBe('clarify');
    if (i.type !== 'clarify') return;
    expect(i.question).toContain('עמוד א׳ או עמוד ב׳');
    expect(i.options.map((o) => (o.intent.type === 'open' ? targetToSefaria(o.intent.target) : null))).toEqual([
      'Berakhot 2a',
      'Berakhot 2b',
    ]);
  });

  it('a period at the end of the sentence is not amud א', () => {
    expect(parseCommand('פתח ברכות דף ב.').type).toBe('clarify');
  });

  it('confirms an unclear tractate name before opening', () => {
    const i = parseCommand('פתח ברחות דף ב עמוד א');
    expect(i.type).toBe('clarify');
    if (i.type !== 'clarify') return;
    expect(i.question).toContain('ברכות');
    const opt = i.options[0].intent;
    expect(opt.type === 'open' && targetToSefaria(opt.target)).toBe('Berakhot 2a');
  });

  it('rejects a daf that does not exist', () => {
    const i = parseCommand('פתח ברכות דף צ עמוד א');
    expect(i.type).toBe('say');
  });

  it('routes other works and parashot to the name resolver', () => {
    expect(parseCommand('פתח ירושלמי ברכות פרק א')).toMatchObject({ type: 'open', target: { kind: 'name' } });
    expect(parseCommand('פתח את הפסוקים בפרשת השבוע')).toMatchObject({ type: 'open', target: { kind: 'parasha' } });
    expect(parseCommand('נלמד פרשת נח')).toMatchObject({ type: 'open', target: { kind: 'name', text: 'פרשת נח' } });
  });
});

describe('study commands', () => {
  it.each([
    ['פתח רש״י', { type: 'commentary', who: 'Rashi', action: 'open' }],
    ['פתח רשי על הקטע', { type: 'commentary', who: 'Rashi', action: 'open' }],
    ['תראה את תוספות', { type: 'commentary', who: 'Tosafot', action: 'open' }],
    ['תפתח תוספות יום טוב', { type: 'commentary', who: 'Tosafot Yom Tov', action: 'open' }],
    ['סגור את רש"י', { type: 'commentary', who: 'Rashi', action: 'close' }],
    ['חזור לעמוד הקודם', { type: 'nav', dir: -1 }],
    ['עבור לדף הבא', { type: 'nav', dir: 1 }],
    ['תחזור למקום שבו עצרנו', { type: 'resume' }],
    ['תראה לי איפה זה כתוב', { type: 'showWhere' }],
    ['תעשה לי המחשה כדי שאבין', { type: 'illustrate', variant: 'default' }],
    ['תראה את ההבדל בין השיטות', { type: 'illustrate', variant: 'compare' }],
    ['מה ישתנה אם נשנה את המקרה?', { type: 'illustrate', variant: 'change' }],
    ['עצור', { type: 'stop' }],
    ['נמשיך', { type: 'continue' }],
    ['רגע, מה פירוש המילה הזאת?', { type: 'word', word: null }],
    ['מה פירוש המילה בתרומתן', { type: 'word', word: 'בתרומתן' }],
    ['מה זה אשמורה', { type: 'word', word: 'אשמורה' }],
    ['אני רוצה לנסות לבד', { type: 'style', style: 'hint' }],
    ['תסביר לי ישר', { type: 'style', style: 'direct' }],
  ])('%s', (text, expected) => {
    expect(parseCommand(text)).toMatchObject(expected);
  });

  it.each(['מה הפשט?', 'זה לא מסתדר לי ברש״י', 'איפה תוספות מקשים?', 'מה הנפקא מינה?', 'למה רבן גמליאל חולק?'])(
    '"%s" goes to the chavruta as a question',
    (text) => {
      expect(parseCommand(text).type).toBe('chat');
    },
  );

  it('does not mistake everyday words for tractates', () => {
    expect(parseCommand('אני לומד את זה כל שבת').type).toBe('chat');
  });
});
