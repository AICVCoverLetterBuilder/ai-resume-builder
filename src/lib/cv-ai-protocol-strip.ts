/**
 * Strip private repair/protocol/debug markers from provider or repair output
 * before validation and persistence. These labels must never reach the user CV.
 */

const LEADING_PROTOCOL_LABELS: RegExp[] = [
  /^\s*CORRECTED\s+PROFESSIONAL\s+SUMMARY\s*:?\s*/iu,
  /^\s*CORRECTED\s+SUMMARY\s*:?\s*/iu,
  /^\s*REPAIRED\s+SUMMARY\s*:?\s*/iu,
  /^\s*FINAL\s+SUMMARY\s*:?\s*/iu,
  /^\s*CORRECTED\s+BULLETS?\s*:?\s*/iu,
  /^\s*REPAIRED\s+BULLETS?\s*:?\s*/iu,
  /^\s*FINAL\s+BULLETS?\s*:?\s*/iu,
  /^\s*OUTPUT\s*:?\s*/iu,
  /^\s*RESULT\s*:?\s*/iu,
  /^\s*REWRITTEN\s+TEXT\s*:?\s*/iu,
  /^\s*SUMMARY\s*:?\s*/iu,
  /^\s*#{1,6}\s*CORRECTED[^\n]*\n+/iu,
  /^\s*#{1,6}\s*REPAIRED[^\n]*\n+/iu,
  /^\s*#{1,6}\s*FINAL[^\n]*\n+/iu,
];

const RESIDUAL_PROTOCOL_MARKERS: RegExp[] = [
  /\bCORRECTED\s+PROFESSIONAL\s+SUMMARY\b/iu,
  /\bCORRECTED\s+SUMMARY\b/iu,
  /\bREPAIRED\s+SUMMARY\b/iu,
  /\bFINAL\s+SUMMARY\b/iu,
  /\bCORRECTED\s+BULLETS?\b/iu,
  /\bREPAIRED\s+BULLETS?\b/iu,
  /\bCV\s+SUMMARY\s+FIDELITY\s+REPAIR\s+REQUIRED\b/iu,
  /\bCV\s+BULLET\s+FIDELITY\s+REPAIR\s+REQUIRED\b/iu,
];

/** True when internal repair/protocol wording is still present. */
export function hasAiProtocolMarker(text: string): boolean {
  if (!text) return false;
  return RESIDUAL_PROTOCOL_MARKERS.some((re) => re.test(text));
}

/**
 * Remove known leading protocol labels, code fences, and wrapper quotes.
 * Does not invent content — only strips private scaffolding.
 */
export function stripAiProtocolMarkers(text: string): string {
  let out = (text || '').replace(/^\uFEFF/, '').trim();
  if (!out) return '';

  // Fenced code blocks wrapping the whole payload
  const fence = out.match(/^```(?:[a-z]+)?\s*([\s\S]*?)\s*```$/iu);
  if (fence?.[1]) out = fence[1].trim();

  // XML-ish wrappers
  out = out.replace(/^<\/?(?:summary|result|output|rewrite|bullets)>\s*/iu, '');
  out = out.replace(/\s*<\/(?:summary|result|output|rewrite|bullets)>\s*$/iu, '');

  for (let i = 0; i < 4; i += 1) {
    let changed = false;
    for (const re of LEADING_PROTOCOL_LABELS) {
      const next = out.replace(re, '');
      if (next !== out) {
        out = next.trim();
        changed = true;
      }
    }
    // Leading/trailing fancy or straight quotes around the whole block
    const quoted = out.match(/^["“”'«»„]\s*([\s\S]*?)\s*["“”'«»„]$/u);
    if (quoted?.[1]) {
      out = quoted[1].trim();
      changed = true;
    }
    if (!changed) break;
  }

  return out.trim();
}
