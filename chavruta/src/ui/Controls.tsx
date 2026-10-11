// The conversation controls: microphone (open or push-to-talk), mute, stop, typing,
// speed and volume. The microphone feeds the engine; speech while the chavruta talks
// stops it (barge-in), after filtering out its own voice coming back from the speakers.
import { useEffect, useRef, useState } from 'react';
import { engine } from '../brain/engine';
import { Listener, recognitionSupported, shouldBargeIn } from '../speech/asr';
import { speaker } from '../speech/tts';
import { useStudy } from '../state/store';
import { IS_ARTIFACT } from '../env';

let listener: Listener | null = null;

function getListener(): Listener {
  if (!listener) {
    listener = new Listener({
      onInterim: (text) => {
        useStudy.getState().set({ interim: text });
        if (!text) return;
        if (engine.busy && speaker.speaking) {
          if (shouldBargeIn(text, engine.speakingText)) engine.interrupt();
        } else if (!engine.busy) useStudy.getState().set({ avatar: 'listening' });
      },
      onFinal: (text) => void engine.handleInput(text),
      onState: (on) => useStudy.getState().set({ micOn: on }),
      onError: (message) => {
        useStudy.getState().set({ micOn: false, error: message });
      },
    });
  }
  listener.endOfTurnMs = useStudy.getState().settings.endOfTurnMs;
  return listener;
}

export function startMic() {
  getListener().start();
}

export function stopMic() {
  listener?.stop();
}

export function Controls() {
  const micOn = useStudy((s) => s.micOn);
  const settings = useStudy((s) => s.settings);
  const avatar = useStudy((s) => s.avatar);
  const interim = useStudy((s) => s.interim);
  const [text, setText] = useState('');
  const [holding, setHolding] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // Inside a Claude Artifact the microphone is not available: the learner types, the chavruta speaks.
  const supported = !IS_ARTIFACT && recognitionSupported();
  const ptt = settings.micMode === 'ptt';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA';
      if (e.key === 'Escape') engine.interrupt();
      else if (e.key === '/' && !typing) {
        e.preventDefault();
        input.current?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        if (useStudy.getState().micOn) stopMic();
        else startMic();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    void engine.handleInput(t);
  };

  const pttDown = () => {
    setHolding(true);
    engine.interrupt();
    getListener().start();
  };
  const pttUp = () => {
    setHolding(false);
    listener?.release();
  };

  const speaking = avatar === 'speaking' || avatar === 'thinking' || avatar === 'checking';

  return (
    <div className="controls" role="toolbar" aria-label="שליטה בשיחה">
      {supported &&
        (ptt ? (
          <button
            className={`btn mic ${holding ? 'on' : ''}`}
            onPointerDown={pttDown}
            onPointerUp={pttUp}
            onPointerLeave={() => holding && pttUp()}
            onKeyDown={(e) => e.key === ' ' && !holding && (e.preventDefault(), pttDown())}
            onKeyUp={(e) => e.key === ' ' && (e.preventDefault(), pttUp())}
            aria-pressed={holding}
            title="החזק כדי לדבר"
          >
            🎙 {holding ? 'מדבר…' : 'לחץ כדי לדבר'}
          </button>
        ) : (
          <button
            className={`btn mic ${micOn ? 'on' : ''}`}
            onClick={() => (micOn ? stopMic() : startMic())}
            aria-pressed={micOn}
            title="Ctrl+Shift+M"
          >
            {micOn ? '🎙 מיקרופון פתוח' : '🔇 מיקרופון סגור'}
          </button>
        ))}
      <button className="btn stop" onClick={() => engine.interrupt()} disabled={!speaking} title="עצור (Esc)" aria-label="עצור את החברותא">
        ■ עצור
      </button>
      <form
        className="type-box"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={supported ? 'אפשר גם להקליד… (/)' : IS_ARTIFACT ? 'כתוב לחברותא… למשל: בוא נלמד ברכות דף ב עמוד א' : 'הקלד כאן (זיהוי דיבור לא נתמך בדפדפן הזה)'}
          aria-label="הקלדה לחברותא"
          dir="rtl"
        />
        <button className="btn" type="submit" disabled={!text.trim()}>
          שלח
        </button>
      </form>
      <label className="slider" title="מהירות הדיבור">
        מהירות
        <input type="range" min={0.6} max={1.6} step={0.1} value={settings.rate} onChange={(e) => useStudy.getState().setSettings({ rate: Number(e.target.value) })} />
      </label>
      <label className="slider" title="עוצמה">
        עוצמה
        <input type="range" min={0} max={1} step={0.1} value={settings.volume} onChange={(e) => useStudy.getState().setSettings({ volume: Number(e.target.value) })} />
      </label>
      <label className="toggle">
        <input type="checkbox" checked={settings.captions} onChange={(e) => useStudy.getState().setSettings({ captions: e.target.checked })} /> כתוביות
      </label>
      {interim && micOn && <span className="interim-inline">שומע: {interim}</span>}
    </div>
  );
}
