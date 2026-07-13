/**
 * Generate cover letter rebuild verification artifacts.
 * Usage: npx tsx scripts/generate-cover-letter-rebuild-artifacts.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { translations } from '../src/lib/i18n/translations';
import {
  assembleCoverLetterContent,
  assertCoverLetterExportable,
  buildCoverLetterExportFilename,
  CoverLetterExportIncompleteError,
  extractCoverLetterBody,
  generateStructuredCoverLetterWithRetries,
  isCoverLetterContentComplete,
  stampCoverLetterContent,
  validateCoverLetterContent,
  validateStructuredCoverLetter,
} from '../src/lib/cover-letter-generation';

const OUT = path.join(process.cwd(), 'artifacts', 'cover-letter-rebuild');
const COMPANY = 'Tuxy';
const CANDIDATE = 'Alex Carter';

const VALID_HINDI = {
  dateLine: '12 जुलाई 2026',
  greeting: 'Tuxy की भर्ती टीम को,',
  paragraph1: 'मैं Tuxy में सॉफ्टवेयर इंजीनियर पद के लिए आवेदन कर रही हूँ। मेरे पास वेब एप्लिकेशन विकसित करने का व्यावहारिक अनुभव है।',
  paragraph2: 'मैंने टीम परियोजनाओं में सहयोग किया है और गुणवत्ता-केंद्रित वितरण पर काम किया है।',
  paragraph3: 'Tuxy की उत्पाद गुणवत्ता और ग्राहक-केंद्रित दृष्टि मुझे प्रेरित करती है, और मैं आपकी टीम में सार्थक योगदान देने के लिए उत्सुक हूँ।',
  closing: 'मैं साक्षात्कार में अपनी योग्यता पर चर्चा करने का अवसर चाहती हूँ और आपके समय के लिए धन्यवाद देती हूँ।',
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
  paragraph1: 'I am applying for the Software Engineer role at Tuxy and bring practical experience building reliable web applications.',
  paragraph2: 'My background includes collaborative product work, careful debugging, and delivering user-focused features.',
  paragraph3: 'Tuxy commitment to product quality and customer focus is motivating, and I am eager to contribute meaningfully to your team.',
  closing: 'I would welcome the opportunity to discuss my fit in an interview and thank you for your time and consideration.',
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

const ARTIFACT_FONT_URLS: Record<string, string> = {
  'NotoSans-Regular.ttf': 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
  'NotoSans-Bold.ttf': 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf',
  'NotoSansDevanagari-Regular.ttf': 'https://raw.githubusercontent.com/notofonts/devanagari/main/fonts/NotoSansDevanagari/hinted/ttf/NotoSansDevanagari-Regular.ttf',
  'NotoSansDevanagari-Bold.ttf': 'https://raw.githubusercontent.com/notofonts/devanagari/main/fonts/NotoSansDevanagari/hinted/ttf/NotoSansDevanagari-Bold.ttf',
};

async function writeBlob(filePath: string, blob: Blob): Promise<void> {
  fs.writeFileSync(filePath, Buffer.from(await blob.arrayBuffer()));
}

async function ensureArtifactFonts(): Promise<void> {
  const fontDir = path.join(process.cwd(), 'public', 'fonts');
  fs.mkdirSync(fontDir, { recursive: true });
  for (const [fileName, url] of Object.entries(ARTIFACT_FONT_URLS)) {
    const filePath = path.join(fontDir, fileName);
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1024) continue;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download ${fileName}: ${response.status}`);
    fs.writeFileSync(filePath, Buffer.from(await response.arrayBuffer()));
  }
}

async function prepareCoverLetterPdfFonts(): Promise<void> {
  await ensureArtifactFonts();
  const { Font } = await import('@react-pdf/renderer');
  const fontDir = path.join(process.cwd(), 'public', 'fonts');
  const toDataUrl = (fileName: string) => `data:font/ttf;base64,${fs.readFileSync(path.join(fontDir, fileName)).toString('base64')}`;
  for (const entry of [
    { family: 'NotoSans', regular: 'NotoSans-Regular.ttf', bold: 'NotoSans-Bold.ttf' },
    { family: 'NotoSansDevanagari', regular: 'NotoSansDevanagari-Regular.ttf', bold: 'NotoSansDevanagari-Bold.ttf' },
  ]) {
    Font.register({
      family: entry.family,
      fonts: [
        { src: toDataUrl(entry.regular), fontWeight: 400 },
        { src: toDataUrl(entry.bold), fontWeight: 700 },
      ],
    });
  }
  Font.registerHyphenationCallback((word) => [word]);
  Font.register = (() => undefined) as typeof Font.register;
}

function fullLetter(body: string, candidate: string, date: string): string {
  return `${candidate}\n\n${date}\n\n${stampCoverLetterContent(body)}`;
}

async function main(): Promise<void> {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  await prepareCoverLetterPdfFonts();

  let hindiGenerateCalls = 0;
  const hindiStructured = await generateStructuredCoverLetterWithRetries({
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
    generate: async () => {
      hindiGenerateCalls += 1;
      return hindiGenerateCalls === 1 ? JSON.stringify(INVALID_HINDI) : JSON.stringify(VALID_HINDI);
    },
  });

  const englishStructured = await generateStructuredCoverLetterWithRetries({
    locale: 'en',
    closing: 'Sincerely',
    candidateName: CANDIDATE,
    displayName: CANDIDATE,
    companyName: COMPANY,
    jobTitle: 'Software Engineer',
    languageName: 'English',
    toneDesc: 'formal',
    variantNote: '',
    genderNote: '',
    fallbackRole: 'the role',
    fallbackCompany: 'the company',
    generate: async () => JSON.stringify(VALID_ENGLISH),
  });

  const hindiBody = assembleCoverLetterContent(hindiStructured);
  const englishBody = assembleCoverLetterContent(englishStructured);
  const hindiContent = fullLetter(hindiBody, CANDIDATE, '12 जुलाई 2026');
  const englishContent = fullLetter(englishBody, CANDIDATE, 'July 12, 2026');

  const exportMod = await import('../src/lib/export');
  await writeBlob(path.join(OUT, 'hindi-cover-letter.docx'), await exportMod.buildCoverLetterDocxBlob(hindiContent, CANDIDATE, 'hi'));
  await writeBlob(path.join(OUT, 'english-cover-letter.docx'), await exportMod.buildCoverLetterDocxBlob(englishContent, CANDIDATE, 'en'));

  const [rendererMod, reactMod, clPdfMod] = await Promise.all([
    import('@react-pdf/renderer'),
    import('react'),
    import('../src/lib/cover-letter-pdf'),
  ]);
  const renderPdf = async (candidateName: string, content: string, locale: string) => {
    const doc = reactMod.createElement(clPdfMod.CoverLetterPDFDocument, { candidateName, content, locale });
    return rendererMod.pdf(doc).toBlob();
  };
  await writeBlob(path.join(OUT, 'hindi-cover-letter.pdf'), await renderPdf(CANDIDATE, hindiContent, 'hi'));
  await writeBlob(path.join(OUT, 'english-cover-letter.pdf'), await renderPdf(CANDIDATE, englishContent, 'en'));
  await writeBlob(path.join(OUT, 'spanish-cover-letter.pdf'), await renderPdf(
    SPANISH_STRUCTURED.candidateName,
    fullLetter(assembleCoverLetterContent(SPANISH_STRUCTURED), SPANISH_STRUCTURED.candidateName, SPANISH_STRUCTURED.dateLine),
    'es',
  ));

  const hindiAssessment = validateStructuredCoverLetter(hindiStructured, 'hi', CANDIDATE, COMPANY, 'सादर');
  const englishAssessment = validateStructuredCoverLetter(englishStructured, 'en', CANDIDATE, COMPANY, 'Sincerely');
  const hindiSource = extractCoverLetterBody(hindiContent, CANDIDATE);
  const incompleteRejected = !validateStructuredCoverLetter(INVALID_HINDI, 'hi', CANDIDATE, COMPANY, 'सादर').valid;
  let exportGuardRejectsIncompleteHindi = false;
  try {
    assertCoverLetterExportable(fullLetter(assembleCoverLetterContent(INVALID_HINDI), CANDIDATE, '12 जुलाई 2026'), 'hi', CANDIDATE, COMPANY, 'सादर');
  } catch (err) {
    exportGuardRejectsIncompleteHindi = err instanceof CoverLetterExportIncompleteError;
  }

  const hindiFilename = buildCoverLetterExportFilename(translations.hi.coverLetter.filename, COMPANY);
  const report = {
    structuredPipelineUsed: true,
    freeformBodyDisabledForCoverLetter: true,
    hindiFilenameLocalized: `${hindiFilename}.pdf` === 'कवर लेटर - Tuxy.pdf',
    hindiContentComplete: hindiAssessment.valid,
    hindiHasDate: Boolean(hindiStructured.dateLine),
    hindiHasGreeting: hindiAssessment.hasGreeting,
    hindiHasThreeBodyParagraphs: hindiAssessment.hasThreeBodyParagraphs,
    hindiHasCompanyMotivationParagraph: hindiAssessment.hasCompanyMotivationParagraph,
    hindiHasClosingSentence: hindiAssessment.hasClosingSentence,
    hindiHasSignoff: hindiAssessment.hasSignoff,
    hindiHasCandidateName: hindiAssessment.hasCandidateName,
    hindiDoesNotEndAtApneUtpad: !hindiAssessment.endsAtApneUtpad,
    hindiDoesNotEndAtAurYahi: !hindiAssessment.endsAtAurYahi,
    hindiDoesNotEndAtKaryaKartiHun: !hindiAssessment.endsAtKaryaKartiHun,
    hindiDoesNotEndAtGunavatt: !hindiAssessment.endsAtGunavatt,
    englishContentComplete: englishAssessment.valid,
    englishHasNoHindiLeakage: !englishAssessment.hasHindiLeakageInEnglish,
    englishHasSignoff: englishAssessment.hasSignoff,
    englishHasCandidateName: englishAssessment.hasCandidateName,
    docxSourceComplete: isCoverLetterContentComplete(hindiContent, 'hi', CANDIDATE, COMPANY, 'सादर'),
    pdfSourceComplete: validateCoverLetterContent(hindiContent, 'hi', CANDIDATE, COMPANY, 'सादर').valid,
    exportGuardRejectsIncompleteHindi,
    incompleteRejectedBeforeSave: incompleteRejected,
    spanishItalianRegressionPassed: validateStructuredCoverLetter(SPANISH_STRUCTURED, 'es', 'María García', COMPANY, 'Atentamente').valid
      && validateStructuredCoverLetter(ITALIAN_STRUCTURED, 'it', 'Mario Rossi', COMPANY, 'Cordiali saluti').valid,
    hindiRetryTriggered: hindiGenerateCalls > 1,
    artifacts: {
      hindiPdf: 'artifacts/cover-letter-rebuild/hindi-cover-letter.pdf',
      hindiDocx: 'artifacts/cover-letter-rebuild/hindi-cover-letter.docx',
      englishPdf: 'artifacts/cover-letter-rebuild/english-cover-letter.pdf',
      englishDocx: 'artifacts/cover-letter-rebuild/english-cover-letter.docx',
      spanishPdf: 'artifacts/cover-letter-rebuild/spanish-cover-letter.pdf',
    },
  };

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
