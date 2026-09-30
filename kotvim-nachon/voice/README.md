# הקול הטבעי של האפליקציה

כל המשפטים והמילים באפליקציה מוקלטים מראש בקול עברי טבעי ונשמרים ב-`public/voice/`
(קבצי `v*.bin` ו-`index.json`). האפליקציה מנגנת אותם בלי אינטרנט.

## הקול
[Phonikud](https://github.com/thewh1teagle/phonikud) – מודל ניקוד (MIT) וקול Piper שאומן על הקלטות של דובר עברית.
**הרישיון של הקול: שימוש לא מסחרי בלבד.** לכן האפליקציה חייבת להישאר חינמית, בלי פרסומות ובלי רכישות,
כל עוד היא משתמשת בקול הזה.

## הקלטה מחדש (אחרי שינוי טקסטים)
```bash
python3 -m venv venv && venv/bin/pip install phonikud phonikud-onnx piper-onnx onnxruntime soundfile numpy
mkdir -p voice/models && cd voice/models
curl -LO https://huggingface.co/spaces/Phonikud/phonikud-tts/resolve/main/model.onnx
curl -LO https://huggingface.co/spaces/Phonikud/phonikud-tts/resolve/main/model.config.json
curl -LO https://huggingface.co/spaces/Phonikud/phonikud-tts/resolve/main/phonikud-1.0.int8.onnx
cd ../..
node --experimental-strip-types scripts/voice-texts.ts    # רשימת כל מה שצריך להקליט
venv/bin/python scripts/voice-build.py                    # הקלטה ואריזה (משפטים שכבר הוקלטו נשמרים ב-voice/cache)
```

## בדיקת הגייה
`scripts/voice-check.py` מעביר מדגם של הקלטות דרך מזהה דיבור עברי (ivrit-ai Whisper) ומשווה למה שהיה אמור להיאמר.
