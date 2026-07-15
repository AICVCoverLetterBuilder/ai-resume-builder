import type { Locale } from './i18n/translations';
import type { BulletIndustry } from './ai-bullets';

export type SkillCategory = 'technical' | 'soft';

const CV_SKILL_KEYS = [
  // ── Core Soft Skills ──────────────────────────────────────────────────────
  'communication',
  'teamwork',
  'leadership',
  'problemSolving',
  'timeManagement',
  'organization',
  'attentionToDetail',
  'adaptability',
  'criticalThinking',
  'conflictResolution',
  'presentationSkills',
  'relationshipBuilding',
  'creativity',
  'emotionalIntelligence',
  'decisionMaking',
  'stressManagement',
  'motivation',
  'coaching',
  'mentoring',
  'negotiationSoft',

  // ── Business & Management ─────────────────────────────────────────────────
  'projectManagement',
  'strategicPlanning',
  'reporting',
  'budgeting',
  'dataAnalysis',
  'changeManagement',
  'stakeholderManagement',
  'publicSpeaking',
  'businessAnalysis',

  // ── Sales ─────────────────────────────────────────────────────────────────
  'sales',
  'salesStrategy',
  'negotiation',
  'customerService',
  'crmSoftware',
  'leadGeneration',
  'accountManagement',
  'businessDevelopment',
  'customerRetention',
  'coldCalling',

  // ── Marketing ─────────────────────────────────────────────────────────────
  'marketing',
  'seo',
  'contentStrategy',
  'socialMediaMarketing',
  'googleAnalytics',
  'emailMarketing',
  'brandManagement',
  'marketResearch',
  'copywriting',
  'paidAdvertising',
  'influencerMarketing',

  // ── IT & Tech ─────────────────────────────────────────────────────────────
  'javascript',
  'typescript',
  'python',
  'react',
  'nodejs',
  'sqlDatabases',
  'restApis',
  'git',
  'cloudServices',
  'agileScrum',
  'softwareTesting',
  'debugging',
  'uiUxDesign',
  'cybersecurity',
  'machinelearning',
  'docker',
  'linux',
  'java',
  'csharp',
  'php',
  'systemDesign',
  'devOps',

  // ── Finance & Accounting ──────────────────────────────────────────────────
  'financialAnalysis',
  'accounting',
  'financialReporting',
  'auditing',
  'taxManagement',
  'riskManagement',
  'financialModeling',
  'investmentAnalysis',

  // ── HR & People ───────────────────────────────────────────────────────────
  'recruitment',
  'performanceManagement',
  'employeeRelations',
  'trainingAndDevelopment',
  'payrollManagement',
  'compensationBenefits',
  'hrCompliance',

  // ── Operations & Logistics ────────────────────────────────────────────────
  'supplyChainManagement',
  'processImprovement',
  'qualityControl',
  'inventoryManagement',
  'vendorManagement',
  'leanManagement',
  'projectCoordination',

  // ── Design & Creative ─────────────────────────────────────────────────────
  'graphicDesign',
  'adobePhotoshop',
  'adobeIllustrator',
  'figma',
  'videoEditing',
  'uxResearch',
  'motionGraphics',
  'brandDesign',

  // ── Tools & Productivity ──────────────────────────────────────────────────
  'microsoftOffice',
  'excel',
  'powerBi',
  'tableau',
  'jira',
  'slack',
  'googleWorkspace',
  'sap',
] as const;

type CvSkillKey = (typeof CV_SKILL_KEYS)[number];

export interface CvSkillOption {
  canonicalName: string;
  localizedLabel: string;
  searchTerms: string[];
  category: SkillCategory;
}

/** Which category each skill belongs to */
const SKILL_CATEGORY: Record<CvSkillKey, SkillCategory> = {
  // Soft
  communication: 'soft',
  teamwork: 'soft',
  leadership: 'soft',
  problemSolving: 'soft',
  timeManagement: 'soft',
  organization: 'soft',
  attentionToDetail: 'soft',
  adaptability: 'soft',
  criticalThinking: 'soft',
  conflictResolution: 'soft',
  presentationSkills: 'soft',
  relationshipBuilding: 'soft',
  creativity: 'soft',
  emotionalIntelligence: 'soft',
  decisionMaking: 'soft',
  stressManagement: 'soft',
  motivation: 'soft',
  coaching: 'soft',
  mentoring: 'soft',
  negotiationSoft: 'soft',
  publicSpeaking: 'soft',
  // Technical / hard
  projectManagement: 'technical',
  strategicPlanning: 'technical',
  reporting: 'technical',
  budgeting: 'technical',
  dataAnalysis: 'technical',
  changeManagement: 'technical',
  stakeholderManagement: 'technical',
  businessAnalysis: 'technical',
  sales: 'technical',
  salesStrategy: 'technical',
  negotiation: 'technical',
  customerService: 'technical',
  crmSoftware: 'technical',
  leadGeneration: 'technical',
  accountManagement: 'technical',
  businessDevelopment: 'technical',
  customerRetention: 'technical',
  coldCalling: 'technical',
  marketing: 'technical',
  seo: 'technical',
  contentStrategy: 'technical',
  socialMediaMarketing: 'technical',
  googleAnalytics: 'technical',
  emailMarketing: 'technical',
  brandManagement: 'technical',
  marketResearch: 'technical',
  copywriting: 'technical',
  paidAdvertising: 'technical',
  influencerMarketing: 'technical',
  javascript: 'technical',
  typescript: 'technical',
  python: 'technical',
  react: 'technical',
  nodejs: 'technical',
  sqlDatabases: 'technical',
  restApis: 'technical',
  git: 'technical',
  cloudServices: 'technical',
  agileScrum: 'technical',
  softwareTesting: 'technical',
  debugging: 'technical',
  uiUxDesign: 'technical',
  cybersecurity: 'technical',
  machinelearning: 'technical',
  docker: 'technical',
  linux: 'technical',
  java: 'technical',
  csharp: 'technical',
  php: 'technical',
  systemDesign: 'technical',
  devOps: 'technical',
  financialAnalysis: 'technical',
  accounting: 'technical',
  financialReporting: 'technical',
  auditing: 'technical',
  taxManagement: 'technical',
  riskManagement: 'technical',
  financialModeling: 'technical',
  investmentAnalysis: 'technical',
  recruitment: 'technical',
  performanceManagement: 'technical',
  employeeRelations: 'technical',
  trainingAndDevelopment: 'technical',
  payrollManagement: 'technical',
  compensationBenefits: 'technical',
  hrCompliance: 'technical',
  supplyChainManagement: 'technical',
  processImprovement: 'technical',
  qualityControl: 'technical',
  inventoryManagement: 'technical',
  vendorManagement: 'technical',
  leanManagement: 'technical',
  projectCoordination: 'technical',
  graphicDesign: 'technical',
  adobePhotoshop: 'technical',
  adobeIllustrator: 'technical',
  figma: 'technical',
  videoEditing: 'technical',
  uxResearch: 'technical',
  motionGraphics: 'technical',
  brandDesign: 'technical',
  microsoftOffice: 'technical',
  excel: 'technical',
  powerBi: 'technical',
  tableau: 'technical',
  jira: 'technical',
  slack: 'technical',
  googleWorkspace: 'technical',
  sap: 'technical',
};

const SKILL_LABELS: Record<CvSkillKey, Record<Locale, string>> = {
  // ─── Soft Skills ─────────────────────────────────────────────────────────
  communication: {
    en: 'Communication', de: 'Kommunikation', es: 'Comunicación', fr: 'Communication', it: 'Comunicazione', ar: 'التواصل', sr: 'Komunikacija', hr: 'Komunikacija', ru: 'Коммуникация', 'pt-BR': 'Comunicação', hi: 'संचार', ja: 'コミュニケーション',
  },
  teamwork: {
    en: 'Teamwork', de: 'Teamarbeit', es: 'Trabajo en equipo', fr: "Travail d'équipe", it: 'Lavoro di squadra', ar: 'العمل الجماعي', sr: 'Timski rad', hr: 'Timski rad', ru: 'Командная работа', 'pt-BR': 'Trabalho em equipe', hi: 'टीमवर्क', ja: 'チームワーク',
  },
  leadership: {
    en: 'Leadership', de: 'Führung', es: 'Liderazgo', fr: 'Leadership', it: 'Leadership', ar: 'القيادة', sr: 'Liderstvo', hr: 'Vodstvo', ru: 'Лидерство', 'pt-BR': 'Liderança', hi: 'नेतृत्व', ja: 'リーダーシップ',
  },
  problemSolving: {
    en: 'Problem Solving', de: 'Problemlösung', es: 'Resolución de problemas', fr: 'Résolution de problèmes', it: 'Risoluzione dei problemi', ar: 'حل المشكلات', sr: 'Rešavanje problema', hr: 'Rješavanje problema', ru: 'Решение проблем', 'pt-BR': 'Resolução de problemas', hi: 'समस्या समाधान', ja: '問題解決',
  },
  timeManagement: {
    en: 'Time Management', de: 'Zeitmanagement', es: 'Gestión del tiempo', fr: 'Gestion du temps', it: 'Gestione del tempo', ar: 'إدارة الوقت', sr: 'Upravljanje vremenom', hr: 'Upravljanje vremenom', ru: 'Тайм-менеджмент', 'pt-BR': 'Gestão do tempo', hi: 'समय प्रबंधन', ja: '時間管理',
  },
  organization: {
    en: 'Organization', de: 'Organisation', es: 'Organización', fr: 'Organisation', it: 'Organizzazione', ar: 'التنظيم', sr: 'Organizacija', hr: 'Organizacija', ru: 'Организованность', 'pt-BR': 'Organização', hi: 'संगठन', ja: '組織力',
  },
  attentionToDetail: {
    en: 'Attention to Detail', de: 'Detailgenauigkeit', es: 'Atención al detalle', fr: 'Souci du détail', it: 'Attenzione ai dettagli', ar: 'الاهتمام بالتفاصيل', sr: 'Pažnja prema detaljima', hr: 'Pozornost na detalje', ru: 'Внимание к деталям', 'pt-BR': 'Atenção aos detalhes', hi: 'विवरण पर ध्यान', ja: '細部への注意力',
  },
  adaptability: {
    en: 'Adaptability', de: 'Anpassungsfähigkeit', es: 'Adaptabilidad', fr: 'Adaptabilité', it: 'Adattabilità', ar: 'القدرة على التكيف', sr: 'Prilagodljivost', hr: 'Prilagodljivost', ru: 'Адаптивность', 'pt-BR': 'Adaptabilidade', hi: 'अनुकूलनशीलता', ja: '適応力',
  },
  criticalThinking: {
    en: 'Critical Thinking', de: 'Kritisches Denken', es: 'Pensamiento crítico', fr: 'Esprit critique', it: 'Pensiero critico', ar: 'التفكير النقدي', sr: 'Kritičko razmišljanje', hr: 'Kritičko razmišljanje', ru: 'Критическое мышление', 'pt-BR': 'Pensamento crítico', hi: 'आलोचनात्मक सोच', ja: 'クリティカルシンキング',
  },
  conflictResolution: {
    en: 'Conflict Resolution', de: 'Konfliktlösung', es: 'Resolución de conflictos', fr: 'Résolution des conflits', it: 'Risoluzione dei conflitti', ar: 'حل النزاعات', sr: 'Rešavanje konflikata', hr: 'Rješavanje sukoba', ru: 'Разрешение конфликтов', 'pt-BR': 'Resolução de conflitos', hi: 'संघर्ष समाधान', ja: '紛争解決',
  },
  presentationSkills: {
    en: 'Presentation Skills', de: 'Präsentationsfähigkeiten', es: 'Habilidades de presentación', fr: 'Compétences en présentation', it: 'Capacità di presentazione', ar: 'مهارات العرض', sr: 'Veštine prezentacije', hr: 'Vještine prezentacije', ru: 'Навыки презентации', 'pt-BR': 'Habilidades de apresentação', hi: 'प्रस्तुति कौशल', ja: 'プレゼンテーション能力',
  },
  relationshipBuilding: {
    en: 'Relationship Building', de: 'Beziehungsaufbau', es: 'Construcción de relaciones', fr: 'Développement de relations', it: 'Sviluppo di relazioni', ar: 'بناء العلاقات', sr: 'Izgradnja odnosa', hr: 'Izgradnja odnosa', ru: 'Выстраивание отношений', 'pt-BR': 'Construção de relacionamentos', hi: 'संबंध निर्माण', ja: '関係構築',
  },
  creativity: {
    en: 'Creativity', de: 'Kreativität', es: 'Creatividad', fr: 'Créativité', it: 'Creatività', ar: 'الإبداع', sr: 'Kreativnost', hr: 'Kreativnost', ru: 'Креативность', 'pt-BR': 'Criatividade', hi: 'रचनात्मकता', ja: '創造性',
  },
  emotionalIntelligence: {
    en: 'Emotional Intelligence', de: 'Emotionale Intelligenz', es: 'Inteligencia emocional', fr: 'Intelligence émotionnelle', it: 'Intelligenza emotiva', ar: 'الذكاء العاطفي', sr: 'Emocionalna inteligencija', hr: 'Emocionalna inteligencija', ru: 'Эмоциональный интеллект', 'pt-BR': 'Inteligência emocional', hi: 'भावनात्मक बुद्धिमत्ता', ja: '感情的知性',
  },
  decisionMaking: {
    en: 'Decision Making', de: 'Entscheidungsfindung', es: 'Toma de decisiones', fr: 'Prise de décision', it: 'Processo decisionale', ar: 'صنع القرار', sr: 'Donošenje odluka', hr: 'Donošenje odluka', ru: 'Принятие решений', 'pt-BR': 'Tomada de decisões', hi: 'निर्णय लेना', ja: '意思決定',
  },
  stressManagement: {
    en: 'Stress Management', de: 'Stressmanagement', es: 'Gestión del estrés', fr: 'Gestion du stress', it: 'Gestione dello stress', ar: 'إدارة الضغط', sr: 'Upravljanje stresom', hr: 'Upravljanje stresom', ru: 'Управление стрессом', 'pt-BR': 'Gestão do estresse', hi: 'तनाव प्रबंधन', ja: 'ストレス管理',
  },
  motivation: {
    en: 'Motivation', de: 'Motivation', es: 'Motivación', fr: 'Motivation', it: 'Motivazione', ar: 'التحفيز', sr: 'Motivacija', hr: 'Motivacija', ru: 'Мотивация', 'pt-BR': 'Motivação', hi: 'प्रेरणा', ja: 'モチベーション',
  },
  coaching: {
    en: 'Coaching', de: 'Coaching', es: 'Coaching', fr: 'Coaching', it: 'Coaching', ar: 'التدريب الشخصي', sr: 'Koučing', hr: 'Koučing', ru: 'Коучинг', 'pt-BR': 'Coaching', hi: 'कोचिंग', ja: 'コーチング',
  },
  mentoring: {
    en: 'Mentoring', de: 'Mentoring', es: 'Mentoría', fr: 'Mentorat', it: 'Mentoring', ar: 'الإرشاد والتوجيه', sr: 'Mentorstvo', hr: 'Mentorstvo', ru: 'Менторство', 'pt-BR': 'Mentoria', hi: 'मेंटरिंग', ja: 'メンタリング',
  },
  negotiationSoft: {
    en: 'Negotiation', de: 'Verhandlungsgeschick', es: 'Negociación', fr: 'Négociation', it: 'Negoziazione', ar: 'التفاوض', sr: 'Pregovaranje', hr: 'Pregovaranje', ru: 'Переговоры', 'pt-BR': 'Negociação', hi: 'वार्ता', ja: '交渉力',
  },
  publicSpeaking: {
    en: 'Public Speaking', de: 'Öffentliches Reden', es: 'Oratoria', fr: 'Prise de parole en public', it: 'Public speaking', ar: 'الخطابة العامة', sr: 'Javni nastup', hr: 'Javni govor', ru: 'Публичные выступления', 'pt-BR': 'Oratória', hi: 'सार्वजनिक भाषण', ja: 'スピーチ',
  },

  // ─── Business & Management ───────────────────────────────────────────────
  projectManagement: {
    en: 'Project Management', de: 'Projektmanagement', es: 'Gestión de proyectos', fr: 'Gestion de projet', it: 'Gestione dei progetti', ar: 'إدارة المشاريع', sr: 'Upravljanje projektima', hr: 'Upravljanje projektima', ru: 'Управление проектами', 'pt-BR': 'Gestão de projetos', hi: 'परियोजना प्रबंधन', ja: 'プロジェクト管理',
  },
  strategicPlanning: {
    en: 'Strategic Planning', de: 'Strategische Planung', es: 'Planificación estratégica', fr: 'Planification stratégique', it: 'Pianificazione strategica', ar: 'التخطيط الاستراتيجي', sr: 'Strateško planiranje', hr: 'Strateško planiranje', ru: 'Стратегическое планирование', 'pt-BR': 'Planejamento estratégico', hi: 'रणनीतिक योजना', ja: '戦略立案',
  },
  reporting: {
    en: 'Reporting', de: 'Berichtswesen', es: 'Informes', fr: 'Reporting', it: 'Reportistica', ar: 'إعداد التقارير', sr: 'Izveštavanje', hr: 'Izvještavanje', ru: 'Отчетность', 'pt-BR': 'Relatórios', hi: 'रिपोर्टिंग', ja: 'レポーティング',
  },
  budgeting: {
    en: 'Budgeting', de: 'Budgetplanung', es: 'Presupuestación', fr: 'Gestion budgétaire', it: 'Gestione del budget', ar: 'إعداد الميزانية', sr: 'Budžetiranje', hr: 'Budžetiranje', ru: 'Бюджетирование', 'pt-BR': 'Orçamento', hi: 'बजट योजना', ja: '予算管理',
  },
  dataAnalysis: {
    en: 'Data Analysis', de: 'Datenanalyse', es: 'Análisis de datos', fr: 'Analyse de données', it: 'Analisi dei dati', ar: 'تحليل البيانات', sr: 'Analiza podataka', hr: 'Analiza podataka', ru: 'Анализ данных', 'pt-BR': 'Análise de dados', hi: 'डेटा विश्लेषण', ja: 'データ分析',
  },
  changeManagement: {
    en: 'Change Management', de: 'Change Management', es: 'Gestión del cambio', fr: 'Gestion du changement', it: 'Gestione del cambiamento', ar: 'إدارة التغيير', sr: 'Upravljanje promenama', hr: 'Upravljanje promjenama', ru: 'Управление изменениями', 'pt-BR': 'Gestão de mudanças', hi: 'परिवर्तन प्रबंधन', ja: 'チェンジマネジメント',
  },
  stakeholderManagement: {
    en: 'Stakeholder Management', de: 'Stakeholder-Management', es: 'Gestión de partes interesadas', fr: 'Gestion des parties prenantes', it: 'Gestione degli stakeholder', ar: 'إدارة أصحاب المصلحة', sr: 'Upravljanje zainteresovanim stranama', hr: 'Upravljanje dionicima', ru: 'Управление заинтересованными сторонами', 'pt-BR': 'Gestão de stakeholders', hi: 'हितधारक प्रबंधन', ja: 'ステークホルダー管理',
  },
  businessAnalysis: {
    en: 'Business Analysis', de: 'Unternehmensanalyse', es: 'Análisis empresarial', fr: 'Analyse métier', it: 'Analisi aziendale', ar: 'تحليل الأعمال', sr: 'Poslovna analiza', hr: 'Poslovna analiza', ru: 'Бизнес-анализ', 'pt-BR': 'Análise de negócios', hi: 'व्यवसाय विश्लेषण', ja: 'ビジネス分析',
  },

  // ─── Sales ────────────────────────────────────────────────────────────────
  sales: {
    en: 'Sales', de: 'Vertrieb', es: 'Ventas', fr: 'Ventes', it: 'Vendite', ar: 'المبيعات', sr: 'Prodaja', hr: 'Prodaja', ru: 'Продажи', 'pt-BR': 'Vendas', hi: 'बिक्री', ja: '営業',
  },
  salesStrategy: {
    en: 'Sales Strategy', de: 'Vertriebsstrategie', es: 'Estrategia de ventas', fr: 'Stratégie commerciale', it: 'Strategia di vendita', ar: 'استراتيجية المبيعات', sr: 'Prodajna strategija', hr: 'Prodajna strategija', ru: 'Стратегия продаж', 'pt-BR': 'Estratégia de vendas', hi: 'बिक्री रणनीति', ja: '営業戦略',
  },
  negotiation: {
    en: 'Negotiation', de: 'Verhandlung', es: 'Negociación', fr: 'Négociation', it: 'Negoziazione', ar: 'التفاوض', sr: 'Pregovaranje', hr: 'Pregovaranje', ru: 'Переговоры', 'pt-BR': 'Negociação', hi: 'वार्ता', ja: '交渉',
  },
  customerService: {
    en: 'Customer Service', de: 'Kundenservice', es: 'Atención al cliente', fr: 'Service client', it: 'Servizio clienti', ar: 'خدمة العملاء', sr: 'Korisnička podrška', hr: 'Služba za korisnike', ru: 'Обслуживание клиентов', 'pt-BR': 'Atendimento ao cliente', hi: 'ग्राहक सेवा', ja: '顧客対応',
  },
  crmSoftware: {
    en: 'CRM Software', de: 'CRM-Software', es: 'Software CRM', fr: 'Logiciel CRM', it: 'Software CRM', ar: 'برنامج إدارة علاقات العملاء', sr: 'CRM softver', hr: 'CRM softver', ru: 'CRM-система', 'pt-BR': 'Software CRM', hi: 'सीआरएम सॉफ्टवेयर', ja: 'CRMソフトウェア',
  },
  leadGeneration: {
    en: 'Lead Generation', de: 'Lead-Generierung', es: 'Generación de leads', fr: 'Génération de leads', it: 'Generazione di lead', ar: 'توليد العملاء المحتملين', sr: 'Generisanje potencijalnih klijenata', hr: 'Generiranje potencijalnih klijenata', ru: 'Лидогенерация', 'pt-BR': 'Geração de leads', hi: 'लीड जनरेशन', ja: 'リード獲得',
  },
  accountManagement: {
    en: 'Account Management', de: 'Account-Management', es: 'Gestión de cuentas', fr: 'Gestion de comptes', it: 'Gestione account', ar: 'إدارة الحسابات', sr: 'Upravljanje nalozima', hr: 'Upravljanje računima', ru: 'Управление клиентами', 'pt-BR': 'Gestão de contas', hi: 'अकाउंट मैनेजमेंट', ja: 'アカウント管理',
  },
  businessDevelopment: {
    en: 'Business Development', de: 'Geschäftsentwicklung', es: 'Desarrollo de negocios', fr: 'Développement commercial', it: 'Sviluppo commerciale', ar: 'تطوير الأعمال', sr: 'Razvoj poslovanja', hr: 'Razvoj poslovanja', ru: 'Развитие бизнеса', 'pt-BR': 'Desenvolvimento de negócios', hi: 'व्यवसाय विकास', ja: 'ビジネス開発',
  },
  customerRetention: {
    en: 'Customer Retention', de: 'Kundenbindung', es: 'Retención de clientes', fr: 'Fidélisation client', it: 'Fidelizzazione dei clienti', ar: 'الاحتفاظ بالعملاء', sr: 'Zadržavanje kupaca', hr: 'Zadržavanje kupaca', ru: 'Удержание клиентов', 'pt-BR': 'Retenção de clientes', hi: 'ग्राहक प्रतिधारण', ja: '顧客維持',
  },
  coldCalling: {
    en: 'Cold Calling', de: 'Kaltakquise', es: 'Llamadas en frío', fr: 'Prospection téléphonique', it: 'Cold calling', ar: 'الاتصال البارد', sr: 'Hladni pozivi', hr: 'Hladni pozivi', ru: 'Холодные звонки', 'pt-BR': 'Cold calling', hi: 'कोल्ड कॉलिंग', ja: 'テレアポ',
  },

  // ─── Marketing ────────────────────────────────────────────────────────────
  marketing: {
    en: 'Marketing', de: 'Marketing', es: 'Marketing', fr: 'Marketing', it: 'Marketing', ar: 'التسويق', sr: 'Marketing', hr: 'Marketing', ru: 'Маркетинг', 'pt-BR': 'Marketing', hi: 'मार्केटिंग', ja: 'マーケティング',
  },
  seo: {
    en: 'SEO', de: 'SEO', es: 'SEO', fr: 'SEO', it: 'SEO', ar: 'تحسين محركات البحث', sr: 'SEO', hr: 'SEO', ru: 'SEO', 'pt-BR': 'SEO', hi: 'एसईओ', ja: 'SEO',
  },
  contentStrategy: {
    en: 'Content Strategy', de: 'Content-Strategie', es: 'Estrategia de contenidos', fr: 'Stratégie de contenu', it: 'Strategia dei contenuti', ar: 'استراتيجية المحتوى', sr: 'Strategija sadržaja', hr: 'Strategija sadržaja', ru: 'Контент-стратегия', 'pt-BR': 'Estratégia de conteúdo', hi: 'कंटेंट स्ट्रेटेजी', ja: 'コンテンツ戦略',
  },
  socialMediaMarketing: {
    en: 'Social Media Marketing', de: 'Social-Media-Marketing', es: 'Marketing en redes sociales', fr: 'Marketing sur les réseaux sociaux', it: 'Marketing sui social media', ar: 'التسويق عبر وسائل التواصل الاجتماعي', sr: 'Marketing na društvenim mrežama', hr: 'Marketing na društvenim mrežama', ru: 'SMM', 'pt-BR': 'Marketing em redes sociais', hi: 'सोशल मीडिया मार्केटिंग', ja: 'ソーシャルメディアマーケティング',
  },
  googleAnalytics: {
    en: 'Google Analytics', de: 'Google Analytics', es: 'Google Analytics', fr: 'Google Analytics', it: 'Google Analytics', ar: 'جوجل أناليتيكس', sr: 'Google Analytics', hr: 'Google Analytics', ru: 'Google Analytics', 'pt-BR': 'Google Analytics', hi: 'गूगल एनालिटिक्स', ja: 'Google Analytics',
  },
  emailMarketing: {
    en: 'Email Marketing', de: 'E-Mail-Marketing', es: 'Email marketing', fr: 'Email marketing', it: 'Email marketing', ar: 'التسويق عبر البريد الإلكتروني', sr: 'Email marketing', hr: 'Email marketing', ru: 'Email-маркетинг', 'pt-BR': 'Email marketing', hi: 'ईमेल मार्केटिंग', ja: 'メールマーケティング',
  },
  brandManagement: {
    en: 'Brand Management', de: 'Markenführung', es: 'Gestión de marca', fr: 'Gestion de marque', it: 'Gestione del brand', ar: 'إدارة العلامة التجارية', sr: 'Upravljanje brendom', hr: 'Upravljanje brendom', ru: 'Управление брендом', 'pt-BR': 'Gestão de marca', hi: 'ब्रांड मैनेजमेंट', ja: 'ブランド管理',
  },
  marketResearch: {
    en: 'Market Research', de: 'Marktforschung', es: 'Investigación de mercado', fr: 'Étude de marché', it: 'Ricerca di mercato', ar: 'أبحاث السوق', sr: 'Istraživanje tržišta', hr: 'Istraživanje tržišta', ru: 'Маркетинговые исследования', 'pt-BR': 'Pesquisa de mercado', hi: 'बाजार अनुसंधान', ja: '市場調査',
  },
  copywriting: {
    en: 'Copywriting', de: 'Texterstellung', es: 'Redacción publicitaria', fr: 'Rédaction publicitaire', it: 'Copywriting', ar: 'كتابة الإعلانات', sr: 'Pisanje marketinških tekstova', hr: 'Pisanje marketinških tekstova', ru: 'Копирайтинг', 'pt-BR': 'Copywriting', hi: 'कॉपीराइटिंग', ja: 'コピーライティング',
  },
  paidAdvertising: {
    en: 'Paid Advertising (PPC)', de: 'Bezahlte Werbung (PPC)', es: 'Publicidad de pago (PPC)', fr: 'Publicité payante (PPC)', it: 'Pubblicità a pagamento (PPC)', ar: 'الإعلانات المدفوعة', sr: 'Plaćeno oglašavanje (PPC)', hr: 'Plaćeno oglašavanje (PPC)', ru: 'Платная реклама (PPC)', 'pt-BR': 'Anúncios pagos (PPC)', hi: 'पेड एडवर्टाइजिंग', ja: 'ペイド広告 (PPC)',
  },
  influencerMarketing: {
    en: 'Influencer Marketing', de: 'Influencer-Marketing', es: 'Marketing de influencers', fr: 'Marketing d\'influence', it: 'Influencer marketing', ar: 'تسويق المؤثرين', sr: 'Influencer marketing', hr: 'Influencer marketing', ru: 'Инфлюенсер-маркетинг', 'pt-BR': 'Marketing de influenciadores', hi: 'इन्फ्लुएंसर मार्केटिंग', ja: 'インフルエンサーマーケティング',
  },

  // ─── IT & Tech ────────────────────────────────────────────────────────────
  javascript: {
    en: 'JavaScript', de: 'JavaScript', es: 'JavaScript', fr: 'JavaScript', it: 'JavaScript', ar: 'جافاسكريبت', sr: 'JavaScript', hr: 'JavaScript', ru: 'JavaScript', 'pt-BR': 'JavaScript', hi: 'जावास्क्रिप्ट', ja: 'JavaScript',
  },
  typescript: {
    en: 'TypeScript', de: 'TypeScript', es: 'TypeScript', fr: 'TypeScript', it: 'TypeScript', ar: 'تايب سكريبت', sr: 'TypeScript', hr: 'TypeScript', ru: 'TypeScript', 'pt-BR': 'TypeScript', hi: 'टाइपस्क्रिप्ट', ja: 'TypeScript',
  },
  python: {
    en: 'Python', de: 'Python', es: 'Python', fr: 'Python', it: 'Python', ar: 'بايثون', sr: 'Python', hr: 'Python', ru: 'Python', 'pt-BR': 'Python', hi: 'पायथन', ja: 'Python',
  },
  react: {
    en: 'React', de: 'React', es: 'React', fr: 'React', it: 'React', ar: 'رياكت', sr: 'React', hr: 'React', ru: 'React', 'pt-BR': 'React', hi: 'रिएक्ट', ja: 'React',
  },
  nodejs: {
    en: 'Node.js', de: 'Node.js', es: 'Node.js', fr: 'Node.js', it: 'Node.js', ar: 'نود جي إس', sr: 'Node.js', hr: 'Node.js', ru: 'Node.js', 'pt-BR': 'Node.js', hi: 'नोड.जेएस', ja: 'Node.js',
  },
  sqlDatabases: {
    en: 'SQL / Databases', de: 'SQL / Datenbanken', es: 'SQL / Bases de datos', fr: 'SQL / Bases de données', it: 'SQL / Database', ar: 'SQL / قواعد البيانات', sr: 'SQL / Baze podataka', hr: 'SQL / Baze podataka', ru: 'SQL / Базы данных', 'pt-BR': 'SQL / Bancos de dados', hi: 'SQL / डेटाबेस', ja: 'SQL / データベース',
  },
  restApis: {
    en: 'REST APIs', de: 'REST-APIs', es: 'APIs REST', fr: 'APIs REST', it: 'API REST', ar: 'واجهات برمجة REST', sr: 'REST API-ji', hr: 'REST API-ji', ru: 'REST API', 'pt-BR': 'APIs REST', hi: 'REST API', ja: 'REST API',
  },
  git: {
    en: 'Git', de: 'Git', es: 'Git', fr: 'Git', it: 'Git', ar: 'جيت', sr: 'Git', hr: 'Git', ru: 'Git', 'pt-BR': 'Git', hi: 'गिट', ja: 'Git',
  },
  cloudServices: {
    en: 'Cloud Services (AWS/Azure/GCP)', de: 'Cloud-Dienste (AWS/Azure/GCP)', es: 'Servicios en la nube (AWS/Azure/GCP)', fr: 'Services cloud (AWS/Azure/GCP)', it: 'Servizi cloud (AWS/Azure/GCP)', ar: 'الخدمات السحابية', sr: 'Cloud servisi (AWS/Azure/GCP)', hr: 'Cloud servisi (AWS/Azure/GCP)', ru: 'Облачные сервисы (AWS/Azure/GCP)', 'pt-BR': 'Serviços em nuvem (AWS/Azure/GCP)', hi: 'क्लाउड सेवाएं', ja: 'クラウドサービス',
  },
  agileScrum: {
    en: 'Agile / Scrum', de: 'Agile / Scrum', es: 'Agile / Scrum', fr: 'Agile / Scrum', it: 'Agile / Scrum', ar: 'أجايل / سكرم', sr: 'Agile / Scrum', hr: 'Agile / Scrum', ru: 'Agile / Scrum', 'pt-BR': 'Agile / Scrum', hi: 'एजाइल / स्क्रम', ja: 'アジャイル / スクラム',
  },
  softwareTesting: {
    en: 'Software Testing', de: 'Softwaretesting', es: 'Pruebas de software', fr: 'Tests logiciels', it: 'Testing del software', ar: 'اختبار البرمجيات', sr: 'Testiranje softvera', hr: 'Testiranje softvera', ru: 'Тестирование ПО', 'pt-BR': 'Testes de software', hi: 'सॉफ्टवेयर टेस्टिंग', ja: 'ソフトウェアテスト',
  },
  debugging: {
    en: 'Debugging', de: 'Debugging', es: 'Depuración de código', fr: 'Débogage', it: 'Debugging', ar: 'تصحيح الأخطاء البرمجية', sr: 'Otklanjanje grešaka', hr: 'Ispravljanje pogrešaka', ru: 'Отладка кода', 'pt-BR': 'Depuração', hi: 'डिबगिंग', ja: 'デバッグ',
  },
  uiUxDesign: {
    en: 'UI/UX Design', de: 'UI/UX-Design', es: 'Diseño UI/UX', fr: 'Design UI/UX', it: 'Design UI/UX', ar: 'تصميم واجهة المستخدم', sr: 'UI/UX dizajn', hr: 'UI/UX dizajn', ru: 'UI/UX дизайн', 'pt-BR': 'Design UI/UX', hi: 'यूआई/यूएक्स डिज़ाइन', ja: 'UI/UXデザイン',
  },
  cybersecurity: {
    en: 'Cybersecurity', de: 'Cybersicherheit', es: 'Ciberseguridad', fr: 'Cybersécurité', it: 'Sicurezza informatica', ar: 'الأمن السيبراني', sr: 'Sajber bezbednost', hr: 'Kibernetička sigurnost', ru: 'Кибербезопасность', 'pt-BR': 'Segurança cibernética', hi: 'साइबर सुरक्षा', ja: 'サイバーセキュリティ',
  },
  machinelearning: {
    en: 'Machine Learning', de: 'Maschinelles Lernen', es: 'Aprendizaje automático', fr: 'Apprentissage automatique', it: 'Machine learning', ar: 'تعلم الآلة', sr: 'Mašinsko učenje', hr: 'Strojno učenje', ru: 'Машинное обучение', 'pt-BR': 'Aprendizado de máquina', hi: 'मशीन लर्निंग', ja: '機械学習',
  },
  docker: {
    en: 'Docker / Kubernetes', de: 'Docker / Kubernetes', es: 'Docker / Kubernetes', fr: 'Docker / Kubernetes', it: 'Docker / Kubernetes', ar: 'دوكر / كوبيرنيتيس', sr: 'Docker / Kubernetes', hr: 'Docker / Kubernetes', ru: 'Docker / Kubernetes', 'pt-BR': 'Docker / Kubernetes', hi: 'डॉकर / कुबेरनेट्स', ja: 'Docker / Kubernetes',
  },
  linux: {
    en: 'Linux', de: 'Linux', es: 'Linux', fr: 'Linux', it: 'Linux', ar: 'لينكس', sr: 'Linux', hr: 'Linux', ru: 'Linux', 'pt-BR': 'Linux', hi: 'लिनक्स', ja: 'Linux',
  },
  java: {
    en: 'Java', de: 'Java', es: 'Java', fr: 'Java', it: 'Java', ar: 'جافا', sr: 'Java', hr: 'Java', ru: 'Java', 'pt-BR': 'Java', hi: 'जावा', ja: 'Java',
  },
  csharp: {
    en: 'C# / .NET', de: 'C# / .NET', es: 'C# / .NET', fr: 'C# / .NET', it: 'C# / .NET', ar: 'سي شارب / دوت نت', sr: 'C# / .NET', hr: 'C# / .NET', ru: 'C# / .NET', 'pt-BR': 'C# / .NET', hi: 'सी# / .NET', ja: 'C# / .NET',
  },
  php: {
    en: 'PHP', de: 'PHP', es: 'PHP', fr: 'PHP', it: 'PHP', ar: 'PHP', sr: 'PHP', hr: 'PHP', ru: 'PHP', 'pt-BR': 'PHP', hi: 'पीएचपी', ja: 'PHP',
  },
  systemDesign: {
    en: 'System Design', de: 'Systemarchitektur', es: 'Diseño de sistemas', fr: 'Conception de systèmes', it: 'Progettazione di sistemi', ar: 'تصميم الأنظمة', sr: 'Dizajn sistema', hr: 'Dizajn sustava', ru: 'Проектирование систем', 'pt-BR': 'Design de sistemas', hi: 'सिस्टम डिज़ाइन', ja: 'システム設計',
  },
  devOps: {
    en: 'DevOps', de: 'DevOps', es: 'DevOps', fr: 'DevOps', it: 'DevOps', ar: 'ديف أوبس', sr: 'DevOps', hr: 'DevOps', ru: 'DevOps', 'pt-BR': 'DevOps', hi: 'डेवऑप्स', ja: 'DevOps',
  },

  // ─── Finance & Accounting ─────────────────────────────────────────────────
  financialAnalysis: {
    en: 'Financial Analysis', de: 'Finanzanalyse', es: 'Análisis financiero', fr: 'Analyse financière', it: 'Analisi finanziaria', ar: 'التحليل المالي', sr: 'Finansijska analiza', hr: 'Financijska analiza', ru: 'Финансовый анализ', 'pt-BR': 'Análise financeira', hi: 'वित्तीय विश्लेषण', ja: '財務分析',
  },
  accounting: {
    en: 'Accounting', de: 'Buchhaltung', es: 'Contabilidad', fr: 'Comptabilité', it: 'Contabilità', ar: 'المحاسبة', sr: 'Računovodstvo', hr: 'Računovodstvo', ru: 'Бухгалтерский учёт', 'pt-BR': 'Contabilidade', hi: 'लेखांकन', ja: '会計',
  },
  financialReporting: {
    en: 'Financial Reporting', de: 'Finanzberichterstattung', es: 'Informes financieros', fr: 'Reporting financier', it: 'Reporting finanziario', ar: 'التقارير المالية', sr: 'Finansijsko izveštavanje', hr: 'Financijsko izvještavanje', ru: 'Финансовая отчётность', 'pt-BR': 'Relatórios financeiros', hi: 'वित्तीय रिपोर्टिंग', ja: '財務報告',
  },
  auditing: {
    en: 'Auditing', de: 'Prüfungswesen', es: 'Auditoría', fr: 'Audit', it: 'Revisione contabile', ar: 'التدقيق المالي', sr: 'Revizija', hr: 'Revizija', ru: 'Аудит', 'pt-BR': 'Auditoria', hi: 'ऑडिटिंग', ja: '監査',
  },
  taxManagement: {
    en: 'Tax Management', de: 'Steuerplanung', es: 'Gestión fiscal', fr: 'Gestion fiscale', it: 'Gestione fiscale', ar: 'إدارة الضرائب', sr: 'Upravljanje porezima', hr: 'Upravljanje porezima', ru: 'Налоговое управление', 'pt-BR': 'Gestão tributária', hi: 'कर प्रबंधन', ja: '税務管理',
  },
  riskManagement: {
    en: 'Risk Management', de: 'Risikomanagement', es: 'Gestión de riesgos', fr: 'Gestion des risques', it: 'Gestione del rischio', ar: 'إدارة المخاطر', sr: 'Upravljanje rizicima', hr: 'Upravljanje rizicima', ru: 'Управление рисками', 'pt-BR': 'Gestão de riscos', hi: 'जोखिम प्रबंधन', ja: 'リスク管理',
  },
  financialModeling: {
    en: 'Financial Modeling', de: 'Finanzmodellierung', es: 'Modelado financiero', fr: 'Modélisation financière', it: 'Modellazione finanziaria', ar: 'النمذجة المالية', sr: 'Finansijsko modelovanje', hr: 'Financijsko modeliranje', ru: 'Финансовое моделирование', 'pt-BR': 'Modelagem financeira', hi: 'वित्तीय मॉडलिंग', ja: '財務モデリング',
  },
  investmentAnalysis: {
    en: 'Investment Analysis', de: 'Investitionsanalyse', es: 'Análisis de inversiones', fr: "Analyse d'investissement", it: 'Analisi degli investimenti', ar: 'تحليل الاستثمارات', sr: 'Analiza investicija', hr: 'Analiza ulaganja', ru: 'Инвестиционный анализ', 'pt-BR': 'Análise de investimentos', hi: 'निवेश विश्लेषण', ja: '投資分析',
  },

  // ─── HR & People ─────────────────────────────────────────────────────────
  recruitment: {
    en: 'Recruitment', de: 'Recruiting', es: 'Reclutamiento', fr: 'Recrutement', it: 'Selezione del personale', ar: 'التوظيف', sr: 'Zapošljavanje', hr: 'Zapošljavanje', ru: 'Подбор персонала', 'pt-BR': 'Recrutamento', hi: 'भर्ती', ja: '採用',
  },
  performanceManagement: {
    en: 'Performance Management', de: 'Leistungsmanagement', es: 'Gestión del desempeño', fr: 'Gestion de la performance', it: 'Gestione delle prestazioni', ar: 'إدارة الأداء', sr: 'Upravljanje učinkom', hr: 'Upravljanje učinkom', ru: 'Управление эффективностью', 'pt-BR': 'Gestão de desempenho', hi: 'प्रदर्शन प्रबंधन', ja: 'パフォーマンス管理',
  },
  employeeRelations: {
    en: 'Employee Relations', de: 'Mitarbeiterbeziehungen', es: 'Relaciones laborales', fr: 'Relations employés', it: 'Relazioni con il personale', ar: 'علاقات الموظفين', sr: 'Odnosi sa zaposlenima', hr: 'Odnosi sa zaposlenicima', ru: 'Трудовые отношения', 'pt-BR': 'Relações com funcionários', hi: 'कर्मचारी संबंध', ja: '労務管理',
  },
  trainingAndDevelopment: {
    en: 'Training & Development', de: 'Aus- und Weiterbildung', es: 'Formación y desarrollo', fr: 'Formation et développement', it: 'Formazione e sviluppo', ar: 'التدريب والتطوير', sr: 'Obuka i razvoj', hr: 'Obuka i razvoj', ru: 'Обучение и развитие', 'pt-BR': 'Treinamento e desenvolvimento', hi: 'प्रशिक्षण एवं विकास', ja: 'トレーニング・開発',
  },
  payrollManagement: {
    en: 'Payroll Management', de: 'Lohnbuchhaltung', es: 'Gestión de nóminas', fr: 'Gestion de la paie', it: 'Gestione delle buste paga', ar: 'إدارة الرواتب', sr: 'Upravljanje platnim spiskom', hr: 'Upravljanje plaćama', ru: 'Расчёт заработной платы', 'pt-BR': 'Gestão de folha de pagamento', hi: 'वेतन प्रबंधन', ja: '給与管理',
  },
  compensationBenefits: {
    en: 'Compensation & Benefits', de: 'Vergütung und Benefits', es: 'Compensación y beneficios', fr: 'Rémunération et avantages', it: 'Compensazione e benefit', ar: 'التعويضات والمزايا', sr: 'Naknade i beneficije', hr: 'Naknade i beneficije', ru: 'Компенсации и льготы', 'pt-BR': 'Remuneração e benefícios', hi: 'मुआवजा और लाभ', ja: '報酬・福利厚生',
  },
  hrCompliance: {
    en: 'HR Compliance', de: 'HR-Compliance', es: 'Cumplimiento normativo en RRHH', fr: 'Conformité RH', it: 'Conformità HR', ar: 'الامتثال في الموارد البشرية', sr: 'HR usklađenost', hr: 'HR usklađenost', ru: 'Соответствие требованиям HR', 'pt-BR': 'Conformidade em RH', hi: 'एचआर अनुपालन', ja: 'HRコンプライアンス',
  },

  // ─── Operations & Logistics ───────────────────────────────────────────────
  supplyChainManagement: {
    en: 'Supply Chain Management', de: 'Supply-Chain-Management', es: 'Gestión de la cadena de suministro', fr: 'Gestion de la chaîne logistique', it: 'Gestione della catena di fornitura', ar: 'إدارة سلسلة التوريد', sr: 'Upravljanje lancima snabdevanja', hr: 'Upravljanje opskrbnim lancem', ru: 'Управление цепочкой поставок', 'pt-BR': 'Gestão da cadeia de suprimentos', hi: 'आपूर्ति श्रृंखला प्रबंधन', ja: 'サプライチェーン管理',
  },
  processImprovement: {
    en: 'Process Improvement', de: 'Prozessoptimierung', es: 'Mejora de procesos', fr: 'Amélioration des processus', it: 'Miglioramento dei processi', ar: 'تحسين العمليات', sr: 'Unapređenje procesa', hr: 'Poboljšanje procesa', ru: 'Оптимизация процессов', 'pt-BR': 'Melhoria de processos', hi: 'प्रक्रिया सुधार', ja: 'プロセス改善',
  },
  qualityControl: {
    en: 'Quality Control', de: 'Qualitätskontrolle', es: 'Control de calidad', fr: 'Contrôle qualité', it: 'Controllo qualità', ar: 'ضبط الجودة', sr: 'Kontrola kvaliteta', hr: 'Kontrola kvalitete', ru: 'Контроль качества', 'pt-BR': 'Controle de qualidade', hi: 'गुणवत्ता नियंत्रण', ja: '品質管理',
  },
  inventoryManagement: {
    en: 'Inventory Management', de: 'Lagerverwaltung', es: 'Gestión de inventario', fr: 'Gestion des stocks', it: "Gestione dell'inventario", ar: 'إدارة المخزون', sr: 'Upravljanje zalihama', hr: 'Upravljanje zalihama', ru: 'Управление запасами', 'pt-BR': 'Gestão de estoque', hi: 'इन्वेंटरी प्रबंधन', ja: '在庫管理',
  },
  vendorManagement: {
    en: 'Vendor Management', de: 'Lieferantenmanagement', es: 'Gestión de proveedores', fr: 'Gestion des fournisseurs', it: 'Gestione dei fornitori', ar: 'إدارة الموردين', sr: 'Upravljanje dobavljačima', hr: 'Upravljanje dobavljačima', ru: 'Управление поставщиками', 'pt-BR': 'Gestão de fornecedores', hi: 'विक्रेता प्रबंधन', ja: 'ベンダー管理',
  },
  leanManagement: {
    en: 'Lean / Six Sigma', de: 'Lean / Six Sigma', es: 'Lean / Six Sigma', fr: 'Lean / Six Sigma', it: 'Lean / Six Sigma', ar: 'ليان / ستة سيجما', sr: 'Lean / Six Sigma', hr: 'Lean / Six Sigma', ru: 'Lean / Six Sigma', 'pt-BR': 'Lean / Six Sigma', hi: 'लीन / सिक्स सिग्मा', ja: 'リーン / シックスシグマ',
  },
  projectCoordination: {
    en: 'Project Coordination', de: 'Projektkoordination', es: 'Coordinación de proyectos', fr: 'Coordination de projet', it: 'Coordinamento di progetto', ar: 'تنسيق المشاريع', sr: 'Koordinacija projekata', hr: 'Koordinacija projekata', ru: 'Координация проектов', 'pt-BR': 'Coordenação de projetos', hi: 'परियोजना समन्वय', ja: 'プロジェクト調整',
  },

  // ─── Design & Creative ────────────────────────────────────────────────────
  graphicDesign: {
    en: 'Graphic Design', de: 'Grafikdesign', es: 'Diseño gráfico', fr: 'Design graphique', it: 'Design grafico', ar: 'التصميم الجرافيكي', sr: 'Grafički dizajn', hr: 'Grafički dizajn', ru: 'Графический дизайн', 'pt-BR': 'Design gráfico', hi: 'ग्राफिक डिज़ाइन', ja: 'グラフィックデザイン',
  },
  adobePhotoshop: {
    en: 'Adobe Photoshop', de: 'Adobe Photoshop', es: 'Adobe Photoshop', fr: 'Adobe Photoshop', it: 'Adobe Photoshop', ar: 'أدوبي فوتوشوب', sr: 'Adobe Photoshop', hr: 'Adobe Photoshop', ru: 'Adobe Photoshop', 'pt-BR': 'Adobe Photoshop', hi: 'एडोब फोटोशॉप', ja: 'Adobe Photoshop',
  },
  adobeIllustrator: {
    en: 'Adobe Illustrator', de: 'Adobe Illustrator', es: 'Adobe Illustrator', fr: 'Adobe Illustrator', it: 'Adobe Illustrator', ar: 'أدوبي إليستريتور', sr: 'Adobe Illustrator', hr: 'Adobe Illustrator', ru: 'Adobe Illustrator', 'pt-BR': 'Adobe Illustrator', hi: 'एडोब इलस्ट्रेटर', ja: 'Adobe Illustrator',
  },
  figma: {
    en: 'Figma', de: 'Figma', es: 'Figma', fr: 'Figma', it: 'Figma', ar: 'فيجما', sr: 'Figma', hr: 'Figma', ru: 'Figma', 'pt-BR': 'Figma', hi: 'फिग्मा', ja: 'Figma',
  },
  videoEditing: {
    en: 'Video Editing', de: 'Videobearbeitung', es: 'Edición de video', fr: 'Montage vidéo', it: 'Montaggio video', ar: 'تحرير الفيديو', sr: 'Montaža videa', hr: 'Montaža videa', ru: 'Видеомонтаж', 'pt-BR': 'Edição de vídeo', hi: 'वीडियो एडिटिंग', ja: '動画編集',
  },
  uxResearch: {
    en: 'UX Research', de: 'UX-Forschung', es: 'Investigación UX', fr: 'Recherche UX', it: 'Ricerca UX', ar: 'أبحاث تجربة المستخدم', sr: 'UX istraživanje', hr: 'UX istraživanje', ru: 'UX-исследования', 'pt-BR': 'Pesquisa UX', hi: 'यूएक्स रिसर्च', ja: 'UXリサーチ',
  },
  motionGraphics: {
    en: 'Motion Graphics', de: 'Motion Graphics', es: 'Gráficos en movimiento', fr: 'Motion design', it: 'Motion graphics', ar: 'الرسوم المتحركة', sr: 'Motion grafika', hr: 'Motion grafika', ru: 'Моушн-графика', 'pt-BR': 'Motion graphics', hi: 'मोशन ग्राफिक्स', ja: 'モーショングラフィックス',
  },
  brandDesign: {
    en: 'Brand Design', de: 'Markendesign', es: 'Diseño de marca', fr: 'Design de marque', it: 'Brand design', ar: 'تصميم الهوية البصرية', sr: 'Dizajn brenda', hr: 'Dizajn marke', ru: 'Дизайн бренда', 'pt-BR': 'Design de marca', hi: 'ब्रांड डिज़ाइन', ja: 'ブランドデザイン',
  },

  // ─── Tools & Productivity ─────────────────────────────────────────────────
  microsoftOffice: {
    en: 'Microsoft Office', de: 'Microsoft Office', es: 'Microsoft Office', fr: 'Microsoft Office', it: 'Microsoft Office', ar: 'مايكروسوفت أوفيس', sr: 'Microsoft Office', hr: 'Microsoft Office', ru: 'Microsoft Office', 'pt-BR': 'Microsoft Office', hi: 'माइक्रोसॉफ्ट ऑफिस', ja: 'Microsoft Office',
  },
  excel: {
    en: 'Excel', de: 'Excel', es: 'Excel', fr: 'Excel', it: 'Excel', ar: 'إكسل', sr: 'Excel', hr: 'Excel', ru: 'Excel', 'pt-BR': 'Excel', hi: 'एक्सेल', ja: 'Excel',
  },
  powerBi: {
    en: 'Power BI', de: 'Power BI', es: 'Power BI', fr: 'Power BI', it: 'Power BI', ar: 'باور بي آي', sr: 'Power BI', hr: 'Power BI', ru: 'Power BI', 'pt-BR': 'Power BI', hi: 'पावर बीआई', ja: 'Power BI',
  },
  tableau: {
    en: 'Tableau', de: 'Tableau', es: 'Tableau', fr: 'Tableau', it: 'Tableau', ar: 'تابلو', sr: 'Tableau', hr: 'Tableau', ru: 'Tableau', 'pt-BR': 'Tableau', hi: 'टेबलो', ja: 'Tableau',
  },
  jira: {
    en: 'Jira', de: 'Jira', es: 'Jira', fr: 'Jira', it: 'Jira', ar: 'جيرا', sr: 'Jira', hr: 'Jira', ru: 'Jira', 'pt-BR': 'Jira', hi: 'जीरा', ja: 'Jira',
  },
  slack: {
    en: 'Slack', de: 'Slack', es: 'Slack', fr: 'Slack', it: 'Slack', ar: 'سلاك', sr: 'Slack', hr: 'Slack', ru: 'Slack', 'pt-BR': 'Slack', hi: 'स्लैक', ja: 'Slack',
  },
  googleWorkspace: {
    en: 'Google Workspace', de: 'Google Workspace', es: 'Google Workspace', fr: 'Google Workspace', it: 'Google Workspace', ar: 'جوجل وركسبيس', sr: 'Google Workspace', hr: 'Google Workspace', ru: 'Google Workspace', 'pt-BR': 'Google Workspace', hi: 'गूगल वर्कस्पेस', ja: 'Google Workspace',
  },
  sap: {
    en: 'SAP', de: 'SAP', es: 'SAP', fr: 'SAP', it: 'SAP', ar: 'إس إيه بي', sr: 'SAP', hr: 'SAP', ru: 'SAP', 'pt-BR': 'SAP', hi: 'एसएपी', ja: 'SAP',
  },
};

const SKILL_ALIASES: Partial<Record<CvSkillKey, string[]>> = {
  // Soft
  communication: ['comm', 'interpersonal', 'written communication', 'verbal communication'],
  teamwork: ['collaboration', 'team player', 'cooperative'],
  leadership: ['management', 'leading teams', 'team lead'],
  problemSolving: ['problem solving', 'troubleshooting', 'root cause analysis'],
  timeManagement: ['prioritization', 'scheduling', 'task management'],
  organization: ['organizing', 'planning'],
  attentionToDetail: ['detail', 'accuracy', 'precise', 'アテンション・トゥ・ディテール', 'アテンショントゥディテール', '注意力'],
  adaptability: ['flexibility', 'agility'],
  criticalThinking: ['analysis', 'reasoning', 'analytical thinking'],
  conflictResolution: ['mediation', 'dispute resolution'],
  presentationSkills: ['presentation', 'public speaking', 'pitching'],
  relationshipBuilding: ['networking', 'stakeholder management', 'client relations'],
  creativity: ['creative thinking', 'innovation', 'ideation'],
  emotionalIntelligence: ['eq', 'empathy', 'self-awareness'],
  decisionMaking: ['judgment', 'decision making'],
  stressManagement: ['resilience', 'pressure handling'],
  motivation: ['drive', 'self-motivated', 'initiative'],
  coaching: ['coaching skills', 'mentoring', 'talent development'],
  mentoring: ['mentor', 'guiding', 'knowledge sharing'],
  negotiationSoft: ['persuasion', 'influence', 'deal-making'],
  publicSpeaking: ['speech', 'presentations', 'keynote'],
  // Business
  projectManagement: ['pm', 'coordination', 'project coordination', 'pmp'],
  strategicPlanning: ['strategy', 'planning', 'business strategy'],
  reporting: ['reports', 'dashboards', 'kpi reporting'],
  budgeting: ['finance', 'forecasting', 'budget planning'],
  dataAnalysis: ['analytics', 'insights', 'data science', 'bi'],
  changeManagement: ['organizational change', 'transformation'],
  stakeholderManagement: ['stakeholders', 'executive communication'],
  businessAnalysis: ['ba', 'requirements gathering', 'process mapping'],
  // Sales
  sales: ['sale', 'selling', 'revenue generation'],
  salesStrategy: ['pipeline', 'sales funnel', 'go-to-market'],
  negotiation: ['deal closing', 'closing deals', 'procurement', 'sales'],
  customerService: ['support', 'client service', 'customer support'],
  crmSoftware: ['crm', 'salesforce', 'hubspot', 'zoho crm'],
  leadGeneration: ['lead gen', 'prospecting', 'outbound sales'],
  accountManagement: ['key accounts', 'client management'],
  businessDevelopment: ['biz dev', 'partnerships', 'growth'],
  customerRetention: ['churn reduction', 'customer loyalty', 'upselling'],
  coldCalling: ['telemarketing', 'outbound calls', 'phone sales'],
  // Marketing
  marketing: ['brand', 'campaigns', 'digital marketing'],
  seo: ['search engine optimization', 'sem', 'organic search'],
  contentStrategy: ['content marketing', 'editorial', 'blog strategy'],
  socialMediaMarketing: ['smm', 'social media', 'instagram', 'linkedin marketing'],
  googleAnalytics: ['ga4', 'web analytics', 'google tag manager'],
  emailMarketing: ['newsletters', 'mailchimp', 'drip campaigns'],
  brandManagement: ['branding', 'brand identity'],
  marketResearch: ['competitive analysis', 'consumer insights'],
  copywriting: ['writing', 'content writing', 'advertising copy'],
  paidAdvertising: ['ppc', 'google ads', 'facebook ads', 'paid search', 'sem'],
  influencerMarketing: ['influencer', 'creator marketing', 'ugc'],
  // IT & Tech
  javascript: ['js', 'es6', 'vanilla js'],
  typescript: ['ts'],
  python: ['py', 'django', 'flask', 'pandas'],
  react: ['reactjs', 'react.js', 'next.js', 'nextjs'],
  nodejs: ['node', 'express', 'backend javascript'],
  sqlDatabases: ['sql', 'mysql', 'postgresql', 'database', 'mongodb'],
  restApis: ['api', 'rest', 'api development', 'web services'],
  git: ['github', 'gitlab', 'version control'],
  cloudServices: ['aws', 'azure', 'gcp', 'cloud computing', 'devops'],
  agileScrum: ['agile', 'scrum', 'kanban', 'sprint planning'],
  softwareTesting: ['qa', 'quality assurance', 'unit testing', 'test automation'],
  debugging: ['bug fixing', 'troubleshooting code'],
  uiUxDesign: ['ui design', 'ux design', 'user experience', 'user interface'],
  cybersecurity: ['information security', 'network security', 'pen testing'],
  machinelearning: ['ml', 'ai', 'deep learning', 'data science', 'neural networks'],
  docker: ['containers', 'containerization', 'k8s'],
  linux: ['unix', 'bash', 'shell scripting'],
  java: ['spring', 'spring boot', 'jvm'],
  csharp: ['c#', 'dotnet', '.net', 'asp.net'],
  php: ['laravel', 'symfony', 'wordpress'],
  systemDesign: ['architecture', 'software architecture', 'microservices'],
  devOps: ['ci/cd', 'jenkins', 'github actions', 'deployment'],
  // Finance
  financialAnalysis: ['financial modeling', 'valuation', 'fp&a'],
  accounting: ['bookkeeping', 'gaap', 'ifrs'],
  financialReporting: ['financial statements', 'p&l', 'balance sheet'],
  auditing: ['internal audit', 'external audit', 'compliance'],
  taxManagement: ['tax', 'tax compliance', 'vat'],
  riskManagement: ['risk assessment', 'enterprise risk', 'compliance'],
  financialModeling: ['excel modeling', 'dcf', 'valuation models'],
  investmentAnalysis: ['portfolio analysis', 'equity research'],
  // HR
  recruitment: ['hiring', 'talent acquisition', 'headhunting', 'staffing'],
  performanceManagement: ['appraisals', 'kpis', 'okrs'],
  employeeRelations: ['hr relations', 'labor relations', 'people management'],
  trainingAndDevelopment: ['l&d', 'coaching', 'onboarding'],
  payrollManagement: ['payroll', 'compensation'],
  compensationBenefits: ['c&b', 'salary benchmarking', 'benefits administration'],
  hrCompliance: ['labor law', 'hr policy', 'employment law'],
  // Operations
  supplyChainManagement: ['supply chain', 'logistics', 'procurement'],
  processImprovement: ['lean', 'six sigma', 'bpm', 'workflow optimization'],
  qualityControl: ['qc', 'quality assurance', 'iso'],
  inventoryManagement: ['stock management', 'warehouse'],
  vendorManagement: ['supplier management', 'procurement'],
  leanManagement: ['lean manufacturing', 'continuous improvement', 'kaizen'],
  projectCoordination: ['project admin', 'task coordination'],
  // Design
  graphicDesign: ['design', 'visual design', 'print design'],
  adobePhotoshop: ['photoshop', 'ps', 'photo editing'],
  adobeIllustrator: ['illustrator', 'ai', 'vector graphics'],
  figma: ['prototyping', 'wireframing', 'design tool'],
  videoEditing: ['premiere pro', 'final cut', 'after effects'],
  uxResearch: ['user research', 'usability testing', 'user interviews'],
  motionGraphics: ['after effects', 'animation', 'motion design'],
  brandDesign: ['visual identity', 'logo design', 'brand guidelines'],
  // Tools
  microsoftOffice: ['office', 'word', 'powerpoint', 'outlook', 'ms office'],
  excel: ['spreadsheet', 'spreadsheets', 'pivot tables', 'vlookup'],
  powerBi: ['power bi', 'bi dashboard', 'data visualization'],
  tableau: ['tableau desktop', 'data viz'],
  jira: ['jira software', 'atlassian', 'issue tracking'],
  slack: ['messaging', 'team chat'],
  googleWorkspace: ['google docs', 'google sheets', 'g suite'],
  sap: ['sap erp', 'sap s/4hana', 'enterprise software'],
};

function normalizeSearchValue(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getCanonicalName(skillKey: CvSkillKey): string {
  return SKILL_LABELS[skillKey].en;
}

function getLocalizedSkillLabel(skillKey: CvSkillKey, locale: Locale): string {
  return SKILL_LABELS[skillKey][locale] ?? SKILL_LABELS[skillKey].en;
}

function getSearchTerms(skillKey: CvSkillKey): string[] {
  const terms = new Set<string>([
    getCanonicalName(skillKey),
    ...Object.values(SKILL_LABELS[skillKey]),
    ...(SKILL_ALIASES[skillKey] ?? []),
  ]);

  return Array.from(terms).filter(Boolean);
}

function matchesKnownSkill(input: string, skillKey: CvSkillKey): boolean {
  const normalizedInput = normalizeSearchValue(input);
  if (!normalizedInput) return false;

  return getSearchTerms(skillKey).some((term) => normalizeSearchValue(term) === normalizedInput);
}

export function getCvSkillOptions(locale: Locale): CvSkillOption[] {
  return CV_SKILL_KEYS.map((skillKey) => ({
    canonicalName: getCanonicalName(skillKey),
    localizedLabel: getLocalizedSkillLabel(skillKey, locale),
    searchTerms: getSearchTerms(skillKey),
    category: SKILL_CATEGORY[skillKey],
  }));
}

export function filterCvSkillOptions(
  query: string,
  locale: Locale,
  selectedSkills: string[] = [],
): CvSkillOption[] {
  const normalizedQuery = normalizeSearchValue(query);
  const selected = new Set(
    selectedSkills
      .map((skill) => normalizeSearchValue(resolveStoredCvSkillName(skill) ?? skill))
      .filter(Boolean),
  );

  return getCvSkillOptions(locale)
    .filter((option) => !selected.has(normalizeSearchValue(option.canonicalName)))
    .filter((option) => {
      if (!normalizedQuery) return true;
      return option.searchTerms.some((term) => normalizeSearchValue(term).includes(normalizedQuery));
    })
    .sort((left, right) => {
      const leftStartsWith = left.searchTerms.some((term) => normalizeSearchValue(term).startsWith(normalizedQuery));
      const rightStartsWith = right.searchTerms.some((term) => normalizeSearchValue(term).startsWith(normalizedQuery));

      if (leftStartsWith !== rightStartsWith) return leftStartsWith ? -1 : 1;
      return left.localizedLabel.localeCompare(right.localizedLabel);
    });
}

export function resolveStoredCvSkillName(input: string): string | null {
  const trimmedInput = input.trim();
  if (!trimmedInput) return null;

  const matchedKey = CV_SKILL_KEYS.find((skillKey) => matchesKnownSkill(trimmedInput, skillKey));
  return matchedKey ? getCanonicalName(matchedKey) : null;
}

export function getLocalizedCvSkillName(input: string, locale: Locale): string {
  const trimmedInput = input.trim();
  if (!trimmedInput) return input;

  const matchedKey = CV_SKILL_KEYS.find((skillKey) => matchesKnownSkill(trimmedInput, skillKey));
  return matchedKey ? getLocalizedSkillLabel(matchedKey, locale) : input;
}

export function getSkillCategory(input: string): SkillCategory | null {
  const trimmedInput = input.trim();
  if (!trimmedInput) return null;

  const matchedKey = CV_SKILL_KEYS.find((skillKey) => matchesKnownSkill(trimmedInput, skillKey));
  return matchedKey ? SKILL_CATEGORY[matchedKey] : null;
}

/**
 * Maps job title keywords to a prioritized list of recommended skill canonical names.
 * Used to surface relevant skill suggestions in the CV builder when a job title is set.
 */
const JOB_TITLE_SKILL_MAP: { keywords: string[]; skills: CvSkillKey[] }[] = [
  {
    keywords: ['developer', 'engineer', 'programmer', 'software', 'frontend', 'backend', 'fullstack', 'full-stack', 'devops', 'razvojni', 'programer', 'inženjer'],
    skills: ['javascript', 'typescript', 'python', 'react', 'nodejs', 'sqlDatabases', 'restApis', 'git', 'agileScrum', 'cloudServices', 'softwareTesting', 'debugging', 'systemDesign', 'docker', 'devOps', 'problemSolving', 'teamwork'],
  },
  {
    keywords: ['designer', 'ux', 'ui', 'creative', 'graphic', 'visual', 'dizajner'],
    skills: ['uiUxDesign', 'figma', 'graphicDesign', 'adobePhotoshop', 'adobeIllustrator', 'uxResearch', 'videoEditing', 'motionGraphics', 'brandDesign', 'contentStrategy', 'communication', 'creativity', 'attentionToDetail'],
  },
  {
    keywords: ['marketing', 'digital', 'content', 'seo', 'social media', 'brand', 'kampanja'],
    skills: ['marketing', 'seo', 'contentStrategy', 'socialMediaMarketing', 'googleAnalytics', 'emailMarketing', 'brandManagement', 'copywriting', 'marketResearch', 'paidAdvertising', 'influencerMarketing', 'dataAnalysis', 'creativity'],
  },
  {
    keywords: ['sales', 'account', 'business development', 'prodaja', 'komercijalista', 'revenue'],
    skills: ['sales', 'salesStrategy', 'negotiation', 'crmSoftware', 'leadGeneration', 'accountManagement', 'businessDevelopment', 'customerService', 'customerRetention', 'coldCalling', 'communication', 'relationshipBuilding', 'presentationSkills'],
  },
  {
    keywords: ['manager', 'director', 'head', 'lead', 'menadžer', 'rukovodilac', 'direktor', 'voditelj'],
    skills: ['leadership', 'projectManagement', 'strategicPlanning', 'teamwork', 'communication', 'budgeting', 'reporting', 'conflictResolution', 'performanceManagement', 'stakeholderManagement', 'changeManagement', 'decisionMaking', 'criticalThinking'],
  },
  {
    keywords: ['finance', 'financial', 'accountant', 'accounting', 'controller', 'analitičar', 'računovođa', 'finansije'],
    skills: ['financialAnalysis', 'accounting', 'financialReporting', 'excel', 'budgeting', 'auditing', 'taxManagement', 'riskManagement', 'financialModeling', 'investmentAnalysis', 'dataAnalysis', 'powerBi', 'attentionToDetail'],
  },
  {
    keywords: ['hr', 'human resources', 'people', 'talent', 'recruiter', 'recruitment', 'kadrovi', 'ljudski resursi'],
    skills: ['recruitment', 'employeeRelations', 'performanceManagement', 'trainingAndDevelopment', 'payrollManagement', 'compensationBenefits', 'hrCompliance', 'communication', 'conflictResolution', 'coaching', 'mentoring', 'organization'],
  },
  {
    keywords: ['operations', 'supply chain', 'logistics', 'warehouse', 'procurement', 'operacije', 'logistika', 'nabavka'],
    skills: ['supplyChainManagement', 'processImprovement', 'qualityControl', 'inventoryManagement', 'vendorManagement', 'leanManagement', 'projectCoordination', 'projectManagement', 'reporting', 'organization', 'problemSolving'],
  },
  {
    keywords: ['customer', 'support', 'service', 'help desk', 'korisnička', 'podrška', 'servis'],
    skills: ['customerService', 'communication', 'problemSolving', 'crmSoftware', 'conflictResolution', 'adaptability', 'timeManagement', 'attentionToDetail', 'emotionalIntelligence', 'stressManagement'],
  },
  {
    keywords: ['data', 'analyst', 'analytics', 'scientist', 'bi', 'business intelligence', 'analitičar', 'podaci'],
    skills: ['dataAnalysis', 'sqlDatabases', 'python', 'excel', 'powerBi', 'tableau', 'reporting', 'googleAnalytics', 'machinelearning', 'criticalThinking', 'businessAnalysis', 'strategicPlanning'],
  },
  {
    keywords: ['cybersecurity', 'security', 'infosec', 'network', 'sigurnost', 'bezbednost', 'mreža'],
    skills: ['cybersecurity', 'debugging', 'git', 'python', 'linux', 'riskManagement', 'attentionToDetail', 'problemSolving', 'cloudServices', 'systemDesign'],
  },
  {
    keywords: ['project manager', 'product manager', 'product owner', 'scrum master', 'po', 'pm'],
    skills: ['projectManagement', 'agileScrum', 'stakeholderManagement', 'communication', 'leadership', 'reporting', 'jira', 'strategicPlanning', 'changeManagement', 'teamwork', 'decisionMaking'],
  },
];

/**
 * Returns a list of recommended CvSkillOption objects based on ALL job titles
 * from the user's work experience entries.
 *
 * Analyzes every job title, creates one combined skill pool, removes duplicates
 * and near-duplicates, ranks skills by relevance (frequency) across all entries,
 * and returns the top `limit` most relevant suggestions (default 15).
 */
export function getSkillSuggestionsByJobTitles(
  jobTitles: string[],
  locale: Locale,
  selectedSkills: string[] = [],
  limit = 15,
): CvSkillOption[] {
  const validTitles = jobTitles.filter((title) => title.trim());
  if (validTitles.length === 0) return [];

  // Dev-only: validTitles count, not the titles themselves, to avoid exposing user content
  if (process.env.NODE_ENV !== 'production') console.log('[getSkillSuggestionsByJobTitles] INPUT job titles count:', validTitles.length);

  const selected = new Set(
    selectedSkills
      .map((skill) => normalizeSearchValue(resolveStoredCvSkillName(skill) ?? skill))
      .filter(Boolean),
  );

  const UNIVERSAL_KEYS: CvSkillKey[] = [
    'communication', 'teamwork', 'problemSolving', 'timeManagement',
    'adaptability', 'organization', 'criticalThinking', 'presentationSkills',
    'leadership', 'creativity',
  ];

  // ── Phase 1: For each job title, collect its contributed skills ─────────────
  // skillsByTitle[titleIndex] = ordered list of skill keys for that job title
  const skillsByTitle: CvSkillKey[][] = [];
  const matchedCategoriesPerTitle: string[] = [];

  for (const title of validTitles) {
    const normalizedTitle = normalizeSearchValue(title);
    const titleSkills: CvSkillKey[] = [];
    const seenInTitle = new Set<CvSkillKey>();

    const matchedEntries = JOB_TITLE_SKILL_MAP.filter(({ keywords }) =>
      keywords.some((kw) => normalizedTitle.includes(normalizeSearchValue(kw))),
    );

    if (matchedEntries.length > 0) {
      matchedCategoriesPerTitle.push(`${title} → ${matchedEntries.length} categories (${matchedEntries.map(e => e.keywords[0]).join(', ')})`);
      for (const entry of matchedEntries) {
        for (const skillKey of entry.skills) {
          if (
            CV_SKILL_KEYS.includes(skillKey) &&
            !selected.has(normalizeSearchValue(getCanonicalName(skillKey))) &&
            !seenInTitle.has(skillKey)
          ) {
            seenInTitle.add(skillKey);
            titleSkills.push(skillKey);
          }
        }
      }
    } else {
      matchedCategoriesPerTitle.push(`${title} → NO CATEGORY MATCH (fallback to universal soft skills)`);
      for (const skillKey of UNIVERSAL_KEYS) {
        if (!selected.has(normalizeSearchValue(getCanonicalName(skillKey))) && !seenInTitle.has(skillKey)) {
          seenInTitle.add(skillKey);
          titleSkills.push(skillKey);
        }
      }
    }

    skillsByTitle.push(titleSkills);
  }

  if (process.env.NODE_ENV !== 'production') console.log('[getSkillSuggestionsByJobTitles] Category match count:', matchedCategoriesPerTitle.length);

  // ── Phase 2: Round-robin interleave across job titles ─────────────────────
  // Skills from each title in their insertion order (as defined in JOB_TITLE_SKILL_MAP).
  // The round-robin ensures proportional representation from every job title.
  const resultKeys: CvSkillKey[] = [];
  const addedToResult = new Set<CvSkillKey>();
  const indexes = new Array(skillsByTitle.length).fill(0);

  // Round-robin: take one skill from each title in turn
  let anyProgress = true;
  while (anyProgress && resultKeys.length < limit) {
    anyProgress = false;
    for (let ti = 0; ti < skillsByTitle.length && resultKeys.length < limit; ti++) {
      while (indexes[ti] < skillsByTitle[ti].length) {
        const candidate = skillsByTitle[ti][indexes[ti]];
        indexes[ti]++;
        if (!addedToResult.has(candidate)) {
          addedToResult.add(candidate);
          resultKeys.push(candidate);
          anyProgress = true;
          break;
        }
      }
    }
  }

  const resultLabels = resultKeys.map((key) => getCanonicalName(key));
  if (process.env.NODE_ENV !== 'production') console.log('[getSkillSuggestionsByJobTitles] RESULT skill count:', resultLabels.length);

  return resultKeys.map((key) => ({
    canonicalName: getCanonicalName(key),
    localizedLabel: getLocalizedSkillLabel(key, locale),
    searchTerms: getSearchTerms(key),
    category: SKILL_CATEGORY[key],
  }));
}

/**
 * Returns a list of recommended CvSkillOption objects based on the job title,
 * excluding skills already added by the user.
 * Returns up to `limit` results (default 10).
 */
export function getSkillSuggestionsByJobTitle(
  jobTitle: string,
  locale: Locale,
  selectedSkills: string[] = [],
  limit = 10,
): CvSkillOption[] {
  if (!jobTitle.trim()) return [];

  const normalizedTitle = normalizeSearchValue(jobTitle);
  const selected = new Set(
    selectedSkills
      .map((skill) => normalizeSearchValue(resolveStoredCvSkillName(skill) ?? skill))
      .filter(Boolean),
  );

  // Find the best matching category (first match wins)
  const matchedEntry = JOB_TITLE_SKILL_MAP.find(({ keywords }) =>
    keywords.some((kw) => normalizedTitle.includes(normalizeSearchValue(kw))),
  );

  if (!matchedEntry) {
    // Fall back to universal soft-skills if no specific category matched
    const universalKeys: CvSkillKey[] = ['communication', 'teamwork', 'problemSolving', 'timeManagement', 'adaptability', 'organization', 'criticalThinking', 'presentationSkills', 'leadership', 'creativity'];
    return universalKeys
      .filter((key) => !selected.has(normalizeSearchValue(getCanonicalName(key))))
      .slice(0, limit)
      .map((key) => ({
        canonicalName: getCanonicalName(key),
        localizedLabel: getLocalizedSkillLabel(key, locale),
        searchTerms: getSearchTerms(key),
        category: SKILL_CATEGORY[key],
      }));
  }

  return matchedEntry.skills
    .filter((key) => CV_SKILL_KEYS.includes(key) && !selected.has(normalizeSearchValue(getCanonicalName(key))))
    .slice(0, limit)
    .map((key) => ({
      canonicalName: getCanonicalName(key),
      localizedLabel: getLocalizedSkillLabel(key, locale),
      searchTerms: getSearchTerms(key),
      category: SKILL_CATEGORY[key],
    }));
}

/**
 * Maps each BulletIndustry to a prioritized list of recommended skill keys.
 * Used to surface dynamic skill suggestions when the user selects an industry
 * in the AI Improvements section — without overwriting user-entered skills.
 */
const INDUSTRY_SKILL_MAP: Record<BulletIndustry, CvSkillKey[]> = {
  tech: ['javascript', 'typescript', 'python', 'react', 'nodejs', 'sqlDatabases', 'restApis', 'git', 'agileScrum', 'cloudServices', 'softwareTesting', 'debugging', 'systemDesign', 'docker', 'devOps', 'problemSolving', 'teamwork'],
  data_ai: ['python', 'sqlDatabases', 'dataAnalysis', 'machinelearning', 'powerBi', 'tableau', 'excel', 'cloudServices', 'git', 'criticalThinking', 'problemSolving', 'reporting', 'businessAnalysis'],
  cybersecurity: ['cybersecurity', 'linux', 'python', 'riskManagement', 'systemDesign', 'cloudServices', 'debugging', 'git', 'attentionToDetail', 'problemSolving', 'reporting', 'communication'],
  sales_retail: ['customerService', 'communication', 'sales', 'negotiationSoft', 'timeManagement', 'teamwork', 'adaptability', 'attentionToDetail', 'motivation', 'stressManagement'],
  sales_b2b: ['sales', 'salesStrategy', 'negotiation', 'crmSoftware', 'leadGeneration', 'accountManagement', 'businessDevelopment', 'customerRetention', 'coldCalling', 'communication', 'relationshipBuilding', 'presentationSkills'],
  sales: ['sales', 'salesStrategy', 'negotiation', 'crmSoftware', 'leadGeneration', 'accountManagement', 'businessDevelopment', 'customerService', 'customerRetention', 'coldCalling', 'communication', 'relationshipBuilding'],
  marketing: ['marketing', 'seo', 'contentStrategy', 'socialMediaMarketing', 'googleAnalytics', 'emailMarketing', 'brandManagement', 'copywriting', 'marketResearch', 'paidAdvertising', 'dataAnalysis', 'creativity'],
  finance: ['financialAnalysis', 'accounting', 'financialReporting', 'excel', 'budgeting', 'auditing', 'taxManagement', 'riskManagement', 'financialModeling', 'dataAnalysis', 'powerBi', 'attentionToDetail'],
  banking_fintech: ['financialAnalysis', 'riskManagement', 'financialReporting', 'excel', 'sqlDatabases', 'accounting', 'dataAnalysis', 'reporting', 'communication', 'attentionToDetail', 'criticalThinking'],
  healthcare: ['communication', 'teamwork', 'attentionToDetail', 'timeManagement', 'stressManagement', 'problemSolving', 'adaptability', 'emotionalIntelligence', 'reporting', 'criticalThinking'],
  pharmacy: ['attentionToDetail', 'communication', 'timeManagement', 'teamwork', 'reporting', 'problemSolving', 'adaptability', 'stressManagement', 'criticalThinking', 'customerService'],
  education: ['communication', 'coaching', 'mentoring', 'presentationSkills', 'creativity', 'timeManagement', 'organization', 'adaptability', 'leadership', 'criticalThinking'],
  human_resources: ['recruitment', 'performanceManagement', 'employeeRelations', 'trainingAndDevelopment', 'payrollManagement', 'compensationBenefits', 'hrCompliance', 'communication', 'conflictResolution', 'coaching'],
  customer_service: ['customerService', 'communication', 'problemSolving', 'crmSoftware', 'conflictResolution', 'adaptability', 'timeManagement', 'attentionToDetail', 'emotionalIntelligence', 'stressManagement'],
  logistics: ['supplyChainManagement', 'inventoryManagement', 'processImprovement', 'vendorManagement', 'leanManagement', 'projectCoordination', 'reporting', 'organization', 'problemSolving', 'excel'],
  operations: ['processImprovement', 'supplyChainManagement', 'qualityControl', 'inventoryManagement', 'vendorManagement', 'leanManagement', 'projectCoordination', 'projectManagement', 'reporting', 'problemSolving'],
  executive: ['leadership', 'strategicPlanning', 'stakeholderManagement', 'changeManagement', 'budgeting', 'reporting', 'decisionMaking', 'communication', 'teamwork', 'criticalThinking'],
  project_management: ['projectManagement', 'agileScrum', 'stakeholderManagement', 'communication', 'leadership', 'reporting', 'jira', 'strategicPlanning', 'changeManagement', 'teamwork', 'decisionMaking', 'riskManagement'],
  design: ['uiUxDesign', 'figma', 'graphicDesign', 'adobePhotoshop', 'adobeIllustrator', 'uxResearch', 'videoEditing', 'brandDesign', 'contentStrategy', 'communication', 'creativity', 'attentionToDetail'],
  engineering: ['problemSolving', 'attentionToDetail', 'criticalThinking', 'teamwork', 'reporting', 'projectManagement', 'dataAnalysis', 'communication', 'organization', 'changeManagement'],
  construction: ['projectManagement', 'projectCoordination', 'reporting', 'organization', 'attentionToDetail', 'communication', 'teamwork', 'riskManagement', 'budgeting', 'problemSolving'],
  hospitality: ['customerService', 'communication', 'teamwork', 'adaptability', 'timeManagement', 'organization', 'stressManagement', 'emotionalIntelligence', 'motivation', 'attentionToDetail'],
  legal: ['attentionToDetail', 'criticalThinking', 'communication', 'reporting', 'businessAnalysis', 'organization', 'timeManagement', 'conflictResolution', 'problemSolving', 'relationshipBuilding'],
  administration: ['microsoftOffice', 'excel', 'googleWorkspace', 'organization', 'timeManagement', 'communication', 'attentionToDetail', 'adaptability', 'reporting', 'jira', 'slack'],
  general: ['communication', 'teamwork', 'problemSolving', 'timeManagement', 'adaptability', 'organization', 'criticalThinking', 'presentationSkills', 'leadership', 'creativity'],
};

/**
 * Returns a list of recommended CvSkillOption objects based on the selected industry,
 * excluding skills already added by the user.
 * Returns up to `limit` results (default 10).
 * Does NOT overwrite user-entered skills — only suggests additions.
 */
export function getSkillSuggestionsByIndustry(
  industry: BulletIndustry,
  locale: Locale,
  selectedSkills: string[] = [],
  limit = 10,
): CvSkillOption[] {
  const skillKeys = INDUSTRY_SKILL_MAP[industry] ?? INDUSTRY_SKILL_MAP.general;

  const selected = new Set(
    selectedSkills
      .map((skill) => normalizeSearchValue(resolveStoredCvSkillName(skill) ?? skill))
      .filter(Boolean),
  );

  return skillKeys
    .filter((key) => CV_SKILL_KEYS.includes(key) && !selected.has(normalizeSearchValue(getCanonicalName(key))))
    .slice(0, limit)
    .map((key) => ({
      canonicalName: getCanonicalName(key),
      localizedLabel: getLocalizedSkillLabel(key, locale),
      searchTerms: getSearchTerms(key),
      category: SKILL_CATEGORY[key],
    }));
}
