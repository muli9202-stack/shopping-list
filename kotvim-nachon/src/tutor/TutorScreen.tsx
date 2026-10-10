import { useEffect, useRef, useState } from 'react';
import { useActiveChild, useStore } from '../store';
import { useNav } from '../nav';
import { TopBar } from '../ui/kit';
import { MascotSays } from '../ui/Mascot';
import { sfx } from '../ui/effects';
import { stop as stopVoice } from '../services/tts';
import { RobotView } from './Robot';
import { askTutor, canListen, listenOnce, stopListening, tutorAvailable, type Turn } from './tutorService';

const STARTERS = ['איך כותבים עוגה?', 'למה כותבים עם בעין?', 'ספר לי משהו מעניין על החלל', 'תן לי חידה על מילים', 'בחן אותי בכתיב'];

/**
 * רובי – a talking AI teacher (Claude on our server). The child talks (microphone) or types; רובי
 * answers in a natural voice and moves its mouth with the words. Parents switch it on in Settings.
 */
export function TutorScreen() {
  const child = useActiveChild();
  const tutorOn = useStore((s) => s.settings.tutorOn);
  const go = useNav((s) => s.go);
  const host = useRef<HTMLDivElement>(null);
  const robot = useRef<RobotView | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [mic, setMic] = useState(false);
  const [err, setErr] = useState('');
  const ready = !!tutorOn && tutorAvailable();

  useEffect(() => {
    if (!host.current) return;
    stopVoice();
    const r = new RobotView(host.current);
    robot.current = r;
    canListen().then(setMic);
    return () => {
      r.dispose();
      robot.current = null;
    };
  }, [ready]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  if (!child) return null;

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setErr('');
    setText('');
    const history: Turn[] = [...turns, { role: 'user', text: question }];
    setTurns(history);
    setBusy(true);
    robot.current?.setThinking(true);
    try {
      const ans = await askTutor(history, child.grade);
      setTurns([...history, { role: 'assistant', text: ans.text }]);
      robot.current?.setThinking(false);
      if (ans.audio) await robot.current?.say(ans.audio);
      else robot.current?.fakeTalk(ans.text);
    } catch {
      robot.current?.setThinking(false);
      setErr('רובי לא הצליח לענות עכשיו. בדקו את החיבור לאינטרנט ונסו שוב.');
      setTurns(turns);
    } finally {
      setBusy(false);
    }
  };

  const talk = async () => {
    if (listening) return;
    robot.current?.stopAudio();
    setListening(true);
    sfx('pop');
    try {
      const said = await listenOnce();
      setListening(false);
      if (said) await send(said);
    } catch {
      setListening(false);
      setErr('לא הצלחתי לשמוע. אפשר גם לכתוב את השאלה.');
      stopListening();
    }
  };

  return (
    <div className="screen" style={{ background: 'linear-gradient(#dbe4ff, #f8f9fa)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <TopBar title="🤖 רובי – המורה החכם" />
      {!ready ? (
        <div className="center" style={{ gap: 14, marginTop: 20 }}>
          <MascotSays
            text={!tutorOn ? 'רובי, המורה המדבר, צריך אישור של ההורים. בקשו מאבא או אמא להפעיל אותו בהגדרות.' : 'רובי עובד כשהאפליקציה מחוברת לחשבון בענן. בקשו מההורים להתחבר.'}
            size={110}
          />
          {!tutorOn && (
            <button className="btn purple" onClick={() => go({ name: 'parentGate', next: { name: 'settings' } })}>
              🔒 להורים: הפעלה בהגדרות
            </button>
          )}
        </div>
      ) : (
        <>
          <div ref={host} style={{ height: '34vh', minHeight: 220, borderRadius: 24, overflow: 'hidden', background: 'radial-gradient(circle at 50% 40%, #ffffff, #c5d6ff)' }} />
          <div ref={list} style={{ flex: 1, minHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px' }}>
            {!turns.length && (
              <>
                <div className="bubble" style={{ alignSelf: 'flex-start' }}>
                  שלום! אני רובי 🤖 אפשר לשאול אותי איך כותבים מילה, לבקש חידה, או לדבר על כל נושא שמעניין אותך.
                </div>
                <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                  {STARTERS.map((s) => (
                    <button key={s} className="btn white" style={{ padding: '6px 12px', fontSize: 15 }} onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
            {turns.map((t, i) => (
              <div
                key={i}
                dir="rtl"
                style={{
                  alignSelf: t.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: t.role === 'user' ? '#d0ebff' : '#ffffff',
                  borderRadius: 18,
                  padding: '8px 14px',
                  fontSize: 18,
                  boxShadow: '0 2px 6px rgba(0,0,0,.08)',
                }}
              >
                {t.text}
              </div>
            ))}
            {busy && <div className="small muted">רובי חושב... 🤔</div>}
            {err && <div className="small" style={{ color: 'var(--red)' }}>{err}</div>}
          </div>
          <div className="row" style={{ gap: 8 }}>
            {mic && (
              <button className={`btn big ${listening ? 'pink' : 'green'}`} style={{ minWidth: 76 }} disabled={busy} onClick={talk} aria-label="לדבר">
                {listening ? '👂' : '🎤'}
              </button>
            )}
            <input
              className="field grow"
              dir="rtl"
              placeholder="כתבו לרובי..."
              value={text}
              maxLength={300}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send(text)}
            />
            <button className="btn blue" disabled={busy || !text.trim()} onClick={() => send(text)}>
              שליחה
            </button>
          </div>
          <p className="small muted center" style={{ margin: 0 }}>רובי הוא רובוט (בינה מלאכותית). לא משתפים איתו פרטים אישיים.</p>
        </>
      )}
    </div>
  );
}
