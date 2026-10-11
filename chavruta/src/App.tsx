// The study room: the page in the middle, commentary beside it when open, and the
// chavruta in a fixed side column (a strip above the text on phones), never covering the text.
import { useEffect, useRef, useState } from 'react';
import { brainMode, engine } from './brain/engine';
import { IS_ARTIFACT } from './env';
import { amudLabel } from './core/refs';
import { useStudy, PROGRESS_LABEL, SAY_KIND_LABEL } from './state/store';
import { Avatar } from './ui/Avatar';
import { CommentaryPane } from './ui/CommentaryPane';
import { Controls, startMic } from './ui/Controls';
import { IllustrationView } from './ui/IllustrationView';
import { HelpPanel, LibraryPanel, Modal, SettingsPanel, StartPanel } from './ui/Panels';
import { TextPane } from './ui/TextPane';
import { recognitionSupported } from './speech/asr';

function useNarrow() {
  const q = '(max-width: 900px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setNarrow(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return narrow;
}

/** A draggable divider between columns (also works with the keyboard arrows). */
function Splitter({ value, onChange, min, max, label }: { value: number; onChange: (v: number) => void; min: number; max: number; label: string }) {
  const start = useRef<{ x: number; v: number } | null>(null);
  return (
    <div
      className="splitter"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, v: value };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        // RTL: these columns sit to the left of the divider, so dragging left narrows them.
        const v = start.current.v + (e.clientX - start.current.x);
        onChange(Math.min(max, Math.max(min, v)));
      }}
      onPointerUp={() => (start.current = null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onChange(Math.max(min, value - 20));
        if (e.key === 'ArrowRight') onChange(Math.min(max, value + 20));
      }}
    />
  );
}

function ClarifyBox() {
  const clarify = useStudy((s) => s.clarify);
  if (!clarify) return null;
  return (
    <div className="clarify" role="group" aria-label="שאלת בירור">
      <p>{clarify.question}</p>
      <div className="row wrap">
        {clarify.options.map((o) => (
          <button
            key={o.label}
            className="chip"
            onClick={() => {
              useStudy.getState().set({ clarify: null });
              useStudy.getState().addTurn({ role: 'user', text: o.label, lines: [] });
              void engine.dispatch(o.payload as Parameters<typeof engine.dispatch>[0]);
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Transcript() {
  const turns = useStudy((s) => s.turns);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [turns]);
  return (
    <details className="transcript" open>
      <summary>תמליל השיחה</summary>
      <div className="transcript-scroll" ref={box} aria-live="off">
        {turns.slice(-30).map((t) =>
          t.role === 'user' ? (
            <p key={t.id} className="t-user">
              <b>אתה:</b> {t.text}
            </p>
          ) : (
            <div key={t.id} className={`t-bot ${t.interrupted ? 'cut' : ''}`}>
              {t.lines.map((l, i) => (
                <p key={i} className={`k-${l.kind} ${l.heard ? '' : 'unheard'}`}>
                  {SAY_KIND_LABEL[l.kind] && <span className="kind">{SAY_KIND_LABEL[l.kind]}</span>}
                  {l.cutAt !== undefined ? (
                    <>
                      {l.text.slice(0, l.cutAt)}
                      <span className="cut-mark" title="נקטע כאן, ההמשך לא נשמע">
                        {' '}
                        ⟨נקטע⟩{' '}
                      </span>
                      <span className="unheard">{l.text.slice(l.cutAt)}</span>
                    </>
                  ) : (
                    l.text
                  )}
                  {l.unverified && <span className="warn small"> (לא נבדק מול המקור, אין חיבור)</span>}
                  {l.cite && <CiteChip cite={l.cite} />}
                </p>
              ))}
            </div>
          ),
        )}
      </div>
    </details>
  );
}

function CiteChip({ cite }: { cite: string }) {
  return (
    <button
      className="cite"
      title={`הצג את המקור: ${cite}`}
      onClick={() => {
        useStudy.getState().set({ lastCitation: { ref: cite } });
        void engine.showWhere();
      }}
    >
      {cite}
    </button>
  );
}

export default function App() {
  const section = useStudy((s) => s.section);
  const illustration = useStudy((s) => s.illustration);
  const open = useStudy((s) => s.openCommentaries);
  const settings = useStudy((s) => s.settings);
  const progress = useStudy((s) => (s.section ? s.progress[s.section.ref] : undefined));
  const error = useStudy((s) => s.error);
  const turns = useStudy((s) => s.turns.length);
  const narrow = useNarrow();
  const [panel, setPanel] = useState<'settings' | 'library' | 'help' | null>(null);
  const [sideW, setSideW] = useState(320);
  const [comW, setComW] = useState(380);
  const [comHidden, setComHidden] = useState(false);
  const demo = brainMode() === 'demo';
  const comOpen = open.length > 0 && !comHidden;

  useEffect(() => {
    if (open.length) setComHidden(false);
  }, [open.length]);

  useEffect(() => {
    document.documentElement.dataset.contrast = settings.highContrast ? 'high' : '';
  }, [settings.highContrast]);

  const startConversation = () => {
    if (!IS_ARTIFACT && recognitionSupported() && settings.micMode === 'open') startMic();
    void engine.greet();
  };

  const sectionPart = section ? section.ref.slice(section.book.length).trim() : '';

  return (
    <div className={`app ${narrow ? 'narrow' : 'wide'}`}>
      <header className="topbar">
        <h1>
          <button className="home" onClick={() => (engine.cancel(), useStudy.getState().set({ section: null, illustration: null }))} aria-label="בחירת לימוד">
            החברותא שלי
          </button>
        </h1>
        {demo ? (
          <button className="badge demo" onClick={() => setPanel('settings')} title="בלי Claude: מצב הדגמה">
            מצב הדגמה
          </button>
        ) : (
          IS_ARTIFACT && <span className="badge">Claude בחשבון שלך</span>
        )}
        {section && (
          <nav className="source-nav" aria-label="ניווט במקור">
            <button className="icon-btn" onClick={() => engine.navigate(-1)} aria-label={section.kind === 'talmud' ? 'עמוד קודם' : 'הקודם'} title="הקודם">
              ‹
            </button>
            <span className="source-title">
              {section.heRef}
              {section.kind === 'talmud' && <small> · {amudLabel(sectionPart)}</small>}
            </span>
            <button className="icon-btn" onClick={() => engine.navigate(1)} aria-label={section.kind === 'talmud' ? 'עמוד הבא' : 'הבא'} title="הבא">
              ›
            </button>
            {progress && <span className={`status s-${progress.status}`}>{PROGRESS_LABEL[progress.status]}</span>}
            <button className="btn small" onClick={() => useStudy.getState().markProgress(section.ref, section.heRef, 'learned')} title="סימון ידני: למדתי והבנתי">
              ✓ למדתי
            </button>
          </nav>
        )}
        <div className="top-actions">
          {section && (
            <>
              <button className="btn small" onClick={() => engine.dispatch({ type: 'commentary', who: section.kind === 'mishnah' ? 'Bartenura' : 'Rashi', action: 'open' })}>
                {section.kind === 'mishnah' ? 'ברטנורא' : 'רש״י'}
              </button>
              {section.kind === 'talmud' && (
                <button className="btn small" onClick={() => engine.dispatch({ type: 'commentary', who: 'Tosafot', action: 'open' })}>
                  תוספות
                </button>
              )}
              <button className="btn small" onClick={() => engine.dispatch({ type: 'illustrate', variant: 'default', text: 'תעשה לי המחשה' })}>
                המחשה
              </button>
              <button className="btn small" onClick={() => engine.dispatch({ type: 'resume' })}>
                חזרה למקום
              </button>
              {open.length > 0 && comHidden && (
                <button className="btn small" onClick={() => setComHidden(false)}>
                  פירושים
                </button>
              )}
              <span className="font-ctl" role="group" aria-label="גודל כתב">
                <button className="icon-btn" aria-label="הקטן כתב" onClick={() => useStudy.getState().setSettings({ fontScale: Math.max(0.8, settings.fontScale - 0.1) })}>
                  א-
                </button>
                <button className="icon-btn" aria-label="הגדל כתב" onClick={() => useStudy.getState().setSettings({ fontScale: Math.min(2, settings.fontScale + 0.1) })}>
                  א+
                </button>
              </span>
            </>
          )}
          <button className="btn small" onClick={() => setPanel('library')}>
            מאגר והתקדמות
          </button>
          <button className="btn small" onClick={() => setPanel('settings')}>
            הגדרות
          </button>
          <button className="btn small" onClick={() => setPanel('help')}>
            עזרה
          </button>
        </div>
      </header>

      {error && (
        <div className="error-bar" role="alert">
          {error}
          <button className="icon-btn" aria-label="סגור" onClick={() => useStudy.getState().set({ error: null })}>
            ✕
          </button>
        </div>
      )}

      <main
        className="room"
        style={narrow ? undefined : { gridTemplateColumns: `minmax(320px, 1fr) ${comOpen ? `6px ${comW}px` : ''} 6px ${sideW}px` }}
      >
        {narrow && (
          <div className="side-col">
            <Avatar compact />
            <ClarifyBox />
            {turns === 0 && (
              <button className="btn primary" onClick={startConversation}>
                התחל שיחה
              </button>
            )}
          </div>
        )}
        <div className="main-col">
          {section ? <TextPane /> : <StartPanel />}
          {illustration && <IllustrationView il={illustration} onClose={() => useStudy.getState().set({ illustration: null })} />}
        </div>
        {comOpen && !narrow && (
          <>
            <Splitter value={comW} onChange={setComW} min={240} max={720} label="שינוי רוחב חלון הפירושים" />
            <CommentaryPane onClose={() => setComHidden(true)} />
          </>
        )}
        {/* On a phone the illustration temporarily takes the commentary sheet's place. */}
        {comOpen && narrow && !illustration && (
          <div className="sheet">
            <CommentaryPane onClose={() => setComHidden(true)} />
          </div>
        )}
        {!narrow && (
          <>
            <Splitter value={sideW} onChange={setSideW} min={220} max={560} label="שינוי רוחב חלון החברותא" />
            <div className="side-col">
              <Avatar />
              <ClarifyBox />
              {turns === 0 && (
                <button className="btn primary" onClick={startConversation}>
                  התחל שיחה
                </button>
              )}
              <Transcript />
            </div>
          </>
        )}
      </main>

      <footer className="bottombar">
        <Controls />
      </footer>

      {panel === 'settings' && (
        <Modal title="הגדרות" onClose={() => setPanel(null)}>
          <SettingsPanel />
        </Modal>
      )}
      {panel === 'library' && (
        <Modal title="מאגר והתקדמות" onClose={() => setPanel(null)}>
          <LibraryPanel />
        </Modal>
      )}
      {panel === 'help' && (
        <Modal title="עזרה והוראות שימוש" onClose={() => setPanel(null)}>
          <HelpPanel />
        </Modal>
      )}
    </div>
  );
}
