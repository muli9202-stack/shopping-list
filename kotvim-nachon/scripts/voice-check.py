"""
Listening check for the recorded voice: a Hebrew speech recogniser (ivrit-ai Whisper) transcribes a
sample of clips, and we compare what it heard with the text. Clips it cannot understand are listed.

  python scripts/voice-check.py [sample_size] [--words | --sentences] [--asr path]
Needs: pip install faster-whisper, model ivrit-ai/whisper-large-v3-turbo-ct2 in voice/asr/
"""
import io
import json
import random
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np
import soundfile as sf
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "voice"
ASR = Path(sys.argv[sys.argv.index("--asr") + 1]) if "--asr" in sys.argv else ROOT / "voice" / "asr"

def norm(t: str) -> str:
    t = re.sub(r"[֑-ׇ]", "", t)
    t = re.sub(r"[^א-ת ]", " ", t)
    # spelling variants the recogniser may choose (full/defective spelling) should not count as errors
    t = t.replace("וו", "ו").replace("יי", "י")
    return re.sub(r"\s+", " ", t).strip()

def loose(t: str) -> str:
    return norm(t).replace("ו", "").replace("י", "").replace(" ", "")

def main():
    n = int(next((a for a in sys.argv[1:] if a.isdigit()), "80"))
    items = json.loads((ROOT / "voice" / "texts.json").read_text())
    index = json.loads((OUT / "index.json").read_text())
    packs = {}
    random.seed(7)
    words_mode = "--words" in sys.argv
    if "--sentences" in sys.argv:
        items = [i for i in items if not i.get("nikud") and len(i["text"].split()) >= 3]
    if words_mode:
        # single words are too short for a recogniser on their own – check them after a known phrase
        items = [i for i in items if i.get("nikud")]
    sample = random.sample(items, min(n, len(items)))
    model = WhisperModel(str(ASR), device="cpu", compute_type="int8")
    bad, scores = [], []
    for it in sample:
        def load(key):
            pk, off, ln = index["clips"][key][0]
            if pk not in packs:
                packs[pk] = (OUT / f"v{pk}.bin").read_bytes()
            return sf.read(io.BytesIO(packs[pk][off : off + ln]))
        audio, sr = load(it["keys"][0])
        expected = it["text"]
        if words_mode:
            lead, _ = load("כל הכבוד")
            audio = np.concatenate([lead, np.zeros(int(0.35 * sr)), audio])
            expected = "כל הכבוד " + expected
        if sr != 16000:
            # simple resample for the recogniser
            x = np.linspace(0, len(audio), int(len(audio) * 16000 / sr), endpoint=False)
            audio = np.interp(x, np.arange(len(audio)), audio).astype(np.float32)
        segs, _ = model.transcribe(audio.astype(np.float32), language="he", beam_size=5, without_timestamps=True)
        heard = " ".join(s.text for s in segs).strip()
        score = SequenceMatcher(None, loose(expected), loose(heard)).ratio()
        scores.append(score)
        if score < 0.8:
            bad.append((round(score, 2), it["text"], heard))
    print(f"checked {len(sample)} clips – average match {np.mean(scores):.2f}, below 0.8: {len(bad)}")
    for b in sorted(bad):
        print(b)

if __name__ == "__main__":
    main()
