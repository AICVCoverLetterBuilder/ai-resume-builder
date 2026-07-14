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
  | 'experience_strength_claim'
  | 'meta_or_system_wording';

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

  // Internal / meta wording must never reach the employer
  for (const matched of collectMatches(text, META_WORDING_PATTERNS)) {
    violations.push({ kind: 'meta_or_system_wording', matched });
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
    'Never mention source facts, limited information, CV data, AI, validation, prompts, or fallbacks in the letter.',
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

function fallbackParts(locale: Locale, name: string, role: string, company: string, extras: string[]): FallbackParts {
  const extraSentence = extras.length ? extras.join(' ') : '';
  const templates: Record<Locale, FallbackParts> = {
    en: {
      greeting: `Dear Hiring Team at ${company},`,
      paragraph1: `I am writing to express my interest in the ${role} position at ${company}. I would welcome the opportunity to join your team, learn within the role, and contribute to your work.`,
      paragraph2: extraSentence
        || 'This opportunity appeals to me, and I am motivated to approach it with commitment and a willingness to grow.',
      paragraph3: 'I would be pleased to discuss my application and learn more about the position.',
      closing: 'Thank you for your time and consideration.',
      signOff: 'Sincerely',
    },
    de: {
      greeting: `Sehr geehrtes Bewerbungsteam von ${company},`,
      paragraph1: `hiermit bekunde ich mein Interesse an der Position als ${role} bei ${company}. Ich würde mich freuen, Teil Ihres Teams zu werden, in der Rolle dazuzulernen und zum gemeinsamen Erfolg beizutragen.`,
      paragraph2: extraSentence
        || 'Diese Aufgabe spricht mich an, und ich gehe sie mit Engagement und der Bereitschaft an, weiterzuwachsen.',
      paragraph3: 'Gerne erläutere ich meine Bewerbung in einem persönlichen Gespräch und erfahre mehr über die Position.',
      closing: 'Vielen Dank für Ihre Zeit und Ihre Berücksichtigung.',
      signOff: 'Mit freundlichen Grüßen',
    },
    es: {
      greeting: `Estimado equipo de selección de ${company}:`,
      paragraph1: `Le escribo para expresar mi interés en el puesto de ${role} en ${company}. Me gustaría unirme a su equipo, aprender en el rol y aportar a su trabajo.`,
      paragraph2: extraSentence
        || 'Esta oportunidad me resulta atractiva y me motiva afrontarla con compromiso y disposición a crecer.',
      paragraph3: 'Estaré encantado/a de hablar sobre mi candidatura y conocer mejor el puesto.',
      closing: 'Gracias por su tiempo y consideración.',
      signOff: 'Atentamente',
    },
    fr: {
      greeting: `Madame, Monsieur, équipe de recrutement de ${company},`,
      paragraph1: `Je vous écris pour vous faire part de mon intérêt pour le poste de ${role} chez ${company}. Je serais ravi(e) de rejoindre votre équipe, d'apprendre dans ce rôle et de contribuer à vos projets.`,
      paragraph2: extraSentence
        || `Cette opportunité m'attire, et je souhaite l'aborder avec engagement et une volonté de progresser.`,
      paragraph3: `Je serais heureux(se) d'échanger sur ma candidature et d'en savoir davantage sur le poste.`,
      closing: `Je vous remercie pour votre temps et votre considération.`,
      signOff: 'Cordialement',
    },
    it: {
      greeting: `Gentile team di selezione di ${company},`,
      paragraph1: `scrivo per esprimere il mio interesse per la posizione di ${role} presso ${company}. Sarei lieto/a di unirmi al vostro team, imparare nel ruolo e contribuire al vostro lavoro.`,
      paragraph2: extraSentence
        || `Questa opportunità mi stimola e intendo affrontarla con impegno e voglia di crescere.`,
      paragraph3: `Sarei felice di approfondire la mia candidatura e saperne di più sulla posizione.`,
      closing: `Grazie per il vostro tempo e la vostra considerazione.`,
      signOff: 'Cordiali saluti',
    },
    ar: {
      greeting: `إلى فريق التوظيف المحترم في شركة ${company}،`,
      paragraph1: `أتقدم بطلب لشغل وظيفة ${role} لدى شركة ${company}. يسرّني الانضمام إلى فريقكم والتعلّم ضمن هذا الدور والمساهمة في أعمالكم.`,
      paragraph2: extraSentence
        || 'تهتمّني هذه الفرصة، وأرغب في التعامل معها بالتزام ورغبة في التطوّر المهني.',
      paragraph3: 'يسعدني مناقشة طلبي ومعرفة المزيد عن الوظيفة.',
      closing: 'شكرًا لوقتكم واهتمامكم.',
      signOff: 'مع خالص التحية',
    },
    sr: {
      greeting: `Poštovani tim za zapošljavanje u kompaniji ${company},`,
      paragraph1: `pišem vam kako bih izrazio/la interesovanje za poziciju ${role} u kompaniji ${company}. Rado bih se priključio/la vašem timu, učio/la u toj ulozi i doprinosio/la vašem radu.`,
      paragraph2: extraSentence
        || 'Ova prilika mi je privlačna i pristupio/la bih joj odgovorno, uz želju da rastem.',
      paragraph3: 'Sa zadovoljstvom bih razgovarao/la o prijavi i saznao/la više o poziciji.',
      closing: 'Hvala na vašem vremenu i razmatranju.',
      signOff: 'Srdačno',
    },
    hr: {
      greeting: `Poštovani tim za zapošljavanje u tvrtki ${company},`,
      paragraph1: `pišem kako bih izrazio/la interes za poziciju ${role} u tvrtki ${company}. Rado bih se pridružio/la vašem timu, učio/la u toj ulozi i pridonio/la vašem radu.`,
      paragraph2: extraSentence
        || 'Ova prilika mi je privlačna i pristupio/la bih joj s predanošću i željom za rastom.',
      paragraph3: 'Rado bih razgovarao/la o prijavi i saznao/la više o poziciji.',
      closing: 'Hvala na vašem vremenu i razmatranju.',
      signOff: 'Srdačan pozdrav',
    },
    ru: {
      greeting: `Уважаемая команда по подбору персонала ${company},`,
      paragraph1: `пишу, чтобы выразить интерес к позиции ${role} в компании ${company}. Буду рад(а) присоединиться к вашей команде, учиться в этой роли и вносить вклад в вашу работу.`,
      paragraph2: extraSentence
        || 'Эта возможность мне близка, и я готов(а) подойти к ней ответственно, с желанием расти.',
      paragraph3: 'Буду рад(а) обсудить моё заявление и узнать больше о вакансии.',
      closing: 'Спасибо за ваше время и рассмотрение.',
      signOff: 'С уважением',
    },
    'pt-BR': {
      greeting: `Prezada equipe de recrutamento da ${company},`,
      paragraph1: `escrevo para expressar meu interesse na vaga de ${role} na ${company}. Gostaria de me juntar à equipe, aprender no cargo e contribuir com o trabalho de vocês.`,
      paragraph2: extraSentence
        || 'Essa oportunidade me atrai, e quero enfrentá-la com compromisso e vontade de crescer.',
      paragraph3: 'Ficaria feliz em conversar sobre minha candidatura e saber mais sobre a vaga.',
      closing: 'Obrigado(a) pelo tempo e pela consideração.',
      signOff: 'Atenciosamente',
    },
    hi: {
      greeting: `${company} की सम्मानित भर्ती टीम को,`,
      paragraph1: `मैं ${company} में ${role} पद के प्रति अपनी रुचि व्यक्त करने के लिए लिख रहा/रही हूँ। मुझे आपकी टीम में शामिल होने, इस भूमिका में सीखने और आपके कार्य में योगदान देने का अवसर मिले तो मुझे प्रसन्नता होगी।`,
      paragraph2: extraSentence
        || 'यह अवसर मुझे आकर्षित करता है, और मैं इसे प्रतिबद्धता तथा आगे बढ़ने की इच्छा के साथ अपनाना चाहता/चाहती हूँ।',
      paragraph3: 'मुझे अपने आवेदन पर चर्चा करने और पद के बारे में और जानने में खुशी होगी।',
      closing: 'आपके समय और विचार के लिए धन्यवाद।',
      signOff: 'सादर',
    },
    ja: {
      greeting: `${company}採用ご担当者様`,
      paragraph1: `${company}の${role}職に強い関心があり、ご連絡申し上げます。貴社の一員として学びながら業務に貢献できれば幸いです。`,
      paragraph2: extraSentence
        || '本機会に魅力を感じており、誠実な姿勢と成長意欲をもって取り組みたいと考えております。',
      paragraph3: '応募内容について伺い、職位についてさらに理解を深める機会をいただけますと幸いです。',
      closing: 'ご多忙のところ恐縮ですが、ご検討のほど何卒よろしくお願いいたします。',
      signOff: '敬具',
    },
  };
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
