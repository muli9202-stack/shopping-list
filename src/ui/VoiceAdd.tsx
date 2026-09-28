import { useRef, useState } from 'react';
import { useApp } from '../store';
import type { ChainId, Mode, Product } from '../types';
import { Sheet } from './dialog';

// "Milk, bread and eggs" → matching products are added to the list.

interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

const getRecognition = (): RecognitionCtor | undefined =>
  (window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition;

export const voiceSupported = () => !!getRecognition();

/** Finds catalog products named in free speech; returns them plus the leftover words. */
export function matchSpeech(text: string, products: Product[]): { matched: Product[]; unknown: string[] } {
  let rest = ` ${text.replace(/[.,،!?]/g, ' ')} `;
  const matched: Product[] = [];
  const byLength = [...products].sort((a, b) => b.name.length - a.name.length);
  for (const p of byLength) {
    // Hebrew glues "and"/"the" to the next word: "וחלב", "החלב".
    for (const prefix of ['', 'ו', 'ה', 'וה']) {
      const needle = ` ${prefix}${p.name} `;
      if (rest.includes(needle)) {
        matched.push(p);
        rest = rest.replace(needle, ' | ');
        break;
      }
    }
  }
  const unknown = rest
    .split('|')
    .map((chunk) => chunk.trim())
    .flatMap((chunk) => chunk.split(/\s+(?=ו)/))
    .map((w) => w.replace(/^ו(?=\S{2})/, '').trim())
    .filter((w) => w.length > 1 && !['גם', 'עוד', 'את', 'של', 'צריך', 'לקנות'].includes(w));
  return { matched, unknown };
}

export default function VoiceAdd({ chainId, mode }: { chainId: ChainId; mode: Mode }) {
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<{ text: string; matched: Product[]; unknown: string[] } | null>(null);
  const [error, setError] = useState('');
  const recRef = useRef<Recognition | null>(null);
  if (!voiceSupported()) return null;

  const start = () => {
    const Ctor = getRecognition()!;
    const rec = new Ctor();
    rec.lang = 'he-IL';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(' ');
      const products = useApp.getState().products.filter((p) => p.chainId === chainId);
      setResult({ text, ...matchSpeech(text, products) });
    };
    rec.onerror = (e) => setError(e.error === 'not-allowed' ? 'צריך לאשר גישה למיקרופון.' : 'לא שמעתי, נסה שוב.');
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setError('');
    setListening(true);
    rec.start();
  };

  return (
    <>
      <button className={`icon-btn ${listening ? 'listening' : ''}`} onClick={listening ? () => recRef.current?.stop() : start} aria-label="הוספה בקול">
        🎤
      </button>
      {(listening || error) && <div className="voice-toast">{error || 'מקשיב… אמור למשל: "חלב, לחם וביצים"'}</div>}
      {result && <VoiceResult chainId={chainId} mode={mode} result={result} onClose={() => setResult(null)} />}
    </>
  );
}

function VoiceResult({
  chainId,
  mode,
  result,
  onClose,
}: {
  chainId: ChainId;
  mode: Mode;
  result: { text: string; matched: Product[]; unknown: string[] };
  onClose: () => void;
}) {
  const [picked, setPicked] = useState(new Set(result.matched.map((p) => p.id)));
  const [addNew, setAddNew] = useState(new Set(result.unknown));
  const toggle = <T,>(set: Set<T>, v: T) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    return n;
  };
  return (
    <Sheet title="מה שמעתי" onClose={onClose}>
      <p className="muted">"{result.text}"</p>
      {result.matched.length > 0 && <h3 className="sheet-sub">מוצרים שזיהיתי</h3>}
      <div className="menu">
        {result.matched.map((p) => (
          <label key={p.id} className="check-line">
            <input type="checkbox" checked={picked.has(p.id)} onChange={() => setPicked(toggle(picked, p.id))} />
            {p.name}
          </label>
        ))}
      </div>
      {result.unknown.length > 0 && (
        <>
          <h3 className="sheet-sub">לא נמצאו ברשימה, להוסיף כמוצר חדש?</h3>
          <div className="menu">
            {result.unknown.map((w) => (
              <label key={w} className="check-line">
                <input type="checkbox" checked={addNew.has(w)} onChange={() => setAddNew(toggle(addNew, w))} />
                {w}
              </label>
            ))}
          </div>
        </>
      )}
      <button
        className="btn primary block big"
        disabled={!picked.size && !addNew.size}
        onClick={() => {
          const s = useApp.getState();
          if (addNew.size) {
            s.addProducts(chainId, [...addNew], null);
            const fresh = useApp.getState().products.filter((p) => p.chainId === chainId && !p.categoryId && addNew.has(p.name));
            fresh.forEach((p) => picked.add(p.id));
          }
          s.mergeIntoList(chainId, mode, [...picked].map((id) => ({ productId: id, qty: 1 })));
          onClose();
        }}
      >
        הוספה לרשימה ({picked.size + addNew.size})
      </button>
    </Sheet>
  );
}
