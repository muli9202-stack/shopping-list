import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { CHAINS, MODES, type ChainId, type HistoryEntry, type Mode, type Product } from './types';
import { formatDate } from './stats';

const AnalysisSchema = z.object({
  summary: z.string().describe('2-3 משפטים בעברית שמתארים את הרגלי הקנייה'),
  basket: z
    .array(
      z.object({
        product_id: z.string().describe('המזהה מתוך רשימת המוצרים, או מחרוזת ריקה אם המוצר כבר לא במאגר'),
        name: z.string(),
        frequency_label: z.string().describe('תדירות בעברית, למשל "כל שבוע" או "פעם בשבועיים"'),
        typical_qty: z.number().describe('הכמות הרגילה בקנייה'),
      }),
    )
    .describe('הקנייה הממוצעת: המוצרים שכדאי להכניס לרשימה הבאה כברירת מחדל, מהנפוץ לפחות נפוץ'),
  occasional: z.array(z.string()).describe('מוצרים שנקנים מדי פעם, עם הערה קצרה על התדירות'),
  often_missing: z.array(z.string()).describe('מוצרים שחוזרים על עצמם כ"לא היה במלאי"'),
  insights: z.array(z.string()).describe('2-5 תובנות או המלצות קצרות ומעשיות בעברית'),
});

export type AiAnalysis = z.infer<typeof AnalysisSchema>;

export interface AiInsight {
  createdAt: number;
  historyCount: number;
  model: string;
  result: AiAnalysis;
}

const SYSTEM = `אתה עוזר קניות שמנתח היסטוריית רשימות קניות של משק בית אחד בסופרמרקט בישראל.
המטרה: לחשב את "הקנייה הממוצעת" של המשתמש - אילו מוצרים הוא קונה בדרך כלל, באיזו כמות ובאיזו תדירות - כדי שיוכל להתחיל ממנה את הרשימה הבאה.
סטטוסים ברשימות: bought = נקנה, missing = לא היה במלאי (כלומר המשתמש רצה אותו), pending = לא סומן (כנראה לא נקנה).
מוצר ב-basket רק אם הוא מופיע בחלק משמעותי מהרשימות (בערך 40% ומעלה) או שיש סיבה טובה אחרת. השתמש רק במזהי מוצרים שמופיעים ברשימת המוצרים הנוכחית.
כתוב הכול בעברית, בקצרה ובגובה העיניים.`;

export async function analyzeHistory(opts: {
  apiKey: string;
  model: string;
  chainId: ChainId;
  mode: Mode;
  entries: HistoryEntry[];
  products: Product[];
}): Promise<AiInsight> {
  const { apiKey, model, chainId, mode, entries, products } = opts;
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const sorted = [...entries].sort((a, b) => a.date - b.date);
  const historyText = sorted
    .map(
      (e, i) =>
        `רשימה ${i + 1} (${formatDate(e.date)}):\n` +
        e.items.filter((it) => !it.productId.startsWith('cat:')).map((it) => `- ${it.name} [${it.productId}] ×${it.qty} ${it.status}`).join('\n'),
    )
    .join('\n\n');
  const catalogText = products
    .filter((p) => p.chainId === chainId)
    .map((p) => `${p.id}: ${p.name}`)
    .join('\n');

  const prompt = `רשת: ${CHAINS[chainId].name}. סוג קנייה: ${MODES[mode].name}. מספר רשימות: ${sorted.length}.

<catalog>
${catalogText}
</catalog>

<history>
${historyText}
</history>

נתח את ההיסטוריה והחזר את הקנייה הממוצעת.`;

  const useFallbacks = model === 'claude-opus-5';
  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
    output_config: { effort: 'medium', format: betaZodOutputFormat(AnalysisSchema) },
    ...(useFallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
  });

  if (response.stop_reason === 'refusal') throw new Error('הבקשה נדחתה על ידי המודל. נסה שוב מאוחר יותר.');
  if (response.stop_reason === 'max_tokens') throw new Error('התשובה נקטעה. נסה שוב.');
  if (!response.parsed_output) throw new Error('לא התקבלה תשובה תקינה מהמודל.');

  return { createdAt: Date.now(), historyCount: entries.length, model: response.model, result: response.parsed_output };
}

export function describeAiError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'מפתח ה-API לא תקין. בדוק אותו במסך ההגדרות.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'למפתח אין הרשאה למודל הזה.';
  if (err instanceof Anthropic.RateLimitError) return 'יותר מדי בקשות. נסה שוב בעוד דקה.';
  if (err instanceof Anthropic.BadRequestError) return `שגיאה בבקשה: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return 'אין חיבור לאינטרנט או שהשרת לא זמין.';
  if (err instanceof Anthropic.APIError) return `שגיאת שרת (${err.status}). נסה שוב.`;
  return err instanceof Error ? err.message : 'שגיאה לא ידועה';
}
