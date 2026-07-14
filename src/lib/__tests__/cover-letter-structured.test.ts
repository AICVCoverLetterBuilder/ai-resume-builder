import { describe, expect, test, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { translations } from '../i18n/translations';
import {
  assembleCoverLetterContent,
  assertCoverLetterExportable,
  buildCoverLetterExportFilename,
  extractCoverLetterBody,
  generateStructuredCoverLetterWithRetries,
  isCoverLetterContentComplete,
  parseStructuredCoverLetterJson,
  stampCoverLetterContent,
  validateCoverLetterContent,
  validateStructuredCoverLetter,
} from '../cover-letter-generation';

const COMPANY = 'Tuxy';
const CANDIDATE = 'Alex Carter';

const VALID_HINDI = {
  dateLine: '12 जुलाई 2026',
  greeting: 'Tuxy की भर्ती टीम को,',
  paragraph1: 'मैं Tuxy में सॉफ्टवेयर इंजीनियर पद के लिए आवेदन कर रही हूँ और इस अवसर में सचमुच रुचि रखती हूँ।',
  paragraph2: 'मैं सीखने, योगदान देने और आपकी टीम के साथ आगे बढ़ने के लिए प्रेरित हूँ।',
  paragraph3: 'Tuxy की उत्पाद गुणवत्ता और ग्राहक-केंद्रित दृष्टि मुझे प्रेरित करती है, और मैं आपकी टीम में योगदान देने के लिए उत्सुक हूँ।',
  closing: 'मैं साक्षात्कार में अपनी रुचि पर चर्चा करने का अवसर चाहती हूँ और आपके समय के लिए धन्यवाद देती हूँ।',
  signOff: 'सादर',
  candidateName: CANDIDATE,
};

const INVALID_HINDI = {
  ...VALID_HINDI,
  paragraph3: 'Tuxy एक ऐसी कंपनी है जो अपने उत्पादों और सेवाओं की गुणवत्ता के प्रति प्रतिबद्ध है, और यही',
  closing: '',
  signOff: '',
  candidateName: '',
};

const VALID_ENGLISH = {
  dateLine: 'July 12, 2026',
  greeting: 'Dear Tuxy Hiring Team,',
  paragraph1: 'I am writing to apply for the Software Engineer role at Tuxy and am genuinely interested in this opportunity.',
  paragraph2: 'I am motivated to learn, contribute, and grow with your team in this role.',
  paragraph3: 'Tuxy commitment to product quality and customer focus is motivating, and I am eager to contribute to your team.',
  closing: 'I would welcome the opportunity to discuss my interest in an interview and thank you for your time and consideration.',
  signOff: 'Sincerely',
  candidateName: CANDIDATE,
};

const SPANISH_STRUCTURED = {
  dateLine: '12 de julio de 2026',
  greeting: 'Estimado equipo de contratación de Tuxy,',
  paragraph1: 'Escribo para postularme al puesto de Software Engineer. Tengo experiencia desarrollando aplicaciones web fiables y centradas en el usuario.',
  paragraph2: 'He trabajado en equipos colaborativos, resolviendo problemas técnicos y cuidando la calidad del producto.',
  paragraph3: 'Me motiva el compromiso de Tuxy con la calidad de sus productos y servicios, y deseo contribuir con soluciones fiables.',
  closing: 'Quedo disponible para una entrevista y agradezco su tiempo y consideración.',
  signOff: 'Atentamente',
  candidateName: 'María García',
};

const ITALIAN_STRUCTURED = {
  dateLine: '12 luglio 2026',
  greeting: 'Gentile team di selezione di Tuxy,',
  paragraph1: 'Scrivo per candidarmi al ruolo di Software Engineer. Ho esperienza nello sviluppo di applicazioni web affidabili e orientate all utente.',
  paragraph2: 'Ho lavorato in team collaborativi, risolvendo problemi tecnici e curando la qualità del prodotto.',
  paragraph3: 'Mi motiva l attenzione di Tuxy alla qualità dei prodotti e dei servizi, e sono entusiasta di contribuire al team.',
  closing: 'Resto disponibile per un colloquio e ringrazio per il tempo dedicato.',
  signOff: 'Cordiali saluti',
  candidateName: 'Mario Rossi',
};

function fullLetter(body: string, candidate = CANDIDATE, date = '12 जुलाई 2026'): string {
  return stampCoverLetterContent(`${candidate}\n\n${date}\n\n${body}`);
}

async function docxPlainText(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file('word/document.xml')!.async('string');
  return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

describe('structured cover letter core', () => {
  test('parses valid structured JSON', () => {
    const parsed = parseStructuredCoverLetterJson(JSON.stringify(VALID_HINDI));
    expect(parsed?.candidateName).toBe(CANDIDATE);
    expect(parsed?.signOff).toBe('सादर');
  });

  test('rejects incomplete Hindi paragraph3 ending at और यही', () => {
    const validation = validateStructuredCoverLetter(INVALID_HINDI, 'hi', CANDIDATE, COMPANY, 'सादर');
    expect(validation.valid).toBe(false);
    expect(validation.endsAtAurYahi).toBe(true);
  });

  test('rejects old broken Hindi endings', () => {
    const endings = [
      '...अपने उत्पाद',
      '...और यही',
      '...कार्य करती हूँ',
      '...गुणवत्त',
    ];
    for (const ending of endings) {
      const letter = {
        ...VALID_HINDI,
        paragraph3: `Tuxy ${ending}`,
        closing: '',
        signOff: '',
        candidateName: '',
      };
      expect(validateStructuredCoverLetter(letter, 'hi', CANDIDATE, COMPANY, 'सादर').valid).toBe(false);
    }
  });

  test('assembles complete Hindi content with sign-off and candidate name', () => {
    const body = assembleCoverLetterContent(VALID_HINDI);
    expect(body).toContain('सादर,');
    expect(body).toContain(CANDIDATE);
    expect(body).toContain('साक्षात्कार');
  });

  test('structured generation retries until valid JSON is returned', async () => {
    const calls: number[] = [];
    const result = await generateStructuredCoverLetterWithRetries({
      locale: 'hi',
      closing: 'सादर',
      candidateName: CANDIDATE,
      displayName: CANDIDATE,
      companyName: COMPANY,
      jobTitle: 'Software Engineer',
      languageName: 'Hindi',
      toneDesc: 'formal',
      variantNote: '',
      genderNote: '',
      gender: 'female',
      fallbackRole: 'पद',
      fallbackCompany: 'कंपनी',
      generate: async (attempt) => {
        calls.push(attempt);
        return attempt === 0 ? JSON.stringify(INVALID_HINDI) : JSON.stringify(VALID_HINDI);
      },
    });

    expect(calls.length).toBeGreaterThan(1);
    expect(result.letter.candidateName).toBe(CANDIDATE);
    expect(result.groundingStatus).toBe('passed');
  });

  test('structured generation fails closed when JSON never validates', async () => {
    await expect(generateStructuredCoverLetterWithRetries({
      locale: 'hi',
      closing: 'सादर',
      candidateName: CANDIDATE,
      displayName: CANDIDATE,
      companyName: COMPANY,
      jobTitle: 'Software Engineer',
      languageName: 'Hindi',
      toneDesc: 'formal',
      variantNote: '',
      genderNote: '',
      fallbackRole: 'पद',
      fallbackCompany: 'कंपनी',
      generate: async () => JSON.stringify(INVALID_HINDI),
    })).rejects.toThrow('Cover letter generation was incomplete');
  });

  test('English structured letter has no Hindi leakage', () => {
    const validation = validateStructuredCoverLetter(VALID_ENGLISH, 'en', CANDIDATE, COMPANY, 'Sincerely');
    expect(validation.valid).toBe(true);
    expect(validation.hasHindiLeakageInEnglish).toBe(false);
    expect(assembleCoverLetterContent(VALID_ENGLISH)).toContain('Sincerely,');
  });

  test('Hindi locale cannot accept English greeting body', () => {
    const letter = { ...VALID_HINDI, greeting: 'Dear Hiring Team,' };
    expect(validateStructuredCoverLetter(letter, 'hi', CANDIDATE, COMPANY, 'सादर').valid).toBe(false);
  });
});

describe('cover letter filenames and export guard', () => {
  test('Hindi filename remains कवर लेटर - Tuxy', () => {
    const name = buildCoverLetterExportFilename(translations.hi.coverLetter.filename, COMPANY);
    expect(`${name}.pdf`).toBe('कवर लेटर - Tuxy.pdf');
    expect(`${name}.docx`).toBe('कवर लेटर - Tuxy.docx');
  });

  test('Italian and Spanish filename regression', () => {
    expect(buildCoverLetterExportFilename(translations.it.coverLetter.filename, COMPANY))
      .toBe('Lettera di Presentazione - Tuxy');
    expect(buildCoverLetterExportFilename(translations.es.coverLetter.filename, COMPANY))
      .toBe('Carta de Presentacion - Tuxy');
    expect(buildCoverLetterExportFilename(translations.sr.coverLetter.filename, COMPANY))
      .toBe('Propratno Pismo - Tuxy');
  });

  // Note: the export guard is intentionally minimal and does not re-check
  // Hindi/Arabic completeness (sign-off, candidate name, incomplete endings).
  // That strict validation is covered above via `validateStructuredCoverLetter()`
  // ("rejects incomplete Hindi paragraph3 ending at और यही", "rejects old broken
  // Hindi endings") and happens before content is ever saved to `cl.content`.
  // See cover-letter-export-guard.test.ts for export-guard-specific coverage.

  test('export guard accepts complete Hindi draft', () => {
    const complete = fullLetter(assembleCoverLetterContent(VALID_HINDI));
    expect(() => assertCoverLetterExportable(complete, 'hi', CANDIDATE, COMPANY, 'सादर')).not.toThrow();
    expect(isCoverLetterContentComplete(complete, 'hi', CANDIDATE, COMPANY, 'सादर')).toBe(true);
  });
});

describe('cover letter export source completeness', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('Hindi DOCX export receives complete source text', async () => {
    let savedBlob: Blob | null = null;
    vi.doMock('../native-save', () => ({
      saveFileViaPlatform: vi.fn(async (blob: Blob) => {
        savedBlob = blob;
        return { saved: true, fileName: 'कवर लेटर - Tuxy.docx', destination: 'downloads' };
      }),
    }));

    const { exportCoverLetterToDOCX } = await import('../export');
    const content = fullLetter(assembleCoverLetterContent(VALID_HINDI));
    await exportCoverLetterToDOCX(
      content,
      buildCoverLetterExportFilename(translations.hi.coverLetter.filename, COMPANY),
      CANDIDATE,
      'hi',
      COMPANY,
    );

    const text = await docxPlainText(savedBlob!);
    expect(text).toContain('सादर');
    expect(text).toContain(CANDIDATE);
    expect(text).toContain('साक्षात्कार');
    expect(text).not.toContain('structured-v4');
  });

  test('PDF/DOCX source preprocessing keeps complete Hindi closing/sign-off/name', () => {
    const content = fullLetter(assembleCoverLetterContent(VALID_HINDI));
    const body = extractCoverLetterBody(content, CANDIDATE);
    expect(validateCoverLetterContent(content, 'hi', CANDIDATE, COMPANY, 'सादर').valid).toBe(true);
    expect(body).toContain('सादर,');
    expect(body).toContain(CANDIDATE);
  });

  test('Spanish and Italian assembled content remains structurally complete', () => {
    const spanish = fullLetter(assembleCoverLetterContent(SPANISH_STRUCTURED), 'María García', '12 de julio de 2026');
    const italian = fullLetter(assembleCoverLetterContent(ITALIAN_STRUCTURED), 'Mario Rossi', '12 luglio 2026');
    expect(validateCoverLetterContent(spanish, 'es', 'María García', COMPANY, 'Atentamente').valid).toBe(true);
    expect(validateCoverLetterContent(italian, 'it', 'Mario Rossi', COMPANY, 'Cordiali saluti').valid).toBe(true);
  });
});
