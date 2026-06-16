import type { PersonalInfo, WorkExperience, Tone } from './types';
import type { Locale } from './i18n/translations';

const localizedAnalysisSuggestions: Record<Locale, string[]> = {
  en: [
    'Add measurable results such as percentages, revenue, or delivery volume.',
    'Mirror the most important keywords from the job description in your CV.',
    'Tailor your professional summary to the exact role and industry.',
    'Highlight relevant certifications, tools, and recent training.',
  ],
  'pt-BR': [
    'Inclua resultados mensuráveis, como percentuais, receita ou volume de entregas.',
    'Replique no CV as palavras-chave mais importantes da vaga.',
    'Adapte seu resumo profissional ao cargo e ao setor específicos.',
    'Destaque certificações, ferramentas e treinamentos recentes relevantes.',
  ],
  de: [
    'Fügen Sie messbare Ergebnisse wie Prozentsätze, Umsatz oder Lieferumfang hinzu.',
    'Übernehmen Sie die wichtigsten Schlüsselwörter aus der Stellenbeschreibung in den Lebenslauf.',
    'Passen Sie Ihre Zusammenfassung gezielt an Rolle und Branche an.',
    'Heben Sie relevante Zertifikate, Tools und aktuelle Weiterbildungen hervor.',
  ],
  es: [
    'Añade resultados medibles, como porcentajes, ingresos o volumen de entregas.',
    'Refleja en tu CV las palabras clave más importantes de la oferta.',
    'Adapta tu resumen profesional al puesto y al sector concretos.',
    'Destaca certificaciones, herramientas y formación reciente relevantes.',
  ],
  fr: [
    'Ajoutez des résultats mesurables comme des pourcentages, du chiffre d’affaires ou du volume livré.',
    'Réutilisez dans votre CV les mots-clés les plus importants de l’offre.',
    'Adaptez votre résumé professionnel au poste et au secteur visés.',
    'Mettez en avant les certifications, outils et formations récentes pertinents.',
  ],
  it: [
    'Aggiungi risultati misurabili come percentuali, ricavi o volumi di consegna.',
    'Riprendi nel CV le parole chiave più importanti dell’annuncio.',
    'Adatta il riepilogo professionale al ruolo e al settore specifici.',
    'Metti in evidenza certificazioni, strumenti e formazione recente pertinenti.',
  ],
  ar: [
    'أضف نتائج قابلة للقياس مثل النسب المئوية أو الإيرادات أو حجم الإنجاز.',
    'استخدم في سيرتك الذاتية أهم الكلمات المفتاحية الموجودة في الوصف الوظيفي.',
    'خصّص الملخص المهني ليتوافق مع الوظيفة والقطاع المستهدفين.',
    'أبرز الشهادات والأدوات والدورات الحديثة ذات الصلة.',
  ],
  sr: [
    'Dodajte merljive rezultate kao što su procenti, prihod ili obim isporuke.',
    'Uskladite CV sa najvažnijim ključnim rečima iz oglasa.',
    'Prilagodite profesionalni sažetak konkretnoj ulozi i industriji.',
    'Istaknite relevantne sertifikate, alate i skorašnje obuke.',
  ],
  hr: [
    'Dodajte mjerljive rezultate poput postotaka, prihoda ili opsega isporuke.',
    'Uskladite životopis s najvažnijim ključnim riječima iz oglasa.',
    'Prilagodite profesionalni sažetak točnoj ulozi i industriji.',
    'Istaknite relevantne certifikate, alate i nedavne edukacije.',
  ],
  ru: [
    'Добавьте измеримые результаты: проценты, выручку или объём выполненной работы.',
    'Используйте в CV самые важные ключевые слова из описания вакансии.',
    'Адаптируйте профессиональное резюме под конкретную роль и отрасль.',
    'Подчеркните релевантные сертификаты, инструменты и недавнее обучение.',
  ],
  hi: [
    'मापनीय उपलब्धियाँ जोड़ें, जैसे प्रतिशत, राजस्व या डिलीवरी वॉल्यूम।',
    'जॉब विवरण के सबसे महत्वपूर्ण कीवर्ड अपने CV में शामिल करें।',
    'अपने प्रोफेशनल सारांश को भूमिका और उद्योग के अनुसार अनुकूलित करें।',
    'संबंधित प्रमाणपत्र, टूल्स और हालिया प्रशिक्षण को प्रमुखता दें।',
  ],
  ja: [
    '割合、売上、対応件数など、測定できる成果を追加してください。',
    '求人票の重要なキーワードを職務経歴書にも反映してください。',
    '職種と業界に合わせて職務要約を最適化してください。',
    '関連する資格、ツール、最新の研修実績を強調してください。',
  ],
};

const summaryTemplates: Record<string, string[]> = {
  tech: [
    'Results-driven {title} with extensive experience in designing and implementing scalable solutions. Proven track record of delivering high-quality software that drives business growth. Passionate about clean code, modern architectures, and continuous improvement.',
    'Innovative {title} specializing in building robust, user-centric applications. Adept at collaborating with cross-functional teams to translate complex requirements into elegant technical solutions.',
  ],
  marketing: [
    'Creative and data-driven {title} with a proven ability to develop and execute campaigns that increase brand awareness and drive revenue. Expert in digital marketing strategies, content creation, and analytics.',
    'Dynamic {title} with deep expertise in brand development, customer engagement, and growth marketing. Combines creative vision with analytical rigor to deliver measurable results.',
  ],
  executive: [
    'Visionary {title} with {years}+ years of leadership experience driving organizational transformation and revenue growth. Proven ability to build high-performing teams and develop strategies that deliver sustainable competitive advantage.',
    'Strategic {title} known for building and scaling businesses from the ground up. Expert in P&L management, stakeholder relations, and operational excellence.',
  ],
  general: [
    'Dedicated {title} with a strong background in delivering exceptional results. Known for attention to detail, strong work ethic, and the ability to thrive in fast-paced environments.',
    'Experienced {title} committed to excellence and continuous professional development. Brings a combination of technical expertise and strong interpersonal skills.',
  ],
};

function categorizeJob(title: string): string {
  const lower = title.toLowerCase();
  if (/software|developer|engineer|devops|data|it|programmer|web|frontend|backend|sre|cloud|platform|ml|ai|machine learning|cyber|network|system/.test(lower)) return 'tech';
  if (/market|brand|content|social|seo|sem|growth|digital|campaign|copywriter|ux|ui|design|creative/.test(lower)) return 'marketing';
  if (/sales|account exec|account manager|business dev|bdr|sdr|revenue|commercial/.test(lower)) return 'executive';
  if (/ceo|cto|coo|cfo|director|vp|vice president|executive|chief|head of|managing|president/.test(lower)) return 'executive';
  return 'general';
}

export function generateSummary(personal: PersonalInfo, experience: WorkExperience[]): string {
  const category = categorizeJob(personal.jobTitle);
  const templates = summaryTemplates[category];
  const template = templates[Math.floor(Math.random() * templates.length)];
  const years = experience.length > 0 ? Math.max(2, experience.length * 3) : 2;
  return template.replace('{title}', personal.jobTitle || 'Professional').replace('{years}', String(years));
}

export function generateBulletPoints(position: string, company: string): string {
  const lower = position.toLowerCase();
  const co = company || 'the organisation';

  // Tech roles
  if (/software|developer|engineer|frontend|backend|fullstack|devops|sre|platform|cloud/.test(lower)) {
    return [
      `Developed and shipped features using modern frameworks, working closely with product and design`,
      `Reviewed pull requests and maintained coding standards across the team`,
      `Debugged and resolved production issues, improving platform stability`,
      `Collaborated with engineering teams at ${co} to design and implement backend services`,
    ].map(b => `• ${b}`).join('\n');
  }

  // Data / ML / AI roles
  if (/data|analyst|scientist|ml|machine learning|bi |intelligence/.test(lower)) {
    return [
      `Built and maintained data pipelines for reporting and business intelligence at ${co}`,
      `Developed dashboards and visualisations to support data-driven decision-making`,
      `Performed exploratory data analysis and communicated findings to stakeholders`,
      `Worked with SQL and Python to clean, transform, and model datasets`,
    ].map(b => `• ${b}`).join('\n');
  }

  // Sales roles
  if (/sales|account exec|bdr|sdr|business dev|commercial|revenue/.test(lower)) {
    return [
      `Managed a pipeline of prospects using CRM tools, tracking outreach and deal progress`,
      `Conducted discovery calls and product demos to qualify and convert leads`,
      `Built relationships with key client contacts and supported renewal and upsell motions`,
      `Collaborated with marketing at ${co} to follow up on inbound leads and campaign responses`,
    ].map(b => `• ${b}`).join('\n');
  }

  // Marketing roles
  if (/market|brand|content|seo|sem|growth|campaign|social|copywriter/.test(lower)) {
    return [
      `Planned and executed digital marketing campaigns across email, paid, and social channels`,
      `Tracked campaign performance using analytics tools and reported on key metrics`,
      `Created and managed content for multiple channels, maintaining brand voice consistency`,
      `Supported product launches and go-to-market activities at ${co}`,
    ].map(b => `• ${b}`).join('\n');
  }

  // Finance roles
  if (/financ|accountant|controller|fp&a|treasury|audit|tax/.test(lower)) {
    return [
      `Supported monthly financial close and prepared variance reports for management review`,
      `Maintained general ledger entries and reconciled balance sheet accounts`,
      `Assisted in preparing budgets and forecasts used for strategic planning at ${co}`,
      `Collaborated with external auditors and prepared supporting schedules`,
    ].map(b => `• ${b}`).join('\n');
  }

  // Executive / leadership roles
  if (/ceo|cto|coo|cfo|director|vp|head of|chief|executive|managing/.test(lower)) {
    return [
      `Directed strategic planning and aligned cross-functional teams around business priorities`,
      `Managed a team of senior leaders and established a culture of accountability and performance`,
      `Represented the organisation to key external stakeholders, partners, and investors`,
      `Led organisational transformation initiatives that improved operational efficiency at ${co}`,
    ].map(b => `• ${b}`).join('\n');
  }

  // Design roles
  if (/design|ux|ui|product design|graphic|visual/.test(lower)) {
    return [
      `Designed user interfaces and interactive prototypes in Figma for web and mobile products`,
      `Conducted usability testing and iterated on designs based on user feedback`,
      `Contributed components to the shared design system and maintained visual consistency`,
      `Collaborated with engineers and product managers to ship polished features at ${co}`,
    ].map(b => `• ${b}`).join('\n');
  }

  // Default general
  return [
    `Managed day-to-day responsibilities at ${co} with a focus on quality and reliability`,
    `Collaborated across teams to coordinate deliverables and meet project deadlines`,
    `Identified workflow improvements and contributed to process optimisation efforts`,
    `Supported onboarding and knowledge sharing for new team members`,
  ].map(b => `• ${b}`).join('\n');
}

export function rewriteText(text: string, style: 'shorter' | 'stronger' | 'professional'): string {
  switch (style) {
    case 'shorter':
      return text.split('. ').slice(0, 2).join('. ') + '.';
    case 'stronger':
      return text
        .replace(/good/gi, 'exceptional')
        .replace(/helped/gi, 'spearheaded')
        .replace(/worked on/gi, 'led')
        .replace(/responsible for/gi, 'drove')
        .replace(/managed/gi, 'orchestrated');
    case 'professional':
      return text
        .replace(/I /g, '')
        .replace(/my /gi, '')
        .replace(/really /gi, '')
        .replace(/very /gi, 'highly ');
    default:
      return text;
  }
}

export function generateCoverLetter(
  jobTitle: string,
  companyName: string,
  _country: string,
  tone: Tone,
  locale: string = 'en',
  personal?: PersonalInfo,
  variant: number = 0,
): string {
  const name = personal?.fullName || 'Your Name';
  const dateStr = new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });

  // Multiple varied templates per tone (variant cycles through them)
  const templates: Record<Tone, Array<{ greeting: string; intro: string; qualities: string; enthusiasm: string; closing: string }>> = {
    formal: [
      {
        greeting: 'Dear Hiring Manager,',
        intro: `I am writing to express my sincere interest in the ${jobTitle} position at ${companyName}. Having followed ${companyName}'s work closely, I am confident that my professional background aligns well with the requirements of this role.`,
        qualities: `Throughout my career, I have cultivated a strong ability to adapt to evolving environments, collaborate within cross-functional teams, and communicate complex ideas with clarity. My commitment to delivering high-quality results, combined with a structured approach to problem-solving, has enabled me to consistently meet and exceed expectations.`,
        enthusiasm: `I am particularly drawn to ${companyName} because of your dedication to excellence and innovation. The opportunity to contribute to your organisation's continued growth is one I approach with great enthusiasm and professionalism.`,
        closing: 'I would greatly appreciate the opportunity to discuss how my qualifications align with your team\'s objectives. Thank you for your time and consideration.',
      },
      {
        greeting: 'Dear Recruitment Team,',
        intro: `I respectfully submit my application for the ${jobTitle} role at ${companyName}. With a career built on consistent performance and professional development, I believe I am well-positioned to contribute meaningfully to your organisation.`,
        qualities: `I bring to this position a proven capacity for independent work, a disciplined approach to meeting deadlines, and the interpersonal skills necessary to foster productive professional relationships. My adaptability and analytical mindset have been key assets in navigating complex challenges throughout my career.`,
        enthusiasm: `${companyName}'s reputation for quality and strategic vision is a significant reason I am applying. I am eager to bring my expertise to a team that shares my commitment to professional standards and long-term impact.`,
        closing: 'I welcome the opportunity to elaborate on my suitability for this role at your convenience. I thank you for your consideration.',
      },
      {
        greeting: 'Dear Hiring Committee,',
        intro: `Please accept this letter as a formal expression of my interest in the ${jobTitle} vacancy at ${companyName}. I am confident that my experience and professional values are a strong match for what your team is seeking.`,
        qualities: `Over the course of my professional journey, I have demonstrated reliability, a methodical approach to problem-solving, and a consistent drive for excellence. Working effectively within teams while also performing independently has been central to my professional identity.`,
        enthusiasm: `I hold ${companyName} in high regard for its achievements and the way it approaches challenges within your industry. Contributing to such an organisation represents a genuine opportunity for meaningful professional engagement.`,
        closing: 'I would be pleased to provide any additional information required. Thank you for your time and consideration.',
      },
    ],
    confident: [
      {
        greeting: `Dear ${companyName} Team,`,
        intro: `I am applying for the ${jobTitle} position at ${companyName} with the conviction that I can make a measurable impact from day one. My track record of delivering results in fast-paced environments makes me a strong fit for this role.`,
        qualities: `I bring hands-on experience, sharp problem-solving instincts, and the ability to communicate effectively across all levels of an organisation. Whether working independently or driving team efforts, I consistently deliver above expectations and take ownership of outcomes.`,
        enthusiasm: `What draws me to ${companyName} is the ambition behind your work and the calibre of the team you have built. I thrive in environments where performance matters, and I am excited to bring that energy to your organisation.`,
        closing: 'I would welcome the chance to discuss how I can contribute to your team\'s success. Let\'s connect — I am ready to hit the ground running.',
      },
      {
        greeting: `Hello ${companyName} Hiring Team,`,
        intro: `The ${jobTitle} opening at ${companyName} is exactly the kind of challenge I have been seeking. I have a proven ability to move fast, solve hard problems, and create lasting value — and I am confident I can do that for your team.`,
        qualities: `Adaptability, strategic thinking, and clear communication are the strengths I bring to every role. I have a consistent track record of stepping into complex situations and delivering results that exceed initial targets, both as an individual contributor and as part of collaborative teams.`,
        enthusiasm: `${companyName} stands out to me because of your forward-thinking approach and the real-world impact of your work. I want to be part of a team that raises the bar, and I believe that is exactly what you do.`,
        closing: `I am enthusiastic about the possibility of joining ${companyName} and would love to explore this further. I look forward to hearing from you.`,
      },
      {
        greeting: `Dear ${companyName} Leadership,`,
        intro: `I am a results-driven professional with a clear focus on impact, and the ${jobTitle} role at ${companyName} is a perfect match for my skills and ambition. I do not just meet expectations — I consistently raise them.`,
        qualities: `My professional strengths include rapid problem diagnosis, confident decision-making under pressure, and the ability to align diverse teams toward shared goals. I combine technical capability with strong interpersonal skills to drive outcomes that matter.`,
        enthusiasm: `I am genuinely excited about ${companyName}'s direction and the scale of what you are building. I want to contribute to that momentum and believe I have exactly what it takes to make a meaningful difference.`,
        closing: 'I would be glad to discuss the value I can bring to your team. Thank you for your time — I look forward to our conversation.',
      },
    ],
    friendly: [
      {
        greeting: `Hello ${companyName} Team,`,
        intro: `I was genuinely excited to come across the ${jobTitle} opening at ${companyName}! Your company's work has caught my attention for a while, and I would love the chance to be part of what you are building.`,
        qualities: `I am someone who brings energy, curiosity, and genuine care to everything I do. I work well with others, adapt quickly to new situations, and enjoy finding creative solutions to tricky problems. I also believe that clear, warm communication makes teams stronger — and I try to bring that wherever I go.`,
        enthusiasm: `What really draws me to ${companyName} is the culture and the sense of purpose behind your work. I am at my best when I am surrounded by people who are passionate and collaborative, and that feels like exactly what you have built.`,
        closing: 'I would love to have a chat about how I could contribute to your team. Thank you so much for taking the time to read this — I hope to hear from you soon!',
      },
      {
        greeting: `Hi ${companyName} Team,`,
        intro: `When I spotted the ${jobTitle} role at ${companyName}, I knew I had to apply. Your company has a reputation that really resonates with me, and I think my background could be a great fit for your team.`,
        qualities: `I bring a positive attitude, solid teamwork skills, and a genuine passion for what I do. I am the kind of person who stays curious, keeps improving, and always tries to make the people around me better. Communication comes naturally to me, and I genuinely enjoy collaborating to solve challenges together.`,
        enthusiasm: `I admire how ${companyName} approaches its work — there is real intention behind what you do, and that matters to me. I would love to bring my own enthusiasm and dedication to a team with that kind of spirit.`,
        closing: 'Thank you for considering my application! I would really enjoy the chance to learn more about the role and share a bit more about myself. Looking forward to it!',
      },
      {
        greeting: `Hey ${companyName} Team,`,
        intro: `I am reaching out because the ${jobTitle} position at ${companyName} feels like a really exciting opportunity — one that lines up naturally with where I am in my career and what I care about professionally.`,
        qualities: `I am motivated, adaptable, and genuinely enjoy working with others to achieve shared goals. I take my work seriously while keeping a warm, open approach to collaboration. Whether it is tackling a complex problem or supporting a teammate, I bring both skill and enthusiasm to what I do.`,
        enthusiasm: `${companyName} stands out to me because of the thoughtful way you operate and the genuine impact your work creates. I want to be part of a team that is proud of what they do, and I believe yours is exactly that.`,
        closing: 'I would be thrilled to connect and talk more about the role. Thanks so much for your time, and I hope we get to speak soon!',
      },
    ],
  };

  const toneVariants = templates[tone];
  const selected = toneVariants[variant % toneVariants.length];

  return `${name}
${personal?.email || 'email@example.com'}
${personal?.phone || ''}

${dateStr}

${selected.greeting}

${selected.intro}

${selected.qualities}

${selected.enthusiasm}

${selected.closing}

Sincerely,
${name}`;
}

export function analyzeJobDescription(description: string, locale: Locale = 'en'): { missingSkills: string[]; keywords: string[]; suggestions: string[] } {
  const commonSkills = ['communication', 'leadership', 'problem-solving', 'teamwork', 'analytical', 'project management', 'time management', 'adaptability'];
  const techSkills = ['JavaScript', 'Python', 'React', 'Node.js', 'SQL', 'AWS', 'Docker', 'Git', 'TypeScript', 'REST API'];
  const lower = description.toLowerCase();

  const keywords = [...commonSkills, ...techSkills].filter(s => lower.includes(s.toLowerCase()));
  const missingSkills = techSkills.filter(s => lower.includes(s.toLowerCase())).slice(0, 5);
  const suggestions = localizedAnalysisSuggestions[locale] || localizedAnalysisSuggestions.en;

  return { missingSkills, keywords, suggestions };
}
