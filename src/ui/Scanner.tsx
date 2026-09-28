import { useEffect, useRef, useState } from 'react';

// Full-screen camera barcode scanner. Uses the browser's BarcodeDetector where
// available (Chrome on Android) and falls back to ZXing (loaded on demand) elsewhere.

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

export default function Scanner({ onCode, onClose, message }: { onCode: (code: string) => void; onClose: () => void; message?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const [error, setError] = useState('');

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    let zxingStop: (() => void) | null = null;
    let last = { code: '', at: 0 };

    const emit = (code: string) => {
      const now = Date.now();
      // The same barcode stays in view for a while; report it once.
      if (code === last.code && now - last.at < 2500) return;
      last = { code, at: now };
      navigator.vibrate?.(60);
      onCodeRef.current(code);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();

        if (window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] });
          const scan = async () => {
            if (stopped) return;
            try {
              const found = await detector.detect(video);
              if (found[0]) emit(found[0].rawValue);
            } catch {
              /* frame not ready yet */
            }
            timer = window.setTimeout(scan, 200);
          };
          scan();
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromStream(stream, video, (result) => result && emit(result.getText()));
          zxingStop = () => controls.stop();
        }
      } catch (e) {
        setError((e as Error).name === 'NotAllowedError' ? 'צריך לאשר גישה למצלמה כדי לסרוק.' : 'לא הצלחתי לפתוח את המצלמה.');
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      zxingStop?.();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="scanner">
      <video ref={videoRef} playsInline muted />
      <div className="scanner-frame" />
      <div className="scanner-top">
        <span>כוון את הברקוד למסגרת</span>
        <button className="icon-btn" onClick={onClose} aria-label="סגירה">
          ✕
        </button>
      </div>
      {(error || message) && <div className={`scanner-msg ${error ? 'err' : ''}`}>{error || message}</div>}
    </div>
  );
}
