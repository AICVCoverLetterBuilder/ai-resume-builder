/**
 * Deterministic post-generation grounding validation for cover letters (all locales).
 */
import type { StructuredCoverLetter } from './cover-letter-generation';
import {
  factSetAllowsLeadership,
  type CoverLetterFactSet,
} from './cover-letter-facts';
import type { Locale } from '@/lib/i18n/translations';
import type { Tone } from '@/lib/types';
import {
  normalizeCoverLetterGender,
  type CoverLetterGender,
} from './cover-letter-gender';
import { collectGenderAndSelfCorrectionViolations } from './cover-letter-gender-validation';

/**
 * Known English role titles with an explicit, tested Serbian genitive form
 * after "za poziciju". Do not invent endings for other Latin titles.
 */
const SERBIAN_GENITIVE_AFTER_POZICIJU: Readonly<Record<string, string>> = {
  'android tester': 'Android testera',
  vozač: 'vozača',
  vozac: 'vozača',
};

function normalizeSerbianRoleKey(role: string): string {
  return role.trim().toLowerCase().replace(/\s+/g, ' ');
}

function looksLikeForeignLatinRole(role: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9 +\-/]*$/.test(role.trim());
}

/**
 * Phrase after "za " for Serbian applications.
 * - Known exception: Android tester → poziciju Android testera
 * - Unknown English titles: poziciju „Teacher“ (exact value, no invented case ending)
 */
export function serbianPozicijuRolePhrase(role: string): string {
  const trimmed = role.trim();
  if (!trimmed) return 'ovu poziciju';
  const declined = SERBIAN_GENITIVE_AFTER_POZICIJU[normalizeSerbianRoleKey(trimmed)];
  if (declined) return `poziciju ${declined}`;
  // Quote unknown Latin / multiword titles — never partially decline the first word.
  if (looksLikeForeignLatinRole(trimmed) || /\s/.test(trimmed)) {
    return `poziciju „${trimmed}“`;
  }
  return `poziciju ${trimmed}`;
}

/**
 * Phrase after "u " for Serbian role references (e.g. "u ulozi „Teacher“").
 * Preserves the exact supplied foreign title; does not invent Serbian case endings.
 */
export function serbianUloziRolePhrase(role: string): string {
  const trimmed = role.trim();
  if (!trimmed) return 'ulozi';
  if (looksLikeForeignLatinRole(trimmed)) return `ulozi „${trimmed}“`;
  return `ulozi ${trimmed}`;
}

/**
 * Accusative role phrase (e.g. "ulogu „Teacher“") for Serbian fallbacks.
 * Known exception: Android tester → ulogu Android testera.
 */
export function serbianUloguRolePhrase(role: string): string {
  const trimmed = role.trim();
  if (!trimmed) return 'ovu ulogu';
  const declined = SERBIAN_GENITIVE_AFTER_POZICIJU[normalizeSerbianRoleKey(trimmed)];
  if (declined) return `ulogu ${declined}`;
  if (looksLikeForeignLatinRole(trimmed)) return `ulogu „${trimmed}“`;
  return `ulogu ${trimmed}`;
}

/**
 * Known Croatian genitive forms after "za poziciju". Empty by default —
 * unknown/raw titles must stay exact and quoted (never partial decline).
 */
const CROATIAN_GENITIVE_AFTER_POZICIJU: Readonly<Record<string, string>> = {};

/**
 * Phrase after "za " for Croatian applications.
 * Unknown/raw titles (including multiword) keep the exact supplied spelling in „…“.
 */
export function croatianPozicijuRolePhrase(role: string): string {
  const trimmed = role.trim();
  if (!trimmed) return 'ovu poziciju';
  const declined = CROATIAN_GENITIVE_AFTER_POZICIJU[normalizeSerbianRoleKey(trimmed)];
  if (declined) return `poziciju ${declined}`;
  return `poziciju „${trimmed}“`;
}

/** Optional natural Croatian gloss; exact supplied title always remains visible separately. */
function croatianOptionalRoleGloss(role: string): string {
  const t = role.trim();
  if (
    /^saradnik za podršku klijentima logistike$/i.test(t)
    || /^saradnik za podršku klijentima u logistici$/i.test(t)
  ) {
    return ' (suradnik za podršku korisnicima u logistici)';
  }
  return '';
}

/** Keep exact title; add a natural pt-BR explanation only for known support/logistics wording. */
export function portugueseBrRoleReference(
  role: string,
  gender: CoverLetterGender = 'unspecified',
): string {
  const trimmed = role.trim();
  if (!trimmed) return 'a vaga';
  if (
    /^saradnik za podršku klijentima logistike$/i.test(trimmed)
    || /^saradnik za podršku klijentima u logistici$/i.test(trimmed)
    || /\b(?:customer|client) support\b.*\blogistic/i.test(trimmed)
    || /\bsupport(?:o)? (?:ao|a|para) cliente\b.*\blog[ií]stic/i.test(trimmed)
  ) {
    const label = gender === 'female' ? 'Colaboradora' : 'Colaborador';
    return `${trimmed} (${label} de suporte ao cliente na área de logística)`;
  }
  return trimmed;
}

function serbianConfidentFallbackParts(
  role: string,
  company: string,
  gender: CoverLetterGender,
  extraSentence: string,
): { paragraph1: string; paragraph2: string; paragraph3: string } {
  const poziciju = serbianPozicijuRolePhrase(role);
  const ulogu = serbianUloguRolePhrase(role);
  const ulozi = serbianUloziRolePhrase(role);

  if (gender === 'female') {
    return {
      paragraph1: `Ovim putem se prijavljujem za ${poziciju} u kompaniji ${company}. Motivisana sam da se posvetim zahtevima ove uloge, brzo usvojim potrebna znanja i odgovorno doprinesem radu vašeg tima.`,
      paragraph2: extraSentence
        || `Ovu priliku vidim kao značajan naredni korak i spremna sam da joj pristupim sa ozbiljnošću, posvećenošću i jasnom željom za profesionalnim razvojem. Kompanija ${company} privlači me kao okruženje u kojem bih mogla da učim, razvijam se i doprinosim zajedničkim ciljevima u ${ulozi}.`,
      paragraph3:
        `Rado bih na razgovoru detaljnije predstavila svoju motivaciju za ${ulogu}. Dostupna sam u terminu koji vama odgovara.`,
    };
  }

  if (gender === 'male') {
    return {
      paragraph1: `Ovim putem se prijavljujem za ${poziciju} u kompaniji ${company}. Motivisan sam da se posvetim zahtevima ove uloge, brzo usvojim potrebna znanja i odgovorno doprinesem radu vašeg tima.`,
      paragraph2: extraSentence
        || `Ovu priliku vidim kao značajan naredni korak i spreman sam da joj pristupim sa ozbiljnošću, posvećenošću i jasnom željom za profesionalnim razvojem. Kompanija ${company} privlači me kao okruženje u kojem bih mogao da učim, razvijam se i doprinosim zajedničkim ciljevima u ${ulozi}.`,
      paragraph3:
        `Rado bih na razgovoru detaljnije predstavio svoju motivaciju za ${ulogu}. Dostupan sam u terminu koji vama odgovara.`,
    };
  }

  return {
    paragraph1: `Ovim putem se prijavljujem za ${poziciju} u kompaniji ${company}. Želim da se posvetim zahtevima ove uloge, brzo usvojim potrebna znanja i odgovorno doprinesem radu vašeg tima.`,
    paragraph2: extraSentence
      || `Ovu priliku vidim kao značajan naredni korak i pristupiću joj sa ozbiljnošću, posvećenošću i jasnom željom za profesionalnim razvojem. Kompanija ${company} privlači me kao okruženje u kojem mogu da učim, razvijam se i doprinosim zajedničkim ciljevima u ${ulozi}.`,
    paragraph3:
      `Na razgovoru mogu detaljnije predstaviti svoju motivaciju za ${ulogu}. Razgovor je moguće dogovoriti u terminu koji vama odgovara.`,
  };
}

function normalizeTone(raw: unknown): Tone {
  if (raw === 'confident' || raw === 'friendly' || raw === 'formal') return raw;
  return 'formal';
}

export type GroundingViolationKind =
  | 'numeric_claim'
  | 'named_skill_or_tool'
  | 'leadership_claim'
  | 'achievement_claim'
  | 'experience_strength_claim'
  | 'meta_or_system_wording'
  | 'personality_claim'
  | 'unsupported_company_claim'
  | 'unsupported_company_attribute'
  | 'locale_quality'
  | 'role_inferred_duty'
  | 'gender_placeholder'
  | 'self_correction_leak'
  | 'gender_form_mismatch';

export type GroundingViolation = {
  kind: GroundingViolationKind;
  matched: string;
  evidence?: string;
};

export type GroundingValidationResult = {
  valid: boolean;
  violations: GroundingViolation[];
};

const NAMED_TECH = [
  'javascript',
  'typescript',
  'python',
  '\\bjava\\b',
  'c\\+\\+',
  'c#',
  'golang',
  '\\bgo\\b',
  '\\brust\\b',
  'kotlin',
  'swift',
  '\\bruby\\b',
  '\\bphp\\b',
  'scala',
  'perl',
  'react',
  'angular',
  'vue(?:\\.js)?',
  'node(?:\\.js)?',
  'django',
  'flask',
  'spring',
  '\\.net',
  '\\bsql\\b',
  'mysql',
  'postgresql',
  'mongodb',
  'redis',
  '\\baws\\b',
  'azure',
  '\\bgcp\\b',
  'google cloud',
  'docker',
  'kubernetes',
  'devops',
  'ci/?cd',
  'continuous integration',
  '\\bagile\\b',
  '\\bscrum\\b',
  'kanban',
  '\\boop\\b',
  'object[- ]oriented',
  '\\bcrm\\b',
  '\\berp\\b',
  'salesforce',
  '\\bsap\\b',
  'tableau',
  'power bi',
  '\\bexcel\\b',
  'frontend',
  'front[- ]end',
  'backend',
  'back[- ]end',
  'full[- ]?stack',
  'web[- ]applications?',
  'web development',
  'database(?:s)?',
  'database management',
  'cloud systems?',
  'cloud infrastructure',
  'scalable applications?',
  'agile(?:\s+methodology|\s+methodologies|\s+work(?:ing)?)?',
  'software projects?',
  'programming languages?',
  'microservices?',
  'machine learning',
  'deep learning',
  'tensorflow',
  'pytorch',
  'hadoop',
  'spark',
  'kafka',
  'graphql',
  'rest(?:ful)? api',
  'api development',
  'websockets?',
];

const LEADERSHIP_PATTERNS: RegExp[] = [
  /\b(led|leading|managed|managing|supervised|directed|headed)\b/iu,
  /\b(team lead|project lead|people manager)\b/iu,
  /\b(coordinated (?:a |the )?team|owned (?:a |the )?project|responsible for (?:a |the )?(?:team|department))\b/iu,
  /नेतृत्व|प्रबंधन किया|टीम का नेतृत्व/u,
  /قدت|أدرت|أشرفت|قيادة فريق|مسؤول(?:ة)? عن (?:فريق|قسم)/u,
  /руководил|возглавлял|управлял(?:а)? командой/iu,
  /\b(leitete|führte|dirigierte|verantwortete)\b/iu,
  /\b(dirigió|lideró|supervisó|encabezó)\b/iu,
  /\b(a dirigé|a managé|a supervisé|a piloté)\b/iu,
  /\b(ha guidato|ho guidato|ho diretto|ho gestito un team)\b/iu,
  /\b(vodio|vodila|predvodio|predvodila|upravljao|upravljala)\b/iu,
  /主导した|マネジメントした|チームを率/u,
  /\b(liderei|gerenciei|lidou|gerenciou)\b/iu,
];

const ACHIEVEMENT_PATTERNS: RegExp[] = [
  /\b(improved (?:efficiency|performance|user experience|quality|productivity)|increased (?:revenue|sales)|reduced (?:costs|response times?|latency)|exceeded targets|expanded markets|secured (?:major )?contracts|optimized performance|delivered successful projects|quality and productivity improvements)\b/iu,
  /क(?:ा|ी) कार्यक्षमता में सुधार|राजस्व बढ़ा|लागत घट|लक्ष्य पार|प्रदर्शन सुधार|उत्पादकता में सुधार/u,
  /رفعت كفاءة|حسّنت تجربة المستخدم|زدت الإيرادات|خفّضت التكاليف|تجاوزت الأهداف|حسّن(?:ت)? الأداء|قلل(?:ت)? أوقات الاستجابة/u,
  /повысил(?:а)? эффективность|увеличил(?:а)? выручку|снизил(?:а)? затраты|превысил(?:а)? план/iu,
  /\b(steigerte|verbesserte Effizienz|senkte Kosten|übertraf Ziele)\b/iu,
  /\b(mejoré la eficiencia|aumenté ingresos|reduje costos|superé objetivos)\b/iu,
  /\b(amélioré l'efficacité|augmenté le chiffre|réduit les coûts|dépassé les objectifs)\b/iu,
  /\b(migliorato l'efficienza|aumentato i ricavi|ridotto i costi)\b/iu,
  /\b(poboljšao|poboljšala|uvećao prihod|smanjio troškove)\b/iu,
  /効率を改善|売上を伸ば|コストを削減|目標を超過/u,
  /\b(melhorei a eficiência|aumentei a receita|reduzi custos)\b/iu,
];

const EXPERIENCE_STRENGTH_PATTERNS: RegExp[] = [
  /\b(extensive experience|several years of experience|proven (?:track record|expertise)|deep knowledge|strong (?:record|technical (?:background|expertise|capabilities))|highly experienced|expert in|accomplished|proven success|full[-\s]?stack experience|project ownership from conception|conception to production|architectural design through launch)\b/iu,
  /व्यापक अनुभव|कई वर्षों का अनुभव|मजबूत तकनीकी|विशेषज्ञता|जटिल सिस्टम|उच्च[-\s]?प्रदर्शन/u,
  /خبرة واسعة|سنوات من الخبرة|خبرة مثبتة|كفاءات تقنية متقدمة|قدرات تحليلية قوية|خبير في|سجل(?:اً)? قوي(?:اً)? من الإنجازات|خبرة واسعة/u,
  /обширный опыт|многолетний опыт|глубокие знания|высокий уровень экспертизы/iu,
  /\b(umfangreiche Erfahrung|jahrelange Erfahrung|fundierte Expertise|tiefgreifende Kenntnisse)\b/iu,
  /\b(amplia experiencia|varios años de experiencia|sólida experiencia técnica)\b/iu,
  /\b(vaste expérience|plusieurs années d'expérience|expertise technique solide)\b/iu,
  /\b(ampia esperienza|molti anni di esperienza|solida competenza tecnica)\b/iu,
  /\b(opsežno iskustvo|višegodišnje iskustvo|dokazano iskustvo)\b/iu,
  /豊富な経験|長年の経験|高い専門性|深い知識/u,
  /\b(ampla experiência|vários anos de experiência|forte experiência técnica)\b/iu,
];

const YEARS_CLAIM_RE =
  /(\d+)\+?\s*(?:years?|yrs?|Jahre|años|ans|anni|godina|лет|سنوات|वर्ष|年)\s+(?:of\s+)?(?:experience|Erfahrung|experiencia|expérience|esperienza|iskustv|опыт|خبرة|अनुभव|経験)/iu;

const PERCENT_OR_METRIC_RE =
  /\b\d{1,3}\s*%|\b\d+\s*(?:million|billion|k)\b|\b(?:revenue|sales|savings|budget)\b.{0,20}\d+/iu;

const NAMED_TECH_RE = new RegExp(`(?:${NAMED_TECH.join('|')})`, 'iu');

function normalizeForMatch(text: string): string {
  return text.normalize('NFC');
}

function isFactSupportedLiteral(needle: string, factSet: CoverLetterFactSet): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return false;
  // Target role/company are not "invented skills"
  for (const fact of factSet.facts) {
    if (fact.type === 'job_description_requirement') continue;
    const v = fact.value.toLowerCase();
    if (v.includes(n) || n.includes(v)) return true;
  }
  return false;
}

function isTargetRoleOrCompanyMention(matched: string, factSet: CoverLetterFactSet): boolean {
  const m = matched.toLowerCase();
  return factSet.facts.some(
    (f) =>
      (f.type === 'target_position' || f.type === 'target_company' || f.type === 'identity') &&
      (f.value.toLowerCase().includes(m) || m.includes(f.value.toLowerCase())),
  );
}

function collectMatches(text: string, patterns: RegExp[]): string[] {
  const found: string[] = [];
  for (const re of patterns) {
    const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
    const global = new RegExp(re.source, flags);
    let match: RegExpExecArray | null;
    while ((match = global.exec(text)) !== null) {
      found.push(match[0]);
      if (match.index === global.lastIndex) global.lastIndex += 1;
    }
  }
  return found;
}

const EXPERIENCE_PRESENCE_PATTERNS: RegExp[] = [
  /\b(years? of experience|work experience|professional experience|practical experience|industry experience|hands-on experience)\b/iu,
  /\b(experienced in|expertise in|background includes|my background|bringen .+ Erfahrung|Erfahrung in)\b/iu,
  /خبرة (?:واسعة|عملية|مهنية)|لدي خبرة|أتمتع بخبرة/u,
  /व्यावहारिक अनुभव|मेरे पास .+ अनुभव|अनुभव है/u,
  /опыт работы|имею опыт|практический опыт/iu,
  /\b(experiencia (?:laboral|profesional|práctica)|tengo experiencia)\b/iu,
  /\b(expérience (?:professionnelle|pratique)|j'ai de l'expérience)\b/iu,
  /\b(esperienza (?:lavorativa|professionale)|ho esperienza)\b/iu,
  /\b(radno iskustvo|imam iskustvo|prakti[cč]no iskustvo)\b/iu,
  /職歴|実務経験|経験があり/u,
  /\b(experiência (?:profissional|prática)|tenho experiência)\b/iu,
];

/** Internal/meta wording that must never appear in a real cover letter. */
const META_WORDING_PATTERNS: RegExp[] = [
  /\b(source details? are limited|my source details|limited (?:source |supplied )?(?:details?|information|data|facts?)|available (?:source )?(?:information|data|details?)|provided (?:CV |resume )?(?:data|information|details?)|insufficient (?:information|data|details?)|sparse (?:facts?|data|details?)|based on the limited|although few details|according to the provided|information available to me|because no experience was provided|the system (?:generated|has little)|AI[- ]generated|automated system|fallback logic)\b/iu,
  /\b(begrenzte (?:Angaben|Informationen|Daten)|verfügbare (?:Quell)?informationen|wenig Informationen|bereitgestellte (?:Lebenslauf)?daten|KI[- ]generiert)\b/iu,
  /\b(información (?:limitada|disponible|proporcionada)|datos (?:limitados|disponibles|del CV)|pocos detalles|generado por (?:IA|AI))\b/iu,
  /\b(informations? (?:limitées?|disponibles?|fournies?)|données (?:limitées?|disponibles?)|peu de détails|généré(?:e)? par (?:l')?IA)\b/iu,
  /\b(informazioni? (?:limitate|disponibili|fornite)|pochi dettagli|generat[oa] dall'?IA)\b/iu,
  /(?:تفاصيل المصدر|المعلومات (?:المحدودة|المتوفر|المتوفرة|المقدمة)|بيانات (?:السيرة|محدودة)|لا توجد معلومات كافية|توليد آلي)/u,
  /\b(ograničen(?:e|ih)? (?:informacij[ae]|podat(?:aka|ci))|dostupne informacije|malo informacija|podaci iz CV|generisan[oa] AI)\b/iu,
  /(?:ограниченн(?:ые|ой|ая) (?:информаци|данн)|доступн(?:ая|ые) информаци|мало информаци|данные (?:из )?резюме|сгенерировано (?:ИИ|AI))/iu,
  /\b(informações? (?:limitadas?|disponíveis?|fornecidas?)|poucos detalhes|dados (?:do )?CV|gerad[oa] por IA)\b/iu,
  /(?:स्रोत विवरण|सीमित (?:जानकारी|विवरण|डेटा)|उपलब्ध जानकारी|प्रदान की गई जानकारी|सीवी डेटा|एआई[- ]?जनरेटेड)/u,
  /(?:ソース詳細|限られた情報|提供された情報|情報不足|利用可能な情報|AI生成|フォールバック)/u,
];

/** Personal-trait claims that require explicit source support. */
const PERSONALITY_CLAIM_PATTERNS: RegExp[] = [
  /\b(attention to detail|detail[- ]oriented|professionalism|honesty|dedication|reliability|reliable|creativity|creative|analytical thinking|strong communication|teamwork|team player|adaptability|adaptable|determination|passion(?:ate)?|discipline|problem[- ]solving|leadership potential|strong work ethic|work ethic|organizational ability|responsibility|precision|integrity|proven ability|make a positive impact|contribute meaningfully|highly motivated|self[- ]motivated)\b/iu,
  /\b(zuverlässig|engagiert|detailorientiert|Einsatzbereitschaft|gewissenhaft|teamfähig|belastbar)\b/iu,
  /\b((?:soy|persona)\s+responsable|proactiv[oa]|detallista|puntual|honesto|creativ[oa]|comprometid[oa])\b/iu,
  /\b(rigoureux|rigoureuse|dynamique|proactif|proactive|autonome|créatif|créative|sérieux|sérieuse)\b/iu,
  /\b(preciso|precisa|affidabile|determinato|determinata|puntuale|creativo|creativa|(?:sono|persona)\s+responsabile)\b/iu,
  /(?:الدقة|الاحترافية|الالتزام|الإبداع|القدرة التحليلية|روح الفريق|التفاني|تحمل المسؤولية|المهنية)/u,
  /\b(posvećenost|odgovornost|preciznost|pouzdanost|kreativnost|analitičk\w*|timski igrač)\b/iu,
  /(?:ответственн\w*|внимательн\w*|целеустремлённ\w*|целеустремленн\w*|исполнительн\w*|дисциплинированн\w*|креативн\w*)/iu,
  /\b(dedicad[oa]|proativ[oa]|atent[oa] aos detalhes|pontual|confiável|criativ[oa]|organizado)\b/iu,
  /(?:ईमानदारी|लगन|सूक्ष्मता|रचनात्मक सोच|समस्या[- ]?समाधान|नेतृत्व क्षमता|कार्य[- ]?नैतिकता|विवरण पर ध्यान|पेशेवरिया)/u,
  /(?:誠実|正確性|注意力|責任感|創造性|協調性|勤勉|几帳面|丁寧な仕事)/u,
];

/**
 * Factual company reputation / value assertions that require vacancy/company evidence.
 * Subjective interest in the role or field is allowed. Company names are opaque:
 * common brand knowledge (Mercedes, Google, …) is never evidence.
 */
const UNSUPPORTED_COMPANY_CLAIM_PATTERNS: RegExp[] = [
  // EN — company as subject of fame/quality attributes
  /\b(?:prestigious|renowned|world[- ]class|industry[- ]leading|well[- ]known)\b.{0,40}\b(?:company|organization|organisation|employer|brand)\b/iu,
  /\b(?:company|organization|organisation|employer|brand)\b.{0,40}\b(?:prestigious|renowned|world[- ]class|industry[- ]leading|well[- ]known|recognized as a leader)\b/iu,
  /\bis\s+(?:a\s+)?(?:renowned|prestigious|well[- ]known|leading|famous)\b/iu,
  /\b(?:known for|recognized for|renowned for)\b.{0,80}\b(?:excellence|quality|innovation|service|customer satisfaction|vehicles?|cars?|products?)\b/iu,
  /\b(?:committed to|focused on|oriented toward)\b.{0,40}\b(?:service quality|customer satisfaction|customer service excellence|quality)\b/iu,
  /\ba team that takes client support seriously\b/iu,
  /\b(?:'s|’s)\s+work in this space\b/iu,
  // HI — famous/prestigious brand assertions (truth of brand is irrelevant)
  /(?:एक\s+)?(?:जाना[- ]?माना|सुपरिचित|सुप्रसिद्ध|प्रतिष्ठित)\s+(?:ऑटोमोबाइल\s+)?(?:ब्रांड|कंपनी|संगठन|संस्था)/u,
  /(?:जाना[- ]?माना|सुपरिचित|सुप्रसिद्ध|प्रतिष्ठित)\s+(?:ऑटोमोबाइल\s+)?(?:ब्रांड|कंपनी)\s+है/u,
  /(?:गुणवत्ता\s+को\s+प्राथमिकता|ग्राहक\s+विश्वास\s+को\s+महत्व)/u,
  // JA
  /(?:顧客サービスを重視する企業として認識|顧客との信頼関係を(?:重視|大切にする)企業として認識|として認識しており|品質を重視する企業)/u,
  // HR/SR
  /\btvrtk\w*\s+kojoj\s+je\s+stalo\s+do\s+(?:kvalitete|kvalitete?\s+usluge|zadovoljstva)\b/iu,
  /\b(?:prestižn\w*|ugledn\w*|vodeć\w*|poznat\w*)\s+(?:tvrtk|kompanij|brend)/iu,
  /\b(?:poznat\w*\s+po\s+kvalitet|orijentiran\w*\s+na\s+(?:kvalitet|zadovoljstvo)|brine\s+o\s+klijentima)\b/iu,
  /\bprocese i standarde koje\b.{0,40}\bprimenjuje\b/iu,
  /\bkompaniju koja ozbiljno pristupa\b/iu,
  /\bprimenjuje\s+visok\w*\s+standard/iu,
  // RU
  /привлекает меня своей ориентацией/iu,
  /ориентацией на клиентск(?:ий|ого) сервис/iu,
  /клиентский сервис занимает важное место/iu,
  /(?:престижн\w*|известн\w*|ведущ\w*)\s+(?:компан|организац|бренд)/iu,
  /известн\w*\s+качеств/iu,
  /ориентирован\w*\s+на\s+качество\s+обслуживания/iu,
  // IT
  /\bper la sua presenza nel mercato\b/iu,
  /\bper le opportunità di sviluppo che offre\b/iu,
  /\bun team orientato al servizio e alla soddisfazione del cliente\b/iu,
  /\b(?:azienda\s+)?rinomat\w*\b/iu,
  /\bcontesto dinamico\b/iu,
  /\bambiente dinamico\b/iu,
  // FR — brand/quality attributions (company/brand as subject)
  /\best\s+(?:une\s+)?(?:marque|entreprise)\s+(?:prestigieuse|réputée|reconnue)\b/iu,
  /\bmarque\b[^.!?]{0,120}\b(?:qualité|soin)\b/iu,
  /\bqualité et (?:le )?soin apport/iu,
  /\baccorde une grande importance à\b/iu,
  /\breconnue pour\b/iu,
  /\béputée pour\b/iu,
  /\b(?:reconnu(?:e)? comme un leader|axée sur la satisfaction client)\b/iu,
  // ES / PT
  /\b(?:empresa prestigiosa|reconocida como líder|comprometida con la calidad del servicio|orientada a la satisfacción)\b/iu,
  /\b(?:azienda prestigiosa|riconosciuta come leader|attenta alla qualità del servizio)\b/iu,
  /\b(?:empresa prestigiada|reconhecida como líder|comprometida com a qualidade do serviço)\b/iu,
];

/** Cover-letter locale wording defects that must never reach preview/download. */
const LOCALE_QUALITY_PATTERNS: RegExp[] = [
  // AR application context: طلبتي = "my female students"; ويسعدني فرصة is incomplete
  /(?:مناقشة|حول|بشأن)\s+طلبتي/u,
  /ويسعدني\s+فرصة/u,
  // HR sparse / unnatural formal
  /\busvojiti očekivanja uloge\b/iu,
  /\bPozicija\b.+\bzanima me kao smislen sljedeći korak\b/iu,
  /\bOvim putem prijavila sam se\b/iu,
  /\bpoziciju Saradnika\b/iu,
  // FR closing centered on "demande" instead of candidature
  /\bl['’]attention que vous porterez à ma demande\b/iu,
  /\bl['’]attention portée à ma demande\b/iu,
  /\bmerci de l['’]attention.{0,40}ma demande\b/iu,
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectCompanyAttributeMatches(text: string, factSet: CoverLetterFactSet): string[] {
  const found = collectMatches(text, UNSUPPORTED_COMPANY_CLAIM_PATTERNS);
  const company = factSet.facts.find((f) => f.type === 'target_company')?.value?.trim();
  if (!company) return found;
  const c = escapeRegExp(company);
  const companyScoped: RegExp[] = [
    new RegExp(`${c}\\s+(?:एक\\s+)?(?:जाना[- ]?माना|सुपरिचित|सुप्रसिद्ध|प्रतिष्ठित)`, 'u'),
    new RegExp(`${c}\\s+est\\s+(?:une\\s+)?(?:marque\\s+)?(?:reconnue|réputée|prestigieuse)`, 'iu'),
    new RegExp(`${c}\\s+est\\s+une\\s+marque[^.!?]{0,120}(?:qualité|soin)`, 'iu'),
    new RegExp(`${c}\\s+is\\s+(?:a\\s+)?(?:renowned|prestigious|well[- ]known|leading|famous)`, 'iu'),
    new RegExp(`${c}\\s+(?:je\\s+)?(?:poznat|ugledan|vodeć|prestižn)`, 'iu'),
    new RegExp(`${c}\\s+(?:ist\\s+)?(?:ein\\s+)?(?:renommierte[rs]?|bekannt(?:es|e)?)`, 'iu'),
    new RegExp(`${c}\\s+(?:は|が).{0,40}(?:認識|重視|定評)`, 'u'),
    new RegExp(`${c}\\s+(?:—\\s*)?(?:известн|престижн|ведущ)`, 'iu'),
  ];
  return [...found, ...collectMatches(text, companyScoped)];
}

/** Duties/domains often wrongly inferred from job titles when no evidence exists. */
const ROLE_INFERRED_DUTY_PATTERNS: RegExp[] = [
  /\b(quality assuran(?:ce|ce efforts)|QA (?:team|process|testing)|test automation|automated testing|bug reports?|test cases?|android[- ]testing|mobile (?:app )?testing|regression testing|manual testing)\b/iu,
  /\b(contribute meaningfully to .{0,40}(?:quality|assurance|QA|sales|marketing|engineering) (?:efforts|initiatives|processes))\b/iu,
  /\b(Qualitätssicherung|Testautomatisierung|Fehlerberichte|Testfälle)\b/iu,
  /\b(aseguramiento de calidad|automatización de pruebas|casos de prueba)\b/iu,
  /\b(assurance qualité|automatisation des tests|cas de test)\b/iu,
  /\b(assicurazione qualità|automazione dei test|casi di test)\b/iu,
  /(?:ضمان الجودة|اختبار الأندرويد|أتمتة الاختبار|حالات الاختبار)/u,
  /\b(osiguranje kvaliteta|automatizacij\w* test|testirani?\w* android)\b/iu,
  /(?:обеспечен\w* качества|автоматизац\w* тест|тест[- ]кейс)/iu,
  /\b(garantia de qualidade|automação de testes|casos de teste)\b/iu,
  /(?:गुणवत्ता आश्वासन|टेस्ट ऑटोमेशन|बग रिपोर्ट|एंड्रॉइड परीक्षण)/u,
  /(?:品質保証|テスト自動化|バグ報告|Android(?:テスト|検証))/u,
];

/** Slash / parenthetical gender-alternative placeholders in finished letters. */
const GENDER_PLACEHOLDER_PATTERNS: RegExp[] = [
  /\b[\p{L}]{2,}\/[\p{L}]{1,6}\b/u, // e.g. lieto/a, izrazio/la, चाहता/चाहती
  /\([\p{L}аaеe]\)/u, // e.g. (a), (e), (а)
  /चाहता\/चाहती|करूँगा\/करूँगी|रहा\/रही|इच्छुक\/इच्छुका|करता\/करती/u,
];

function groundingDiagEvidence(
  options?: { locale?: Locale | string; stage?: string },
): string | undefined {
  const bits = [
    options?.locale ? `locale=${options.locale}` : '',
    options?.stage ? `stage=${options.stage}` : '',
  ].filter(Boolean);
  return bits.length ? bits.join(' ') : undefined;
}

export function validateCoverLetterGrounding(
  content: string,
  factSet: CoverLetterFactSet,
  options?: { locale?: Locale | string; gender?: CoverLetterGender | string; stage?: string },
): GroundingValidationResult {
  const text = normalizeForMatch(content);
  const violations: GroundingViolation[] = [];
  const diagEvidence = groundingDiagEvidence(options);

  // Named skills/tools
  const techFlags = text.match(new RegExp(NAMED_TECH_RE.source, 'giu')) ?? [];
  for (const raw of techFlags) {
    const matched = raw.trim();
    if (!matched) continue;
    if (isTargetRoleOrCompanyMention(matched, factSet)) continue;
    if (isFactSupportedLiteral(matched, factSet)) continue;
    if (violations.some((v) => v.kind === 'named_skill_or_tool' && v.matched.toLowerCase() === matched.toLowerCase())) {
      continue;
    }
    violations.push({ kind: 'named_skill_or_tool', matched });
  }

  // Numeric / years claims
  for (const matched of collectMatches(text, [YEARS_CLAIM_RE, PERCENT_OR_METRIC_RE])) {
    if (isFactSupportedLiteral(matched, factSet)) continue;
    if (/^\d{4}$/.test(matched.trim())) continue;
    violations.push({ kind: 'numeric_claim', matched });
  }

  // Leadership
  if (!factSetAllowsLeadership(factSet)) {
    for (const matched of collectMatches(text, LEADERSHIP_PATTERNS)) {
      violations.push({ kind: 'leadership_claim', matched });
    }
  }

  // Achievements
  for (const matched of collectMatches(text, ACHIEVEMENT_PATTERNS)) {
    if (isFactSupportedLiteral(matched, factSet)) continue;
    violations.push({ kind: 'achievement_claim', matched });
  }

  // Experience strength
  for (const matched of collectMatches(text, EXPERIENCE_STRENGTH_PATTERNS)) {
    if (isFactSupportedLiteral(matched, factSet)) continue;
    violations.push({ kind: 'experience_strength_claim', matched });
  }

  // Sparse fact sets: reject any "I have experience" style claims
  const hasWorkEvidence = factSet.facts.some(
    (f) =>
      f.type === 'work_history' ||
      f.type === 'responsibility' ||
      f.type === 'achievement' ||
      f.type === 'years_experience',
  );
  if (!hasWorkEvidence) {
    for (const matched of collectMatches(text, EXPERIENCE_PRESENCE_PATTERNS)) {
      violations.push({ kind: 'experience_strength_claim', matched });
    }
  }

  // Internal / meta wording must never reach the employer
  for (const matched of collectMatches(text, META_WORDING_PATTERNS)) {
    violations.push({ kind: 'meta_or_system_wording', matched });
  }

  // Unsupported personal-quality claims
  for (const matched of collectMatches(text, PERSONALITY_CLAIM_PATTERNS)) {
    if (isFactSupportedLiteral(matched, factSet)) continue;
    violations.push({ kind: 'personality_claim', matched });
  }

  // Unsupported factual company reputation / value / process claims
  for (const matched of collectCompanyAttributeMatches(text, factSet)) {
    if (isFactSupportedLiteral(matched, factSet)) continue;
    violations.push({
      kind: 'unsupported_company_attribute',
      matched,
      evidence: diagEvidence,
    });
  }

  // Locale-specific wording defects (Arabic application typos, sparse HR, weak FR closings)
  for (const matched of collectMatches(text, LOCALE_QUALITY_PATTERNS)) {
    violations.push({
      kind: 'locale_quality',
      matched,
      evidence: diagEvidence,
    });
  }

  // Role-title-inferred duties (unless literally present in source facts)
  for (const matched of collectMatches(text, ROLE_INFERRED_DUTY_PATTERNS)) {
    if (isFactSupportedLiteral(matched, factSet)) continue;
    violations.push({ kind: 'role_inferred_duty', matched });
  }

  // Gender slash / parenthetical placeholders
  for (const matched of collectMatches(text, GENDER_PLACEHOLDER_PATTERNS)) {
    // Allow email-like or path-like false positives with digits/dots
    if (/[.@\d]/.test(matched)) continue;
    violations.push({ kind: 'gender_placeholder', matched });
  }

  // Self-correction leakage + gendered speaker forms vs selected app gender
  violations.push(
    ...collectGenderAndSelfCorrectionViolations(content, {
      locale: options?.locale,
      gender: options?.gender,
    }),
  );

  return { valid: violations.length === 0, violations };
}

export function formatGroundingViolationsForPrompt(violations: GroundingViolation[]): string {
  if (violations.length === 0) return '(none)';
  return violations.map((v) => `- [${v.kind}] "${v.matched}"`).join('\n');
}

export function buildGroundingRepairUserNote(
  factSet: CoverLetterFactSet,
  violations: GroundingViolation[],
  previousLetter: string,
): string {
  return [
    'GROUNDING REPAIR REQUIRED.',
    'The previous cover letter contained unsupported professional claims or locale-quality defects.',
    'Rewrite the ENTIRE JSON letter so that EVERY factual professional claim is supported by SOURCE FACTS.',
    'Remove or neutralize every unsupported claim listed below.',
    'Treat the company name as an opaque user string — do NOT use real-world brand knowledge (fame, quality, prestige, sector leadership) unless present in SOURCE FACTS.',
    'Prefer role-centered interest, readiness to learn responsibilities, and subjective motivation to join.',
    'Do not invent skills, tools, leadership, metrics, years of experience, or achievements.',
    'Never mention source facts, limited information, CV data, AI, validation, prompts, or fallbacks in the letter.',
    'Do not invent personal qualities or infer role responsibilities from the job title alone.',
    'Do not use slash gender placeholders in the finished letter.',
    'Arabic: never write طلبتي for the job application (use طلبي); never write incomplete ويسعدني فرصة.',
    'French: thank for attention to ma candidature — not ma demande.',
    'Croatian: use present-tense Ovim putem se prijavljujem; quote unknown titles; do not use usvojiti očekivanja uloge.',
    'If SOURCE FACTS are sparse, write a short honest letter focused on interest, motivation, willingness to learn/contribute, and interview availability — without discussing why details are limited.',
    'Unsupported claims to remove:',
    formatGroundingViolationsForPrompt(violations),
    'Previous invalid letter (for reference only — do not copy unsupported claims):',
    previousLetter.slice(0, 3500),
  ].join('\n');
}

type FallbackParts = {
  greeting: string;
  paragraph1: string;
  paragraph2: string;
  paragraph3: string;
  closing: string;
  signOff: string;
};

function fallbackParts(
  locale: Locale,
  name: string,
  role: string,
  company: string,
  extras: string[],
  gender: CoverLetterGender,
  tone: Tone,
): FallbackParts {
  const extraSentence = extras.length ? extras.join(' ') : '';
  const confident = tone === 'confident';
  const friendly = tone === 'friendly';
  const formal = tone === 'formal' || (!confident && !friendly);
  const ptRole = portugueseBrRoleReference(role, gender);
  const hrPoziciju = croatianPozicijuRolePhrase(role);
  const hrGloss = croatianOptionalRoleGloss(role);
  const srPoz = serbianPozicijuRolePhrase(role);

  const esFormal: FallbackParts = {
    greeting: `Estimado equipo de selección de ${company}:`,
    paragraph1: gender === 'female'
      ? `Le escribo para expresar mi interés en el puesto de ${role} en ${company}. Estoy interesada en asumir las responsabilidades del puesto, conocer sus procesos y contribuir de manera responsable a los objetivos del equipo.`
      : gender === 'male'
        ? `Le escribo para expresar mi interés en el puesto de ${role} en ${company}. Estoy interesado en asumir las responsabilidades del puesto, conocer sus procesos y contribuir de manera responsable a los objetivos del equipo.`
        : `Le escribo para expresar mi interés en el puesto de ${role} en ${company}. Me interesa asumir las responsabilidades del puesto, conocer sus procesos y contribuir de manera responsable a los objetivos del equipo.`,
    paragraph2: extraSentence
      || `La oportunidad de desempeñar el puesto de ${role} en ${company} representa para mí una vía relevante de desarrollo profesional. Deseo conocer con mayor detalle las expectativas del rol y aportar de forma constante en las tareas propias del puesto.`,
    paragraph3: 'Quedo a su disposición para una entrevista en la que pueda presentar con claridad los motivos de mi candidatura.',
    closing: 'Gracias por su tiempo y consideración.',
    signOff: 'Atentamente',
  };
  const esConfident: FallbackParts = {
    greeting: esFormal.greeting,
    paragraph1: gender === 'female'
      ? `Le escribo para expresar mi interés en el puesto de ${role} en ${company}. Estoy preparada para asumir las responsabilidades del puesto, aprender con rapidez y contribuir de forma activa y responsable al trabajo del equipo.`
      : gender === 'male'
        ? `Le escribo para expresar mi interés en el puesto de ${role} en ${company}. Estoy preparado para asumir las responsabilidades del puesto, aprender con rapidez y contribuir de forma activa y responsable al trabajo del equipo.`
        : `Le escribo para expresar mi interés en el puesto de ${role} en ${company}. Deseo asumir las responsabilidades del puesto, aprender con rapidez y contribuir de forma activa y responsable al trabajo del equipo.`,
    paragraph2: extraSentence
      || `El puesto de ${role} en ${company} supone para mí un paso relevante de desarrollo profesional. Me interesa comprender las expectativas del rol y aportar con constancia en las tareas del puesto.`,
    paragraph3: 'Quedo a su disposición para una entrevista en la que pueda presentar los motivos de mi candidatura.',
    closing: 'Gracias por su tiempo y consideración.',
    signOff: 'Atentamente',
  };
  const esFriendly: FallbackParts = {
    greeting: esFormal.greeting,
    paragraph1: gender === 'female'
      ? `Le escribo para expresar mi interés en el puesto de ${role} en ${company}. Me gustaría unirme a su equipo, aprender en el día a día del rol y contribuir de manera activa y responsable al trabajo del equipo.`
      : gender === 'male'
        ? `Le escribo para expresar mi interés en el puesto de ${role} en ${company}. Me gustaría unirme a su equipo, aprender en el día a día del rol y contribuir de manera activa y responsable al trabajo del equipo.`
        : `Le escribo para expresar mi interés en el puesto de ${role} en ${company}. Me gustaría unirme a su equipo, aprender en el día a día del rol y contribuir de manera activa y responsable al trabajo del equipo.`,
    paragraph2: extraSentence
      || `Me interesa el puesto de ${role} en ${company} como oportunidad de crecimiento y de aportar en un entorno colaborativo.`,
    paragraph3: gender === 'female'
      ? 'Estaría encantada de conversar sobre mi candidatura. Quedo a disposición para una entrevista.'
      : gender === 'male'
        ? 'Estaría encantado de conversar sobre mi candidatura. Quedo a disposición para una entrevista.'
        : 'Agradecería poder conversar sobre la candidatura. Quedo a disposición para una entrevista.',
    closing: 'Gracias por su tiempo y consideración.',
    signOff: 'Atentamente',
  };

  const templates: Record<Locale, FallbackParts> = {
    en: {
      greeting: `Dear Hiring Team at ${company},`,
      paragraph1: confident
        ? `I am writing to apply for the ${role} position at ${company}. I am prepared to take on the role's responsibilities, learn required processes promptly, and contribute with clear focus.`
        : friendly
          ? `I am writing to express my interest in the ${role} position at ${company}. I would welcome the chance to join your team, learn within the role, and support shared goals.`
          : `I am writing to express my interest in the ${role} position at ${company}. I would welcome the opportunity to learn the role's responsibilities and contribute where I can add value.`,
      paragraph2: extraSentence
        || (confident
          ? `The ${role} role interests me as a concrete next step. I am ready to learn the day-to-day expectations and contribute actively to the team's work.`
          : friendly
            ? `I am drawn to the ${role} opportunity at ${company} and would enjoy learning the expectations while supporting the team in a collaborative way.`
            : `I am interested in the ${role} role at ${company} and in learning the processes of the position so I can contribute responsibly.`),
      paragraph3: 'I am available for an interview at your convenience.',
      closing: 'Thank you for your time and consideration.',
      signOff: 'Sincerely',
    },
    de: {
      greeting: 'Sehr geehrte Damen und Herren,',
      paragraph1: `hiermit bekunde ich mein Interesse an der Position als ${role} bei ${company}. Ich würde mich freuen, Ihr Team kennenzulernen, in der Rolle dazuzulernen und nach Möglichkeit beizutragen.`,
      paragraph2: extraSentence
        || (confident
          ? 'Die ausgeschriebene Aufgabe spricht mich an. Diese Chance möchte ich entschlossen nutzen und mich mit einem engagierten Beitrag im Team einbringen.'
          : friendly
            ? 'Die ausgeschriebene Aufgabe spricht mich an. Gerne erläutere ich meine Bewerbung und erfahre mehr darüber, wie ich das Team unterstützen kann.'
            : 'Die ausgeschriebene Aufgabe spricht mich an. Gerne erläutere ich meine Bewerbung und erfahre mehr über Ihre Erwartungen an die Rolle.'),
      paragraph3: 'Für ein Gespräch stehe ich gerne zur Verfügung.',
      closing: 'Vielen Dank für Ihre Zeit und Ihre Berücksichtigung.',
      signOff: 'Mit freundlichen Grüßen',
    },
    es: confident ? esConfident : friendly ? esFriendly : esFormal,
    fr: {
      greeting: 'Madame, Monsieur,',
      paragraph1: gender === 'female'
        ? (confident
          ? `Je vous écris pour le poste de ${role} chez ${company}. Je suis motivée pour assumer les responsabilités du poste, me familiariser rapidement avec vos processus et contribuer de manière active et responsable.`
          : friendly
            ? `Je vous écris pour vous faire part de mon intérêt pour le poste de ${role} chez ${company}. J'aimerais rejoindre votre équipe, apprendre avec vous et contribuer de manière active et responsable.`
            : `Je vous écris pour vous faire part de mon intérêt pour le poste de ${role} chez ${company}. Je suis vivement intéressée par la possibilité de rejoindre vos équipes, de me familiariser avec les responsabilités du poste et de mettre mon engagement et ma motivation au service de votre organisation.`)
        : gender === 'male'
          ? (confident
            ? `Je vous écris pour le poste de ${role} chez ${company}. Je suis motivé pour assumer les responsabilités du poste, me familiariser rapidement avec vos processus et contribuer de manière active et responsable.`
            : friendly
              ? `Je vous écris pour vous faire part de mon intérêt pour le poste de ${role} chez ${company}. J'aimerais rejoindre votre équipe, apprendre avec vous et contribuer de manière active et responsable.`
              : `Je vous écris pour vous faire part de mon intérêt pour le poste de ${role} chez ${company}. Je suis vivement intéressé par la possibilité de rejoindre vos équipes, de me familiariser avec les responsabilités du poste et de mettre mon engagement et ma motivation au service de votre organisation.`)
          : `Je vous écris pour vous faire part de mon intérêt pour le poste de ${role} chez ${company}. Ce poste représente une possibilité de rejoindre vos équipes et de contribuer de manière active et responsable.`,
      paragraph2: extraSentence
        || (gender === 'female'
          ? (friendly
            ? `La possibilité d'occuper ce poste chez ${company} m'intéresse. Je serais ravie d'échanger sur ma candidature et sur la manière dont je peux soutenir l'équipe.`
            : `${
              /servis|auto|voiture|vehicle|fahrzeug|automobil/i.test(role)
                ? `Le poste de ${role} m'intéresse particulièrement en raison des responsabilités liées à l'entretien et au service automobile.`
                : `Le poste de ${role} m'intéresse particulièrement en raison des responsabilités liées à ce rôle.`
            } Je serais ravie d'échanger sur ma candidature.`)
          : gender === 'male'
            ? (friendly
              ? `La possibilité d'occuper ce poste chez ${company} m'intéresse. Je serais ravi d'échanger sur ma candidature et sur la manière dont je peux soutenir l'équipe.`
              : `${
                /servis|auto|voiture|vehicle|fahrzeug|automobil/i.test(role)
                  ? `Le poste de ${role} m'intéresse particulièrement en raison des responsabilités liées à l'entretien et au service automobile.`
                  : `Le poste de ${role} m'intéresse particulièrement en raison des responsabilités liées à ce rôle.`
              } Je serais ravi d'échanger sur ma candidature.`)
            : (/servis|auto|voiture|vehicle|fahrzeug|automobil/i.test(role)
              ? `Le poste de ${role} m'intéresse particulièrement en raison des responsabilités liées à l'entretien et au service automobile.`
              : `Le poste de ${role} m'intéresse particulièrement en raison des responsabilités liées à ce rôle.`)),
      paragraph3: 'Je reste disponible pour un entretien à votre convenance.',
      closing: "Je vous remercie de l'attention portée à ma candidature.",
      signOff: 'Cordialement',
    },
    it: {
      greeting: `Gentile team di selezione di ${company},`,
      paragraph1: friendly
        ? (gender === 'female'
          ? `scrivo per esprimere il mio interesse per la posizione di ${role} presso ${company}. Sarei lieta di entrare a far parte del vostro team, imparare nel ruolo e contribuire ove opportuno.`
          : gender === 'male'
            ? `scrivo per esprimere il mio interesse per la posizione di ${role} presso ${company}. Sarei lieto di entrare a far parte del vostro team, imparare nel ruolo e contribuire ove opportuno.`
            : `scrivo per esprimere il mio interesse per la posizione di ${role} presso ${company}. Vorrei entrare a far parte del vostro team, imparare nel ruolo e contribuire ove opportuno.`)
        : confident
          ? (gender === 'female'
            ? `scrivo per esprimere il mio interesse per la posizione di ${role} presso ${company}. Sono motivata ad assumere le responsabilità del ruolo, apprendere rapidamente i processi necessari e contribuire in modo attivo e responsabile.`
            : gender === 'male'
              ? `scrivo per esprimere il mio interesse per la posizione di ${role} presso ${company}. Sono motivato ad assumere le responsabilità del ruolo, apprendere rapidamente i processi necessari e contribuire in modo attivo e responsabile.`
              : `scrivo per esprimere il mio interesse per la posizione di ${role} presso ${company}. Desidero assumere le responsabilità del ruolo, apprendere rapidamente i processi necessari e contribuire in modo attivo e responsabile.`)
          : `scrivo per esprimere il mio interesse per la posizione di ${role} presso ${company}. Vorrei unirmi al vostro team, imparare nel ruolo e contribuire ove opportuno.`,
      paragraph2: extraSentence
        || (gender === 'female'
          ? `La posizione di ${role} mi interessa come concreto passo di crescita professionale. Sarei lieta di approfondire la candidatura, mettendo a disposizione il mio impegno e la mia volontà di contribuire.`
          : gender === 'male'
            ? `La posizione di ${role} mi interessa come concreto passo di crescita professionale. Sarei lieto di approfondire la candidatura, mettendo a disposizione il mio impegno e la mia volontà di contribuire.`
            : `La posizione di ${role} mi interessa come concreto passo di crescita professionale. Vorrei approfondire la candidatura e conoscere meglio le vostre aspettative.`),
      paragraph3: gender === 'female'
        ? 'Sarei lieta di approfondire la mia candidatura durante un colloquio e rimango a vostra completa disposizione per concordarne la data e le modalità.'
        : gender === 'male'
          ? 'Sarei lieto di approfondire la mia candidatura durante un colloquio e rimango a vostra completa disposizione per concordarne la data e le modalità.'
          : 'Vorrei approfondire la mia candidatura durante un colloquio e resto a vostra completa disposizione per concordarne la data e le modalità.',
      closing: `Vi ringrazio per il vostro tempo e la vostra considerazione.`,
      signOff: 'Cordiali saluti',
    },
    ar: {
      greeting: `إلى فريق التوظيف المحترم في شركة ${company}،`,
      paragraph1: confident
        ? (gender === 'female'
          ? `أتقدم بطلب لشغل وظيفة ${role} لدى شركة ${company}. أنا مستعدة لتولي مسؤوليات الدور، وتعلّم العمليات المطلوبة، والمساهمة بفعالية ومسؤولية.`
          : gender === 'male'
            ? `أتقدم بطلب لشغل وظيفة ${role} لدى شركة ${company}. أنا مستعد لتولي مسؤوليات الدور، وتعلّم العمليات المطلوبة، والمساهمة بفعالية ومسؤولية.`
            : `أتقدم بطلب لشغل وظيفة ${role} لدى شركة ${company}. أتطلع لتولي مسؤوليات الدور، وتعلّم العمليات المطلوبة، والمساهمة بفعالية ومسؤولية.`)
        : friendly
          ? `أتقدم بطلب لشغل وظيفة ${role} لدى شركة ${company}، ويسعدني الانضمام إلى فريقكم والتعلّم معكم والمساهمة في العمل اليومي.`
          : `أتقدم بطلب لشغل وظيفة ${role} لدى شركة ${company}، وأتطلع إلى فرصة الانضمام إلى فريقكم والتعرف على متطلبات الوظيفة.`,
      paragraph2: extraSentence
        || (confident
          ? `يهمّني العمل في هذا المجال، وأسعى لفهم متطلبات الدور والتكيف معها والوفاء بمسؤولياته.`
          : friendly
            ? `تجذبني فرصة العمل مع فريقكم في دور ${role}، وأرحب بفرصة مناقشة طلبي معكم بأسلوب تعاوني.`
            : `تهمّني هذه الفرصة، وأسعى لفهم متطلبات الدور والتكيف معها والوفاء بمسؤولياته.`),
      paragraph3: gender === 'unspecified'
        ? 'يسعدني حضور مقابلة في الوقت الذي يناسبكم.'
        : gender === 'female'
          ? (confident
            ? 'أنا مستعدة لمناقشة طلبي في الوقت الذي يناسبكم.'
            : friendly
              ? 'يسعدني التحدث معكم حول طلبي، وأنا متاحة في الوقت المناسب لكم.'
              : 'أنا مستعدة لمناقشة طلبي في الوقت الذي يناسبكم.')
          : (confident
            ? 'يشرفني مناقشة طلبي في الوقت الذي يناسبكم.'
            : friendly
              ? 'يسعدني التحدث معكم حول طلبي، وأنا متاح في الوقت المناسب لكم.'
              : 'يشرفني مناقشة طلبي في الوقت الذي يناسبكم.'),
      closing: 'شكرًا لوقتكم واهتمامكم.',
      signOff: 'مع خالص التحية',
    },
    sr: confident
      ? {
          greeting: `Poštovani tim za zapošljavanje u kompaniji ${company},`,
          ...serbianConfidentFallbackParts(role, company, gender, extraSentence),
          closing: 'Hvala na vašem vremenu i razmatranju.',
          signOff: 'Srdačno',
        }
      : {
          greeting: `Poštovani tim za zapošljavanje u kompaniji ${company},`,
          paragraph1: gender === 'female'
            ? `Ovim putem se prijavljujem za ${srPoz} u kompaniji ${company}. ${friendly ? 'Radujem se prilici da se priključim vašem timu i doprinesem zajedničkim ciljevima.' : 'Želim da se posvetim zahtevima ove uloge, usvojim potrebna znanja i odgovorno doprinesem radu tima.'}`
            : gender === 'male'
              ? `Ovim putem se prijavljujem za ${srPoz} u kompaniji ${company}. ${friendly ? 'Radujem se prilici da se priključim vašem timu i doprinesem zajedničkim ciljevima.' : 'Želim da se posvetim zahtevima ove uloge, usvojim potrebna znanja i odgovorno doprinesem radu tima.'}`
              : `Ovim putem se prijavljujem za ${srPoz} u kompaniji ${company}. Želim da usvojim zahteve uloge i odgovorno doprinesem radu tima.`,
          paragraph2: extraSentence
            || (gender === 'female'
              ? `Kompanija ${company} privukla mi je pažnju kao okruženje u kojem bih želela da učim i razvijam se u ovoj ulozi.`
              : gender === 'male'
                ? `Kompanija ${company} privukla mi je pažnju kao okruženje u kojem bih želeo da učim i razvijam se u ovoj ulozi.`
                : `Kompanija ${company} predstavlja zanimljivo okruženje za učenje i razvoj u ovoj ulozi.`),
          paragraph3: gender === 'female'
            ? 'Dostupna sam za razgovor u terminu koji vama odgovara.'
            : gender === 'male'
              ? 'Dostupan sam za razgovor u terminu koji vama odgovara.'
              : 'Razgovor je moguće dogovoriti u terminu koji vama odgovara.',
          closing: 'Hvala na vašem vremenu i razmatranju.',
          signOff: 'Srdačno',
        },
    hr: {
      greeting: `Poštovani tim za zapošljavanje u tvrtki ${company},`,
      paragraph1: gender === 'female'
        ? `Ovim putem se prijavljujem za ${hrPoziciju}${hrGloss} u tvrtki ${company}. ${
          confident
            ? 'Motivirana sam posvetiti se zahtjevima uloge, brzo usvojiti potrebna znanja i odgovorno doprinijeti radu tima.'
            : friendly
              ? 'Radujem se prilici da se pridružim vašem timu, učim u toj ulozi i doprinosim zajedničkim ciljevima.'
              : 'Spremna sam upoznati se sa zahtjevima uloge, odgovorno pristupiti povjerenim zadacima i aktivno doprinositi radu tima.'
        }`
        : gender === 'male'
          ? `Ovim putem se prijavljujem za ${hrPoziciju}${hrGloss} u tvrtki ${company}. ${
            confident
              ? 'Motiviran sam posvetiti se zahtjevima uloge, brzo usvojiti potrebna znanja i odgovorno doprinijeti radu tima.'
              : friendly
                ? 'Radujem se prilici da se pridružim vašem timu, učim u toj ulozi i doprinosim zajedničkim ciljevima.'
                : 'Spreman sam upoznati se sa zahtjevima uloge, odgovorno pristupiti povjerenim zadacima i aktivno doprinositi radu tima.'
          }`
          : `Ovim putem se prijavljujem za ${hrPoziciju}${hrGloss} u tvrtki ${company}. Želim upoznati zahtjeve uloge i odgovorno doprinositi radu tima.`,
      paragraph2: extraSentence
        || (gender === 'female'
          ? (friendly
            ? `Zainteresirana sam za ${hrPoziciju} jer vidim priliku za učenje i suradnju u timu.`
            : `Ovu priliku vidim kao smislen sljedeći korak u svom profesionalnom razvoju i mogućnost da se razvijam u području vezanom uz ${hrPoziciju}.`)
          : gender === 'male'
            ? (friendly
              ? `Zainteresiran sam za ${hrPoziciju} jer vidim priliku za učenje i suradnju u timu.`
              : `Ovu priliku vidim kao smislen sljedeći korak u svom profesionalnom razvoju i mogućnost da se razvijam u području vezanom uz ${hrPoziciju}.`)
            : `Ovu priliku vidim kao smislen sljedeći korak profesionalnog razvoja u području vezanom uz ${hrPoziciju}.`),
      paragraph3: gender === 'female'
        ? (formal || (!confident && !friendly)
          ? 'Bila bih zahvalna na prilici da svoju motivaciju detaljnije predstavim na razgovoru. Dostupna sam u terminu koji vama odgovara.'
          : 'Dostupna sam za razgovor u terminu koji vama odgovara.')
        : gender === 'male'
          ? (formal || (!confident && !friendly)
            ? 'Bio bih zahvalan na prilici da svoju motivaciju detaljnije predstavim na razgovoru. Dostupan sam u terminu koji vama odgovara.'
            : 'Dostupan sam za razgovor u terminu koji vama odgovara.')
          : 'Razgovor je moguće dogovoriti u terminu koji vama odgovara.',
      closing: 'Hvala na vašem vremenu i razmatranju.',
      signOff: 'Srdačan pozdrav',
    },
    ru: {
      greeting: `Уважаемая команда по подбору персонала ${company},`,
      paragraph1: gender === 'female'
        ? `Обращаюсь к вам, чтобы выразить интерес к позиции ${role} в компании ${company}. Буду рада возможности присоединиться к вашей команде, учиться в этой роли и вносить полезный вклад.`
        : gender === 'male'
          ? `Обращаюсь к вам, чтобы выразить интерес к позиции ${role} в компании ${company}. Буду рад возможности присоединиться к вашей команде, учиться в этой роли и вносить полезный вклад.`
          : `Обращаюсь к вам, чтобы выразить интерес к позиции ${role} в компании ${company}. Интересна возможность присоединиться к вашей команде, учиться в этой роли и вносить полезный вклад.`,
      paragraph2: extraSentence
        || 'Вакансия представляет интерес как конкретный шаг профессионального развития. С удовольствием обсужу заявление и ожидания к роли.',
      paragraph3: gender === 'female'
        ? 'Готова к собеседованию в удобное для вас время.'
        : gender === 'male'
          ? 'Готов к собеседованию в удобное для вас время.'
          : 'Собеседование можно назначить в удобное для вас время.',
      closing: 'Спасибо за ваше время и рассмотрение.',
      signOff: 'С уважением',
    },
    'pt-BR': {
      greeting: `Prezada equipe de recrutamento da ${company},`,
      paragraph1: gender === 'female'
        ? `escrevo para expressar meu interesse na vaga de ${ptRole} na ${company}. Estou motivada para assumir as responsabilidades do cargo, aprender os processos necessários e contribuir de forma ativa.`
        : gender === 'male'
          ? `escrevo para expressar meu interesse na vaga de ${ptRole} na ${company}. Estou motivado para assumir as responsabilidades do cargo, aprender os processos necessários e contribuir de forma ativa.`
          : `escrevo para expressar meu interesse na vaga de ${ptRole} na ${company}. Gostaria de assumir as responsabilidades do cargo, aprender os processos necessários e contribuir de forma ativa.`,
      paragraph2: extraSentence
        || `Vejo nessa posição uma oportunidade concreta para desenvolver minhas capacidades e agregar valor à organização. Acredito que a ${company} possa representar um ambiente propício ao meu desenvolvimento profissional.`,
      paragraph3: gender === 'female'
        ? 'Fico à disposição para uma entrevista e estou disposta a conversar sobre a candidatura.'
        : gender === 'male'
          ? 'Fico à disposição para uma entrevista e estou disposto a conversar sobre a candidatura.'
          : 'Fico à disposição para uma entrevista.',
      closing: 'Agradeço pelo tempo e pela consideração.',
      signOff: 'Atenciosamente',
    },
    hi: {
      greeting: `${company} की सम्मानित भर्ती टीम को,`,
      paragraph1: gender === 'female'
        ? `मैं ${company} में ${role} पद के लिए आवेदन प्रस्तुत कर रही हूँ। इस भूमिका की जिम्मेदारियों को समझने, आवश्यक प्रक्रियाएँ सीखने और टीम के उद्देश्यों में योगदान देने के लिए मैं प्रतिबद्ध हूँ।`
        : gender === 'male'
          ? `मैं ${company} में ${role} पद के लिए आवेदन प्रस्तुत कर रहा हूँ। इस भूमिका की जिम्मेदारियों को समझने, आवश्यक प्रक्रियाएँ सीखने और टीम के उद्देश्यों में योगदान देने के लिए मैं प्रतिबद्ध हूँ।`
          : `${company} में ${role} पद के लिए यह आवेदन प्रस्तुत है। भूमिका की जिम्मेदारियों को समझने तथा अपेक्षाओं को पूरा करने के लिए प्रतिबद्ध हूँ।`,
      paragraph2: extraSentence
        || (friendly
          ? (gender === 'female'
            ? `${company} में ${role} की भूमिका मुझे सार्थक अगला कदम लगती है। मैं अपेक्षाओं पर खरी उतरने के लिए टीम के साथ सहयोगी ढंग से योगदान देना चाहती हूँ।`
            : gender === 'male'
              ? `${company} में ${role} की भूमिका मुझे सार्थक अगला कदम लगता है। मैं अपेक्षाओं पर खरा उतरने के लिए टीम के साथ सहयोगी ढंग से योगदान देना चाहता हूँ।`
              : `${company} में ${role} की भूमिका एक सार्थक अगला कदम है। अपेक्षाओं को पूरा करने के लिए टीम के साथ योगदान देने का अवसर स्वागतयोग्य है।`)
          : (gender === 'female'
            ? `${company} में ${role} के पद पर कार्य करने का अवसर मेरे लिए व्यावसायिक विकास और जिम्मेदार योगदान का एक महत्वपूर्ण अवसर होगा। मैं अपेक्षाओं पर खरी उतरने हेतु जिम्मेदारियों को समझना चाहती हूँ।`
            : gender === 'male'
              ? `${company} में ${role} के पद पर कार्य करने का अवसर मेरे लिए व्यावसायिक विकास और जिम्मेदार योगदान का एक महत्वपूर्ण अवसर होगा। मैं अपेक्षाओं पर खरा उतरने हेतु जिम्मेदारियों को समझना चाहता हूँ।`
              : `${company} में ${role} के पद पर कार्य करने का अवसर व्यावसायिक विकास और जिम्मेदार योगदान का एक महत्वपूर्ण अवसर है। अपेक्षाओं को पूरा करने के लिए प्रतिबद्ध हूँ।`)),
      paragraph3: gender === 'unspecified'
        ? 'साक्षात्कार के माध्यम से आवेदन पर चर्चा करने का अवसर स्वागतयोग्य होगा।'
        : 'मैं साक्षात्कार के लिए उपलब्ध हूँ।',
      closing: 'समय और विचार के लिए धन्यवाद।',
      signOff: 'सादर',
    },
    ja: {
      greeting: `${company}採用ご担当者様`,
      paragraph1: confident
        ? `${company}の${role}職に応募いたします。必要な知識を迅速に習得し、業務に真摯に取り組みながら、着実に貢献してまいります。`
        : friendly
          ? `${company}の${role}職に応募いたします。チームの一員として前向きに学び、日々の業務に協力して貢献できれば幸いです。`
          : `${company}の${role}職に応募いたします。役割の責任を理解し、必要な過程を学びながら責任ある貢献を果たしたいと考えております。`,
      paragraph2: extraSentence
        || (confident
          ? '物流および顧客サポートの業務に関心を持っており、この分野で責任を持って貢献したいと考えております。'
          : friendly
            ? 'この分野の業務に関心があり、チームと関わりながら役割への期待を理解していきたいと考えております。'
            : '物流および顧客サポートの業務に関心を持っており、応募内容について伺い、役割への期待を理解したうえで貢献したいと考えております。'),
      paragraph3: '面接の機会をいただけますと幸いです。',
      closing: 'ご多忙のところ恐縮ですが、ご検討のほど何卒よろしくお願いいたします。',
      signOff: '敬具',
    },
  };
  void formal;
  return templates[locale] ?? templates.en;
}

function extrasFromFacts(factSet: CoverLetterFactSet, locale: Locale): string[] {
  const education = factSet.facts.filter((f) => f.type === 'education').map((f) => f.value);
  const skills = factSet.facts
    .filter((f) => f.type === 'skill' || f.type === 'tool' || f.type === 'programming_language')
    .map((f) => f.value);
  const work = factSet.facts.filter((f) => f.type === 'work_history').map((f) => f.value);
  const bits: string[] = [];
  if (education[0]) {
    if (locale === 'ar') bits.push(`خلفيتي التعليمية تشمل: ${education[0]}.`);
    else if (locale === 'hi') bits.push(`मेरी शैक्षिक पृष्ठभूमि में ${education[0]} शामिल है।`);
    else if (locale === 'en') bits.push(`My education includes ${education[0]}.`);
    else bits.push(`My education includes ${education[0]}.`);
  }
  if (skills[0]) {
    if (locale === 'ar') bits.push(`من مهاراتي: ${skills.slice(0, 3).join('، ')}.`);
    else if (locale === 'hi') bits.push(`मेरे कौशल में ${skills.slice(0, 3).join(', ')} शामिल हैं।`);
    else if (locale === 'en') bits.push(`My skills include ${skills.slice(0, 3).join(', ')}.`);
    else bits.push(`My skills include ${skills.slice(0, 3).join(', ')}.`);
  }
  if (work[0] && !skills[0] && !education[0]) {
    if (locale === 'ar') bits.push(`من خبرتي المهنية: ${work[0]}.`);
    else if (locale === 'hi') bits.push(`मेरे कार्य अनुभव में ${work[0]} शामिल है।`);
    else if (locale === 'en') bits.push(`My work experience includes ${work[0]}.`);
    else bits.push(`My work experience includes ${work[0]}.`);
  }
  // Avoid English-only extras leaking into other locales.
  if (locale !== 'en' && locale !== 'ar' && locale !== 'hi') {
    return [];
  }
  return bits;
}

export function buildDeterministicSparseCoverLetter(
  locale: Locale,
  options: {
    candidateName: string;
    jobTitle: string;
    companyName: string;
    factSet: CoverLetterFactSet;
    dateLine: string;
    gender?: CoverLetterGender | string;
    tone?: Tone | string;
  },
): StructuredCoverLetter {
  const role = options.jobTitle.trim() || 'the role';
  const company = options.companyName.trim() || 'the company';
  const name = options.candidateName.trim() || 'Candidate';
  const gender = normalizeCoverLetterGender(options.gender);
  const tone = normalizeTone(options.tone);
  const extras = extrasFromFacts(options.factSet, locale);
  const parts = fallbackParts(locale, name, role, company, extras, gender, tone);
  return {
    dateLine: options.dateLine,
    greeting: parts.greeting,
    paragraph1: parts.paragraph1,
    paragraph2: parts.paragraph2,
    paragraph3: parts.paragraph3,
    closing: parts.closing,
    signOff: parts.signOff,
    candidateName: name,
  };
}
