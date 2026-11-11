/**
 * Files attached to a message, read in the browser into plain text the planner can use. Spreadsheets become one line
 * per row ("cell | cell | cell"), per sheet; text files are used as they are. Nothing is uploaded or stored apart
 * from the text, which goes with the message.
 */
import readXlsxFile from 'read-excel-file/browser';

export type Attached = { name: string; text: string };

export const ATTACH_TYPES = '.xlsx,.csv,.txt,.md,.json';
/** Per file, so one large export can't crowd out the brief. */
export const MAX_FILE_CHARS = 60000;

const cell = (v: unknown) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).replace(/\s*\n\s*/g, ' / ').trim());

export async function readAttachment(file: File): Promise<Attached> {
  const lower = file.name.toLowerCase();
  let text: string;
  if (lower.endsWith('.xlsx')) {
    const sheets = await readXlsxFile(file);
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
  return [message.trim(), ...files.map((f) => `=== ATTACHED FILE: ${f.name} ===\n${f.text}`)].filter(Boolean).join('\n\n');
}
