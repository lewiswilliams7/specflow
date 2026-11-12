/**
 * Files attached to a message, read in the browser into plain text the planner can use. Spreadsheets become one line
 * per row ("cell | cell | cell"), per sheet; text files are used as they are. Nothing is uploaded or stored apart
 * from the text, which goes with the message.
 */
import readXlsxFile from 'read-excel-file/browser';
import { DESIGN_RULES, designSheetBrief } from './design-sheet';

/** design: the file is a request form design, read field by field in code. */
export type Attached = { name: string; text: string; design?: { forms: number; fields: number } };

export const ATTACH_TYPES = '.xlsx,.csv,.txt,.md,.json';
/** Per file, so one large export can't crowd out the brief. */
export const MAX_FILE_CHARS = 60000;

const cell = (v: unknown) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).replace(/\s*\n\s*/g, ' / ').trim());

export async function readAttachment(file: File): Promise<Attached> {
  const lower = file.name.toLowerCase();
  let text: string;
  if (lower.endsWith('.xlsx')) {
    const sheets = await readXlsxFile(file);
    const design = designSheetBrief(sheets.map((s) => ({ sheet: s.sheet, data: s.data.map((r) => r.map((c) => (c === null || c === undefined ? null : cell(c)))) })));
    if (design) return { name: file.name, text: design.brief, design: { forms: design.forms, fields: design.fields } };
    text = sheets
      .map((s) => {
        const rows = s.data.map((r) => r.map(cell)).filter((r) => r.some(Boolean));
        return `Sheet: ${s.sheet}\n${rows.map((r) => r.join(' | ')).join('\n')}`;
      })
      .join('\n\n');
  } else if (/\.(csv|txt|md|json)$/.test(lower)) {
    text = await file.text();
  } else {
    throw new Error(`${file.name}: attach a spreadsheet (.xlsx), CSV or text file.`);
  }
  if (text.length > MAX_FILE_CHARS) throw new Error(`${file.name} is too long (${text.length.toLocaleString()} characters; the limit is ${MAX_FILE_CHARS.toLocaleString()}). Remove sheets or rows that aren't needed.`);
  return { name: file.name, text: text.trim() };
}

/** The message as the planner gets it: what was typed, then each file under its own heading. */
export function withAttachments(message: string, files: Attached[]): string {
  if (!files.length) return message;
  const designs = files.filter((f) => f.design);
  const others = files.filter((f) => !f.design);
  return [
    // A form design brings its own build rules; what was typed comes after them, so it can add to or override them.
    designs.length ? DESIGN_RULES : '',
    designs.length && message.trim() ? `Also, from me:\n${message.trim()}` : message.trim(),
    ...others.map((f) => `=== ATTACHED FILE: ${f.name} ===\n${f.text}`),
    ...designs.map((f) => `=== ATTACHED FILE: ${f.name} (read as a form design: ${f.design!.forms} form${f.design!.forms === 1 ? '' : 's'}, ${f.design!.fields} fields) ===\n${f.text}`),
  ].filter(Boolean).join('\n\n');
}
