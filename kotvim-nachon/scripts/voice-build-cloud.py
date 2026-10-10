"""
Records every phrase of the app (voice/texts.json) with Google Cloud's neural Hebrew voice instead of
the built-in Phonikud voice. The Google voices may be used in an app that is sold (Phonikud is
non-commercial). Output is the same pack format as voice-build.py (public/voice/), so the app plays
it the same way.

  GOOGLE_TTS_API_KEY=... python scripts/voice-build-cloud.py
Optional: GOOGLE_TTS_VOICE (default he-IL-Wavenet-C). Uses only the Python standard library.
Clips are cached in voice/cache-cloud/, so re-running only records new phrases.
"""
import base64
import hashlib
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOICE = ROOT / "voice"
OUT = ROOT / "public" / "voice"
CACHE = VOICE / "cache-cloud"
PACK_BYTES = 6_000_000
KEY = os.environ.get("GOOGLE_TTS_API_KEY", "")
VOICE_NAME = os.environ.get("GOOGLE_TTS_VOICE", "he-IL-Wavenet-C")
URL = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={KEY}"


def synth(text: str, rate: float) -> bytes:
    key = hashlib.sha256(f"{VOICE_NAME}|{rate}|{text}".encode()).hexdigest()[:24]
    f = CACHE / f"{key}.mp3"
    if f.exists():
        return f.read_bytes()
    body = json.dumps({
        "input": {"text": text},
        "voice": {"languageCode": "he-IL", "name": VOICE_NAME},
        "audioConfig": {"audioEncoding": "MP3", "speakingRate": rate, "pitch": 1.5},
    }).encode()
    for attempt in range(5):
        try:
            req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = base64.b64decode(json.loads(r.read())["audioContent"])
            CACHE.mkdir(parents=True, exist_ok=True)
            f.write_bytes(data)
            return data
        except Exception as e:  # rate limits and network hiccups: wait and retry
            if attempt == 4:
                raise
            print(f"retry {text[:20]}: {e}", file=sys.stderr)
            time.sleep(2 ** attempt)
    raise RuntimeError("unreachable")


def main():
    if not KEY:
        sys.exit("GOOGLE_TTS_API_KEY is not set")
    items = json.loads((VOICE / "texts.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("v*.bin"):
        old.unlink()
    index, packs = {}, [bytearray()]
    for n, item in enumerate(items):
        # single words: our own vocalisation (nikud) so the voice reads them exactly
        text = item.get("nikud") or item["text"]
        entry = []
        for rate in [1.0, 0.75] if item.get("slow") else [1.0]:
            data = synth(text, rate)
            if len(packs[-1]) + len(data) > PACK_BYTES:
                packs.append(bytearray())
            entry.append([len(packs) - 1, len(packs[-1]), len(data)])
            packs[-1] += data
        for k in item["keys"]:
            index[k] = entry
        if n % 200 == 0:
            print(f"{n}/{len(items)}", file=sys.stderr)
    for i, p in enumerate(packs):
        (OUT / f"v{i}.bin").write_bytes(p)
    (OUT / "index.json").write_text(json.dumps({"packs": len(packs), "clips": index}, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(items)} texts, {len(packs)} packs, {sum(len(p) for p in packs) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
