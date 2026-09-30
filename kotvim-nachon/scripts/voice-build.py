"""
Records every phrase of the app with a natural Hebrew voice and packs the clips for the app.

  node --experimental-strip-types scripts/voice-texts.ts   # 1. list what to record  → voice/texts.json
  python scripts/voice-build.py                              # 2. record + pack        → public/voice/

Voice: Phonikud (https://github.com/thewh1teagle/phonikud) – the nikud model adds vowels and
stress, and a Piper voice model reads the phonemes. The voice model is licensed for
NON-COMMERCIAL use only, so the app must stay free and without ads while it uses this voice.

Needs: pip install phonikud phonikud-onnx piper-onnx onnxruntime soundfile numpy
and the model files in voice/models/ (see voice/README.md).
"""
import hashlib
import io
import json
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from phonikud import phonemize
from phonikud_onnx import Phonikud
from piper_onnx import Piper

ROOT = Path(__file__).resolve().parent.parent
VOICE = ROOT / "voice"
MODELS = VOICE / "models"
CACHE = VOICE / "cache"
OUT = ROOT / "public" / "voice"
PACK_BYTES = 6_000_000
ENGINE = "phonikud-piper-v2"  # bump to re-record everything
SPEED = {"n": 1.12, "s": 1.6}  # length_scale: normal / slow (dictation)
# a single word alone is read a little slower, so short words stay clear
WORD_SPEED = {"n": 1.3, "s": 1.75}

# How letter names are pronounced when a text talks about single letters ("ט או ת")
LETTER_IPA = {
    "א": "ˈalef", "ב": "bˈet", "ג": "ɡˈimel", "ד": "dˈalet", "ה": "hˈe", "ו": "vˈav", "ז": "zˈajin",
    "ח": "χˈet", "ט": "tˈet", "י": "jˈud", "כ": "kˈaf", "ך": "kˈaf sofˈit", "ל": "lˈamed", "מ": "mˈem",
    "ם": "mˈem sofˈit", "נ": "nˈun", "ן": "nˈun sofˈit", "ס": "sˈameχ", "ע": "ˈajin", "פ": "pˈe",
    "ף": "pˈe sofˈit", "צ": "tsˈadi", "ץ": "tsˈadi sofˈit", "ק": "kˈuf", "ר": "ʁˈeʃ", "ש": "ʃˈin", "ת": "tˈav",
}
# Pronunciations the models get wrong (found with scripts/voice-check.py), in Phonikud IPA
PHONEME_FIX = {
    "כובע": "kˈovaʔ",
    "רחוב": "ʁeχˈov",
}
PREFIX_IPA = {"ו": "ve", "ה": "ha", "ב": "be", "ל": "le", "מ": "me", "ש": "ʃe", "כ": "ke"}
NIKUD = re.compile(r"[֑-ׇ]")
# a single letter standing alone, optionally after a prefix and hyphen: "ט", "ו-ת", "ה-ע", "שׂ"
LETTER_TOKEN = re.compile(r"(?<![א-ת])(?:([ובהלמשכ])-)?([א-ת])[ְ-ׇ]*(?![א-תְ-ׇ])")
VOWELS = set("aeiou")

nik = Phonikud(str(MODELS / "phonikud-1.0.int8.onnx"))
piper = Piper(str(MODELS / "model.onnx"), str(MODELS / "model.config.json"))


def vowel_positions(ph: str):
    return [i for i, c in enumerate(ph) if c in VOWELS]


def with_stress_from(given: str, auto: str) -> str:
    """Keep our vowels (given) but take the stress position from the model (auto)."""
    g = given.replace("ˈ", "")
    out = []
    for gw, aw in zip(g.split(" "), auto.split(" ")):
        if "ˈ" not in aw:
            out.append(gw)
            continue
        n = sum(1 for c in aw[: aw.index("ˈ")] if c in VOWELS)
        pos = vowel_positions(gw)
        if n < len(pos):
            i = pos[n]
            j = i
            # put the mark before the syllable's vowel (after its consonant onset)
            gw = gw[:j] + "ˈ" + gw[j:]
        out.append(gw)
    return " ".join(out)


def text_phonemes(text: str) -> str:
    """Phonemes for running text; single letters are read by their names."""
    parts, last = [], 0
    for m in LETTER_TOKEN.finditer(text):
        before = text[last : m.start()]
        if NIKUD.sub("", before).strip(" ,.!?:–-"):
            parts.append(phonemize(nik.add_diacritics(before)))
        pre = PREFIX_IPA.get(m.group(1) or "", "")
        parts.append((pre + LETTER_IPA[m.group(2)]).replace(pre + "ˈ", pre + "ˈ") if pre else LETTER_IPA[m.group(2)])
        punct = re.match(r"[ ,.!?:–]*", text[m.end() :]).group(0)
        if punct.strip():
            parts.append(punct.strip())
        last = m.end() + len(punct)
    rest = text[last:]
    if NIKUD.sub("", rest).strip(" ,.!?:–-"):
        parts.append(phonemize(nik.add_diacritics(rest)))
    return " ".join(p.strip() for p in parts if p.strip())


def item_phonemes(item) -> str:
    text = item["text"]
    if text in PHONEME_FIX:
        return PHONEME_FIX[text]
    if item.get("nikud"):
        # single word: the model reads the full spelling (good stress); our nikud fixes the vowels if they differ
        auto = phonemize(nik.add_diacritics(text))
        given = phonemize(item["nikud"])
        if auto.replace("ˈ", "") == given.replace("ˈ", ""):
            return auto
        if len(vowel_positions(auto.replace("ˈ", ""))) == len(vowel_positions(given.replace("ˈ", ""))):
            return with_stress_from(given, auto)
        return given
    return text_phonemes(text)


def trim(samples: np.ndarray, sr: int) -> np.ndarray:
    # gentle: soft first sounds (b, k, t) must not be cut off
    thr = 0.004
    idx = np.where(np.abs(samples) > thr)[0]
    if len(idx) == 0:
        return samples
    a = max(0, idx[0] - int(0.1 * sr))
    b = min(len(samples), idx[-1] + int(0.12 * sr))
    pad = np.zeros(int(0.05 * sr), dtype=samples.dtype)
    return np.concatenate([pad, samples[a:b], pad])


def record(ph: str, speed: str, word: bool = False) -> bytes:
    key = hashlib.sha256(f"{ENGINE}|{speed}|{word}|{ph}".encode()).hexdigest()[:24]
    f = CACHE / f"{key}.mp3"
    if f.exists():
        return f.read_bytes()
    scale = (WORD_SPEED if word else SPEED)[speed]
    # a word alone ends like a sentence (falling tone) so it sounds complete
    if word and not ph.rstrip().endswith((".", "!", "?")):
        ph = ph + "."
    samples, sr = piper.create(ph, is_phonemes=True, length_scale=scale, noise_scale=0.55, noise_w=0.8)
    samples = np.clip(samples * 2.0, -1, 1)
    samples = trim(samples, sr)
    buf = io.BytesIO()
    sf.write(buf, samples, sr, format="MP3", compression_level=0.75)
    data = buf.getvalue()
    CACHE.mkdir(parents=True, exist_ok=True)
    f.write_bytes(data)
    return data


def main():
    items = json.loads((VOICE / "texts.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("v*.bin"):
        old.unlink()
    index, packs = {}, [bytearray()]
    phon_log = {}
    for n, item in enumerate(items):
        ph = item_phonemes(item)
        phon_log[item["text"]] = ph
        entry = []
        for speed in ["n", "s"] if item.get("slow") else ["n"]:
            data = record(ph, speed, word=bool(item.get("nikud")) or " " not in item["text"].strip())
            if len(packs[-1]) + len(data) > PACK_BYTES:
                packs.append(bytearray())
            entry.append([len(packs) - 1, len(packs[-1]), len(data)])
            packs[-1] += data
        for k in item["keys"]:
            index[k] = entry
        if n % 100 == 0:
            print(f"{n}/{len(items)}", file=sys.stderr)
    for i, p in enumerate(packs):
        (OUT / f"v{i}.bin").write_bytes(p)
    (OUT / "index.json").write_text(json.dumps({"packs": len(packs), "clips": index}, ensure_ascii=False, separators=(",", ":")))
    (VOICE / "phonemes.json").write_text(json.dumps(phon_log, ensure_ascii=False, indent=0))
    total = sum(len(p) for p in packs)
    print(f"{len(items)} texts, {len(index)} keys, {len(packs)} packs, {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
