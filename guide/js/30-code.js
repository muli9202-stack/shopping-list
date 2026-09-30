// Demos: coding challenges, algorithms & data structures, JS vs Python, math for games
(function () {
  "use strict";
  const D = window.MG_DEMOS || (window.MG_DEMOS = {});

  /* ---------------- Auto-graded challenges ---------------- */
  const CH = [
    ["sum", "קל", "חיבור", "כתוב פונקציה sum(a, b) שמחזירה את הסכום של שני מספרים.", [[[2, 3], 5], [[10, -4], 6], [[0, 0], 0]], "return a + b;"],
    ["isEven", "קל", "זוגי או אי-זוגי", "isEven(n) מחזירה true אם n זוגי, אחרת false.", [[[4], true], [[7], false], [[0], true], [[-2], true]], "השתמש בשארית: n % 2 === 0", "return n % 2 === 0;"],
    ["greet", "קל", "ברכה", "greet(name) מחזירה ״שלום NAME!״. למשל greet(\"דנה\") מחזירה \"שלום דנה!\"", [[["דנה"], "שלום דנה!"], [["CJ"], "שלום CJ!"]], "חבר מחרוזות עם +", "return \"שלום \" + name + \"!\";"],
    ["toF", "קל", "צלזיוס לפרנהייט", "toF(c) ממירה מעלות צלזיוס לפרנהייט: c × 9 / 5 + 32.", [[[0], 32], [[100], 212], [[-40], -40]], "", "return c * 9 / 5 + 32;"],
    ["max3", "קל", "הגדול מבין שלושה", "max3(a, b, c) מחזירה את המספר הגדול ביותר.", [[[1, 5, 3], 5], [[9, 2, 4], 9], [[-1, -5, -3], -1]], "אפשר להשתמש ב-if, או ב-Math.max", "return Math.max(a, b, c);"],
    ["damage", "קל", "נזק לשחקן", "damage(hp, hit) מחזירה כמה חיים נשארו אחרי פגיעה. החיים לא יורדים מתחת ל-0.", [[[100, 30], 70], [[20, 50], 0], [[5, 5], 0]], "Math.max(0, ...)", "return Math.max(0, hp - hit);"],
    ["clamp", "קל", "הגבלה לטווח", "clamp(v, min, max) מחזירה את v, אבל לא פחות מ-min ולא יותר מ-max. שימושי מאוד במשחקים!", [[[5, 0, 10], 5], [[-3, 0, 10], 0], [[99, 0, 10], 10]], "", "return Math.min(max, Math.max(min, v));"],
    ["lastItem", "קל", "הפריט האחרון", "lastItem(arr) מחזירה את הפריט האחרון במערך.", [[[[1, 2, 3]], 3], [[["a"]], "a"]], "arr.length - 1", "return arr[arr.length - 1];"],
    ["grade", "קל", "ציון לאות", "grade(score): 90 ומעלה \"A\", 80+ \"B\", 70+ \"C\", 60+ \"D\", אחרת \"F\".", [[[95], "A"], [[80], "B"], [[72], "C"], [[60], "D"], [[12], "F"]], "סדרה של if / else if", "if (score >= 90) return \"A\";\n  if (score >= 80) return \"B\";\n  if (score >= 70) return \"C\";\n  if (score >= 60) return \"D\";\n  return \"F\";"],
    ["sumTo", "קל", "סכום עד n", "sumTo(n) מחזירה 1 + 2 + ... + n.", [[[3], 6], [[10], 55], [[1], 1]], "לולאת for שמוסיפה למשתנה total", "let t = 0;\n  for (let i = 1; i <= n; i++) t += i;\n  return t;"],
    ["countDown", "קל", "ספירה לאחור", "countDown(n) מחזירה מערך מ-n עד 1. למשל countDown(3) → [3, 2, 1].", [[[3], [3, 2, 1]], [[1], [1]], [[5], [5, 4, 3, 2, 1]]], "צור מערך ריק והוסף עם push בלולאה", "const r = [];\n  for (let i = n; i >= 1; i--) r.push(i);\n  return r;"],
    ["arraySum", "קל", "סכום מערך", "arraySum(arr) מחזירה את סכום כל המספרים במערך.", [[[[1, 2, 3]], 6], [[[]], 0], [[[10, -10, 5]], 5]], "for (const x of arr)", "let s = 0;\n  for (const x of arr) s += x;\n  return s;"],
    ["factorial", "בינוני", "עצרת", "factorial(n) מחזירה n! = 1 × 2 × ... × n. (0! = 1)", [[[0], 1], [[5], 120], [[10], 3628800]], "", "let r = 1;\n  for (let i = 2; i <= n; i++) r *= i;\n  return r;"],
    ["fizzBuzz", "בינוני", "FizzBuzz", "fizzBuzz(n) מחזירה \"FizzBuzz\" אם n מתחלק ב-3 וב-5, \"Fizz\" אם רק ב-3, \"Buzz\" אם רק ב-5, אחרת את n כמחרוזת.", [[[3], "Fizz"], [[10], "Buzz"], [[15], "FizzBuzz"], [[7], "7"]], "בדוק קודם את המקרה של שניהם!", "if (n % 15 === 0) return \"FizzBuzz\";\n  if (n % 3 === 0) return \"Fizz\";\n  if (n % 5 === 0) return \"Buzz\";\n  return String(n);"],
    ["reverseString", "בינוני", "הפוך מחרוזת", "reverseString(s) מחזירה את המחרוזת הפוכה. \"abc\" → \"cba\".", [[["abc"], "cba"], [["GTA"], "ATG"], [[""], ""]], "split, reverse, join", "return s.split(\"\").reverse().join(\"\");"],
    ["isPalindrome", "בינוני", "פלינדרום", "isPalindrome(s) מחזירה true אם המחרוזת זהה מימין ומשמאל (למשל \"abba\", \"racecar\").", [[["racecar"], true], [["abba"], true], [["game"], false]], "השווה את המחרוזת להיפוך שלה", "return s === s.split(\"\").reverse().join(\"\");"],
    ["countVowels", "בינוני", "ספירת תנועות", "countVowels(s) סופרת כמה אותיות a, e, i, o, u יש במחרוזת (אותיות קטנות).", [[["hello"], 2], [["gta"], 1], [["rhythm"], 0]], "\"aeiou\".includes(ch)", "let c = 0;\n  for (const ch of s) if (\"aeiou\".includes(ch)) c++;\n  return c;"],
    ["average", "בינוני", "ממוצע", "average(arr) מחזירה את הממוצע של המספרים במערך.", [[[[2, 4, 6]], 4], [[[10]], 10], [[[1, 2]], 1.5]], "סכום חלקי כמות", "return arr.reduce((a, b) => a + b, 0) / arr.length;"],
    ["findMax", "בינוני", "המקסימום בלי Math.max", "findMax(arr) מחזירה את המספר הגדול במערך, בלי להשתמש ב-Math.max.", [[[[3, 9, 2]], 9], [[[-5, -1, -9]], -1]], "התחל מ-arr[0] ועבור על השאר", "let m = arr[0];\n  for (const x of arr) if (x > m) m = x;\n  return m;"],
    ["onlyEven", "בינוני", "רק הזוגיים", "onlyEven(arr) מחזירה מערך חדש עם המספרים הזוגיים בלבד.", [[[[1, 2, 3, 4]], [2, 4]], [[[1, 3]], []]], "arr.filter", "return arr.filter(x => x % 2 === 0);"],
    ["doubleAll", "בינוני", "הכפל הכול", "doubleAll(arr) מחזירה מערך חדש שבו כל מספר מוכפל ב-2.", [[[[1, 2, 3]], [2, 4, 6]], [[[]], []]], "arr.map", "return arr.map(x => x * 2);"],
    ["countOf", "בינוני", "כמה פעמים", "countOf(arr, x) מחזירה כמה פעמים x מופיע במערך.", [[[[1, 2, 1, 1], 1], 3], [[["a", "b"], "c"], 0]], "", "return arr.filter(v => v === x).length;"],
    ["capitalize", "בינוני", "אות גדולה", "capitalize(s) מחזירה את המחרוזת עם האות הראשונה גדולה: \"hello\" → \"Hello\".", [[["hello"], "Hello"], [["gta"], "Gta"]], "s[0].toUpperCase() + s.slice(1)", "return s[0].toUpperCase() + s.slice(1);"],
    ["wordCount", "בינוני", "ספירת מילים", "wordCount(sentence) מחזירה כמה מילים יש במשפט (מופרדות ברווח אחד).", [[["אני אוהב לתכנת"], 3], [["hello"], 1]], "split(\" \")", "return sentence.split(\" \").length;"],
    ["distance", "בינוני", "מרחק בין נקודות", "distance(x1, y1, x2, y2) מחזירה את המרחק בין שתי נקודות (פיתגורס).", [[[0, 0, 3, 4], 5], [[1, 1, 1, 1], 0], [[0, 0, 6, 8], 10]], "Math.sqrt(dx*dx + dy*dy) או Math.hypot", "return Math.hypot(x2 - x1, y2 - y1);"],
    ["isColliding", "בינוני", "התנגשות עיגולים", "isColliding(a, b) מקבלת שני אובייקטים {x, y, r} ומחזירה true אם העיגולים נוגעים (המרחק קטן מסכום הרדיוסים).", [[[{ x: 0, y: 0, r: 5 }, { x: 8, y: 0, r: 5 }], true], [[{ x: 0, y: 0, r: 1 }, { x: 10, y: 10, r: 1 }], false]], "זה בדיוק מה שהמשחק הדו-ממדי במדריך עושה", "return Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r;"],
    ["wanted", "בינוני", "רמת חיפוש", "wanted(crimes) מחזירה כמה כוכבי משטרה: כוכב על כל 2 פשעים, מעוגל למטה, ולא יותר מ-5.", [[[0], 0], [[3], 1], [[7], 3], [[40], 5]], "Math.floor ו-Math.min", "return Math.min(5, Math.floor(crimes / 2));"],
    ["inventoryTotal", "בינוני", "שווי המלאי", "inventoryTotal(items) מקבלת מערך של {price, qty} ומחזירה את השווי הכולל.", [[[[{ price: 10, qty: 2 }, { price: 5, qty: 1 }]], 25], [[[]], 0]], "", "return items.reduce((s, it) => s + it.price * it.qty, 0);"],
    ["isPrime", "קשה", "מספר ראשוני", "isPrime(n) מחזירה true אם n ראשוני (מתחלק רק ב-1 ובעצמו). 1 אינו ראשוני.", [[[2], true], [[15], false], [[17], true], [[1], false], [[97], true]], "מספיק לבדוק מחלקים עד השורש של n", "if (n < 2) return false;\n  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;\n  return true;"],
    ["fib", "קשה", "פיבונאצ׳י", "fib(n) מחזירה את המספר ה-n בסדרת פיבונאצ׳י: fib(0)=0, fib(1)=1, וכל מספר הוא סכום שני הקודמים.", [[[0], 0], [[1], 1], [[10], 55], [[20], 6765]], "לולאה עם שני משתנים a, b", "let a = 0, b = 1;\n  for (let i = 0; i < n; i++) [a, b] = [b, a + b];\n  return a;"],
    ["unique", "קשה", "הסרת כפילויות", "unique(arr) מחזירה מערך בלי כפילויות, בסדר ההופעה הראשונה.", [[[[1, 2, 2, 3, 1]], [1, 2, 3]], [[["a", "a"]], ["a"]]], "new Set", "return [...new Set(arr)];"],
    ["gcd", "קשה", "מחלק משותף מקסימלי", "gcd(a, b) מחזירה את המחלק המשותף הגדול ביותר (אלגוריתם אוקלידס).", [[[12, 18], 6], [[7, 5], 1], [[100, 75], 25]], "gcd(a, b) = gcd(b, a % b), ועוצרים כש-b הוא 0", "while (b) [a, b] = [b, a % b];\n  return a;"],
    ["toBinary", "קשה", "לבינארי", "toBinary(n) מחזירה את n כמחרוזת בינארית, בלי toString(2)! למשל toBinary(5) → \"101\".", [[[5], "101"], [[8], "1000"], [[0], "0"], [[255], "11111111"]], "חלק ב-2 שוב ושוב ואסוף שאריות", "if (n === 0) return \"0\";\n  let s = \"\";\n  while (n > 0) { s = (n % 2) + s; n = Math.floor(n / 2); }\n  return s;"],
    ["binarySearch", "קשה", "חיפוש בינארי", "binarySearch(arr, target) מקבלת מערך ממוין ומחזירה את המיקום של target, או -1 אם אינו קיים.", [[[[1, 3, 5, 7, 9], 7], 3], [[[1, 3, 5], 4], -1], [[[2], 2], 0]], "lo, hi, mid = Math.floor((lo+hi)/2)", "let lo = 0, hi = arr.length - 1;\n  while (lo <= hi) {\n    const mid = Math.floor((lo + hi) / 2);\n    if (arr[mid] === target) return mid;\n    if (arr[mid] < target) lo = mid + 1; else hi = mid - 1;\n  }\n  return -1;"],
    ["caesar", "קשה", "צופן קיסר", "caesar(s, k) מזיזה כל אות אנגלית קטנה k מקומות קדימה (z חוזרת ל-a). תווים אחרים נשארים.", [[["abc", 1], "bcd"], [["xyz", 3], "abc"], [["hi there", 2], "jk vjgtg"]], "charCodeAt ו-String.fromCharCode, עם % 26", "return s.replace(/[a-z]/g, c => String.fromCharCode((c.charCodeAt(0) - 97 + k) % 26 + 97));"],
    ["isAnagram", "קשה", "אנגרמה", "isAnagram(a, b) מחזירה true אם אפשר לסדר את האותיות של a כדי לקבל את b (\"listen\", \"silent\").", [[["listen", "silent"], true], [["abc", "abd"], false]], "מיין את האותיות של שתיהן והשווה", "const f = s => s.split(\"\").sort().join(\"\");\n  return f(a) === f(b);"],
    ["mostFrequent", "קשה", "הכי נפוץ", "mostFrequent(arr) מחזירה את הערך שמופיע הכי הרבה פעמים.", [[[[1, 3, 3, 2, 3]], 3], [[["a", "b", "b"]], "b"]], "אובייקט או Map לספירה", "const m = new Map();\n  let best = arr[0];\n  for (const x of arr) { m.set(x, (m.get(x) || 0) + 1); if (m.get(x) > m.get(best)) best = x; }\n  return best;"],
    ["chunk", "קשה", "חלוקה לקבוצות", "chunk(arr, size) מחלקת מערך לקבוצות בגודל size. chunk([1,2,3,4,5], 2) → [[1,2],[3,4],[5]].", [[[[1, 2, 3, 4, 5], 2], [[1, 2], [3, 4], [5]]], [[[1, 2, 3], 3], [[1, 2, 3]]]], "slice בלולאה שקופצת size", "const r = [];\n  for (let i = 0; i < arr.length; i += size) r.push(arr.slice(i, i + size));\n  return r;"],
    ["flatten", "קשה", "שיטוח", "flatten(arr) מקבלת מערך של מערכים ומחזירה מערך אחד. [[1,2],[3]] → [1,2,3].", [[[[[1, 2], [3]]], [1, 2, 3]], [[[[], ["a"]]], ["a"]]], "concat או ...spread", "return [].concat(...arr);"],
    ["gridPath", "קשה", "צעדים ברשת", "steps(x1, y1, x2, y2) מחזירה כמה צעדים (למעלה/למטה/ימינה/שמאלה, בלי אלכסון) צריך בין שתי משבצות. זה ״מרחק מנהטן״ שמשמש את A*.", [[[0, 0, 3, 4], 7], [[5, 5, 2, 1], 7], [[1, 1, 1, 1], 0]], "Math.abs לכל ציר", "return Math.abs(x2 - x1) + Math.abs(y2 - y1);"],
  ].map(([fn, lvl, title, desc, tests, hint, sol]) => ({ fn: fn === "gridPath" ? "steps" : fn, lvl, title, desc, tests, hint: sol === undefined ? "" : hint, sol: sol === undefined ? hint : sol }));
  // (for entries written with 6 fields the 6th is the solution)
  window.MG_CHALLENGES = CH;

  D.challenges = d => {
    const { el, head, store, award } = MG;
    head(d, "זירת האתגרים · בדיקה אוטומטית", `${CH.length} אתגרי קוד`, "בחר אתגר, כתוב את הפונקציה, ולחץ ״בדוק״. המחשב יריץ בדיקות (tests) על הקוד שלך, בדיוק כמו בחברות תוכנה אמיתיות. כל אתגר שפתרת = 30 XP.");
    let solved = new Set(store.get("solved", []));
    let cur = CH.findIndex(c => !solved.has(c.fn)); if (cur < 0) cur = 0;
    const list = el("div", { class: "ch-list" });
    const title = el("h4", { style: "margin:4px 0" });
    const desc = el("p", { style: "color:var(--screen-fg)" });
    const ta = el("textarea", { rows: "9", spellcheck: "false", id: "ch-code", "aria-label": "הפתרון שלך" });
    const res = el("div");
    const logs = el("div", { class: "out", style: "min-height:0" });
    const hint = el("details", {}, el("summary", {}, "רמז"), el("div", { class: "hint-body" }));
    const sol = el("details", {}, el("summary", {}, "הצג פתרון (נסה קודם לבד!)"), el("pre", {}, el("code")));
    const drafts = store.get("drafts", {});
    const starter = c => `function ${c.fn}(${sig(c)}) {\n  // הקוד שלך כאן\n  \n}`;
    const sig = c => ({ sum: "a, b", isEven: "n", greet: "name", toF: "c", max3: "a, b, c", damage: "hp, hit", clamp: "v, min, max", lastItem: "arr", grade: "score", sumTo: "n", countDown: "n", arraySum: "arr", factorial: "n", fizzBuzz: "n", reverseString: "s", isPalindrome: "s", countVowels: "s", average: "arr", findMax: "arr", onlyEven: "arr", doubleAll: "arr", countOf: "arr, x", capitalize: "s", wordCount: "sentence", distance: "x1, y1, x2, y2", isColliding: "a, b", wanted: "crimes", inventoryTotal: "items", isPrime: "n", fib: "n", unique: "arr", gcd: "a, b", toBinary: "n", binarySearch: "arr, target", caesar: "s, k", isAnagram: "a, b", mostFrequent: "arr", chunk: "arr, size", flatten: "arr", steps: "x1, y1, x2, y2" })[c.fn] || "";
    const drawList = () => {
      list.innerHTML = "";
      CH.forEach((c, i) => list.append(el("button", { class: (solved.has(c.fn) ? "solved " : "") + (i === cur ? "cur" : ""), title: c.title, onclick: () => { save(); cur = i; load(); } }, (solved.has(c.fn) ? "✓ " : "") + (i + 1))));
    };
    const save = () => { drafts[CH[cur].fn] = ta.value; store.set("drafts", drafts); };
    const load = () => {
      const c = CH[cur];
      title.textContent = `${cur + 1}. ${c.title} · ${c.lvl}${solved.has(c.fn) ? " · ✓ נפתר" : ""}`;
      desc.textContent = c.desc;
      ta.value = drafts[c.fn] || starter(c);
      $h(".hint-body").textContent = c.hint || "אין רמז לאתגר הזה. נסה לפרק את הבעיה לצעדים.";
      hint.open = false; sol.open = false;
      sol.querySelector("code").textContent = `function ${c.fn}(${sig(c)}) {\n  ${c.sol}\n}`;
      res.innerHTML = ""; logs.textContent = "";
      drawList();
    };
    const $h = s => hint.querySelector(s);
    let worker = null;
    const run = () => {
      const c = CH[cur]; save();
      if (worker) worker.terminate();
      res.innerHTML = ""; logs.textContent = "";
      const src = `const __f=v=>typeof v==="string"?v:(()=>{try{return JSON.stringify(v)}catch(e){return String(v)}})();
console.log=(...a)=>postMessage({t:"log",s:a.map(__f).join(" ")});
try{\n${ta.value}\n;
const __fn = typeof ${c.fn} === "function" ? ${c.fn} : null;
if(!__fn){postMessage({t:"err",s:"לא מצאתי פונקציה בשם ${c.fn}"})}
else{const T=${JSON.stringify(c.tests)};postMessage({t:"res",r:T.map(([a,e])=>{try{const g=__fn(...JSON.parse(JSON.stringify(a)));return{ok:JSON.stringify(g)===JSON.stringify(e),a,e,g:g===undefined?"undefined":g}}catch(err){return{ok:false,a,e,g:"שגיאה: "+err.message}}})})}
}catch(e){postMessage({t:"err",s:e.name+": "+e.message})}`;
      let url;
      try { url = URL.createObjectURL(new Blob([src], { type: "text/javascript" })); worker = new Worker(url); } catch (e) { res.textContent = "הדפדפן לא מרשה להריץ קוד כאן."; return; }
      const timer = setTimeout(() => { worker.terminate(); res.append(el("div", { class: "test-row bad" }, "עצרתי אחרי 3 שניות. לולאה אינסופית?")); }, 3000);
      worker.onmessage = m => {
        if (m.data.t === "log") { logs.textContent += m.data.s + "\n"; return; }
        clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url);
        if (m.data.t === "err") { res.append(el("div", { class: "test-row bad" }, m.data.s)); return; }
        const r = m.data.r, pass = r.filter(x => x.ok).length;
        r.forEach(x => res.append(el("div", { class: "test-row " + (x.ok ? "ok" : "bad") }, `${x.ok ? "✓" : "✕"} ${c.fn}(${x.a.map(v => JSON.stringify(v)).join(", ")}) → ${JSON.stringify(x.g)}${x.ok ? "" : "   (ציפיתי ל-" + JSON.stringify(x.e) + ")"}`)));
        res.prepend(el("div", { style: `font-weight:700;margin-bottom:6px;color:${pass === r.length ? "#5fd08f" : "#ffb454"}` }, pass === r.length ? `כל ${r.length} הבדיקות עברו! 🎉` : `${pass} מתוך ${r.length} בדיקות עברו. המשך לנסות!`));
        if (pass === r.length) { solved.add(c.fn); store.set("solved", [...solved]); award("challenge:" + c.fn, 30, "פתרת אתגר"); title.textContent = `${cur + 1}. ${c.title} · ${c.lvl} · ✓ נפתר`; drawList(); }
      };
      worker.onerror = e => { e.preventDefault(); clearTimeout(timer); res.append(el("div", { class: "test-row bad" }, "שגיאת תחביר: " + (e.message || ""))); worker.terminate(); };
    };
    ta.addEventListener("keydown", e => {
      if (e.key === "Tab") { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText("  ", s, ta.selectionEnd, "end"); }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) run();
    });
    ta.addEventListener("change", save);
    d.append(el("div", { class: "note" }, "ירוק = פתרת. קל → בינוני → קשה:"), list, title, desc, ta,
      el("div", { class: "row", style: "margin-top:8px" }, el("button", { class: "primary", onclick: run }, "▶ בדוק את הפתרון"),
        el("button", { onclick: () => { ta.value = starter(CH[cur]); save(); } }, "התחל מחדש"),
        el("button", { onclick: () => { save(); cur = (cur + 1) % CH.length; load(); } }, "לאתגר הבא ←")),
      res, logs, hint, sol);
    load();
  };

  /* ---------------- Big O chart ---------------- */
  D.bigo = d => {
    const { el, head } = MG;
    head(d, "מעבדה · סיבוכיות", "כמה צעדים לוקח אלגוריתם כשהקלט גדל", "הזז את n (כמות הנתונים) ותראה כמה מהר כל סוג אלגוריתם ״מתפוצץ״. בגלל זה חשוב לבחור אלגוריתם טוב.");
    const W = 440, H = 240;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "גרף" });
    const ctx = cv.getContext("2d");
    const nS = el("input", { type: "range", min: "2", max: "60", value: "20", id: "bo-n", "aria-label": "n" });
    const tbl = el("div", { class: "table-wrap" });
    const F = [["O(1)", "גישה למערך לפי מקום", n => 1, "#5fd08f"], ["O(log n)", "חיפוש בינארי", n => Math.log2(n), "#7fb0ff"], ["O(n)", "מעבר על רשימה", n => n, "#ffd84a"], ["O(n log n)", "מיון מהיר", n => n * Math.log2(n), "#ffb454"], ["O(n²)", "מיון בועות", n => n * n, "#ff6b6b"], ["O(2ⁿ)", "לנסות כל צירוף", n => 2 ** n, "#e27bff"]];
    const draw = () => {
      const N = +nS.value, maxY = N * N * 1.1;
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      F.forEach(([, , f, c]) => {
        ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.beginPath();
        for (let n = 1; n <= N; n += N / 100) { const x = 10 + (n / N) * (W - 20), y = H - 10 - Math.min(1.2, f(n) / maxY) * (H - 20); n === 1 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
      });
      tbl.innerHTML = "";
      tbl.append(el("table", {}, el("tr", {}, el("th", {}, "סוג"), el("th", {}, "דוגמה"), el("th", {}, `צעדים כש-n = ${N}`)),
        ...F.map(([o, ex, f, c]) => el("tr", {}, el("td", { style: `color:${c};direction:ltr;font-family:var(--font-mono)` }, o), el("td", {}, ex), el("td", { class: "ltr", style: "font-family:var(--font-mono)" }, Math.round(f(N)).toLocaleString("en"))))));
    };
    nS.oninput = draw;
    d.append(cv, el("label", { style: "margin-top:8px" }, "n (כמות הנתונים)", nS), tbl);
    draw();
  };

  /* ---------------- Binary search visual + guessing game ---------------- */
  D.binsearch = d => {
    const { el, head, sleep } = MG;
    head(d, "מעבדה · חיפוש בינארי", "מציאת מספר ברשימה ממוינת", "למעלה: חיפוש רגיל (אחד-אחד) מול חיפוש בינארי (תמיד לחצות לשניים). למטה: חשוב על מספר בין 1 ל-1000, והמחשב ינחש אותו תוך 10 ניסיונות לכל היותר.");
    const N = 64;
    const arr = Array.from({ length: N }, (_, i) => i * 3 + 2);
    const mk = () => { const w = el("div", { class: "sort-bars", style: "height:70px" }); arr.forEach(v => w.append(el("i", { style: `height:${20 + v / (N * 3) * 80}%` }))); return w; };
    const lin = mk(), bin = mk();
    const tgt = el("select", { id: "bs-t", "aria-label": "מספר לחיפוש" }, ...arr.filter((_, i) => i % 5 === 0).map(v => el("option", { value: v }, v)));
    tgt.value = String(arr[45]);
    const info = el("div", { class: "note", style: "font-variant-numeric:tabular-nums" });
    let busy = false;
    const go = async () => {
      if (busy) return; busy = true;
      const t = +tgt.value;
      [...lin.children, ...bin.children].forEach(b => b.className = "");
      let a = 0, lo = 0, hi = N - 1, bs = 0, doneL = false, doneB = false;
      while (!doneL || !doneB) {
        if (!doneL && a >= N) doneL = true;
        if (!doneB && lo > hi) doneB = true;
        if (!doneL) { lin.children[a].className = "cmp"; if (arr[a] === t) { lin.children[a].className = "ok"; doneL = true; } else a++; }
        if (!doneB) {
          const mid = (lo + hi) >> 1; bs++;
          [...bin.children].forEach((b, i) => { if (i < lo || i > hi) b.style.opacity = .2; });
          bin.children[mid].className = "cmp";
          if (arr[mid] === t) { bin.children[mid].className = "ok"; doneB = true; } else if (arr[mid] < t) lo = mid + 1; else hi = mid - 1;
        }
        info.textContent = `חיפוש רגיל: ${a + (doneL ? 1 : 0)} בדיקות   ·   חיפוש בינארי: ${bs} בדיקות`;
        await sleep(doneB ? 40 : 420);
      }
      [...bin.children].forEach(b => b.style.opacity = 1);
      busy = false;
    };
    // guessing game
    let lo2 = 1, hi2 = 1000, guess = 500, tries = 1;
    const g = el("div", { class: "big" });
    const gi = el("div", { class: "note" });
    const upd = () => { g.textContent = guess; gi.textContent = `ניסיון ${tries}. הטווח שנשאר: ${lo2}–${hi2}`; };
    const next = () => { guess = Math.floor((lo2 + hi2) / 2); tries++; if (lo2 > hi2) { g.textContent = "?"; gi.textContent = "רגע, משהו לא מסתדר. אולי התבלבלת?"; return; } upd(); };
    d.append(el("div", { class: "row" }, el("span", {}, "חפש את:"), tgt, el("button", { class: "primary", onclick: go }, "▶ חפש")),
      el("div", { class: "note" }, "חיפוש רגיל:"), lin, el("div", { class: "note", style: "margin-top:6px" }, "חיפוש בינארי:"), bin, info,
      el("h4", { style: "margin-top:16px" }, "המחשב מנחש את המספר שלך (1–1000)"), el("div", { class: "row" }, el("span", {}, "האם המספר שלך הוא:"), g),
      el("div", { class: "row" },
        el("button", { onclick: () => { hi2 = guess - 1; next(); } }, "המספר שלי קטן יותר"),
        el("button", { onclick: () => { lo2 = guess + 1; next(); } }, "המספר שלי גדול יותר"),
        el("button", { class: "primary", onclick: () => { gi.textContent = `ניחשתי ב-${tries} ניסיונות! (ל-1000 מספרים צריך לכל היותר 10, כי 2 בחזקת 10 = 1024)`; } }, "נכון!"),
        el("button", { onclick: () => { lo2 = 1; hi2 = 1000; guess = 500; tries = 1; upd(); } }, "משחק חדש")), gi);
    upd();
  };

  /* ---------------- Stack & Queue ---------------- */
  D.stackqueue = d => {
    const { el, head } = MG;
    head(d, "מעבדה · מחסנית ותור", "שני מבני נתונים שכל מתכנת צריך", "מחסנית (Stack) היא כמו ערימת צלחות: מה שנכנס אחרון יוצא ראשון (LIFO). כך עובד כפתור ״ביטול״ (Ctrl+Z). תור (Queue) הוא כמו תור בקופה: מי שנכנס ראשון יוצא ראשון (FIFO). כך עובדים תור הדפסות ותור של שחקנים שמחכים למשחק.");
    let st = ["צייר קו", "צבע אדום"], q = ["שחקן 1", "שחקן 2"], n = 3;
    const acts = ["כתב מילה", "מחק שורה", "הזיז תמונה", "שינה גודל", "הוסיף צבע", "צייר עיגול"];
    const sBox = el("div", { style: "display:flex;flex-direction:column-reverse;gap:4px;min-height:190px;justify-content:flex-start;background:#05080c;border-radius:8px;padding:8px" });
    const qBox = el("div", { class: "boxes", style: "background:#05080c;border-radius:8px;padding:8px;direction:rtl" });
    const sMsg = el("div", { class: "note" }), qMsg = el("div", { class: "note" });
    const draw = () => {
      sBox.innerHTML = ""; st.forEach((x, i) => sBox.append(el("div", { style: `background:${i === st.length - 1 ? "var(--screen-accent)" : "var(--screen-ink)"};color:#06101f;border-radius:6px;padding:6px 10px;font-weight:700;text-align:center` }, x)));
      qBox.innerHTML = ""; q.forEach((x, i) => qBox.append(el("span", { style: i === 0 ? "background:var(--screen-accent)" : "" }, x)));
    };
    d.append(el("div", { class: "grid2" },
      el("div", {}, el("b", {}, "מחסנית: היסטוריית פעולות"), sBox,
        el("div", { class: "row", style: "margin-top:6px" }, el("button", { onclick: () => { const a = acts[st.length % acts.length]; st.push(a); sMsg.textContent = `push("${a}"): נכנס למעלה.`; draw(); } }, "push (פעולה חדשה)"),
          el("button", { class: "primary", onclick: () => { const x = st.pop(); sMsg.textContent = x ? `pop(): ביטלתי את "${x}", הפעולה האחרונה.` : "המחסנית ריקה!"; draw(); } }, "pop (בטל ⟲)")), sMsg),
      el("div", {}, el("b", {}, "תור: שחקנים שמחכים למשחק"), qBox,
        el("div", { class: "row", style: "margin-top:6px" }, el("button", { onclick: () => { const x = "שחקן " + n++; q.push(x); qMsg.textContent = `enqueue: "${x}" נכנס לסוף התור.`; draw(); } }, "enqueue (הצטרף)"),
          el("button", { class: "primary", onclick: () => { const x = q.shift(); qMsg.textContent = x ? `dequeue: "${x}" נכנס למשחק (הוא חיכה הכי הרבה).` : "התור ריק!"; draw(); } }, "dequeue (הבא בתור)")), qMsg)));
    draw();
  };

  /* ---------------- Hash map ---------------- */
  D.hashmap = d => {
    const { el, head } = MG;
    head(d, "מעבדה · טבלת גיבוב (Hash Map)", "איך מוצאים דבר מתוך מיליון בצעד אחד", "במקום לחפש ברשימה אחד-אחד, פונקציית גיבוב הופכת את המפתח (למשל שם) למספר תא. ככה עובדים אובייקטים ו-Map ב-JavaScript, ומסדי נתונים. כששני מפתחות נופלים לאותו תא, זו ״התנגשות״, ושומרים שרשרת.");
    const B = 8;
    const buckets = Array.from({ length: B }, () => []);
    const key = el("input", { type: "text", value: "Franklin", id: "hm-k", "aria-label": "מפתח" });
    const val = el("input", { type: "text", value: "$3,200", id: "hm-v", "aria-label": "ערך", style: "width:110px" });
    const calc = el("div", { class: "note ltr" });
    const view = el("div");
    const msg = el("div", { class: "note" });
    const h = s => { let t = 0; for (const c of s) t += c.codePointAt(0); return t; };
    let last = null;
    const draw = () => {
      const k = key.value, sum = h(k);
      calc.textContent = `hash("${k}") = sum of char codes = ${sum}  →  ${sum} % ${B} = ${sum % B}`;
      view.innerHTML = "";
      buckets.forEach((b, i) => view.append(el("div", { class: "bucket" }, el("b", {}, "[" + i + "]"), ...(b.length ? b.map(([kk, vv]) => el("span", { class: kk === last ? "new" : "" }, `${kk}: ${vv}`)) : [el("span", { style: "opacity:.3" }, "ריק")]))));
    };
    [["Michael", "$9,000"], ["Trevor", "$1,500"], ["Lamar", "$40"]].forEach(([k, v]) => buckets[h(k) % B].push([k, v]));
    key.addEventListener("input", draw);
    d.append(el("div", { class: "row" }, el("span", {}, "מפתח:"), key, el("span", {}, "ערך:"), val,
      el("button", { class: "primary", onclick: () => { const b = buckets[h(key.value) % B]; const ex = b.find(x => x[0] === key.value); if (ex) ex[1] = val.value; else b.push([key.value, val.value]); last = key.value; msg.textContent = b.length > 1 ? `נכנס לתא ${h(key.value) % B}, שכבר היה בו משהו: התנגשות! נשמר בשרשרת.` : `נכנס ישר לתא ${h(key.value) % B}.`; draw(); } }, "הכנס (set)"),
      el("button", { onclick: () => { const b = buckets[h(key.value) % B]; const ex = b.find(x => x[0] === key.value); last = ex ? key.value : null; msg.textContent = ex ? `get("${key.value}"): הלכתי ישר לתא ${h(key.value) % B} ומצאתי ${ex[1]}. בלי לחפש בכל השאר!` : `get("${key.value}"): התא ${h(key.value) % B} לא מכיל את המפתח הזה.`; draw(); } }, "חפש (get)")),
      calc, view, msg);
    draw();
  };

  /* ---------------- Tower of Hanoi (recursion) ---------------- */
  D.hanoi = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · רקורסיה", "מגדלי האנוי: פונקציה שקוראת לעצמה", "המטרה: להעביר את כל הדיסקים מהעמוד השמאלי לימני. אסור לשים דיסק גדול על קטן. הפתרון הרקורסיבי: כדי להזיז n דיסקים, הזז n−1 לעמוד העזר, הזז את הגדול, ואז הזז את n−1 מעליו. מימין רואים את ״מחסנית הקריאות״: אילו פונקציות מחכות עכשיו.");
    const W = 440, H = 200;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "מגדלי האנוי" });
    const ctx = cv.getContext("2d");
    const nS = el("input", { type: "range", min: "2", max: "8", value: "4", id: "hn-n", "aria-label": "דיסקים" });
    const nL = el("b", {}, "4");
    const stackEl = el("div", { class: "out", style: "min-height:120px" });
    const info = el("div", { class: "note" });
    let pegs, moves, i, timer = null, frames;
    const names = ["A", "B", "C"];
    const plan = n => {
      moves = []; frames = [];
      const stack = [];
      const rec = (k, from, to, via) => {
        stack.push(`hanoi(${k}, ${names[from]} → ${names[to]})`);
        if (k === 1) { moves.push([from, to, [...stack]]); }
        else { rec(k - 1, from, via, to); moves.push([from, to, [...stack]]); rec(k - 1, via, to, from); }
        stack.pop();
      };
      rec(n, 0, 2, 1);
    };
    const reset = () => { clearInterval(timer); timer = null; const n = +nS.value; pegs = [Array.from({ length: n }, (_, k) => n - k), [], []]; plan(n); i = 0; draw([]); info.textContent = `צריך ${2 ** n - 1} מהלכים (2 בחזקת ${n}, פחות 1).`; };
    const draw = stack => {
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      const n = +nS.value;
      pegs.forEach((p, k) => {
        const x = 80 + k * 140;
        ctx.fillStyle = "#3a4659"; ctx.fillRect(x - 3, 40, 6, 150); ctx.fillRect(x - 60, 188, 120, 6);
        ctx.fillStyle = "#7d8fa6"; ctx.font = "13px monospace"; ctx.textAlign = "center"; ctx.fillText(names[k], x, 30);
        p.forEach((s, j) => { const w = 20 + s / n * 95; ctx.fillStyle = `hsl(${s * 40},75%,60%)`; ctx.fillRect(x - w / 2, 172 - j * 18, w, 15); });
      });
      stackEl.textContent = stack.length ? stack.map((s, k) => "  ".repeat(k) + s).join("\n") : "(המחסנית ריקה)";
    };
    const step = () => {
      if (i >= moves.length) { clearInterval(timer); timer = null; info.textContent = `סיימתי ב-${moves.length} מהלכים!`; return; }
      const [f, t, stack] = moves[i++];
      pegs[t].push(pegs[f].pop());
      draw(stack);
      info.textContent = `מהלך ${i} מתוך ${moves.length}: דיסק מ-${names[f]} ל-${names[t]}`;
    };
    nS.oninput = () => { nL.textContent = nS.value; reset(); };
    d.append(el("div", { class: "grid2" }, cv, el("div", {}, el("div", { class: "note" }, "מחסנית הקריאות (Call Stack):"), stackEl)),
      el("div", { class: "row", style: "margin-top:8px" }, el("button", { class: "primary", onclick: () => { if (timer) { clearInterval(timer); timer = null; } else timer = setInterval(() => visible(d) && step(), 380); } }, "▶ פתור / עצור"),
        el("button", { onclick: step }, "מהלך אחד"), el("button", { onclick: reset }, "התחל מחדש"), el("label", { style: "flex:1;min-width:140px" }, el("span", {}, "דיסקים: ", nL), nS)), info,
      el("pre", {}, el("code", {}, `function hanoi(n, from, to, via) {
  if (n === 1) { move(from, to); return; }   // מקרה בסיס: עוצר את הרקורסיה
  hanoi(n - 1, from, via, to);               // הזז את כל הקטנים הצידה
  move(from, to);                            // הזז את הגדול
  hanoi(n - 1, via, to, from);               // החזר את הקטנים מעליו
}`)));
    reset();
  };

  /* ---------------- Maze: generation + BFS / DFS ---------------- */
  D.maze = d => {
    const { el, head, sleep } = MG;
    head(d, "מעבדה · גרפים ומבוכים", "יצירת מבוך ופתרון ב-BFS מול DFS", "המחשב בונה מבוך אקראי (באלגוריתם חזרה-לאחור), ואז פותר אותו בשתי דרכים. BFS (חיפוש לרוחב) מתפשט כמו גל מים לכל הכיוונים, ותמיד מוצא את הדרך הקצרה ביותר. DFS (חיפוש לעומק) הולך עד הסוף בכיוון אחד ורק אז חוזר.");
    const C = 25, R = 17;
    const grid = el("div", { class: "path-grid", style: `grid-template-columns:repeat(${C},1fr);max-width:520px` });
    const cells = [];
    for (let k = 0; k < C * R; k++) { const c = el("div"); cells.push(c); grid.append(c); }
    const info = el("div", { class: "note", style: "font-variant-numeric:tabular-nums" });
    let wall, busy = false;
    const idx = (x, y) => y * C + x;
    const gen = async (animate) => {
      wall = Array(C * R).fill(true);
      const stack = [[1, 1]]; wall[idx(1, 1)] = false;
      let n = 0;
      while (stack.length) {
        const [x, y] = stack[stack.length - 1];
        const nb = [[2, 0], [-2, 0], [0, 2], [0, -2]].map(([dx, dy]) => [x + dx, y + dy, dx, dy]).filter(([nx, ny]) => nx > 0 && ny > 0 && nx < C - 1 && ny < R - 1 && wall[idx(nx, ny)]);
        if (!nb.length) { stack.pop(); continue; }
        const [nx, ny, dx, dy] = nb[(Math.random() * nb.length) | 0];
        wall[idx(x + dx / 2, y + dy / 2)] = false; wall[idx(nx, ny)] = false;
        stack.push([nx, ny]);
        if (animate && ++n % 4 === 0) { paint(); await sleep(8); }
      }
      paint();
    };
    const paint = (vis = new Set(), path = new Set()) => cells.forEach((c, k) => {
      c.className = k === idx(1, 1) ? "s" : k === idx(C - 2, R - 2) ? "g" : wall[k] ? "w" : path.has(k) ? "p" : vis.has(k) ? "v" : "";
    });
    const solve = async mode => {
      if (busy) return; busy = true;
      const start = idx(1, 1), goal = idx(C - 2, R - 2);
      const frontier = [start], came = new Map([[start, -1]]), vis = new Set();
      let found = false;
      while (frontier.length) {
        const cur = mode === "bfs" ? frontier.shift() : frontier.pop();
        vis.add(cur);
        if (cur === goal) { found = true; break; }
        const x = cur % C, y = (cur / C) | 0;
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
          const n = idx(x + dx, y + dy);
          if (!wall[n] && !came.has(n)) { came.set(n, cur); frontier.push(n); }
        }
        paint(vis); await sleep(10);
      }
      const path = new Set(); if (found) { let k = goal; while (k !== -1) { path.add(k); k = came.get(k); } }
      paint(vis, path);
      info.textContent = `${mode.toUpperCase()}: בדק ${vis.size} משבצות, אורך המסלול ${path.size - 1}.`;
      busy = false;
    };
    d.append(grid, el("div", { class: "row" }, el("button", { onclick: () => !busy && gen(true) }, "מבוך חדש"),
      el("button", { class: "primary", onclick: () => solve("bfs") }, "פתור ב-BFS"), el("button", { class: "primary", onclick: () => solve("dfs") }, "פתור ב-DFS")), info);
    gen(false);
  };

  /* ---------------- JavaScript vs Python ---------------- */
  D.jspy = d => {
    const { el, head } = MG;
    head(d, "מעבדה · מתרגם", "אותו רעיון, שתי שפות", "בחר נושא וראה את הקוד ב-JavaScript ובפייתון זה לצד זה. שים לב: הרעיונות זהים, רק התחביר שונה. בפייתון אין סוגריים מסולסלים: ההזחה (רווחים בתחילת השורה) קובעת מה בתוך מה.");
    const T = {
      "הדפסה": ["console.log(\"שלום עולם\");", "print(\"שלום עולם\")"],
      "משתנים": ["let score = 0;\nconst name = \"CJ\";\nscore = score + 10;", "score = 0\nname = \"CJ\"\nscore = score + 10"],
      "תנאים": ["if (hp <= 0) {\n  console.log(\"מת\");\n} else if (hp < 30) {\n  console.log(\"זהירות\");\n} else {\n  console.log(\"בסדר\");\n}", "if hp <= 0:\n    print(\"מת\")\nelif hp < 30:\n    print(\"זהירות\")\nelse:\n    print(\"בסדר\")"],
      "לולאות": ["for (let i = 0; i < 5; i++) {\n  console.log(i);\n}\n\nwhile (fuel > 0) {\n  fuel -= 10;\n}", "for i in range(5):\n    print(i)\n\nwhile fuel > 0:\n    fuel -= 10"],
      "פונקציות": ["function heal(hp, amount) {\n  return Math.min(100, hp + amount);\n}\n\nconst double = n => n * 2;", "def heal(hp, amount):\n    return min(100, hp + amount)\n\ndouble = lambda n: n * 2"],
      "רשימות": ["const cars = [\"Banshee\", \"Infernus\"];\ncars.push(\"Faggio\");\nconsole.log(cars.length);\nconst fast = cars.filter(c => c.length > 6);", "cars = [\"Banshee\", \"Infernus\"]\ncars.append(\"Faggio\")\nprint(len(cars))\nfast = [c for c in cars if len(c) > 6]"],
      "מילונים/אובייקטים": ["const player = { name: \"CJ\", money: 350 };\nplayer.money += 100;\nconsole.log(player.name);", "player = {\"name\": \"CJ\", \"money\": 350}\nplayer[\"money\"] += 100\nprint(player[\"name\"])"],
      "מחלקות": ["class Car {\n  constructor(model) {\n    this.model = model;\n    this.speed = 0;\n  }\n  honk() {\n    console.log(this.model + \": טוט!\");\n  }\n}\nconst c = new Car(\"Banshee\");\nc.honk();", "class Car:\n    def __init__(self, model):\n        self.model = model\n        self.speed = 0\n\n    def honk(self):\n        print(self.model + \": טוט!\")\n\nc = Car(\"Banshee\")\nc.honk()"],
      "שגיאות": ["try {\n  riskyThing();\n} catch (err) {\n  console.log(\"נכשל:\", err.message);\n}", "try:\n    risky_thing()\nexcept Exception as err:\n    print(\"נכשל:\", err)"],
    };
    const sel = el("div", { class: "row" });
    const js = el("pre", {}, el("code")), py = el("pre", {}, el("code"));
    const show = k => { js.firstChild.textContent = T[k][0]; py.firstChild.textContent = T[k][1]; [...sel.children].forEach(b => b.classList.toggle("on", b.textContent === k)); };
    Object.keys(T).forEach(k => sel.append(el("button", { onclick: () => show(k) }, k)));
    d.append(sel, el("div", { class: "grid2" }, el("div", {}, el("b", {}, "JavaScript"), js), el("div", {}, el("b", {}, "Python"), py)));
    show("תנאים");
  };

  /* ---------------- helpers for draggable canvases ---------------- */
  function draggable(cv, pts, onMove, radius = 16) {
    let drag = -1;
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * cv.width, (e.clientY - r.top) / r.height * cv.height]; };
    cv.style.touchAction = "none";
    cv.addEventListener("pointerdown", e => {
      const [x, y] = pos(e);
      let best = -1, bd = radius * radius * (cv.width / cv.getBoundingClientRect().width) ** 2;
      pts().forEach((p, i) => { const dd = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (dd < bd) { bd = dd; best = i; } });
      drag = best; if (drag >= 0) cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener("pointermove", e => { if (drag < 0) return; onMove(drag, pos(e)); });
    cv.addEventListener("pointerup", () => { drag = -1; });
  }
  window.MG_draggable = draggable;
  const arrow = (ctx, x1, y1, x2, y2, c, w = 3) => {
    ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 12 * Math.cos(a - .4), y2 - 12 * Math.sin(a - .4)); ctx.lineTo(x2 - 12 * Math.cos(a + .4), y2 - 12 * Math.sin(a + .4)); ctx.fill();
    ctx.lineWidth = 1;
  };

  /* ---------------- Vectors ---------------- */
  D.vectors = d => {
    const { el, head } = MG;
    head(d, "מעבדה · וקטורים", "החיצים שמזיזים כל משחק", "גרור את קצוות החיצים. a (כתום) יכול להיות הכיוון שהשחקן מסתכל אליו, ו-b (כחול) הכיוון לאויב. המכפלה הסקלרית (dot product) אומרת אם האויב מלפניך (חיובי) או מאחוריך (שלילי). ככה שומרים במשחקים ״רואים״.");
    const W = 440, H = 300, O = [W / 2, H / 2], U = 40;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "וקטורים" });
    const ctx = cv.getContext("2d");
    const out = el("div", { class: "out", style: "min-height:0" });
    let a = [3, -1], b = [1, 2.5];
    const toPx = v => [O[0] + v[0] * U, O[1] - v[1] * U];
    const draw = () => {
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#141d2a";
      for (let x = O[0] % U; x < W; x += U) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = O[1] % U; y < H; y += U) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.strokeStyle = "#2b3a50"; ctx.beginPath(); ctx.moveTo(0, O[1]); ctx.lineTo(W, O[1]); ctx.moveTo(O[0], 0); ctx.lineTo(O[0], H); ctx.stroke();
      const s = [a[0] + b[0], a[1] + b[1]];
      ctx.setLineDash([4, 4]); ctx.strokeStyle = "#3d5a45"; ctx.beginPath(); ctx.moveTo(...toPx(a)); ctx.lineTo(...toPx(s)); ctx.lineTo(...toPx(b)); ctx.stroke(); ctx.setLineDash([]);
      arrow(ctx, ...O, ...toPx(s), "#5fd08f", 2);
      arrow(ctx, ...O, ...toPx(a), "#ffb454");
      arrow(ctx, ...O, ...toPx(b), "#7fb0ff");
      ctx.font = "bold 14px monospace"; ctx.fillStyle = "#ffb454"; ctx.fillText("a", ...toPx(a).map((v, i) => v + (i ? -8 : 8)));
      ctx.fillStyle = "#7fb0ff"; ctx.fillText("b", ...toPx(b).map((v, i) => v + (i ? -8 : 8)));
      ctx.fillStyle = "#5fd08f"; ctx.fillText("a+b", ...toPx(s).map((v, i) => v + (i ? -8 : 8)));
      const la = Math.hypot(...a), lb = Math.hypot(...b), dot = a[0] * b[0] + a[1] * b[1];
      const ang = Math.acos(Math.max(-1, Math.min(1, dot / (la * lb || 1)))) * 180 / Math.PI;
      out.textContent = `a = (${a.map(v => v.toFixed(1)).join(", ")})   |a| = ${la.toFixed(2)}
b = (${b.map(v => v.toFixed(1)).join(", ")})   |b| = ${lb.toFixed(2)}
a + b = (${s.map(v => v.toFixed(1)).join(", ")})
normalize(a) = (${(a[0] / la).toFixed(2)}, ${(a[1] / la).toFixed(2)})   ← כיוון בלבד, באורך 1
dot(a, b) = ${dot.toFixed(2)}   זווית = ${ang.toFixed(0)}°   →   ${dot > 0 ? "האויב מלפנים (השומר רואה אותך!)" : dot < 0 ? "האויב מאחור" : "בדיוק בצד"}`;
    };
    draggable(cv, () => [toPx(a), toPx(b)], (i, [x, y]) => { const v = [Math.round((x - O[0]) / U * 2) / 2, Math.round((O[1] - y) / U * 2) / 2]; if (i === 0) a = v; else b = v; draw(); });
    d.append(cv, out);
    draw();
  };

  /* ---------------- Trig: unit circle ---------------- */
  D.trig = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · סינוס וקוסינוס", "המעגל שמזיז הכול", "נקודה מסתובבת על מעגל. הקוסינוס (cos) הוא המרחק שלה ימינה-שמאלה, והסינוס (sin) הוא הגובה שלה. כשמשרטטים את הסינוס לאורך זמן מקבלים גל. משתמשים בזה לסיבובים, לתנועה מעגלית, לגלים במים ולנדנוד של כלי נשק בהליכה.");
    const W = 460, H = 220, R = 80, C = [110, 110];
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "מעגל" });
    const ctx = cv.getContext("2d");
    const sp = el("input", { type: "range", min: "0", max: "4", step: "0.1", value: "1.2", id: "tr-s", "aria-label": "מהירות" });
    const out = el("div", { class: "note ltr", style: "font-variant-numeric:tabular-nums" });
    let t = 0, wave = [], last = 0;
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
      if (!visible(d)) return;
      t += dt * +sp.value;
      const x = Math.cos(t), y = Math.sin(t);
      wave.unshift(y); if (wave.length > 240) wave.pop();
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#2b3a50"; ctx.beginPath(); ctx.arc(...C, R, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(C[0] - R - 10, C[1]); ctx.lineTo(W, C[1]); ctx.moveTo(C[0], C[1] - R - 10); ctx.lineTo(C[0], C[1] + R + 10); ctx.stroke();
      const P = [C[0] + x * R, C[1] - y * R];
      ctx.strokeStyle = "#ffb454"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(...C); ctx.lineTo(C[0] + x * R, C[1]); ctx.stroke();
      ctx.strokeStyle = "#7fb0ff"; ctx.beginPath(); ctx.moveTo(C[0] + x * R, C[1]); ctx.lineTo(...P); ctx.stroke(); ctx.lineWidth = 1;
      ctx.strokeStyle = "#d9e6f2"; ctx.beginPath(); ctx.moveTo(...C); ctx.lineTo(...P); ctx.stroke();
      ctx.strokeStyle = "rgba(127,176,255,.35)"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(...P); ctx.lineTo(220, P[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = "#7fb0ff"; ctx.lineWidth = 2; ctx.beginPath(); wave.forEach((v, i) => { const px = 220 + i, py = C[1] - v * R; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(...P, 6, 0, 7); ctx.fill();
      ctx.font = "12px monospace"; ctx.fillStyle = "#ffb454"; ctx.fillText("cos", C[0] + x * R / 2 - 10, C[1] + 16); ctx.fillStyle = "#7fb0ff"; ctx.fillText("sin", P[0] + 6, C[1] - y * R / 2);
      const deg = ((t * 180 / Math.PI) % 360 + 360) % 360;
      out.textContent = `angle = ${deg.toFixed(0)}°   cos = ${x.toFixed(2)}   sin = ${y.toFixed(2)}   →   x = centerX + cos(angle) × r,  y = centerY + sin(angle) × r`;
    };
    d.append(cv, el("label", { style: "margin-top:8px" }, "מהירות סיבוב", sp), out);
    requestAnimationFrame(loop);
  };

  /* ---------------- Easing ---------------- */
  D.easing = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · אנימציה ו-Easing", "למה תנועה במשחקים מרגישה ״חיה״", "lerp (אינטרפולציה) מחשב נקודה בין התחלה לסוף לפי t מ-0 עד 1. פונקציות Easing משנות את t כדי שהתנועה תאיץ, תאט, תקפוץ או תקפיץ. תפריטים, מצלמות וקופצים בכל משחק משתמשים בזה.");
    const E = {
      "linear (קבוע)": t => t,
      "easeInQuad (מאיץ)": t => t * t,
      "easeOutQuad (מאט)": t => 1 - (1 - t) ** 2,
      "easeInOutCubic": t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
      "easeOutBack (חורג וחוזר)": t => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
      "easeOutElastic (קפיץ)": t => t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - .75) * 2 * Math.PI / 3) + 1,
      "easeOutBounce (כדור)": t => { const n = 7.5625, dd = 2.75; if (t < 1 / dd) return n * t * t; if (t < 2 / dd) return n * (t -= 1.5 / dd) * t + .75; if (t < 2.5 / dd) return n * (t -= 2.25 / dd) * t + .9375; return n * (t -= 2.625 / dd) * t + .984375; },
    };
    const keys = Object.keys(E);
    const W = 460, RH = 34, H = keys.length * RH + 10;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "אנימציות" });
    const ctx = cv.getContext("2d");
    let t0 = performance.now();
    const loop = now => {
      requestAnimationFrame(loop);
      if (!visible(d)) return;
      let t = ((now - t0) / 1400) % 1.6; t = Math.min(1, t);
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      keys.forEach((k, i) => {
        const y = 22 + i * RH, x0 = 200, x1 = W - 20;
        ctx.fillStyle = "#7d8fa6"; ctx.font = "12px monospace"; ctx.textAlign = "left"; ctx.fillText(k.split(" ")[0], 8, y + 4);
        ctx.strokeStyle = "#1f2b3b"; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
        const v = E[k](t);
        ctx.fillStyle = `hsl(${i * 50},75%,62%)`; ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * v, y, 9, 0, 7); ctx.fill();
      });
    };
    d.append(cv, el("pre", {}, el("code", {}, `function lerp(a, b, t) { return a + (b - a) * t; }   // t בין 0 ל-1
const easeOutQuad = t => 1 - (1 - t) * (1 - t);
x = lerp(startX, endX, easeOutQuad(t));              // מתחיל מהר ומאט בסוף`)));
    requestAnimationFrame(loop);
  };

  /* ---------------- Bezier ---------------- */
  D.bezier = d => {
    const { el, head, visible } = MG;
    head(d, "מעבדה · עקומות בזייה", "איך מציירים עקומה חלקה מ-4 נקודות", "גרור את ארבע הנקודות. העקומה נבנית מקווים ישרים בלבד: מחברים נקודות, לוקחים נקודה באחוז t מכל קו, וחוזרים על זה (אלגוריתם דה-קסטלז׳ו). משמש למסלולי רכבים ומצלמות במשחקים, לאנימציות, לגופנים ולכלי ציור.");
    const W = 460, H = 280;
    const cv = el("canvas", { width: String(W), height: String(H), "aria-label": "עקומת בזייה" });
    const ctx = cv.getContext("2d");
    let P = [[50, 230], [120, 40], [340, 40], [410, 230]];
    const tS = el("input", { type: "range", min: "0", max: "1", step: "0.005", value: "0.4", id: "bz-t", "aria-label": "t" });
    let anim = true;
    const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const loop = now => {
      requestAnimationFrame(loop);
      if (!visible(d)) return;
      if (anim) tS.value = String((Math.sin(now / 1400) + 1) / 2);
      const t = +tS.value;
      ctx.fillStyle = "#05080c"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#ffb454"; ctx.lineWidth = 3; ctx.beginPath();
      for (let k = 0; k <= 100; k++) { let L = P; while (L.length > 1) L = L.slice(1).map((p, i) => lerp2(L[i], p, k / 100)); k ? ctx.lineTo(...L[0]) : ctx.moveTo(...L[0]); }
      ctx.stroke(); ctx.lineWidth = 1;
      let L = P, lvl = 0; const cols = ["#3d4d66", "#7fb0ff", "#5fd08f"];
      while (L.length > 1) {
        ctx.strokeStyle = cols[lvl] || "#fff"; ctx.beginPath(); L.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke();
        L = L.slice(1).map((p, i) => lerp2(L[i], p, t));
        ctx.fillStyle = cols[lvl + 1] || "#fff"; L.forEach(p => { ctx.beginPath(); ctx.arc(...p, 3.5, 0, 7); ctx.fill(); });
        lvl++;
      }
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(...L[0], 6, 0, 7); ctx.fill();
      P.forEach((p, i) => { ctx.fillStyle = "#d9e6f2"; ctx.beginPath(); ctx.arc(...p, 8, 0, 7); ctx.fill(); ctx.fillStyle = "#05080c"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center"; ctx.fillText("P" + i, p[0], p[1] + 3.5); });
      ctx.fillStyle = "#7d8fa6"; ctx.textAlign = "left"; ctx.font = "12px monospace"; ctx.fillText("t = " + t.toFixed(2), 10, 18);
    };
    draggable(cv, () => P, (i, p) => { P[i] = p; });
    const ab = el("button", { class: "on", onclick: () => { anim = !anim; ab.classList.toggle("on", anim); } }, "הנפשה אוטומטית");
    tS.addEventListener("input", () => { anim = false; ab.classList.remove("on"); });
    d.append(cv, el("div", { class: "row", style: "margin-top:8px" }, ab, el("label", { style: "flex:1;min-width:160px" }, "t", tS)));
    requestAnimationFrame(loop);
  };
})();
