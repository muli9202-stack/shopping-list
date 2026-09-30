/**
 * Word families by root, for the roots topic ("שורשים ומשפחות"). Roots are written with regular
 * letters (מ-ל-כ, not מ-ל-ך). Every word is checked with hspell by scripts/validate-content.ts.
 */
export interface Family {
  root: string;
  words: string[];
}

export const FAMILIES: Family[] = [
  { root: 'כתב', words: ['כתב', 'מכתב', 'כתיבה', 'לכתוב', 'כתבתי'] },
  { root: 'למד', words: ['תלמיד', 'לומדים', 'מלמד'] },
  { root: 'אכל', words: ['אוכל', 'מאכל', 'אכלתי'] },
  { root: 'שחק', words: ['משחק', 'שיחק', 'שחקן'] },
  { root: 'חשב', words: ['מחשב', 'חשבון', 'מחשבה', 'מחשבון'] },
  { root: 'ספר', words: ['ספר', 'סיפור', 'ספרייה', 'סופר'] },
  { root: 'קרא', words: ['קורא', 'קריאה', 'קרא'] },
  { root: 'רקד', words: ['ריקוד', 'רקדן', 'רוקד'] },
  { root: 'עזר', words: ['עוזר', 'עזרה', 'לעזור'] },
  { root: 'טיל', words: ['טיול', 'מטייל', 'לטייל'] },
  { root: 'רכב', words: ['רכבת', 'רוכב', 'לרכוב'] },
  { root: 'פתח', words: ['פתוח', 'מפתח', 'לפתוח'] },
  { root: 'זכר', words: ['זיכרון', 'זוכר', 'מזכרת'] },
  { root: 'חלמ', words: ['חלום', 'חלמתי', 'חולם'] },
  { root: 'שאל', words: ['שאלה', 'שאלתי', 'שואל'] },
  { root: 'קפצ', words: ['קפיצה', 'לקפוץ', 'קופץ'] },
  { root: 'חתכ', words: ['חתיכה', 'חותך', 'לחתוך'] },
  { root: 'לבש', words: ['לבוש', 'לובש', 'לבשתי'] },
  { root: 'צבע', words: ['צבע', 'צבעוני', 'צובע'] },
  { root: 'שמח', words: ['שמח', 'שמחה', 'משמח'] },
  { root: 'מלכ', words: ['מלך', 'מלכה', 'ממלכה'] },
  { root: 'חבר', words: ['חבר', 'מחברת', 'חברים'] },
  { root: 'עבד', words: ['עבודה', 'עובד', 'עבדתי'] },
  { root: 'כבס', words: ['כביסה', 'לכבס', 'מכבסה'] },
  { root: 'גדל', words: ['גדול', 'מגדל', 'גדלתי'] },
  { root: 'ילד', words: ['ילד', 'ילדה', 'ילדות'] },
  { root: 'כדר', words: ['כדור', 'כדורגל', 'כדורסל'] },
];

/** "כ-ת-ב" */
export function showRoot(root: string) {
  return [...root].join('-');
}

export function familyOf(word: string): Family | undefined {
  return FAMILIES.find((f) => f.words.includes(word));
}
