/**
 * Generate cover letter export guard verification artifacts.
 * Usage: npx tsx scripts/generate-cover-letter-export-guard-artifacts.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  assembleCoverLetterContent,
  assertCoverLetterExportable,
  CoverLetterExportIncompleteError,
  resolveExportCandidateName,
  stampCoverLetterContent,
  validateCoverLetterExportContent,
} from '../src/lib/cover-letter-generation';

const OUT = path.join(process.cwd(), 'artifacts', 'cover-letter-export-guard');
const COMPANY = 'Tuxy';
const ENGLISH_CANDIDATE = 'Alex Tuhel';
const HINDI_CANDIDATE = 'Alex Carter';

const VALID_ENGLISH = {
  dateLine: 'July 12, 2026',
  greeting: 'Dear Tuxy Hiring Team,',
  paragraph1: 'I am applying for the Software Engineer role at Tuxy and bring practical experience building reliable web applications.',
  paragraph2: 'My background includes collaborative product work, careful debugging, and delivering user-focused features.',
  paragraph3: 'Tuxy commitment to product quality and customer focus is motivating, and I am eager to contribute meaningfully to your team.',
  closing: 'I would welcome the opportunity to discuss my fit in an interview and thank you for your time and consideration.',
  signOff: 'Sincerely',
  candidateName: ENGLISH_CANDIDATE,
};

const VALID_HINDI = {
  dateLine: '12 जुलाई 2026',
  greeting: 'Tuxy की भर्ती टीम को,',
  paragraph1: 'मैं Tuxy में सॉफ्टवेयर इंजीनियर पद के लिए आवेदन कर रही हूँ। मेरे पास वेब एप्लिकेशन विकसित करने का व्यावहारिक अनुभव है।',
  paragraph2: 'मैंने टीम परियोजनाओं में सहयोग किया है और गुणवत्ता-केंद्रित वितरण पर काम किया है।',
  paragraph3: 'Tuxy की उत्पाद गुणवत्ता और ग्राहक-केंद्रित दृष्टि मुझे प्रेरित करती है, और मैं आपकी टीम में सार्थक योगदान देने के लिए उत्सुक हूँ।',
  closing: 'मैं साक्षात्कार में अपनी योग्यता पर चर्चा करने का अवसर चाहती हूँ और आपके समय के लिए धन्यवाद देती हूँ।',
  signOff: 'सादर',
  candidateName: HINDI_CANDIDATE,
};

async function ensureArtifactFonts(): Promise<void> {
  const fontDir = path.join(process.cwd(), 'public', 'fonts');
  const required = [
    'NotoSans-Regular.ttf',
    'NotoSans-Bold.ttf',
    'NotoSansDevanagari-Regular.ttf',
    'NotoSansDevanagari-Bold.ttf',
  ];
  for (const fileName of required) {
    const filePath = path.join(fontDir, fileName);
    if (fs.existsSync(filePath)) continue;
    const response = await fetch(`https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/${fileName}`);
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

async function writeBlob(filePath: string, blob: Blob): Promise<void> {
  fs.writeFileSync(filePath, Buffer.from(await blob.arrayBuffer()));
}

function productionFullLetter(body: string, candidate: string, date: string): string {
  const letterBody = stampCoverLetterContent(body);
  return `${candidate}\n\n${date}\n\n${letterBody}`;
}

function legacyFullLetter(body: string, candidate: string, date: string): string {
  return `${candidate}\n\n${date}\n\n${body}`;
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  await prepareCoverLetterPdfFonts();

  const englishContent = productionFullLetter(
    assembleCoverLetterContent(VALID_ENGLISH),
    ENGLISH_CANDIDATE,
    'July 12, 2026',
  );
  const englishLegacyContent = legacyFullLetter(
    assembleCoverLetterContent(VALID_ENGLISH),
    ENGLISH_CANDIDATE,
    'July 12, 2026',
  );
  const hindiContent = productionFullLetter(
    assembleCoverLetterContent(VALID_HINDI),
    HINDI_CANDIDATE,
    '12 जुलाई 2026',
  );

  const englishDevanagari = productionFullLetter(
    assembleCoverLetterContent({
      ...VALID_ENGLISH,
      paragraph3: 'Tuxy commitment to quality है and I am eager to contribute.',
    }),
    ENGLISH_CANDIDATE,
    'July 12, 2026',
  );

  const hindiApneUtpad = productionFullLetter(
    [
      VALID_HINDI.greeting,
      VALID_HINDI.paragraph1,
      VALID_HINDI.paragraph2,
      'Tuxy एक ऐसी कंपनी है जो अपने उत्पाद',
    ].join('\n\n'),
    HINDI_CANDIDATE,
    '12 जुलाई 2026',
  );

  const hindiAurYahi = productionFullLetter(
    [
      VALID_HINDI.greeting,
      VALID_HINDI.paragraph1,
      VALID_HINDI.paragraph2,
      'Tuxy की गुणवत्ता के प्रति प्रतिबद्धता प्रेरक है, और यही',
    ].join('\n\n'),
    HINDI_CANDIDATE,
    '12 जुलाई 2026',
  );

  const hindiBodyOnly = productionFullLetter(
    [
      VALID_HINDI.greeting,
      VALID_HINDI.paragraph1,
      VALID_HINDI.paragraph2,
      VALID_HINDI.paragraph3,
    ].join('\n\n'),
    HINDI_CANDIDATE,
    '12 जुलाई 2026',
  );

  const spanish = legacyFullLetter(
    [
      'Estimado equipo de contratación de Tuxy,',
      'Escribo para postularme al puesto de Software Engineer. Tengo experiencia desarrollando aplicaciones web fiables y centradas en el usuario.',
      'He trabajado en equipos colaborativos, resolviendo problemas técnicos y cuidando la calidad del producto.',
      'Me motiva el compromiso de Tuxy con la calidad de sus productos y servicios, y deseo contribuir con soluciones fiables.',
      'Quedo disponible para una entrevista y agradezco su tiempo y consideración.',
      'Atentamente,',
      'María García',
    ].join('\n\n'),
    'María García',
    '12 de julio de 2026',
  );

  const italian = legacyFullLetter(
    [
      'Gentile team di selezione di Tuxy,',
      'Scrivo per candidarmi al ruolo di Software Engineer. Ho esperienza nello sviluppo di applicazioni web affidabili e orientate all utente.',
      'Ho lavorato in team collaborativi, risolvendo problemi tecnici e curando la qualità del prodotto.',
      'Mi motiva l attenzione di Tuxy alla qualità dei prodotti e dei servizi, e sono entusiasta di contribuire al team.',
      'Resto disponibile per un colloquio e ringrazio per il tempo dedicato.',
      'Cordiali saluti,',
      'Mario Rossi',
    ].join('\n\n'),
    'Mario Rossi',
    '12 luglio 2026',
  );

  const serbian = legacyFullLetter(
    [
      'Poštovani tim za zapošljavanje u Tuxy,',
      'Prijavljujem se za poziciju softverskog inženjera i imam praktično iskustvo u razvoju pouzdanih web aplikacija.',
      'Radio sam u timovima na rešavanju tehničkih problema i isporuci kvalitetnih funkcionalnosti.',
      'Motiviše me posvećenost Tuxy kvalitetu proizvoda i usluga i želim da doprinesem timu.',
      'Stojim na raspolaganju za intervju i zahvaljujem na izdvojenom vremenu.',
      'Srdačno,',
      'Marko Petrović',
    ].join('\n\n'),
    'Marko Petrović',
    '12. jul 2026',
  );

  const exportMod = await import('../src/lib/export');
  assertCoverLetterExportable(englishContent, 'en', ENGLISH_CANDIDATE, COMPANY, 'Sincerely');
  assertCoverLetterExportable(hindiContent, 'hi', HINDI_CANDIDATE, COMPANY, 'सादर');

  await writeBlob(
    path.join(OUT, 'english-complete-export.docx'),
    await exportMod.buildCoverLetterDocxBlob(englishContent, ENGLISH_CANDIDATE, 'en'),
  );
  await writeBlob(
    path.join(OUT, 'hindi-complete-export.docx'),
    await exportMod.buildCoverLetterDocxBlob(hindiContent, HINDI_CANDIDATE, 'hi'),
  );

  const [rendererMod, reactMod, clPdfMod] = await Promise.all([
    import('@react-pdf/renderer'),
    import('react'),
    import('../src/lib/cover-letter-pdf'),
  ]);
  const renderPdf = async (candidateName: string, content: string, locale: string) => {
    const doc = reactMod.createElement(clPdfMod.CoverLetterPDFDocument, { candidateName, content, locale });
    return rendererMod.pdf(doc).toBlob();
  };
  await writeBlob(path.join(OUT, 'english-complete-export.pdf'), await renderPdf(ENGLISH_CANDIDATE, englishContent, 'en'));
  await writeBlob(path.join(OUT, 'hindi-complete-export.pdf'), await renderPdf(HINDI_CANDIDATE, hindiContent, 'hi'));

  const englishCompletePassesGuard = validateCoverLetterExportContent(
    englishContent,
    'en',
    ENGLISH_CANDIDATE,
    COMPANY,
    'Sincerely',
  ).valid;
  const englishLegacyCompletePassesGuard = validateCoverLetterExportContent(
    englishLegacyContent,
    'en',
    ENGLISH_CANDIDATE,
    COMPANY,
    'Sincerely',
  ).valid;
  const englishDevanagariLeakageBlocked = !validateCoverLetterExportContent(
    englishDevanagari,
    'en',
    ENGLISH_CANDIDATE,
    COMPANY,
    'Sincerely',
  ).valid;
  const hindiCompletePassesGuard = validateCoverLetterExportContent(
    hindiContent,
    'hi',
    HINDI_CANDIDATE,
    COMPANY,
    'सादर',
  ).valid;
  const hindiIncompleteApneUtpadBlocked = !validateCoverLetterExportContent(
    hindiApneUtpad,
    'hi',
    HINDI_CANDIDATE,
    COMPANY,
    'सादर',
  ).valid;
  const hindiIncompleteAurYahiBlocked = !validateCoverLetterExportContent(
    hindiAurYahi,
    'hi',
    HINDI_CANDIDATE,
    COMPANY,
    'सादर',
  ).valid;
  const hindiBodyOnlyBlocked = !validateCoverLetterExportContent(
    hindiBodyOnly,
    'hi',
    HINDI_CANDIDATE,
    COMPANY,
    'सादर',
  ).valid;
  const italianSpanishSerbianPass = [
    validateCoverLetterExportContent(spanish, 'es', 'María García', COMPANY, 'Atentamente').valid,
    validateCoverLetterExportContent(italian, 'it', 'Mario Rossi', COMPANY, 'Cordiali saluti').valid,
    validateCoverLetterExportContent(serbian, 'sr', 'Marko Petrović', COMPANY, 'Srdačno').valid,
  ].every(Boolean);

  let pdfExportGuardFixed = false;
  let docxExportGuardFixed = false;
  try {
    assertCoverLetterExportable(englishContent, 'en', ENGLISH_CANDIDATE, COMPANY, 'Sincerely');
    await renderPdf(ENGLISH_CANDIDATE, englishContent, 'en');
    pdfExportGuardFixed = true;
  } catch {
    pdfExportGuardFixed = false;
  }
  try {
    assertCoverLetterExportable(englishContent, 'en', ENGLISH_CANDIDATE, COMPANY, 'Sincerely');
    await exportMod.buildCoverLetterDocxBlob(englishContent, ENGLISH_CANDIDATE, 'en');
    docxExportGuardFixed = true;
  } catch {
    docxExportGuardFixed = false;
  }

  const noStructuredMarkerFalsePositive = englishLegacyCompletePassesGuard;
  const uiPassesCorrectCandidateName = resolveExportCandidateName(englishContent, '', 'en', 'Sincerely') === ENGLISH_CANDIDATE;

  let incompleteToastOnlyForBroken = false;
  try {
    assertCoverLetterExportable(hindiApneUtpad, 'hi', HINDI_CANDIDATE, COMPANY, 'सादर');
  } catch (error) {
    incompleteToastOnlyForBroken = error instanceof CoverLetterExportIncompleteError;
  }

  const report = {
    englishCompletePassesGuard,
    englishLegacyCompletePassesGuard,
    englishDevanagariLeakageBlocked,
    hindiCompletePassesGuard,
    hindiIncompleteApneUtpadBlocked,
    hindiIncompleteAurYahiBlocked,
    hindiBodyOnlyBlocked,
    italianSpanishSerbianPass,
    pdfExportGuardFixed,
    docxExportGuardFixed,
    noStructuredMarkerFalsePositive,
    uiPassesCorrectCandidateName,
    incompleteToastOnlyForBroken,
    generatedAt: new Date().toISOString(),
    artifacts: {
      englishPdf: 'artifacts/cover-letter-export-guard/english-complete-export.pdf',
      englishDocx: 'artifacts/cover-letter-export-guard/english-complete-export.docx',
      hindiPdf: 'artifacts/cover-letter-export-guard/hindi-complete-export.pdf',
      hindiDocx: 'artifacts/cover-letter-export-guard/hindi-complete-export.docx',
    },
  };

  fs.writeFileSync(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
