import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignTexts, classifyWord } from './analyze.ts';
import { checkOffline } from './spellcheck.ts';
import { buildQuestions } from './questions.ts';
import { SKILLS } from '../data/skills.ts';

test('classifies letter confusions', () => {
  assert.equal(classifyWord('עוגה', 'אוגה')[0].skill, 'alef_ayin');
  assert.equal(classifyWord('תות', 'טות')[0].skill, 'tet_tav');
  assert.equal(classifyWord('כלב', 'חלב')[0].skill, 'kaf_het_kuf');
  assert.equal(classifyWord('ילדה', 'ילדא')[0].skill, 'he_alef_end');
  assert.equal(classifyWord('שולחן', 'שלחן')[0].skill, 'full_spelling');
  assert.equal(classifyWord('מים', 'מימ')[0].skill, 'finals');
  assert.equal(classifyWord('עם', 'אם')[0].skill, 'im_im');
  assert.equal(classifyWord('סוס', 'שוס')[0].skill, 'samekh_sin');
});

test('aligns dictation with split prefix and missing word', () => {
  const r = alignTexts('הלכנו לבית של סבא.', 'הלכנו ל בית סבה');
  assert.equal(r.length, 4);
  assert.equal(r[1].issues[0].skill, 'prefixes');
  assert.equal(r[2].typed, null);
  assert.equal(r[3].issues[0].skill, 'he_alef_end');
});

test('offline checker fixes known misspellings only', () => {
  const r = checkOffline('הכלב אוהב אוגה ושולחן חדש. דרקונ טס');
  assert.match(r.corrected, /עוגה/);
  assert.match(r.corrected, /דרקון/);
  assert.match(r.corrected, /ושולחן/);
  const unknown = checkOffline('פלמינגו');
  assert.equal(unknown.corrected, 'פלמינגו');
});

test('every skill yields questions for every grade', () => {
  for (const s of SKILLS) for (let g = s.minGrade; g <= 8; g++) {
    const qs = buildQuestions(s.id, g, 8, 'missing');
    assert.equal(qs.length, 8, `${s.id} grade ${g}`);
    for (const q of qs) {
      assert.ok(q.options.includes(q.answer), `${s.id} ${q.word}`);
      assert.ok(new Set(q.options).size === q.options.length, `dup options ${q.word}`);
    }
  }
});

import { changePoints, mergeChild } from './merge.ts';
import { newChild, recordAnswer } from './progress.ts';

test('merging two devices keeps progress from both', () => {
  const base = newChild('נועה', 2, '🦊');
  let a = changePoints(base, 50, 'devA');
  a = recordAnswer(a, 'alef_ayin', false, { expected: 'עוגה', typed: 'אוגה', source: 'game' });
  let b = changePoints(base, 30, 'devB');
  b = changePoints(b, -20, 'devB');
  b = { ...b, room: { ...b.room, owned: [...b.room.owned, 'dog'] } };
  const m = mergeChild(a, b);
  assert.equal(m.points, 100 + 50 + 30 - 20);
  assert.equal(m.mistakes.length, 1);
  assert.ok(m.room.owned.includes('dog'));
  // merging again is stable
  assert.equal(mergeChild(m, a).points, m.points);
});

import { sameChild } from './merge.ts';

test('merge converges: re-merging the result changes nothing', () => {
  const base = newChild('דן', 3, '🐼');
  const a = changePoints({ ...base, seenTricks: ['tet_tav', 'im_im'] }, 10, 'A');
  const b = changePoints({ ...base, seenTricks: ['im_im'], room: { ...base.room, owned: ['rug_round', 'bed', 'cat'] } }, 5, 'B');
  const m1 = mergeChild(a, b);
  const m2 = mergeChild(b, a);
  assert.ok(sameChild(m1, m2));
  // a copy with keys in another order (as Firestore may return it) is still the same child
  const reordered = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(m1).reverse())));
  assert.ok(sameChild(mergeChild(reordered, m1), m1));
});

import { setVisualOnly } from './questions.ts';

test('without a Hebrew voice every question can be solved by looking', () => {
  setVisualOnly(true);
  for (const s of SKILLS) {
    const qs = buildQuestions(s.id, 3, 8, 'choose');
    for (const q of qs) assert.ok(q.kind !== 'choose' || q.emoji, `${s.id}: ${q.word} needs sound`);
  }
  setVisualOnly(false);
});

import { reviewAnswer, dueWords } from './review.ts';
import { allTips, nextTip } from '../data/tips.ts';

test('a mistake word comes back and leaves after being answered right over time', () => {
  let c = newChild('נ', 2, 'x');
  c = reviewAnswer(c, 'alef_ayin', 'עוגה', false);
  assert.equal(dueWords(c).length, 1);
  c = reviewAnswer(c, 'alef_ayin', 'עוגה', true);
  assert.equal(dueWords(c).length, 0); // next review tomorrow
  for (let k = 0; k < 5; k++) c = reviewAnswer(c, 'alef_ayin', 'עוגה', true);
  assert.equal(Object.keys(c.review ?? {}).length, 0);
  assert.equal(c.learnedWords, 1);
});

test('more than 1000 unique tips, never repeated', () => {
  const tips = allTips();
  assert.ok(tips.length >= 1000, `only ${tips.length}`);
  assert.equal(new Set(tips.map((t) => t.id)).size, tips.length);
  const seen: string[] = [];
  for (let k = 0; k < 40; k++) {
    const t = nextTip(seen, 'alef_ayin', 'עוגה');
    assert.ok(t && !seen.includes(t.id));
    seen.push(t!.id);
  }
});

import { FAMILIES } from '../data/roots.ts';
import { rootItems } from './roots.ts';

test('every family word holds its root letters in order', () => {
  const regular = (w: string) => w.replace(/[םןץףך]/g, (c) => ({ ם: 'מ', ן: 'נ', ץ: 'צ', ף: 'פ', ך: 'כ' })[c]!);
  for (const f of FAMILIES)
    for (const w of f.words) {
      let i = 0;
      for (const ch of regular(w)) if (ch === f.root[i]) i++;
      assert.equal(i, f.root.length, `${w} / ${f.root}`);
    }
});

test('the roots game always has an answer among the options', () => {
  for (let g = 3; g <= 8; g++)
    for (const it of rootItems(g, 12)) {
      const [answer, options] = it.kind === 'spell' ? [it.q.answer, it.q.options] : [it.answer, it.options];
      assert.ok(options.includes(answer));
      assert.equal(new Set(options).size, options.length);
    }
});
