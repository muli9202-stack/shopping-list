import { useEffect, useMemo, useState } from 'react';
import { updateActive, useActiveChild, useStore } from '../store';
import { useNav } from '../nav';
import { TopBar, PRAISE, pick } from '../ui/kit';
import { isFirstTime, useGuide } from '../ui/guide';
import { Mascot, MascotSays } from '../ui/Mascot';
import { DICTATIONS, SHORT_DICTATIONS, STORY_IDEAS, bandFor, type Dictation } from '../data/stories';
import { LiveWrite } from '../ui/LiveWrite';
import { isKnownWord } from '../engine/spellcheck';
import { checkStory } from '../services/ai';
import { speak, stop } from '../services/tts';
import { alignTexts, norm, tokenize } from '../engine/analyze';
import { addMistake, addPoints, recordAnswer } from '../engine/progress';
import { SKILLS, SKILL_BY_ID } from '../data/skills';
import { confetti, flyPoints, sfx } from '../ui/effects';
import { GameHost } from '../games/GameHost';
import { gamesForSkill } from '../engine/progress';
import type { Child, SkillId } from '../types';

interface Token {
  typed: string | null;
  right: string | null;
  ok: boolean;
  /** the word's correctness is certain (dictation, AI check or a known word) */
  sure?: boolean;
  skill?: SkillId | 'other';
  pair?: string;
}

interface Outcome {
  mode: 'story' | 'dictation';
  tokens: Token[];
  feedback: string;
  engine: 'ai' | 'offline' | 'exact';
  points: { words: number; bonus: number; label: string }[];
  total: number;
  weakSkills: SkillId[];
}

export function WriteScreen() {
  const child = useActiveChild();
  const [mode, setMode] = useState<null | 'story' | 'dictation'>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  useGuide(mode ? null : 'write');
  if (!child) return null;

  return (
    <div className="screen" style={{ background: 'linear-gradient(#fff0f6, #fff7e6)' }}>
      <TopBar title="✏️ כתיבה ומבחן" onBack={mode && !outcome ? () => setMode(null) : undefined} guide={mode === 'story' ? 'story' : mode === 'dictation' ? 'dictation' : 'write'} />
      {outcome ? (
        <ResultView outcome={outcome} child={child} onAgain={() => { setOutcome(null); setMode(null); }} />
      ) : mode === 'story' ? (
        <StoryMode child={child} onDone={setOutcome} />
      ) : mode === 'dictation' ? (
        <DictationMode child={child} onDone={setOutcome} />
      ) : (
        <div className="center" style={{ gap: 16 }}>
          <MascotSays text="מה נעשה היום?" size={90} />
          <button className="big-square" style={{ background: 'linear-gradient(135deg,#fb8500,#ff5d8f)' }} onClick={() => setMode('story')}>
            <span className="emoji">📝</span>
            <span className="grow">
              סיפור משלי
              <span className="sub">אני נותנת רעיון, ואתם כותבים</span>
            </span>
          </button>
          <button className="big-square" style={{ background: 'linear-gradient(135deg,#3a86ff,#20c997)' }} onClick={() => setMode('dictation')}>
            <span className="emoji">🎧</span>
            <span className="grow">
              הכתבה
              <span className="sub">מקשיבים לסיפור וכותבים משפט אחרי משפט</span>
            </span>
          </button>
          {child.writings.length > 0 && (
            <div className="card" style={{ width: '100%' }}>
              <b>📈 ההתקדמות שלי בכתיבה</b>
              <WritingTrend child={child} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WritingTrend({ child }: { child: Child }) {
  const last = child.writings.slice(-8);
  return (
    <div className="row" style={{ alignItems: 'flex-end', height: 90, gap: 6, marginTop: 8 }}>
      {last.map((w, k) => {
        const acc = w.words ? (w.words - w.mistakes) / w.words : 0;
        return (
          <div key={k} className="grow center" style={{ gap: 2 }}>
            <span className="small">{Math.round(acc * 100)}%</span>
            <div style={{ width: '100%', height: acc * 60 + 4, background: w.mode === 'story' ? '#ff922b' : '#4dabf7', borderRadius: 6 }} />
          </div>
        );
      })}
    </div>
  );
}

function StoryMode({ child, onDone }: { child: Child; onDone: (o: Outcome) => void }) {
  useGuide('story');
  const ideas = STORY_IDEAS[bandFor(child.grade)];
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * ideas.length));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const idea = ideas[idx % ideas.length];
  useEffect(() => {
    const t = setTimeout(() => speak(`הרעיון לסיפור: ${idea.text}`), isFirstTime('story') ? 12000 : 2500);
    return () => clearTimeout(t);
  }, [idea]);
  const words = tokenize(text).length;
  // grades 1-2 write one or two sentences, not a whole story
  const young = child.grade <= 2;

  const check = async () => {
    setBusy(true);
    stop();
    speak('ינשופי בודק את הסיפור שלך...');
    const res = await checkStory(text, child.grade);
    // a word counts as "written correctly" for learning credit only when we are sure: checked by AI or a known word
    const tokens: Token[] = res.words.map((w) => ({ typed: w.typed, right: w.corrected, ok: w.typed === w.corrected, skill: w.skill, pair: w.pair, sure: res.engine === 'ai' || isKnownWord(w.corrected) }));
    const good = tokens.filter((t) => t.ok).length;
    const unique = new Set(tokens.map((t) => t.right)).size;
    const points = [{ words: good, bonus: good * 5, label: `${good} מילים נכונות` }];
    if (!young && tokens.length >= 15) points.push({ words: 0, bonus: tokens.length >= 40 ? 40 : 20, label: tokens.length >= 40 ? 'סיפור ארוך במיוחד!' : 'סיפור ארוך' });
    if (young && tokens.length >= 6) points.push({ words: 0, bonus: 15, label: 'כתבת יותר ממשפט!' });
    if (tokens.length >= 10 && unique / tokens.length > 0.75) points.push({ words: 0, bonus: 15, label: 'אוצר מילים עשיר' });
    if (res.creativity) points.push({ words: 0, bonus: res.creativity * 10, label: `יצירתיות ${'✨'.repeat(res.creativity)}` });
    const weakSkills = uniqSkills(tokens);
    setBusy(false);
    onDone({
      mode: 'story',
      tokens,
      engine: res.engine,
      feedback: res.feedback ?? localFeedback(tokens),
      points,
      total: points.reduce((a, p) => a + p.bonus, 0),
      weakSkills,
    });
  };

  if (busy)
    return (
      <div className="center" style={{ gap: 14, marginTop: 40 }}>
        <Mascot size={130} mood="think" />
        <h3>ינשופי בודק את הסיפור...</h3>
        <div style={{ fontSize: 40, animation: 'floaty 1s infinite' }}>🔍✨</div>
      </div>
    );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card row">
        <span style={{ fontSize: 48 }}>{idea.emoji}</span>
        <b className="grow" style={{ fontSize: 20 }}>{idea.text}</b>
        <button className="icon-btn" onClick={() => speak(idea.text, { force: true })}>🔊</button>
      </div>
      <button className="btn ghost" onClick={() => setIdx(idx + 1)}>
        🎲 רעיון אחר
      </button>
      <LiveWrite value={text} onChange={setText} placeholder={young ? 'כתבו כאן משפט אחד או שניים...' : 'כתבו כאן את הסיפור...'} />
      <div className="row">
        <span className="muted grow">{words} מילים {words >= 15 ? '🌟' : words >= 5 ? '👍' : ''}</span>
        <button className="btn green big" disabled={words < (young ? 2 : 3)} onClick={check}>
          בדיקה ✨
        </button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {young ? '💡 טיפ: כל מילה שכתבתם נכון = נקודות!' : '💡 טיפ: סיפור ארוך ועשיר במילים חדשות = יותר נקודות!'}
      </p>
    </div>
  );
}

function DictationMode({ child, onDone }: { child: Child; onDone: (o: Outcome) => void }) {
  useGuide('dictation');
  const band = bandFor(child.grade);
  const done = useMemo(() => new Set(child.writings.filter((w) => w.mode === 'dictation').map((w) => w.text.split('|')[0])), [child.writings]);
  const [d] = useState<Dictation>(() => {
    // grades 1-2 get short dictations (three short sentences)
    const list = band === 1 ? SHORT_DICTATIONS : DICTATIONS.filter((x) => x.band === band);
    return list.find((x) => !done.has(x.id)) ?? list[Math.floor(Math.random() * list.length)];
  });
  const [i, setI] = useState(-1);
  const [answers, setAnswers] = useState<string[]>([]);
  const [cur, setCur] = useState('');
  const rate = child.grade <= 2 ? 0.6 : child.grade <= 4 ? 0.7 : 0.8;

  // speak the vocalized version when we have one, so every word is pronounced correctly
  const sayCurrent = (idx: number, slower = false) => speak(d.spoken?.[idx] ?? d.sentences[idx], { force: true, rate: slower ? rate - 0.15 : rate });

  useEffect(() => {
    if (i >= 0) {
      const t = setTimeout(() => sayCurrent(i), 500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  if (i < 0)
    return (
      <div className="center" style={{ gap: 14 }}>
        <div style={{ fontSize: 80 }}>{d.emoji}</div>
        <h2>{d.title}</h2>
        <p>אקריא לכם {d.sentences.length} משפטים, לאט לאט. אחרי כל משפט – כתבו אותו.</p>
        <p className="small muted">אפשר ללחוץ 🔊 כדי לשמוע שוב, או 🐢 כדי לשמוע לאט יותר.</p>
        <button className="btn big green" onClick={() => setI(0)}>
          🎧 מתחילים
        </button>
      </div>
    );

  const next = () => {
    const all = [...answers, cur];
    setAnswers(all);
    setCur('');
    sfx('pop');
    if (i + 1 < d.sentences.length) {
      setI(i + 1);
      return;
    }
    stop();
    const tokens: Token[] = [];
    d.sentences.forEach((s, k) => {
      for (const a of alignTexts(s, all[k] ?? '')) tokens.push({ typed: a.typed, right: a.expected, ok: a.ok, skill: a.issues[0]?.skill, pair: a.issues[0]?.pair, sure: true });
    });
    const good = tokens.filter((t) => t.ok).length;
    const points = [
      { words: good, bonus: good * 5, label: `${good} מילים נכונות` },
      { words: 0, bonus: 30, label: 'סיימת הכתבה!' },
    ];
    onDone({
      mode: 'dictation',
      tokens,
      engine: 'exact',
      feedback: localFeedback(tokens),
      points,
      total: points.reduce((a, p) => a + p.bonus, 0),
      weakSkills: uniqSkills(tokens),
      // remember which dictation was done
      ...{ dictationId: d.id },
    } as Outcome);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row">
        <b className="grow">
          {d.emoji} משפט {i + 1} מתוך {d.sentences.length}
        </b>
        <button className="btn blue" onClick={() => sayCurrent(i)}>
          🔊 שוב
        </button>
        <button className="btn white" onClick={() => sayCurrent(i, true)}>
          🐢
        </button>
      </div>
      <div className="row" style={{ gap: 4 }}>
        {d.sentences.map((_, k) => (
          <div key={k} className="grow" style={{ height: 10, borderRadius: 6, background: k < i ? 'var(--green)' : k === i ? 'var(--yellow)' : '#dee2e6' }} />
        ))}
      </div>
      <LiveWrite key={i} value={cur} onChange={setCur} placeholder="כתבו את המשפט ששמעתם..." expected={d.sentences[i]} />
      <button className="btn green big" disabled={!cur.trim()} onClick={next}>
        {i + 1 < d.sentences.length ? 'למשפט הבא ⬅️' : 'סיימתי! בדיקה ✨'}
      </button>
    </div>
  );
}

function uniqSkills(tokens: Token[]): SkillId[] {
  const counts = new Map<SkillId, number>();
  for (const t of tokens) if (!t.ok && t.skill && t.skill !== 'other') counts.set(t.skill, (counts.get(t.skill) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
}

/** Feedback phrases are fixed sentences so they can be spoken with the recorded natural voice. */
export const FEEDBACK = {
  perfect: 'וואו! אין אף טעות. אתה כותב מושלם!',
  almost: 'כמעט מושלם! רק כמה טעויות קטנות.',
  good: 'עבודה יפה! תיקנו יחד כמה מילים.',
  tip: (title: string) => `כדאי לשים לב ל${title}, יש לי טריק בשבילך!`,
};

function localFeedback(tokens: Token[]): string {
  const wrong = tokens.filter((t) => !t.ok).length;
  if (!wrong) return FEEDBACK.perfect;
  const top = uniqSkills(tokens)[0];
  const tip = top ? ` ${FEEDBACK.tip(SKILL_BY_ID[top].title)}` : '';
  return (wrong <= 2 ? FEEDBACK.almost : FEEDBACK.good) + tip;
}

/**
 * Which skill a correctly written word exercised (for learning credit). A word can exercise several;
 * the one the child is weakest at gets the credit.
 */
function skillOfWord(w: string, c: Child): SkillId | null {
  const n = norm(w);
  if (n === 'עם' || n === 'אם') return 'im_im';
  const cands: SkillId[] = [];
  if (/[ךםןףץ]$/.test(n)) cands.push('finals');
  if (n.length > 2 && /[הא]$/.test(n)) cands.push('he_alef_end');
  for (const s of SKILLS) if (s.id !== 'finals' && s.id !== 'full_spelling' && s.groups.some((g) => g.filter((ch) => ch && n.includes(ch)).length > 0)) cands.push(s.id);
  const eligible = cands.filter((id) => SKILLS.find((s) => s.id === id)!.minGrade <= c.grade);
  if (!eligible.length) return null;
  return eligible.sort((a, b) => (c.skills[a]?.mastery ?? 0.5) - (c.skills[b]?.mastery ?? 0.5))[0];
}

function ResultView({ outcome, child, onAgain }: { outcome: Outcome; child: Child; onAgain: () => void }) {
  const [game, setGame] = useState<SkillId | null>(null);
  const [saved, setSaved] = useState(false);
  const voiceOn = useStore((s) => s.settings.voiceOn);

  useEffect(() => {
    if (saved) return;
    setSaved(true);
    const wrong = outcome.tokens.filter((t) => !t.ok);
    updateActive((c) => {
      let n = c;
      for (const t of wrong) {
        const sk = t.skill && t.skill !== 'other' ? t.skill : null;
        if (sk) n = recordAnswer(n, sk, false);
        n = addMistake(n, { expected: t.right ?? '', typed: t.typed ?? '', skill: t.skill ?? 'other', pair: t.pair, source: outcome.mode === 'story' ? 'write' : 'dictation' });
      }
      // correctly written words also count as successful practice (not only mistakes)
      for (const t of outcome.tokens.filter((x) => x.ok && x.sure)) {
        const sk = skillOfWord(t.right ?? '', n);
        if (sk) n = recordAnswer(n, sk, true);
      }
      const words = outcome.tokens.filter((t) => t.typed).length;
      n = addPoints(n, outcome.total);
      const id = (outcome as Outcome & { dictationId?: string }).dictationId;
      return {
        ...n,
        writings: [
          ...n.writings,
          {
            t: Date.now(),
            mode: outcome.mode,
            text: id ? `${id}|` : outcome.tokens.map((x) => x.typed ?? '').join(' '),
            corrected: outcome.tokens.map((x) => x.right ?? '').join(' '),
            words,
            mistakes: wrong.length,
            points: outcome.total,
          },
        ].slice(-60),
        updatedAt: Date.now(),
      };
    });
    setTimeout(() => {
      confetti(outcome.total > 80 ? 200 : 100);
      sfx('win');
      flyPoints(outcome.total);
      // feedback written by the AI about the child's own story stays on the device
      speak(`${pick(PRAISE)} ${outcome.feedback}`, { local: outcome.engine === 'ai' });
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (game)
    return (
      <div>
        <div className="card center" style={{ marginBottom: 10, background: '#fff9db' }}>
          🎮 משחק תיקון: {SKILL_BY_ID[game].title}
        </div>
        <GameHost
          game={gamesForSkill(game)[child.writings.length % gamesForSkill(game).length]}
          skills={[game]}
          rounds={6}
          onFinish={() => {
            confetti(80);
            setGame(null);
          }}
        />
      </div>
    );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card">
        <div className="small muted">✏️ מה שכתבת:</div>
        <div className="fix-line kid">
          {outcome.tokens.map((t, k) =>
            t.typed === null ? (
              <span key={k} className="err">
                {' ___ '}
              </span>
            ) : (
              <span key={k} className={t.ok ? '' : 'err'}>
                {t.typed}{' '}
              </span>
            ),
          )}
        </div>
        <div className="small muted" style={{ marginTop: 8 }}>
          ✅ ככה כותבים נכון:
        </div>
        <div className="fix-line right">
          {outcome.tokens
            .filter((t) => t.right !== null)
            .map((t, k) => (
              <span key={k}>
                <span className={t.ok ? '' : 'fixed'}>{t.right}</span>{' '}
              </span>
            ))}
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>
          {outcome.engine === 'ai' ? '🤖 נבדק בבינה מלאכותית' : outcome.engine === 'exact' ? '🎧 נבדק מול ההכתבה' : '🔎 בדיקה בסיסית במכשיר'}
        </div>
      </div>

      <div className="card row" style={{ alignItems: 'flex-start' }}>
        <Mascot size={70} cheer />
        <div className="grow">{outcome.feedback}</div>
        {voiceOn && <button className="icon-btn" onClick={() => speak(outcome.feedback, { force: true, local: outcome.engine === 'ai' })}>🔊</button>}
      </div>

      <div className="card">
        {outcome.points.map((p, k) => (
          <div key={k} className="row" style={{ justifyContent: 'space-between', animation: `popIn .4s ${k * 0.2}s both` }}>
            <span>{p.label}</span>
            <b style={{ color: 'var(--orange)' }}>+{p.bonus} ⭐</b>
          </div>
        ))}
        <hr />
        <div className="row" style={{ justifyContent: 'space-between', fontSize: 24 }}>
          <b>סה״כ</b>
          <b style={{ color: 'var(--orange)' }}>+{outcome.total} ⭐</b>
        </div>
      </div>

      {outcome.weakSkills.length > 0 && (
        <div className="card" style={{ background: '#f3f0ff' }}>
          <b>🎮 משחקי תיקון – בדיוק על מה שצריך:</b>
          <div className="row" style={{ flexWrap: 'wrap', marginTop: 8 }}>
            {outcome.weakSkills.slice(0, 3).map((s) => (
              <button key={s} className="btn purple" onClick={() => setGame(s)}>
                {SKILL_BY_ID[s].icon} {SKILL_BY_ID[s].title}
              </button>
            ))}
          </div>
        </div>
      )}

      <button className="btn big green" onClick={onAgain}>
        ✏️ עוד כתיבה
      </button>
      <BackHome />
    </div>
  );
}

function BackHome() {
  const back = useNav((s) => s.back);
  return (
    <button className="btn white" onClick={back}>
      🏠 חזרה
    </button>
  );
}
