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
