import { describe, expect, test, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import {
  assembleCoverLetterContent,
  assertCoverLetterExportable,
  CoverLetterExportIncompleteError,
  evaluateCoverLetterExportGuard,
  resolveExportCandidateName,
  sanitizeCoverLetterContent,
  stampCoverLetterContent,
  validateCoverLetterExportContent,
} from '../cover-letter-generation';
import { computeCoverLetterPdfParagraphs } from '../cover-letter-pdf';

const COMPANY = 'Tuxy';
const CANDIDATE = 'Alex Tuhel';

const VALID_ENGLISH = {
  dateLine: 'July 12, 2026',
  greeting: 'Dear Tuxy Hiring Team,',
  paragraph1: 'I am applying for the Software Engineer role at Tuxy and bring practical experience building reliable web applications.',
  paragraph2: 'My background includes collaborative product work, careful debugging, and delivering user-focused features.',
  paragraph3: 'Tuxy commitment to product quality and customer focus is motivating, and I am eager to contribute meaningfully to your team.',
  closing: 'I would welcome the opportunity to discuss my fit in an interview and thank you for your time and consideration.',
  signOff: 'Sincerely',
  candidateName: CANDIDATE,
};

function productionFullLetter(body: string, candidate = CANDIDATE, date = 'July 12, 2026'): string {
  const letterBody = stampCoverLetterContent(body);
  return `${candidate}\n\n${date}\n\n${letterBody}`;
}

function legacyFullLetter(body: string, candidate = CANDIDATE, date = 'July 12, 2026'): string {
  return `${candidate}\n\n${date}\n\n${body}`;
}

describe('cover letter export guard (minimal, pragmatic)', () => {
  test('English complete content with Sincerely and Alex Tuhel passes', () => {
    const content = productionFullLetter(assembleCoverLetterContent(VALID_ENGLISH));
    expect(validateCoverLetterExportContent(content, 'en', CANDIDATE, COMPANY, 'Sincerely').valid).toBe(true);
    expect(() => assertCoverLetterExportable(content, 'en', CANDIDATE, COMPANY, 'Sincerely')).not.toThrow();
    expect(evaluateCoverLetterExportGuard(content).reasonCode).toBe('EXPORT_GUARD_PASS');
  });

  test('English complete legacy content without structured marker passes', () => {
    const content = legacyFullLetter(assembleCoverLetterContent(VALID_ENGLISH));
    expect(validateCoverLetterExportContent(content, 'en', CANDIDATE, COMPANY, 'Sincerely').valid).toBe(true);
  });

  test('English complete content with structured marker in the middle passes after stripping', () => {
    const content = productionFullLetter(assembleCoverLetterContent(VALID_ENGLISH));
    // `productionFullLetter` simulates a legacy draft that was saved with the
    // marker embedded (before it was removed from generation output).
    expect(content).toContain('structured-v4');
    expect(validateCoverLetterExportContent(content, 'en', CANDIDATE, COMPANY, 'Sincerely').valid).toBe(true);
    // But the marker must never survive sanitization — the safety net applied
    // before preview/export/copy.
    expect(sanitizeCoverLetterContent(content)).not.toContain('structured-v4');
  });

  test('English complete content passes even when provided candidate name mismatches visible signature', () => {
    const content = productionFullLetter(assembleCoverLetterContent(VALID_ENGLISH));
    expect(validateCoverLetterExportContent(content, 'en', 'Alex Carter', COMPANY, 'Sincerely').valid).toBe(true);
    expect(evaluateCoverLetterExportGuard(content).reasonCode).toBe('EXPORT_GUARD_PASS');
  });

  test('Arabic non-empty generated cover letter passes even without a recognized sign-off', () => {
    const content = legacyFullLetter(
      'مرحبا بكم في هذه الرسالة، أكتب لأعرب عن اهتمامي بالانضمام إلى فريقكم والمساهمة بخبرتي العملية.',
      'Alex Carter',
      '12 يوليو 2026',
    );
    expect(evaluateCoverLetterExportGuard(content).pass).toBe(true);
    expect(validateCoverLetterExportContent(content, 'ar', 'Alex Carter', COMPANY, 'مع خالص التحية').valid).toBe(true);
    expect(() => assertCoverLetterExportable(content, 'ar', 'Alex Carter', COMPANY, 'مع خالص التحية')).not.toThrow();
  });

  test('Hindi non-empty generated cover letter passes even without a recognized sign-off', () => {
    const content = legacyFullLetter(
      'मैं इस पद के लिए आवेदन करना चाहती हूँ और अपने अनुभव के बारे में बताना चाहती हूँ।',
      'Alex Carter',
      '12 जुलाई 2026',
    );
    expect(evaluateCoverLetterExportGuard(content).pass).toBe(true);
    expect(validateCoverLetterExportContent(content, 'hi', 'Alex Carter', COMPANY, 'सादर').valid).toBe(true);
    expect(() => assertCoverLetterExportable(content, 'hi', 'Alex Carter', COMPANY, 'सादर')).not.toThrow();
  });

  test('Hindi content with previously "incomplete" endings still exports (completeness is a generation-time concern)', () => {
    const body = [
      'Tuxy की भर्ती टीम को,',
      'मैं Tuxy में सॉफ्टवेयर इंजीनियर पद के लिए आवेदन कर रही हूँ।',
      'मैंने टीम परियोजनाओं में सहयोग किया है।',
      'Tuxy एक ऐसी कंपनी है जो अपने उत्पाद',
    ].join('\n\n');
    const content = productionFullLetter(body, 'Alex Carter', '12 जुलाई 2026');
    expect(evaluateCoverLetterExportGuard(content).pass).toBe(true);
    expect(() => assertCoverLetterExportable(content, 'hi', 'Alex Carter', COMPANY, 'सादर')).not.toThrow();
  });

  test('Italian complete letter passes', () => {
    const italian = legacyFullLetter([
      'Gentile team di selezione di Tuxy,',
      'Scrivo per candidarmi al ruolo di Software Engineer. Ho esperienza nello sviluppo di applicazioni web affidabili e orientate all utente.',
      'Ho lavorato in team collaborativi, risolvendo problemi tecnici e curando la qualità del prodotto.',
      'Mi motiva l attenzione di Tuxy alla qualità dei prodotti e dei servizi, e sono entusiasta di contribuire al team.',
      'Resto disponibile per un colloquio e ringrazio per il tempo dedicato.',
      'Cordiali saluti,',
      'Mario Rossi',
    ].join('\n\n'), 'Mario Rossi', '12 luglio 2026');
    expect(validateCoverLetterExportContent(italian, 'it', 'Mario Rossi', COMPANY, 'Cordiali saluti').valid).toBe(true);
  });

  test('Spanish complete letter passes', () => {
    const spanish = legacyFullLetter([
      'Estimado equipo de contratación de Tuxy,',
      'Escribo para postularme al puesto de Software Engineer. Tengo experiencia desarrollando aplicaciones web fiables y centradas en el usuario.',
      'He trabajado en equipos colaborativos, resolviendo problemas técnicos y cuidando la calidad del producto.',
      'Me motiva el compromiso de Tuxy con la calidad de sus productos y servicios, y deseo contribuir con soluciones fiables.',
      'Quedo disponible para una entrevista y agradezco su tiempo y consideración.',
      'Atentamente,',
      'María García',
    ].join('\n\n'), 'María García', '12 de julio de 2026');
    expect(validateCoverLetterExportContent(spanish, 'es', 'María García', COMPANY, 'Atentamente').valid).toBe(true);
  });

  test('Serbian complete letter passes', () => {
    const serbian = legacyFullLetter([
      'Poštovani tim za zapošljavanje u Tuxy,',
      'Prijavljujem se za poziciju softverskog inženjera i imam praktično iskustvo u razvoju pouzdanih web aplikacija.',
      'Radio sam u timovima na rešavanju tehničkih problema i isporuci kvalitetnih funkcionalnosti.',
      'Motiviše me posvećenost Tuxy kvalitetu proizvoda i usluga i želim da doprinesem timu.',
      'Stojim na raspolaganju za intervju i zahvaljujem na izdvojenom vremenu.',
      'Srdačno,',
      'Marko Petrović',
    ].join('\n\n'), 'Marko Petrović', '12. jul 2026');
    expect(validateCoverLetterExportContent(serbian, 'sr', 'Marko Petrović', COMPANY, 'Srdačno').valid).toBe(true);
  });

  test('resolveExportCandidateName uses visible signature line when metadata is empty', () => {
    const content = productionFullLetter(assembleCoverLetterContent(VALID_ENGLISH));
    expect(resolveExportCandidateName(content, '', 'en', 'Sincerely')).toBe(CANDIDATE);
  });

  test('empty content fails', () => {
    expect(evaluateCoverLetterExportGuard('').pass).toBe(false);
    expect(evaluateCoverLetterExportGuard('').reasonCode).toBe('EXPORT_GUARD_FAIL_MISSING_CONTENT');
    expect(() => assertCoverLetterExportable('', 'en', CANDIDATE, COMPANY, 'Sincerely'))
      .toThrow(CoverLetterExportIncompleteError);
  });

  test('whitespace-only content fails', () => {
    const guard = evaluateCoverLetterExportGuard('   \n\n\t  \n  ');
    expect(guard.pass).toBe(false);
    expect(guard.reasonCode).toBe('EXPORT_GUARD_FAIL_MISSING_CONTENT');
  });

  test('raw error text fails', () => {
    const guard = evaluateCoverLetterExportGuard('Cover letter generation was incomplete. Please try again.');
    expect(guard.pass).toBe(false);
    expect(guard.reasonCode).toBe('EXPORT_GUARD_FAIL_INVALID_CONTENT');
  });

  test('raw JSON/schema error fails', () => {
    const guard = evaluateCoverLetterExportGuard(JSON.stringify({
      dateLine: 'July 12, 2026',
      greeting: 'Dear Team,',
      error: 'AI service error',
    }));
    expect(guard.pass).toBe(false);
    expect(guard.reasonCode).toBe('EXPORT_GUARD_FAIL_INVALID_CONTENT');
  });

  test('literal "undefined" or "null" content fails', () => {
    expect(evaluateCoverLetterExportGuard('undefined').pass).toBe(false);
    expect(evaluateCoverLetterExportGuard('null').pass).toBe(false);
  });
});

describe('sanitizeCoverLetterContent (structured-v4 marker removal)', () => {
  test('removes the zero-width-wrapped marker on its own line', () => {
    const content = productionFullLetter(assembleCoverLetterContent(VALID_ENGLISH));
    const sanitized = sanitizeCoverLetterContent(content);
    expect(sanitized).not.toContain('structured-v4');
    expect(sanitized).toContain('Sincerely');
    expect(sanitized).toContain(CANDIDATE);
  });

  test('removes an unwrapped marker line (any casing)', () => {
    const content = `${CANDIDATE}\n\nJuly 12, 2026\n\nSTRUCTURED-V4\nDear Team,\n\nBody text here.\n\nSincerely,\n${CANDIDATE}`;
    const sanitized = sanitizeCoverLetterContent(content);
    expect(sanitized).not.toMatch(/structured-v4/i);
  });

  test('removes a marker embedded mid-line without dropping surrounding text', () => {
    const content = `Dear Team, structured-v4 I am writing to apply.`;
    const sanitized = sanitizeCoverLetterContent(content);
    expect(sanitized).not.toMatch(/structured-v4/i);
    expect(sanitized).toContain('Dear Team,');
    expect(sanitized).toContain('I am writing to apply.');
  });

  test('leaves already-clean content untouched', () => {
    const content = legacyFullLetter(assembleCoverLetterContent(VALID_ENGLISH));
    expect(sanitizeCoverLetterContent(content)).toBe(content);
  });

  test('handles empty and non-string input gracefully', () => {
    expect(sanitizeCoverLetterContent('')).toBe('');
    // @ts-expect-error intentionally passing a non-string to verify no throw
    expect(sanitizeCoverLetterContent(undefined)).toBe(undefined);
  });

  test('does not leave a stray blank line where the marker line used to be', () => {
    const content = productionFullLetter(assembleCoverLetterContent(VALID_ENGLISH));
    const sanitized = sanitizeCoverLetterContent(content);
    expect(sanitized.startsWith('\n')).toBe(false);
  });
});

describe('computeCoverLetterPdfParagraphs (PDF source text)', () => {
  test('Hindi PDF paragraphs contain no structured-v4 marker and include सादर + candidate name', () => {
    const body = assembleCoverLetterContent({
      dateLine: '12 जुलाई 2026',
      greeting: 'Tuxy की भर्ती टीम को,',
      paragraph1: 'मैं Tuxy में सॉफ्टवेयर इंजीनियर पद के लिए आवेदन कर रही हूँ।',
      paragraph2: 'मैंने टीम परियोजनाओं में सहयोग किया है और गुणवत्ता-केंद्रित वितरण पर काम किया है।',
      paragraph3: 'Tuxy की उत्पाद गुणवत्ता मुझे प्रेरित करती है, और मैं आपकी टीम में योगदान देने के लिए उत्सुक हूँ।',
      closing: 'मैं साक्षात्कार में अपनी योग्यता पर चर्चा करने का अवसर चाहती हूँ।',
      signOff: 'सादर',
      candidateName: 'Alex Carter',
    });
    const content = productionFullLetter(body, 'Alex Carter', '12 जुलाई 2026');
    const paragraphs = computeCoverLetterPdfParagraphs(content, 'Alex Carter');
    const joined = paragraphs.join('\n');
    expect(joined).not.toMatch(/structured-v4/i);
    expect(joined).toContain('सादर');
    expect(joined).toContain('Alex Carter');
    expect(paragraphs.every((p) => p.trim().length > 0)).toBe(true);
  });

  test('English PDF paragraphs contain no structured-v4 marker and include Sincerely + candidate name', () => {
    const content = productionFullLetter(assembleCoverLetterContent(VALID_ENGLISH));
    const paragraphs = computeCoverLetterPdfParagraphs(content, CANDIDATE);
    const joined = paragraphs.join('\n');
    expect(joined).not.toMatch(/structured-v4/i);
    expect(joined).toContain('Sincerely');
    expect(joined).toContain(CANDIDATE);
  });

  test('Arabic PDF paragraphs contain no structured-v4 marker, no mojibake replacement chars, and no empty/degenerate paragraphs', () => {
    const body = assembleCoverLetterContent({
      dateLine: '12 يوليو 2026',
      greeting: 'إلى فريق التوظيف في Tuxy،',
      paragraph1: 'أتقدم بطلب للحصول على وظيفة مهندس برمجيات في Tuxy.',
      paragraph2: 'شاركت في مشاريع جماعية وحرصت على تقديم ميزات تركز على المستخدم.',
      paragraph3: 'يحفزني التزام Tuxy بجودة المنتج، وأنا متحمس للمساهمة في فريقكم.',
      closing: 'أرحب بفرصة مناقشة مؤهلاتي في مقابلة وأشكركم على وقتكم.',
      signOff: 'مع خالص التحية',
      candidateName: 'Alex Carter',
    });
    const content = productionFullLetter(body, 'Alex Carter', '12 يوليو 2026');
    const paragraphs = computeCoverLetterPdfParagraphs(content, 'Alex Carter');
    const joined = paragraphs.join('\n');
    expect(joined).not.toMatch(/structured-v4/i);
    expect(joined).not.toContain('\uFFFD'); // no mojibake replacement character
    expect(joined).toContain('مع خالص التحية');
    expect(joined).toContain('Alex Carter');
    // No degenerate near-empty paragraph (e.g. a stray marker-only line) that
    // could previously collapse to a zero-height text block and overlap siblings.
    expect(paragraphs.every((p) => p.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/gu, '').trim().length > 0)).toBe(true);
  });

  test('Spanish/Italian/Serbian PDF paragraphs remain unaffected and marker-free', () => {
    const italian = legacyFullLetter([
      'Gentile team di selezione di Tuxy,',
      'Scrivo per candidarmi al ruolo di Software Engineer.',
      'Ho lavorato in team collaborativi.',
      'Mi motiva l attenzione di Tuxy alla qualità.',
      'Resto disponibile per un colloquio.',
      'Cordiali saluti,',
      'Mario Rossi',
    ].join('\n\n'), 'Mario Rossi', '12 luglio 2026');
    const paragraphs = computeCoverLetterPdfParagraphs(italian, 'Mario Rossi');
    expect(paragraphs.join('\n')).not.toMatch(/structured-v4/i);
    expect(paragraphs.join('\n')).toContain('Cordiali saluti');
  });
});

describe('cover letter export guard integration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('PDF export path uses corrected guard for complete English letter', async () => {
    vi.doMock('../native-save', () => ({
      saveFileViaPlatform: vi.fn(async () => ({ saved: true, fileName: 'Cover Letter.pdf', destination: 'downloads' })),
    }));
    vi.doMock('@react-pdf/renderer', () => ({
      pdf: vi.fn(() => ({
        toBlob: vi.fn(async () => new Blob(['pdf'], { type: 'application/pdf' })),
      })),
    }));
    vi.doMock('react', () => ({
      createElement: vi.fn((_type, _props) => ({})),
    }));
    let capturedProps: Record<string, unknown> | undefined;
    vi.doMock('react', () => ({
      createElement: vi.fn((_type: unknown, props: unknown) => {
        capturedProps = props as Record<string, unknown>;
        return {};
      }),
    }));
    vi.doMock('../cover-letter-pdf', () => ({
      CoverLetterPDFDocument: vi.fn(),
    }));

    const { exportCoverLetterToPDF } = await import('../export');
    // Simulates a legacy draft saved with the structured-v4 marker embedded.
    const content = productionFullLetter(assembleCoverLetterContent(VALID_ENGLISH));
    expect(content).toContain('structured-v4');
    await expect(exportCoverLetterToPDF(CANDIDATE, content, 'Cover Letter', 'en', COMPANY)).resolves.toBeDefined();
    // The content actually handed to the PDF document component must be marker-free.
    expect(String(capturedProps?.content)).not.toContain('structured-v4');
  });

  test('DOCX export path uses corrected guard for complete English letter and strips the structured-v4 marker', async () => {
    let savedBlob: Blob | null = null;
    vi.doMock('../native-save', () => ({
      saveFileViaPlatform: vi.fn(async (blob: Blob) => {
        savedBlob = blob;
        return { saved: true, fileName: 'Cover Letter.docx', destination: 'downloads' };
      }),
    }));

    const { exportCoverLetterToDOCX } = await import('../export');
    // Simulates a legacy draft saved with the structured-v4 marker embedded.
    const content = productionFullLetter(assembleCoverLetterContent(VALID_ENGLISH));
    expect(content).toContain('structured-v4');
    await exportCoverLetterToDOCX(content, 'Cover Letter', CANDIDATE, 'en', COMPANY);
    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('Sincerely');
    expect(xml).toContain(CANDIDATE);
    expect(xml).not.toContain('structured-v4');
  });

  test('PDF export path allows non-empty Arabic content without a recognized sign-off', async () => {
    vi.doMock('../native-save', () => ({
      saveFileViaPlatform: vi.fn(async () => ({ saved: true, fileName: 'كوفر ليتر.pdf', destination: 'downloads' })),
    }));
    vi.doMock('../cover-letter-arabic-pdf', () => ({
      buildArabicCoverLetterPdfBlob: vi.fn(async () => new Blob(['pdf'], { type: 'application/pdf' })),
    }));

    const { exportCoverLetterToPDF } = await import('../export');
    const content = legacyFullLetter(
      'مرحبا بكم في هذه الرسالة، أكتب لأعرب عن اهتمامي بالانضمام إلى فريقكم والمساهمة بخبرتي العملية.',
      'Alex Carter',
      '12 يوليو 2026',
    );
    await expect(exportCoverLetterToPDF('Alex Carter', content, 'Cover Letter', 'ar', COMPANY)).resolves.toBeDefined();
  });

  test('PDF export path allows non-empty Hindi content without a recognized sign-off', async () => {
    vi.doMock('../native-save', () => ({
      saveFileViaPlatform: vi.fn(async () => ({ saved: true, fileName: 'कवर लेटर.pdf', destination: 'downloads' })),
    }));
    vi.doMock('@react-pdf/renderer', () => ({
      pdf: vi.fn(() => ({
        toBlob: vi.fn(async () => new Blob(['pdf'], { type: 'application/pdf' })),
      })),
    }));
    vi.doMock('react', () => ({
      createElement: vi.fn((_type, _props) => ({})),
    }));
    vi.doMock('../cover-letter-pdf', () => ({
      CoverLetterPDFDocument: vi.fn(),
    }));

    const { exportCoverLetterToPDF } = await import('../export');
    const content = legacyFullLetter(
      'मैं इस पद के लिए आवेदन करना चाहती हूँ और अपने अनुभव के बारे में बताना चाहती हूँ।',
      'Alex Carter',
      '12 जुलाई 2026',
    );
    await expect(exportCoverLetterToPDF('Alex Carter', content, 'Cover Letter', 'hi', COMPANY)).resolves.toBeDefined();
  });

  test('DOCX export path allows non-empty Arabic content without a recognized sign-off', async () => {
    vi.doMock('../native-save', () => ({
      saveFileViaPlatform: vi.fn(async () => ({ saved: true, fileName: 'كوفر ليتر.docx', destination: 'downloads' })),
    }));

    const { exportCoverLetterToDOCX } = await import('../export');
    const content = legacyFullLetter(
      'مرحبا بكم في هذه الرسالة، أكتب لأعرب عن اهتمامي بالانضمام إلى فريقكم.',
      'Alex Carter',
      '12 يوليو 2026',
    );
    await expect(exportCoverLetterToDOCX(content, 'Cover Letter', 'Alex Carter', 'ar', COMPANY)).resolves.toBeDefined();
  });

  test('DOCX export path allows non-empty Hindi content without a recognized sign-off', async () => {
    vi.doMock('../native-save', () => ({
      saveFileViaPlatform: vi.fn(async () => ({ saved: true, fileName: 'कवर लेटर.docx', destination: 'downloads' })),
    }));

    const { exportCoverLetterToDOCX } = await import('../export');
    const content = legacyFullLetter(
      'मैं इस पद के लिए आवेदन करना चाहती हूँ और अपने अनुभव के बारे में बताना चाहती हूँ।',
      'Alex Carter',
      '12 जुलाई 2026',
    );
    await expect(exportCoverLetterToDOCX(content, 'Cover Letter', 'Alex Carter', 'hi', COMPANY)).resolves.toBeDefined();
  });

  test('DOCX export path strips the structured-v4 marker for a legacy-stamped Arabic draft and keeps readable Arabic', async () => {
    let savedBlob: Blob | null = null;
    vi.doMock('../native-save', () => ({
      saveFileViaPlatform: vi.fn(async (blob: Blob) => {
        savedBlob = blob;
        return { saved: true, fileName: 'خطاب تقديم.docx', destination: 'downloads' };
      }),
    }));

    const { exportCoverLetterToDOCX } = await import('../export');
    const arabicBody = 'مرحبا بكم في هذه الرسالة، أكتب لأعرب عن اهتمامي بالانضمام إلى فريقكم.\n\nمع خالص التحية،\n\nAlex Carter';
    const content = productionFullLetter(arabicBody, 'Alex Carter', '12 يوليو 2026');
    expect(content).toContain('structured-v4');
    await exportCoverLetterToDOCX(content, 'خطاب تقديم', 'Alex Carter', 'ar', COMPANY);
    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).not.toContain('structured-v4');
    expect(xml).toContain('مع خالص التحية');
    expect(xml).toContain('Alex Carter');
  });

  test('DOCX export path strips the structured-v4 marker for a legacy-stamped Hindi draft and keeps सादर + candidate name', async () => {
    let savedBlob: Blob | null = null;
    vi.doMock('../native-save', () => ({
      saveFileViaPlatform: vi.fn(async (blob: Blob) => {
        savedBlob = blob;
        return { saved: true, fileName: 'कवर लेटर.docx', destination: 'downloads' };
      }),
    }));

    const { exportCoverLetterToDOCX } = await import('../export');
    const hindiBody = 'मैं इस पद के लिए आवेदन करना चाहती हूँ।\n\nसादर,\n\nAlex Carter';
    const content = productionFullLetter(hindiBody, 'Alex Carter', '12 जुलाई 2026');
    expect(content).toContain('structured-v4');
    await exportCoverLetterToDOCX(content, 'कवर लेटर', 'Alex Carter', 'hi', COMPANY);
    const zip = await JSZip.loadAsync(await savedBlob!.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).not.toContain('structured-v4');
    expect(xml).toContain('सादर');
    expect(xml).toContain('Alex Carter');
  });

  test('export guard no longer blocks a visibly non-empty Hindi draft with an unusual ending', async () => {
    const body = [
      'Tuxy की भर्ती टीम को,',
      'मैं Tuxy में सॉफ्टवेयर इंजीनियर पद के लिए आवेदन कर रही हूँ।',
      'मैंने टीम परियोजनाओं में सहयोग किया है।',
      'Tuxy एक ऐसी कंपनी है जो अपने उत्पाद',
    ].join('\n\n');
    const content = productionFullLetter(body, 'Alex Carter', '12 जुलाई 2026');
    expect(() => assertCoverLetterExportable(content, 'hi', 'Alex Carter', COMPANY, 'सादर')).not.toThrow();
  });

  test('empty cover letter content still throws before hitting the export pipeline', async () => {
    expect(() => assertCoverLetterExportable('', 'en', CANDIDATE, COMPANY, 'Sincerely'))
      .toThrow(CoverLetterExportIncompleteError);
  });

  test('API error text is never exported', async () => {
    expect(() => assertCoverLetterExportable('AI service is temporarily unavailable. Please try again later.', 'en', CANDIDATE, COMPANY, 'Sincerely'))
      .toThrow(CoverLetterExportIncompleteError);
  });
});
