// Checks the library tables against the live Sefaria API: every tractate, Mishnah tractate and
// Tanakh book name, the number of dafim per tractate, and that the default commentators load
// on a sample page of each kind. Run: node --experimental-strip-types chavruta/scripts/check-coverage.mts
import { COMMENTATORS, TANAKH, TRACTATES } from '../src/core/lexicon.ts';

const API = 'https://www.sefaria.org/api';
const problems: string[] = [];
const index = async (name: string) => {
  const r = await fetch(`${API}/v2/index/${encodeURIComponent(name)}`);
  return r.ok ? ((await r.json()) as { title?: string; error?: string; schema?: { lengths?: number[] } }) : { error: `HTTP ${r.status}` };
};

const names = [...TRACTATES.flatMap((t) => [t.bavli, t.mishnah].filter((x): x is string => !!x)), ...TANAKH.map((b) => b.sefaria)];
await Promise.all(
  names.map(async (n) => {
    const d = await index(n);
    if (d.error || d.title !== n) problems.push(`name ${n}: ${d.error ?? d.title}`);
  }),
);
for (const t of TRACTATES.filter((x) => x.bavli)) {
  const d = await index(t.bavli!);
  const last = Math.ceil((d.schema?.lengths?.[0] ?? NaN) / 2);
  if (last !== t.lastDaf) problems.push(`lastDaf ${t.bavli}: table ${t.lastDaf}, Sefaria ${last}`);
}
const samples: Record<string, string> = { talmud: 'Bava Metzia 21a', mishnah: 'Mishnah Bava Metzia 2', tanakh: 'Exodus 12' };
for (const c of COMMENTATORS) {
  for (const kind of c.on) {
    const base = samples[kind];
    const book = base.replace(/ \S+$/, '');
    const ref = `${c.id} on ${base}`;
    const r = await fetch(`${API}/v3/texts/${encodeURIComponent(ref)}?version=hebrew`);
    const d = r.ok ? ((await r.json()) as { versions?: { text: unknown }[] }) : {};
    if (!d.versions?.length || !JSON.stringify(d.versions[0].text).match(/[א-ת]/)) problems.push(`commentary ${c.id} on ${book}: no Hebrew text at ${ref}`);
  }
}
console.log(`checked ${names.length} names, ${TRACTATES.filter((t) => t.bavli).length} daf counts, ${COMMENTATORS.length} commentators`);
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'all OK');
process.exitCode = problems.length ? 1 : 0;
