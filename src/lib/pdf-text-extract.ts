import { inflateSync } from 'node:zlib';

function decodePdfStreams(latin1: string): Buffer[] {
  const out: Buffer[] = [];
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let sm: RegExpExecArray | null;
  while ((sm = streamRe.exec(latin1))) {
    const before = latin1.slice(Math.max(0, sm.index - 300), sm.index);
    let payload = Buffer.from(sm[1]!, 'binary');
    if (before.includes('FlateDecode')) {
      try {
        payload = inflateSync(payload);
      } catch {
        // keep raw payload
      }
    }
    out.push(payload);
  }
  return out;
}

function parseToUnicodeMaps(streams: Buffer[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const payload of streams) {
    const text = payload.toString('utf8');
    if (!text.includes('beginbfchar')) continue;
    const entryRe = /<([0-9A-Fa-f]{2,4})>\s*<([0-9A-Fa-f]{2,4})>/g;
    let m: RegExpExecArray | null;
    while ((m = entryRe.exec(text))) {
      map.set(parseInt(m[1]!, 16), parseInt(m[2]!, 16));
    }
  }
  return map;
}

function decodeHexGlyphRun(hex: string, cmap: Map<number, number>): string {
  let out = '';
  const normalized = hex.replace(/\s+/g, '');
  for (let i = 0; i + 4 <= normalized.length; i += 4) {
    const gid = parseInt(normalized.slice(i, i + 4), 16);
    const cp = cmap.get(gid);
    out += cp != null ? String.fromCodePoint(cp) : '';
  }
  return out;
}

function decodeLiteralGlyphRun(raw: string, cmap: Map<number, number>): string {
  let out = '';
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    const cp = cmap.get(code);
    out += cp != null ? String.fromCodePoint(cp) : raw[i]!;
  }
  return out;
}

/** Extract Unicode text from jsPDF custom-font PDFs via embedded ToUnicode CMaps. */
export function extractPdfUnicodeText(buffer: Buffer): string {
  const latin1 = buffer.toString('latin1');
  const streams = decodePdfStreams(latin1);
  const cmap = parseToUnicodeMaps(streams);
  const chunks: string[] = [];

  for (const payload of streams) {
    const content = payload.toString('latin1');
    if (content.includes('beginbfchar') || content.includes('begincmap')) continue;

    const hexRe = /<([0-9A-Fa-f]+)>\s*T[jJ]/g;
    let m: RegExpExecArray | null;
    while ((m = hexRe.exec(content))) {
      const decoded = decodeHexGlyphRun(m[1]!, cmap);
      if (decoded.trim()) chunks.push(decoded);
    }

    const litRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*T[jJ]/g;
    while ((m = litRe.exec(content))) {
      const raw = m[1]!.replace(/\\(.)/g, '$1');
      const decoded = decodeLiteralGlyphRun(raw, cmap);
      if (decoded.trim()) chunks.push(decoded);
    }
  }

  return chunks.join(' ');
}

export function countPdfPages(buffer: Buffer): number {
  const latin1 = buffer.toString('latin1');
  return Math.max(1, (latin1.match(/\/Type\s*\/Page\b/g) || []).length);
}
