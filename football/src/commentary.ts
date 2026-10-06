// Two-voice Hebrew commentary: a play-by-play caller and an analyst.

export type CEvent =
  | 'kickoff' | 'goal' | 'ownGoal' | 'shot' | 'saved' | 'post' | 'miss' | 'foul' | 'yellow' | 'red'
  | 'offside' | 'corner' | 'freekick' | 'penalty' | 'penScored' | 'penMissed' | 'tackle' | 'halftime'
  | 'fulltime' | 'bigChance' | 'skill' | 'longPass' | 'possession' | 'secondHalf' | 'throw' | 'goalkick'
  | 'equalizer' | 'lead' | 'handball' | 'catch';

const LINES: Record<CEvent, string[]> = {
  kickoff: ['והמשחק יוצא לדרך! {stadium} מלא עד אפס מקום.', 'שריקת הפתיחה! {team} פותחת עם הכדור.', 'אנחנו מתחילים, ערב גדול של כדורגל לפנינו.'],
  secondHalf: ['המחצית השנייה יוצאת לדרך.', 'חוזרים לדשא – 45 דקות להכריע את המשחק.'],
  goal: ['גוווול! {player} כובש עבור {team}!', 'איזה שער! {player} לא מחמיץ!', 'הכדור ברשת! {player} מטריף את היציע!', 'גול נהדר של {player}! {team} חוגגת!'],
  ownGoal: ['שער עצמי! {player} מכניס לרשת של עצמו, איזה מזל רע.', 'אוי לא, שער עצמי של {player}.'],
  equalizer: ['ויש שוויון! הכול מתחיל מחדש.', 'שער השוויון! המשחק פתוח לגמרי.'],
  lead: ['{team} עולה ליתרון!', 'ויש יתרון ל{team}!'],
  shot: ['{player} בועט!', 'בעיטה של {player}!', '{player} מנסה מרחוק!'],
  saved: ['הצלה גדולה של {player}!', '{player} עף לפינה ומציל!', 'השוער {player} אומר לא!'],
  catch: ['{player} אוסף בביטחון.', 'כדור קל לשוער {player}.'],
  post: ['הקורה! כמה קרוב!', 'בעמוד! הכדור מסרב להיכנס!', 'פוגע במסגרת! לא יאומן!'],
  miss: ['מעל המשקוף.', 'החטאה, הכדור עובר ליד הקורה.', 'חבל, זה היה יכול להיות שער.', 'רחב מהשער.'],
  foul: ['עבירה של {player}, השופט שורק.', '{player} מפיל את היריב – עבירה.'],
  yellow: ['כרטיס צהוב ל{player}.', 'השופט שולף צהוב – {player} בספר.'],
  red: ['כרטיס אדום! {player} מורחק!', 'אדום! {team} תשחק בעשרה.'],
  offside: ['נבדל! הדגל מורם.', '{player} נתפס בנבדל.', 'מלכודת נבדלים מושלמת.'],
  corner: ['קרן ל{team}.', 'כדור קרן – הרחבה מתמלאת.'],
  freekick: ['בעיטה חופשית ל{team} במיקום מסוכן.', 'בעיטה חופשית – החומה מתארגנת.'],
  penalty: ['פנדל! השופט מצביע על הנקודה!', 'פנדל ל{team}! רגע של אמת.'],
  penScored: ['הכדור בפינה! פנדל מושלם.', 'בביטחון מלא – בפנים!'],
  penMissed: ['הוחמץ! השוער ניחש נכון!', 'לא! הפנדל מוחמץ!'],
  tackle: ['תיקול נקי של {player}.', '{player} חוטף את הכדור בתזמון מצוין.', 'הגנה מצוינת של {player}.'],
  halftime: ['שריקה למחצית. {score}.', 'סוף המחצית הראשונה, {score}.'],
  fulltime: ['שריקת הסיום! {score}.', 'זהו, נגמר. {score}.'],
  bigChance: ['הזדמנות ענקית!', 'איזו הזדמנות!'],
  skill: ['איזה מהלך של {player}!', '{player} מסובב את המגן!', 'קסם ברגליים של {player}.'],
  longPass: ['מסירה ארוכה ומדויקת של {player}.', 'חילוף אגף יפהפה של {player}.'],
  possession: ['{team} שולטת – {pct}% החזקה בכדור.', 'הנתונים מדברים: {team} עם {pct}% החזקה.'],
  throw: ['זריקת חוץ ל{team}.'],
  goalkick: ['בעיטת שער.'],
  handball: ['נגיעת יד! השופט שורק.', 'יד! עבירה ברורה.'],
};

const ANALYST: Partial<Record<CEvent, string[]>> = {
  goal: ['פרשן: תראו את התנועה ללא כדור לפני השער – בדיוק ככה פותחים הגנה.', 'פרשן: סיום קר כקרח, השוער לא היה יכול לעשות כלום.'],
  saved: ['פרשן: השוער קרא את הבעיטה מוקדם, מיקום מצוין.', 'פרשן: רפלקסים של חתול.'],
  miss: ['פרשן: היה לו יותר זמן ממה שחשב.', 'פרשן: צריך להוריד את הכדור, לא לנסות לפוצץ את הרשת.'],
  red: ['פרשן: לא היה צריך את הגלישה הזאת מאחור.'],
  offside: ['פרשן: קו ההגנה עלה ביחד, עבודה טקטית של כל הרביעייה.'],
  tackle: ['פרשן: ככה מגנים – סבלנות ואז תזמון.'],
};

export function line(ev: CEvent, vars: Record<string, string | number> = {}): string {
  const arr = LINES[ev];
  let s = arr[Math.floor(Math.random() * arr.length)];
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function analyst(ev: CEvent): string | null {
  const arr = ANALYST[ev];
  if (!arr || Math.random() < 0.5) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}
