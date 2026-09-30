// Demos: security lab — sandboxed, defensive, CTF-style. Every attack runs ONLY on fake
// in-page data, and every sim shows the fix. Nothing here touches a real system.
(function () {
  "use strict";
  const D = window.MG_DEMOS || (window.MG_DEMOS = {});

  // 1. SQL injection against a FAKE login, with the fix
  D.sqlinject = d => {
    const { el, head } = MG;
    head(d, "מעבדה · CTF (מעבדה סגורה)", "הזרקת SQL: איך פורצים כניסה, ואיך חוסמים", "זו כניסה מזויפת לגמרי, שקיימת רק בדף הזה. נסה להיכנס בלי לדעת את הסיסמה: הקלד בשדה השם ' OR '1'='1 (עם הגרש). אחר כך הדלק ״שאילתה עם פרמטרים״ ונסה שוב, כדי לראות איך מתגוננים. ככה לומדים אבטחה: תוקפים מערכת תרגול כדי לדעת להגן על אמיתית.");
    const users = [{ u: "admin", p: "S3cr3t!" }, { u: "noa", p: "pizza42" }];
    const name = el("input", { type: "text", value: "' OR '1'='1", id: "sqli-u", "aria-label": "שם משתמש" });
    const pass = el("input", { type: "text", value: "", id: "sqli-p", "aria-label": "סיסמה", placeholder: "(השאר ריק)" });
    const q = el("div", { class: "out", style: "min-height:0" });
    const res = el("div", { style: "font-weight:700;margin-top:6px" });
    let safe = false;
    const safeBtn = el("button", { onclick: () => { safe = !safe; safeBtn.classList.toggle("on", safe); run(); } }, "שאילתה עם פרמטרים (התיקון)");
    const run = () => {
      const u = name.value, p = pass.value;
      if (safe) {
        q.textContent = `-- שאילתה מאובטחת: הקלט אף פעם לא הופך לקוד\nSELECT * FROM users WHERE user = ?  AND pass = ?\n-- הפרמטרים: [${JSON.stringify(u)}, ${JSON.stringify(p)}]`;
        const hit = users.find(x => x.u === u && x.p === p);
        res.textContent = hit ? "נכנסת (כי הסיסמה נכונה באמת)." : "✕ גישה נדחתה. ההזרקה לא עובדת: הקלט נבדק כטקסט, לא כקוד.";
        res.style.color = hit ? "#5fd08f" : "#ff7b7b";
      } else {
        const query = `SELECT * FROM users WHERE user = '${u}' AND pass = '${p}'`;
        q.textContent = "-- שאילתה פגיעה: הקלט מודבק ישר לתוך הקוד\n" + query;
        // simulate the injection on fake data (no real DB)
        const injected = /'\s*OR\s*'?1'?\s*=\s*'?1/i.test(u) || /'\s*OR\s*1\s*=\s*1/i.test(u) || /'--/.test(u);
        const legit = users.find(x => x.u === u && x.p === p);
        if (injected) { res.textContent = "🚨 נכנסת בלי סיסמה! ה-OR '1'='1' תמיד נכון, אז השרת חשב שכל השורות מתאימות."; res.style.color = "#ffb454"; }
        else if (legit) { res.textContent = "נכנסת (סיסמה נכונה)."; res.style.color = "#5fd08f"; }
        else { res.textContent = "✕ גישה נדחתה."; res.style.color = "#ff7b7b"; }
      }
    };
    [name, pass].forEach(i => i.addEventListener("input", run));
    d.append(el("div", { class: "row" }, el("span", {}, "שם:"), name, el("span", {}, "סיסמה:"), pass, el("button", { class: "primary", onclick: run }, "התחבר")),
      el("div", { class: "row", style: "margin-top:6px" }, safeBtn), q, res,
      el("div", { class: "note", style: "margin-top:8px" }, "מה קרה: הקוד הפגיע בונה את השאילתה בחיבור מחרוזות, אז הקלט שלך הפך לחלק מהפקודה. התיקון (״פרמטרים״) שולח את הקלט בנפרד, והוא תמיד נשאר טקסט. זה התיקון האמיתי שכל מסד נתונים תומך בו."));
    run();
  };

  // 2. XSS in a sandboxed shadow root, with escaping fix
  D.xss = d => {
    const { el, head } = MG;
    head(d, "מעבדה · CTF (מעבדה סגורה)", "XSS: כשקלט של משתמש הופך לקוד", "אתר ״ספר אורחים״ מזויף. כתוב תגובה, והיא תופיע בתיבה הלבנה. עכשיו נסה לכתוב תגובה שהיא בעצם קוד. בלי הגנה, הקוד ירוץ! הדלק ״בריחת תווים״ (escaping) כדי לראות את התיקון. הכול קורה בתוך תא סגור (shadow DOM) שלא יכול לגעת בשאר הדף.");
    const box = el("div", { class: "preview-host", style: "min-height:80px;padding:10px" });
    const root = box.attachShadow ? box.attachShadow({ mode: "open" }) : box;
    const ta = el("input", { type: "text", id: "xss-in", style: "flex:1;min-width:0", "aria-label": "תגובה", value: "<b>היי!</b> <span onclick=\"this.textContent='נלחצתי! זה היה יכול לגנוב את החשבון שלך'\" style=\"color:#c00;cursor:pointer\">[לחץ לפרס!]</span>" });
    const esc = s => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    let safe = false;
    const safeBtn = el("button", { onclick: () => { safe = !safe; safeBtn.classList.toggle("on", safe); render(); } }, "בריחת תווים (התיקון)");
    const render = () => {
      const val = ta.value;
      root.innerHTML = "";
      const wrap = document.createElement("div");
      wrap.style.cssText = "font-family:sans-serif;direction:rtl";
      wrap.innerHTML = "<b>תגובות:</b><br>" + (safe ? esc(val) : val.replace(/<script[\s\S]*?<\/script>/gi, "[script חסום ע\"י הדפדפן]"));
      root.append(wrap);
    };
    ta.addEventListener("input", render);
    d.append(el("div", { class: "row" }, ta), el("div", { class: "row", style: "margin-top:6px" }, safeBtn),
      el("div", { class: "note" }, "מה שמופיע לכל המבקרים:"), box,
      el("div", { class: "note", style: "margin-top:8px" }, "בלי הגנה, ה-HTML שכתבת הופך לחלק מהדף (נסה ללחוץ על ״[לחץ לפרס!]״). באתר אמיתי, קוד כזה יכול לגנוב עוגיות ולהשתלט על חשבונות. התיקון: להמיר < ל-&lt; וכו׳, כך שהקלט מוצג כטקסט ולא רץ כקוד. React ורוב הספריות עושות את זה אוטומטית."));
    render();
  };

  // 3. Phishing spotter game
  D.phish = d => {
    const { el, head, award } = MG;
    head(d, "מעבדה · זהה דיוג", "אמיתי או מזויף?", "בכל סבב מופיעים הודעה או אתר. החלט אם הם אמיתיים או ניסיון דיוג (phishing), ולמד את הסימנים. זו המיומנות שמגינה עליך יותר מכל אנטי-וירוס.");
    const items = [
      { fake: true, from: "support@netflx-billing.com", text: "החשבון שלך יינעל! עדכן אמצעי תשלום עכשיו: netflx-verify.com/login", why: "הדומיין כתוב לא נכון (netflx במקום netflix), והלחץ (״יינעל עכשיו!״) הוא סימן קלאסי." },
      { fake: false, from: "no-reply@accounts.google.com", text: "התחברות חדשה למכשיר Windows מחיפה. אם זה לא אתה, אבטח את החשבון.", why: "הדומיין הרשמי, אין קישור חשוד, וזו התראה סבירה. עדיין: היכנס דרך האתר ישירות, לא דרך הקישור." },
      { fake: true, from: "Steam Community", text: "חבר שלח לך מתנה! קבל 50$ ב-Steam: steamcommunlty.com/gift (חינם!)", why: "steamcommunlty (עם l במקום i) הוא זיוף מפורסם. ״חינם 50$״ = כמעט תמיד הונאה." },
      { fake: true, from: "המורה למתמטיקה", text: "היי, איבדתי את הטלפון. תעביר לי קוד האימות שאשלח לך לרגע?", why: "אף אחד אמיתי לא יבקש קוד אימות. זו הנדסה חברתית: מישהו מנסה להיכנס לחשבון שלך." },
      { fake: false, from: "GitHub", text: "מישהו פתח Pull Request בפרויקט שלך. צפה בשינויים בלוח הבקרה.", why: "הודעה תקינה. הדומיין רשמי, אין דחיפות מזויפת, אין בקשה למידע." },
      { fake: true, from: "Epic Games", text: "זכית ב-13,500 V-Bucks! הזן שם משתמש וסיסמה כדי לקבל: free-vbucks-now.net", why: "אתר חיצוני שמבקש סיסמה = דיוג. חברות אמיתיות לא מבקשות סיסמה באתר צד שלישי." },
      { fake: true, from: "בנק לאומי", text: "לקוח יקר, אמת את פרטי הכרטיס: 4580-____-____-____ בקישור המצורף.", why: "בנק לעולם לא מבקש פרטי כרטיס במייל או SMS. תמיד." },
      { fake: false, from: "Discord", text: "קוד האימות שלך הוא 481920. אל תשתף אותו עם אף אחד.", why: "קוד שאתה ביקשת בעצמך. הסימן שזה תקין: ההודעה עצמה אומרת לא לשתף." },
    ];
    let i = 0, score = 0, done = 0;
    const card = el("div", { class: "card-q", style: "text-align:right;align-items:stretch" });
    const stat = el("div", { class: "note" });
    const btns = el("div", { class: "row", style: "margin-top:8px" });
    const why = el("div", { class: "note", style: "min-height:36px" });
    const draw = () => {
      const it = items[i];
      card.innerHTML = ""; why.textContent = "";
      card.append(el("div", { style: "font-family:var(--font-mono);color:var(--screen-ink);font-size:14px" }, "מאת: " + it.from), el("div", { style: "font-size:16px;margin-top:6px" }, it.text));
      btns.innerHTML = "";
      const answer = f => {
        done++;
        const right = f === it.fake;
        if (right) { score++; award("phish:" + i, 5, "זיהוי דיוג"); }
        why.innerHTML = (right ? "<b style='color:#5fd08f'>נכון! </b>" : "<b style='color:#ff7b7b'>לא בדיוק. </b>") + it.why;
        stat.textContent = `ניקוד: ${score}/${done}`;
        btns.innerHTML = "";
        btns.append(el("button", { class: "primary", onclick: () => { i = (i + 1) % items.length; draw(); } }, "הבא ←"));
      };
      btns.append(el("button", { onclick: () => answer(false) }, "✓ אמיתי"), el("button", { onclick: () => answer(true) }, "🎣 דיוג"));
    };
    d.append(card, btns, why, stat);
    draw();
  };

  // 4. Brute force on a toy PIN, showing rate limiting
  D.bruteforce = d => {
    const { el, head, sleep } = MG;
    head(d, "מעבדה · CTF (מעבדה סגורה)", "מתקפת כוח גס, ולמה נעילה עוצרת אותה", "מנעול מזויף עם קוד בן 4 ספרות (10,000 אפשרויות). לחץ ״נסה הכול״ ותראה מחשב שובר אותו בכמה שניות. עכשיו הדלק ״נעילה אחרי 5 ניסיונות״ ותראה למה זה עוצר את התוקף. ככה מגינים על חשבונות אמיתיים.");
    const secret = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    const disp = el("div", { class: "big" }, "????");
    const info = el("div", { class: "note", style: "font-variant-numeric:tabular-nums" });
    let lock = false, busy = false;
    const lockBtn = el("button", { onclick: () => { lock = !lock; lockBtn.classList.toggle("on", lock); } }, "נעילה אחרי 5 ניסיונות");
    const run = async () => {
      if (busy) return; busy = true;
      let tries = 0, locked = 0;
      for (let n = 0; n < 10000; n++) {
        const guess = String(n).padStart(4, "0");
        tries++;
        disp.textContent = guess;
        if (lock && tries % 5 === 0 && guess !== secret) {
          locked++;
          info.textContent = `ניסיון ${tries}: 🔒 החשבון ננעל ל-30 שניות (ניסיון נעילה מספר ${locked}). תוקף אמיתי היה מחכה שעות על כל 5 ניסיונות.`;
          await sleep(400);
        }
        if (guess === secret) { disp.textContent = guess; info.textContent = lock ? `נשבר אחרי ${tries} ניסיונות — אבל עם נעילה זה היה לוקח לתוקף אמיתי ${(Math.ceil(tries / 5) * 0.5 / 60).toFixed(0)} דקות עד שעות, במקום שנייה.` : `💥 נשבר! הקוד הוא ${secret}, נמצא אחרי ${tries} ניסיונות, בפחות משנייה.`; break; }
        if (n % 200 === 0) { info.textContent = `בודק... ניסיון ${tries}`; await sleep(1); }
      }
      busy = false;
    };
    d.append(disp, el("div", { class: "row" }, el("button", { class: "primary", onclick: run }, "▶ נסה הכול (כוח גס)"), lockBtn, el("button", { onclick: () => { disp.textContent = "????"; info.textContent = ""; } }, "אפס")), info,
      el("div", { class: "note", style: "margin-top:8px" }, "לכן: (1) קודים ארוכים (6 ספרות = פי 100 אפשרויות), (2) נעילה או השהיה אחרי כמה ניסיונות, (3) אימות דו-שלבי. שלושתם ביחד הופכים כוח גס לחסר תועלת."));
  };

  // 5. Port scan concept on a fictional server
  D.portscan = d => {
    const { el, head, sleep } = MG;
    head(d, "מעבדה · CTF (מעבדה סגורה)", "סריקת פורטים: אילו ״דלתות״ פתוחות", "לכל שרת יש פורטים ממוספרים, כמו דלתות בבניין. תוקף ״דופק״ על כל דלת כדי לראות מה פתוח. זה שרת דמיוני. סרוק אותו, ואז כבה שירותים מיותרים והדלק חומת אש, כדי לראות איך מקטינים את ״שטח התקיפה״.");
    const ports = [
      { n: 22, name: "SSH", risk: "גישה מרחוק לשרת. אם הסיסמה חלשה, זו כניסה ישירה", open: true, needed: true },
      { n: 80, name: "HTTP", risk: "אתר לא מוצפן. עדיף להפנות ל-443", open: true, needed: false },
      { n: 443, name: "HTTPS", risk: "אתר מוצפן. זה בסדר וצריך להישאר פתוח", open: true, needed: true },
      { n: 3306, name: "MySQL", risk: "מסד נתונים! לא אמור להיות חשוף לאינטרנט בכלל", open: true, needed: false },
      { n: 21, name: "FTP", risk: "העברת קבצים ישנה ולא מוצפנת. סכנה", open: true, needed: false },
      { n: 8080, name: "Dev server", risk: "שרת פיתוח ששכחו לכבות. דליפת מידע", open: true, needed: false },
    ];
    let firewall = false;
    const fw = el("button", { onclick: () => { firewall = !firewall; fw.classList.toggle("on", firewall); draw(); } }, "חומת אש (חוסמת הכול חוץ מ-443)");
    const list = el("div");
    const info = el("div", { class: "note", style: "min-height:20px" });
    const isOpen = p => p.open && !(firewall && p.n !== 443);
    const draw = () => {
      list.innerHTML = "";
      ports.forEach(p => {
        const open = isOpen(p);
        list.append(el("div", { class: "bucket" }, el("b", { style: "width:60px" }, ":" + p.n), el("span", { class: open ? "" : "ok", style: open && !p.needed ? "background:#3a1616;color:#ffaaaa" : "" }, `${p.name} — ${open ? "פתוח" : "סגור"}`), el("span", { class: "note", style: "background:none;border:none" }, open ? p.risk : "")));
      });
      const risky = ports.filter(p => isOpen(p) && !p.needed).length;
      info.textContent = risky ? `${risky} פורטים פתוחים ומיותרים = שטח תקיפה גדול.` : "רק מה שצריך פתוח. שטח תקיפה מינימלי!";
    };
    const scan = async () => {
      info.textContent = "סורק...";
      list.innerHTML = "";
      for (const p of ports) { await sleep(180); draw(); }
    };
    d.append(el("div", { class: "row" }, el("button", { class: "primary", onclick: scan }, "▶ סרוק פורטים"), fw,
      ...ports.filter(p => !p.needed).slice(0, 3).map(p => el("button", { onclick: () => { p.open = false; draw(); } }, "כבה " + p.name))), list, info,
      el("div", { class: "note", style: "margin-top:8px" }, "עיקרון הזהב: ״הרשאות מינימום״. כל דלת פתוחה מיותרת היא הזדמנות לתוקף. סוגרים כל מה שלא בשימוש, ומגינים על השאר עם חומת אש וסיסמאות חזקות."));
    draw();
  };

  // 6. File permissions / least privilege
  D.perms = d => {
    const { el, head } = MG;
    head(d, "מעבדה · הרשאות", "מי מותר לו לעשות מה", "בכל מערכת יש הרשאות: מי יכול לקרוא, לכתוב או להריץ כל קובץ. לחץ על התאים כדי לשנות, ותראה מתי נוצרת סכנת אבטחה. זה בדיוק chmod בלינוקס.");
    const files = [
      { name: "index.html", who: "אתר ציבורי", perms: { r: true, w: false, x: false }, safe: p => p.r && !p.w },
      { name: "passwords.txt", who: "סודי", perms: { r: true, w: true, x: false }, safe: p => true, secret: true },
      { name: "game.sh", who: "סקריפט", perms: { r: true, w: false, x: true }, safe: p => true },
    ];
    const list = el("div");
    const warn = el("div", { class: "note", style: "min-height:20px" });
    const draw = () => {
      list.innerHTML = "";
      files.forEach(f => {
        const row = el("div", { class: "bucket" }, el("b", { style: "width:130px" }, f.name));
        [["r", "קריאה"], ["w", "כתיבה"], ["x", "הרצה"]].forEach(([k, label]) => {
          const on = f.perms[k];
          const b = el("button", { class: on ? "on" : "", style: "min-width:70px", onclick: () => { f.perms[k] = !f.perms[k]; check(); draw(); } }, label + (on ? " ✓" : " ✗"));
          row.append(b);
        });
        list.append(row);
      });
    };
    const check = () => {
      const msgs = [];
      const pw = files.find(f => f.secret);
      if (pw && pw.perms.r) msgs.push("🚨 קובץ הסודות ניתן לקריאה. במערכת אמיתית זו דליפה חמורה.");
      const site = files[0];
      if (site.perms.w) msgs.push("⚠️ אפשר לכתוב לאתר הציבורי. תוקף יכול לשנות אותו (Defacement).");
      if (site.perms.x) msgs.push("⚠️ האתר מסומן ״הרצה״ ללא צורך.");
      warn.textContent = msgs.length ? msgs.join(" ") : "✓ ההרשאות סבירות: כל קובץ מקבל רק את מה שהוא צריך.";
    };
    d.append(list, warn, el("div", { class: "note", style: "margin-top:8px" }, "עיקרון ״הרשאות מינימום״ (Least Privilege): תן לכל דבר בדיוק את מה שהוא צריך, לא יותר. הרוב המכריע של פריצות מנצל הרשאה עודפת שמישהו שכח לסגור."));
    draw(); check();
  };

  // 7. Public wifi sniffing: why HTTPS matters
  D.wifi = d => {
    const { el, head, sleep } = MG;
    head(d, "מעבדה · CTF (מעבדה סגורה)", "ריגול ב-Wi-Fi ציבורי: HTTP מול HTTPS", "אתה בבית קפה. מישהו ברשת ״מקשיב״ לתעבורה (דמיוני לגמרי). שלח סיסמה דרך אתר לא מוצפן (HTTP) ותראה מה התוקף רואה. אחר כך עבור ל-HTTPS ותראה את ההבדל.");
    const pass = el("input", { type: "text", value: "MyBankPass!99", id: "wifi-p", "aria-label": "סיסמה לדוגמה" });
    let https = false;
    const httpsBtn = el("button", { onclick: () => { https = !https; httpsBtn.classList.toggle("on", https); } }, "השתמש ב-HTTPS 🔒");
    const eye = el("div", { class: "out", style: "min-height:60px" });
    const send = async () => {
      const p = pass.value;
      eye.textContent = "התוקף מיירט חבילות...";
      await sleep(700);
      if (https) {
        const junk = [...p].map(() => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("") + Math.random().toString(16).slice(2, 10);
        eye.textContent = "מה שהתוקף רואה:\nPOST /login  [מוצפן TLS]\n" + junk + junk + "\n\n🔒 ג'יבריש. אי אפשר לקרוא את הסיסמה.";
        eye.style.color = "#8ff0b5";
      } else {
        eye.textContent = `מה שהתוקף רואה:\nPOST /login HTTP/1.1\nHost: mybank.example\nuser=noa&password=${p}\n\n🚨 הסיסמה שלך גלויה לחלוטין!`;
        eye.style.color = "#ff8b8b";
      }
    };
    d.append(el("div", { class: "row" }, el("span", {}, "סיסמה:"), pass, el("button", { class: "primary", onclick: send }, "שלח"), httpsBtn), eye,
      el("div", { class: "note", style: "margin-top:8px" }, "לכן: תמיד בדוק שיש מנעול (HTTPS) לפני שמקלידים סיסמה, במיוחד ב-Wi-Fi ציבורי. היום כמעט כל האתרים משתמשים ב-HTTPS, וזו בדיוק הסיבה. אל תזין פרטים רגישים באתר בלי מנעול."));
  };

  // 8. Session token / cookie concept
  D.cookie = d => {
    const { el, head } = MG;
    head(d, "מעבדה · עוגיות וטוקנים", "איך אתר ״זוכר״ שאתה מחובר", "HTTP הוא ״חסר זיכרון״: כל בקשה עומדת בפני עצמה. אז איך האתר יודע שכבר התחברת? הוא נותן לך טוקן סודי (עוגייה), ואתה שולח אותו בכל בקשה. לחץ להתחבר, ותראה איך זה עובד, ולמה גניבת טוקן מסוכנת.");
    let token = null;
    const server = el("div", { class: "out", style: "min-height:0" });
    const client = el("div", { class: "out", style: "min-height:0" });
    const log = el("div", { class: "note", style: "min-height:20px" });
    const rnd = () => "eyJ" + Math.random().toString(36).slice(2, 10) + "." + Math.random().toString(36).slice(2, 14);
    const draw = () => {
      client.textContent = token ? "העוגייה שלי (נשמרת בדפדפן):\nsession=" + token : "אין עוגייה. אני אנונימי.";
      server.textContent = token ? "השרת מזהה: הטוקן שייך ל-noa ✓" : "השרת: מי אתה? התחבר בבקשה.";
    };
    d.append(el("div", { class: "grid2" }, el("div", {}, el("b", {}, "🖥️ הדפדפן שלך"), client), el("div", {}, el("b", {}, "🏭 השרת"), server)),
      el("div", { class: "row", style: "margin-top:8px" },
        el("button", { class: "primary", onclick: () => { token = rnd(); log.textContent = "התחברת! השרת יצר טוקן ושלח לך אותו כעוגייה. מעכשיו כל בקשה נושאת אותו."; draw(); } }, "התחבר"),
        el("button", { onclick: () => { log.textContent = token ? "שלחת בקשה עם העוגייה. השרת מזהה אותך בלי סיסמה." : "השרת דחה אותך: אין טוקן."; draw(); } }, "בקש דף פרופיל"),
        el("button", { onclick: () => { if (token) { log.textContent = "🚨 תוקף גנב את הטוקן (למשל דרך XSS)! עכשיו הוא יכול להתחזות אליך בלי הסיסמה. לכן שומרים טוקנים כ-HttpOnly ומשתמשים ב-HTTPS."; } else log.textContent = "אין טוקן לגנוב."; } }, "😈 מה אם גונבים את הטוקן?"),
        el("button", { onclick: () => { token = null; log.textContent = "התנתקת. הטוקן נמחק."; draw(); } }, "התנתק")), log,
      el("div", { class: "note", style: "margin-top:8px" }, "טוקן = כמו צמיד כניסה למסיבה: מי שמחזיק בו נכנס. לכן מגינים עליו: HTTPS (שלא ייגנב בדרך), HttpOnly (ש-JavaScript לא יוכל לקרוא אותו), ותפוגה (שיתבטל אחרי זמן)."));
    draw();
  };
})();
