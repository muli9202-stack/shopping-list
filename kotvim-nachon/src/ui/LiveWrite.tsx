import { useMemo } from 'react';
import { HebrewKeyboard } from '../games/common';
import { alignTexts, norm, tokenize } from '../engine/analyze';
import { checkOffline } from '../engine/spellcheck';
import { sfx } from './effects';

interface Tok {
  typed: string;
  right: string;
  ok: boolean;
}

/**
 * Writing with live correction: the child writes on the first line, and as soon as a word is
 * finished (space), the second line shows it written correctly – fixed words light up in green.
 * A finished word can't be erased any more, so the check stays honest.
 * `expected` (dictation) compares with the dictated sentence; without it (story) the on-device
 * spelling checker is used.
 */
export function LiveWrite({
  value,
  onChange,
  onEnter,
  placeholder,
  expected,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  placeholder: string;
  expected?: string;
}) {
  const finished = value.endsWith(' ') || /[.,!?]$/.test(value) ? value : value.slice(0, value.lastIndexOf(' ') + 1);
  const current = value.slice(finished.length);

  const toks = useMemo<Tok[]>(() => {
    const typed = tokenize(finished);
    if (!typed.length) return [];
    if (expected) {
      const exp = tokenize(expected);
      // compare only with the part of the sentence the child has reached so far
      const aligned = alignTexts(exp.slice(0, typed.length + 2).join(' '), typed.join(' '));
      let lastTyped = -1;
      aligned.forEach((a, k) => {
        if (a.typed !== null) lastTyped = k;
      });
      return aligned.slice(0, lastTyped + 1).map((a) => ({ typed: a.typed ?? '', right: a.expected ?? '', ok: a.ok }));
    }
    return checkOffline(typed.join(' ')).words.map((w) => ({ typed: w.typed, right: w.corrected, ok: w.typed === w.corrected }));
  }, [finished, expected]);

  const add = (k: string) => {
    const next = (value + k).slice(0, 1200);
    // a word was just finished: little sound for right / wrong
    if ((k === ' ' || /[.,!?]/.test(k)) && current) {
      const expWords = expected ? tokenize(expected) : null;
      const idx = tokenize(finished).length;
      const good = expWords ? norm(expWords[idx] ?? '') === norm(current) : checkOffline(current).words[0]?.corrected === current;
      sfx(good ? 'pop' : 'bad');
    }
    onChange(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="card" style={{ padding: 10 }}>
        <div className="small muted">✏️ אני כותב:</div>
        <div className="fix-line kid" style={{ minHeight: 56, padding: '4px 6px' }}>
          {!value && <span style={{ color: '#adb5bd', fontFamily: 'var(--ui)', fontSize: 20 }}>{placeholder}</span>}
          {toks.map((t, k) =>
            t.typed ? (
              <span key={k} className={t.ok ? '' : 'err'}>
                {t.typed}{' '}
              </span>
            ) : null,
          )}
          <span>{current}</span>
          <span className="caret">|</span>
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>
          ✅ ככה כותבים נכון:
        </div>
        <div className="fix-line right" style={{ minHeight: 56, padding: '4px 6px' }}>
          {toks.map((t, k) =>
            t.right ? (
              <span key={`${k}-${t.right}`}>
                <span className={t.ok ? '' : 'fixed'} style={t.ok ? undefined : { animation: 'pop .5s' }}>
                  {t.right}
                </span>{' '}
              </span>
            ) : null,
          )}
        </div>
      </div>
      <HebrewKeyboard
        punctuation
        onKey={add}
        // only the word being written can be erased; finished words stay as they were written
        onBack={() => current && onChange(value.slice(0, -1))}
        onSpace={() => (value && !value.endsWith(' ') ? add(' ') : undefined)}
        onEnter={onEnter}
      />
    </div>
  );
}
