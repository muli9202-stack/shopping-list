import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { categoryPath } from './catalog';
import { catIdOf, isCatKey } from './listView';
import { CHAINS, MODES, type AppData, type ChainId, type ItemStatus, type Mode } from './types';

// Minimal .xlsx writer/reader. The readable sheets are for people; the hidden
// "_data" sheet carries the full JSON so the same file can restore the app.

type Cell = string | number;
interface SheetDef {
  name: string;
  rows: Cell[][];
  hidden?: boolean;
  widths?: number[];
}

const DATA_SHEET = '_data';
const CHUNK = 30000; // Excel's per-cell limit is 32,767 characters.

const STATUS_LABEL: Record<ItemStatus, string> = { bought: 'נקנה', missing: 'לא היה במלאי', pending: 'לא סומן' };

const esc = (s: string) =>
  s
    // Characters that are illegal in XML 1.0.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function colName(i: number): string {
  let s = '';
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

function sheetXml(sheet: SheetDef): string {
  const cols = sheet.widths?.length
    ? `<cols>${sheet.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const rows = sheet.rows
    .map(
      (row, r) =>
        `<row r="${r + 1}">${row
          .map((v, c) => {
            const ref = `${colName(c)}${r + 1}`;
            const style = r === 0 && !sheet.hidden ? ' s="1"' : '';
            return typeof v === 'number'
              ? `<c r="${ref}"${style}><v>${v}</v></c>`
              : `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
          })
          .join('')}</row>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews>${cols}<sheetData>${rows}</sheetData></worksheet>`;
}

function buildXlsx(sheets: SheetDef[]): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('')}</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
      .map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}"${s.hidden ? ' state="hidden"' : ''} r:id="rId${i + 1}"/>`)
      .join('')}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`),
  };
  sheets.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s))));
  return zipSync(files);
}

const fmtDateTime = (ts: number) =>
  new Date(ts).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function dataToXlsx(data: AppData): Uint8Array {
  const chainName = (c: ChainId) => CHAINS[c]?.name ?? c;
  const modeName = (m: Mode) => MODES[m]?.name ?? m;

  const active: Cell[][] = [['רשת', 'סוג קנייה', 'פריט', 'קטגוריה', 'כמות', 'סטטוס']];
  for (const [key, list] of Object.entries(data.lists)) {
    const [chain, mode] = key.split(':') as [ChainId, Mode];
    for (const [id, it] of Object.entries(list.items)) {
      if (isCatKey(id)) {
        const cat = data.categories.find((c) => c.id === catIdOf(id));
        if (cat) active.push([chainName(chain), modeName(mode), `${cat.name} (כל הקטגוריה)`, categoryPath(data.categories, cat.id), it.qty, STATUS_LABEL[it.status]]);
        continue;
      }
      const p = data.products.find((x) => x.id === id);
      if (p) active.push([chainName(chain), modeName(mode), p.name, categoryPath(data.categories, p.categoryId), it.qty, STATUS_LABEL[it.status]]);
    }
  }

  const history: Cell[][] = [['תאריך', 'רשת', 'סוג קנייה', 'פריט', 'קטגוריה', 'כמות', 'סטטוס']];
  for (const h of [...data.history].sort((a, b) => b.date - a.date)) {
    for (const it of h.items) {
      history.push([fmtDateTime(h.date), chainName(h.chainId), modeName(h.mode), it.name, it.categoryPath, it.qty, STATUS_LABEL[it.status]]);
    }
  }

  const catalog: Cell[][] = [['רשת', 'קטגוריה', 'מוצר']];
  for (const p of data.products) catalog.push([chainName(p.chainId), categoryPath(data.categories, p.categoryId), p.name]);

  const json = JSON.stringify(data);
  const dataRows: Cell[][] = [];
  for (let i = 0; i < json.length; i += CHUNK) dataRows.push([json.slice(i, i + CHUNK)]);

  return buildXlsx([
    { name: 'רשימות פעילות', rows: active, widths: [14, 14, 28, 30, 8, 16] },
    { name: 'היסטוריה', rows: history, widths: [18, 14, 14, 28, 30, 8, 16] },
    { name: 'מאגר מוצרים', rows: catalog, widths: [14, 32, 28] },
    { name: DATA_SHEET, rows: dataRows, hidden: true },
  ]);
}

/** Reads the hidden data sheet back out of a backup file (also after it was re-saved in Excel). */
export function xlsxToData(bytes: Uint8Array): AppData {
  const files = unzipSync(bytes);
  const read = (path: string) => (files[path] ? strFromU8(files[path]) : null);
  const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

  const workbook = parse(read('xl/workbook.xml') ?? '');
  const sheet = [...workbook.getElementsByTagName('sheet')].find((s) => s.getAttribute('name') === DATA_SHEET);
  if (!sheet) throw new Error('no data sheet');
  const rid = sheet.getAttribute('r:id') ?? sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  const rels = parse(read('xl/_rels/workbook.xml.rels') ?? '');
  const target = [...rels.getElementsByTagName('Relationship')].find((r) => r.getAttribute('Id') === rid)?.getAttribute('Target');
  if (!target) throw new Error('no data sheet target');
  const sheetXmlText = read(target.startsWith('/') ? target.slice(1) : `xl/${target}`);
  if (!sheetXmlText) throw new Error('missing data sheet');

  const shared = read('xl/sharedStrings.xml');
  const sharedStrings = shared
    ? [...parse(shared).getElementsByTagName('si')].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent ?? '').join(''))
    : [];
  const cells = [...parse(sheetXmlText).getElementsByTagName('c')];
  const json = cells
    .map((c) => {
      if (c.getAttribute('t') === 's') return sharedStrings[Number(c.getElementsByTagName('v')[0]?.textContent)] ?? '';
      return [...c.getElementsByTagName('t')].map((t) => t.textContent ?? '').join('') || c.getElementsByTagName('v')[0]?.textContent || '';
    })
    .join('');
  return JSON.parse(json) as AppData;
}

export function downloadBytes(bytes: Uint8Array, filename: string, type: string) {
  const blob = new Blob([bytes as BlobPart], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export function downloadExcel(data: AppData, when = new Date()) {
  const stamp = `${when.toISOString().slice(0, 10)}_${String(when.getHours()).padStart(2, '0')}-${String(when.getMinutes()).padStart(2, '0')}`;
  downloadBytes(dataToXlsx(data), `shopping-list-backup-${stamp}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
