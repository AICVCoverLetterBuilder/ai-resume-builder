/**
 * Deterministic post-generation grounding validation for cover letters (all locales).
 */
import type { StructuredCoverLetter } from './cover-letter-generation';
import {
  factSetAllowsLeadership,
  type CoverLetterFactSet,
} from './cover-letter-facts';
import type { Locale } from '@/lib/i18n/translations';

export type GroundingViolationKind =
  | 'numeric_claim'
  | 'named_skill_or_tool'
  | 'leadership_claim'
  | 'achievement_claim'
  | 'experience_strength_claim';

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
  'java',
  'c\\+\\+',
  'c#',
  'golang',
  '\\bgo\\b',
  'rust',
  'kotlin',
  'swift',
  'ruby',
  'php',
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
  'sql',
  'mysql',
  'postgresql',
  'mongodb',
  'redis',
  'aws',
  'azure',
  'gcp',
  'google cloud',
  'docker',
  'kubernetes',
  'devops',
  'ci/?cd',
  'continuous integration',
  'agile',
  'scrum',
  'kanban',
  'oop',
  'object[- ]oriented',
  'crm',
  'erp',
  'salesforce',
  'sap',
  'tableau',
  'power bi',
  'excel',
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

export function validateCoverLetterGrounding(
  content: string,
  factSet: CoverLetterFactSet,
): GroundingValidationResult {
  const text = normalizeForMatch(content);
  const violations: GroundingViolation[] = [];

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
    'The previous cover letter contained unsupported professional claims.',
    'Rewrite the ENTIRE JSON letter so that EVERY factual professional claim is supported by SOURCE FACTS.',
    'Remove or neutralize every unsupported claim listed below.',
    'Do not invent skills, tools, leadership, metrics, years of experience, or achievements.',
    'If SOURCE FACTS are sparse, write a short honest letter focused on interest, motivation, willingness to learn/contribute, and interview availability.',
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

function fallbackParts(locale: Locale, name: string, role: string, company: string, extras: string[]): FallbackParts {
  const extraSentence = extras.length
    ? extras.join(' ')
    : '';
  const templates: Record<Locale, FallbackParts> = {
    en: {
      greeting: `Dear ${company} Hiring Team,`,
      paragraph1: `I am writing to apply for the ${role} position at ${company}.`,
      paragraph2: extraSentence
        || 'I am motivated to learn, contribute, and grow with your team in this role.',
      paragraph3: `${company}'s work is of genuine interest to me, and I would value the opportunity to contribute.`,
      closing: 'I would welcome an interview to discuss how I can support your team. Thank you for your consideration.',
      signOff: 'Sincerely',
    },
    de: {
      greeting: `Sehr geehrte Damen und Herren bei ${company},`,
      paragraph1: `hiermit bewerbe ich mich um die Position als ${role} bei ${company}.`,
      paragraph2: extraSentence
        || 'Ich bin motiviert, zu lernen, beizutragen und mich in dieser Rolle weiterzuentwickeln.',
      paragraph3: `Die Arbeit von ${company} interessiert mich und ich würde gern zum Team beitragen.`,
      closing: 'Über eine Einladung zum Gespräch würde ich mich freuen. Vielen Dank für Ihre Zeit.',
      signOff: 'Mit freundlichen Grüßen',
    },
    es: {
      greeting: `Estimado equipo de ${company}:`,
      paragraph1: `Me dirijo a ustedes para postularme al puesto de ${role} en ${company}.`,
      paragraph2: extraSentence
        || 'Estoy motivado/a para aprender, aportar y crecer con su equipo en este rol.',
      paragraph3: `El trabajo de ${company} me interesa de verdad y valoro la oportunidad de contribuir.`,
      closing: 'Agradecería una entrevista para hablar sobre cómo puedo apoyar a su equipo. Gracias por su consideración.',
      signOff: 'Atentamente',
    },
    fr: {
      greeting: `Madame, Monsieur, équipe ${company},`,
      paragraph1: `Je vous écris pour postuler au poste de ${role} chez ${company}.`,
      paragraph2: extraSentence
        || 'Je suis motivé(e) à apprendre, à contribuer et à évoluer avec votre équipe.',
      paragraph3: `Le travail de ${company} m'intéresse réellement et je serais heureux(se) d'y contribuer.`,
      closing: 'Je serais ravi(e) d\'échanger lors d\'un entretien. Merci pour votre considération.',
      signOff: 'Cordialement',
    },
    it: {
      greeting: `Gentile team di ${company},`,
      paragraph1: `scrivo per candidarmi alla posizione di ${role} presso ${company}.`,
      paragraph2: extraSentence
        || 'Sono motivato/a a imparare, contribuire e crescere con il vostro team in questo ruolo.',
      paragraph3: `Il lavoro di ${company} mi interessa davvero e apprezzerei l'opportunità di contribuire.`,
      closing: 'Sarei lieto/a di un colloquio per discutere come posso supportare il team. Grazie per la considerazione.',
      signOff: 'Cordiali saluti',
    },
    ar: {
      greeting: `السادة فريق التوظيف في ${company}،`,
      paragraph1: `أكتب للتقدم لشغل وظيفة ${role} لدى شركة ${company}.`,
      paragraph2: extraSentence
        || 'أودّ أن أتعلّم وأساهم وأنمو مع فريقكم في هذا الدور.',
      paragraph3: `يهتمّني عمل ${company}، ويسعدني إتاحة الفرصة للمساهمة معكم.`,
      closing: 'أتطلع إلى فرصة لمناقشة كيف يمكنني المساهمة في فريقكم. شكرًا لوقتكم واهتمامكم.',
      signOff: 'مع خالص التحية',
    },
    sr: {
      greeting: `Poštovani tim ${company},`,
      paragraph1: `pišem vam da se prijavim za poziciju ${role} u kompaniji ${company}.`,
      paragraph2: extraSentence
        || 'Motervisani/a sam da učim, doprinosim i rastem zajedno sa vašim timom na ovoj poziciji.',
      paragraph3: `Rad kompanije ${company} me iskreno zanima i želeo/la bih da doprinesem timu.`,
      closing: 'Radujem se razgovoru i zahvaljujem na razmatranju.',
      signOff: 'Srdačno',
    },
    hr: {
      greeting: `Poštovani tim ${company},`,
      paragraph1: `pišem vam kako bih se prijavio/la za poziciju ${role} u tvrtki ${company}.`,
      paragraph2: extraSentence
        || 'Motiviran/a sam učiti, doprinositi i rasti zajedno s vašim timom na ovoj poziciji.',
      paragraph3: `Rad tvrtke ${company} me iskreno zanima i želio/ljela bih doprinijeti timu.`,
      closing: 'Radujem se razgovoru i zahvaljujem na razmatranju.',
      signOff: 'Srdačan pozdrav',
    },
    ru: {
      greeting: `Уважаемая команда ${company},`,
      paragraph1: `обращаюсь к вам, чтобы подать заявку на позицию ${role} в компании ${company}.`,
      paragraph2: extraSentence
        || 'Я мотивирован(а) учиться, вносить вклад и развиваться вместе с вашей командой.',
      paragraph3: `Работа ${company} мне по-настоящему интересна, и я был(а) бы рад(а) внести вклад.`,
      closing: 'Буду рад(а) обсудить это на собеседовании. Спасибо за рассмотрение.',
      signOff: 'С уважением',
    },
    'pt-BR': {
      greeting: `Prezada equipe da ${company},`,
      paragraph1: `escrevo para me candidatar à vaga de ${role} na ${company}.`,
      paragraph2: extraSentence
        || 'Estou motivado(a) a aprender, contribuir e crescer com a equipe nesse papel.',
      paragraph3: `O trabalho da ${company} é de real interesse para mim, e valorizo a chance de contribuir.`,
      closing: 'Ficaria feliz em conversar em uma entrevista. Obrigado(a) pela consideração.',
      signOff: 'Atenciosamente',
    },
    hi: {
      greeting: `${company} की भर्ती टीम को,`,
      paragraph1: `मैं ${company} में ${role} पद के लिए आवेदन कर रहा/रही हूँ।`,
      paragraph2: extraSentence
        || 'मैं इस भूमिका में सीखने, योगदान देने और आपकी टीम के साथ आगे बढ़ने के लिए प्रेरित हूँ।',
      paragraph3: `${company} का कार्य मुझे वास्तव में रुचिकर लगता है, और मैं योगदान देने का अवसर चाहूँगा/चाहूँगी।`,
      closing: 'साक्षात्कार में चर्चा का अवसर मिलने पर मुझे प्रसन्नता होगी। आपके समय के लिए धन्यवाद।',
      signOff: 'सादर',
    },
    ja: {
      greeting: `${company}採用ご担当者様`,
      paragraph1: `${company}の${role}職に応募いたしたく、ご連絡申し上げます。`,
      paragraph2: extraSentence
        || '本職において学び、貢献し、チームとともに成長したいと考えております。',
      paragraph3: `${company}の取り組みに関心があり、貢献の機会をいただけますと幸いです。`,
      closing: '面接にてお話しできる機会をいただけますと幸いです。ご検討のほど、何卒よろしくお願いいたします。',
      signOff: '敬具',
    },
  };
  const base = templates[locale] ?? templates.en;
  return base;
}

function extrasFromFacts(factSet: CoverLetterFactSet, locale: Locale): string[] {
  const education = factSet.facts.filter((f) => f.type === 'education').map((f) => f.value);
  const skills = factSet.facts
    .filter((f) => f.type === 'skill' || f.type === 'tool' || f.type === 'programming_language')
    .map((f) => f.value);
  const work = factSet.facts.filter((f) => f.type === 'work_history').map((f) => f.value);
  const bits: string[] = [];
  if (education[0]) {
    if (locale === 'ar') bits.push(`ومن خلفيتي التعليمية: ${education[0]}.`);
    else if (locale === 'hi') bits.push(`मेरी शैक्षिक पृष्ठभूमि में ${education[0]} शामिल है।`);
    else bits.push(`My education includes ${education[0]}.`);
  }
  if (skills[0]) {
    if (locale === 'ar') bits.push(`ومن المهارات المذكورة: ${skills.slice(0, 3).join('، ')}.`);
    else if (locale === 'hi') bits.push(`मेरे पास ${skills.slice(0, 3).join(', ')} जैसे कौशल हैं।`);
    else bits.push(`Relevant supplied skills include ${skills.slice(0, 3).join(', ')}.`);
  }
  if (work[0] && !skills[0] && !education[0]) {
    if (locale === 'ar') bits.push(`ومن خبرتي المهنية المصرّح بها: ${work[0]}.`);
    else if (locale === 'hi') bits.push(`मेरे पास उल्लेखित अनुभव है: ${work[0]}.`);
    else bits.push(`My supplied work history includes ${work[0]}.`);
  }
  // Prefer locale-neutral short extras for non en/hi/ar by using English only as last resort —
  // for other locales fall back to motivation-only when extras would be English.
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
  },
): StructuredCoverLetter {
  const role = options.jobTitle.trim() || 'the role';
  const company = options.companyName.trim() || 'the company';
  const name = options.candidateName.trim() || 'Candidate';
  const extras = extrasFromFacts(options.factSet, locale);
  const parts = fallbackParts(locale, name, role, company, extras);
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
