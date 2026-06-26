export type Locale = 'en' | 'de' | 'es' | 'fr' | 'it' | 'ar' | 'sr' | 'hr' | 'ru' | 'pt-BR' | 'hi' | 'ja';

export interface LanguageInfo {
  code: Locale;
  name: string;
  nativeName: string;
  flag: string;
  dir: 'ltr' | 'rtl';
}

export const languages: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', dir: 'ltr' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', flag: '🇧🇷', dir: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', dir: 'ltr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  { code: 'sr', name: 'Serbian', nativeName: 'Srpski', flag: '🇷🇸', dir: 'ltr' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', flag: '🇭🇷', dir: 'ltr' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', dir: 'ltr' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', dir: 'ltr' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', dir: 'ltr' },
];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_STORAGE_KEY = 'cvpro-locale';

const localeMap = new Map(languages.map((language) => [language.code.toLowerCase(), language.code] as const));
const baseLocaleMap = new Map<string, Locale>([
  ['en', 'en'],
  ['pt', 'pt-BR'],
  ['de', 'de'],
  ['es', 'es'],
  ['fr', 'fr'],
  ['it', 'it'],
  ['ar', 'ar'],
  ['sr', 'sr'],
  ['hr', 'hr'],
  ['ru', 'ru'],
  ['hi', 'hi'],
  ['ja', 'ja'],
]);

export function isLocale(value: string | null | undefined): value is Locale {
  if (!value) return false;
  return localeMap.has(value.toLowerCase());
}

export function resolveLocaleCandidate(value: string | null | undefined): Locale | null {
  if (!value) return null;

  const normalized = value.trim();
  if (!normalized) return null;

  const exact = localeMap.get(normalized.toLowerCase());
  if (exact) return exact;

  const base = normalized.split(/[-_]/)[0]?.toLowerCase();
  if (!base) return null;

  return baseLocaleMap.get(base) ?? null;
}

export function resolvePreferredLocale(candidates: readonly string[] | null | undefined): Locale {
  for (const candidate of candidates ?? []) {
    const resolved = resolveLocaleCandidate(candidate);
    if (resolved) return resolved;
  }

  return DEFAULT_LOCALE;
}

export function resolveInitialLocalePreference(
  storedLocale: string | null | undefined,
): Locale {
  return resolveLocaleCandidate(storedLocale) ?? DEFAULT_LOCALE;
}

export type TranslationKeys = {
  nav: {
    home: string;
    cvBuilder: string;
    coverLetter: string;
    templates: string;
    pricing: string;
    about: string;
    contact: string;
    login: string;
    register: string;
    dashboard: string;
    logout: string;
  };
      hero: {
        title: string;
        professionalResumesAiPowered: string;
        subtitle: string;
        valueDesc: string;
        cta: string;
        ctaSecondary: string;
        badge: string;
        footerText: string;
      };
    features: {
      title: string;
      subtitle: string;
      badge: string;
      ai: { title: string; desc: string };
      multilingual: { title: string; desc: string };
      templates: { title: string; desc: string };
      ats: { title: string; desc: string };
      region: { title: string; desc: string };
      export: { title: string; desc: string };
      analyzer: { title: string; desc: string };
    };
    howItWorks: {
      title: string;
      step: string;
      step1: { title: string; desc: string };
      step2: { title: string; desc: string };
      step3: { title: string; desc: string };
    };
    whoIsThisFor: {
      title: string;
      items: string[];
    };
    privacyFirst: {
      title: string;
      desc: string;
      local: string;
    };
    simplePricing: {
      title: string;
      desc: string;
    };
      pricing: {
        title: string;
        subtitle: string;
        oneTime: string;
        getStarted: string;
        footerText: string;
        free: { name: string; price: string; features: string[]; cta: string; desc: string };
      pro: { name: string; price: string; features: string[]; cta: string; desc: string; badge: string; footer: string; noSubscription: string };
      tableTitle: string;
      tableHeaderFeature: string;
      tableHeaderFree: string;
      tableHeaderPro: string;
      tableRowCV: string;
      tableRowCoverLetter: string;
      tableRowTemplates: string;
      tableRowAI: string;
      tableRowRewrite: string;
      tableRowAnalyzer: string;
        tableRowLanguages: string;
        tableRowSupport: string;
        unlimited: string;
        threeStandard: string;
        proTemplatesCount: string;
        oneCount: string;
        popularBadge: string;
        bestValueBadge: string;
        coverLetterFreeValue: string;
        coverLetterProValue: string;
        restoreTitle: string;
        restoreDesc: string;
        restoreButton: string;
        proActive: string;
        restoringText: string;
        needHelp: string;
        fairUse: string;
      };
      faq: {

      title: string;
      items: { q: string; a: string }[];
    };
    cv: {
      title: string;
      personal: string;
      experience: string;
      education: string;
      skills: string;
      certifications: string;
      languages: string;
      summary: string;
      generate: string;
      rewrite: string;
      translate: string;
      analyzeJob: string;
      download: string;
      downloadPdf: string;
      downloadDocx: string;
      downloadPdfDesc: string;
      downloadDocxDesc: string;
      downloadNote: string;
      downloadCv: string;
      pdfExportFailed: string;
      wordExportFailed: string;
      preview: string;
      selectTemplate: string;
      jobTitle: string;
      fullName: string;
      email: string;
      phone: string;
      address: string;
      fathersName: string;
      nationality: string;
      dateOfBirth: string;
      company: string;
      position: string;
      startDate: string;
      endDate: string;
      present: string;
      description: string;
      degree: string;
      school: string;
      addMore: string;
      remove: string;
      region: string;
      ready: string;
      readySubtitle: string;
      edit: string;
      copied: string;
      copy: string;
      jobTitlePlaceholder: string;
      fullNamePlaceholder: string;
      aiBullets: string;
      skillPlaceholder: string;
      certPlaceholder: string;
      langPlaceholder: string;
      levelPlaceholder: string;
      summaryPlaceholder: string;
      jobDescPlaceholder: string;
      short: string;
      strong: string;
      professional: string;
      keywordsFound: string;
      suggestions: string;
      suggestedSkills: string;
      skillCategories: {
        technical: string;
        soft: string;
      };
      aiRecommend: string;
      recommendedToast: string;
      recommendedForYou: string;
      bestResultsTemplate: string;
      optimizedForProfile: string;
      unlockWithPro: string;
      saveRequired: string;
      saved: string;
      draftSaved: string;
      genSuccess: string;
      bulletsSuccess: string;
      rewriteSuccess: string;
      levels: {
        native: string;
        fluent: string;
        advanced: string;
        intermediate: string;
        basic: string;
      };
      gender: string;
      genderMale: string;
      genderFemale: string;
      genderOther: string;
      coverLetterSection: string;
      regions: {
        us: string;
        eu: string;
        balkan: string;
        middleEast: string;
        india: string;
        japan: string;
      };
      photo: {
        title: string;
        optional: string;
        shown: string;
        hidden: string;
        shownDesc: string;
        hiddenDesc: string;
        change: string;
        upload: string;
        recrop: string;
        remove: string;
        hint: string;
        aiEnhance: string;
        aiEnhancing: string;
        applied: string;
        upgrade: string;
        features: string[];
        cropTitle: string;
        cropHint: string;
        apply: string;
        usRegion: string;
        otherRegion: string;
        errorFormat: string;
      };
      industryLabel: string;
      levelLabel: string;
      industryPlaceholder: string;
      industries: {
        tech: string;
        data_ai: string;
        cybersecurity: string;
        sales_retail: string;
        sales_b2b: string;
        marketing: string;
        sales: string;
        finance: string;
        banking_fintech: string;
        healthcare: string;
        pharmacy: string;
        education: string;
        human_resources: string;
        customer_service: string;
        logistics: string;
        operations: string;
        executive: string;
        project_management: string;
        design: string;
        engineering: string;
        construction: string;
        hospitality: string;
        legal: string;
        administration: string;
        general: string;
      };
      bulletLevels: {
        entry: string;
        mid: string;
        senior: string;
        lead: string;
      };
      aiExperienceIntro: string;
      aiExperienceIntroSub: string;
      aiSummaryIntro: string;
      aiSummaryIntroSub: string;
      generateSubtext: string;
      shorterSubtext: string;
      strongerSubtext: string;
      professionalSubtext: string;
      aiBulletsSubtext: string;
      analyzeJobSubtext: string;
      analyzeJobProOnly: string;
      aiRecommendSubtext: string;
      proHint: string;
      proHintPopular: string;
      jobAnalysis: {
        title: string;
        subtitle: string;
        matchScore: string;
        matchGood: string;
        matchAverage: string;
        matchWeak: string;
        keyInsights: string;
        insight1: string;
        insight2: string;
        insight3: string;
        importantKeywords: string;
        unlockFull: string;
        suggestedImprovements: string;
        improve1: string;
        improve2: string;
        improve3: string;
        proCardTitle: string;
        proCardText: string;
        proCardCta: string;
        proCardNote: string;
        analyzing: string;
      };
    };
    coverLetter: {
      title: string;
      firstName: string;
      lastName: string;
      gender: string;
      genderMale: string;
      genderFemale: string;
      genderPreferNot: string;
      identitySection: string;
      jobTitle: string;
      companyName: string;
      tone: string;
      tones: { formal: string; confident: string; friendly: string };
      generate: string;
      generating: string;
      regenerate: string;
      regenerating: string;
      regenerateSubtitle: string;
      edit: string;
      companyPlaceholder: string;
      firstNamePlaceholder: string;
      lastNamePlaceholder: string;
      genSuccess: string;
      saved: string;
      draftSaved: string;
      placeholder: string;
      preview: string;
      filename: string;
      regenLeft: string;
      regenExhausted: string;
      paywallMessage: string;
      downloadCl: string;
      generateSubtitle: string;
      aiDisclaimer: string;
    };
    auth: {
      login: string;
      register: string;
      email: string;
      password: string;
      confirmPassword: string;
      name: string;
    forgotPassword: string;
    noAccount: string;
    hasAccount: string;
    invalidCredentials: string;
    emailTaken: string;
  };

    dashboard: {
      title: string;
      myCVs: string;
      myCoverLetters: string;
      createNew: string;
      edit: string;
      delete: string;
      lastEdited: string;
      upgrade: string;
      plan: string;
      welcome: string;
      noCVs: string;
      noLetters: string;
      untitled: string;
      cvDeleted: string;
    letterDeleted: string;
    loginRequired: string;
    upgradeBanner: string;
  };
  common: {

      save: string;
      cancel: string;
      back: string;
      next: string;
      loading: string;
      proAccessRequired: string;
      proAuthorizationUnavailable: string;
      error: string;
      success: string;
      darkMode: string;
      lightMode: string;
      language: string;
      legal: string;
      previewBadge: string;
      slide: string;
      appName: string;
      docx: string;
    };
  footer: {
    rights: string;
    privacy: string;
    terms: string;
    backToHome: string;
  };
  templates: {
    title: string;
    subtitle: string;
    showcase: string;
    showcaseSubtitle: string;
    freeCount: string;
    proCount: string;
    proBadge: string;
    unlockPro: string;
    browseAll: string;
      categories: {
        ats: string;
        creative: string;
        executive: string;
        modern: string;
        japanese: string;
      };
    items: Record<string, {
      name: string;
      description: string;
      category: string;
    }>;
  };
  legal: {
    privacy: {
      title: string;
      effectiveDate: string;
      sections: { title: string; content: string; items?: string[] }[];
    };
    terms: {
      title: string;
      effectiveDate: string;
      sections: { title: string; content: string; items?: string[] }[];
    };
  };
  comparison: {
    title: string;
    subtitle: string;
    freePlan: string;
    proPlan: string;
    good: string;
    hireReady: string;
    proBadge: string;
    freeFeatures: string[];
    proFeatures: string[];
    summary: string;
    experience: string;
    expertise: string;
    languages: string;
    chips: string[];
    persuasiveText: string;
  };
  previews: {
    name: string;
    role: string;
    email: string;
    phone: string;
    location: string;
    experience: string;
    education: string;
    skills: string;
    contact: string;
    headOfProduct: string;
    productManager: string;
    jrPm: string;
    techCorp: string;
    startupXY: string;
    digitalAgency: string;
    techCorpDesc: string;
    startupDesc: string;
    agencyDesc: string;
    mba: string;
    columbia: string;
    present: string;
    now: string;
    productVision: string;
    teamLeadership: string;
    gtm: string;
    dataAnalysis: string;
    productStrategy: string;
    uxResearch: string;
    agile: string;
    techCorpYears: string;
    startupYears: string;
    educationYears: string;
    agencyYears: string;
  };
  about: {
    hero: {
      badge: string;
      title: string;
      description: string;
      ageRating: string;
      languages: string;
      privacyFirst: string;
    };
    description: {
      title: string;
      paragraphs: string[];
    };
    features: {
      title: string;
      free: {
        label: string;
        items: string[];
        disabledItems: string[];
      };
      pro: {
        label: string;
        price: string;
        items: string[];
        footer: string;
      };
    };
    aiDisclosure: {
      title: string;
      items: string[];
    };
    ageAndContent: {
      title: string;
      ageRating: string;
      ageRatingDesc: string;
      disclaimer: string;
      noLiability: string;
      privacy: string;
    };
    languages: {
      title: string;
      list: string[];
    };
    restorePurchase: {
      title: string;
      description: string;
    };
    legal: {
      title: string;
      privacyPolicy: string;
      termsOfService: string;
      contact: string;
      viewPricing: string;
    };
  };
  onboarding: {
    title: string;
    subtitle: string;
    freeLabel: string;
    freeFeatures: string[];
    proLabel: string;
    proRecommendedBadge: string;
    proFeatures: string[];
    oneTimePayment: string;
    aiFeatureTitle: string;
    aiFeatureDesc: string;
    startFree: string;
    upgradeToPro: string;
    secureCheckout: string;
  };
};

export const en: TranslationKeys = {
  nav: { home: 'Home', cvBuilder: 'CV Builder', coverLetter: 'Cover Letter', templates: 'Templates', pricing: 'Pricing', about: 'About', contact: 'Contact', login: 'Log In', register: 'Sign Up', dashboard: 'Dashboard', logout: 'Log Out' },
  hero: { title: '✨ AI & Smart Resume Builder', professionalResumesAiPowered: 'Professional resumes. AI-powered.', subtitle: 'AI & Smart Resume Builder with premium templates and smart job optimization.', valueDesc: 'Create a professional resume in minutes. Unlock 10 premium templates and advanced tools with Pro.', cta: 'Create My CV', ctaSecondary: 'View Templates', badge: 'AI & Smart Resume Builder', footerText: 'One-time payment. Lifetime access. No subscription.' },
  features: { title: 'Everything you need to land the role.', subtitle: 'Powerful AI tools designed for the global job market', badge: "What's included", ai: { title: 'Smart AI Writing', desc: 'Improves clarity, structure, and impact automatically.' }, multilingual: { title: 'Multi-language Support', desc: 'Create CVs in 9 languages instantly.' }, templates: { title: 'Premium Templates', desc: '10 premium + 3 free templates. Modern US/EU professional designs.' }, ats: { title: 'ATS-Friendly', desc: 'All templates pass Applicant Tracking Systems with optimized formatting.' }, region: { title: 'Region Optimized', desc: 'Automatic adaptation for US, EU, Balkan, and Middle East job markets.' },       export: { title: 'DOCX Export', desc: 'Download as DOCX or copy to clipboard with one click.' }, analyzer: { title: 'Job Description Analyzer', desc: 'Match your CV to job listings with AI precision. Pro only.' } },
  howItWorks: { title: 'How It Works', step: 'STEP', step1: { title: 'Add Your Information', desc: 'Fill in your personal details, work experience, and education to start building your resume.' }, step2: { title: 'Improve Your Resume', desc: 'Use smart tools and suggestions to make your resume stronger and more professional.' }, step3: { title: 'Download Your Resume', desc: 'Export your finished resume in high-quality DOCX format ready to send to employers.' } },
  whoIsThisFor: { title: 'Who Is This Resume Builder For', items: ['Job seekers', 'Students and graduates', 'Professionals changing careers', 'Anyone who wants a modern professional resume'] },
  privacyFirst: { title: 'Privacy First', desc: 'Your resume data stays on your device. We do not store, sell, or share your personal information.', local: 'This resume builder works locally on your device to keep your information safe.' },
  simplePricing: { title: 'Simple Pricing', desc: 'No subscription. One-time purchase to unlock all Pro resume templates and advanced tools.' },
  pricing: { 
    title: 'Simple pricing.', 
    subtitle: 'No subscriptions. No monthly fees. Pay once.', 
    oneTime: '$3.99 one-time', 
    getStarted: 'Get started',
    footerText: 'One-time payment · Lifetime access · No subscription',
      free: { name: 'Free', price: '$0', features: ['3 Standard Templates', '1 CV Download', '1 Cover Letter download', 'All Languages'], cta: 'Start Free', desc: 'Get started at no cost.' }, 
      pro: { name: 'Pro', price: '$3.99', features: ['10 Premium Templates', 'Unlimited CV Downloads', 'Unlimited AI-generated Cover Letters', 'Job Description Analyzer', 'AI Writing Improvements', 'All Languages'], cta: 'Upgrade to Pro', desc: 'Pay once. Use forever.', badge: 'Pro — Lifetime Access', footer: 'Secure checkout. Instant activation.', noSubscription: 'No subscription. No renewal.' },
    tableTitle: 'Feature comparison',
    tableHeaderFeature: 'Feature',
    tableHeaderFree: 'Free',
    tableHeaderPro: 'Pro',
    tableRowCV: 'CV Downloads',
    tableRowCoverLetter: 'Cover Letter Downloads',
    tableRowTemplates: 'Templates',
    tableRowAI: 'AI Summary Generation',
    tableRowRewrite: 'AI Rewrite Tools',
    tableRowAnalyzer: 'Job Description Analyzer',
    tableRowLanguages: 'All Languages',
    tableRowSupport: 'Priority Support',
      unlimited: 'Unlimited',
      threeStandard: '3 Standard',
      proTemplatesCount: '10 Premium + 3 Free',
      oneCount: '1',
      popularBadge: 'Most Popular',
      bestValueBadge: 'Best Value',
      coverLetterFreeValue: '1 Cover Letter download',
      coverLetterProValue: 'Unlimited AI-generated Cover Letters',
      restoreTitle: 'Already purchased Pro?',
      restoreDesc: 'Restore your previous purchase to regain Pro access on this device.',
      restoreButton: 'Restore Purchase',
      proActive: 'Pro Active',
      restoringText: 'Restoring...',
      needHelp: 'Need help?',
      fairUse: 'Fair-use limits may apply to prevent abuse and ensure reliable service.'
    },

  faq: { title: 'Frequently Asked Questions', items: [
    { q: 'What is included in the free plan?', a: 'The free plan lets you create 1 CV and generate 1 cover letter. You can also use AI tools with limited access to help improve your content.' },
    { q: 'How many cover letters can I generate for free?', a: 'You can generate 1 cover letter for free, including 1 regeneration attempt.' },
    { q: 'What happens after I use my free cover letter?', a: 'After using your free cover letter, you can upgrade to Pro for unlimited cover letters and full access to AI features.' },
    { q: 'What do I get with Pro?', a: 'Pro gives you unlimited cover letters, full access to all AI tools, premium templates, and advanced CV optimization features.' },
    { q: 'Are AI features free?', a: 'Some AI features are available for free with limited usage. Upgrade to Pro to unlock unlimited access.' },
    { q: 'Can I use the app in different languages?', a: 'Yes, the app supports multiple languages so you can create your CV and cover letter in your preferred language.' },
    { q: 'Are the templates ATS-friendly?', a: 'Absolutely. All our templates are designed to pass Applicant Tracking Systems used by major employers worldwide.' },
    { q: 'How does the AI work? Does it store my data?', a: 'The AI uses only your inputs (job title, company, tone, etc.) to generate text. It does not permanently store your personal data. The app uses third-party AI services to process generation requests.' },
    { q: 'Is the AI-generated content always accurate?', a: 'AI-generated content may contain inaccuracies or require adjustments. Please review all AI-generated text carefully before submitting to employers. Users are responsible for the final content.' }
  ] },
    cv: { title: 'CV Builder', personal: 'Personal Information', experience: 'Work Experience', education: 'Education', skills: 'Skills', certifications: 'Certifications', languages: 'Languages', summary: 'Professional Summary', generate: 'Generate with AI', rewrite: 'Rewrite', translate: 'Translate', analyzeJob: 'Analyze Job Description', download: 'Download', downloadCv: 'Download CV', downloadPdf: 'PDF', downloadDocx: 'DOCX', downloadPdfDesc: 'Recommended · Ready to send', downloadDocxDesc: 'Editable version', downloadNote: 'PDF preserves the selected design. DOCX is editable and may have minor layout differences depending on Word, Google Docs, or mobile viewers.', pdfExportFailed: 'PDF export failed. Please try again.',
    wordExportFailed: 'Word export failed. Please try again.', preview: 'Preview', selectTemplate: 'Select Template', jobTitle: 'Job Title', fullName: 'Full Name', email: 'Email', phone: 'Phone', address: 'Address', fathersName: "Father's Name", nationality: 'Nationality', dateOfBirth: 'Date of Birth', company: 'Company', position: 'Position', startDate: 'Start Date', endDate: 'End Date', present: 'Present', description: 'Description', degree: 'Degree', school: 'School / University', addMore: 'Add More', remove: 'Remove', region: 'Target Region', ready: 'Ready to build your CV?', readySubtitle: 'Start free. Upgrade when you\'re ready. No pressure.',       edit: 'Edit', copied: 'Copied!', copy: 'Copy', jobTitlePlaceholder: 'e.g. Software Engineer', fullNamePlaceholder: 'Alex Carter', aiBullets: 'AI Improvements', skillPlaceholder: 'Type a skill and press Enter', certPlaceholder: 'e.g. AWS Certified', langPlaceholder: 'Language', levelPlaceholder: 'Level',       summaryPlaceholder: 'Write or generate your professional summary...',
      jobDescPlaceholder: 'Paste the job description here to analyze it...',
      short: 'Shorter',
 strong: 'Stronger', professional: 'Professional', keywordsFound: 'Keywords Found', suggestions: 'Suggestions', suggestedSkills: 'Suggested Skills', skillCategories: { technical: 'Technical Skills', soft: 'Soft Skills' }, aiRecommend: 'AI Recommend', recommendedToast: 'Recommended', recommendedForYou: '⭐ Recommended for you', bestResultsTemplate: 'Best results with this template', optimizedForProfile: 'Optimized for your profile', unlockWithPro: 'Unlock this template with Pro', saveRequired: 'Please log in to save your CV.', saved: 'CV saved!', draftSaved: 'Draft saved', genSuccess: 'Summary generated!', bulletsSuccess: 'AI Improvements applied!', rewriteSuccess: 'Rewritten', levels: { native: 'Native', fluent: 'Fluent', advanced: 'Advanced', intermediate: 'Intermediate', basic: 'Basic' }, regions: { us: 'US', eu: 'EU', balkan: 'Balkan', middleEast: 'Middle East', india: 'India', japan: 'Japan' }, gender: 'Gender', genderMale: 'Male', genderFemale: 'Female', genderOther: 'Other', coverLetterSection: 'Cover Letter', photo: { title: 'Profile Photo', optional: '(Optional)', shown: 'Shown in CV', hidden: 'Hidden in CV', shownDesc: 'Shown by default for your region', hiddenDesc: 'Photo is hidden from the CV output.', change: 'Change Photo', upload: 'Upload Photo', recrop: 'Recrop', remove: 'Remove photo', hint: 'JPG or PNG, max 5MB. Will be cropped to square (1:1).', aiEnhance: 'AI Photo Enhancement', aiEnhancing: 'Enhancing...', applied: 'Applied', upgrade: 'Upgrade to Pro', features: ['Background blur', 'Brightness & contrast', 'Natural skin tone', 'Auto face centering'], cropTitle: 'Crop Photo', cropHint: 'Drag to reposition · Scroll or use buttons to zoom', apply: 'Apply Crop', usRegion: 'Hidden by default for US region (not recommended)', otherRegion: 'Shown by default for your region', errorFormat: 'Please upload a JPG or PNG image.' }, industryLabel: 'Industry', levelLabel: 'Level', industryPlaceholder: 'Select industry', industries: { tech: 'IT / Software Development', data_ai: 'Data / AI / Machine Learning', cybersecurity: 'Cybersecurity', sales_retail: 'Sales (Retail)', sales_b2b: 'Sales (B2B)', marketing: 'Marketing / Digital Marketing', sales: 'Sales', finance: 'Finance / Accounting', banking_fintech: 'Banking / FinTech', healthcare: 'Healthcare / Medical', pharmacy: 'Pharmacy', education: 'Education / Teaching', human_resources: 'Human Resources', customer_service: 'Customer Support / Call Center', logistics: 'Logistics / Supply Chain', operations: 'Operations / Production', executive: 'Management / Leadership', project_management: 'Project Management', design: 'Design / UX / UI', engineering: 'Engineering (Mechanical / Electrical)', construction: 'Construction / Architecture', hospitality: 'Hospitality / Tourism', legal: 'Legal', administration: 'Administration / Office', general: 'General' }, bulletLevels: { entry: 'Entry Level', mid: 'Mid Level', senior: 'Senior Level', lead: 'Lead / Director' }, aiExperienceIntro: '✨ Improve your work experience with AI', aiExperienceIntroSub: 'Write stronger, clearer, and more professional descriptions in seconds.', aiSummaryIntro: '✨ Create a powerful professional summary', aiSummaryIntroSub: 'Generate or improve your summary to stand out to recruiters.', generateSubtext: 'Strong summary in seconds', shorterSubtext: 'Make your text concise and clear', strongerSubtext: 'Highlight achievements and impact', professionalSubtext: 'Improve tone and polish', aiBulletsSubtext: 'Turn experience into strong bullet points', analyzeJobSubtext: 'Match your CV to the job requirements', analyzeJobProOnly: 'Analyze Job Description is available in Pro only.', aiRecommendSubtext: 'Find the best template for you', proHint: 'Recommended', proHintPopular: 'Most popular', jobAnalysis: { title: 'Your CV Analysis', subtitle: 'See how well your CV matches this job', matchScore: 'Match', matchGood: 'Good match — but can be improved', matchAverage: 'Average match — several gaps found', matchWeak: 'Weak match — significant improvements needed', keyInsights: 'Key Insights', insight1: 'Found relevant experience', insight2: 'Missing key skills', insight3: 'Weak impact descriptions', importantKeywords: 'Important Keywords', unlockFull: 'Unlock full list with Pro', suggestedImprovements: 'Suggested Improvements', improve1: 'Add measurable results', improve2: 'Use stronger action verbs', improve3: 'Include missing skills', proCardTitle: 'Improve your CV instantly', proCardText: 'Unlock full analysis, all keywords and AI improvements', proCardCta: 'Upgrade to Pro', proCardNote: 'One-time payment', analyzing: 'Analyzing your CV...' } },
  coverLetter: { title: 'Cover Letter Builder', firstName: 'First Name', lastName: 'Last Name', gender: 'Gender', genderMale: 'Male', genderFemale: 'Female', genderPreferNot: 'Prefer not to say', identitySection: 'Your Information', jobTitle: 'Job Title', companyName: 'Company Name',tone: 'Tone', tones: { formal: 'Formal', confident: 'Confident', friendly: 'Friendly' }, generate: 'Generate Cover Letter', generating: 'Generating your cover letter…', regenerate: 'Regenerate', regenerating: 'Regenerating...', regenerateSubtitle: 'Get a fresh variation', edit: 'Edit', companyPlaceholder: 'e.g. Google', firstNamePlaceholder: 'Alex', lastNamePlaceholder: 'Carter', genSuccess: 'Cover letter generated!', saved: 'Saved!', draftSaved: 'Draft saved', placeholder: 'Your cover letter will appear here...', preview: 'Preview', filename: 'Cover Letter',regenLeft: 'left', regenExhausted: 'You have reached the maximum number of regenerations for this cover letter.', paywallMessage: 'Cover Letter generation beyond the free limit is a Pro feature. Upgrade to Pro to generate unlimited AI-powered cover letters.', downloadCl: 'Download Cover Letter', generateSubtitle: 'Tailored to the job & company', aiDisclaimer: 'AI-generated content may contain inaccuracies. Please review all AI-generated text before submitting.' },
  auth: { login: 'Log In', register: 'Create Account', email: 'Email', password: 'Password', confirmPassword: 'Confirm Password', name: 'Full Name', forgotPassword: 'Forgot password?', noAccount: "Don't have an account?", hasAccount: 'Already have an account?', invalidCredentials: 'Invalid credentials. Please register first.', emailTaken: 'Email already registered.' },
  dashboard: { title: 'Dashboard', myCVs: 'My CVs', myCoverLetters: 'My Cover Letters', createNew: 'Create New', edit: 'Edit', delete: 'Delete', lastEdited: 'Last edited', upgrade: 'Upgrade to Pro', plan: 'Current Plan', welcome: 'Welcome back', noCVs: 'No CVs yet. Create your first one!', noLetters: 'No cover letters yet. Create your first one!', untitled: 'Untitled', cvDeleted: 'CV deleted', letterDeleted: 'Cover letter deleted', loginRequired: 'Please log in to access your dashboard.', upgradeBanner: '1 CV and 1 Cover Letter included.' },
  common: { save: 'Save', cancel: 'Cancel', back: 'Back', next: 'Next', loading: 'Loading...', proAccessRequired: 'Pro access required. Please upgrade to continue.', proAuthorizationUnavailable: 'Pro authorization is syncing. Please try again in a moment.', error: 'Something went wrong', success: 'Success!', darkMode: 'Dark Mode', lightMode: 'Light Mode', language: 'Language', legal: 'Legal', previewBadge: 'Free Template', slide: 'Slide', appName: 'CV Pro AI', docx: 'DOCX' },
  footer: { rights: '© 2026 CV Pro AI. All rights reserved.', privacy: 'Privacy Policy', terms: 'Terms of Service', backToHome: 'Back to home' },
  templates: {
    title: 'Templates', subtitle: '13 professional templates — 3 free, 10 premium. Designed for every career path.', showcase: 'Template Showcase', showcaseSubtitle: 'Designed to meet modern hiring expectations globally.', freeCount: 'Free — 3 Templates', proCount: 'Pro — 10 Premium Templates', proBadge: 'PRO', unlockPro: 'Unlock all 10 Premium Templates with Pro — $3.99 One-Time Payment', browseAll: 'Browse all templates',
      categories: { ats: 'ATS-Friendly', creative: 'Creative', executive: 'Executive', modern: 'Modern', japanese: 'Japanese' },
    items: {
      'modern-minimal': { name: 'Modern Minimal', description: 'Clean, ATS-ready design that gets your profile noticed by recruiters fast.', category: 'ATS-Friendly' },
      'clean-simple': { name: 'Clean Simple', description: 'Simple and clear layout that makes a strong impression for any first application.', category: 'ATS-Friendly' },
      'professional-classic': { name: 'Professional Classic', description: 'Trusted by recruiters across all industries — timeless, polished, dependable.', category: 'ATS-Friendly' },
      'creative-bold': { name: 'Creative Bold', description: 'Stand out instantly with a bold layout built to impress in creative industries.', category: 'Creative' },
      'creative-artistic': { name: 'Creative Artistic', description: 'Express your personality with a stylish design that leaves a lasting impression.', category: 'Creative' },
      'elegant-formal': { name: 'Elegant Formal', description: 'Refined and authoritative — ideal for senior roles where first impressions matter.', category: 'Executive' },
      'ats-standard': { name: 'ATS Standard', description: 'Built to pass every automated screen — maximise your chances of reaching the interview.', category: 'ATS-Friendly' },
      'executive-premium': { name: 'Executive Premium', description: 'A commanding design for C-level leaders who need to make every word count.', category: 'Executive' },
        'nordic-clean': { name: 'Nordic Clean', description: 'Calm, focused layout that lets your experience speak clearly — no clutter.', category: 'Modern' },
        'tech-sidebar': { name: 'Tech Sidebar', description: 'Two-column structure that organises your skills and experience for maximum impact.', category: 'Modern' },
        'corporate-navy': { name: 'Corporate Navy', description: 'Bold and authoritative — signals confidence from the first glance.', category: 'Executive' },
        'modern-minimal-executive': { name: 'Modern Minimal Executive', description: 'Clean executive layout with a sidebar — modern leadership presence on the page.', category: 'Executive' },
        'contemporary-bold': { name: 'Contemporary Bold', description: 'Strong, structured design for tech and startup roles that demand attention.', category: 'Modern' },
        'rirekisho': { name: 'Rirekisho', description: 'The authentic Japanese CV format — built to meet local hiring standards perfectly.', category: 'Japanese' }
      }
    },
  legal: {
    privacy: {
      title: 'Privacy Policy', effectiveDate: 'Effective: April 2026',
      sections: [
        { title: '1. Introduction', content: 'CV Pro AI ("the App") respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, and safeguard your information when you use our AI-powered resume and cover letter builder.' },
        { title: '2. Data We Collect', content: 'We may collect the following information when you use the App:', items: ['Name (if provided)', 'Email address (if provided)', 'CV and resume content entered by you', 'Basic usage data and analytics'] },
        { title: '3. How We Use Your Data', content: 'Your data is used solely for the following purposes:', items: ['To generate CVs and cover letters', 'To improve AI features and app quality', 'To provide core app functionality'] },
        { title: '4. AI Processing', content: 'Your input may be securely transmitted to third-party AI providers to generate resume summaries, bullet points, cover letters, and other AI-powered content. Data is processed only for the purpose of generating the requested output. CV Pro AI does not use your content for advertising purposes.' },
        { title: '5. Data Sharing', content: 'We respect your privacy and handle your data responsibly:', items: ['We do NOT sell user data to third parties', 'Data is not shared with third parties except for essential services required to operate the App'] },
        { title: '6. Data Storage & Security', content: 'Your CV data is stored locally on your device. The app uses autosave to store work-in-progress drafts locally on your device. Certain content may be securely transmitted when you use AI-powered features that require content generation or improvement. We implement industry-standard security measures, including TLS encryption, to protect any data in transit. Reasonable measures are taken to protect all user information.', items: ['AI-generated content and draft data are retained only as necessary to provide the requested functionality. Draft content stored locally remains under the user\'s control and may be deleted at any time by clearing the draft or resetting the application.'] },
        { title: '7. Your Rights & GDPR Protections', content: 'You have full control over your personal data. If you are located in the European Economic Area (EEA), you have additional rights under the General Data Protection Regulation (GDPR):', items: ['Request access to your personal data', 'Request deletion of your data (right to erasure)', 'Request correction of inaccurate data', 'Request restriction of processing (EEA users)', 'Data portability — receive your data in a structured, machine-readable format (EEA users)', 'Withdraw consent at any time where processing is based on consent'] },
        { title: '8. Cookies & Analytics', content: 'The App may use basic analytics tools to understand usage patterns and improve performance. No personal data is shared with advertising networks.' },
        { title: '9. Payments & Purchases', content: 'Pro plan purchases are processed securely through third-party payment processors:', items: ['Payments are handled by Apple App Store, Google Play Store, and RevenueCat', 'CV Pro AI does NOT collect, process, or store your payment card information', 'All payment data is managed directly by the respective app store and payment processor according to their own privacy and security policies', 'Purchase validation and entitlement management may be provided through RevenueCat or similar payment infrastructure providers.'] },
        { title: '10. Children\'s Privacy', content: 'This App is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal data, please contact us immediately.' },
        { title: '11. No Guarantees', content: 'CV Pro AI does not guarantee employment, interviews, job offers, or application outcomes. Users remain responsible for reviewing, editing, and verifying all generated content before submitting it to employers or third parties.' },
        { title: '12. Contact', content: 'For any questions or requests regarding this Privacy Policy, please contact us at help.cvappai@gmail.com.' }
      ]
    },
    terms: {
      title: 'Terms of Service', effectiveDate: 'Effective: April 2026',
      sections: [
        { title: '1. Introduction', content: 'CV Pro AI is a tool for creating resumes and cover letters using AI assistance. By using the App, you agree to these Terms of Service.' },
        { title: '2. Description of Service', content: 'CV Pro AI is an AI-powered resume and cover letter builder. The App offers a Free plan and a Pro plan. The Free plan includes 1 cover letter download and 1 AI regeneration. The Pro plan ($3.99 one-time payment) provides unlimited downloads, unlimited AI generation, 10 premium templates, AI Rewrite Tools, and the Job Description Analyzer.' },
        { title: '3. AI Disclaimer', content: 'AI-generated content is provided for assistance only and may require user review. Content may contain inaccuracies, stylistic variations, or context-specific issues. You are solely responsible for reviewing and editing all AI-generated text before submitting it to employers or third parties.' },
        { title: '4. User Responsibilities', content: 'You are responsible for the accuracy of the information you enter in the App. Ensure all data you provide is truthful, accurate, and up to date. The App is a productivity tool — final responsibility for your application materials rests with you.' },
        { title: '5. Acceptable Use', content: 'You agree not to misuse the App, upload illegal content, attempt to reverse engineer the service, or use it in any way that violates applicable laws or regulations. Abuse of the service may result in restricted access.' },
        { title: '6. Payments', content: 'The Pro plan is available for a one-time payment of $3.99, granting lifetime access. No recurring subscription or automatic renewal applies. If you previously purchased Pro, use the "Restore Purchase" button on the Pricing page to recover access. Refund requests are subject to the policies of the Apple App Store and Google Play Store, where applicable. Purchase processing, validation, and entitlement management may be provided through RevenueCat or similar payment infrastructure providers.' },
        { title: '7. No Guarantees', content: 'CV Pro AI provides tools to assist with resume and cover letter creation. We make no guarantee that use of the App will result in job offers, interviews, or employment outcomes. Results depend on many factors outside our control.' },
        { title: '8. Limitation of Liability', content: 'The App is provided "as is" without warranties of any kind, express or implied. To the maximum extent permitted by law, CV Pro AI shall not be liable for any indirect, incidental, or consequential damages arising from your use of the App.' },
        { title: '9. Termination', content: 'We reserve the right to restrict or terminate access to the App if these Terms are violated, including misuse, illegal activity, or abuse of the service.' },
        { title: '10. Changes to Terms', content: 'We may update these Terms of Service from time to time. Continued use of the App after changes are posted constitutes your acceptance of the updated Terms.' },
        { title: '11. Contact', content: 'For support or questions about these Terms, contact us at help.cvappai@gmail.com.' }
      ]
    }
  },
    comparison: {
      title: 'See the Difference',
      subtitle: 'A side-by-side look at what your CV looks like on the Free plan vs. Pro.',
      freePlan: 'Basic Layout',
      proPlan: 'Professional Layout',
      good: 'Good',
      hireReady: 'Hire-Ready',
      proBadge: 'Pro',
      freeFeatures: ['Basic layout & typography', 'Minimal visual hierarchy', 'Standard spacing'],
      proFeatures: ['Premium typography & hierarchy', 'Professional US/EU visual standard', 'Refined spacing & structure'],
      summary: 'Professional Summary',
      experience: 'Professional Experience',
      expertise: 'Expertise',
      languages: 'Languages',
      chips: ['SEO Strategy', 'Analytics', 'Content', 'Email'],
      persuasiveText: 'Professional layouts help your CV stand out in competitive markets.'
    },
  previews: {
    name: 'Alex Johnson',
    role: 'Senior Product Manager',
    email: 'alex@email.com',
    phone: '+1 555 123 456',
    location: 'Berlin / New York',
    experience: 'Experience',
    education: 'Education',
    skills: 'Skills',
    contact: 'Contact',
    headOfProduct: 'Head of Product',
    productManager: 'Product Manager',
    jrPm: 'Jr. PM',
    techCorp: 'TechCorp',
    startupXY: 'StartupXY',
    digitalAgency: 'DigitalAgency',
    techCorpDesc: 'Led cross-functional team of 12, launched 3 core products, grew ARR by 40%.',
    startupDesc: 'Defined roadmap, conducted user research, improved retention by 28%.',
    agencyDesc: 'Feature delivery across 5 client products.',
    mba: 'MBA',
    columbia: 'Columbia University',
    present: 'Present',
    now: 'Now',
    productVision: 'Product Vision',
    teamLeadership: 'Team Leadership',
    gtm: 'Go-to-Market',
    dataAnalysis: 'Data Analysis',
    productStrategy: 'Product Strategy',
    uxResearch: 'UX Research',
    agile: 'Agile / Scrum',
    techCorpYears: '2021–Present',
    startupYears: '2018–2021',
    educationYears: '2016–2018',
    agencyYears: '2016–2018'
  },
  onboarding: {
    title: 'Welcome to AI & Smart Resume Builder ✨',
    subtitle: 'Build a professional resume and cover letter in minutes. Start free — upgrade when you\'re ready.',
    freeLabel: 'Free',
    freeFeatures: ['3 Standard Templates', '1 Cover Letter download', '1 AI Regeneration attempt', 'All 12 languages'],
    proLabel: 'Pro — $3.99',
    proRecommendedBadge: 'RECOMMENDED',
    proFeatures: ['Unlimited Cover Letters', 'AI Rewrite Tools', '10 Premium Templates', 'Job Analyzer + Priority Support'],
    oneTimePayment: 'One-time payment. No subscription.',
    aiFeatureTitle: 'AI Features',
    aiFeatureDesc: 'AI uses your inputs only to generate text and does not store data permanently. Please review all AI-generated text before submitting.',
    startFree: 'Start Free',
    upgradeToPro: 'Upgrade to Pro',
    secureCheckout: 'Secure checkout. Instant activation. No subscription.'
  },
  about: {
    hero: {
      badge: 'Google Play & App Store Description',
      title: 'CV Pro AI — AI & Smart Resume Builder',
      description: 'Build a professional, job-winning resume and AI cover letter in minutes. Start free — upgrade once, use forever.',
      ageRating: 'Age Rating: 3+',
      languages: '12 Languages',
      privacyFirst: 'Privacy First'
    },
    description: {
      title: 'App Description',
      paragraphs: [
        'CV Pro AI is an AI-powered resume and cover letter builder designed for job seekers worldwide. Create a professional, ATS-optimized resume in minutes using smart templates and AI writing tools.',
        'Available on Android (Google Play) and iPhone (Apple App Store).',
        'Choose from 13 professional templates — 3 free, 10 premium. The AI writing assistant helps you craft compelling bullet points, professional summaries, and personalized cover letters tailored to your target job and company.',
        'Support for 12 languages including Arabic (RTL), Japanese, Hindi (India), and more ensures you can build a job-ready resume for any market. Regional optimization automatically adapts your CV for US, EU, Balkan, Middle East, Indian, and Japanese job market standards.',
        'Free Plan: Create your resume, download 1 AI-generated cover letter, and use 1 regeneration attempt — no account required.',
        'Pro Plan ($3.99 one-time): Unlock unlimited AI-generated cover letters, AI Rewrite Tools, all 10 premium templates, Job Description Analyzer, and priority support. One-time payment. No subscription. No renewal.'
      ]
    },
    features: {
      title: 'Free vs Pro Features',
      free: {
        label: 'Free — $0',
        items: [
          '3 Standard (ATS-Friendly) Templates',
          '1 AI-Generated Cover Letter Download',
          '1 Cover Letter Regeneration Attempt',
          'AI Professional Summary Generation',
          'All 12 Languages',
          'DOCX Export',
          'Regional CV Optimization'
        ],
        disabledItems: [
          'AI Rewrite Tools',
          'Job Description Analyzer',
          '10 Premium Templates',
          'Unlimited Cover Letters',
        ]
      },
      pro: {
        label: 'Pro — $3.99 Once',
        price: 'ONE-TIME $3.99',
        items: [
          '10 Premium Templates (+ 3 Free)',
          'Unlimited AI-Generated Cover Letters',
          'Unlimited Cover Letter Regenerations',
          'AI Professional Summary Generation',
          'AI Rewrite Tools (Shorten, Strengthen, Professionalize)',
          'Job Description Analyzer',
          'All 12 Languages',
          'DOCX Export',
          'Regional CV Optimization',
          'Priority Support'
        ],
        footer: 'One-time payment. No subscription. No renewal.'
      }
    },
    aiDisclosure: {
      title: 'How AI is Used in This App',
      items: [
        'The app uses third-party AI services to generate resume summaries, bullet points, and cover letter text.',
        'User inputs (job title, company name, tone preference, work experience) are processed by AI services only to generate text.',
        'User inputs are not permanently stored by the app or AI services.',
        'AI-generated content may contain inaccuracies. Users are responsible for reviewing all content before submitting to employers.',
        'The AI button is clearly labeled: "Generate with AI ✨"'
      ]
    },
    ageAndContent: {
      title: 'Age Rating & Content Disclaimer',
      ageRating: 'Age Rating: 3+',
      ageRatingDesc: 'Suitable for all ages. No mature content.',
      disclaimer: 'AI-generated content may contain inaccuracies, grammatical errors, or context-specific issues. Users are fully responsible for reviewing, editing, and verifying all AI-generated text before submitting it to employers or third parties.',
      noLiability: 'CV Pro AI provides tools to assist with resume and cover letter creation. We make no guarantees about job placement outcomes. Use of AI-generated content is at the user\'s own discretion.',
      privacy: 'Resume data is stored locally on the user\'s device. Personal information is not sold or shared with third parties for marketing purposes.'
    },
    languages: {
      title: 'Supported Languages',
      list: [
        'English',
        'Deutsch (German)',
        'Español (Spanish)',
        'Français (French)',
        'Italiano (Italian)',
        'العربية (Arabic) — RTL',
        'Srpski (Serbian)',
        'Hrvatski (Croatian)',
        'Русский (Russian)',
        'Português (Brazil)',
        'हिन्दी (Hindi)',
        '日本語 (Japanese)'
      ]
    },
    restorePurchase: {
      title: 'Restore Purchase',
      description: 'If you previously purchased Pro and need to restore your access, tap the "Restore Purchase" button on the Pricing page. Your Pro access will be restored instantly on the current device. If you experience any issues, contact us at help.cvappai@gmail.com.'
    },
    legal: {
      title: 'Legal',
      privacyPolicy: 'Privacy Policy',
      termsOfService: 'Terms of Service',
      contact: 'Contact: help.cvappai@gmail.com',
      viewPricing: 'View Pricing & Upgrade to Pro'
    }
  }
};

const de: TranslationKeys = {
  nav: { home: 'Startseite', cvBuilder: 'Lebenslauf', coverLetter: 'Anschreiben', templates: 'Vorlagen', pricing: 'Preise', about: 'Über', contact: 'Kontakt', login: 'Anmelden', register: 'Registrieren', dashboard: 'Dashboard', logout: 'Abmelden' },
  hero: { title: 'Erstellen Sie einen professionellen Lebenslauf.', professionalResumesAiPowered: 'Professionelle Lebensläufe. KI-gestützt.', subtitle: 'KI-gestützter Lebenslauf-Builder mit Premium-Vorlagen und intelligenter Job-Optimierung.', valueDesc: 'Erstellen Sie in wenigen Minuten einen professionellen Lebenslauf. Schalten Sie 10 Premium-Vorlagen und erweiterte Tools mit Pro frei.', cta: 'Lebenslauf erstellen', ctaSecondary: 'Vorlagen ansehen', badge: 'KI-gestützter Lebenslauf-Builder', footerText: 'Einmalige Zahlung. Lebenslanger Zugriff. Kein Abonnement.' },
    features: { title: 'Alles, was Sie brauchen.', subtitle: 'Leistungsstarke KI-Tools für den globalen Arbeitsmarkt', badge: 'Was enthalten ist', ai: { title: 'Intelligentes KI-Schreiben', desc: 'Verbessert Klarheit, Struktur und Wirkung automatisch.' }, multilingual: { title: 'Mehrsprachige Unterstützung', desc: 'Erstellen Sie Lebensläufe sofort in 9 Sprachen.' }, templates: { title: 'Premium-Vorlagen', desc: '10 Premium + 3 kostenlose Vorlagen. Moderne Designs.' }, ats: { title: 'ATS-freundlich', desc: 'Alle Vorlagen bestehen Bewerber-Tracking-Systeme.' }, region: { title: 'Regional optimiert', desc: 'Automatische Anpassung für US, EU, Balkan und Mittlerer Osten.' }, export: { title: 'DOCX-Export', desc: 'Download als DOCX oder in die Zwischenablage kopieren.' }, analyzer: { title: 'Stellenanzeigen-Analysator', desc: 'Passen Sie Ihren Lebenslauf mit KI-Präzision an Stellenanzeigen an. Nur Pro.' } },
    howItWorks: { title: 'Wie es funktioniert', step: 'SCHRITT', step1: { title: 'Informationen eingeben', desc: 'Geben Sie Ihre persönlichen Daten, Berufserfahrung und Ausbildung ein.' }, step2: { title: 'Lebenslauf verbessern', desc: 'Nutzen Sie smarte Tools und Vorschläge, um Ihren Lebenslauf stärker und professioneller zu gestalten.' }, step3: { title: 'Lebenslauf herunterladen', desc: 'Exportieren Sie Ihren fertigen Lebenslauf im DOCX-Format, bereit zum Versenden.' } },
  whoIsThisFor: { title: 'Für wen ist dieser Lebenslauf-Builder?', items: ['Jobsuchende', 'Studierende und Absolventen', 'Berufstätige, die sich umorientieren', 'Alle, die einen modernen professionellen Lebenslauf möchten'] },
  privacyFirst: { title: 'Datenschutz an erster Stelle', desc: 'Ihre Lebenslaufdaten verbleiben auf Ihrem Gerät. Wir speichern, verkaufen oder teilen Ihre persönlichen Informationen nicht.', local: 'Dieser Lebenslauf-Builder arbeitet lokal auf Ihrem Gerät, um Ihre Daten sicher zu halten.' },
  simplePricing: { title: 'Einfache Preisgestaltung', desc: 'Kein Abonnement. Einmaliger Kauf, um alle Pro-Vorlagen und erweiterte Tools freizuschalten.' },
    pricing: { 
      title: 'Einfache Preise.', 
      subtitle: 'Keine Abonnements. Keine monatlichen Gebühren. Einmal zahlen.', 
      oneTime: '3,99 $ einmalig', 
      getStarted: 'Jetzt starten',
      footerText: 'Einmalzahlung · Lebenslanger Zugriff · Kein Abonnement',
        free: { name: 'Kostenlos', price: '0 $', features: ['3 Standard-Vorlagen', '1 Lebenslauf-Download', '1 Anschreiben-Download', 'Alle Sprachen'], cta: 'Kostenlos starten', desc: 'Starten Sie kostenlos.' }, 
          pro: { name: 'Pro', price: '3,99 $', features: ['10 Premium-Vorlagen', 'Unbegrenzte Lebenslauf-Downloads', 'Unbegrenzte KI-generierte Anschreiben', 'Stellenanzeigen-Analysator', 'KI-Schreibverbesserungen', 'Alle Sprachen'], cta: 'Auf Pro upgraden', desc: 'Einmal zahlen. Ewig nutzen.', badge: 'Pro — Lebenslanger Zugriff', footer: 'Sicherer Checkout. Sofortige Aktivierung.', noSubscription: 'Kein Abonnement. Keine Verlängerung.' },
      tableTitle: 'Feature-Vergleich',
      tableHeaderFeature: 'Funktion',
      tableHeaderFree: 'Kostenlos',
      tableHeaderPro: 'Pro',
      tableRowCV: 'CV-Downloads',
      tableRowCoverLetter: 'Anschreiben-Downloads',
      tableRowTemplates: 'Vorlagen',
      tableRowAI: 'KI-Zusammenfassungs-Erstellung',
      tableRowRewrite: 'KI-Umschreibewerkzeuge',
      tableRowAnalyzer: 'Stellenbeschreibungs-Analysator',
      tableRowLanguages: 'Alle Sprachen',
      tableRowSupport: 'Prioritärer Support',
        unlimited: 'Unbegrenzt',
        threeStandard: '3 Standard',
        proTemplatesCount: '10 Premium + 3 Kostenlos',
        oneCount: '1',
        popularBadge: 'Am beliebtesten',
        bestValueBadge: 'Bester Wert',
        coverLetterFreeValue: '1 Anschreiben-Download',
        coverLetterProValue: 'Unbegrenzte KI-generierte Anschreiben',
        restoreTitle: 'Bereits Pro gekauft?',
        restoreDesc: 'Stellen Sie Ihren früheren Kauf wieder her, um den Pro-Zugang auf diesem Gerät zurückzugewinnen.',
        restoreButton: 'Kauf wiederherstellen',
        proActive: 'Pro Aktiv',
        restoringText: 'Wird wiederhergestellt...',
        needHelp: 'Hilfe benötigt?',
        fairUse: 'Es können Nutzungsbeschränkungen gelten, um Missbrauch zu verhindern und einen zuverlässigen Service zu gewährleisten.'
      },

  faq: { title: 'Häufig gestellte Fragen', items: [
    { q: 'Was ist im kostenlosen Plan enthalten?', a: 'Der kostenlose Plan ermöglicht Ihnen, 1 Lebenslauf zu erstellen und 1 Anschreiben zu generieren. Sie können auch KI-Werkzeuge mit begrenztem Zugang nutzen, um Ihre Inhalte zu verbessern.' },
    { q: 'Wie viele Anschreiben kann ich kostenlos erstellen?', a: 'Sie können 1 Anschreiben kostenlos generieren, inklusive 1 Neugenerierungsversuch.' },
    { q: 'Was passiert, nachdem ich mein kostenloses Anschreiben verwendet habe?', a: 'Nach der Nutzung Ihres kostenlosen Anschreibens können Sie auf Pro upgraden, um unbegrenzte Anschreiben und vollen Zugang zu allen KI-Funktionen zu erhalten.' },
    { q: 'Was bekomme ich mit Pro?', a: 'Pro bietet unbegrenzte Anschreiben, vollen Zugang zu allen KI-Werkzeugen, Premium-Vorlagen und erweiterte CV-Optimierungsfunktionen.' },
    { q: 'Sind KI-Funktionen kostenlos?', a: 'Einige KI-Funktionen sind kostenlos mit begrenzter Nutzung verfügbar. Upgrade auf Pro für unbegrenzten Zugang.' },
    { q: 'Kann ich die App in verschiedenen Sprachen nutzen?', a: 'Ja, die App unterstützt mehrere Sprachen, damit Sie Ihren Lebenslauf und Ihr Anschreiben in Ihrer bevorzugten Sprache erstellen können.' },
    { q: 'Sind die Vorlagen ATS-freundlich?', a: 'Absolut. Alle Vorlagen sind darauf ausgelegt, Bewerber-Tracking-Systeme zu passieren, die von großen Arbeitgebern weltweit verwendet werden.' },
    { q: 'Wie funktioniert die KI? Werden meine Daten gespeichert?', a: 'Die KI verwendet nur Ihre Eingaben (Jobtitel, Unternehmen, Tonfall usw.) zum Generieren von Text. Ihre persönlichen Daten werden nicht dauerhaft gespeichert. Die App nutzt KI-Dienste von Drittanbietern zur Verarbeitung von Generierungsanfragen.' },
    { q: 'Ist der KI-generierte Inhalt immer korrekt?', a: 'KI-generierte Inhalte können Ungenauigkeiten enthalten. Bitte überprüfen Sie alle KI-generierten Texte sorgfältig, bevor Sie sie an Arbeitgeber senden. Die Nutzer sind für den endgültigen Inhalt verantwortlich.' }
  ] },
    cv: { title: 'Lebenslauf-Builder', personal: 'Persönliche Infos', experience: 'Berufserfahrung', education: 'Ausbildung', skills: 'Fähigkeiten', certifications: 'Zertifikate', languages: 'Sprachen', summary: 'Zusammenfassung', generate: 'Mit KI generieren', rewrite: 'Umschreiben', translate: 'Übersetzen', analyzeJob: 'Stellenanzeige analysieren', download: 'Download', downloadCv: 'CV herunterladen', downloadPdf: 'PDF', downloadDocx: 'DOCX', downloadPdfDesc: 'Empfohlen · Versandfertig', downloadDocxDesc: 'Bearbeitbare Version', downloadNote: 'PDF bewahrt das gewählte Design. DOCX ist bearbeitbar und kann je nach Word, Google Docs oder mobilen Ansichten kleinere Layoutunterschiede aufweisen.', pdfExportFailed: 'PDF-Export fehlgeschlagen. Bitte erneut versuchen.',
    wordExportFailed: 'Word-Export fehlgeschlagen. Bitte erneut versuchen.', preview: 'Vorschau', selectTemplate: 'Vorlage wählen', jobTitle: 'Jobtitel', fullName: 'Vollständiger Name', email: 'E-Mail', phone: 'Telefon', address: 'Adresse', fathersName: 'Vatersnamen', nationality: 'Nationalität', dateOfBirth: 'Geburtsdatum', company: 'Unternehmen', position: 'Position', startDate: 'Startdatum', endDate: 'Enddatum', present: 'Heute', description: 'Beschreibung', degree: 'Abschluss', school: 'Schule / Universität', addMore: 'Mehr hinzufügen', remove: 'Entfernen', region: 'Zielregion', ready: 'Bereit für den Lebenslauf?', readySubtitle: 'Kostenlos starten. Upgrade wenn bereit.',       edit: 'Bearbeiten', copied: 'Kopiert!', copy: 'Kopieren', jobTitlePlaceholder: 'z.B. Softwareentwickler', fullNamePlaceholder: 'Max Mustermann', aiBullets: 'KI-Optimierung', skillPlaceholder: 'Fähigkeit eingeben und Enter drücken', certPlaceholder: 'z.B. AWS zertifiziert', langPlaceholder: 'Sprache', levelPlaceholder: 'Niveau',       summaryPlaceholder: 'Schreiben oder generieren Sie Ihre Zusammenfassung...',
      jobDescPlaceholder: 'Fügen Sie die Stellenbeschreibung hier ein...',
      short: 'Kürzer',
 strong: 'Stärker', professional: 'Professionell', keywordsFound: 'Gefundene Keywords', suggestions: 'Vorschläge', suggestedSkills: 'Vorgeschlagene Fähigkeiten', skillCategories: { technical: 'Technische Fähigkeiten', soft: 'Soziale Kompetenzen' }, aiRecommend: 'KI-Empfehlung', recommendedToast: 'Empfohlen', recommendedForYou: '⭐ Empfohlen für Sie', bestResultsTemplate: 'Beste Ergebnisse mit dieser Vorlage', optimizedForProfile: 'Für Ihr Profil optimiert', unlockWithPro: 'Vorlage mit Pro freischalten', saveRequired: 'Bitte anmelden, um zu speichern.', saved: 'Lebenslauf gespeichert!', draftSaved: 'Entwurf gespeichert', genSuccess: 'Zusammenfassung erstellt!', bulletsSuccess: 'KI-Optimierung angewendet!', rewriteSuccess: 'Umgeschrieben', levels: { native: 'Muttersprache', fluent: 'Fließend', advanced: 'Fortgeschritten', intermediate: 'Mittel', basic: 'Grundkenntnisse' }, regions: { us: 'USA', eu: 'EU', balkan: 'Balkan', middleEast: 'Naher Osten', india: 'Indien', japan: 'Japan' }, gender: 'Geschlecht', genderMale: 'Männlich', genderFemale: 'Weiblich', genderOther: 'Divers', coverLetterSection: 'Anschreiben', photo: { title: 'Profilfoto', optional: '(Optional)', shown: 'Im Lebenslauf angezeigt', hidden: 'Im Lebenslauf verborgen', shownDesc: 'Standardmäßig für Ihre Region angezeigt', hiddenDesc: 'Foto ist in der CV-Ausgabe ausgeblendet.', change: 'Foto ändern', upload: 'Foto hochladen', recrop: 'Neu zuschneiden', remove: 'Foto entfernen', hint: 'JPG oder PNG, max. 5MB.', aiEnhance: 'KI-Fotooptimierung', aiEnhancing: 'Wird verbessert...', applied: 'Angewendet', upgrade: 'Auf Pro upgraden', features: ['Hintergrundunschärfe', 'Helligkeit & Kontrast', 'Natürlicher Hautton', 'Auto-Zentrierung'], cropTitle: 'Foto zuschneiden', cropHint: 'Ziehen zum Positionieren · Scrollen zum Zoomen', apply: 'Zuschnitt anwenden', usRegion: 'Standardmäßig für die US-Region ausgeblendet', otherRegion: 'Standardmäßig für Ihre Region angezeigt', errorFormat: 'Bitte laden Sie ein JPG oder PNG hoch.' }, industryLabel: 'Branche', levelLabel: 'Stufe', industryPlaceholder: 'Branche wählen', industries: { tech: 'IT / Softwareentwicklung', data_ai: 'Daten / KI / Machine Learning', cybersecurity: 'Cybersicherheit', sales_retail: 'Vertrieb (Einzelhandel)', sales_b2b: 'Vertrieb (B2B)', marketing: 'Marketing / Digitalmarketing', sales: 'Vertrieb', finance: 'Finanzen / Buchhaltung', banking_fintech: 'Banking / FinTech', healthcare: 'Gesundheit / Medizin', pharmacy: 'Pharmazie', education: 'Bildung / Lehre', human_resources: 'Human Resources', customer_service: 'Kundendienst / Call Center', logistics: 'Logistik / Supply Chain', operations: 'Operations / Produktion', executive: 'Management / Führung', project_management: 'Projektmanagement', design: 'Design / UX / UI', engineering: 'Maschinenbau / Elektrotechnik', construction: 'Bauwesen / Architektur', hospitality: 'Gastgewerbe / Tourismus', legal: 'Recht', administration: 'Verwaltung / Büro', general: 'Allgemein' }, bulletLevels: { entry: 'Einsteiger', mid: 'Erfahren', senior: 'Senior', lead: 'Lead / Direktor' }, aiExperienceIntro: '✨ Berufserfahrung mit KI verbessern', aiExperienceIntroSub: 'Schreiben Sie in Sekunden stärkere, klarere und professionellere Beschreibungen.', aiSummaryIntro: '✨ Eine überzeugende Zusammenfassung erstellen', aiSummaryIntroSub: 'Erstellen oder verbessern Sie Ihre Zusammenfassung, um bei Recruitern aufzufallen.', generateSubtext: 'Starkes Profil in wenigen Sekunden', shorterSubtext: 'Text kürzen und klarer machen', strongerSubtext: 'Erfolge und Wirkung hervorheben', professionalSubtext: 'Ton und Formulierungen verbessern', aiBulletsSubtext: 'Erfahrung in starke Stichpunkte', analyzeJobSubtext: 'CV auf Jobanforderungen abstimmen', analyzeJobProOnly: 'Die Stellenbeschreibungsanalyse ist nur im Pro-Plan verfügbar.', aiRecommendSubtext: 'Beste Vorlage für Sie finden', proHint: 'Empfohlen', proHintPopular: 'Beliebt', jobAnalysis: { title: 'Ihre CV-Analyse', subtitle: 'So gut passt Ihr CV zur Stelle', matchScore: 'Übereinstimmung', matchGood: 'Gute Übereinstimmung — aber verbesserbar', matchAverage: 'Mittelmäßig — einige Lücken gefunden', matchWeak: 'Schwach — wesentliche Verbesserungen nötig', keyInsights: 'Wichtige Erkenntnisse', insight1: 'Relevante Erfahrung gefunden', insight2: 'Schlüsselkenntnisse fehlen', insight3: 'Schwache Wirkungsbeschreibungen', importantKeywords: 'Wichtige Keywords', unlockFull: 'Vollständige Liste mit Pro freischalten', suggestedImprovements: 'Verbesserungsvorschläge', improve1: 'Messbare Ergebnisse hinzufügen', improve2: 'Stärkere Aktionsverben verwenden', improve3: 'Fehlende Skills ergänzen', proCardTitle: 'CV sofort verbessern', proCardText: 'Vollständige Analyse, alle Keywords und KI-Verbesserungen freischalten', proCardCta: 'Auf Pro upgraden', proCardNote: 'Einmalzahlung', analyzing: 'CV wird analysiert...' } },
  coverLetter: { title: 'Anschreiben-Builder', firstName: 'Vorname', lastName: 'Nachname', gender: 'Geschlecht', genderMale: 'Männlich', genderFemale: 'Weiblich', genderPreferNot: 'Keine Angabe', identitySection: 'Ihre Angaben', jobTitle: 'Jobtitel', companyName: 'Unternehmensname',tone: 'Tonfall', tones: { formal: 'Formal', confident: 'Selbstbewusst', friendly: 'Freundlich' }, generate: 'Anschreiben generieren', generating: 'Ihr Anschreiben wird generiert…', regenerate: 'Neu generieren', regenerating: 'Wird regeneriert…', regenerateSubtitle: 'Eine neue Variation erhalten', edit: 'Bearbeiten', companyPlaceholder: 'z.B. Google', firstNamePlaceholder: 'Max', lastNamePlaceholder: 'Mustermann', genSuccess: 'Anschreiben erstellt!', saved: 'Gespeichert!', draftSaved: 'Entwurf gespeichert', placeholder: 'Ihr Anschreiben erscheint hier...', preview: 'Vorschau', filename: 'Anschreiben',regenLeft: 'übrig', regenExhausted: 'Sie haben die maximale Anzahl an Neugenerierungen für dieses Anschreiben erreicht.', paywallMessage: 'Anschreiben-Generierung über das kostenlose Limit hinaus ist eine Pro-Funktion. Upgraden Sie auf Pro, um unbegrenzte KI-generierte Anschreiben zu erstellen.', downloadCl: 'Anschreiben herunterladen', generateSubtitle: 'Auf Stelle & Unternehmen zugeschnitten', aiDisclaimer: 'KI-generierte Inhalte können Ungenauigkeiten enthalten. Bitte überprüfen Sie alle KI-generierten Texte vor dem Einreichen.' },
  auth: { login: 'Anmelden', register: 'Konto erstellen', email: 'E-Mail', password: 'Passwort', confirmPassword: 'Passwort bestätigen', name: 'Name', forgotPassword: 'Passwort vergessen?', noAccount: 'Noch kein Konto?', hasAccount: 'Schon ein Konto?', invalidCredentials: 'Ungültige Anmeldedaten.', emailTaken: 'E-Mail bereits registriert.' },
  dashboard: { title: 'Dashboard', myCVs: 'Meine Lebensläufe', myCoverLetters: 'Meine Anschreiben', createNew: 'Neu erstellen', edit: 'Bearbeiten', delete: 'Löschen', lastEdited: 'Zuletzt bearbeitet', upgrade: 'Auf Pro upgraden', plan: 'Aktueller Plan', welcome: 'Willkommen zurück', noCVs: 'Noch keine Lebensläufe.', noLetters: 'Noch keine Anschreiben.', untitled: 'Unbenannt', cvDeleted: 'Lebenslauf gelöscht', letterDeleted: 'Anschreiben gelöscht', loginRequired: 'Bitte anmelden.', upgradeBanner: '1 Lebenslauf und 1 Anschreiben enthalten.' },
  common: { save: 'Speichern', cancel: 'Abbrechen', back: 'Zurück', next: 'Weiter', loading: 'Laden...', proAccessRequired: 'Pro-Zugang erforderlich. Bitte upgraden, um fortzufahren.', proAuthorizationUnavailable: 'Die Pro-Autorisierung wird synchronisiert. Bitte versuchen Sie es gleich erneut.', error: 'Etwas ging schief', success: 'Erfolg!', darkMode: 'Dunkelmodus', lightMode: 'Lichtmodus', language: 'Sprache', legal: 'Rechtliches', previewBadge: 'Kostenlose Vorlage', slide: 'Folie', appName: 'CV Pro AI', docx: 'DOCX' },
  footer: { rights: '© 2026 CV Pro AI. Alle Rechte vorbehalten.', privacy: 'Datenschutz', terms: 'Nutzungsbedingungen', backToHome: 'Zurück zur Startseite' },
  templates: {
    title: 'Vorlagen', subtitle: '13 professionelle Vorlagen — 3 kostenlos, 10 Premium.', showcase: 'Vorlagen-Showcase', showcaseSubtitle: 'Entwickelt für moderne Einstellungsstandards.', freeCount: 'Kostenlos — 3 Vorlagen', proCount: 'Pro — 10 Premium-Vorlagen', proBadge: 'PRO', unlockPro: 'Alle 10 Premium-Vorlagen freischalten für 3,99 $ einmalig', browseAll: 'Alle Vorlagen durchsuchen',
    categories: { ats: 'ATS-freundlich', creative: 'Kreativ', executive: 'Exekutiv', modern: 'Modern', japanese: 'Japanisch' },
    items: {
      'modern-minimal': { name: 'Modernes Minimal', description: 'Übersichtlich und ATS-optimiert — fällt bei Recruitern sofort auf.', category: 'ATS-freundlich' },
      'clean-simple': { name: 'Klar und Einfach', description: 'Klares Layout für den perfekten Berufseinstieg oder die Bewerbung als Student.', category: 'ATS-freundlich' },
      'professional-classic': { name: 'Professionell Klassisch', description: 'Zeitlos, gepflegt und von Recruitern branchenübergreifend geschätzt.', category: 'ATS-freundlich' },
      'creative-bold': { name: 'Kreativ Mutig', description: 'Sofort auffällig — gemacht, um in kreativen Branchen zu beeindrucken.', category: 'Kreativ' },
      'creative-artistic': { name: 'Kreativ Künstlerisch', description: 'Zeig deine Persönlichkeit mit einem modernen Design, das in Erinnerung bleibt.', category: 'Kreativ' },
      'elegant-formal': { name: 'Elegant Formell', description: 'Verfeinert und überzeugend — ideal für Führungspositionen.', category: 'Exekutiv' },
      'ats-standard': { name: 'ATS Standard', description: 'Maximiert deine Chancen, jeden automatisierten Screening-Filter zu passieren.', category: 'ATS-freundlich' },
      'executive-premium': { name: 'Exekutiv Premium', description: 'Repräsentatives Design für C-Level, das jedes Detail zur Geltung bringt.', category: 'Exekutiv' },
        'nordic-clean': { name: 'Nordisch Klar', description: 'Ruhiges, klares Layout — deine Erfahrung steht im Mittelpunkt.', category: 'Modern' },
        'tech-sidebar': { name: 'Tech Seitenleiste', description: 'Zweispaltiges Layout, das Skills und Erfahrung optimal strukturiert.', category: 'Modern' },
        'corporate-navy': { name: 'Korporativ Marine', description: 'Stark und souverän — hinterlässt auf den ersten Blick einen bleibenden Eindruck.', category: 'Exekutiv' },
        'modern-minimal-executive': { name: 'Modernes Minimal Exekutiv', description: 'Modernes Führungsdesign mit Sidebar für Executives.', category: 'Exekutiv' },
        'contemporary-bold': { name: 'Zeitgenössisch Mutig', description: 'Klares, strukturiertes Design für Tech- und Startup-Bewerbungen.', category: 'Modern' },
        'rirekisho': { name: 'Rirekisho', description: 'Das authentische japanische Lebenslaufformat — perfekt für den japanischen Markt.', category: 'Japanisch' }
      }
    },
  legal: {
    privacy: {
      title: 'Datenschutzrichtlinie', effectiveDate: 'Gültig ab: April 2026',
      sections: [
        { title: '1. Einleitung', content: 'CV Pro AI respektiert Ihre Privatsphäre und verpflichtet sich zum Schutz Ihrer personenbezogenen Daten. Diese Datenschutzrichtlinie erläutert, wie wir Ihre Daten bei der Nutzung unseres KI-gestützten Lebenslauf- und Anschreiben-Builders erheben, verwenden und schützen.' },
        { title: '2. Erhobene Daten', content: 'Bei der Nutzung der App können wir folgende Informationen erheben:', items: ['Name (sofern angegeben)', 'E-Mail-Adresse (sofern angegeben)', 'Von Ihnen eingegebene Lebenslauf- und Anschreiben-Inhalte', 'Grundlegende Nutzungsdaten und Analysedaten'] },
        { title: '3. Verwendung Ihrer Daten', content: 'Ihre Daten werden ausschließlich für folgende Zwecke verwendet:', items: ['Erstellung von Lebensläufen und Anschreiben', 'Verbesserung von KI-Funktionen und App-Qualität', 'Bereitstellung der grundlegenden App-Funktionalität'] },
        { title: '4. KI-Verarbeitung', content: 'Ihre Eingaben können sicher an KI-Drittanbieter übermittelt werden, um Lebenslauf-Zusammenfassungen, Aufzählungspunkte, Anschreiben und andere KI-gestützte Inhalte zu generieren. Die Daten werden ausschließlich zum Zweck der Generierung der angeforderten Ausgabe verarbeitet. CV Pro AI verwendet Ihre Inhalte nicht für Werbezwecke.' },
        { title: '5. Datenweitergabe', content: 'Wir schützen Ihre Privatsphäre und gehen verantwortungsvoll mit Ihren Daten um:', items: ['Wir verkaufen Nutzerdaten NICHT an Dritte', 'Daten werden nicht an Dritte weitergegeben, außer an wesentliche Dienstleister zum Betrieb der App'] },
        { title: '6. Datenspeicherung & Sicherheit', content: 'Ihre Lebenslaufdaten werden lokal auf Ihrem Gerät gespeichert. Die App verwendet Autosave, um laufende Entwürfe lokal auf Ihrem Gerät zu speichern. Bestimmte Inhalte können sicher übermittelt werden, wenn Sie KI-gestützte Funktionen nutzen, die Inhaltsgenerierung oder -verbesserung erfordern. Wir setzen branchenübliche Sicherheitsmaßnahmen einschließlich TLS-Verschlüsselung ein. Angemessene Maßnahmen werden ergriffen, um alle Nutzerinformationen zu schützen.', items: ['KI-generierte Inhalte und Entwurfsdaten werden nur so lange aufbewahrt, wie es zur Bereitstellung der angeforderten Funktionalität erforderlich ist. Lokal gespeicherte Entwurfsdaten verbleiben unter der Kontrolle des Nutzers und können jederzeit durch Löschen des Entwurfs oder Zurücksetzen der Anwendung gelöscht werden.'] },
        { title: '7. Ihre Rechte & DSGVO-Schutz', content: 'Sie haben die volle Kontrolle über Ihre personenbezogenen Daten. Wenn Sie sich im Europäischen Wirtschaftsraum (EWR) befinden, haben Sie zusätzliche Rechte gemäß der Datenschutz-Grundverordnung (DSGVO):', items: ['Auskunft über Ihre personenbezogenen Daten anfordern', 'Löschung Ihrer Daten anfordern (Recht auf Löschung)', 'Berichtigung unrichtiger Daten anfordern', 'Einschränkung der Verarbeitung anfordern (EWR-Nutzer)', 'Datenübertragbarkeit — Erhalt Ihrer Daten in einem strukturierten, maschinenlesbaren Format (EWR-Nutzer)', 'Einwilligung jederzeit widerrufen, wenn die Verarbeitung auf Einwilligung beruht'] },
        { title: '8. Cookies & Analytik', content: 'Die App kann grundlegende Analysewerkzeuge verwenden, um Nutzungsmuster zu verstehen und die Leistung zu verbessern. Es werden keine personenbezogenen Daten an Werbenetzwerke weitergegeben.' },
        { title: '9. Zahlungen & Käufe', content: 'Pro-Plan-Käufe werden sicher über Drittanbieter-Zahlungsdienstleister abgewickelt:', items: ['Zahlungen werden über Apple App Store, Google Play Store und RevenueCat abgewickelt', 'CV Pro AI sammelt, verarbeitet oder speichert KEINE Zahlungskartendaten', 'Sämtliche Zahlungsdaten werden direkt vom jeweiligen App-Store und Zahlungsdienstleister gemäß deren eigenen Datenschutz- und Sicherheitsrichtlinien verwaltet', 'Kaufvalidierung und Berechtigungsverwaltung können über RevenueCat oder ähnliche Zahlungsinfrastrukturanbieter erfolgen.'] },
        { title: '10. Kinderschutz', content: 'Diese App ist nicht für Nutzer unter 13 Jahren bestimmt. Wir erheben wissentlich keine personenbezogenen Daten von Kindern unter 13 Jahren. Sollte ein Kind uns Daten übermittelt haben, kontaktieren Sie uns bitte umgehend.' },
        { title: '11. Keine Garantien', content: 'CV Pro AI garantiert keine Anstellung, Vorstellungsgespräche, Stellenangebote oder Bewerbungsergebnisse. Die Nutzer bleiben dafür verantwortlich, alle generierten Inhalte zu überprüfen, zu bearbeiten und zu verifizieren, bevor sie diese an Arbeitgeber oder Dritte übermitteln.' },
        { title: '12. Kontakt', content: 'Bei Fragen oder Anfragen zu dieser Datenschutzrichtlinie kontaktieren Sie uns unter help.cvappai@gmail.com.' }
      ]
    },
    terms: {
      title: 'Nutzungsbedingungen', effectiveDate: 'Gültig ab: April 2026',
      sections: [
        { title: '1. Einleitung', content: 'CV Pro AI ist ein Werkzeug zur Erstellung von Lebensläufen und Anschreiben mithilfe von KI. Durch die Nutzung der App stimmen Sie diesen Nutzungsbedingungen zu.' },
        { title: '2. Dienstbeschreibung', content: 'CV Pro AI ist ein KI-gestützter Lebenslauf- und Anschreiben-Builder. Die App bietet einen kostenlosen Plan und einen Pro-Plan. Der kostenlose Plan umfasst 1 Anschreiben-Download und 1 KI-Neugenerierung. Der Pro-Plan (3,99 $ Einmalzahlung) bietet unbegrenzte Downloads, unbegrenzte KI-Generierung, 10 Premium-Vorlagen, KI-Schreibwerkzeuge und den Stellenanzeigen-Analysator.' },
        { title: '3. KI-Haftungsausschluss', content: 'KI-generierte Inhalte dienen nur zur Unterstützung und müssen vom Nutzer überprüft werden. Inhalte können Ungenauigkeiten oder kontextspezifische Fehler enthalten. Sie sind allein verantwortlich für die Überprüfung und Bearbeitung aller KI-generierten Texte.' },
        { title: '4. Nutzerverantwortung', content: 'Sie sind für die Richtigkeit der von Ihnen eingegebenen Informationen verantwortlich. Stellen Sie sicher, dass alle Daten wahrheitsgemäß und aktuell sind. Die Endverantwortung für Ihre Bewerbungsunterlagen liegt bei Ihnen.' },
        { title: '5. Akzeptable Nutzung', content: 'Sie verpflichten sich, die App nicht zu missbrauchen, keine illegalen Inhalte hochzuladen und den Dienst nicht gegen geltende Gesetze zu nutzen. Bei Missbrauch kann der Zugang eingeschränkt werden.' },
        { title: '6. Zahlungen', content: 'Der Pro-Plan ist für eine Einmalzahlung von 3,99 $ erhältlich und gewährt lebenslangen Zugang ohne Abonnement oder automatische Verlängerung. Nutzen Sie bei Bedarf die Schaltfläche „Kauf wiederherstellen" auf der Preisseite.' },
        { title: '7. Keine Garantien', content: 'CV Pro AI stellt Werkzeuge zur Unterstützung bei der Erstellung von Lebensläufen bereit. Wir garantieren keine Jobangebote, Vorstellungsgespräche oder Beschäftigungsergebnisse.' },
        { title: '8. Haftungsbeschränkung', content: 'Die App wird „wie besehen" ohne jegliche ausdrückliche oder stillschweigende Gewährleistung bereitgestellt. CV Pro AI haftet nicht für mittelbare oder unmittelbare Schäden, die aus der Nutzung der App entstehen.' },
        { title: '9. Kündigung', content: 'Wir behalten uns das Recht vor, den Zugang zur App bei Verstößen gegen diese Bedingungen einzuschränken oder zu beenden.' },
        { title: '10. Änderungen der Bedingungen', content: 'Wir können diese Nutzungsbedingungen von Zeit zu Zeit aktualisieren. Die fortgesetzte Nutzung der App nach Änderungen gilt als Zustimmung zu den aktualisierten Bedingungen.' },
        { title: '11. Kontakt', content: 'Bei Fragen oder Support kontaktieren Sie uns unter help.cvappai@gmail.com.' }
      ]
    }
  },
    comparison: {
      title: 'Unterschied sehen', subtitle: 'Vergleich zwischen Free und Pro.', freePlan: 'Basis-Layout', proPlan: 'Professionelles Layout', good: 'Gut', hireReady: 'Einstellungsbereit', proBadge: 'Pro', freeFeatures: ['Basis-Layout & Typografie', 'Minimale Hierarchie', 'Standardabstände'], proFeatures: ['Premium-Typografie', 'Internationaler Standard', 'Verfeinerte Struktur'], summary: 'Zusammenfassung', experience: 'Berufserfahrung', expertise: 'Expertise', languages: 'Sprachen', chips: ['SEO-Strategie', 'Analytik', 'Inhalt', 'E-Mail'], persuasiveText: 'Professionelle Layouts helfen Ihrem Lebenslauf, sich in kompetitiven Märkten abzuheben.'
    },
  previews: {
    name: 'Max Mustermann', role: 'Senior Produktmanager', email: 'max@email.com', phone: '+49 123 456789', location: 'Berlin / New York', experience: 'Erfahrung', education: 'Ausbildung', skills: 'Fähigkeiten', contact: 'Kontakt', headOfProduct: 'Leiter Produkt', productManager: 'Produktmanager', jrPm: 'Junior PM', techCorp: 'TechCorp', startupXY: 'StartupXY', digitalAgency: 'DigitalAgentur', techCorpDesc: 'Leitung eines Teams von 12, Launch von 3 Kernprodukten, ARR +40%.', startupDesc: 'Roadmap-Definition, Nutzerforschung, Retention +28%.', agencyDesc: 'Feature-Delivery für 5 Kundenprodukte.', mba: 'MBA', columbia: 'Columbia University', present: 'Heute', now: 'Jetzt', productVision: 'Produktvision', teamLeadership: 'Teamführung', gtm: 'Go-to-Market', dataAnalysis: 'Datenanalyse', productStrategy: 'Produktstrategie', uxResearch: 'UX-Forschung', agile: 'Agile / Scrum', techCorpYears: '2021–Heute', startupYears: '2018–2021', educationYears: '2016–2018', agencyYears: '2016–2018'
  },
  onboarding: {
    title: 'Willkommen beim KI- & intelligenten Lebenslauf-Builder ✨',
    subtitle: 'Erstelle einen professionellen Lebenslauf und ein Anschreiben in Minuten. Kostenlos starten – upgrades, wenn du bereit bist.',
    freeLabel: 'Kostenlos',
    freeFeatures: ['3 Standard-Vorlagen', '1 Anschreiben-Download', '1 KI-Regenerationsversuch', 'Alle 12 Sprachen'],
    proLabel: 'Pro – 3,99 €',
    proRecommendedBadge: 'EMPFOHLEN',
    proFeatures: ['Unbegrenzte Anschreiben', 'KI-Umschreib-Tools', '10 Premium-Vorlagen', 'Job-Analyzer + Priority Support'],
    oneTimePayment: 'Einmalige Zahlung. Kein Abonnement.',
    aiFeatureTitle: 'KI-Features',
    aiFeatureDesc: 'KI verwendet deine Eingaben nur zur Textgenerierung und speichert Daten nicht dauerhaft. Überprüfe alle KI-generierten Texte vor dem Absenden.',
    startFree: 'Kostenlos starten',
    upgradeToPro: 'Upgrade zu Pro',
    secureCheckout: 'Sichere Zahlung. Sofortige Aktivierung. Kein Abonnement.'
  },
  about: {
    hero: { badge: 'Google Play & App Store Beschreibung', title: 'CV Pro AI — KI- & Smart Lebenslauf-Builder', description: 'Erstellen Sie in Minuten einen professionellen, stellengewinnen Lebenslauf und ein KI-Anschreiben. Kostenlos starten — einmal upgraden, für immer nutzen.', ageRating: 'Altersfreigabe: 3+', languages: '12 Sprachen', privacyFirst: 'Datenschutz an erster Stelle' },
    description: { title: 'App-Beschreibung', paragraphs: ['CV Pro AI ist ein KI-gestützter Lebenslauf- und Anschreiben-Builder für Jobsuchende weltweit. Erstellen Sie in Minuten einen professionellen, ATS-optimierten Lebenslauf mit intelligenten Vorlagen und KI-Schreibwerkzeugen.', 'Verfügbar für Android (Google Play) und iPhone (Apple App Store).', 'Wählen Sie aus 13 professionellen Vorlagen — 3 kostenlos, 10 Premium. Der KI-Schreibassistent hilft Ihnen, überzeugende Aufzählungspunkte, professionelle Zusammenfassungen und personalisierte Anschreiben zu verfassen, die auf Ihre Zielposition und das Unternehmen zugeschnitten sind.', 'Mit Unterstützung für 12 Sprachen, darunter Arabisch (RTL), Japanisch, Hindi (Indien) und mehr, können Sie einen jobfertigen Lebenslauf für jeden Markt erstellen. Die regionale Optimierung passt Ihren Lebenslauf automatisch an US-, EU-, Balkan-, Nahost-, indische und japanische Arbeitsmarktstandards an.', 'Kostenlos: Erstellen Sie Ihren Lebenslauf, laden Sie 1 KI-generiertes Anschreiben herunter und nutzen Sie 1 Regenerationsversuch — keine Anmeldung erforderlich.', 'Pro-Plan (3,99 € einmalig): Entsperren Sie unbegrenzte KI-generierte Anschreiben, KI-Umschreib-Tools, alle 10 Premium-Vorlagen, Job-Description-Analyzer und prioritären Support. Einmalige Zahlung. Kein Abonnement. Keine Verlängerung.'] },
    features: { title: 'Kostenlos vs. Pro-Funktionen', free: { label: 'Kostenlos — 0 €', items: ['3 Standard-Vorlagen (ATS-freundlich)', '1 KI-generiertes Anschreiben-Download', '1 Anschreiben-Regenerationsversuch', 'KI-Zusammenfassungsgenerierung', 'Alle 12 Sprachen', 'DOCX-Export', 'Regionale CV-Optimierung'], disabledItems: ['KI-Umschreib-Tools', 'Stellenbeschreibungs-Analyse', '10 Premium-Vorlagen', 'Unbegrenzte Anschreiben'] }, pro: { label: 'Pro — 3,99 € einmalig', price: 'EINMALIG 3,99 €', items: ['10 Premium-Vorlagen (+ 3 kostenlos)', 'Unbegrenzte KI-generierte Anschreiben', 'Unbegrenzte Anschreiben-Regenerationen', 'KI-Zusammenfassungsgenerierung', 'KI-Umschreib-Tools (Kürzen, Stärken, Professionalisieren)', 'Job-Description-Analyzer', 'Alle 12 Sprachen', 'DOCX-Export', 'Regionale CV-Optimierung', 'Priority Support'], footer: 'Einmalige Zahlung. Kein Abonnement. Keine Verlängerung.' } },
    aiDisclosure: { title: 'So wird KI in dieser App verwendet', items: ['Die App nutzt KI-Dienste von Drittanbietern, um Lebenslauf-Zusammenfassungen, Aufzählungspunkte und Anschreiben-Text zu generieren.', 'Benutzereingaben (Stellentitel, Unternehmensname, Tontone-Präferenz, Berufserfahrung) werden von KI-Diensten nur zur Textgenerierung verarbeitet.', 'Benutzereingaben werden von der App oder von KI-Diensten nicht dauerhaft gespeichert.', 'KI-generierte Inhalte können Ungenauigkeiten enthalten. Nutzer sind verantwortlich für die Überprüfung aller Inhalte vor der Einreichung bei Arbeitgebern.', 'Die KI-Schaltfläche ist klar gekennzeichnet: „Mit KI generieren ✨"'] },
    ageAndContent: { title: 'Altersfreigabe & Inhaltswarnung', ageRating: 'Altersfreigabe: 3+', ageRatingDesc: 'Für alle Altersgruppen geeignet. Keine reifen Inhalte.', disclaimer: 'KI-generierte Inhalte können Ungenauigkeiten, Grammatikfehler oder kontextspezifische Probleme enthalten. Nutzer sind vollständig verantwortlich für die Überprüfung, Bearbeitung und Verifikation aller KI-generierten Texte, bevor sie an Arbeitgeber oder Dritte eingereicht werden.', noLiability: 'CV Pro AI bietet Tools zur Unterstützung bei der Erstellung von Lebensläufen und Anschreiben. Wir geben keine Garantien für Einstellungsergebnisse. Die Verwendung von KI-generierten Inhalten erfolgt auf eigenes Risiko des Nutzers.', privacy: 'Lebenslafdaten werden lokal auf dem Gerät des Nutzers gespeichert. Persönliche Informationen werden nicht an Dritte verkauft oder zu Marketingzwecken weitergegeben.' },
    languages: { title: 'Unterstützte Sprachen', list: ['English', 'Deutsch (German)', 'Español (Spanish)', 'Français (French)', 'Italiano (Italian)', 'العربية (Arabic) — RTL', 'Srpski (Serbian)', 'Hrvatski (Croatian)', 'Русский (Russian)', 'Português (Brazil)', 'हिन्दी (Hindi)', '日本語 (Japanese)'] },
    restorePurchase: { title: 'Kauf wiederherstellen', description: 'Wenn Sie zuvor Pro gekauft haben und Ihren Zugriff wiederherstellen müssen, tippen Sie die Schaltfläche „Kauf wiederherstellen" auf der Preisseite. Ihr Pro-Zugriff wird sofort auf dem aktuellen Gerät wiederhergestellt. Wenn Sie Probleme haben, kontaktieren Sie uns unter help.cvappai@gmail.com.' },
    legal: { title: 'Rechtliches', privacyPolicy: 'Datenschutzrichtlinie', termsOfService: 'Nutzungsbedingungen', contact: 'Kontakt: help.cvappai@gmail.com', viewPricing: 'Preise anzeigen & auf Pro upgraden' }
  }
};

const es: TranslationKeys = {
  nav: { home: 'Inicio', cvBuilder: 'Creador CV', coverLetter: 'Carta', templates: 'Plantillas', pricing: 'Precios', about: 'Acerca de', contact: 'Contacto', login: 'Acceder', register: 'Registro', dashboard: 'Panel', logout: 'Salir' },
  hero: { title: 'Crea un CV profesional en minutos.', professionalResumesAiPowered: 'Currículums profesionales. Con tecnología de IA.', subtitle: 'Constructor de CV con IA, plantillas premium y optimización inteligente.', valueDesc: 'Crea un currículum profesional en minutos. Desbloquea 10 plantillas premium y herramientas avanzadas con Pro.', cta: 'Crear Mi CV', ctaSecondary: 'Ver Plantillas', badge: 'Constructor de CV con IA', footerText: 'Pago único. Acceso de por vida. Sin suscripciones.' },
  features: { title: 'Todo lo que necesitas.', subtitle: 'Potentes herramientas de IA para el mercado global', badge: 'Qué incluye', ai: { title: 'Escritura IA Inteligente', desc: 'Mejora claridad y estructura automáticamente.' }, multilingual: { title: 'Soporte Multilingüe', desc: 'Crea CVs en 9 idiomas al instante.' }, templates: { title: 'Plantillas Premium', desc: '10 premium + 3 gratis. Diseños modernos.' }, ats: { title: 'ATS-Friendly', desc: 'Pasan los sistemas de seguimiento de candidatos.' }, region: { title: 'Optimizado por Región', desc: 'Adaptación para EE.UU., UE, Balcanes y Oriente Medio.' }, export: { title: 'Exportación Multiformato', desc: 'Descarga en DOCX o copia al portapapeles.' }, analyzer: { title: 'Analizador de Ofertas', desc: 'Ajusta tu CV a la oferta con precisión IA. Solo Pro.' } },
  howItWorks: { title: 'Cómo funciona', step: 'PASO', step1: { title: 'Añade tu información', desc: 'Completa tus datos personales, experiencia laboral y formación para empezar a crear tu currículum.' }, step2: { title: 'Mejora tu currículum', desc: 'Usa herramientas inteligentes y sugerencias para hacer tu currículum más sólido y profesional.' }, step3: { title: 'Descarga tu currículum', desc: 'Exporta tu currículum terminado en formato DOCX listo para enviar a empleadores.' } },
  whoIsThisFor: { title: '¿Para quién es este creador de currículum?', items: ['Personas en búsqueda de empleo', 'Estudiantes y graduados', 'Profesionales en cambio de carrera', 'Cualquiera que quiera un currículum moderno y profesional'] },
  privacyFirst: { title: 'Privacidad primero', desc: 'Los datos de tu currículum se quedan en tu dispositivo. No almacenamos, vendemos ni compartimos tu información personal.', local: 'Este creador de currículum funciona localmente en tu dispositivo para mantener tu información segura.' },
  simplePricing: { title: 'Precios simples', desc: 'Sin suscripción. Compra única para desbloquear todas las plantillas Pro y herramientas avanzadas.' },
    pricing: { 
      title: 'Precios simples.', 
      subtitle: 'Sin suscripciones. Sin cuotas mensuales. Paga una vez.', 
      oneTime: '3,99 $ una vez', 
      getStarted: 'Empezar',
      footerText: 'Pago único · Acceso de por vida · Sin suscripción',
          free: { name: 'Gratis', price: '0 $', features: ['3 Plantillas Estándar', '1 Descarga CV', '1 Descarga Carta de Presentación', 'Todos los idiomas'], cta: 'Empezar Gratis', desc: 'Empieza sin coste.' }, 
          pro: { name: 'Pro', price: '3,99 $', features: ['10 Plantillas Premium', 'Descargas de CV Ilimitadas', 'Cartas de Presentación IA Ilimitadas', 'Analizador de Ofertas', 'Mejoras IA', 'Todos los idiomas'], cta: 'Pasar a Pro', desc: 'Paga una vez. Usa para siempre.', badge: 'Pro — Acceso Vitalicio', footer: 'Pago seguro. Activación instantánea.', noSubscription: 'Sin suscripción. Sin renovación.' },
      tableTitle: 'Comparación de características',
      tableHeaderFeature: 'Característica',
      tableHeaderFree: 'Gratis',
      tableHeaderPro: 'Pro',
      tableRowCV: 'Descargas de CV',
      tableRowCoverLetter: 'Descargas de cartas',
      tableRowTemplates: 'Plantillas',
      tableRowAI: 'Generación de resumen con IA',
      tableRowRewrite: 'Herramientas de reescritura IA',
      tableRowAnalyzer: 'Analizador de ofertas',
      tableRowLanguages: 'Todos los idiomas',
      tableRowSupport: 'Soporte prioritario',
        unlimited: 'Ilimitado',
        threeStandard: '3 estándar',
        proTemplatesCount: '10 Premium + 3 Gratis',
        oneCount: '1',
        popularBadge: 'Más popular',
        bestValueBadge: 'Mejor valor',
        coverLetterFreeValue: '1 Descarga de Carta de Presentación',
        coverLetterProValue: 'Cartas de Presentación IA Ilimitadas',
        restoreTitle: '¿Ya compraste Pro?',
        restoreDesc: 'Restaura tu compra anterior para recuperar el acceso Pro en este dispositivo.',
        restoreButton: 'Restaurar compra',
        proActive: 'Pro Activo',
        restoringText: 'Restaurando...',
        needHelp: '¿Necesitas ayuda?',
        fairUse: 'Pueden aplicarse límites de uso razonable para prevenir abusos y garantizar un servicio fiable.'
      },

  faq: { title: 'Preguntas Frecuentes', items: [
    { q: '¿Qué incluye el plan gratuito?', a: 'El plan gratuito te permite crear 1 CV y generar 1 carta de presentación. También puedes usar herramientas de IA con acceso limitado para mejorar tu contenido.' },
    { q: '¿Cuántas cartas de presentación puedo generar gratis?', a: 'Puedes generar 1 carta de presentación gratis, incluyendo 1 intento de regeneración.' },
    { q: '¿Qué pasa después de usar mi carta gratuita?', a: 'Después de usar tu carta gratuita, puedes actualizar a Pro para obtener cartas ilimitadas y acceso completo a las funciones de IA.' },
    { q: '¿Qué obtengo con Pro?', a: 'Pro te da cartas de presentación ilimitadas, acceso completo a todas las herramientas de IA, plantillas premium y funciones avanzadas de optimización de CV.' },
    { q: '¿Son gratuitas las funciones de IA?', a: 'Algunas funciones de IA están disponibles gratis con uso limitado. Actualiza a Pro para desbloquear el acceso ilimitado.' },
    { q: '¿Puedo usar la aplicación en diferentes idiomas?', a: 'Sí, la aplicación admite varios idiomas para que puedas crear tu CV y carta de presentación en tu idioma preferido.' },
    { q: '¿Son las plantillas ATS-friendly?', a: 'Totalmente. Todas las plantillas están diseñadas para pasar los filtros ATS utilizados por los principales empleadores en todo el mundo.' },
    { q: '¿Cómo funciona la IA? ¿Almacena mis datos?', a: 'La IA usa solo tus datos de entrada (título del puesto, empresa, tono, etc.) para generar texto. No almacena tus datos personales de forma permanente. La aplicación usa servicios de IA de terceros para procesar las solicitudes de generación.' },
    { q: '¿El contenido generado por IA es siempre preciso?', a: 'El contenido generado por IA puede contener imprecisiones. Revisa siempre el texto generado por IA cuidadosamente antes de enviarlo a empleadores. Los usuarios son responsables del contenido final.' }
  ] },
    cv: { title: 'Constructor CV', personal: 'Información Personal', experience: 'Experiencia', education: 'Educación', skills: 'Habilidades', certifications: 'Certificaciones', languages: 'Idiomas', summary: 'Resumen Profesional', generate: 'Generar con IA', rewrite: 'Reescribir', translate: 'Traducir', analyzeJob: 'Analizar Oferta', download: 'Descargar', downloadCv: 'Descargar CV', downloadPdf: 'PDF', downloadDocx: 'DOCX', downloadPdfDesc: 'Recomendado · Listo para enviar', downloadDocxDesc: 'Versión editable', downloadNote: 'El PDF conserva el diseño seleccionado. El DOCX es editable y puede tener pequeñas diferencias de diseño según Word, Google Docs o visores móviles.', pdfExportFailed: 'Error al exportar PDF. Por favor, inténtalo de nuevo.',
    wordExportFailed: 'Error al exportar Word. Por favor, inténtalo de nuevo.', preview: 'Vista Previa', selectTemplate: 'Elegir Plantilla', jobTitle: 'Título Puesto', fullName: 'Nombre Completo', email: 'Email', phone: 'Teléfono', address: 'Dirección', fathersName: 'Nombre del Padre', nationality: 'Nacionalidad', dateOfBirth: 'Fecha de Nacimiento', company: 'Empresa', position: 'Posición', startDate: 'Fecha Inicio', endDate: 'Fecha Fin', present: 'Presente', description: 'Descripción', degree: 'Título', school: 'Escuela / Universidad', addMore: 'Añadir más', remove: 'Eliminar', region: 'Región Destino', ready: '¿Listo para tu CV?', readySubtitle: 'Empieza gratis. Pasa a Pro cuando quieras.', edit: 'Editar', copied: '¡Copiado!', copy: 'Copiar', jobTitlePlaceholder: 'ej. Desarrollador Software', fullNamePlaceholder: 'Juan Pérez', aiBullets: 'Mejoras con IA', skillPlaceholder: 'Escribe habilidad y pulsa Enter', certPlaceholder: 'ej. Certificado AWS', langPlaceholder: 'Idioma', levelPlaceholder: 'Nivel',       summaryPlaceholder: 'Escribe o genera tu resumen profesional...',
      jobDescPlaceholder: 'Pega la descripción de la oferta aquí...',
      short: 'Más corto',
 strong: 'Más fuerte', professional: 'Profesional', keywordsFound: 'Keywords encontradas', suggestions: 'Sugerencias', suggestedSkills: 'Habilidades Sugeridas', skillCategories: { technical: 'Habilidades técnicas', soft: 'Habilidades blandas' }, aiRecommend: 'IA Recomienda', recommendedToast: 'Recomendado', recommendedForYou: '⭐ Recomendado para ti', bestResultsTemplate: 'Mejores resultados con esta plantilla', optimizedForProfile: 'Optimizado para tu perfil', unlockWithPro: 'Desbloquea esta plantilla con Pro', saveRequired: 'Accede para guardar tu CV.', saved: '¡CV guardado!', draftSaved: 'Draft saved', genSuccess: '¡Resumen generado!', bulletsSuccess: '¡Mejoras con IA aplicadas!', rewriteSuccess: 'Reescrito', levels: { native: 'Nativo', fluent: 'Fluido', advanced: 'Avanzado', intermediate: 'Intermedio', basic: 'Básico' }, regions: { us: 'EE.UU.', eu: 'UE', balkan: 'Balcanes', middleEast: 'Oriente Medio', india: 'India', japan: 'Japón' }, gender: 'Género', genderMale: 'Masculino', genderFemale: 'Femenino', genderOther: 'Otro', coverLetterSection: 'Carta de presentación', photo: { title: 'Foto de perfil', optional: '(Opcional)', shown: 'Mostrada en CV', hidden: 'Oculta en CV', shownDesc: 'Mostrada por defecto para tu región', hiddenDesc: 'La foto está oculta en el CV.', change: 'Cambiar foto', upload: 'Subir foto', recrop: 'Recortar', remove: 'Eliminar foto', hint: 'JPG o PNG, máx. 5MB.', aiEnhance: 'Mejora con IA', aiEnhancing: 'Mejorando...', applied: 'Aplicado', upgrade: 'Pasar a Pro', features: ['Desenfoque de fondo', 'Brillo y contraste', 'Tono de piel natural', 'Centrado automático'], cropTitle: 'Recortar foto', cropHint: 'Arrastrar para reposicionar', apply: 'Aplicar recorte', usRegion: 'Oculta por defecto en región EE.UU.', otherRegion: 'Mostrada por defecto para tu región', errorFormat: 'Sube una imagen JPG o PNG.' }, industryLabel: 'Sector', levelLabel: 'Nivel', industryPlaceholder: 'Selecciona sector', industries: { tech: 'IT / Desarrollo de Software', data_ai: 'Datos / IA / Machine Learning', cybersecurity: 'Ciberseguridad', sales_retail: 'Ventas (Retail)', sales_b2b: 'Ventas (B2B)', marketing: 'Marketing / Marketing Digital', sales: 'Ventas', finance: 'Finanzas / Contabilidad', banking_fintech: 'Banca / FinTech', healthcare: 'Salud / Medicina', pharmacy: 'Farmacia', education: 'Educación / Enseñanza', human_resources: 'Recursos Humanos', customer_service: 'Soporte al Cliente / Call Center', logistics: 'Logística / Cadena de Suministro', operations: 'Operaciones / Producción', executive: 'Gestión / Liderazgo', project_management: 'Gestión de Proyectos', design: 'Diseño / UX / UI', engineering: 'Ingeniería (Mecánica / Eléctrica)', construction: 'Construcción / Arquitectura', hospitality: 'Hostelería / Turismo', legal: 'Derecho', administration: 'Administración / Oficina', general: 'General' }, bulletLevels: { entry: 'Nivel Inicial', mid: 'Nivel Medio', senior: 'Senior', lead: 'Líder / Director' }, aiExperienceIntro: '✨ Mejora tu experiencia laboral con IA', aiExperienceIntroSub: 'Escribe descripciones más sólidas, claras y profesionales en segundos.', aiSummaryIntro: '✨ Crea un resumen profesional impactante', aiSummaryIntroSub: 'Genera o mejora tu resumen para destacar ante los reclutadores.', generateSubtext: 'Resumen potente en segundos', shorterSubtext: 'Texto más conciso y directo', strongerSubtext: 'Resalta logros e impacto', professionalSubtext: 'Mejora el tono y la redacción', aiBulletsSubtext: 'Convierte experiencia en logros concretos', analyzeJobSubtext: 'Adapta tu CV a los requisitos del puesto', analyzeJobProOnly: 'El análisis de descripción de trabajo solo está disponible en Pro.', aiRecommendSubtext: 'Encuentra la mejor plantilla para ti', proHint: 'Recomendado', proHintPopular: 'Más popular', jobAnalysis: { title: 'Tu análisis de CV', subtitle: 'Qué tan bien coincide tu CV con este trabajo', matchScore: 'Coincidencia', matchGood: 'Buena coincidencia — pero mejorable', matchAverage: 'Coincidencia media — varias brechas encontradas', matchWeak: 'Coincidencia débil — se necesitan mejoras importantes', keyInsights: 'Puntos clave', insight1: 'Experiencia relevante encontrada', insight2: 'Habilidades clave faltantes', insight3: 'Descripciones de impacto débiles', importantKeywords: 'Palabras clave importantes', unlockFull: 'Desbloquea la lista completa con Pro', suggestedImprovements: 'Mejoras sugeridas', improve1: 'Añade resultados medibles', improve2: 'Usa verbos de acción más fuertes', improve3: 'Incluye habilidades faltantes', proCardTitle: 'Mejora tu CV al instante', proCardText: 'Desbloquea el análisis completo, todas las palabras clave y mejoras con IA', proCardCta: 'Pasar a Pro', proCardNote: 'Pago único', analyzing: 'Analizando tu CV...' } },
  coverLetter: { title: 'Constructor de Carta', firstName: 'Nombre', lastName: 'Apellido', gender: 'Género', genderMale: 'Masculino', genderFemale: 'Femenino', genderPreferNot: 'Prefiero no decirlo', identitySection: 'Tu información', jobTitle: 'Puesto', companyName: 'Empresa',tone: 'Tono', tones: { formal: 'Formal', confident: 'Seguro', friendly: 'Cercano' }, generate: 'Generar Carta', generating: 'Generando su carta de presentación…', regenerate: 'Regenerar', regenerating: 'Regenerando…', regenerateSubtitle: 'Obtén una nueva variación', edit: 'Editar', companyPlaceholder: 'ej. Google', firstNamePlaceholder: 'Juan', lastNamePlaceholder: 'Pérez', genSuccess: '¡Carta generada!', saved: '¡Guardado!', draftSaved: 'Draft saved', placeholder: 'Tu carta aparecerá aquí...', preview: 'Vista Previa', filename: 'Carta de Presentacion',regenLeft: 'restantes', regenExhausted: 'Has alcanzado el número máximo de regeneraciones para esta carta.', paywallMessage: 'La generación de cartas más allá del límite gratuito es una función Pro. Actualiza a Pro para generar cartas de presentación ilimitadas con IA.', downloadCl: 'Descargar carta de presentación', generateSubtitle: 'Adaptada al puesto y la empresa', aiDisclaimer: 'El contenido generado por IA puede contener imprecisiones. Revise todo el texto generado por IA antes de enviarlo.' },
  auth: { login: 'Acceder', register: 'Crear Cuenta', email: 'Email', password: 'Password', confirmPassword: 'Confirmar Password', name: 'Nombre', forgotPassword: '¿Olvidaste el password?', noAccount: '¿No tienes cuenta?', hasAccount: '¿Ya tienes cuenta?', invalidCredentials: 'Credenciales inválidas.', emailTaken: 'El email ya está registrado.' },
  dashboard: { title: 'Panel', myCVs: 'Mis CVs', myCoverLetters: 'Mis Cartas', createNew: 'Crear Nuevo', edit: 'Editar', delete: 'Borrar', lastEdited: 'Editado', upgrade: 'Pasar a Pro', plan: 'Plan Actual', welcome: 'Bienvenido', noCVs: 'Sin CVs aún.', noLetters: 'Sin cartas aún.', untitled: 'Sin título', cvDeleted: 'CV borrado', letterDeleted: 'Carta borrada', loginRequired: 'Accede para entrar al panel.', upgradeBanner: '1 CV y 1 carta de presentación incluidos.' },
  common: { save: 'Guardar', cancel: 'Cancelar', back: 'Atrás', next: 'Sig.', loading: 'Cargando...', proAccessRequired: 'Se requiere acceso Pro. Actualiza para continuar.', proAuthorizationUnavailable: 'La autorización Pro se está sincronizando. Inténtalo de nuevo en un momento.', error: 'Error', success: '¡Éxito!', darkMode: 'Modo Oscuro', lightMode: 'Modo Claro', language: 'Idioma', legal: 'Legal', previewBadge: 'Plantilla Gratis', slide: 'Diapositiva', appName: 'CV Pro AI', docx: 'DOCX' },
  footer: { rights: '© 2026 CV Pro AI. Todos los derechos reservados.', privacy: 'Privacidad', terms: 'Términos', backToHome: 'Volver al inicio' },
  templates: {
    title: 'Plantillas', subtitle: '13 plantillas profesionales.', showcase: 'Escaparate', showcaseSubtitle: 'Diseñadas para los estándares actuales.', freeCount: 'Gratis — 3 Plantillas', proCount: 'Pro — 10 Premium', proBadge: 'PRO', unlockPro: 'Desbloquea las 10 Premium por 3,99 $', browseAll: 'Ver todas',
    categories: { ats: 'ATS-Friendly', creative: 'Creativa', executive: 'Ejecutiva', modern: 'Moderna', japanese: 'Japonés' },
    items: {
      'modern-minimal': { name: 'Minimalista Moderno', description: 'Diseño limpio y optimizado para ATS que destaca ante los reclutadores.', category: 'ATS-Friendly' },
      'clean-simple': { name: 'Limpio y Simple', description: 'Claro y directo — perfecto para tu primera solicitud de empleo.', category: 'ATS-Friendly' },
      'professional-classic': { name: 'Clásico Profesional', description: 'Atemporal y confiable — el favorito de los reclutadores en todos los sectores.', category: 'ATS-Friendly' },
      'creative-bold': { name: 'Creativo Audaz', description: 'Destácate al instante con un diseño impactante para perfiles creativos.', category: 'Creativa' },
      'creative-artistic': { name: 'Creativo Artístico', description: 'Expresa tu personalidad con un diseño moderno que deja huella.', category: 'Creativa' },
      'elegant-formal': { name: 'Elegante Formal', description: 'Refinado y autorizado — ideal para cargos de alta dirección.', category: 'Ejecutiva' },
      'ats-standard': { name: 'ATS Estándar', description: 'Maximiza tus posibilidades de pasar los filtros automáticos de selección.', category: 'ATS-Friendly' },
      'executive-premium': { name: 'Ejecutivo Premium', description: 'Diseño de alto impacto para líderes C-level que no pasan desapercibidos.', category: 'Ejecutiva' },
        'nordic-clean': { name: 'Nórdico Limpio', description: 'Diseño calmado y enfocado — tu experiencia habla por sí sola.', category: 'Moderna' },
        'tech-sidebar': { name: 'Tech Sidebar', description: 'Estructura en dos columnas que organiza habilidades y experiencia eficazmente.', category: 'Moderna' },
        'corporate-navy': { name: 'Corporativo Azul', description: 'Fuerte y seguro — transmite confianza desde la primera mirada.', category: 'Ejecutiva' },
        'modern-minimal-executive': { name: 'Ejecutivo Minimalista Moderno', description: 'Presencia directiva moderna con barra lateral estructurada.', category: 'Ejecutiva' },
        'contemporary-bold': { name: 'Contemporary Bold', description: 'Diseño sólido y estructurado para roles tech y startups que exigen atención.', category: 'Moderna' },
        'rirekisho': { name: 'Rirekisho', description: 'El formato japonés auténtico — cumple exactamente con los estándares locales.', category: 'Japonesa' }
      }
    },
  legal: {
    privacy: {
      title: 'Política de Privacidad', effectiveDate: 'Vigente: Abril 2026',
      sections: [
        { title: '1. Introducción', content: 'CV Pro AI respeta tu privacidad y se compromete a proteger tus datos personales. Esta Política de Privacidad explica cómo recopilamos, usamos y protegemos tu información cuando utilizas nuestra herramienta de creación de currículum y cartas de presentación con IA.' },
        { title: '2. Datos que recopilamos', content: 'Al usar la app, podemos recopilar la siguiente información:', items: ['Nombre (si lo proporcionas)', 'Correo electrónico (si lo proporcionas)', 'Contenido del currículum que introduces', 'Datos básicos de uso y analíticas'] },
        { title: '3. Cómo usamos tus datos', content: 'Tus datos se usan exclusivamente para los siguientes fines:', items: ['Generar currículums y cartas de presentación', 'Mejorar las funciones de IA y la calidad de la app', 'Proporcionar la funcionalidad básica de la app'] },
        { title: '4. Procesamiento por IA', content: 'Tu información puede ser transmitida de forma segura a proveedores externos de IA para generar resúmenes curriculares, viñetas, cartas de presentación y otros contenidos impulsados por IA. Los datos se procesan únicamente con el fin de generar el resultado solicitado. CV Pro AI no utiliza tu contenido con fines publicitarios.' },
        { title: '5. Compartición de datos', content: 'Respetamos tu privacidad y manejamos tus datos de forma responsable:', items: ['NO vendemos datos de usuarios a terceros', 'Los datos no se comparten con terceros, salvo servicios esenciales para el funcionamiento de la app'] },
        { title: '6. Almacenamiento y seguridad', content: 'Tus datos del currículum se almacenan localmente en tu dispositivo. La app utiliza el guardado automático para almacenar borradores localmente en tu dispositivo. Cierto contenido puede transmitirse de forma segura cuando utilizas funciones de IA que requieren generación o mejora de contenido. Aplicamos medidas de seguridad estándar, incluyendo cifrado TLS. Se toman medidas razonables para proteger toda la información del usuario.', items: ['El contenido generado por IA y los datos de borradores se conservan solo según sea necesario para proporcionar la funcionalidad solicitada. Los borradores almacenados localmente permanecen bajo el control del usuario y pueden eliminarse en cualquier momento borrando el borrador o reiniciando la aplicación.'] },
        { title: '7. Tus derechos y protección RGPD', content: 'Tienes control total sobre tus datos personales. Si te encuentras en el Espacio Económico Europeo (EEE), tienes derechos adicionales bajo el Reglamento General de Protección de Datos (RGPD):', items: ['Solicitar acceso a tus datos personales', 'Solicitar la eliminación de tus datos (derecho al olvido)', 'Solicitar la corrección de datos inexactos', 'Solicitar la limitación del tratamiento (usuarios del EEE)', 'Portabilidad de datos — recibe tus datos en un formato estructurado y legible por máquina (usuarios del EEE)', 'Retirar el consentimiento en cualquier momento cuando el tratamiento se base en el consentimiento'] },
        { title: '8. Cookies y analíticas', content: 'La app puede usar herramientas básicas de analítica para entender los patrones de uso y mejorar el rendimiento. No se comparten datos personales con redes publicitarias.' },
        { title: '9. Pagos y compras', content: 'Las compras del plan Pro se procesan de forma segura a través de procesadores de pago de terceros:', items: ['Los pagos son gestionados por Apple App Store, Google Play Store y RevenueCat', 'CV Pro AI NO recopila, procesa ni almacena la información de tu tarjeta de pago', 'Todos los datos de pago son administrados directamente por la tienda de aplicaciones y el procesador de pagos correspondiente según sus propias políticas de privacidad y seguridad', 'La validación de compras y la gestión de derechos pueden proporcionarse a través de RevenueCat o proveedores similares de infraestructura de pago.'] },
        { title: '10. Menores de edad', content: 'Esta app no está destinada a usuarios menores de 13 años. No recopilamos intencionadamente información personal de menores de 13 años. Si crees que un menor nos ha proporcionado datos, contáctanos de inmediato.' },
        { title: '11. Sin garantías', content: 'CV Pro AI no garantiza empleo, entrevistas, ofertas de trabajo ni resultados de solicitudes. Los usuarios siguen siendo responsables de revisar, editar y verificar todo el contenido generado antes de enviarlo a empleadores o terceros.' },
        { title: '12. Contacto', content: 'Para cualquier consulta o solicitud sobre esta Política de Privacidad, escríbenos a help.cvappai@gmail.com.' }
      ]
    },
    terms: {
      title: 'Términos de Servicio', effectiveDate: 'Vigente: Abril 2026',
      sections: [
        { title: '1. Introducción', content: 'CV Pro AI es una herramienta para crear currículums y cartas de presentación con ayuda de IA. Al usar la app, aceptas estos Términos de Servicio.' },
        { title: '2. Descripción del servicio', content: 'CV Pro AI es un creador de currículum y carta de presentación con IA. Ofrece un plan gratuito y un plan Pro. El plan gratuito incluye 1 descarga de carta de presentación y 1 regeneración con IA. El plan Pro (pago único de 3,99 $) ofrece descargas ilimitadas, generación de IA ilimitada, 10 plantillas premium, herramientas de reescritura con IA y el analizador de ofertas de empleo.' },
        { title: '3. Aviso sobre IA', content: 'El contenido generado por IA se ofrece solo como asistencia y puede requerir revisión del usuario. Puede contener inexactitudes o variaciones de estilo. Eres el único responsable de revisar y editar todos los textos generados antes de enviarlos a empleadores.' },
        { title: '4. Responsabilidad del usuario', content: 'Eres responsable de la exactitud de la información que introduces en la app. Asegúrate de que todos los datos sean verídicos y actualizados. La responsabilidad final sobre tus materiales de solicitud recae en ti.' },
        { title: '5. Uso aceptable', content: 'Aceptas no hacer un uso indebido de la app, no subir contenido ilegal y no usarla de ninguna manera que infrinja las leyes aplicables. El abuso del servicio puede resultar en la restricción del acceso.' },
        { title: '6. Pagos', content: 'El plan Pro está disponible por un pago único de 3,99 $, que otorga acceso de por vida. No se aplica suscripción recurrente ni renovación automática. Si ya compraste Pro, usa el botón "Restaurar Compra" en la página de Precios para recuperar el acceso.' },
        { title: '7. Sin garantías', content: 'CV Pro AI ofrece herramientas para ayudar en la creación de currículums. No garantizamos que el uso de la app resulte en ofertas de empleo, entrevistas o contratación. Los resultados dependen de muchos factores fuera de nuestro control.' },
        { title: '8. Limitación de responsabilidad', content: 'La app se proporciona "tal cual" sin garantías de ningún tipo. En la máxima medida permitida por la ley, CV Pro AI no será responsable de daños indirectos o consecuentes derivados del uso de la app.' },
        { title: '9. Terminación', content: 'Nos reservamos el derecho de restringir o cancelar el acceso a la app si se violan estos Términos, incluyendo uso indebido, actividad ilegal o abuso del servicio.' },
        { title: '10. Cambios en los Términos', content: 'Podemos actualizar estos Términos de vez en cuando. El uso continuado de la app tras la publicación de cambios implica la aceptación de los Términos actualizados.' },
        { title: '11. Contacto', content: 'Para soporte o preguntas sobre estos Términos, contáctanos en help.cvappai@gmail.com.' }
      ]
    }
  },
    comparison: {
      title: 'Mira la diferencia', subtitle: 'Comparación Gratis vs Pro.', freePlan: 'Diseño Básico', proPlan: 'Diseño Profesional', good: 'Bueno', hireReady: 'Listo para Contratar', proBadge: 'Pro', freeFeatures: ['Diseño básico', 'Jerarquía mínima', 'Espaciado estándar'], proFeatures: ['Tipografía premium', 'Estándar internacional', 'Estructura refinada'], summary: 'Resumen', experience: 'Experiencia', expertise: 'Experiencia', languages: 'Idiomas', chips: ['Estrategia SEO', 'Analítica', 'Contenido', 'Email'], persuasiveText: 'Los diseños profesionales ayudan a que su CV destaque en mercados competitivos.'
    },
  previews: {
    name: 'Alejandro G.', role: 'Senior Product Manager', email: 'alex@email.com', phone: '+34 900 123 456', location: 'Madrid / NY', experience: 'Experiencia', education: 'Educación', skills: 'Habilidades', contact: 'Contacto', headOfProduct: 'Director de Producto', productManager: 'Product Manager', jrPm: 'Jr. PM', techCorp: 'TechCorp', startupXY: 'StartupXY', digitalAgency: 'Agencia Digital', techCorpDesc: 'Liderazgo de equipo de 12, lanzamiento de 3 productos, +40% ingresos.', startupDesc: 'Hoja de ruta, investigación, +28% retención.', agencyDesc: 'Entrega de funciones para 5 clientes.', mba: 'MBA', columbia: 'Univ. Columbia', present: 'Presente', now: 'Ahora', productVision: 'Visión de Producto', teamLeadership: 'Liderazgo', gtm: 'Estrategia GTM', dataAnalysis: 'Análisis Datos', productStrategy: 'Estrategia', uxResearch: 'Investigación UX', agile: 'Agile / Scrum', techCorpYears: '2021–Presente', startupYears: '2018–2021', educationYears: '2016–2018', agencyYears: '2016–2018'
  },
  onboarding: {
    title: 'Bienvenido a Constructor de CV con IA ✨',
    subtitle: 'Crea un currículum y carta de presentación profesionales en minutos. Comienza gratis — mejora cuando estés listo.',
    freeLabel: 'Gratis',
    freeFeatures: ['3 Plantillas Estándar', '1 descarga de Carta', '1 intento de Regeneración IA', 'Todos los 12 idiomas'],
    proLabel: 'Pro — $3.99',
    proRecommendedBadge: 'RECOMENDADO',
    proFeatures: ['Cartas Ilimitadas', 'Herramientas de Reescritura IA', '10 Plantillas Premium', 'Analizador de Ofertas + Soporte Prioritario'],
    oneTimePayment: 'Pago único. Sin suscripción.',
    aiFeatureTitle: 'Funciones IA',
    aiFeatureDesc: 'La IA utiliza tus datos únicamente para generar texto y no almacena datos de forma permanente. Por favor revisa todo el texto generado antes de enviar.',
    startFree: 'Comenzar Gratis',
    upgradeToPro: 'Mejorar a Pro',
    secureCheckout: 'Pago seguro. Activación instantánea. Sin suscripción.'
  },
  about: {
    hero: { badge: 'Descripción de Google Play y App Store', title: 'CV Pro AI — Generador de CV Inteligente con IA', description: 'Crea un CV profesional y ganador de empleos en minutos. Empieza gratis — actualiza una vez, usa para siempre.', ageRating: 'Clasificación de edad: 3+', languages: '12 idiomas', privacyFirst: 'Privacidad primero' },
    description: { title: 'Descripción de la aplicación', paragraphs: ['CV Pro AI es un generador de CV y carta de presentación impulsado por IA diseñado para buscadores de empleo en todo el mundo. Crea un CV profesional optimizado para ATS en minutos usando plantillas inteligentes y herramientas de escritura con IA.', 'Disponible en Android (Google Play) y iPhone (Apple App Store).', 'Elige entre 13 plantillas profesionales — 3 gratuitas, 10 premium. El asistente de escritura con IA te ayuda a redactar puntos convincentes, resúmenes profesionales y cartas de presentación personalizadas adaptadas a tu puesto objetivo y empresa.', 'La compatibilidad con 12 idiomas, incluyendo árabe (RTL), japonés, hindi (India) y más, garantiza que puedas crear un CV listo para el trabajo en cualquier mercado. La optimización regional adapta automáticamente tu CV a los estándares del mercado laboral de EE.UU., EU, Balkanes, Oriente Medio, India y Japón.', 'Plan Gratuito: Crea tu CV, descarga 1 carta de presentación generada por IA y usa 1 intento de regeneración — sin cuenta requerida.', 'Plan Pro ($3.99 de una sola vez): Desbloquea cartas de presentación generadas por IA ilimitadas, Herramientas de reescritura de IA, todas las 10 plantillas premium, Analizador de descripciones de puestos y soporte prioritario. Pago único. Sin suscripción. Sin renovación.'] },
    features: { title: 'Características Gratuitas vs. Pro', free: { label: 'Gratuito — $0', items: ['3 Plantillas Estándar (Compatible con ATS)', '1 Descarga de Carta de Presentación Generada por IA', '1 Intento de Regeneración de Carta de Presentación', 'Generación de Resumen Profesional con IA', 'Los 12 idiomas', 'Exportación a DOCX', 'Optimización de CV Regional'], disabledItems: ['Herramientas de Reescritura IA', 'Analizador de Vacantes', '10 Plantillas Premium', 'Cartas de Presentación Ilimitadas'] }, pro: { label: 'Pro — $3.99 de una sola vez', price: 'DE UNA SOLA VEZ $3.99', items: ['10 Plantillas Premium (+ 3 Gratuitas)', 'Cartas de Presentación Ilimitadas Generadas por IA', 'Regeneraciones de Cartas Ilimitadas', 'Generación de Resumen Profesional con IA', 'Herramientas de Reescritura de IA (Acortar, Fortalecer, Profesionalizar)', 'Analizador de Descripciones de Puestos', 'Los 12 idiomas', 'Exportación a DOCX', 'Optimización de CV Regional', 'Soporte Prioritario'], footer: 'Pago único. Sin suscripción. Sin renovación.' } },
    aiDisclosure: { title: 'Cómo se usa la IA en esta aplicación', items: ['La app utiliza servicios de IA de terceros para generar resúmenes de CV, puntos clave y texto de cartas de presentación.', 'Las entradas del usuario (título del puesto, nombre de la empresa, preferencia de tono, experiencia laboral) se procesan solo por servicios de IA para generar texto.', 'Las entradas del usuario no se almacenan de forma permanente por la app o servicios de IA.', 'El contenido generado por IA puede contener inexactitudes. Los usuarios son responsables de revisar todo el contenido antes de enviarlo a empleadores.', 'El botón de IA está claramente etiquetado: "Generar con IA ✨"'] },
    ageAndContent: { title: 'Clasificación de Edad y Descargo de Responsabilidad', ageRating: 'Clasificación de edad: 3+', ageRatingDesc: 'Apropiado para todas las edades. Sin contenido adulto.', disclaimer: 'El contenido generado por IA puede contener inexactitudes, errores gramaticales o problemas específicos del contexto. Los usuarios son completamente responsables de revisar, editar y verificar todo el texto generado por IA antes de enviarlo a empleadores o terceros.', noLiability: 'CV Pro AI proporciona herramientas para asistir con la creación de CV y cartas de presentación. No hacemos garantías sobre resultados de contratación. El uso de contenido generado por IA es a riesgo del usuario.', privacy: 'Los datos del CV se almacenan localmente en el dispositivo del usuario. La información personal no se vende ni se comparte con terceros para fines de marketing.' },
    languages: { title: 'Idiomas Compatibles', list: ['English', 'Deutsch (German)', 'Español (Spanish)', 'Français (French)', 'Italiano (Italian)', 'العربية (Arabic) — RTL', 'Srpski (Serbian)', 'Hrvatski (Croatian)', 'Русский (Russian)', 'Português (Brazil)', 'हिन्दी (Hindi)', '日本語 (Japanese)'] },
    restorePurchase: { title: 'Restaurar Compra', description: 'Si compraste Pro anteriormente y necesitas restaurar tu acceso, toca el botón "Restaurar Compra" en la página de Precios. Tu acceso Pro se restaurará al instante en el dispositivo actual. Si experimentas problemas, contáctanos en help.cvappai@gmail.com.' },
    legal: { title: 'Legal', privacyPolicy: 'Política de privacidad', termsOfService: 'Términos de servicio', contact: 'Contacto: help.cvappai@gmail.com', viewPricing: 'Ver precios y actualizar a Pro' }
  }
};

const fr: TranslationKeys = {
  nav: { home: 'Accueil', cvBuilder: 'Créateur CV', coverLetter: 'Lettre', templates: 'Modèles', pricing: 'Tarifs', about: 'À propos', contact: 'Contact', login: 'Connexion', register: 'Inscription', dashboard: 'Tableau', logout: 'Déconnexion' },
  hero: { title: 'Créez un CV pro en quelques minutes.', professionalResumesAiPowered: 'CV professionnels. Propulsés par l’IA.', subtitle: 'Générateur de CV par IA, modèles premium et optimisation intelligente.', valueDesc: 'Créez un CV professionnel en quelques minutes. Débloquez 10 modèles premium et des outils avancés avec Pro.', cta: 'Créer mon CV', ctaSecondary: 'Voir les modèles', badge: 'Générateur de CV par IA', footerText: 'Paiement unique. Accès à vie. Sans abonnement.' },
  features: { title: 'Tout ce dont vous avez besoin.', subtitle: 'Outils IA puissants pour le marché mondial', badge: 'Inclus', ai: { title: 'Écriture IA Intelligente', desc: 'Améliore la clarté et la structure.' }, multilingual: { title: 'Support Multilingue', desc: 'Créez des CV en 9 langues.' }, templates: { title: 'Modèles Premium', desc: '10 premium + 3 gratuits.' }, ats: { title: 'ATS-Friendly', desc: 'Passe les logiciels de recrutement.' }, region: { title: 'Optimisé par Région', desc: 'Adaptation US, UE, Balkans et Moyen-Orient.' }, export: { title: 'Export Multiformat', desc: 'DOCX ou presse-papiers.' }, analyzer: { title: 'Analyseur d\'Offres', desc: 'Ajustez votre CV avec précision IA. Pro uniquement.' } },
  howItWorks: { title: 'Comment ça marche', step: 'ÉTAPE', step1: { title: 'Ajoutez vos informations', desc: 'Remplissez vos données personnelles, votre expérience professionnelle et votre formation.' }, step2: { title: 'Améliorez votre CV', desc: 'Utilisez des outils intelligents et des suggestions pour rendre votre CV plus solide et professionnel.' }, step3: { title: 'Téléchargez votre CV', desc: 'Exportez votre CV terminé au format DOCX prêt à envoyer aux employeurs.' } },
  whoIsThisFor: { title: 'À qui est destiné ce créateur de CV ?', items: ['Chercheurs d\'emploi', 'Étudiants et diplômés', 'Professionnels en reconversion', 'Toute personne souhaitant un CV moderne et professionnel'] },
  privacyFirst: { title: 'La confidentialité avant tout', desc: 'Vos données de CV restent sur votre appareil. Nous ne stockons, ne vendons ni ne partageons vos informations personnelles.', local: 'Ce créateur de CV fonctionne localement sur votre appareil pour garder vos informations en sécurité.' },
  simplePricing: { title: 'Tarification simple', desc: 'Sans abonnement. Achat unique pour débloquer tous les modèles Pro et les outils avancés.' },
    pricing: { 
      title: 'Tarifs simples.', 
      subtitle: 'Sans abonnement. Sans frais mensuels. Payez une fois.', 
      oneTime: '3,99 $ une fois', 
      getStarted: 'Commencer',
      footerText: 'Paiement unique · Accès à vie · Sans abonnement',
          free: { name: 'Gratuit', price: '0 $', features: ['3 Modèle Standard', '1 Téléchargement CV', '1 Lettre de motivation', 'Toutes langues'], cta: 'Démarrer Gratuit', desc: 'Commencez gratuitement.' }, 
          pro: { name: 'Pro', price: '3,99 $', features: ['10 Modèles Premium', 'Téléchargements CV illimités', 'Lettres de motivation IA illimitées', 'Analyseur d\'offres', 'Améliorations IA', 'Toutes langues'], cta: 'Passer à Pro', desc: 'Payez une fois. Utilisez toujours.', badge: 'Pro — Accès à vie', footer: 'Paiement sécurisé. Activation instantanée.', noSubscription: 'Sans abonnement. Sans renouvellement.' },
      tableTitle: 'Comparaison des fonctionnalités',
      tableHeaderFeature: 'Fonctionnalité',
      tableHeaderFree: 'Gratuit',
      tableHeaderPro: 'Pro',
      tableRowCV: 'Téléchargements de CV',
      tableRowCoverLetter: 'Téléchargements de lettres',
      tableRowTemplates: 'Modèles',
      tableRowAI: 'Génération de résumé par IA',
      tableRowRewrite: 'Outils de réécriture par IA',
      tableRowAnalyzer: 'Analyseur d\'offres d\'emploi',
      tableRowLanguages: 'Toutes les langues',
      tableRowSupport: 'Assistance prioritaire',
        unlimited: 'Illimité',
        threeStandard: '3 standards',
        proTemplatesCount: '10 Premium + 3 Gratuits',
        oneCount: '1',
        popularBadge: 'Le plus populaire',
        bestValueBadge: 'Meilleure offre',
        coverLetterFreeValue: '1 Téléchargement de lettre de motivation',
        coverLetterProValue: 'Lettres de motivation IA illimitées',
        restoreTitle: 'Déjà acheté Pro ?',
        restoreDesc: 'Restaurez votre achat précédent pour retrouver l\'accès Pro sur cet appareil.',
        restoreButton: 'Restaurer l\'achat',
        proActive: 'Pro Actif',
        restoringText: 'Restauration...',
        needHelp: 'Besoin d\'aide ?',
        fairUse: 'Des limites d\'utilisation raisonnable peuvent s\'appliquer afin de prévenir les abus et garantir la fiabilité du service.'
      },

  faq: { title: 'Questions Fréquentes', items: [
    { q: 'Qu\'est-ce qui est inclus dans le plan gratuit ?', a: 'Le plan gratuit vous permet de créer 1 CV et de générer 1 lettre de motivation. Vous pouvez également utiliser des outils IA avec un accès limité pour améliorer votre contenu.' },
    { q: 'Combien de lettres de motivation puis-je générer gratuitement ?', a: 'Vous pouvez générer 1 lettre de motivation gratuitement, avec 1 tentative de régénération incluse.' },
    { q: 'Que se passe-t-il après avoir utilisé ma lettre gratuite ?', a: 'Après avoir utilisé votre lettre gratuite, vous pouvez passer à Pro pour des lettres illimitées et un accès complet aux fonctionnalités IA.' },
    { q: 'Qu\'est-ce que j\'obtiens avec Pro ?', a: 'Pro vous donne des lettres de motivation illimitées, un accès complet à tous les outils IA, des modèles premium et des fonctionnalités avancées d\'optimisation de CV.' },
    { q: 'Les fonctionnalités IA sont-elles gratuites ?', a: 'Certaines fonctionnalités IA sont disponibles gratuitement avec une utilisation limitée. Passez à Pro pour un accès illimité.' },
    { q: 'Puis-je utiliser l\'application en différentes langues ?', a: 'Oui, l\'application prend en charge plusieurs langues pour que vous puissiez créer votre CV et votre lettre de motivation dans votre langue préférée.' },
    { q: 'Les modèles sont-ils ATS-friendly ?', a: 'Absolument. Tous nos modèles sont conçus pour passer les filtres ATS utilisés par les principaux employeurs dans le monde.' },
    { q: 'Comment fonctionne l\'IA ? Mes données sont-elles stockées ?', a: "L'IA utilise uniquement vos données (titre du poste, entreprise, ton, etc.) pour générer du texte. Vos données personnelles ne sont pas stockées de manière permanente. L'application utilise des services IA tiers pour les requêtes de génération." },
    { q: 'Le contenu généré par IA est-il toujours précis ?', a: "Le contenu généré par IA peut contenir des inexactitudes. Veuillez vérifier attentivement tous les textes générés avant de les soumettre à des employeurs. Les utilisateurs sont responsables du contenu final." }
  ] },
  cv: { title: 'Créateur CV', personal: 'Infos Personnelles', experience: 'Expérience', education: 'Éducation', skills: 'Compétences', certifications: 'Certifications', languages: 'Langues', summary: 'Résumé Pro', generate: 'Générer avec IA', rewrite: 'Réécrire', translate: 'Traduire', analyzeJob: 'Analyser l\'offre', download: 'Télécharger', downloadCv: 'Télécharger le CV', downloadPdf: 'PDF', downloadDocx: 'DOCX', downloadPdfDesc: 'Recommandé · Prêt à envoyer', downloadDocxDesc: 'Version modifiable', downloadNote: 'Le PDF conserve le design sélectionné. Le DOCX est modifiable et peut présenter de légères différences de mise en page selon Word, Google Docs ou les visionneuses mobiles.', pdfExportFailed: 'Échec de l\'export PDF. Veuillez réessayer.', wordExportFailed: 'Échec de l\'export Word. Veuillez réessayer.', preview: 'Aperçu', selectTemplate: 'Choisir Modèle', jobTitle: 'Poste', fullName: 'Nom Complet', email: 'Email', phone: 'Téléphone', address: 'Adresse', fathersName: 'Nom du père', nationality: 'Nationalité', dateOfBirth: 'Date de naissance', company: 'Entreprise', position: 'Poste', startDate: 'Début', endDate: 'Fin', present: 'Présent', description: 'Description', degree: 'Diplôme', school: 'École / Université', addMore: 'Ajouter', remove: 'Supprimer', region: 'Région Cible', ready: 'Prêt pour votre CV ?', readySubtitle: 'Gratuit pour commencer. Pro quand vous voulez.', edit: 'Modifier', copied: 'Copié !', copy: 'Copier', jobTitlePlaceholder: 'ex. Ingénieur Logiciel', fullNamePlaceholder: 'Jean Dupont', aiBullets: 'Amélioration IA', skillPlaceholder: 'Tapez une compétence et Entrée', certPlaceholder: 'ex. Certifié AWS', langPlaceholder: 'Langue', levelPlaceholder: 'Niveau',       summaryPlaceholder: 'Rédigez ou générez votre résumé...',
      jobDescPlaceholder: 'Collez la description du poste ici...',
      short: 'Plus court',
 strong: 'Plus fort', professional: 'Professionnel', keywordsFound: 'Mots-clés trouvés', suggestions: 'Suggestions', suggestedSkills: 'Compétences suggérées', skillCategories: { technical: 'Compétences techniques', soft: 'Compétences douces' }, aiRecommend: 'IA Recommande', recommendedToast: 'Recommandé', recommendedForYou: '⭐ Recommandé pour vous', bestResultsTemplate: 'Meilleurs résultats avec ce modèle', optimizedForProfile: 'Optimisé pour votre profil', unlockWithPro: 'Débloquez ce modèle avec Pro', saveRequired: 'Connectez-vous pour enregistrer.', saved: 'CV enregistré !', draftSaved: 'Draft saved', genSuccess: 'Résumé généré !', bulletsSuccess: 'Amélioration IA appliquée !', rewriteSuccess: 'Réécrit', levels: { native: 'Natif', fluent: 'Courant', advanced: 'Avancé', intermediate: 'Intermédiaire', basic: 'Basique' }, regions: { us: 'USA', eu: 'UE', balkan: 'Balkans', middleEast: 'Moyen-Orient', india: 'Inde', japan: 'Japon' }, gender: 'Genre', genderMale: 'Masculin', genderFemale: 'Féminin', genderOther: 'Autre', coverLetterSection: 'Lettre de motivation', photo: { title: 'Photo de profil', optional: '(Optionnel)', shown: 'Affichée dans le CV', hidden: 'Cachée dans le CV', shownDesc: 'Affichée par défaut pour votre région', hiddenDesc: 'La photo est cachée.', change: 'Changer', upload: 'Télécharger', recrop: 'Recadrer', remove: 'Supprimer', hint: 'JPG ou PNG, max 5Mo.', aiEnhance: 'Amélioration IA', aiEnhancing: 'En cours...', applied: 'Appliqué', upgrade: 'Passer à Pro', features: ['Flou arrière-plan', 'Luminosité & contraste', 'Teint naturel', 'Centrage automatique'], cropTitle: 'Recadrer la photo', cropHint: 'Glisser pour repositionner', apply: 'Appliquer', usRegion: 'Cachée par défaut (région US)', otherRegion: 'Affichée par défaut pour votre région', errorFormat: 'Téléchargez une image JPG ou PNG.' }, industryLabel: 'Secteur', levelLabel: 'Niveau', industryPlaceholder: 'Choisir le secteur', industries: { tech: 'IT / Développement logiciel', data_ai: 'Données / IA / Machine Learning', cybersecurity: 'Cybersécurité', sales_retail: 'Ventes (Commerce de détail)', sales_b2b: 'Ventes B2B', marketing: 'Marketing / Marketing Digital', sales: 'Ventes', finance: 'Finance / Comptabilité', banking_fintech: 'Banque / FinTech', healthcare: 'Santé / Médical', pharmacy: 'Pharmacie', education: 'Éducation / Enseignement', human_resources: 'Ressources Humaines', customer_service: 'Support Client / Centre d\'appels', logistics: 'Logistique / Supply Chain', operations: 'Opérations / Production', executive: 'Management / Leadership', project_management: 'Gestion de Projet', design: 'Design / UX / UI', engineering: 'Ingénierie (Mécanique / Électrique)', construction: 'Construction / Architecture', hospitality: 'Hôtellerie / Tourisme', legal: 'Droit', administration: 'Administration / Bureau', general: 'Général' }, bulletLevels: { entry: 'Débutant', mid: 'Intermédiaire', senior: 'Senior', lead: 'Directeur / Lead' }, aiExperienceIntro: '✨ Améliorez vos expériences avec l\'IA', aiExperienceIntroSub: 'Rédigez des descriptions plus percutantes et professionnelles en quelques secondes.', aiSummaryIntro: '✨ Créez un résumé professionnel convaincant', aiSummaryIntroSub: 'Générez ou améliorez votre résumé pour vous démarquer auprès des recruteurs.', generateSubtext: 'Résumé percutant en quelques secondes', shorterSubtext: 'Texte plus concis et lisible', strongerSubtext: 'Valorisez vos résultats et votre impact', professionalSubtext: 'Améliorez le ton et la formulation', aiBulletsSubtext: 'Expérience en points forts percutants', analyzeJobSubtext: 'Adaptez votre CV aux exigences du poste', analyzeJobProOnly: 'L\'analyse de description de poste est disponible uniquement en Pro.', aiRecommendSubtext: 'Trouvez le meilleur modèle pour vous', proHint: 'Recommandé', proHintPopular: 'Le plus populaire', jobAnalysis: { title: 'Votre analyse CV', subtitle: 'Comment votre CV correspond à ce poste', matchScore: 'Correspondance', matchGood: 'Bonne correspondance — mais améliorable', matchAverage: 'Correspondance moyenne — plusieurs lacunes', matchWeak: 'Faible correspondance — améliorations importantes nécessaires', keyInsights: 'Points clés', insight1: 'Expérience pertinente trouvée', insight2: 'Compétences clés manquantes', insight3: 'Descriptions d\'impact insuffisantes', importantKeywords: 'Mots-clés importants', unlockFull: 'Déverrouillez la liste complète avec Pro', suggestedImprovements: 'Améliorations suggérées', improve1: 'Ajoutez des résultats mesurables', improve2: 'Utilisez des verbes d\'action plus forts', improve3: 'Incluez les compétences manquantes', proCardTitle: 'Améliorez votre CV instantanément', proCardText: 'Débloquez l\'analyse complète, tous les mots-clés et les améliorations IA', proCardCta: 'Passer à Pro', proCardNote: 'Paiement unique', analyzing: 'Analyse en cours...' } },
  coverLetter: { title: 'Créateur de Lettre', firstName: 'Prénom', lastName: 'Nom', gender: 'Genre', genderMale: 'Masculin', genderFemale: 'Féminin', genderPreferNot: 'Préfère ne pas dire', identitySection: 'Vos informations', jobTitle: 'Poste', companyName: 'Entreprise',tone: 'Ton', tones: { formal: 'Formel', confident: 'Confiant', friendly: 'Amical' }, generate: 'Générer Lettre', generating: 'Génération de votre lettre de motivation…', regenerate: 'Régénérer', regenerating: 'Régénération…', regenerateSubtitle: 'Obtenez une nouvelle variation', edit: 'Modifier', companyPlaceholder: 'ex. Google', firstNamePlaceholder: 'Jean', lastNamePlaceholder: 'Dupont', genSuccess: 'Lettre générée !', saved: 'Sauvegardé !', draftSaved: 'Draft saved', placeholder: 'Votre lettre apparaîtra ici...', preview: 'Aperçu', filename: 'Lettre de Motivation',regenLeft: 'restant(s)', regenExhausted: 'Vous avez atteint le nombre maximum de régénérations pour cette lettre.', paywallMessage: 'La génération de lettres au-delà de la limite gratuite est une fonction Pro. Passez à Pro pour générer des lettres de motivation IA illimitées.', downloadCl: 'Télécharger la lettre de motivation', generateSubtitle: 'Adaptée au poste & à l\'entreprise', aiDisclaimer: 'Le contenu généré par l\'IA peut contenir des inexactitudes. Veuillez vérifier tout le texte généré par l\'IA avant de le soumettre.' },
  auth: { login: 'Connexion', register: 'Créer un compte', email: 'Email', password: 'Mot de passe', confirmPassword: 'Confirmer', name: 'Nom', forgotPassword: 'Oublié ?', noAccount: 'Pas de compte ?', hasAccount: 'Déjà inscrit ?', invalidCredentials: 'Identifiants invalides.', emailTaken: 'Email déjà enregistré.' },
  dashboard: { title: 'Tableau de bord', myCVs: 'Mes CV', myCoverLetters: 'Mes Lettres', createNew: 'Nouveau', edit: 'Modifier', delete: 'Supprimer', lastEdited: 'Modifié', upgrade: 'Passer à Pro', plan: 'Plan Actuel', welcome: 'Bienvenue', noCVs: 'Pas encore de CV.', noLetters: 'Pas encore de lettres.', untitled: 'Sans titre', cvDeleted: 'CV supprimé', letterDeleted: 'Lettre supprimée', loginRequired: 'Connectez-vous.', upgradeBanner: '1 CV et 1 lettre de motivation inclus.' },
  common: { save: 'Sauver', cancel: 'Annuler', back: 'Retour', next: 'Suivant', loading: 'Chargement...', proAccessRequired: 'Accès Pro requis. Passez à Pro pour continuer.', proAuthorizationUnavailable: 'L’autorisation Pro se synchronise. Réessayez dans un instant.', error: 'Erreur', success: 'Succès !', darkMode: 'Mode Sombre', lightMode: 'Mode Clair', language: 'Langue', legal: 'Légal', previewBadge: 'Modèle Gratuit', slide: 'Diapositive', appName: 'CV Pro AI', docx: 'DOCX' },
  footer: { rights: '© 2026 CV Pro AI. Tous droits réservés.', privacy: 'Confidentialité', terms: 'Conditions', backToHome: 'Accueil' },
  templates: {
    title: 'Modèles', subtitle: '13 modèles pros.', showcase: 'Galerie', showcaseSubtitle: 'Conçus pour les standards actuels.', freeCount: 'Gratuit — 3 Modèles', proCount: 'Pro — 10 Premium', proBadge: 'PRO', unlockPro: 'Débloquez tout pour 3,99 $', browseAll: 'Voir tout',
    categories: { ats: 'ATS-Friendly', creative: 'Créatif', executive: 'Exécutif', modern: 'Moderne', japanese: 'Japonais' },
    items: {
      'modern-minimal': { name: 'Minimaliste Moderne', description: 'Design épuré et optimisé ATS — remarqué par les recruteurs dès le premier regard.', category: 'ATS-Friendly' },
      'clean-simple': { name: 'Propre et Simple', description: 'Clair et efficace — idéal pour une première candidature réussie.', category: 'ATS-Friendly' },
      'professional-classic': { name: 'Classique Pro', description: 'Intemporel et soigné — la référence des recruteurs dans tous les secteurs.', category: 'ATS-Friendly' },
      'creative-bold': { name: 'Créatif Audacieux', description: 'Démarquez-vous d\'emblée avec un design percutant pour les métiers créatifs.', category: 'Créatif' },
      'creative-artistic': { name: 'Artistique', description: 'Exprimez votre personnalité avec un style moderne qui marque les esprits.', category: 'Créatif' },
      'elegant-formal': { name: 'Élégant Formel', description: 'Raffiné et imposant — parfait pour les postes de direction exigeants.', category: 'Exécutif' },
      'ats-standard': { name: 'ATS Standard', description: 'Maximisez vos chances de passer chaque filtre de sélection automatique.', category: 'ATS-Friendly' },
      'executive-premium': { name: 'Exécutif Premium', description: 'Design haut de gamme pour les dirigeants qui ne laissent rien au hasard.', category: 'Exécutif' },
        'nordic-clean': { name: 'Nordique Épuré', description: 'Sobre et concentré — votre parcours s\'exprime sans distraction.', category: 'Moderne' },
        'tech-sidebar': { name: 'Tech Sidebar', description: 'Structure deux colonnes qui met en valeur compétences et expériences.', category: 'Moderne' },
        'corporate-navy': { name: 'Bleu Entreprise', description: 'Autorité et assurance — une présence forte dès le premier coup d\'œil.', category: 'Exécutif' },
        'modern-minimal-executive': { name: 'Exécutif Minimaliste Moderne', description: 'Présence managériale moderne avec barre latérale structurée.', category: 'Exécutif' },
        'contemporary-bold': { name: 'Contemporary Bold', description: 'Design affirmé pour les profils tech et startups qui veulent marquer les esprits.', category: 'Moderne' },
        'rirekisho': { name: 'Rirekisho', description: 'Le format CV japonais authentique — conforme aux standards locaux de recrutement.', category: 'Japonais' }
      }
    },
  legal: {
    privacy: {
      title: 'Politique de Confidentialité', effectiveDate: 'En vigueur : Avril 2026',
      sections: [
        { title: '1. Introduction', content: 'CV Pro AI respecte votre vie privée et s\'engage à protéger vos données personnelles. Cette Politique de Confidentialité explique comment nous collectons, utilisons et protégeons vos informations lorsque vous utilisez notre outil de création de CV et de lettre de motivation avec IA.' },
        { title: '2. Données collectées', content: 'Lors de l\'utilisation de l\'application, nous pouvons collecter les informations suivantes :', items: ['Nom (si fourni)', 'Adresse e-mail (si fournie)', 'Contenu du CV que vous saisissez', 'Données d\'utilisation de base et analyses'] },
        { title: '3. Utilisation de vos données', content: 'Vos données sont utilisées exclusivement aux fins suivantes :', items: ['Générer des CV et lettres de motivation', 'Améliorer les fonctionnalités IA et la qualité de l\'application', 'Fournir les fonctionnalités essentielles de l\'application'] },
        { title: '4. Traitement par IA', content: 'Vos saisies peuvent être transmises de manière sécurisée à des fournisseurs IA tiers pour générer des résumés de CV, des puces, des lettres de motivation et d\'autres contenus propulsés par IA. Les données sont traitées uniquement dans le but de produire le résultat demandé. CV Pro AI n\'utilise pas votre contenu à des fins publicitaires.' },
        { title: '5. Partage des données', content: 'Nous respectons votre vie privée et traitons vos données de manière responsable :', items: ['Nous ne vendons PAS les données utilisateur à des tiers', 'Les données ne sont pas partagées avec des tiers, sauf pour les services essentiels au fonctionnement de l\'application'] },
        { title: '6. Stockage et sécurité', content: 'Vos données de CV sont stockées localement sur votre appareil. L\'application utilise l\'autosave pour conserver vos brouillons localement sur votre appareil. Certains contenus peuvent être transmis de manière sécurisée lorsque vous utilisez des fonctionnalités IA nécessitant la génération ou l\'amélioration de contenu. Nous appliquons des mesures de sécurité standard incluant le chiffrement TLS. Des mesures raisonnables sont prises pour protéger toutes les informations utilisateur.', items: ['Le contenu généré par IA et les données de brouillon sont conservés uniquement lorsque nécessaire pour fournir la fonctionnalité demandée. Les brouillons stockés localement restent sous le contrôle de l\'utilisateur et peuvent être supprimés à tout moment en effaçant le brouillon ou en réinitialisant l\'application.'] },
        { title: '7. Vos droits et protection RGPD', content: 'Vous avez un contrôle total sur vos données personnelles. Si vous vous trouvez dans l\'Espace Économique Européen (EEE), vous bénéficiez de droits supplémentaires en vertu du Règlement Général sur la Protection des Données (RGPD) :', items: ['Demander l\'accès à vos données personnelles', 'Demander la suppression de vos données (droit à l\'effacement)', 'Demander la correction de données inexactes', 'Demander la limitation du traitement (utilisateurs de l\'EEE)', 'Portabilité des données — recevez vos données dans un format structuré et lisible par machine (utilisateurs de l\'EEE)', 'Retirer votre consentement à tout moment lorsque le traitement est fondé sur le consentement'] },
        { title: '8. Cookies et analyses', content: 'L\'application peut utiliser des outils d\'analyse de base pour comprendre les schémas d\'utilisation et améliorer les performances. Aucune donnée personnelle n\'est partagée avec des réseaux publicitaires.' },
        { title: '9. Paiements et achats', content: 'Les achats du plan Pro sont traités en toute sécurité par des processeurs de paiement tiers :', items: ['Les paiements sont gérés par Apple App Store, Google Play Store et RevenueCat', 'CV Pro AI ne collecte, ne traite ni ne stocke les informations de votre carte de paiement', 'Toutes les données de paiement sont gérées directement par la boutique d\'applications et le processeur de paiement concernés selon leurs propres politiques de confidentialité et de sécurité', 'La validation des achats et la gestion des droits peuvent être assurées via RevenueCat ou des fournisseurs d\'infrastructure de paiement similaires.'] },
        { title: '10. Protection des mineurs', content: 'Cette application n\'est pas destinée aux utilisateurs de moins de 13 ans. Nous ne collectons pas sciemment de données personnelles d\'enfants de moins de 13 ans. Si vous pensez qu\'un enfant nous a fourni des données, contactez-nous immédiatement.' },
        { title: '11. Aucune garantie', content: 'CV Pro AI ne garantit pas l\'emploi, les entretiens, les offres d\'emploi ou les résultats de candidatures. Les utilisateurs restent responsables de la révision, de l\'édition et de la vérification de tout contenu généré avant de le soumettre à des employeurs ou à des tiers.' },
        { title: '12. Contact', content: 'Pour toute question ou demande relative à cette Politique de Confidentialité, contactez-nous à help.cvappai@gmail.com.' }
      ]
    },
    terms: {
      title: 'Conditions d\'Utilisation', effectiveDate: 'En vigueur : Avril 2026',
      sections: [
        { title: '1. Introduction', content: 'CV Pro AI est un outil de création de CV et de lettres de motivation avec assistance IA. En utilisant l\'application, vous acceptez ces Conditions d\'Utilisation.' },
        { title: '2. Description du service', content: 'CV Pro AI est un créateur de CV et de lettre de motivation propulsé par IA. L\'application propose un plan gratuit et un plan Pro. Le plan gratuit inclut 1 téléchargement de lettre et 1 régénération IA. Le plan Pro (paiement unique de 3,99 $) offre des téléchargements illimités, une génération IA illimitée, 10 modèles premium, des outils de réécriture IA et l\'analyseur d\'offres d\'emploi.' },
        { title: '3. Avertissement IA', content: 'Le contenu généré par IA est fourni uniquement comme assistance et peut nécessiter une révision de l\'utilisateur. Il peut contenir des inexactitudes ou des variations stylistiques. Vous êtes seul responsable de la vérification et de la correction de tous les textes générés avant soumission.' },
        { title: '4. Responsabilités de l\'utilisateur', content: 'Vous êtes responsable de l\'exactitude des informations que vous saisissez dans l\'application. Assurez-vous que toutes les données sont véridiques et à jour. La responsabilité finale de vos documents de candidature vous appartient.' },
        { title: '5. Utilisation acceptable', content: 'Vous vous engagez à ne pas utiliser abusivement l\'application, à ne pas télécharger de contenu illégal et à ne pas l\'utiliser d\'une manière qui enfreint les lois applicables. Tout abus peut entraîner une restriction d\'accès.' },
        { title: '6. Paiements', content: 'Le plan Pro est disponible pour un paiement unique de 3,99 $, offrant un accès à vie sans abonnement ni renouvellement automatique. Si vous avez déjà acheté Pro, utilisez le bouton « Restaurer l\'achat » sur la page Tarifs.' },
        { title: '7. Aucune garantie', content: 'CV Pro AI fournit des outils pour aider à la création de CV. Nous ne garantissons pas que l\'utilisation de l\'application résultera en des offres d\'emploi, entretiens ou embauche. Les résultats dépendent de nombreux facteurs hors de notre contrôle.' },
        { title: '8. Limitation de responsabilité', content: 'L\'application est fournie « telle quelle » sans garantie d\'aucune sorte. Dans la mesure permise par la loi, CV Pro AI ne saurait être tenu responsable des dommages indirects ou consécutifs résultant de l\'utilisation de l\'application.' },
        { title: '9. Résiliation', content: 'Nous nous réservons le droit de restreindre ou de résilier l\'accès à l\'application en cas de violation de ces Conditions, notamment pour abus, activité illégale ou mauvaise utilisation du service.' },
        { title: '10. Modifications des Conditions', content: 'Nous pouvons mettre à jour ces Conditions de temps en temps. L\'utilisation continue de l\'application après la publication des modifications vaut acceptation des Conditions mises à jour.' },
        { title: '11. Contact', content: 'Pour le support ou des questions sur ces Conditions, contactez-nous à help.cvappai@gmail.com.' }
      ]
    }
  },
    comparison: {
      title: 'Voir la différence', subtitle: 'Comparaison Gratuit vs Pro.', freePlan: 'Mise en page de base', proPlan: 'Mise en page professionnelle', good: 'Bien', hireReady: 'Prêt à l\'emploi', proBadge: 'Pro', freeFeatures: ['Design de base', 'Hiérarchie minimale', 'Espacement standard'], proFeatures: ['Typographie premium', 'Standard international', 'Structure raffinée'], summary: 'Résumé', experience: 'Expérience', expertise: 'Expertise', languages: 'Langues', chips: ['Stratégie SEO', 'Analytique', 'Contenu', 'Email'], persuasiveText: 'Les mises en page professionnelles aident votre CV à se démarquer sur des marchés concurrentiels.'
    },
  previews: {
    name: 'Alexandre J.', role: 'Senior Product Manager', email: 'alex@email.com', phone: '+33 1 23 45 67 89', location: 'Paris / NY', experience: 'Expérience', education: 'Éducation', skills: 'Compétences', contact: 'Contact', headOfProduct: 'Directeur Produit', productManager: 'Product Manager', jrPm: 'Jr. PM', techCorp: 'TechCorp', startupXY: 'StartupXY', digitalAgency: 'Agence Digitale', techCorpDesc: 'Équipe de 12, 3 lancements, +40% CA.', startupDesc: 'Roadmap, recherche, +28% rétention.', agencyDesc: 'Livraison pour 5 clients.', mba: 'MBA', columbia: 'Univ. Columbia', present: 'Présent', now: 'Maintenant', productVision: 'Vision Produit', teamLeadership: 'Leadership', gtm: 'Go-to-Market', dataAnalysis: 'Analyse de données', productStrategy: 'Stratégie', uxResearch: 'Recherche UX', agile: 'Agile / Scrum', techCorpYears: '2021–Présent', startupYears: '2018–2021', educationYears: '2016–2018', agencyYears: '2016–2018'
  },
  onboarding: {
    title: 'Bienvenue au Constructeur de CV avec IA ✨',
    subtitle: 'Créez un CV et une lettre de motivation professionnels en quelques minutes. Commencez gratuitement — passez à la version payante quand vous le souhaitez.',
    freeLabel: 'Gratuit',
    freeFeatures: ['3 Modèles Standard', '1 téléchargement de Lettre', '1 tentative de Régénération IA', 'Tous les 12 langues'],
    proLabel: 'Pro — 3,99 €',
    proRecommendedBadge: 'RECOMMANDÉ',
    proFeatures: ['Lettres Illimitées', 'Outils de Réécriture IA', '10 Modèles Premium', 'Analyseur d\'Offres + Support Prioritaire'],
    oneTimePayment: 'Paiement unique. Pas d\'abonnement.',
    aiFeatureTitle: 'Fonctionnalités IA',
    aiFeatureDesc: 'L\'IA utilise uniquement vos données pour générer du texte et ne stocke pas les données de façon permanente. Veuillez vérifier tout texte généré avant de l\'envoyer.',
    startFree: 'Commencer Gratuitement',
    upgradeToPro: 'Passer à Pro',
    secureCheckout: 'Paiement sécurisé. Activation instantanée. Pas d\'abonnement.'
  },
  about: {
    hero: { badge: 'Description Google Play & App Store', title: 'CV Pro AI — Générateur de CV Intelligent avec IA', description: 'Créez un CV professionnel et gagnant en quelques minutes. Commencez gratuitement — améliorez une fois, utilisez toujours.', ageRating: 'Classification d\'âge: 3+', languages: '12 langues', privacyFirst: 'Confidentialité d\'abord' },
    description: { title: 'Description de l\'application', paragraphs: ['CV Pro AI est un générateur de CV et de lettre de motivation alimenté par IA conçu pour les demandeurs d\'emploi mondiaux. Créez un CV professionnel optimisé pour l\'ATS en quelques minutes en utilisant des modèles intelligents et des outils d\'écriture avec IA.', 'Disponible sur Android (Google Play) et iPhone (Apple App Store).', 'Choisissez parmi 13 modèles professionnels — 3 gratuits, 10 premium. L\'assistant d\'écriture avec IA vous aide à rédiger des points percutants, des résumés professionnels et des lettres de motivation personnalisées adaptées à votre emploi cible et votre entreprise.', 'Le support de 12 langues, incluant l\'arabe (RTL), le japonais, l\'hindi (Inde) et plus, garantit que vous pouvez créer un CV prêt pour l\'emploi pour n\'importe quel marché. L\'optimisation régionale adapte automatiquement votre CV aux normes du marché du travail des États-Unis, de l\'UE, des Balkans, du Moyen-Orient, de l\'Inde et du Japon.', 'Plan Gratuit: Créez votre CV, téléchargez 1 lettre de motivation générée par IA et utilisez 1 tentative de régénération — aucun compte requis.', 'Plan Pro ($3,99 une seule fois): Débloquez les lettres de motivation générées par IA illimitées, les Outils de Réécriture IA, tous les 10 modèles premium, l\'Analyseur de Description d\'Emploi et le support prioritaire. Paiement unique. Pas d\'abonnement. Aucun renouvellement.'] },
    features: { title: 'Caractéristiques Gratuit vs. Pro', free: { label: 'Gratuit — 0 €', items: ['3 Modèles Standard (Compatible avec ATS)', '1 Téléchargement de Lettre de Motivation Générée par IA', '1 Tentative de Régénération de Lettre de Motivation', 'Génération de Résumé Professionnel avec IA', 'Les 12 langues', 'Export DOCX', 'Optimisation de CV Régionale'], disabledItems: ['Outils de Réécriture IA', 'Analyseur d\'Offres d\'Emploi', '10 Modèles Premium', 'Lettres de Motivation Illimitées'] }, pro: { label: 'Pro — 3,99 € une seule fois', price: 'UNE SEULE FOIS 3,99 €', items: ['10 Modèles Premium (+ 3 Gratuits)', 'Lettres de Motivation Illimitées Générées par IA', 'Régénérations de Lettres de Motivation Illimitées', 'Génération de Résumé Professionnel avec IA', 'Outils de Réécriture IA (Raccourcir, Renforcer, Professionnaliser)', 'Analyseur de Description d\'Emploi', 'Les 12 langues', 'Export DOCX', 'Optimisation de CV Régionale', 'Support Prioritaire'], footer: 'Paiement unique. Pas d\'abonnement. Aucun renouvellement.' } },
    aiDisclosure: { title: 'Comment l\'IA est utilisée dans cette application', items: ['L\'application utilise des services d\'IA tiers pour générer des résumés de CV, des points clés et du texte de lettres de motivation.', 'Les entrées de l\'utilisateur (titre du poste, nom de l\'entreprise, préférence de ton, expérience professionnelle) sont traitées par les services d\'IA uniquement pour générer du texte.', 'Les entrées de l\'utilisateur ne sont pas stockées de façon permanente par l\'application ou les services d\'IA.', 'Le contenu généré par IA peut contenir des inexactitudes. Les utilisateurs sont responsables de vérifier tout le contenu avant de le soumettre aux employeurs.', 'Le bouton IA est clairement identifié: "Générer avec IA ✨"'] },
    ageAndContent: { title: 'Classification d\'Âge et Avertissement de Contenu', ageRating: 'Classification d\'âge: 3+', ageRatingDesc: 'Convient pour tous les âges. Pas de contenu adulte.', disclaimer: 'Le contenu généré par IA peut contenir des inexactitudes, des erreurs grammaticales ou des problèmes spécifiques au contexte. Les utilisateurs sont entièrement responsables de vérifier, modifier et vérifier tout le texte généré par IA avant de le soumettre aux employeurs ou à des tiers.', noLiability: 'CV Pro AI fournit des outils pour assister à la création de CV et de lettres de motivation. Nous ne faisons aucune garantie sur les résultats de l\'embauche. L\'utilisation du contenu généré par IA est à la charge de l\'utilisateur.', privacy: 'Les données de CV sont stockées localement sur l\'appareil de l\'utilisateur. Les informations personnelles ne sont pas vendues ou partagées avec des tiers à des fins de marketing.' },
    languages: { title: 'Langues Supportées', list: ['English', 'Deutsch (German)', 'Español (Spanish)', 'Français (French)', 'Italiano (Italian)', 'العربية (Arabic) — RTL', 'Srpski (Serbian)', 'Hrvatski (Croatian)', 'Русский (Russian)', 'Português (Brazil)', 'हिन्दी (Hindi)', '日本語 (Japanese)'] },
    restorePurchase: { title: 'Restaurer l\'achat', description: 'Si vous avez acheté Pro auparavant et souhaitez restaurer votre accès, appuyez sur le bouton "Restaurer l\'achat" sur la page Tarifs. Votre accès Pro sera restauré instantanément sur l\'appareil actuel. Si vous rencontrez des problèmes, contactez-nous à help.cvappai@gmail.com.' },
    legal: { title: 'Juridique', privacyPolicy: 'Politique de Confidentialité', termsOfService: 'Conditions d\'Utilisation', contact: 'Contact: help.cvappai@gmail.com', viewPricing: 'Voir les Tarifs et Passer à Pro' }
  }
};

const it: TranslationKeys = {
  nav: { home: 'Home', cvBuilder: 'Crea CV', coverLetter: 'Lettera', templates: 'Modelli', pricing: 'Prezzi', about: 'Chi Siamo', contact: 'Contatti', login: 'Accedi', register: 'Registrati', dashboard: 'Dashboard', logout: 'Esci' },
  hero: { title: 'Crea un CV professionale in pochi minuti.', professionalResumesAiPowered: 'Curriculum professionali. Potenziati dall’IA.', subtitle: 'Builder di CV con IA, modelli premium e ottimizzazione intelligente.', valueDesc: 'Crea un curriculum professionale in pochi minuti. Sblocca 10 modelli premium e strumenti avanzati con Pro.', cta: 'Crea il mio CV', ctaSecondary: 'Vedi Modelli', badge: 'Builder di CV con IA', footerText: 'Pagamento unico. Accesso a vita. Nessun abbonamento.' },
  features: { title: 'Tutto ciò di cui hai bisogno.', subtitle: 'Potenti strumenti IA per il mercato globale', badge: 'Incluso', ai: { title: 'Scrittura IA Intelligente', desc: 'Migliora chiarezza e struttura.' }, multilingual: { title: 'Supporto Multilingue', desc: 'Crea CV in 9 lingue.' }, templates: { title: 'Modelli Premium', desc: '10 premium + 3 gratis.' }, ats: { title: 'ATS-Friendly', desc: 'Supera i software di selezione.' }, region: { title: 'Ottimizzato per Regione', desc: 'Adattamento US, UE, Balcani e Medio Oriente.' }, export: { title: 'Esportazione Multiformato', desc: 'DOCX o appunti.' }, analyzer: { title: 'Analizzatore Offerte', desc: 'Adatta il CV all\'offerta con precisione IA. Solo Pro.' } },
  howItWorks: { title: 'Come funziona', step: 'PASSO', step1: { title: 'Aggiungi le tue informazioni', desc: 'Compila i tuoi dati personali, la tua esperienza lavorativa e la tua formazione.' }, step2: { title: 'Migliora il tuo CV', desc: 'Usa strumenti intelligenti e suggerimenti per rendere il tuo CV più solido e professionale.' }, step3: { title: 'Scarica il tuo CV', desc: 'Esporta il tuo CV completato in formato DOCX pronto da inviare ai datori di lavoro.' } },
  whoIsThisFor: { title: 'Per chi è questo creatore di CV?', items: ['Chi cerca lavoro', 'Studenti e laureati', 'Professionisti in cambio di carriera', 'Chiunque voglia un CV moderno e professionale'] },
  privacyFirst: { title: 'Prima la privacy', desc: 'I dati del tuo CV rimangono sul tuo dispositivo. Non memorizziamo, vendiamo o condividiamo le tue informazioni personali.', local: 'Questo creatore di CV funziona localmente sul tuo dispositivo per mantenere le tue informazioni al sicuro.' },
  simplePricing: { title: 'Prezzi semplici', desc: 'Nessun abbonamento. Acquisto unico per sbloccare tutti i modelli Pro e gli strumenti avanzati.' },
    pricing: { 
      title: 'Prezzi semplici.', 
      subtitle: 'Nessun abbonamento. Nessun costo mensile. Paga una volta.', 
      oneTime: '3,99 $ una volta', 
      getStarted: 'Inizia ora',
      footerText: 'Pagamento unico · Accesso a vita · Nessun abbonamento',
          free: { name: 'Gratis', price: '0 $', features: ['3 Modelli Standard', '1 Download CV', '1 Lettera di presentazione', 'Tutte le lingue'], cta: 'Inizia Gratis', desc: 'Inizia senza costi.' }, 
          pro: { name: 'Pro', price: '3,99 $', features: ['10 Modelli Premium', 'Download CV illimitati', 'Lettere di presentazione IA illimitate', 'Analizzatore offerte', 'Miglioramenti IA', 'Tutte le lingue'], cta: 'Passa a Pro', desc: 'Paga una volta. Usa per sempre.', badge: 'Pro — Accesso a vita', footer: 'Pagamento sicuro. Attivazione istantanea.', noSubscription: 'Nessun abbonamento. Nessun rinnovo.' },
      tableTitle: 'Confronto delle funzionalità',
      tableHeaderFeature: 'Funzionalità',
      tableHeaderFree: 'Gratis',
      tableHeaderPro: 'Pro',
      tableRowCV: 'Download del CV',
      tableRowCoverLetter: 'Download della lettera',
      tableRowTemplates: 'Modelli',
      tableRowAI: 'Generazione riepilogo IA',
      tableRowRewrite: 'Strumenti di riscrittura IA',
      tableRowAnalyzer: 'Analizzatore offerte di lavoro',
      tableRowLanguages: 'Tutte le lingue',
      tableRowSupport: 'Supporto prioritario',
        unlimited: 'Illimitato',
        threeStandard: '3 standard',
        proTemplatesCount: '10 Premium + 3 Gratis',
        oneCount: '1',
        popularBadge: 'Più popolare',
        bestValueBadge: 'Miglior rapporto qualità-prezzo',
        coverLetterFreeValue: '1 Download lettera di presentazione',
        coverLetterProValue: 'Lettere di presentazione IA illimitate',
        restoreTitle: 'Hai già acquistato Pro?',
        restoreDesc: 'Ripristina il tuo acquisto precedente per recuperare l\'accesso Pro su questo dispositivo.',
        restoreButton: 'Ripristina acquisto',
        proActive: 'Pro Attivo',
        restoringText: 'Ripristino...',
        needHelp: 'Hai bisogno di aiuto?',
        fairUse: 'Potrebbero applicarsi limiti di utilizzo equo per prevenire abusi e garantire un servizio affidabile.'
      },

  faq: { title: 'Domande Frequenti', items: [
    { q: 'Cosa è incluso nel piano gratuito?', a: 'Il piano gratuito ti consente di creare 1 CV e generare 1 lettera di presentazione. Puoi anche usare strumenti IA con accesso limitato per migliorare i tuoi contenuti.' },
    { q: 'Quante lettere di presentazione posso generare gratuitamente?', a: 'Puoi generare 1 lettera di presentazione gratuitamente, incluso 1 tentativo di rigenerazione.' },
    { q: 'Cosa succede dopo aver usato la mia lettera gratuita?', a: 'Dopo aver usato la tua lettera gratuita, puoi passare a Pro per lettere illimitate e accesso completo alle funzionalità IA.' },
    { q: 'Cosa ottengo con Pro?', a: 'Pro ti offre lettere di presentazione illimitate, accesso completo a tutti gli strumenti IA, modelli premium e funzionalità avanzate di ottimizzazione del CV.' },
    { q: 'Le funzionalità IA sono gratuite?', a: 'Alcune funzionalità IA sono disponibili gratuitamente con utilizzo limitato. Passa a Pro per sbloccare l\'accesso illimitato.' },
    { q: 'Posso usare l\'app in lingue diverse?', a: 'Sì, l\'app supporta più lingue in modo che tu possa creare il tuo CV e la tua lettera di presentazione nella tua lingua preferita.' },
    { q: 'I modelli sono ATS-friendly?', a: 'Assolutamente. Tutti i modelli sono progettati per superare i sistemi ATS utilizzati dai principali datori di lavoro nel mondo.' },
    { q: 'Come funziona l\'IA? I miei dati vengono archiviati?', a: "L'IA utilizza solo i tuoi dati (titolo, azienda, tono ecc.) per generare testo. I tuoi dati personali non vengono archiviati in modo permanente. L'app utilizza servizi IA di terze parti per elaborare le richieste di generazione." },
    { q: 'Il contenuto generato dall\'IA è sempre accurato?', a: "Il contenuto generato dall'IA può contenere imprecisioni. Si prega di rivedere attentamente tutti i testi generati prima di inviarli ai datori di lavoro. Gli utenti sono responsabili del contenuto finale." }
  ] },
  cv: { title: 'Crea CV', personal: 'Info Personali', experience: 'Esperienza', education: 'Istruzione', skills: 'Competenze', certifications: 'Certificazioni', languages: 'Lingue', summary: 'Riepilogo Pro', generate: 'Genera con IA', rewrite: 'Riscrivi', translate: 'Traduci', analyzeJob: 'Analizza Offerta', download: 'Scarica', downloadCv: 'Scarica CV', downloadPdf: 'PDF', downloadDocx: 'DOCX', downloadPdfDesc: 'Consigliato · Pronto per l\'invio', downloadDocxDesc: 'Versione modificabile', downloadNote: 'Il PDF conserva il design selezionato. Il DOCX è modificabile e può presentare lievi differenze di layout a seconda di Word, Google Docs o visualizzatori mobili.', pdfExportFailed: 'Esportazione PDF fallita. Riprova.',
    wordExportFailed: 'Esportazione Word fallita. Riprova.', preview: 'Anteprima', selectTemplate: 'Scegli Modello', jobTitle: 'Posizione', fullName: 'Nome Completo', email: 'Email', phone: 'Telefono', address: 'Indirizzo', fathersName: 'Nome del padre', nationality: 'Nazionalità', dateOfBirth: 'Data di nascita', company: 'Azienda', position: 'Ruolo', startDate: 'Inizio', endDate: 'Fine', present: 'Presente', description: 'Descrizione', degree: 'Titolo di studio', school: 'Scuola / Università', addMore: 'Aggiungi', remove: 'Rimuovi', region: 'Regione Target', ready: 'Pronto per il tuo CV?', readySubtitle: 'Inizia gratis. Passa a Pro quando vuoi.', edit: 'Modifica', copied: 'Copiato!', copy: 'Copia', jobTitlePlaceholder: 'es. Sviluppatore', fullNamePlaceholder: 'Mario Rossi', aiBullets: 'Miglioramenti IA', skillPlaceholder: 'Scrivi competenza e premi Invio', certPlaceholder: 'es. Certificato AWS', langPlaceholder: 'Lingua', levelPlaceholder: 'Livello',       summaryPlaceholder: 'Scrivi o genera il riepilogo...',
      jobDescPlaceholder: 'Incolla qui la descrizione del lavoro...',
      short: 'Più corto',
 strong: 'Più forte', professional: 'Professionale', keywordsFound: 'Parole chiave', suggestions: 'Suggerimenti', suggestedSkills: 'Competenze Suggerite', skillCategories: { technical: 'Competenze tecniche', soft: 'Competenze trasversali' }, aiRecommend: 'IA Consiglia', recommendedToast: 'Consigliato', recommendedForYou: '⭐ Consigliato per te', bestResultsTemplate: 'Migliori risultati con questo modello', optimizedForProfile: 'Ottimizzato per il tuo profilo', unlockWithPro: 'Sblocca questo modello con Pro', saveRequired: 'Accedi per salvare.', saved: 'CV salvato!', draftSaved: 'Draft saved', genSuccess: 'Riepilogo generato!', bulletsSuccess: 'Miglioramenti IA applicati!', rewriteSuccess: 'Riscritto', levels: { native: 'Madrelingua', fluent: 'Fluente', advanced: 'Avanzato', intermediate: 'Intermedio', basic: 'Base' }, regions: { us: 'USA', eu: 'UE', balkan: 'Balcani', middleEast: 'Medio Oriente', india: 'India', japan: 'Giappone' }, gender: 'Genere', genderMale: 'Maschile', genderFemale: 'Femminile', genderOther: 'Altro', coverLetterSection: 'Lettera di presentazione', photo: { title: 'Foto profilo', optional: '(Opzionale)', shown: 'Mostrata nel CV', hidden: 'Nascosta nel CV', shownDesc: 'Mostrata di default', hiddenDesc: 'La foto è nascosta.', change: 'Cambia', upload: 'Carica', recrop: 'Ritaglia', remove: 'Rimuovi', hint: 'JPG o PNG, max 5MB.', aiEnhance: 'Miglioramento IA', aiEnhancing: 'Migliorando...', applied: 'Applicato', upgrade: 'Passa a Pro', features: ['Sfondo sfocato', 'Luminosità & contrasto', 'Tono di pelle naturale', 'Centratura automatica'], cropTitle: 'Ritaglia foto', cropHint: 'Trascina per riposizionare', apply: 'Applica', usRegion: 'Nascosta (regione US)', otherRegion: 'Mostrata di default', errorFormat: 'Carica un\'immagine JPG o PNG.' }, industryLabel: 'Settore', levelLabel: 'Livello', industryPlaceholder: 'Seleziona settore', industries: { tech: 'IT / Sviluppo Software', data_ai: 'Dati / IA / Machine Learning', cybersecurity: 'Cybersecurity', sales_retail: 'Vendite (Retail)', sales_b2b: 'Vendite B2B', marketing: 'Marketing / Marketing Digitale', sales: 'Vendite', finance: 'Finanza / Contabilità', banking_fintech: 'Banca / FinTech', healthcare: 'Sanità / Medicina', pharmacy: 'Farmacia', education: 'Istruzione / Insegnamento', human_resources: 'Risorse Umane', customer_service: 'Assistenza Clienti / Call Center', logistics: 'Logistica / Supply Chain', operations: 'Operations / Produzione', executive: 'Management / Leadership', project_management: 'Project Management', design: 'Design / UX / UI', engineering: 'Ingegneria (Meccanica / Elettrica)', construction: 'Edilizia / Architettura', hospitality: 'Ospitalità / Turismo', legal: 'Legale', administration: 'Amministrazione / Ufficio', general: 'Generale' }, bulletLevels: { entry: 'Entry Level', mid: 'Livello Medio', senior: 'Senior', lead: 'Lead / Direttore' }, aiExperienceIntro: '✨ Migliora la tua esperienza con l\'IA', aiExperienceIntroSub: 'Scrivi descrizioni più incisive, chiare e professionali in pochi secondi.', aiSummaryIntro: '✨ Crea un riassunto professionale potente', aiSummaryIntroSub: 'Genera o migliora il tuo riassunto per distinguerti ai recruiter.', generateSubtext: 'Sommario incisivo in pochi secondi', shorterSubtext: 'Testo più conciso e chiaro', strongerSubtext: 'Valorizza risultati e impatto', professionalSubtext: 'Migliora tono e formulazione', aiBulletsSubtext: 'Trasforma l\'esperienza in risultati', analyzeJobSubtext: 'Adatta il CV ai requisiti del ruolo', analyzeJobProOnly: 'L\'analisi della descrizione del lavoro è disponibile solo in Pro.', aiRecommendSubtext: 'Trova il modello migliore per te', proHint: 'Consigliato', proHintPopular: 'Più popolare', jobAnalysis: { title: 'La tua analisi CV', subtitle: 'Quanto il tuo CV corrisponde a questa offerta', matchScore: 'Corrispondenza', matchGood: 'Buona corrispondenza — ma migliorabile', matchAverage: 'Corrispondenza media — diverse lacune trovate', matchWeak: 'Corrispondenza debole — miglioramenti significativi necessari', keyInsights: 'Punti chiave', insight1: 'Esperienza rilevante trovata', insight2: 'Competenze chiave mancanti', insight3: 'Descrizioni di impatto deboli', importantKeywords: 'Parole chiave importanti', unlockFull: 'Sblocca la lista completa con Pro', suggestedImprovements: 'Miglioramenti suggeriti', improve1: 'Aggiungi risultati misurabili', improve2: 'Usa verbi d\'azione più forti', improve3: 'Includi le competenze mancanti', proCardTitle: 'Migliora il tuo CV immediatamente', proCardText: 'Sblocca l\'analisi completa, tutte le parole chiave e i miglioramenti IA', proCardCta: 'Passa a Pro', proCardNote: 'Pagamento unico', analyzing: 'Analisi in corso...' } },
  coverLetter: { title: 'Builder di Lettera', firstName: 'Nome', lastName: 'Cognome', gender: 'Genere', genderMale: 'Maschile', genderFemale: 'Femminile', genderPreferNot: 'Preferisco non dirlo', identitySection: 'Le tue informazioni', jobTitle: 'Posizione', companyName: 'Azienda',tone: 'Tono', tones: { formal: 'Formale', confident: 'Sicuro', friendly: 'Cordiale' }, generate: 'Genera Lettera', generating: 'Generazione della tua lettera di presentazione…', regenerate: 'Rigenera', regenerating: 'Rigenerazione…', regenerateSubtitle: 'Ottieni una nuova variante', edit: 'Modifica', companyPlaceholder: 'es. Google', firstNamePlaceholder: 'Mario', lastNamePlaceholder: 'Rossi', genSuccess: 'Lettera generata!', saved: 'Salvato!', draftSaved: 'Draft saved', placeholder: 'La tua lettera apparirà qui...', preview: 'Anteprima', filename: 'Lettera di Presentazione',regenLeft: 'rimasti', regenExhausted: 'Hai raggiunto il numero massimo di rigenerazioni per questa lettera.', paywallMessage: 'La generazione di lettere oltre il limite gratuito è una funzione Pro. Passa a Pro per generare lettere di presentazione IA illimitate.', downloadCl: 'Scarica la lettera di presentazione', generateSubtitle: 'Personalizzata per il ruolo e l\'azienda', aiDisclaimer: 'I contenuti generati dall\'IA possono contenere imprecisioni. Si prega di rivedere tutto il testo generato dall\'IA prima di inviarlo.' },
  auth: { login: 'Accedi', register: 'Crea account', email: 'Email', password: 'Password', confirmPassword: 'Conferma', name: 'Nome', forgotPassword: 'Dimenticata?', noAccount: 'No account?', hasAccount: 'Già iscritto?', invalidCredentials: 'Credenziali non valide.', emailTaken: 'Email già registrata.' },
  dashboard: { title: 'Dashboard', myCVs: 'I miei CV', myCoverLetters: 'Le mie Lettere', createNew: 'Nuovo', edit: 'Modifica', delete: 'Elimina', lastEdited: 'Modificato', upgrade: 'Passa a Pro', plan: 'Piano Attuale', welcome: 'Bentornato', noCVs: 'Nessun CV.', noLetters: 'Nessuna lettera.', untitled: 'Senza titolo', cvDeleted: 'CV eliminato', letterDeleted: 'Lettera eliminata', loginRequired: 'Accedi.', upgradeBanner: '1 CV e 1 lettera di presentazione inclusi.' },
  common: { save: 'Salva', cancel: 'Annulla', back: 'Indietro', next: 'Avanti', loading: 'Caricamento...', proAccessRequired: 'Accesso Pro richiesto. Passa a Pro per continuare.', proAuthorizationUnavailable: 'Autorizzazione Pro in sincronizzazione. Riprova tra un momento.', error: 'Errore', success: 'Successo!', darkMode: 'Modalità Scura', lightMode: 'Modalità Chiara', language: 'Lingua', legal: 'Legale', previewBadge: 'Modello Gratis', slide: 'Diapositiva', appName: 'CV Pro AI', docx: 'DOCX' },
  footer: { rights: '© 2026 CV Pro AI. Tutti i diritti riservati.', privacy: 'Privacy', terms: 'Termini', backToHome: 'Home' },
  templates: {
    title: 'Modelli', subtitle: '13 modelli professionali.', showcase: 'Galleria', showcaseSubtitle: 'Standard moderni.', freeCount: 'Gratis — 3 Modelli', proCount: 'Pro — 10 Premium', proBadge: 'PRO', unlockPro: 'Sblocca tutto a 3,99 $', browseAll: 'Vedi tutti',
    categories: { ats: 'ATS-Friendly', creative: 'Creativo', executive: 'Executive', modern: 'Moderno', japanese: 'Giapponese' },
    items: {
      'modern-minimal': { name: 'Minimal Moderno', description: 'Design pulito e ATS-ottimizzato — notato dai recruiter fin dal primo sguardo.', category: 'ATS-Friendly' },
      'clean-simple': { name: 'Pulito e Semplice', description: 'Chiaro ed efficace — perfetto per le prime candidature e gli studenti.', category: 'ATS-Friendly' },
      'professional-classic': { name: 'Classico Pro', description: 'Senza tempo e affidabile — la scelta preferita dai recruiter in ogni settore.', category: 'ATS-Friendly' },
      'creative-bold': { name: 'Creativo Audace', description: 'Colpisci subito con un layout audace pensato per i professionisti creativi.', category: 'Creativo' },
      'creative-artistic': { name: 'Artistico', description: 'Esprimi la tua personalità con un design moderno che lascia il segno.', category: 'Creativo' },
      'elegant-formal': { name: 'Elegante Formale', description: 'Raffinato e autorevole — ideale per ruoli senior dove ogni dettaglio conta.', category: 'Executive' },
      'ats-standard': { name: 'ATS Standard', description: 'Massimizza le possibilità di superare ogni filtro di selezione automatica.', category: 'ATS-Friendly' },
      'executive-premium': { name: 'Executive Premium', description: 'Design di alto livello per i leader C-level che non lasciano nulla al caso.', category: 'Executive' },
        'nordic-clean': { name: 'Nordico Pulito', description: 'Layout sobrio e focalizzato — la tua esperienza parla da sola.', category: 'Moderno' },
        'tech-sidebar': { name: 'Tech Barra Laterale', description: 'Struttura a due colonne che organizza competenze ed esperienze al meglio.', category: 'Moderno' },
        'corporate-navy': { name: 'Aziendale Blu Navy', description: 'Forte e autorevole — trasmette sicurezza fin dal primo sguardo.', category: 'Executive' },
        'modern-minimal-executive': { name: 'Minimal Moderno Executive', description: 'Presenza manageriale moderna con barra laterale strutturata.', category: 'Executive' },
        'contemporary-bold': { name: 'Contemporaneo Audace', description: 'Design deciso per ruoli tech e startup che vogliono farsi notare.', category: 'Moderno' },
        'rirekisho': { name: 'Rirekisho', description: 'Il formato CV giapponese autentico — conforme agli standard locali.', category: 'Giapponese' }
      }
    },
  legal: {
    privacy: {
      title: 'Informativa sulla Privacy', effectiveDate: 'In vigore: Aprile 2026',
      sections: [
        { title: '1. Introduzione', content: 'CV Pro AI rispetta la tua privacy e si impegna a proteggere i tuoi dati personali. Questa Informativa sulla Privacy spiega come raccogliamo, utilizziamo e proteggiamo le tue informazioni quando usi il nostro strumento di creazione di CV e lettere di presentazione con IA.' },
        { title: '2. Dati che raccogliamo', content: 'Durante l\'utilizzo dell\'app, possiamo raccogliere le seguenti informazioni:', items: ['Nome (se fornito)', 'Indirizzo e-mail (se fornito)', 'Contenuto del CV che inserisci', 'Dati di utilizzo di base e analisi'] },
        { title: '3. Come utilizziamo i tuoi dati', content: 'I tuoi dati vengono utilizzati esclusivamente per i seguenti scopi:', items: ['Generare CV e lettere di presentazione', 'Migliorare le funzionalità IA e la qualità dell\'app', 'Fornire le funzioni principali dell\'app'] },
        { title: '4. Elaborazione IA', content: 'I tuoi input possono essere trasmessi in modo sicuro a fornitori IA terzi per generare riassunti del CV, punti elenco, lettere di presentazione e altri contenuti basati sull\'IA. I dati vengono elaborati solo allo scopo di generare l\'output richiesto. CV Pro AI non utilizza i tuoi contenuti per scopi pubblicitari.' },
        { title: '5. Condivisione dei dati', content: 'Rispettiamo la tua privacy e gestiamo i tuoi dati in modo responsabile:', items: ['NON vendiamo i dati degli utenti a terze parti', 'I dati non vengono condivisi con terze parti, eccetto per i servizi essenziali al funzionamento dell\'app'] },
        { title: '6. Archiviazione e sicurezza', content: 'I dati del tuo CV vengono archiviati localmente sul tuo dispositivo. L\'app utilizza il salvataggio automatico per archiviare le bozze in lavorazione localmente sul tuo dispositivo. Alcuni contenuti possono essere trasmessi in modo sicuro quando utilizzi funzionalità basate su IA che richiedono generazione o miglioramento di contenuti. Implementiamo misure di sicurezza standard inclusa la crittografia TLS. Vengono adottate misure ragionevoli per proteggere tutte le informazioni degli utenti.', items: ['I contenuti generati dall\'IA e i dati delle bozze vengono conservati solo quanto necessario per fornire la funzionalità richiesta. Le bozze archiviate localmente rimangono sotto il controllo dell\'utente e possono essere eliminate in qualsiasi momento cancellando la bozza o ripristinando l\'applicazione.'] },
        { title: '7. I tuoi diritti e protezione GDPR', content: 'Hai il pieno controllo sui tuoi dati personali. Se ti trovi nello Spazio Economico Europeo (SEE), hai diritti aggiuntivi ai sensi del Regolamento Generale sulla Protezione dei Dati (GDPR):', items: ['Richiedere l\'accesso ai tuoi dati personali', 'Richiedere la cancellazione dei tuoi dati (diritto all\'oblio)', 'Richiedere la correzione di dati inesatti', 'Richiedere la limitazione del trattamento (utenti SEE)', 'Portabilità dei dati — ricevere i tuoi dati in un formato strutturato e leggibile da macchina (utenti SEE)', 'Revocare il consenso in qualsiasi momento quando il trattamento si basa sul consenso'] },
        { title: '8. Cookie e analisi', content: 'L\'app può utilizzare strumenti di analisi di base per comprendere i modelli di utilizzo e migliorare le prestazioni. Nessun dato personale viene condiviso con reti pubblicitarie.' },
        { title: '9. Pagamenti e acquisti', content: 'Gli acquisti del piano Pro vengono elaborati in modo sicuro tramite processori di pagamento di terze parti:', items: ['I pagamenti sono gestiti da Apple App Store, Google Play Store e RevenueCat', 'CV Pro AI NON raccoglie, elabora o memorizza i dati della tua carta di pagamento', 'Tutti i dati di pagamento sono gestiti direttamente dall\'app store e dal processore di pagamento secondo le proprie politiche sulla privacy e sicurezza', 'La validazione degli acquisti e la gestione dei diritti possono essere fornite tramite RevenueCat o fornitori simili di infrastruttura di pagamento.'] },
        { title: '10. Privacy dei minori', content: 'Questa app non è destinata a utenti di età inferiore a 13 anni. Non raccogliamo consapevolmente informazioni personali da bambini sotto i 13 anni. Se ritieni che un minore ci abbia fornito dati, contattaci immediatamente.' },
        { title: '11. Nessuna garanzia', content: 'CV Pro AI non garantisce occupazione, colloqui, offerte di lavoro o risultati di candidature. Gli utenti rimangono responsabili della revisione, modifica e verifica di tutti i contenuti generati prima di inviarli a datori di lavoro o terzi.' },
        { title: '12. Contatto', content: 'Per qualsiasi domanda o richiesta relativa a questa Informativa sulla Privacy, contattaci a help.cvappai@gmail.com.' }
      ]
    },
    terms: {
      title: 'Termini di Servizio', effectiveDate: 'In vigore: Aprile 2026',
      sections: [
        { title: '1. Introduzione', content: 'CV Pro AI è uno strumento per la creazione di CV e lettere di presentazione con assistenza IA. Utilizzando l\'app, accetti questi Termini di Servizio.' },
        { title: '2. Descrizione del servizio', content: 'CV Pro AI è un builder di CV e lettere di presentazione alimentato da IA. Offre un piano gratuito e un piano Pro. Il piano gratuito include 1 download di lettera di presentazione e 1 rigenerazione IA. Il piano Pro (pagamento unico di 3,99 $) offre download illimitati, generazione IA illimitata, 10 modelli premium, strumenti di riscrittura IA e l\'analizzatore di offerte di lavoro.' },
        { title: '3. Avvertenza IA', content: 'Il contenuto generato dall\'IA viene fornito solo come assistenza e può richiedere la revisione dell\'utente. Può contenere imprecisioni o variazioni stilistiche. Sei l\'unico responsabile della revisione e della modifica di tutti i testi generati prima di inviarli ai datori di lavoro.' },
        { title: '4. Responsabilità dell\'utente', content: 'Sei responsabile dell\'accuratezza delle informazioni che inserisci nell\'app. Assicurati che tutti i dati siano veritieri e aggiornati. La responsabilità finale sui tuoi materiali di candidatura è tua.' },
        { title: '5. Uso accettabile', content: 'Accetti di non fare uso improprio dell\'app, di non caricare contenuti illegali e di non usarla in modo che violi le leggi applicabili. L\'abuso del servizio può comportare la restrizione dell\'accesso.' },
        { title: '6. Pagamenti', content: 'Il piano Pro è disponibile per un pagamento unico di 3,99 $, che garantisce l\'accesso a vita senza abbonamenti né rinnovi automatici. Se hai già acquistato Pro, usa il pulsante "Ripristina acquisto" nella pagina Prezzi.' },
        { title: '7. Nessuna garanzia', content: 'CV Pro AI fornisce strumenti per assistere nella creazione di CV. Non garantiamo che l\'uso dell\'app risulterà in offerte di lavoro, colloqui o assunzioni. I risultati dipendono da molti fattori al di fuori del nostro controllo.' },
        { title: '8. Limitazione di responsabilità', content: 'L\'app è fornita "così com\'è" senza garanzie di alcun tipo. Nella misura massima consentita dalla legge, CV Pro AI non è responsabile per danni indiretti o conseguenti derivanti dall\'uso dell\'app.' },
        { title: '9. Risoluzione', content: 'Ci riserviamo il diritto di limitare o terminare l\'accesso all\'app in caso di violazione di questi Termini, incluso uso improprio, attività illegale o abuso del servizio.' },
        { title: '10. Modifiche ai Termini', content: 'Potremmo aggiornare questi Termini di tanto in tanto. L\'uso continuato dell\'app dopo la pubblicazione delle modifiche costituisce accettazione dei Termini aggiornati.' },
        { title: '11. Contatto', content: 'Per supporto o domande su questi Termini, contattaci a help.cvappai@gmail.com.' }
      ]
    }
  },
    comparison: {
      title: 'Vedi la differenza', subtitle: 'Confronto Gratis vs Pro.', freePlan: 'Layout di base', proPlan: 'Layout professionale', good: 'Buono', hireReady: 'Pronto all\'uso', proBadge: 'Pro', freeFeatures: ['Design base', 'Gerarchia minima', 'Spaziature standard'], proFeatures: ['Tipografia premium', 'Standard internazionale', 'Struttura raffinée'], summary: 'Riepilogo', experience: 'Esperienza', expertise: 'Expertise', languages: 'Lingue', chips: ['Strategia SEO', 'Analytics', 'Contenuto', 'Email'], persuasiveText: 'I layout professionali aiutano il tuo CV a distinguersi in mercati competitivi.'
    },
  previews: {
    name: 'Alessandro J.', role: 'Senior Product Manager', email: 'alex@email.com', phone: '+39 02 1234567', location: 'Milano / NY', experience: 'Esperienza', education: 'Istruzione', skills: 'Competenze', contact: 'Contatti', headOfProduct: 'Capo Prodotto', productManager: 'Product Manager', jrPm: 'Jr. PM', techCorp: 'TechCorp', startupXY: 'StartupXY', digitalAgency: 'Agenzia Digitale', techCorpDesc: 'Team di 12, 3 lanci, +40% fatturato.', startupDesc: 'Roadmap, ricerca, +28% retention.', agencyDesc: 'Consegna per 5 clienti.', mba: 'MBA', columbia: 'Univ. Columbia', present: 'Presente', now: 'Ora', productVision: 'Visione Prodotto', teamLeadership: 'Leadership', gtm: 'Go-to-Market', dataAnalysis: 'Analisi Dati', productStrategy: 'Strategia', uxResearch: 'Ricerca UX', agile: 'Agile / Scrum', techCorpYears: '2021–Presente', startupYears: '2018–2021', educationYears: '2016–2018', agencyYears: '2016–2018'
  },
  onboarding: {
    title: 'Benvenuto nel Costruttore di CV con IA ✨',
    subtitle: 'Crea un CV e una lettera di presentazione professionali in pochi minuti. Inizia gratuitamente — passa a Pro quando sei pronto.',
    freeLabel: 'Gratuito',
    freeFeatures: ['3 Modelli Standard', '1 download di Lettera', '1 tentativo di Rigenerazione IA', 'Tutti i 12 lingue'],
    proLabel: 'Pro — 3,99 €',
    proRecommendedBadge: 'CONSIGLIATO',
    proFeatures: ['Lettere Illimitate', 'Strumenti di Riscrittura IA', '10 Modelli Premium', 'Analizzatore di Offerte + Supporto Prioritario'],
    oneTimePayment: 'Pagamento unico. Nessun abbonamento.',
    aiFeatureTitle: 'Funzioni IA',
    aiFeatureDesc: 'L\'IA utilizza i tuoi dati solo per generare testo e non archivia i dati in modo permanente. Rivedi tutto il testo generato prima di inviarlo.',
    startFree: 'Inizia Gratuitamente',
    upgradeToPro: 'Passa a Pro',
    secureCheckout: 'Checkout sicuro. Attivazione istantanea. Nessun abbonamento.'
  },
  about: {
    hero: { badge: 'Descrizione Google Play & App Store', title: 'CV Pro AI — Generatore di CV Intelligente con IA', description: 'Crea un CV professionale e vincente in pochi minuti. Inizia gratis — aggiorna una volta, usa per sempre.', ageRating: 'Classificazione: 3+', languages: '12 lingue', privacyFirst: 'Privacy al primo posto' },
    description: { title: 'Descrizione dell\'app', paragraphs: ['CV Pro AI è un generatore di CV e lettera di presentazione alimentato da IA progettato per i cercatori di lavoro in tutto il mondo. Crea un CV professionale ottimizzato per ATS in pochi minuti usando modelli intelligenti e strumenti di scrittura con IA.', 'Disponibile per Android (Google Play) e iPhone (Apple App Store).', 'Scegli tra 13 modelli professionali — 3 gratuiti, 10 premium. L\'assistente di scrittura con IA ti aiuta a redigere punti convincenti, riepiloghi professionali e lettere di presentazione personalizzate adattate al tuo lavoro target e all\'azienda.', 'Il supporto per 12 lingue, inclusi arabo (RTL), giapponese, hindi (India) e altro, garantisce che tu possa creare un CV pronto al lavoro per qualsiasi mercato. L\'ottimizzazione regionale adatta automaticamente il tuo CV agli standard del mercato del lavoro degli Stati Uniti, dell\'UE, dei Balcani, del Medio Oriente, dell\'India e del Giappone.', 'Piano Gratuito: Crea il tuo CV, scarica 1 lettera di presentazione generata da IA e usa 1 tentativo di rigenerazione — nessun account richiesto.', 'Piano Pro ($3,99 una sola volta): Sblocca lettere di presentazione generate da IA illimitate, Strumenti di Riscrittura IA, tutti i 10 modelli premium, Analizzatore di Descrizione Lavoro e supporto prioritario. Pagamento unico. Nessun abbonamento. Nessun rinnovo.'] },
    features: { title: 'Funzioni Gratuite vs. Pro', free: { label: 'Gratuito — €0', items: ['3 Modelli Standard (Compatibili ATS)', '1 Scaricamento di Lettera di Presentazione Generata da IA', '1 Tentativo di Rigenerazione Lettera di Presentazione', 'Generazione Riassunto Professionale IA', 'Tutte le 12 lingue', 'Esportazione DOCX', 'Ottimizzazione CV Regionale'], disabledItems: ['Strumenti di Riscrittura IA', 'Analizzatore di Annunci di Lavoro', '10 Modelli Premium', 'Lettere di Presentazione Illimitate'] }, pro: { label: 'Pro — €3,99 una sola volta', price: 'UNA SOLA VOLTA €3,99', items: ['10 Modelli Premium (+ 3 Gratuiti)', 'Lettere di Presentazione Generate da IA Illimitate', 'Rigenerazioni Lettere di Presentazione Illimitate', 'Generazione Riassunto Professionale IA', 'Strumenti di Riscrittura IA (Accorcia, Rafforza, Professionalizza)', 'Analizzatore di Descrizione Lavoro', 'Tutte le 12 lingue', 'Esportazione DOCX', 'Ottimizzazione CV Regionale', 'Supporto Prioritario'], footer: 'Pagamento unico. Nessun abbonamento. Nessun rinnovo.' } },
    aiDisclosure: { title: 'Come viene utilizzata l\'IA in questa app', items: ['L\'app utilizza servizi IA di terze parti per generare riepiloghi CV, punti chiave e testo di lettere di presentazione.', 'Gli input dell\'utente (titolo lavoro, nome azienda, preferenza di tono, esperienza lavorativa) vengono elaborati dai servizi IA solo per generare testo.', 'Gli input dell\'utente non vengono archiviati permanentemente dall\'app o dai servizi IA.', 'Il contenuto generato da IA può contenere inesattezze. Gli utenti sono responsabili della revisione di tutto il contenuto prima di inviarlo ai datori di lavoro.', 'Il pulsante IA è chiaramente etichettato: "Genera con IA ✨"'] },
    ageAndContent: { title: 'Classificazione Età e Avvertenza sui Contenuti', ageRating: 'Classificazione: 3+', ageRatingDesc: 'Appropriato per tutte le età. Nessun contenuto per adulti.', disclaimer: 'Il contenuto generato da IA può contenere inesattezze, errori grammaticali o problemi specifici del contesto. Gli utenti sono interamente responsabili della revisione, modifica e verifica di tutto il testo generato da IA prima di inviarlo a datori di lavoro o terze parti.', noLiability: 'CV Pro AI fornisce strumenti per assistere nella creazione di CV e lettere di presentazione. Non forniamo garanzie sui risultati dell\'assunzione. L\'uso di contenuti generati da IA è a rischio dell\'utente.', privacy: 'I dati del CV vengono archiviati localmente sul dispositivo dell\'utente. Le informazioni personali non vengono vendute o condivise con terze parti a scopo di marketing.' },
    languages: { title: 'Lingue Supportate', list: ['English', 'Deutsch (German)', 'Español (Spanish)', 'Français (French)', 'Italiano (Italian)', 'العربية (Arabic) — RTL', 'Srpski (Serbian)', 'Hrvatski (Croatian)', 'Русский (Russian)', 'Português (Brazil)', 'हिन्दी (Hindi)', '日本語 (Japanese)'] },
    restorePurchase: { title: 'Ripristina Acquisto', description: 'Se hai acquistato Pro in precedenza e hai bisogno di ripristinare l\'accesso, tocca il pulsante "Ripristina Acquisto" nella pagina Prezzi. L\'accesso a Pro verrà ripristinato istantaneamente sul dispositivo corrente. Se riscontri problemi, contattaci su help.cvappai@gmail.com.' },
    legal: { title: 'Legale', privacyPolicy: 'Informativa sulla Privacy', termsOfService: 'Termini di Servizio', contact: 'Contatti: help.cvappai@gmail.com', viewPricing: 'Visualizza Prezzi e Passa a Pro' }
  }
};

const ar: TranslationKeys = {
  nav: { home: 'الرئيسية', cvBuilder: 'إنشاء سيرة', coverLetter: 'الخطاب', templates: 'القوالب', pricing: 'الأسعار', about: 'نبذة', contact: 'اتصل', login: 'دخول', register: 'تسجيل', dashboard: 'لوحة التحكم', logout: 'خروج' },
  hero: { title: 'ابنِ سيرتك الاحترافية في دقائق.', professionalResumesAiPowered: 'سير ذاتية احترافية. مدعومة بالذكاء الاصطناعي.', subtitle: 'منشئ سيرة ذاتية بالذكاء الاصطناعي مع قوالب مميزة.', valueDesc: 'أنشئ سيرة ذاتية احترافية في دقائق. افتح 10 قوالب متميزة وأدوات متقدمة مع Pro.', cta: 'ابدأ سيرتي', ctaSecondary: 'عرض القوالب', badge: 'منشئ سيرة بالذكاء الاصطناعي', footerText: 'دفع لمرة واحدة. وصول مدى الحياة.' },
  features: { title: 'كل ما تحتاجه للنجاح.', subtitle: 'أدوات ذكاء اصطناعي قوية للمسار العالمي', badge: 'ماذا يتضمن', ai: { title: 'كتابة ذكية', desc: 'تحسين الوضوح والهيكلية تلقائياً.' }, multilingual: { title: 'دعم اللغات', desc: 'سير ذاتية بـ 9 لغات.' }, templates: { title: 'قوالب مميزة', desc: '10 مميزة + 3 مجانية.' }, ats: { title: 'متوافق مع ATS', desc: 'تجاوز أنظمة فرز المتقدمين.' }, region: { title: 'تحسين إقليمي', desc: 'تخصيص للشرق الأوسط وأوروبا وأمريكا.' }, export: { title: 'تصدير متعدد', desc: 'DOCX بضغطة واحدة.' }, analyzer: { title: 'محلل الوظائف', desc: 'طابق سيرتك مع الوصف الوظيفي.' } },
  howItWorks: { title: 'كيف يعمل', step: 'الخطوة', step1: { title: 'أضف معلوماتك', desc: 'أدخل بياناتك الشخصية وخبرتك العملية وتعليمك لبدء إنشاء سيرتك الذاتية.' }, step2: { title: 'حسّن سيرتك الذاتية', desc: 'استخدم الأدوات الذكية والاقتراحات لجعل سيرتك أقوى وأكثر احترافية.' }, step3: { title: 'نزّل سيرتك الذاتية', desc: 'صدّر سيرتك المكتملة بتنسيق DOCX جاهزة للإرسال إلى أصحاب العمل.' } },
  whoIsThisFor: { title: 'لمن هو منشئ السيرة الذاتية هذا؟', items: ['الباحثون عن عمل', 'الطلاب والخريجون', 'المحترفون في تغيير المسار الوظيفي', 'كل من يريد سيرة ذاتية حديثة واحترافية'] },
  privacyFirst: { title: 'الخصوصية أولاً', desc: 'تبقى بيانات سيرتك الذاتية على جهازك. نحن لا نخزن أو نبيع أو نشارك معلوماتك الشخصية.', local: 'يعمل منشئ السيرة الذاتية هذا محلياً على جهازك للحفاظ على أمان معلوماتك.' },
  simplePricing: { title: 'تسعير بسيط', desc: 'لا اشتراك. شراء لمرة واحدة لفتح جميع قوالب Pro والأدوات المتقدمة.' },
    pricing: { 
      title: 'أسعار بسيطة.', 
      subtitle: 'لا اشتراكات شهرية. ادفع مرة واحدة فقط.', 
      oneTime: '3.99$ لمرة واحدة', 
      getStarted: 'ابدأ الآن',
      footerText: 'دفع لمرة واحدة · وصول مدى الحياة · لا اشتراك',
          free: { name: 'مجاني', price: '0$', features: ['3 قوالب أساسية', 'تنزيل سيرة واحدة', 'خطاب تقديم واحد', 'جميع اللغات'], cta: 'ابدأ مجاناً', desc: 'ابدأ بدون تكلفة.' }, 
          pro: { name: 'برو', price: '3.99$', features: ['10 قوالب مميزة', 'تنزيلات سيرة غير محدودة', 'خطابات تقديم AI غير محدودة', 'محلل الوصف الوظيفي', 'تحسينات الكتابة', 'جميع اللغات'], cta: 'ترقية إلى برو', desc: 'ادفع مرة واستخدمه للأبد.', badge: 'برو — وصول مدى الحياة', footer: 'دفع آمن. تفعيل فوري.', noSubscription: 'لا اشتراك. لا تجديد.' },
      tableTitle: 'مقارنة الميزات',
      tableHeaderFeature: 'الميزة',
      tableHeaderFree: 'مجاني',
      tableHeaderPro: 'برو',
      tableRowCV: 'تنزيلات السيرة الذاتية',
      tableRowCoverLetter: 'تنزيلات خطاب التقديم',
      tableRowTemplates: 'القوالب',
      tableRowAI: 'توليد الملخص بالذكاء الاصطناعي',
      tableRowRewrite: 'أدوات إعادة الكتابة بالذكاء الاصطناعي',
      tableRowAnalyzer: 'محلل الوصف الوظيفي',
      tableRowLanguages: 'جميع اللغات',
      tableRowSupport: 'دعم ذو أولوية',
        unlimited: 'غير محدود',
        threeStandard: '3 قوالب أساسية',
        proTemplatesCount: '10 مميزة + 3 مجانية',
        oneCount: '1',
        popularBadge: 'الأكثر شيوعاً',
        bestValueBadge: 'أفضل قيمة',
        coverLetterFreeValue: 'تنزيل خطاب تقديم واحد',
        coverLetterProValue: 'خطابات تقديم بالذكاء الاصطناعي غير محدودة',
      restoreTitle: 'هل اشتريت Pro مسبقاً؟',
      restoreDesc: 'استعد شراءك السابق لاستعادة وصول Pro على هذا الجهاز.',
      restoreButton: 'استعادة الشراء',
      proActive: 'Pro نشط',
      restoringText: 'جارٍ الاستعادة...',
      needHelp: 'هل تحتاج إلى مساعدة؟',
      fairUse: 'قد تُطبَّق حدود الاستخدام المعقول للحدّ من الإساءة وضمان استمرارية الخدمة.'
      },

    faq: { title: 'الأسئلة الشائعة', items: [
    { q: 'ما الذي يتضمنه الخطة المجانية؟', a: 'تتيح لك الخطة المجانية إنشاء سيرة ذاتية واحدة وتوليد خطاب تقديم واحد. يمكنك أيضًا استخدام أدوات الذكاء الاصطناعي بوصول محدود لتحسين محتواك.' },
    { q: 'كم عدد خطابات التقديم التي يمكنني توليدها مجانًا؟', a: 'يمكنك توليد خطاب تقديم واحد مجانًا، مع محاولة إعادة توليد واحدة مشمولة.' },
    { q: 'ماذا يحدث بعد استخدام خطابي المجاني؟', a: 'بعد استخدام خطابك المجاني، يمكنك الترقية إلى Pro للحصول على خطابات غير محدودة والوصول الكامل لميزات الذكاء الاصطناعي.' },
    { q: 'ما الذي أحصل عليه مع Pro؟', a: 'يمنحك Pro خطابات تقديم غير محدودة، والوصول الكامل لجميع أدوات الذكاء الاصطناعي، والقوالب المتميزة، وميزات تحسين السيرة الذاتية المتقدمة.' },
    { q: 'هل ميزات الذكاء الاصطناعي مجانية؟', a: 'بعض ميزات الذكاء الاصطناعي متاحة مجانًا باستخدام محدود. قم بالترقية إلى Pro لفتح الوصول غير المحدود.' },
    { q: 'هل يمكنني استخدام التطبيق بلغات مختلفة؟', a: 'نعم، يدعم التطبيق لغات متعددة حتى تتمكن من إنشاء سيرتك الذاتية وخطاب تقديمك بلغتك المفضلة.' },
    { q: 'هل القوالب متوافقة مع ATS؟', a: 'بالتأكيد. جميع قوالبنا مصممة لتجاوز أنظمة تتبع المتقدمين المستخدمة من قبل كبار أصحاب العمل حول العالم.' },
    { q: 'كيف يعمل الذكاء الاصطناعي؟ هل يتم تخزين بياناتي؟', a: 'يستخدم الذكاء الاصطناعي فقط مدخلاتك (المسمى الوظيفي، الشركة، النبرة، إلخ) لتوليد النص. لا يتم تخزين بياناتك الشخصية بشكل دائم. يستخدم التطبيق خدمات ذكاء اصطناعي تابعة لجهات خارجية لمعالجة طلبات التوليد.' },
    { q: 'هل المحتوى الذي يولّده الذكاء الاصطناعي دقيق دائماً؟', a: 'قد يحتوي المحتوى المولّد بالذكاء الاصطناعي على أخطاء. يُرجى مراجعة جميع النصوص المولّدة بعناية قبل إرسالها إلى أصحاب العمل. يتحمل المستخدمون مسؤولية المحتوى النهائي.' }
  ] },
  cv: { title: 'منشئ السيرة', personal: 'المعلومات الشخصية', experience: 'الخبرة العملية', education: 'التعليم', skills: 'المهارات', certifications: 'الشهادات', languages: 'اللغات', summary: 'الملخص المهني', generate: 'توليد بالذكاء الاصطناعي', rewrite: 'إعادة كتابة', translate: 'ترجمة', analyzeJob: 'تحليل الوصف الوظيفي', download: 'تنزيل', downloadCv: 'تنزيل السيرة الذاتية', downloadPdf: 'PDF', downloadDocx: 'DOCX', downloadPdfDesc: 'موصى به · جاهز للإرسال', downloadDocxDesc: 'نسخة قابلة للتعديل', downloadNote: 'يحافظ PDF على التصميم المحدد. أما DOCX فقابل للتعديل وقد تظهر فيه اختلافات طفيفة في التخطيط بحسب Word أو Google Docs أو عارضات الهاتف.', pdfExportFailed: 'فشل تصدير PDF. الرجاء المحاولة مرة أخرى.',
    wordExportFailed: 'فشل تصدير Word. يرجى المحاولة مرة أخرى.', preview: 'معاينة', selectTemplate: 'اختر قالب', jobTitle: 'المسمى الوظيفي', fullName: 'الاسم الكامل', email: 'البريد', phone: 'الهاتف', address: 'العنوان', fathersName: 'اسم الأب', nationality: 'الجنسية', dateOfBirth: 'تاريخ الميلاد', company: 'الشركة', position: 'المنصب', startDate: 'البداية', endDate: 'النهاية', present: 'الحالي', description: 'الوصف', degree: 'الدرجة العلمية', school: 'المدرسة / الجامعة', addMore: 'إضافة المزيد', remove: 'حذف', region: 'المنطقة المستهدفة', ready: 'مستعد لبناء سيرتك؟', readySubtitle: 'ابدأ مجاناً. رقية عندما تجهز.', edit: 'تعديل', copied: 'تم النسخ!', copy: 'نسخ', jobTitlePlaceholder: 'مثلاً مهندس برمجيات', fullNamePlaceholder: 'عمر حسن', aiBullets: 'تحسينات الذكاء الاصطناعي', skillPlaceholder: 'اكتب المهارة واضغط Enter', certPlaceholder: 'مثلاً شهادة AWS', langPlaceholder: 'اللغة', levelPlaceholder: 'المستوى',       summaryPlaceholder: 'اكتب أو ولد ملخصك المهني...',
      jobDescPlaceholder: 'الصح وصف الوظيفة هنا لتحليله...',
      short: 'أقصر',
 strong: 'أقوى', professional: 'احترافي', keywordsFound: 'الكلمات المفتاحية', suggestions: 'الاقتراحات', suggestedSkills: 'المهارات المقترحة', skillCategories: { technical: 'المهارات التقنية', soft: 'المهارات الناعمة' }, aiRecommend: 'ترشيح الذكاء', recommendedToast: 'موصى به', recommendedForYou: '⭐ موصى به لك', bestResultsTemplate: 'أفضل نتائج مع هذا القالب', optimizedForProfile: 'محسّن لملفك الشخصي', unlockWithPro: 'افتح هذا القالب مع Pro', saveRequired: 'يرجى تسجيل الدخول للحفظ.', saved: 'تم حفظ السيرة!', draftSaved: 'Draft saved', genSuccess: 'تم توليد الملخص!', bulletsSuccess: 'تم تطبيق تحسينات الذكاء الاصطناعي!', rewriteSuccess: 'تمت إعادة الكتابة', levels: { native: 'اللغة الأم', fluent: 'طلاقة', advanced: 'متقدم', intermediate: 'متوسط', basic: 'أساسي' }, regions: { us: 'أمريكا', eu: 'أوروبا', balkan: 'البلقان', middleEast: 'الشرق الأوسط', india: 'الهند', japan: 'اليابان' }, gender: 'الجنس', genderMale: 'ذكر', genderFemale: 'أنثى', genderOther: 'آخر', coverLetterSection: 'خطاب تقديم', photo: { title: 'صورة الملف الشخصي', optional: '(اختياري)', shown: 'معروضة في السيرة', hidden: 'مخفية في السيرة', shownDesc: 'معروضة افتراضياً لمنطقتك', hiddenDesc: 'الصورة مخفية.', change: 'تغيير', upload: 'رفع', recrop: 'اقتصاص', remove: 'إزالة', hint: 'JPG أو PNG، بحد أقصى 5MB.', aiEnhance: 'تحسين بالذكاء الاصطناعي', aiEnhancing: 'جارٍ التحسين...', applied: 'تم التطبيق', upgrade: 'ترقية', features: ['تمويه الخلفية', 'السطوع والتباين', 'لون بشرة طبيعي', 'توسيط تلقائي'], cropTitle: 'اقتصاص الصورة', cropHint: 'اسحب لإعادة التموضع', apply: 'تطبيق', usRegion: 'مخفية افتراضياً (المنطقة الأمريكية)', otherRegion: 'معروضة افتراضياً لمنطقتك', errorFormat: 'يرجى رفع صورة JPG أو PNG.' }, industryLabel: 'القطاع', levelLabel: 'المستوى', industryPlaceholder: 'اختر القطاع', industries: { tech: 'تكنولوجيا المعلومات / تطوير البرمجيات', data_ai: 'البيانات / الذكاء الاصطناعي / تعلم الآلة', cybersecurity: 'الأمن السيبراني', sales_retail: 'مبيعات التجزئة', sales_b2b: 'مبيعات B2B', marketing: 'التسويق / التسويق الرقمي', sales: 'المبيعات', finance: 'المالية / المحاسبة', banking_fintech: 'البنوك / التكنولوجيا المالية', healthcare: 'الرعاية الصحية / الطب', pharmacy: 'الصيدلة', education: 'التعليم / التدريس', human_resources: 'الموارد البشرية', customer_service: 'دعم العملاء / مركز الاتصال', logistics: 'اللوجستيات / سلسلة الإمداد', operations: 'العمليات / الإنتاج', executive: 'الإدارة / القيادة', project_management: 'إدارة المشاريع', design: 'التصميم / UX / UI', engineering: 'الهندسة (الميكانيكية / الكهربائية)', construction: 'البناء / الهندسة المعمارية', hospitality: 'الضيافة / السياحة', legal: 'القانون', administration: 'الإدارة / خدمات المكتب', general: 'عام' }, bulletLevels: { entry: 'مستوى مبتدئ', mid: 'مستوى متوسط', senior: 'مستوى كبير', lead: 'قائد / مدير' }, aiExperienceIntro: '✨ حسّن خبرتك المهنية بالذكاء الاصطناعي', aiExperienceIntroSub: 'اكتب أوصافاً أقوى وأوضح وأكثر احترافية في ثوانٍ.', aiSummaryIntro: '✨ أنشئ ملخصاً مهنياً مؤثراً', aiSummaryIntroSub: 'ولّد أو حسّن ملخصك لتبرز أمام مسؤولي التوظيف.', generateSubtext: 'ملخص احترافي في ثوانٍ', shorterSubtext: 'نص أكثر إيجازاً ووضوحاً', strongerSubtext: 'أبرز إنجازاتك وتأثيرك', professionalSubtext: 'حسّن الأسلوب والصياغة', aiBulletsSubtext: 'حوّل خبرتك إلى نقاط قوية', analyzeJobSubtext: 'طابق سيرتك مع متطلبات الوظيفة', analyzeJobProOnly: 'تحليل الوصف الوظيفي متاح فقط في الخطة Pro.', aiRecommendSubtext: 'أفضل قالب لملفك الشخصي', proHint: 'موصى به', proHintPopular: 'الأكثر شيوعاً', jobAnalysis: { title: 'تحليل سيرتك الذاتية', subtitle: 'مدى تطابق سيرتك مع هذه الوظيفة', matchScore: 'تطابق', matchGood: 'تطابق جيد — لكن يمكن تحسينه', matchAverage: 'تطابق متوسط — ثغرات عدة', matchWeak: 'تطابق ضعيف — تحسينات جوهرية مطلوبة', keyInsights: 'نقاط رئيسية', insight1: 'خبرة ذات صلة موجودة', insight2: 'مهارات أساسية مفقودة', insight3: 'أوصاف تأثير ضعيفة', importantKeywords: 'الكلمات المفتاحية المهمة', unlockFull: 'افتح القائمة الكاملة مع Pro', suggestedImprovements: 'تحسينات مقترحة', improve1: 'أضف نتائج قابلة للقياس', improve2: 'استخدم أفعالاً أقوى', improve3: 'أدرج المهارات المفقودة', proCardTitle: 'حسّن سيرتك فوراً', proCardText: 'افتح التحليل الكامل وجميع الكلمات المفتاحية وتحسينات الذكاء الاصطناعي', proCardCta: 'ترقية إلى Pro', proCardNote: 'دفعة واحدة', analyzing: 'جارٍ تحليل سيرتك...' } },
  coverLetter: { title: 'منشئ الخطاب', firstName: 'الاسم الأول', lastName: 'اسم العائلة', gender: 'الجنس', genderMale: 'ذكر', genderFemale: 'أنثى', genderPreferNot: 'أفضل عدم الإفصاح', identitySection: 'معلوماتك', jobTitle: 'المسمى الوظيفي', companyName: 'اسم الشركة',tone: 'النبرة', tones: { formal: 'رسمي', confident: 'واثق', friendly: 'ودي' }, generate: 'توليد الخطاب', generating: 'جاري إنشاء خطابك…', regenerate: 'إعادة التوليد', regenerating: 'جاري إعادة الإنشاء…', regenerateSubtitle: 'احصل على نسخة جديدة', edit: 'تعديل', companyPlaceholder: 'مثلاً جوجل', firstNamePlaceholder: 'عمر', lastNamePlaceholder: 'حسن', genSuccess: 'تم توليد الخطاب!', saved: 'تم الحفظ!', draftSaved: 'Draft saved', placeholder: 'سيظهر خطابك هنا...', preview: 'معاينة', filename: 'خطاب تقديم',regenLeft: 'متبقية', regenExhausted: 'لقد وصلت إلى الحد الأقصى من إعادة التوليد لهذه الرسالة.', paywallMessage: 'توليد خطابات التغطية بعد الحد المجاني هو ميزة Pro. قم بالترقية إلى Pro لتوليد خطابات تغطية غير محدودة بالذكاء الاصطناعي.', downloadCl: 'تنزيل خطاب التقديم', generateSubtitle: 'مُخصَّص للوظيفة والشركة', aiDisclaimer: 'قد يحتوي المحتوى المُنشأ بواسطة الذكاء الاصطناعي على أخطاء. يُرجى مراجعة جميع النصوص المُنشأة بواسطة الذكاء الاصطناعي قبل الإرسال.' },
  auth: { login: 'دخول', register: 'إنشاء حساب', email: 'البريد', password: 'كلمة المرور', confirmPassword: 'تأكيد المرور', name: 'الاسم', forgotPassword: 'نسيت السر؟', noAccount: 'ليس لديك حساب؟', hasAccount: 'لديك حساب؟', invalidCredentials: 'بيانات الاعتماد غير صالحة.', emailTaken: 'البريد الإلكتروني مسجل بالفعل.' },
  dashboard: { title: 'لوحة التحكم', myCVs: 'سيري الذاتية', myCoverLetters: 'خطاباتي', createNew: 'إنشاء جديد', edit: 'تعديل', delete: 'حذف', lastEdited: 'آخر تعديل', upgrade: 'ترقية لبرو', plan: 'الخطة الحالية', welcome: 'أهلاً بك', noCVs: 'لا توجد سير حالياً.', noLetters: 'لا توجد خطابات حالياً.', untitled: 'بدون عنوان', cvDeleted: 'تم حذف السيرة', letterDeleted: 'تم حذف الخطاب', loginRequired: 'يرجى الدخول للوحة التحكم.', upgradeBanner: 'تتضمن سيرة ذاتية واحدة وخطاب تقديم واحد.' },
  common: { save: 'حفظ', cancel: 'إلغاء', back: 'رجوع', next: 'التالي', loading: 'جاري التحميل...', proAccessRequired: 'يلزم وصول Pro. يُرجى الترقية للمتابعة.', proAuthorizationUnavailable: 'تتم مزامنة تفويض Pro. يُرجى المحاولة بعد قليل.', error: 'حدث خطأ', success: 'تم بنجاح!', darkMode: 'الوضع الداكن', lightMode: 'الوضع الفاتح', language: 'اللغة', legal: 'قانوني', previewBadge: 'قالب مجاني', slide: 'شريحة', appName: 'CV Pro AI', docx: 'DOCX' },
  footer: { rights: '© 2026 CV Pro AI. جميع الحقوق محفوظة.', privacy: 'الخصوصية', terms: 'الشروط', backToHome: 'العودة للرئيسية' },
  templates: {
    title: 'القوالب', subtitle: '13 قالب احترافي.', showcase: 'معرض القوالب', showcaseSubtitle: 'مصمم للمعايير العالمية.', freeCount: 'مجاني — 3 قوالب', proCount: 'برو — 10 قوالب مميزة', proBadge: 'PRO', unlockPro: 'فتح جميع القوالب بـ 3.99$', browseAll: 'تصفح الكل',
    categories: { ats: 'متوافق مع ATS', creative: 'إبداعي', executive: 'تنفيذي', modern: 'عصري', japanese: 'ياباني' },
    items: {
      'modern-minimal': { name: 'عصري بسيط', description: 'تصميم واضح وجاهز لـ ATS — يُلفت انتباه المسؤولين عن التوظيف فوراً.', category: 'متوافق مع ATS' },
      'clean-simple': { name: 'نظيف وبسيط', description: 'واضح وفعّال — مثالي للطلاب وأول طلب توظيف ناجح.', category: 'متوافق مع ATS' },
      'professional-classic': { name: 'احترافي كلاسيكي', description: 'خالد وموثوق — المفضل لدى المسؤولين عن التوظيف في جميع القطاعات.', category: 'متوافق مع ATS' },
      'creative-bold': { name: 'إبداعي جريء', description: 'تميّز على الفور بتصميم جريء مصمم خصيصاً للمجالات الإبداعية.', category: 'إبداعي' },
      'creative-artistic': { name: 'إبداعي فني', description: 'عبّر عن شخصيتك بأسلوب عصري يترك انطباعاً لا يُنسى.', category: 'إبداعي' },
      'elegant-formal': { name: 'رسمي أنيق', description: 'راقٍ وموقر — مثالي للمناصب القيادية التي تتطلب أفضل الانطباعات.', category: 'تنفيذي' },
      'ats-standard': { name: 'معياري ATS', description: 'عظّم فرصك في اجتياز كل فلتر انتقاء آلي والوصول للمقابلة.', category: 'متوافق مع ATS' },
      'executive-premium': { name: 'تنفيذي فاخر', description: 'تصميم قيادي رفيع المستوى يضمن أن كل كلمة تحسب لصالحك.', category: 'تنفيذي' },
        'nordic-clean': { name: 'نوردي نظيف', description: 'تصميم هادئ ومركّز — تجربتك تتحدث بوضوح دون تشتيت.', category: 'عصري' },
        'tech-sidebar': { name: 'تقني جانبي', description: 'هيكل بعمودين يُبرز مهاراتك وخبراتك بأقصى تأثير.', category: 'عصري' },
        'corporate-navy': { name: 'أزرق مؤسسي', description: 'قوي وواثق — يوصل رسالة الثقة من النظرة الأولى.', category: 'تنفيذي' },
        'modern-minimal-executive': { name: 'تنفيذي بسيط حديث', description: 'حضور قيادي عصري مع شريط جانبي منظم.', category: 'تنفيذي' },
        'contemporary-bold': { name: 'جريء معاصر', description: 'تصميم قوي ومنظم للأدوار التقنية والشركات الناشئة الطموحة.', category: 'عصري' },
        'rirekisho': { name: 'Rirekisho', description: 'نموذج السيرة الذاتية الياباني الأصيل — يتوافق تماماً مع معايير التوظيف المحلية.', category: 'ياباني' }
      }
    },
  legal: {
    privacy: {
      title: 'سياسة الخصوصية', effectiveDate: 'سارية من: أبريل 2026',
      sections: [
        { title: '1. المقدمة', content: 'تحترم CV Pro AI خصوصيتك وتلتزم بحماية بياناتك الشخصية. توضح سياسة الخصوصية هذه كيفية جمع بياناتك واستخدامها وحمايتها عند استخدام أداة إنشاء السيرة الذاتية وخطاب التقديم بالذكاء الاصطناعي.' },
        { title: '2. البيانات التي نجمعها', content: 'عند استخدام التطبيق، قد نجمع المعلومات التالية:', items: ['الاسم (إذا أدخلته)', 'البريد الإلكتروني (إذا أدخلته)', 'محتوى السيرة الذاتية الذي تدخله', 'بيانات استخدام أساسية وتحليلات'] },
        { title: '3. كيفية استخدام بياناتك', content: 'تُستخدم بياناتك حصرياً للأغراض التالية:', items: ['إنشاء السير الذاتية وخطابات التقديم', 'تحسين ميزات الذكاء الاصطناعي وجودة التطبيق', 'توفير وظائف التطبيق الأساسية'] },
        { title: '4. معالجة الذكاء الاصطناعي', content: 'قد يتم إرسال مدخلاتك بشكل آمن إلى مزودي الذكاء الاصطناعي الخارجيين لتوليد ملخصات السيرة الذاتية والنقاط الرئيسية وخطابات التقديم والمحتويات الأخرى المدعومة بالذكاء الاصطناعي. تتم معالجة البيانات فقط لغرض توليد المخرجات المطلوبة. لا تستخدم CV Pro AI محتواك لأغراض إعلانية.' },
        { title: '5. مشاركة البيانات', content: 'نحترم خصوصيتك ونتعامل مع بياناتك بمسؤولية:', items: ['نحن لا نبيع بيانات المستخدمين لأطراف ثالثة', 'لا تُشارك البيانات مع جهات خارجية إلا للخدمات الأساسية اللازمة لتشغيل التطبيق'] },
        { title: '6. تخزين البيانات وأمنها', content: 'تُخزَّن بيانات سيرتك الذاتية محلياً على جهازك. يستخدم التطبيق الحفظ التلقائي لتخزين المسودات قيد العمل محلياً على جهازك. قد يتم إرسال بعض المحتويات بشكل آمن عند استخدام ميزات الذكاء الاصطناعي التي تتطلب توليد المحتوى أو تحسينه. نطبق معايير أمان تشمل تشفير TLS لحماية البيانات أثناء النقل. تُتخذ تدابير معقولة لحماية جميع معلومات المستخدمين.', items: ['يتم الاحتفاظ بالمحتوى الذي ينشئه الذكاء الاصطناعي وبيانات المسودات فقط حسب الضرورة لتوفير الوظائف المطلوبة. تظل المسودات المخزنة محلياً تحت تحكم المستخدم ويمكن حذفها في أي وقت عن طريق مسح المسودة أو إعادة تعيين التطبيق.'] },
        { title: '7. حقوقك وحماية اللائحة العامة لحماية البيانات (GDPR)', content: 'لديك السيطرة الكاملة على بياناتك الشخصية. إذا كنت موجوداً في المنطقة الاقتصادية الأوروبية (EEA)، فلديك حقوق إضافية بموجب اللائحة العامة لحماية البيانات (GDPR):', items: ['طلب الوصول إلى بياناتك الشخصية', 'طلب حذف بياناتك (الحق في المحو)', 'طلب تصحيح البيانات غير الدقيقة', 'طلب تقييد المعالجة (مستخدمو المنطقة الاقتصادية الأوروبية)', 'قابلية نقل البيانات — استلام بياناتك بتنسيق منظم وقابل للقراءة آلياً (مستخدمو EEA)', 'سحب الموافقة في أي وقت عندما تعتمد المعالجة على الموافقة'] },
        { title: '8. ملفات تعريف الارتباط والتحليلات', content: 'قد يستخدم التطبيق أدوات تحليل أساسية لفهم أنماط الاستخدام وتحسين الأداء. لا تُشارك أي بيانات شخصية مع شبكات الإعلانات.' },
        { title: '9. المدفوعات والمشتريات', content: 'يتم معالجة مشتريات خطة Pro بشكل آمن من خلال معالجات دفع تابعة لجهات خارجية:', items: ['تتم معالجة المدفوعات عبر Apple App Store وGoogle Play Store وRevenueCat', 'CV Pro AI لا تقوم بجمع أو معالجة أو تخزين معلومات بطاقة الدفع الخاصة بك', 'تتم إدارة جميع بيانات الدفع مباشرة بواسطة متجر التطبيقات ومعالج الدفع المعني وفقاً لسياسات الخصوصية والأمان الخاصة بهما', 'قد يتم توفير التحقق من صحة الشراء وإدارة الحقوق عبر RevenueCat أو مزودي البنية التحتية للمدفوعات المماثلة.'] },
        { title: '10. خصوصية الأطفال', content: 'هذا التطبيق غير مخصص للمستخدمين دون سن 13 عاماً. لا نجمع عن قصد بيانات شخصية من الأطفال دون هذا السن. إذا اعتقدت أن طفلاً قدّم لنا بيانات، يرجى التواصل معنا فوراً.' },
        { title: '11. لا ضمانات', content: 'لا تضمن CV Pro AI التوظيف أو المقابلات أو عروض العمل أو نتائج التقديم. يظل المستخدمون مسؤولين عن مراجعة وتحرير والتحقق من جميع المحتويات المُنشأة قبل تقديمها إلى أصحاب العمل أو الأطراف الثالثة.' },
        { title: '12. التواصل', content: 'لأي استفسارات أو طلبات تتعلق بسياسة الخصوصية، تواصل معنا على help.cvappai@gmail.com.' }
      ]
    },
    terms: {
      title: 'شروط الخدمة', effectiveDate: 'سارية من: أبريل 2026',
      sections: [
        { title: '1. المقدمة', content: 'CV Pro AI أداة لإنشاء السيرة الذاتية وخطاب التقديم باستخدام مساعدة الذكاء الاصطناعي. باستخدامك للتطبيق، فأنت توافق على شروط الخدمة هذه.' },
        { title: '2. وصف الخدمة', content: 'CV Pro AI منشئ سيرة ذاتية وخطاب تقديم مدعوم بالذكاء الاصطناعي. يتضمن التطبيق خطة مجانية وخطة Pro. الخطة المجانية: تنزيل خطاب تقديم واحد ومحاولة توليد واحدة بالذكاء الاصطناعي. خطة Pro (دفعة واحدة 3.99$): تنزيلات غير محدودة، وتوليد ذكاء اصطناعي غير محدود، و10 قوالب مميزة، وأدوات إعادة الكتابة، ومحلل الوظائف.' },
        { title: '3. إخلاء مسؤولية الذكاء الاصطناعي', content: 'المحتوى الذي ينشئه الذكاء الاصطناعي مُقدَّم للمساعدة فقط وقد يستلزم مراجعة المستخدم. قد يحتوي على أخطاء أو تفاوتات أسلوبية. أنت المسؤول الوحيد عن مراجعة جميع النصوص المُولَّدة وتعديلها قبل تقديمها لأصحاب العمل.' },
        { title: '4. مسؤوليات المستخدم', content: 'أنت مسؤول عن دقة المعلومات التي تدخلها في التطبيق. تأكد من أن جميع البيانات صادقة ومحدَّثة. المسؤولية النهائية عن مواد تقديمك تقع عليك.' },
        { title: '5. الاستخدام المقبول', content: 'توافق على عدم إساءة استخدام التطبيق، وعدم رفع محتوى غير قانوني، وعدم استخدامه بأي طريقة تنتهك القوانين المعمول بها. قد يؤدي إساءة الاستخدام إلى تقييد الوصول.' },
        { title: '6. المدفوعات', content: 'خطة Pro متاحة بدفعة واحدة قدرها 3.99$ مع وصول مدى الحياة دون اشتراك أو تجديد تلقائي. إذا اشتريت Pro مسبقاً، استخدم زر "استعادة الشراء" في صفحة الأسعار.' },
        { title: '7. لا ضمانات', content: 'توفر CV Pro AI أدوات لمساعدتك في إنشاء السيرة الذاتية. لا نضمن أن استخدام التطبيق سيؤدي إلى عروض عمل أو مقابلات أو توظيف. تعتمد النتائج على عوامل عديدة خارجة عن إرادتنا.' },
        { title: '8. تحديد المسؤولية', content: 'يُقدَّم التطبيق "كما هو" دون أي ضمانات صريحة أو ضمنية. لن تتحمل CV Pro AI المسؤولية عن أي أضرار غير مباشرة أو تبعية ناجمة عن استخدام التطبيق.' },
        { title: '9. الإنهاء', content: 'نحتفظ بالحق في تقييد أو إنهاء الوصول إلى التطبيق في حالة انتهاك هذه الشروط، بما في ذلك إساءة الاستخدام أو النشاط غير القانوني.' },
        { title: '10. تغييرات الشروط', content: 'قد نقوم بتحديث هذه الشروط من وقت لآخر. استمرار استخدامك للتطبيق بعد نشر التغييرات يُعدّ قبولاً للشروط المحدَّثة.' },
        { title: '11. التواصل', content: 'للدعم أو الاستفسارات حول هذه الشروط، تواصل معنا على help.cvappai@gmail.com.' }
      ]
    }
  },
    comparison: {
      title: 'شاهد الفرق', subtitle: 'مقارنة بين المجاني والبرو.', freePlan: 'الخطة المجانية', proPlan: 'خطة برو', good: 'جيد', hireReady: 'جاهز للتوظيف', proBadge: 'PRO', freeFeatures: ['تنسيق بسيط', 'هرمية بصرية دنيا', 'تباعد قياسي'], proFeatures: ['طباعة مميزة', 'معايير عالمية', 'هيكل مصقول'], summary: 'الملخص', experience: 'الخبرة', expertise: 'الخبرة', languages: 'اللغات', chips: ['استراتيجية SEO', 'تحليلات', 'محتوى', 'بريد إلكتروني'], persuasiveText: 'تساعد التنسيقات الاحترافية سيرتك الذاتية على البروز في الأسواق التنافسية.'
    },
  previews: {
    name: 'أليكس جونسون', role: 'مدير منتج أول', email: 'alex@email.com', phone: '+1 555 123 456', location: 'برلين / نيويورك', experience: 'الخبرة', education: 'التعليم', skills: 'المهارات', contact: 'اتصال', headOfProduct: 'رئيس منتج', productManager: 'مدير منتج', jrPm: 'مدير منتج مبتدئ', techCorp: 'تيك كورب', startupXY: 'ستارتب اكس واي', digitalAgency: 'وكالة رقمية', techCorpDesc: 'قيادة فريق من 12، إطلاق 3 منتجات، نمو 40%.', startupDesc: 'خارطة الطريق، أبحاث المستخدمين، تحسين 28%.', agencyDesc: 'تسليم الميزات لـ 5 عملاء.', mba: 'ماجستير إدارة أعمال', columbia: 'جامعة كولومبيا', present: 'الحالي', now: 'الآن', productVision: 'رؤية المنتج', teamLeadership: 'القيادة', gtm: 'إستراتيجية GTM', dataAnalysis: 'تحليل البيانات', productStrategy: 'الإستراتيجية', uxResearch: 'أبحاث المستخدم', agile: 'أجايل / سكروم', techCorpYears: '2021–الحالي', startupYears: '2018–2021', educationYears: '2016–2018', agencyYears: '2016–2018'
  },
  onboarding: {
    title: 'أهلاً بك في منشئ السيرة الذاتية بالذكاء الاصطناعي ✨',
    subtitle: 'أنشئ سيرة ذاتية وخطاب تقديمي احترافي في دقائق. ابدأ مجاناً — ارقِ إلى Pro عندما تكون مستعداً.',
    freeLabel: 'مجاني',
    freeFeatures: ['3 نماذج قياسية', 'تنزيل خطاب واحد', 'محاولة إعادة توليد واحدة بالذكاء الاصطناعي', 'جميع 12 لغة'],
    proLabel: 'Pro — 3.99 دولار',
    proRecommendedBadge: 'موصى به',
    proFeatures: ['خطابات غير محدودة', 'أدوات إعادة الكتابة بالذكاء الاصطناعي', '10 نماذج متميزة', 'محلل الوظائف + الدعم الأولوي'],
    oneTimePayment: 'دفعة واحدة. لا اشتراك.',
    aiFeatureTitle: 'ميزات الذكاء الاصطناعي',
    aiFeatureDesc: 'يستخدم الذكاء الاصطناعي بياناتك فقط لإنشاء نصوص ولا يخزن البيانات بشكل دائم. يرجى مراجعة جميع النصوص التي ينشئها الذكاء الاصطناعي قبل الإرسال.',
    startFree: 'ابدأ مجاناً',
    upgradeToPro: 'ارقِ إلى Pro',
    secureCheckout: 'دفع آمن. تفعيل فوري. لا اشتراك.'
  },
  about: {
    hero: { badge: 'وصف Google Play ومتجر التطبيقات', title: 'CV Pro AI — منشئ السيرة الذاتية الذكي بالذكاء الاصطناعي', description: 'بناء سيرة ذاتية احترافية وفائزة في بضع دقائق. ابدأ مجاناً — قم بالترقية مرة واحدة ، استخدمها للأبد.', ageRating: 'تصنيف العمر: 3+', languages: '12 لغة', privacyFirst: 'الخصوصية أولاً' },
    description: { title: 'وصف التطبيق', paragraphs: ['CV Pro AI هو منشئ سيرة ذاتية وخطاب تقديم مدعوم بالذكاء الاصطناعي مصمم للباحثين عن عمل في جميع أنحاء العالم. قم بإنشاء سيرة ذاتية احترافية محسّنة لـ ATS في بضع دقائق باستخدام نماذج ذكية وأدوات الكتابة بالذكاء الاصطناعي.', 'متاح لأجهزة Android (Google Play) وiPhone (Apple App Store).', 'اختر من بين 13 نموذج احترافي — 3 مجاني ، 10 متميز. يساعدك مساعد الكتابة بالذكاء الاصطناعي على صياغة نقاط مقنعة وملخصات احترافية وخطابات تقديم مخصصة مصممة لوظيفتك المستهدفة والشركة.', 'يضمن الدعم ل 12 لغة ، بما في ذلك العربية (RTL) واليابانية والهندية (الهند) والمزيد ، أن تتمكن من بناء سيرة ذاتية جاهزة للعمل لأي سوق. يقوم التحسين الإقليمي بتكييف سيرتك الذاتية تلقائياً لمعايير سوق العمل في الولايات المتحدة والاتحاد الأوروبي والبلقان والشرق الأوسط والهند واليابان.', 'الخطة المجانية: قم بإنشاء سيرتك الذاتية ، وقم بتنزيل خطاب تقديم واحد تم إنشاؤه بواسطة الذكاء الاصطناعي ، واستخدم محاولة إعادة توليد واحدة — لا تتطلب حساب.', 'خطة Pro (3.99 دولار لمرة واحدة): افتح خطابات تقديم غير محدودة تم إنشاؤها بواسطة الذكاء الاصطناعي ، وأدوات إعادة الكتابة بالذكاء الاصطناعي ، وجميع النماذج المتميزة العشرة ، ومحلل وصف الوظيفة ، والدعم الأولوي. دفعة واحدة. لا اشتراك. لا تجديد.'] },
    features: { title: 'الميزات المجانية مقابل Pro', free: { label: 'مجاني — 0 دولار', items: ['3 نماذج قياسية (متوافقة مع ATS)', 'تنزيل خطاب تقديم واحد تم إنشاؤه بواسطة الذكاء الاصطناعي', 'محاولة إعادة توليد واحدة لخطاب التقديم', 'توليد ملخص احترافي بالذكاء الاصطناعي', 'جميع 12 لغة', 'تصدير DOCX', 'تحسين السيرة الذاتية الإقليمية'], disabledItems: ['أدوات إعادة الكتابة بالذكاء الاصطناعي', 'محلل وصف الوظيفة', '10 نماذج متميزة', 'خطابات تقديم غير محدودة'] }, pro: { label: 'Pro — 3.99 دولار لمرة واحدة', price: 'لمرة واحدة 3.99 دولار', items: ['10 نماذج متميزة (+ 3 مجاني)', 'خطابات تقديم غير محدودة تم إنشاؤها بواسطة الذكاء الاصطناعي', 'إعادة توليد خطابات تقديم غير محدودة', 'توليد ملخص احترافي بالذكاء الاصطناعي', 'أدوات إعادة الكتابة بالذكاء الاصطناعي (تقصير ، تعزيز ، احترافية)', 'محلل وصف الوظيفة', 'جميع 12 لغة', 'تصدير DOCX', 'تحسين السيرة الذاتية الإقليمية', 'الدعم الأولوي'], footer: 'دفعة واحدة. لا اشتراك. لا تجديد.' } },
    aiDisclosure: { title: 'كيفية استخدام الذكاء الاصطناعي في هذا التطبيق', items: ['يستخدم التطبيق خدمات الذكاء الاصطناعي من جهات خارجية لإنشاء ملخصات السيرة الذاتية والنقاط الرئيسية ونص خطاب التقديم.', 'يتم معالجة مدخلات المستخدم (عنوان الوظيفة واسم الشركة وتفضيل النبرة والخبرة المهنية) من قبل خدمات الذكاء الاصطناعي فقط لإنشاء نصوص.', 'لا يتم تخزين مدخلات المستخدم بشكل دائم بواسطة التطبيق أو خدمات الذكاء الاصطناعي.', 'قد يحتوي المحتوى الذي ينشئه الذكاء الاصطناعي على عدم دقة. المستخدمون مسؤولون عن مراجعة جميع المحتويات قبل تقديمها لأصحاب العمل.', 'زر الذكاء الاصطناعي موسوم بوضوح: "إنشاء مع الذكاء الاصطناعي ✨"'] },
    ageAndContent: { title: 'تصنيف العمر وتحذير المحتوى', ageRating: 'تصنيف العمر: 3+', ageRatingDesc: 'مناسب لجميع الأعمار. بدون محتوى للبالغين.', disclaimer: 'قد يحتوي المحتوى الذي ينشئه الذكاء الاصطناعي على عدم دقة وأخطاء نحوية أو مشاكل محددة للسياق. المستخدمون مسؤولون بالكامل عن مراجعة وتحرير والتحقق من جميع النصوص التي أنشأها الذكاء الاصطناعي قبل تقديمها لأصحاب العمل أو الجهات الثالثة.', noLiability: 'يوفر CV Pro AI أدوات للمساعدة في إنشاء السيرة الذاتية وخطابات التقديم. نحن لا نقدم أي ضمانات بشأن نتائج التوظيف. استخدام المحتوى الذي ينشئه الذكاء الاصطناعي يتم على مسؤولية المستخدم.', privacy: 'يتم تخزين بيانات السيرة الذاتية محلياً على جهاز المستخدم. لا تُباع المعلومات الشخصية ولا تُشارك مع جهات خارجية لأغراض التسويق.' },
    languages: { title: 'اللغات المدعومة', list: ['English', 'Deutsch (German)', 'Español (Spanish)', 'Français (French)', 'Italiano (Italian)', 'العربية (Arabic) — RTL', 'Srpski (Serbian)', 'Hrvatski (Croatian)', 'Русский (Russian)', 'Português (Brazil)', 'हिन्दी (Hindi)', '日本語 (Japanese)'] },
    restorePurchase: { title: 'استعادة الشراء', description: 'إذا اشتريت Pro مسبقاً وتحتاج إلى استعادة الوصول ، فاضغط على زر "استعادة الشراء" على صفحة الأسعار. سيتم استعادة وصول Pro على الفور على الجهاز الحالي. إذا واجهت أي مشاكل ، اتصل بنا على help.cvappai@gmail.com.' },
    legal: { title: 'قانوني', privacyPolicy: 'سياسة الخصوصية', termsOfService: 'شروط الخدمة', contact: 'جهة الاتصال: help.cvappai@gmail.com', viewPricing: 'عرض الأسعار والترقية إلى Pro' }
  }
};

const sr: TranslationKeys = {
  nav: { home: 'Početna', cvBuilder: 'CV Builder', coverLetter: 'Pismo', templates: 'Šabloni', pricing: 'Cene', about: 'O nama', contact: 'Kontakt', login: 'Prijava', register: 'Registracija', dashboard: 'Kontrolna tabla', logout: 'Odjava' },
  hero: { title: 'Napravite profesionalan CV za nekoliko minuta.', professionalResumesAiPowered: 'Profesionalni CV-jevi. Uz podršku veštačke inteligencije.', subtitle: 'AI generator sa premium šablonima i pametnom optimizacijom za posao.', valueDesc: 'Napravite profesionalnu biografiju za nekoliko minuta. Otključajte 10 premium šablona i napredne alate uz Pro.', cta: 'Napravi moj CV', ctaSecondary: 'Pogledaj šablone', badge: 'AI generator biografija', footerText: 'Jednokratno plaćanje. Doživotni pristup. Bez pretplate.' },
  features: { title: 'Sve što vam treba za uspeh.', subtitle: 'Moćni AI alati dizajnirani za globalno tržište', badge: 'Šta je uključeno', ai: { title: 'Pametno pisanje', desc: 'Automatski poboljšava jasnoću i strukturu.' }, multilingual: { title: 'Više jezika', desc: 'Napravite CV na 9 jezika istovremeno.' }, templates: { title: 'Premium šabloni', desc: '10 premium + 3 besplatna.' }, ats: { title: 'ATS-Friendly', desc: 'Prolazi sisteme za praćenje kandidata.' }, region: { title: 'Optimizacija regiona', desc: 'Prilagođavanje za SAD, EU, Balkan i Bliski istok.' }, export: { title: 'Izvoz u više formata', desc: 'Preuzmite kao DOCX ili kopirajte.' }, analyzer: { title: 'Analizator posla', desc: 'Uskladite CV sa oglasom za posao. Samo Pro.' } },
  howItWorks: { title: 'Kako funkcioniše', step: 'KORAK', step1: { title: 'Dodajte vaše informacije', desc: 'Unesite lične podatke, radno iskustvo i obrazovanje da biste počeli da gradite svoju biografiju.' }, step2: { title: 'Poboljšajte svoju biografiju', desc: 'Koristite pametne alate i sugestije da vaša biografija bude jača i profesionalnija.' }, step3: { title: 'Preuzmite svoju biografiju', desc: 'Izvezite gotovu biografiju u DOCX formatu, spremu za slanje poslodavcima.' } },
  whoIsThisFor: { title: 'Za koga je ovaj kreator biografija?', items: ['Osobe koje traže posao', 'Studenti i diplomci', 'Profesionalci koji menjaju karijeru', 'Svako ko želi modernu profesionalnu biografiju'] },
  privacyFirst: { title: 'Privatnost na prvom mestu', desc: 'Podaci vaše biografije ostaju na vašem uređaju. Ne čuvamo, ne prodajemo niti delimo vaše lične informacije.', local: 'Ovaj kreator biografija radi lokalno na vašem uređaju kako bi vaše informacije bile bezbedne.' },
  simplePricing: { title: 'Jednostavne cene', desc: 'Bez pretplate. Jednokratna kupovina za pristup svim Pro šablonima i naprednim alatima.' },
    pricing: { 
      title: 'Jednostavne cene.', 
      subtitle: 'Bez pretplata. Bez mesečnih naknada. Plati jednom.', 
      oneTime: '3.99$ jednokratno', 
      getStarted: 'Započni',
      footerText: 'Jednokratno plaćanje · Doživotni pristup · Bez pretplate',
          free: { name: 'Besplatno', price: '0$', features: ['3 standardna šablona', '1 CV preuzimanje', '1 propratno pismo', 'Svi jezici'], cta: 'Počni besplatno', desc: 'Krenite bez troškova.' }, 
        pro: { name: 'Pro', price: '3.99$', features: ['10 premium šablona', 'Neograničeno preuzimanje CV-a', 'Neograničena AI propratna pisma', 'Analizator posla', 'AI poboljšanja', 'Svi jezici'], cta: 'Pređi na Pro', desc: 'Plati jednom. Koristi zauvek.', badge: 'Pro — Doživotni pristup', footer: 'Sigurno plaćanje. Trenutna aktivacija.', noSubscription: 'Bez pretplate. Bez obnavljanja.' },
      tableTitle: 'Poređenje funkcija',
      tableHeaderFeature: 'Funkcija',
      tableHeaderFree: 'Besplatno',
      tableHeaderPro: 'Pro',
      tableRowCV: 'Preuzimanja CV-a',
      tableRowCoverLetter: 'Preuzimanja propratnog pisma',
      tableRowTemplates: 'Šabloni',
      tableRowAI: 'AI generisanje rezimea',
      tableRowRewrite: 'AI alati za prepisivanje',
      tableRowAnalyzer: 'Analizator opisa posla',
      tableRowLanguages: 'Svi jezici',
      tableRowSupport: 'Prioritetna podrška',
      unlimited: 'Neograničeno',
      threeStandard: '3 standardna',
      proTemplatesCount: '10 premium + 3 besplatna',
      oneCount: '1',
      popularBadge: 'Najpopularnije',
      bestValueBadge: 'Najbolja vrednost',
      coverLetterFreeValue: '1 preuzimanje propratnog pisma',
      coverLetterProValue: 'Neograničena propratna pisma generisana veštačkom inteligencijom',
      restoreTitle: 'Već ste kupili Pro?',
      restoreDesc: 'Povratite prethodnu kupovinu kako biste ponovo dobili Pro pristup na ovom uređaju.',
      restoreButton: 'Povrati kupovinu',
      proActive: 'Pro Aktivan',
      restoringText: 'Povraćaj...',
      needHelp: 'Potrebna pomoć?',
      fairUse: 'Mogu se primjenjivati ograničenja korišćenja radi sprečavanja zloupotrebe i osiguranja pouzdane usluge.'
    },

  faq: { title: 'Često postavljana pitanja', items: [
    { q: 'Šta je uključeno u besplatni plan?', a: 'Besplatni plan vam omogućava da kreirate 1 CV i generišete 1 propratno pismo. Možete koristiti i AI alate sa ograničenim pristupom za poboljšanje sadržaja.' },
    { q: 'Koliko propratnih pisama mogu da generišem besplatno?', a: 'Možete generisati 1 propratno pismo besplatno, uključujući 1 pokušaj regeneracije.' },
    { q: 'Šta se dešava nakon što koristim besplatno pismo?', a: 'Nakon korišćenja besplatnog pisma, možete preći na Pro za neograničena pisma i pun pristup AI funkcijama.' },
    { q: 'Šta dobijam sa Pro?', a: 'Pro vam daje neograničena propratna pisma, pun pristup svim AI alatima, premium šablone i napredne funkcije optimizacije CV-a.' },
    { q: 'Da li su AI funkcije besplatne?', a: 'Neke AI funkcije su dostupne besplatno sa ograničenom upotrebom. Pređite na Pro za neograničen pristup.' },
    { q: 'Mogu li koristiti aplikaciju na različitim jezicima?', a: 'Da, aplikacija podržava više jezika kako biste mogli kreirati CV i propratno pismo na željenom jeziku.' },
    { q: 'Da li su šabloni ATS-friendly?', a: 'Apsolutno. Svi naši šabloni su dizajnirani da prođu ATS sisteme koje koriste veliki poslodavci širom sveta.' },
    { q: 'Kako AI funkcioniše? Da li se moji podaci čuvaju?', a: 'AI koristi samo vaše unose (naziv posla, kompanija, ton itd.) za generisanje teksta. Vaši lični podaci se ne čuvaju trajno. Aplikacija koristi AI servise trećih strana za obradu zahteva.' },
    { q: 'Da li je AI-generisani sadržaj uvek tačan?', a: 'AI-generisani sadržaj može sadržati netačnosti. Molimo vas da pažljivo pregledate sve AI-generisane tekstove pre slanja poslodavcima. Korisnici su odgovorni za konačni sadržaj.' }
  ] },
  cv: { title: 'CV Builder', personal: 'Lični podaci', experience: 'Radno iskustvo', education: 'Obrazovanje', skills: 'Veštine', certifications: 'Sertifikati', languages: 'Jezici', summary: 'Profesionalni rezime', generate: 'Generiši sa AI', rewrite: 'Prepiši', translate: 'Prevedi', analyzeJob: 'Analiziraj oglas', download: 'Preuzmi', downloadCv: 'Preuzmi CV', downloadPdf: 'PDF', downloadDocx: 'DOCX', downloadPdfDesc: 'Preporučeno · Spremno za slanje', downloadDocxDesc: 'Verzija za uređivanje', downloadNote: 'PDF čuva izabrani dizajn. DOCX je za uređivanje i može imati manje razlike u izgledu u zavisnosti od Word-a, Google Docs-a ili mobilnih pregledača.', pdfExportFailed: 'Izvoz PDF-a nije uspeo. Pokušajte ponovo.',
    wordExportFailed: 'Word izvoz nije uspeo. Pokušajte ponovo.', preview: 'Pregled', selectTemplate: 'Izaberi šablon', jobTitle: 'Radno mesto', fullName: 'Ime i prezime', email: 'E-mail', phone: 'Telefon', address: 'Adresa', fathersName: 'Ime oca', nationality: 'Nacionalnost', dateOfBirth: 'Datum rodjenja', company: 'Kompanija', position: 'Pozicija', startDate: 'Početak', endDate: 'Kraj', present: 'Trenutno', description: 'Opis', degree: 'Stepen', school: 'Škola / Fakultet', addMore: 'Dodaj još', remove: 'Ukloni', region: 'Ciljni region', ready: 'Spremni za CV?', readySubtitle: 'Počni besplatno. Nadogradi kad želiš.', edit: 'Uredi', copied: 'Kopirano!', copy: 'Kopiraj', jobTitlePlaceholder: 'npr. Softverski inženjer', fullNamePlaceholder: 'Ana Marković', aiBullets: 'AI Poboljšanja', skillPlaceholder: 'Unesite veštinu i pritisnite Enter', certPlaceholder: 'npr. AWS sertifikat', langPlaceholder: 'Jezik', levelPlaceholder: 'Nivo',       summaryPlaceholder: 'Napišite ili generišite svoj rezime...',
      jobDescPlaceholder: 'Ovde nalepite oglas za posao...',
      short: 'Kraće',
 strong: 'Jače', professional: 'Profesionalno', keywordsFound: 'Pronađene reči', suggestions: 'Sugestije', suggestedSkills: 'Preporučene veštine', skillCategories: { technical: 'Tehničke veštine', soft: 'Meke veštine' }, aiRecommend: 'AI preporuka', recommendedToast: 'Preporučeno', recommendedForYou: '⭐ Preporučeno za vas', bestResultsTemplate: 'Najbolji rezultati sa ovim šablonom', optimizedForProfile: 'Optimizovano za vaš profil', unlockWithPro: 'Otključajte šablon sa Pro', saveRequired: 'Prijavite se da sačuvate CV.', saved: 'CV sačuvan!', draftSaved: 'Draft saved', genSuccess: 'Rezime generisan!', bulletsSuccess: 'AI Poboljšanja primenjena!', rewriteSuccess: 'Prepisano', levels: { native: 'Maternji', fluent: 'Tečan', advanced: 'Napredni', intermediate: 'Srednji', basic: 'Osnovni' }, regions: { us: 'SAD', eu: 'EU', balkan: 'Balkan', middleEast: 'Bliski istok', india: 'Indija', japan: 'Japan' }, gender: 'Pol', genderMale: 'Muški', genderFemale: 'Ženski', genderOther: 'Ostalo', coverLetterSection: 'Propratno pismo', photo: { title: 'Profilna fotografija', optional: '(Opciono)', shown: 'Prikazana u CV-u', hidden: 'Skrivena u CV-u', shownDesc: 'Prikazana podrazumevano za vaš region', hiddenDesc: 'Fotografija je skrivena.', change: 'Promeni fotografiju', upload: 'Otpremi fotografiju', recrop: 'Ponovo iseči', remove: 'Ukloni fotografiju', hint: 'JPG ili PNG, max 5MB.', aiEnhance: 'AI poboljšanje fotografije', aiEnhancing: 'Poboljšavanje...', applied: 'Primenjeno', upgrade: 'Nadogradi na Pro', features: ['Zamućenje pozadine', 'Osvetljenost i kontrast', 'Prirodan ton kože', 'Automatsko centriranje'], cropTitle: 'Iseči fotografiju', cropHint: 'Prevuci za repozicioniranje', apply: 'Primeni isecanje', usRegion: 'Skrivena podrazumevano (region SAD)', otherRegion: 'Prikazana podrazumevano za vaš region', errorFormat: 'Otpremite JPG ili PNG sliku.' }, industryLabel: 'Industrija', levelLabel: 'Nivo', industryPlaceholder: 'Izaberite industriju', industries: { tech: 'IT / Razvoj softvera', data_ai: 'Podaci / AI / Mašinsko učenje', cybersecurity: 'Sajber bezbednost', sales_retail: 'Prodaja (Maloprodaja)', sales_b2b: 'Prodaja (B2B)', marketing: 'Marketing / Digitalni marketing', sales: 'Prodaja', finance: 'Finansije / Računovodstvo', banking_fintech: 'Bankarstvo / FinTeh', healthcare: 'Zdravstvo / Medicina', pharmacy: 'Farmacija', education: 'Obrazovanje / Nastava', human_resources: 'Ljudski resursi', customer_service: 'Korisnička podrška / Kol centar', logistics: 'Logistika / Lanac snabdevanja', operations: 'Operacije / Produkcija', executive: 'Menadžment / Liderstvo', project_management: 'Upravljanje projektima', design: 'Dizajn / UX / UI', engineering: 'Inženjerstvo (Mašinsko / Elektro)', construction: 'Građevinarstvo / Arhitektura', hospitality: 'Hotelijerstvo / Turizam', legal: 'Pravo', administration: 'Administracija / Kancelarija', general: 'Opšte' }, bulletLevels: { entry: 'Početni nivo', mid: 'Srednji nivo', senior: 'Senior nivo', lead: 'Vođa / Direktor' }, aiExperienceIntro: '✨ Unapredite radno iskustvo uz AI', aiExperienceIntroSub: 'Pišite snažnije, jasnije i profesionalnije opise za nekoliko sekundi.', aiSummaryIntro: '✨ Kreirajte moćan profesionalni rezime', aiSummaryIntroSub: 'Generišite ili poboljšajte rezime kako biste se istakli recruitima.', generateSubtext: 'Snažan rezime za nekoliko sekundi', shorterSubtext: 'Sažetiji i jasniji tekst', strongerSubtext: 'Istaknite dostignuća i rezultate', professionalSubtext: 'Poboljšajte ton i formulacije', aiBulletsSubtext: 'Iskustvo u snažne tačke', analyzeJobSubtext: 'Uskladite CV sa zahtevima oglasa', analyzeJobProOnly: 'Analiza opisa posla dostupna je samo u Pro planu.', aiRecommendSubtext: 'Pronađite najbolji šablon za vas', proHint: 'Preporučeno', proHintPopular: 'Najpopularnije', jobAnalysis: { title: 'Analiza vašeg CV-a', subtitle: 'Koliko vaš CV odgovara ovom oglasu', matchScore: 'Podudaranje', matchGood: 'Dobro podudaranje — ali može bolje', matchAverage: 'Srednje podudaranje — pronađeno nekoliko praznina', matchWeak: 'Slabo podudaranje — potrebna značajna poboljšanja', keyInsights: 'Ključni uvidi', insight1: 'Pronađeno relevantno iskustvo', insight2: 'Nedostaju ključne veštine', insight3: 'Slabi opisi dostignuća', importantKeywords: 'Važne ključne reči', unlockFull: 'Otključajte punu listu sa Pro', suggestedImprovements: 'Predložena poboljšanja', improve1: 'Dodajte merljive rezultate', improve2: 'Koristite snažnije glagole', improve3: 'Uključite nedostajuće veštine', proCardTitle: 'Poboljšajte CV odmah', proCardText: 'Otključajte potpunu analizu, sve ključne reči i AI poboljšanja', proCardCta: 'Nadogradi na Pro', proCardNote: 'Jednokratno plaćanje', analyzing: 'Analiziranje vašeg CV-a...' } },
  coverLetter: { title: 'Builder pisma', firstName: 'Ime', lastName: 'Prezime', gender: 'Pol', genderMale: 'Muški', genderFemale: 'Ženski', genderPreferNot: 'Radije ne navodim', identitySection: 'Vaši podaci', jobTitle: 'Pozicija', companyName: 'Naziv firme',tone: 'Ton', tones: { formal: 'Formalan', confident: 'Siguran', friendly: 'Prijateljski' }, generate: 'Generiši pismo', generating: 'Generisanje vašeg pisma…', regenerate: 'Regeneriši', regenerating: 'Regenerisanje…', regenerateSubtitle: 'Dobijte novu varijaciju', edit: 'Uredi', companyPlaceholder: 'npr. Google', firstNamePlaceholder: 'Ana', lastNamePlaceholder: 'Marković', genSuccess: 'Pismo generisano!', saved: 'Sačuvano!', draftSaved: 'Draft saved', placeholder: 'Vaše pismo će se pojaviti ovde...', preview: 'Pregled', filename: 'Propratno Pismo',regenLeft: 'preostalo', regenExhausted: 'Dostigli ste maksimalan broj regeneracija za ovo pismo.', paywallMessage: 'Generisanje pisama iznad besplatnog limita je Pro funkcija. Nadogradite na Pro za neograničena AI pisma.', downloadCl: 'Preuzmi propratno pismo', generateSubtitle: 'Prilagođeno poslu i kompaniji', aiDisclaimer: 'AI-generisani sadržaj može sadržati netačnosti. Molimo vas da pregledate sav AI-generisani tekst pre nego što ga pošaljete.' },
  auth: { login: 'Prijava', register: 'Napravi nalog', email: 'Email', password: 'Lozinka', confirmPassword: 'Potvrdi lozinku', name: 'Ime', forgotPassword: 'Zaboravili lozinku?', noAccount: 'Nemate nalog?', hasAccount: 'Već imate nalog?', invalidCredentials: 'Neispravni podaci.', emailTaken: 'Email je već registrovan.' },
  dashboard: { title: 'Kontrolna tabla', myCVs: 'Moje biografije', myCoverLetters: 'Moja pisma', createNew: 'Napravi novo', edit: 'Uredi', delete: 'Obriši', lastEdited: 'Poslednja izmena', upgrade: 'Nadogradi na Pro', plan: 'Trenutni plan', welcome: 'Dobrodošli nazad', noCVs: 'Još uvek nema CV-a.', noLetters: 'Još uvek nema pisama.', untitled: 'Bez naslova', cvDeleted: 'CV obrisan', letterDeleted: 'Pismo obrisano', loginRequired: 'Prijavite se.', upgradeBanner: 'Uključen 1 CV i 1 propratno pismo.' },
  common: { save: 'Sačuvaj', cancel: 'Otkaži', back: 'Nazad', next: 'Dalje', loading: 'Učitavanje...', proAccessRequired: 'Potreban je Pro pristup. Nadogradite da nastavite.', proAuthorizationUnavailable: 'Pro autorizacija se sinhronizuje. Pokušajte ponovo za trenutak.', error: 'Nešto nije u redu', success: 'Uspešno!', darkMode: 'Tamni mod', lightMode: 'Svetli mod', language: 'Jezik', legal: 'Pravno', previewBadge: 'Besplatan šablon', slide: 'Slajd', appName: 'CV Pro AI', docx: 'DOCX' },
  footer: { rights: '© 2026 CV Pro AI. Sva prava zadržana.', privacy: 'Privatnost', terms: 'Uslovi korišćenja', backToHome: 'Nazad na početnu' },
    templates: {
      title: 'Šabloni', subtitle: '13 profesionalnih šablona.', showcase: 'Prikaz šablona', showcaseSubtitle: 'Dizajnirani za moderne standarde.', freeCount: 'Besplatno — 3 šablona', proCount: 'Pro — 10 premium šablona', proBadge: 'PRO', unlockPro: 'Otključaj sve šablone za 3.99$', browseAll: 'Pretraži sve',
      categories: { ats: 'ATS kompatibilno', creative: 'Kreativni', executive: 'Menadžerski', modern: 'Moderni', japanese: 'Japanski' },
      items: {
        'modern-minimal': { name: 'Moderni minimalizam', description: 'Čist, ATS-spreman dizajn koji vrbaci primeći odmah.', category: 'ATS kompatibilno' },
        'clean-simple': { name: 'Čist i jednostavan', description: 'Jasan i direktan — idealan za studente i prve prijave za posao.', category: 'ATS kompatibilno' },
        'professional-classic': { name: 'Profesionalna klasika', description: 'Bezvremenska elegancija kojoj vrbaci veruju u svim industrijama.', category: 'ATS kompatibilno' },
        'creative-bold': { name: 'Kreativni i odvažni', description: 'Istaknite se odmah hrabrim dizajnom koji impresionira u kreativnim branšama.', category: 'Kreativni' },
        'creative-artistic': { name: 'Kreativni umetnički', description: 'Pokažite svoju ličnost modernim dizajnom koji ostavlja trajan utisak.', category: 'Kreativni' },
        'elegant-formal': { name: 'Elegantni formalni', description: 'Uglađen i autoritativan — savršen za rukovodeće pozicije.', category: 'Menadžerski' },
        'ats-standard': { name: 'ATS standardni', description: 'Maksimizujte šanse da prođete svaki automatski filter selekcije.', category: 'ATS kompatibilno' },
        'executive-premium': { name: 'Menadžerski premium', description: 'Premium dizajn za C-nivo lidera koji ne ostavljaju ništa slučaju.', category: 'Menadžerski' },
        'nordic-clean': { name: 'Nordijski čisti', description: 'Smiren i fokusiran raspored — vaše iskustvo govori samo za sebe.', category: 'Moderni' },
        'tech-sidebar': { name: 'Tehnološki s bočnom trakom', description: 'Dvokolonska struktura koja optimalno prikazuje veštine i iskustvo.', category: 'Moderni' },
        'corporate-navy': { name: 'Korporativni teget', description: 'Snažan i samopouzdan — ostavlja jak utisak na prvi pogled.', category: 'Menadžerski' },
        'modern-minimal-executive': { name: 'Moderni minimalni menadžerski', description: 'Moderna rukovodeća prisutnost sa strukturiranom bočnom trakom.', category: 'Menadžerski' },
        'contemporary-bold': { name: 'Savremeni odvažni', description: 'Jak, strukturiran dizajn za tech i startup uloge koje traže pažnju.', category: 'Moderni' },
        'rirekisho': { name: 'Rirekisho', description: 'Autentični japanski format biografije — usklađen sa lokalnim standardima.', category: 'Japanski' }
      }
    },
  onboarding: {
    title: 'Dobrodošli u Graditelj CV-a sa AI ✨',
    subtitle: 'Napravite profesionalni CV i motivaciono pismo za nekoliko minuta. Počnite besplatno — nadogradite kada budete spremni.',
    freeLabel: 'Besplatno',
    freeFeatures: ['3 Standardna Šablona', '1 preuzimanje pisma', '1 pokušaj regenerisanja AI', 'Svih 12 jezika'],
    proLabel: 'Pro — 3,99 $',
    proRecommendedBadge: 'PREPORUČENO',
    proFeatures: ['Neograničena Pisma', 'AI Alati za Prepisivanje', '10 Premijum Šablona', 'Analizator Poslova + Prioritetna Podrška'],
    oneTimePayment: 'Jednokratna isplata. Nema pretplate.',
    aiFeatureTitle: 'AI Karakteristike',
    aiFeatureDesc: 'AI koristi vaše ulazne podatke samo za generisanje teksta i ne skladišti podatke trajno. Molimo pregledajte sav tekst generisan AI pre slanja.',
    startFree: 'Počnite Besplatno',
    upgradeToPro: 'Nadogradite na Pro',
    secureCheckout: 'Sigurna plaćanja. Trenutna aktivacija. Nema pretplate.'
  },
  about: {
    hero: { badge: 'Opis za Google Play i App Store', title: 'CV Pro AI — Pametni generator CV-a sa AI', description: 'Napravite profesionalni i pobjeđujući CV za nekoliko minuta. Počnite besplatno — unapredite jednom, koristite zauvek.', ageRating: 'Starosna granica: 3+', languages: '12 jezika', privacyFirst: 'Privatnost prvo' },
    description: { title: 'Opis aplikacije', paragraphs: ['CV Pro AI je generator CV-a i propratnog pisma sa AI dizajniran za tražioce posla širom sveta. Napravite profesionalni CV optimizovan za ATS za nekoliko minuta koristeći pametne predloške i alate za pisanje sa AI.', 'Dostupno za Android (Google Play) i iPhone (Apple App Store).', 'Izaberite između 13 profesionalnih predložaka — 3 besplatna, 10 premijum. Asistent za pisanje sa AI vam pomaže da napišete ubedljive tačke, profesionalne rezimeje i personalizovana propratna pisma prilagođena vašoj ciljnoj poziciji i kompaniji.', 'Podrška za 12 jezika, uključujući arapski (RTL), japanski, hindi (Indija) i više, osigurava da možete napraviti CV spreman za posao za bilo koje tržište. Regionalna optimizacija automatski prilagođava vaš CV standardima tržišta rada SAD, EU, Balkana, Bliskog istoka, Indije i Japana.', 'Besplatni plan: Napravite vaš CV, preuzmite 1 propratno pismo generisano sa AI i koristite 1 pokušaj regeneracije — nije potreban račun.', 'Plan Pro (3,99 dolara jednom): Otključajte neograničena propratna pisma generisana sa AI, alate za prepisivanje sa AI, svih 10 premijum predložaka, analizator opisa posla i prioritetnu podršku. Jednokratna isplata. Nema pretplate. Nema onovljavanja.'] },
    features: { title: 'Besplatne naspram Pro funkcije', free: { label: 'Besplatno — 0 dolara', items: ['3 standardna predloška (ATS kompatibilna)', '1 preuzimanje propratnog pisma generisanog sa AI', '1 pokušaj regeneracije propratnog pisma', 'Generisanje profesionalnog rezimeja sa AI', 'Svih 12 jezika', 'DOCX izvoz', 'Regionalna optimizacija CV-a'], disabledItems: ['AI alati za prepisivanje', 'Analizator opisa posla', '10 premijum predložaka', 'Neograničena propratna pisma'] }, pro: { label: 'Pro — 3,99 dolara jednom', price: 'JEDNOM 3,99 dolara', items: ['10 premijum predložaka (+ 3 besplatna)', 'Neograničena propratna pisma generisana sa AI', 'Neograničene regeneracije propratnih pisama', 'Generisanje profesionalnog rezimeja sa AI', 'Alati za prepisivanje sa AI (Skrati, Ojačaj, Profesionalizuj)', 'Analizator opisa posla', 'Svih 12 jezika', 'DOCX izvoz', 'Regionalna optimizacija CV-a', 'Prioritetna podrška'], footer: 'Jednokratna isplata. Nema pretplate. Nema onovljavanja.' } },
    aiDisclosure: { title: 'Kako se AI koristi u ovoj aplikaciji', items: ['Aplikacija koristi servise AI treće strane za generisanje rezimeja CV-a, ključnih tačaka i teksta propratnog pisma.', 'Korisnički unosi (naziv pozicije, naziv kompanije, preferencija tona, radno iskustvo) obrađivani su servisima AI samo za generisanje teksta.', 'Korisnički unosi se trajno ne skladište od strane aplikacije ili servisa AI.', 'Sadržaj generisan sa AI može sadržati netačnosti. Korisnici su odgovorni za pregled sveog sadržaja pre slanja poslodavcima.', 'Dugme AI je jasno označeno: "Generišu sa AI ✨"'] },
    ageAndContent: { title: 'Starosna granica i upozorenje o sadržaju', ageRating: 'Starosna granica: 3+', ageRatingDesc: 'Odgovarajuće za sve uzraste. Bez sadržaja za odrasle.', disclaimer: 'Sadržaj generisan sa AI može sadržavati netačnosti, gramatičke greške ili probleme specifične za kontekst. Korisnici su potpuno odgovorni za pregled, uređivanje i verifikaciju sveeg teksta generisanog sa AI pre nego što ga pošalju poslodavcima ili trećim stranama.', noLiability: 'CV Pro AI pruža alate za pomoć pri kreiranju CV-a i propratnih pisama. Ne dajemo nikakvih garancija za ishode zaposlenja. Korišćenje sadržaja generisanog sa AI je na rizik korisnika.', privacy: 'Podaci CV-a se čuvaju lokalno na uređaju korisnika. Lični podaci se ne prodaju i ne dele sa trećim stranama u marketinške svrhe.' },
    languages: { title: 'Podržani jezici', list: ['English', 'Deutsch (German)', 'Español (Spanish)', 'Français (French)', 'Italiano (Italian)', 'العربية (Arabic) — RTL', 'Srpski (Serbian)', 'Hrvatski (Croatian)', 'Русский (Russian)', 'Português (Brazil)', 'हिन्दी (Hindi)', '日本語 (Japanese)'] },
    restorePurchase: { title: 'Povrati kupovinu', description: 'Ako ste ranije kupili Pro i trebate da povratite pristup, kosnitese dugmeta "Povrati kupovinu" na stranici Cene. Vaš Pro pristup će biti odmah vraćen na trenutnu uređaju. Ako naiđete na probleme, kontaktirajte nas na help.cvappai@gmail.com.' },
    legal: { title: 'Pravni', privacyPolicy: 'Politika privatnosti', termsOfService: 'Uslovi korišćenja', contact: 'Kontakt: help.cvappai@gmail.com', viewPricing: 'Prikaz cena i unapređenje na Pro' }
  },
  legal: {
    privacy: {
      title: 'Politika privatnosti', effectiveDate: 'Na snazi od: April 2026.',
      sections: [
        { title: '1. Uvod', content: 'CV Pro AI poštuje vašu privatnost i posvećena je zaštiti vaših ličnih podataka. Ova Politika privatnosti objašnjava kako prikupljamo, koristimo i čuvamo vaše informacije kada koristite naš AI alat za kreiranje CV-a i propratnih pisama.' },
        { title: '2. Podaci koje prikupljamo', content: 'Kada koristite aplikaciju, možemo prikupljati sledeće informacije:', items: ['Ime (ako ga unesete)', 'E-mail adresa (ako je unesete)', 'Sadržaj CV-a koji unosite', 'Osnovni podaci o korišćenju i analitika'] },
        { title: '3. Kako koristimo vaše podatke', content: 'Vaši podaci koriste se isključivo za sledeće svrhe:', items: ['Generisanje CV-a i propratnih pisama', 'Poboljšanje AI funkcija i kvaliteta aplikacije', 'Obezbeđivanje osnovne funkcionalnosti aplikacije'] },
        { title: '4. AI obrada', content: 'Vaši unosi mogu biti bezbedno prosleđeni spoljnim AI pružaocima radi generisanja sažetaka biografija, nabrajanja, propratnih pisama i drugog AI-podržanog sadržaja. Podaci se obrađuju isključivo u svrhu generisanja traženog izlaza. CV Pro AI ne koristi vaš sadržaj u reklamne svrhe.' },
        { title: '5. Deljenje podataka', content: 'Poštujemo vašu privatnost i odgovorno upravljamo vašim podacima:', items: ['Ne prodajemo korisničke podatke trećim stranama', 'Podaci se ne dele sa trećim stranama, osim sa neophodnim servisima za funkcionisanje aplikacije'] },
        { title: '6. Čuvanje i bezbednost podataka', content: 'Podaci vašeg CV-a čuvaju se lokalno na vašem uređaju. Aplikacija koristi automatsko čuvanje za skladištenje nacrta u izradi lokalno na vašem uređaju. Određeni sadržaj može biti bezbedno prosleđen kada koristite AI funkcije koje zahtevaju generisanje ili poboljšanje sadržaja. Primenjujemo standardne bezbednosne mere uključujući TLS enkripciju. Preduzimaju se razumne mere zaštite svih korisničkih informacija.', items: ['Sadržaj generisan od strane AI i podaci nacrta čuvaju se samo onoliko koliko je potrebno za pružanje tražene funkcionalnosti. Nacrti sačuvani lokalno ostaju pod kontrolom korisnika i mogu se izbrisati u bilo kom trenutku brisanjem nacrta ili resetovanjem aplikacije.'] },
        { title: '7. Vaša prava i GDPR zaštita', content: 'Imate punu kontrolu nad svojim ličnim podacima. Ako se nalazite u Evropskom ekonomskom prostoru (EEP), imate dodatna prava u skladu sa Opštom uredbom o zaštiti podataka (GDPR):', items: ['Zatražiti pristup vašim ličnim podacima', 'Zatražiti brisanje vaših podataka (pravo na zaborav)', 'Zatražiti ispravku netačnih podataka', 'Zatražiti ograničenje obrade (korisnici iz EEP)', 'Prenosivost podataka — primanje vaših podataka u strukturiranom, mašinski čitljivom formatu (korisnici iz EEP)', 'Povući saglasnost u bilo kom trenutku kada se obrada zasniva na saglasnosti'] },
        { title: '8. Kolačići i analitika', content: 'Aplikacija može koristiti osnovne alate za analitiku radi razumevanja obrazaca korišćenja i poboljšanja performansi. Lični podaci se ne dele sa reklamnim mrežama.' },
        { title: '9. Plaćanja i kupovine', content: 'Kupovine Pro plana se bezbedno obrađuju putem procesora plaćanja trećih strana:', items: ['Plaćanja se obrađuju putem Apple App Store, Google Play Store i RevenueCat', 'CV Pro AI NE prikuplja, ne obrađuje niti čuva podatke o vašoj platnoj kartici', 'Svi podaci o plaćanju se upravljaju direktno od strane odgovarajuće prodavnice aplikacija i procesora plaćanja u skladu sa njihovim sopstvenim politikama privatnosti i bezbednosti', 'Validacija kupovine i upravljanje dozvolama mogu se pružati putem RevenueCat ili sličnih provajdera platne infrastrukture.'] },
        { title: '10. Zaštita maloletnih lica', content: 'Ova aplikacija nije namenjena korisnicima mlađim od 13 godina. Ne prikupljamo namerno lične podatke od dece ispod 13 godina. Ako verujete da nam je dete pružilo lične podatke, odmah nas kontaktirajte.' },
        { title: '11. Nema garancija', content: 'CV Pro AI ne garantuje zaposlenje, intervjue, ponude za posao ili ishode prijava. Korisnici ostaju odgovorni za pregled, uređivanje i verifikaciju svih generisanih sadržaja pre nego što ih dostave poslodavcima ili trećim stranama.' },
        { title: '12. Kontakt', content: 'Za sva pitanja ili zahteve u vezi sa ovom Politikom privatnosti, kontaktirajte nas na help.cvappai@gmail.com.' }
      ]
    },
    terms: {
      title: 'Uslovi korišćenja', effectiveDate: 'Na snazi od: April 2026.',
      sections: [
        { title: '1. Uvod', content: 'CV Pro AI je alat za kreiranje biografija i propratnih pisama uz pomoć veštačke inteligencije. Korišćenjem aplikacije prihvatate ove Uslove korišćenja.' },
        { title: '2. Opis usluge', content: 'CV Pro AI je AI-powered kreator CV-a i propratnih pisama. Aplikacija nudi besplatan plan i Pro plan. Besplatni plan uključuje 1 preuzimanje propratnog pisma i 1 AI regeneraciju. Pro plan (jednokratno 3.99$) nudi neograničena preuzimanja, neograničenu AI generaciju, 10 premium šablona, AI alate za prepisivanje i analizator opisa posla.' },
        { title: '3. AI odricanje odgovornosti', content: 'Sadržaj koji generiše AI pruža se samo kao pomoć i može zahtevati proveru korisnika. Može sadržati netačnosti ili stilske varijacije. Vi ste jedini odgovorni za pregled i uređivanje svih AI-generisanih tekstova pre slanja poslodavcima.' },
        { title: '4. Odgovornosti korisnika', content: 'Vi ste odgovorni za tačnost informacija koje unosite u aplikaciju. Osigurajte da su svi podaci istiniti i ažurni. Konačna odgovornost za vaše materijale za prijavu je vaša.' },
        { title: '5. Prihvatljivo korišćenje', content: 'Saglašavate se da nećete zloupotrebljavati aplikaciju, postavljati ilegalni sadržaj niti je koristiti na način koji krši važeće zakone. Zloupotreba usluge može rezultirati ograničenjem pristupa.' },
        { title: '6. Plaćanja', content: 'Pro plan dostupan je za jednokratnu uplatu od 3.99$, što daje doživotni pristup bez pretplate ili automatskog obnavljanja. Ako ste ranije kupili Pro, koristite dugme "Povrati kupovinu" na stranici Cene.' },
        { title: '7. Bez garancija', content: 'CV Pro AI pruža alate za pomoć pri kreiranju CV-a. Ne garantujemo da će korišćenje aplikacije dovesti do ponuda za posao, intervjua ili zaposlenja. Rezultati zavise od mnogih faktora van naše kontrole.' },
        { title: '8. Ograničenje odgovornosti', content: 'Aplikacija se pruža "kakva jeste" bez ikakvih garancija. CV Pro AI ne snosi odgovornost za posrednu ili posledičnu štetu nastalu korišćenjem aplikacije.' },
        { title: '9. Raskid', content: 'Zadržavamo pravo da ograničimo ili prekinemo pristup aplikaciji u slučaju kršenja ovih Uslova, uključujući zloupotrebu, nezakonitu aktivnost ili zanemaranje usluge.' },
        { title: '10. Izmene Uslova', content: 'Možemo s vremena na vreme ažurirati ove Uslove. Nastavak korišćenja aplikacije nakon objave izmena smatra se prihvatanjem ažuriranih Uslova.' },
        { title: '11. Kontakt', content: 'Za podršku ili pitanja o ovim Uslovima, kontaktirajte nas na help.cvappai@gmail.com.' }
      ]
    }
  },
    comparison: {
      title: 'Vidi razliku', subtitle: 'Poređenje Besplatno vs Pro.', freePlan: 'Besplatan plan', proPlan: 'Pro plan', good: 'Dobro', hireReady: 'Spremno za posao', proBadge: 'PRO', freeFeatures: ['Osnovni raspored', 'Minimalna hijerarhija', 'Standardni razmak'], proFeatures: ['Premium tipografija', 'Međunarodni standard', 'Rafinisana struktura'], summary: 'Rezime', experience: 'Iskustvo', expertise: 'Ekspertiza', languages: 'Jezici', chips: ['SEO strategija', 'Analitika', 'Sadržaj', 'Email'], persuasiveText: 'Profesionalni rasporedi pomažu vašoj biografiji da se istakne na konkurentnim tržištima.'
    },
  previews: {
    name: 'Marko Marković', role: 'Senior Product Manager', email: 'marko@email.com', phone: '+381 11 123456', location: 'Beograd / NY', experience: 'Iskustvo', education: 'Obrazovanje', skills: 'Veštine', contact: 'Kontakt', headOfProduct: 'Rukovodilac proizvoda', productManager: 'Produkt menadžer', jrPm: 'Junior PM', techCorp: 'TechCorp', startupXY: 'StartupXY', digitalAgency: 'DigitalnaAgencija', techCorpDesc: 'Vođenje tima od 12, 3 proizvoda, +40% rast.', startupDesc: 'Planiranje, istraživanje, +28% retencija.', agencyDesc: 'Isporuka za 5 klijenata.', mba: 'MBA', columbia: 'Kolumbija Univerzitet', present: 'Trenutno', now: 'Sada', productVision: 'Vizija proizvoda', teamLeadership: 'Vođenje tima', gtm: 'Go-to-Market', dataAnalysis: 'Analiza podataka', productStrategy: 'Strategija', uxResearch: 'UX istraživanje', agile: 'Agile / Scrum', techCorpYears: '2021–Trenutno', startupYears: '2018–2021', educationYears: '2016–2018', agencyYears: '2016–2018'
  }
};

const hr: TranslationKeys = {
  nav: { home: 'Početna', cvBuilder: 'CV Builder', coverLetter: 'Pismo', templates: 'Predlošci', pricing: 'Cijene', about: 'O nama', contact: 'Kontakt', login: 'Prijava', register: 'Registracija', dashboard: 'Nadzorna ploča', logout: 'Odjava' },
  hero: { title: 'Napravite profesionalan CV za nekoliko minuta.', professionalResumesAiPowered: 'Profesionalni životopisi. Uz podršku umjetne inteligencije.', subtitle: 'AI generator s premium predlošcima i pametnom optimizacijom.', valueDesc: 'Napravite profesionalan životopis za nekoliko minuta. Otključajte 10 premium predložaka i napredne alate uz Pro.', cta: 'Napravi moj CV', ctaSecondary: 'Vidi predloške', badge: 'AI generator biografija', footerText: 'Jednokratno plaćanje. Doživotni pristup.' },
  features: { title: 'Sve što vam treba.', subtitle: 'Moćni AI alati za globalno tržište', badge: 'Što je uključeno', ai: { title: 'Pametno pisanje', desc: 'Poboljšava jasnoću i strukturu.' }, multilingual: { title: 'Više jezika', desc: 'Napravite CV na 9 jezika.' }, templates: { title: 'Premium predlošci', desc: '10 premium + 3 besplatna.' }, ats: { title: 'ATS-Friendly', desc: 'Prolazi sustave za odabir.' }, region: { title: 'Optimizacija regiona', desc: 'Prilagođavanje za SAD, EU i Balkan.' }, export: { title: 'DOCX format', desc: 'Preuzmite kao DOCX.' }, analyzer: { title: 'Analizator posla', desc: 'Uskladite CV s oglasom.' } },
  howItWorks: { title: 'Kako radi', step: 'KORAK', step1: { title: 'Dodajte vaše podatke', desc: 'Unesite osobne podatke, radno iskustvo i obrazovanje kako biste počeli graditi životopis.' }, step2: { title: 'Poboljšajte životopis', desc: 'Koristite pametne alate i prijedloge da vaš životopis bude jači i profesionalniji.' }, step3: { title: 'Preuzmite životopis', desc: 'Izvezite gotov životopis u DOCX formatu spreman za slanje poslodavcima.' } },
  whoIsThisFor: { title: 'Za koga je ovaj kreator životopisa?', items: ['Osobe koje traže posao', 'Studenti i diplomirani', 'Stručnjaci koji mijenjaju karijeru', 'Svako tko želi moderan profesionalan životopis'] },
  privacyFirst: { title: 'Privatnost na prvom mjestu', desc: 'Podaci vašeg životopisa ostaju na vašem uređaju. Ne pohranjujemo, prodajemo ni dijelimo vaše osobne podatke.', local: 'Ovaj kreator životopisa radi lokalno na vašem uređaju kako bi vaši podaci bili sigurni.' },
  simplePricing: { title: 'Jednostavne cijene', desc: 'Bez pretplate. Jednokratna kupnja za pristup svim Pro predlošcima i naprednim alatima.' },
    pricing: { 
      title: 'Jednostavne cijene.', 
      subtitle: 'Bez pretplata. Plati jednom.', 
      oneTime: '3.99$ jednokratno', 
      getStarted: 'Započni',
      footerText: 'Jednokratno plaćanje · Doživotni pristup · Bez pretplate',
          free: { name: 'Besplatno', price: '0$', features: ['3 standardna predloška', '1 CV preuzimanje', '1 propratno pismo', 'Svi jezici'], cta: 'Počni besplatno', desc: 'Krenite bez troškova.' }, 
          pro: { name: 'Pro', price: '3.99$', features: ['10 premium predložaka', 'Neograničeno preuzimanje CV-a', 'Neograničena AI propratna pisma', 'Analizator posla', 'AI poboljšanja', 'Svi jezici'], cta: 'Pređi na Pro', desc: 'Plati jednom. Koristi zauvijek.', badge: 'Pro — Doživotni pristup', footer: 'Sigurno plaćanje. Trenutna aktivacija.', noSubscription: 'Bez pretplate. Bez obnavljanja.' },
      tableTitle: 'Usporedba značajki',
      tableHeaderFeature: 'Značajka',
      tableHeaderFree: 'Besplatno',
      tableHeaderPro: 'Pro',
      tableRowCV: 'Preuzimanja CV-a',
      tableRowCoverLetter: 'Preuzimanja popratnog pisma',
      tableRowTemplates: 'Predlošci',
      tableRowAI: 'AI generiranje sažetka',
      tableRowRewrite: 'AI alati za prepisivanje',
      tableRowAnalyzer: 'Analizator opisa posla',
      tableRowLanguages: 'Svi jezici',
      tableRowSupport: 'Prioritetna podrška',
      unlimited: 'Neograničeno',
      threeStandard: '3 standardna',
      proTemplatesCount: '10 premium + 3 besplatna',
      oneCount: '1',
      popularBadge: 'Najpopularnije',
      bestValueBadge: 'Najbolja vrijednost',
      coverLetterFreeValue: '1 preuzimanje popratnog pisma',
      coverLetterProValue: 'Neograničena popratna pisma generirana umjetnom inteligencijom',
      restoreTitle: 'Već ste kupili Pro?',
      restoreDesc: 'Vratite prethodnu kupnju kako biste ponovo dobili Pro pristup na ovom uređaju.',
      restoreButton: 'Povrati kupnju',
      proActive: 'Pro Aktivan',
      restoringText: 'Vraćanje...',
      needHelp: 'Trebate pomoć?',
      fairUse: 'Mogu se primjenjivati ograničenja korištenja radi sprječavanja zlouporabe i osiguravanja pouzdane usluge.'
    },

  faq: {
    title: 'Česta pitanja',
    items: [
      { q: 'Što je uključeno u besplatni plan?', a: 'Besplatni plan vam omogućuje stvaranje 1 životopisa i generiranje 1 popratnog pisma. Možete koristiti i AI alate s ograničenim pristupom za poboljšanje sadržaja.' },
      { q: 'Koliko popratnih pisama mogu generirati besplatno?', a: 'Možete generirati 1 popratno pismo besplatno, uključujući 1 pokušaj regeneracije.' },
      { q: 'Što se dogodi nakon što koristim besplatno pismo?', a: 'Nakon korištenja besplatnog pisma, možete prijeći na Pro za neograničena pisma i pun pristup AI funkcijama.' },
      { q: 'Što dobivam s Pro?', a: 'Pro vam daje neograničena popratna pisma, pun pristup svim AI alatima, premium predloške i napredne funkcije optimizacije životopisa.' },
      { q: 'Jesu li AI funkcije besplatne?', a: 'Neke AI funkcije dostupne su besplatno s ograničenom upotrebom. Prijeđite na Pro za neograničen pristup.' },
      { q: 'Mogu li koristiti aplikaciju na različitim jezicima?', a: 'Da, aplikacija podržava više jezika kako biste mogli izraditi životopis i popratno pismo na željenom jeziku.' },
      { q: 'Jesu li predlošci ATS-friendly?', a: 'Apsolutno. Svi naši predlošci dizajnirani su da prođu ATS sustave koje koriste vodeći poslodavci diljem svijeta.' },
      { q: 'Kako radi AI? Pohranjuju li se moji podaci?', a: 'AI koristi samo vaše unose (naziv posla, tvrtka, ton itd.) za generiranje teksta. Vaši osobni podaci ne pohranjuju se trajno. Aplikacija koristi AI usluge trećih strana za obradu zahtjeva.' },
      { q: 'Je li AI-generiran sadržaj uvijek točan?', a: 'AI-generiran sadržaj može sadržavati netočnosti. Pregledajte sve AI-generirane tekstove pažljivo prije slanja poslodavcima. Korisnici su odgovorni za konačni sadržaj.' }
    ]
  },
  cv: {
    title: 'CV Builder',
    personal: 'Osobni podaci',
    experience: 'Radno iskustvo',
    education: 'Obrazovanje',
    skills: 'Vještine',
    certifications: 'Certifikati',
    languages: 'Jezici',
    summary: 'Profesionalni sažetak',
    generate: 'Generiraj s AI',
    rewrite: 'Prepiši',
    translate: 'Prevedi',
    analyzeJob: 'Analiziraj oglas',
    download: 'Preuzmi',
    downloadCv: 'Preuzmi CV',
    downloadPdf: 'PDF',
    downloadDocx: 'DOCX',
    downloadPdfDesc: 'Preporučeno · Spremno za slanje',
    downloadDocxDesc: 'Verzija za uređivanje',
    downloadNote: 'PDF čuva odabrani dizajn. DOCX je za uređivanje i može imati manje razlike u izgledu ovisno o Wordu, Google Docsu ili mobilnim preglednicima.',
    pdfExportFailed: 'Izvoz PDF-a nije uspio. Pokušajte ponovo.',
    wordExportFailed: 'Word izvoz nije uspio. Pokušajte ponovo.', preview: 'Pregled',
    selectTemplate: 'Izaberi predložak',
    jobTitle: 'Radno mjesto',
    fullName: 'Ime i prezime',
    email: 'E-mail',
    phone: 'Telefon',
    address: 'Adresa',
    fathersName: 'Ime oca',
    nationality: 'Nacionalnost',
    dateOfBirth: 'Datum rodjenja',
    company: 'Kompanija',
    position: 'Pozicija',
    startDate: 'Početak',
    endDate: 'Kraj',
    present: 'Trenutno',
    description: 'Opis',
    degree: 'Stupanj',
    school: 'Škola / Fakultet',
    addMore: 'Dodaj još',
    remove: 'Ukloni',
    region: 'Ciljna regija',
    ready: 'Spremni za CV?',
    readySubtitle: 'Počni besplatno. Nadogradi kad želiš.',
      edit: 'Uredi',
      copied: 'Kopirano!',
    copy: 'Kopiraj',
    jobTitlePlaceholder: 'npr. Softverski inženjer', fullNamePlaceholder: 'Ana Marković',
    aiBullets: 'AI Poboljšanja',
    skillPlaceholder: 'Unesite vještinu i pritisnite Enter',
    certPlaceholder: 'npr. AWS certifikat',
    langPlaceholder: 'Jezik',
    levelPlaceholder: 'Razina',
      summaryPlaceholder: 'Napišite ili generirajte sažetak...',
      jobDescPlaceholder: 'Ovdje nalijepite oglas za posao...',
      short: 'Kraće',

    strong: 'Jače',
    professional: 'Profesionalno',
    keywordsFound: 'Pronađene riječi',
    suggestions: 'Sugestije', suggestedSkills: 'Preporučene veštine', skillCategories: { technical: 'Tehničke vještine', soft: 'Meke vještine' },
    aiRecommend: 'AI preporuka',
    recommendedToast: 'Preporučeno',
    recommendedForYou: '⭐ Preporučeno za vas',
    bestResultsTemplate: 'Najbolji rezultati s ovim predloškom',
    optimizedForProfile: 'Optimizirano za vaš profil',
    unlockWithPro: 'Otključajte predložak s Pro',
    saveRequired: 'Prijavite se za spremanje.',
    saved: 'CV spremljen!',
    draftSaved: 'Nacrt spremljen',
    genSuccess: 'Sažetak generiran!',
    bulletsSuccess: 'AI Poboljšanja primijenjena!',
    rewriteSuccess: 'Prepisano',
    levels: { native: 'Materinski', fluent: 'Tečan', advanced: 'Napredni', intermediate: 'Srednji', basic: 'Osnovni' },
    regions: { us: 'SAD', eu: 'EU', balkan: 'Balkan', middleEast: 'Bliski istok', india: 'Indija', japan: 'Japan' }, gender: 'Spol', genderMale: 'Muški', genderFemale: 'Ženski', genderOther: 'Ostalo', coverLetterSection: 'Propratno pismo', photo: { title: 'Profilna fotografija', optional: '(Neobavezno)', shown: 'Prikazana u CV-u', hidden: 'Skrivena u CV-u', shownDesc: 'Prikazana za vaš region', hiddenDesc: 'Fotografija je skrivena.', change: 'Promijeni', upload: 'Prenesi', recrop: 'Ponovo izreži', remove: 'Ukloni', hint: 'JPG ili PNG, max 5MB.', aiEnhance: 'AI poboljšanje', aiEnhancing: 'Poboljšavanje...', applied: 'Primijenjeno', upgrade: 'Nadogradi na Pro', features: ['Zamućenje pozadine', 'Svjetlina i kontrast', 'Prirodan ton kože', 'Automatsko centriranje'], cropTitle: 'Izreži fotografiju', cropHint: 'Povuci za repozicioniranje', apply: 'Primijeni', usRegion: 'Skrivena za SAD region', otherRegion: 'Prikazana za vaš region', errorFormat: 'Prenesi JPG ili PNG sliku.' }, industryLabel: 'Industrija', levelLabel: 'Razina', industryPlaceholder: 'Odaberi industriju', industries: { tech: 'IT / Razvoj softvera', data_ai: 'Podaci / AI / Strojno učenje', cybersecurity: 'Kibernetička sigurnost', sales_retail: 'Prodaja (Maloprodaja)', sales_b2b: 'Prodaja (B2B)', marketing: 'Marketing / Digitalni marketing', sales: 'Prodaja', finance: 'Financije / Računovodstvo', banking_fintech: 'Bankarstvo / FinTech', healthcare: 'Zdravstvo / Medicina', pharmacy: 'Farmacija', education: 'Obrazovanje / Nastava', human_resources: 'Ljudski resursi', customer_service: 'Korisnička podrška / Pozivni centar', logistics: 'Logistika / Lanac opskrbe', operations: 'Operacije / Produkcija', executive: 'Menadžment / Vodstvo', project_management: 'Upravljanje projektima', design: 'Dizajn / UX / UI', engineering: 'Inženjerstvo (Strojarsko / Elektro)', construction: 'Građevinarstvo / Arhitektura', hospitality: 'Ugostiteljstvo / Turizam', legal: 'Pravo', administration: 'Administracija / Ured', general: 'Opće' }, bulletLevels: { entry: 'Početna razina', mid: 'Srednja razina', senior: 'Senior razina', lead: 'Voditelj / Direktor' }, aiExperienceIntro: '✨ Unaprijedite radno iskustvo uz AI', aiExperienceIntroSub: 'Pišite snažnije, jasnije i profesionalnije opise za nekoliko sekundi.', aiSummaryIntro: '✨ Kreirajte moćan profesionalni sažetak', aiSummaryIntroSub: 'Generirajte ili poboljšajte sažetak kako biste se istaknuli kod regrutera.', generateSubtext: 'Snažan sažetak za nekoliko sekundi', shorterSubtext: 'Sažetiji i jasniji tekst', strongerSubtext: 'Istaknite postignuća i rezultate', professionalSubtext: 'Poboljšajte ton i formulacije', aiBulletsSubtext: 'Iskustvo u snažne točke', analyzeJobSubtext: 'Uskladite CV sa zahtjevima oglasa', analyzeJobProOnly: 'Analiza opisa posla dostupna je samo u Pro planu.', aiRecommendSubtext: 'Pronađite najbolji predložak za vas', proHint: 'Preporučeno', proHintPopular: 'Najpopularnije', jobAnalysis: { title: 'Analiza vašeg CV-a', subtitle: 'Koliko vaš CV odgovara ovom oglasu', matchScore: 'Podudaranje', matchGood: 'Dobro podudaranje — ali može bolje', matchAverage: 'Srednje podudaranje — pronađene praznine', matchWeak: 'Slabo podudaranje — potrebna značajna poboljšanja', keyInsights: 'Ključni uvidi', insight1: 'Pronađeno relevantno iskustvo', insight2: 'Nedostaju ključne vještine', insight3: 'Slabi opisi postignuća', importantKeywords: 'Važne ključne riječi', unlockFull: 'Otključajte puni popis s Pro', suggestedImprovements: 'Predložena poboljšanja', improve1: 'Dodajte mjerljive rezultate', improve2: 'Koristite snažnije glagole', improve3: 'Uključite nedostajuće vještine', proCardTitle: 'Poboljšajte CV odmah', proCardText: 'Otključajte potpunu analizu, sve ključne riječi i AI poboljšanja', proCardCta: 'Nadogradi na Pro', proCardNote: 'Jednokratno plaćanje', analyzing: 'Analiziranje vašeg CV-a...' } },
  coverLetter: { title: 'Builder pisma', firstName: 'Ime', lastName: 'Prezime', gender: 'Spol', genderMale: 'Muški', genderFemale: 'Ženski', genderPreferNot: 'Radije ne navodim', identitySection: 'Vaši podaci', jobTitle: 'Pozicija', companyName: 'Naziv tvrtke',tone: 'Ton', tones: { formal: 'Formalan', confident: 'Siguran', friendly: 'Prijateljski' }, generate: 'Generiraj pismo', generating: 'Generiranje vašeg pisma…', regenerate: 'Regeneriraj', regenerating: 'Regeneriranje…', regenerateSubtitle: 'Dobijte novu varijaciju', edit: 'Uredi', companyPlaceholder: 'npr. Google', firstNamePlaceholder: 'Ana', lastNamePlaceholder: 'Marković', genSuccess: 'Pismo generirano!', saved: 'Spremljeno!', draftSaved: 'Draft saved', placeholder: 'Vaše pismo će se pojaviti ovdje...', preview: 'Pregled', filename: 'Propratno Pismo',regenLeft: 'preostalo', regenExhausted: 'Dostigli ste maksimalni broj regeneracija za ovo pismo.', paywallMessage: 'Generiranje pisama iznad besplatnog limita je Pro funkcija. Nadogradite na Pro za neograničena AI pisma.', downloadCl: 'Preuzmi propratno pismo', generateSubtitle: 'Prilagođeno poslu i tvrtki', aiDisclaimer: 'AI-generirani sadržaj može sadržavati netočnosti. Molimo pregledajte sav AI-generirani tekst prije slanja.' },
  auth: { login: 'Prijava', register: 'Napravi nalog', email: 'Email', password: 'Lozinka', confirmPassword: 'Potvrdi', name: 'Ime', forgotPassword: 'Zaboravljeno?', noAccount: 'Nemaš nalog?', hasAccount: 'Imaš nalog?', invalidCredentials: 'Neispravni podaci.', emailTaken: 'Email je već registriran.' },
  dashboard: { title: 'Nadzorna ploča', myCVs: 'Moje biografije', myCoverLetters: 'Moja pisma', createNew: 'Napravi novo', edit: 'Uredi', delete: 'Obriši', lastEdited: 'Zadnja izmjena', upgrade: 'Nadogradi na Pro', plan: 'Trenutni plan', welcome: 'Dobrodošli natrag', noCVs: 'Nema CV-a.', noLetters: 'Nema pisama.', untitled: 'Bez naslova', cvDeleted: 'CV obrisan', letterDeleted: 'Pismo obrisano', loginRequired: 'Prijavite se.', upgradeBanner: 'Uključen 1 CV i 1 propratno pismo.' },
  common: { save: 'Spremi', cancel: 'Otkaži', back: 'Natrag', next: 'Dalje', loading: 'Učitavanje...', proAccessRequired: 'Potreban je Pro pristup. Nadogradite za nastavak.', proAuthorizationUnavailable: 'Pro autorizacija se sinkronizira. Pokušajte ponovno za trenutak.', error: 'Greška', success: 'Uspješno!', darkMode: 'Tamni mod', lightMode: 'Svijetli mod', language: 'Jezik', legal: 'Pravno', previewBadge: 'Besplatan predložak', slide: 'Slajd', appName: 'CV Pro AI', docx: 'DOCX' },
  footer: { rights: '© 2026 CV Pro AI. Sva prava zadržana.', privacy: 'Privatnost', terms: 'Uvjeti', backToHome: 'Natrag' },
    templates: {
      title: 'Predlošci', subtitle: '13 profesionalnih predložaka.', showcase: 'Prikaz', showcaseSubtitle: 'Moderni standardi.', freeCount: 'Besplatno — 3 predloška', proCount: 'Pro — 10 premium', proBadge: 'PRO', unlockPro: 'Otključaj sve za 3.99$', browseAll: 'Pretraži sve',
      categories: { ats: 'ATS kompatibilno', creative: 'Kreativni', executive: 'Rukovodilački', modern: 'Moderni', japanese: 'Japanski' },
      items: {
        'modern-minimal': { name: 'Moderni minimalizam', description: 'Čist, ATS-spreman dizajn koji regruteri primijete odmah.', category: 'ATS kompatibilno' },
        'clean-simple': { name: 'Čist i jednostavan', description: 'Jasan i direktan — idealan za studente i prve prijave za posao.', category: 'ATS kompatibilno' },
        'professional-classic': { name: 'Profesionalna klasika', description: 'Bezvremenski i pouzdan — omiljen među regraterima u svim industrijama.', category: 'ATS kompatibilno' },
        'creative-bold': { name: 'Kreativni i odvažni', description: 'Istaknite se odmah smjelim dizajnom koji impresionira u kreativnim industrijama.', category: 'Kreativni' },
        'creative-artistic': { name: 'Kreativni umjetnički', description: 'Izrazite svoju osobnost modernim dizajnom koji ostavlja trajan dojam.', category: 'Kreativni' },
        'elegant-formal': { name: 'Elegantni formalni', description: 'Uglađen i autoritativan — idealan za rukovodeće pozicije.', category: 'Rukovodilački' },
        'ats-standard': { name: 'ATS standardni', description: 'Maksimizirajte šanse prolaska svakog automatskog filtera selekcije.', category: 'ATS kompatibilno' },
        'executive-premium': { name: 'Rukovodilački premium', description: 'Premium dizajn za C-razinu lidera koji ne ostavljaju ništa slučaju.', category: 'Rukovodilački' },
        'nordic-clean': { name: 'Nordijski čisti', description: 'Miran i fokusiran raspored — vaše iskustvo govori samo za sebe.', category: 'Moderni' },
        'tech-sidebar': { name: 'Tehnološki s bočnom trakom', description: 'Dvokolonska struktura koja optimalno prikazuje vještine i iskustvo.', category: 'Moderni' },
        'corporate-navy': { name: 'Korporativni tamnoplavi', description: 'Snažan i samouvjeren — ostavlja jak dojam na prvi pogled.', category: 'Rukovodilački' },
        'modern-minimal-executive': { name: 'Moderni minimalni rukovodilački', description: 'Moderna rukovodilačka prisutnost sa strukturiranom bočnom trakom.', category: 'Rukovodilački' },
        'contemporary-bold': { name: 'Suvremeni odvažni', description: 'Jak, strukturiran dizajn za tech i startup uloge koje traže pozornost.', category: 'Moderni' },
        'rirekisho': { name: 'Rirekisho', description: 'Autentični japanski format životopisa — usklađen s lokalnim standardima.', category: 'Japanski' }
      }
    },
  legal: {
    privacy: {
      title: 'Politika privatnosti', effectiveDate: 'Na snazi od: Travnja 2026.',
      sections: [
        { title: '1. Uvod', content: 'CV Pro AI poštuje vašu privatnost i posvećena je zaštiti vaših osobnih podataka. Ova Politika privatnosti objašnjava kako prikupljamo, koristimo i čuvamo vaše podatke kada koristite naš AI alat za kreiranje životopisa i motivacijskih pisama.' },
        { title: '2. Podaci koje prikupljamo', content: 'Kada koristite aplikaciju, možemo prikupljati sljedeće informacije:', items: ['Ime (ako ga unesete)', 'Adresa e-pošte (ako je unesete)', 'Sadržaj životopisa koji unosite', 'Osnovni podaci o korištenju i analitika'] },
        { title: '3. Kako koristimo vaše podatke', content: 'Vaši podaci koriste se isključivo u sljedeće svrhe:', items: ['Generiranje životopisa i motivacijskih pisama', 'Poboljšanje AI funkcija i kvalitete aplikacije', 'Osiguravanje osnovne funkcionalnosti aplikacije'] },
        { title: '4. AI obrada', content: 'Vaši unosi mogu biti sigurno proslijeđeni vanjskim AI pružateljima radi generiranja sažetaka životopisa, točaka nabrajanja, propratnih pisama i drugog AI-podržanog sadržaja. Podaci se obrađuju isključivo u svrhu generiranja traženog rezultata. CV Pro AI ne koristi vaš sadržaj u reklamne svrhe.' },
        { title: '5. Dijeljenje podataka', content: 'Poštujemo vašu privatnost i odgovorno upravljamo vašim podacima:', items: ['Ne prodajemo korisničke podatke trećim stranama', 'Podaci se ne dijele s trećim stranama, osim s neophodnim servisima za funkcioniranje aplikacije'] },
        { title: '6. Pohrana i sigurnost podataka', content: 'Podaci vašeg životopisa pohranjuju se lokalno na vašem uređaju. Aplikacija koristi automatsko spremanje za pohranu nacrta u izradi lokalno na vašem uređaju. Određeni sadržaj može biti sigurno proslijeđen kada koristite AI značajke koje zahtijevaju generiranje ili poboljšanje sadržaja. Primjenjujemo standardne sigurnosne mjere uključujući TLS enkripciju. Poduzimaju se razumne mjere zaštite svih korisničkih informacija.', items: ['Sadržaj generiran umjetnom inteligencijom i podaci nacrta zadržavaju se samo prema potrebi za pružanje tražene funkcionalnosti. Nacrti pohranjeni lokalno ostaju pod kontrolom korisnika i mogu se izbrisati u bilo kojem trenutku brisanjem nacrta ili resetiranjem aplikacije.'] },
        { title: '7. Vaša prava i GDPR zaštita', content: 'Imate punu kontrolu nad svojim osobnim podacima. Ako se nalazite u Europskom gospodarskom prostoru (EGP), imate dodatna prava u skladu s Općom uredbom o zaštiti podataka (GDPR):', items: ['Zatražiti pristup vašim osobnim podacima', 'Zatražiti brisanje vaših podataka (pravo na zaborav)', 'Zatražiti ispravak netočnih podataka', 'Zatražiti ograničenje obrade (korisnici iz EGP)', 'Prenosivost podataka — primanje vaših podataka u strukturiranom, strojno čitljivom formatu (korisnici iz EGP)', 'Povući privolu u bilo kojem trenutku kada se obrada temelji na privoli'] },
        { title: '8. Kolačići i analitika', content: 'Aplikacija može koristiti osnovne alate za analitiku radi razumijevanja obrazaca korištenja i poboljšanja performansi. Osobni podaci ne dijele se s reklamnim mrežama.' },
        { title: '9. Plaćanja i kupnje', content: 'Kupnje Pro plana sigurno se obrađuju putem procesora plaćanja trećih strana:', items: ['Plaćanja se obrađuju putem Apple App Store, Google Play Store i RevenueCat', 'CV Pro AI NE prikuplja, ne obrađuje niti pohranjuje podatke o vašoj platnoj kartici', 'Svi podaci o plaćanju upravljaju se izravno od strane odgovarajuće trgovine aplikacijama i procesora plaćanja u skladu s njihovim vlastitim politikama privatnosti i sigurnosti', 'Validacija kupnje i upravljanje pravima mogu se pružati putem RevenueCat ili sličnih pružatelja platne infrastrukture.'] },
        { title: '10. Zaštita maloljetnih osoba', content: 'Ova aplikacija nije namijenjena korisnicima mlađima od 13 godina. Ne prikupljamo namjerno osobne podatke djece mlađe od 13 godina. Ako smatrate da nam je dijete dalo osobne podatke, odmah nas kontaktirajte.' },
        { title: '11. Nema jamstava', content: 'CV Pro AI ne jamči zaposlenje, intervjue, ponude za posao niti ishode prijava. Korisnici ostaju odgovorni za pregled, uređivanje i provjeru svih generiranih sadržaja prije nego što ih dostave poslodavcima ili trećim stranama.' },
        { title: '12. Kontakt', content: 'Za sva pitanja ili zahtjeve vezane uz ovu Politiku privatnosti, kontaktirajte nas na help.cvappai@gmail.com.' }
      ]
    },
    terms: {
      title: 'Uvjeti korištenja', effectiveDate: 'Na snazi od: Travnja 2026.',
      sections: [
        { title: '1. Uvod', content: 'CV Pro AI je alat za kreiranje životopisa i motivacijskih pisama uz pomoć umjetne inteligencije. Korištenjem aplikacije prihvaćate ove Uvjete korištenja.' },
        { title: '2. Opis usluge', content: 'CV Pro AI je AI-pogonjen kreator životopisa i motivacijskih pisama. Aplikacija nudi besplatni plan i Pro plan. Besplatni plan uključuje 1 preuzimanje motivacijskog pisma i 1 AI regeneraciju. Pro plan (jednokratno 3,99 $) nudi neograničena preuzimanja, neograničenu AI generaciju, 10 premium predložaka, AI alate za prepisivanje i analizator opisa posla.' },
        { title: '3. AI izjava o odricanju odgovornosti', content: 'Sadržaj koji generira AI pruža se samo kao pomoć i može zahtijevati provjeru korisnika. Može sadržavati netočnosti ili stilske varijacije. Vi ste jedini odgovorni za pregled i uređivanje svih AI-generiranih tekstova prije slanja poslodavcima.' },
        { title: '4. Odgovornosti korisnika', content: 'Vi ste odgovorni za točnost informacija koje unosite u aplikaciju. Osigurajte da su svi podaci istiniti i ažurni. Konačna odgovornost za vaše materijale za prijavu je vaša.' },
        { title: '5. Prihvatljivo korištenje', content: 'Slažete se da nećete zloupotrebljavati aplikaciju, postavljati nezakoniti sadržaj niti je koristiti na način koji krši važeće zakone. Zlouporaba usluge može rezultirati ograničenjem pristupa.' },
        { title: '6. Plaćanja', content: 'Pro plan dostupan je za jednokratno plaćanje od 3,99 $, što daje doživotni pristup bez pretplate ili automatskog obnavljanja. Ako ste ranije kupili Pro, koristite gumb "Povrati kupnju" na stranici Cijene.' },
        { title: '7. Bez jamstava', content: 'CV Pro AI pruža alate za pomoć pri kreiranju životopisa. Ne jamčimo da će korištenje aplikacije dovesti do ponuda za posao, razgovora za posao ili zaposlenja. Rezultati ovise o mnogim čimbenicima izvan naše kontrole.' },
        { title: '8. Ograničenje odgovornosti', content: 'Aplikacija se pruža "kakva jest" bez ikakvih jamstava. CV Pro AI ne snosi odgovornost za posrednu ili posljedičnu štetu nastalu korištenjem aplikacije.' },
        { title: '9. Raskid', content: 'Zadržavamo pravo ograničiti ili prekinuti pristup aplikaciji u slučaju kršenja ovih Uvjeta, uključujući zloupotrebu, nezakonitu aktivnost ili zanemarivanje usluge.' },
        { title: '10. Izmjene Uvjeta', content: 'Možemo s vremena na vrijeme ažurirati ove Uvjete. Nastavak korištenja aplikacije nakon objave izmjena smatra se prihvaćanjem ažuriranih Uvjeta.' },
        { title: '11. Kontakt', content: 'Za podršku ili pitanja o ovim Uvjetima, kontaktirajte nas na help.cvappai@gmail.com.' }
      ]
    }
  },
    comparison: {
      title: 'Vidi razliku', subtitle: 'Besplatno vs Pro.', freePlan: 'Besplatan plan', proPlan: 'Pro plan', good: 'Dobro', hireReady: 'Spremno za posao', proBadge: 'PRO', freeFeatures: ['Osnovni raspored', 'Minimalna hijerarhija', 'Standardni razmak'], proFeatures: ['Premium tipografija', 'Međunarodni standard', 'Rafinisana struktura'], summary: 'Sažetak', experience: 'Iskustvo', expertise: 'Ekspertiza', languages: 'Jezici', chips: ['SEO strategija', 'Analitika', 'Sadržaj', 'Email'], persuasiveText: 'Profesionalni rasporedi pomažu vašem životopisu da se istakne na konkurentnim tržištima.'
    },
  previews: {
    name: 'Marko Marković', role: 'Senior Product Manager', email: 'marko@email.com', phone: '+385 1 123456', location: 'Zagreb / NY', experience: 'Iskustvo', education: 'Obrazovanje', skills: 'Vještine', contact: 'Kontakt', headOfProduct: 'Voditelj proizvoda', productManager: 'Produkt menadžer', jrPm: 'Junior PM', techCorp: 'TechCorp', startupXY: 'StartupXY', digitalAgency: 'DigitalnaAgencija', techCorpDesc: 'Vođenje tima od 12, 3 proizvoda, +40% rast.', startupDesc: 'Planiranje, istraživanje, +28% retencija.', agencyDesc: 'Isporuka za 5 klijenata.', mba: 'MBA', columbia: 'Sveučilište Columbia', present: 'Trenutno', now: 'Sada', productVision: 'Vizija proizvoda', teamLeadership: 'Vođenje tima', gtm: 'Go-to-Market', dataAnalysis: 'Analiza podataka', productStrategy: 'Strategija', uxResearch: 'UX istraživanje', agile: 'Agile / Scrum', techCorpYears: '2021–Trenutno', startupYears: '2018–2021', educationYears: '2016–2018', agencyYears: '2016–2018'
  },
  onboarding: {
    title: 'Dobrodošli u Graditelj CV-a s AI-om ✨',
    subtitle: 'Stvorite profesionalni CV i motivacijsko pismo u minutama. Počnite besplatno — nadogradite se kad budete spremni.',
    freeLabel: 'Besplatno',
    freeFeatures: ['3 Standardna Predloška', '1 preuzimanje Motivacijskog pisma', '1 pokušaj Regeneracije AI-om', 'Svih 12 jezika'],
    proLabel: 'Pro — 3,99 €',
    proRecommendedBadge: 'PREPORUČENO',
    proFeatures: ['Neograničena Motivacijska Pisma', 'Alati za Ponovno Pisanje s AI-om', '10 Premium Predložaka', 'Analizator Oglasa + Prioritetna Podrška'],
    oneTimePayment: 'Jednokratna plaćanja. Nema pretplate.',
    aiFeatureTitle: 'AI Značajke',
    aiFeatureDesc: 'AI koristi vaše podatke samo za generiranje teksta i ne pohranjuje podatke trajno. Molimo pregledajte sav tekst koji je generirao AI prije slanja.',
    startFree: 'Počnite Besplatno',
    upgradeToPro: 'Nadogradite se na Pro',
    secureCheckout: 'Sigurna naplata. Trenutna aktivacija. Nema pretplate.'
  },
  about: {
    hero: { badge: 'Opis za Google Play i App Store', title: 'CV Pro AI — Pametni generator CV-a s AI-om', description: 'Napravite profesionalni i pobjeđujući CV u nekoliko minuta. Počnite besplatno — nadogradite jednom, koristite zauvijek.', ageRating: 'Dobna granica: 3+', languages: '12 jezika', privacyFirst: 'Privatnost na prvom mjestu' },
    description: { title: 'Opis aplikacije', paragraphs: ['CV Pro AI je generator CV-a i motivacijskog pisma pogonjen AI-om dizajniran za tražioce posla diljem svijeta. Kreirajte profesionalni CV optimiziran za ATS u nekoliko minuta koristeći pametne predloške i AI alate za pisanje.', 'Dostupno za Android (Google Play) i iPhone (Apple App Store).', 'Odaberite između 13 profesionalnih predložaka — 3 besplatna, 10 premium. AI asistent za pisanje pomaže vam da sastavite uvjerljive točke, profesionalne rezimeje i personalizirane motivacijske pismima prilagođena vašoj ciljnoj poziciji i društvu.', 'Podrška za 12 jezika, uključujući arapski (RTL), japanski, hindi (Indija) i više, osigurava da možete stvoriti CV spreman za posao za bilo koje tržište. Regionalna optimizacija automatski prilagođava vaš CV standardima tržišta rada SAD-a, EU-a, Balkana, Bliskog istoka, Indije i Japana.', 'Besplatni plan: Kreirajte svoj CV, preuzmite 1 motivacijsko pismo generirano s AI-om i koristite 1 pokušaj regeneracije — nije potreban račun.', 'Pro plan ($3,99 jednokratno): Otključajte neograničena motivacijska pisma generirana s AI-om, AI alate za ponovno pisanje, svih 10 premium predložaka, analizator opisa posla i prioritetnu podršku. Jednokratna plaćanja. Nema pretplate. Nema obnavljanja.'] },
    features: { title: 'Besplatne nasuprot Pro značajke', free: { label: 'Besplatno — 0€', items: ['3 standardna predloška (kompatibilna s ATS-om)', '1 preuzimanje motivacijskog pisma generiranog s AI-om', '1 pokušaj regeneracije motivacijskog pisma', 'Generiranje stručnog rezimeja s AI-om', 'Svih 12 jezika', 'DOCX izvoz', 'Regionalna optimizacija CV-a'], disabledItems: ['AI alati za ponovno pisanje', 'Analizator opisa posla', '10 premium predložaka', 'Neograničena motivacijska pisma'] }, pro: { label: 'Pro — 3,99€ jednokratno', price: 'JEDNOKRATNO 3,99€', items: ['10 premium predložaka (+ 3 besplatna)', 'Neograničena motivacijska pisma generirana s AI-om', 'Neograničene regeneracije motivacijskih pisama', 'Generiranje stručnog rezimeja s AI-om', 'AI alati za ponovno pisanje (Skrati, Ojačaj, Profesionaliziraj)', 'Analizator opisa posla', 'Svih 12 jezika', 'DOCX izvoz', 'Regionalna optimizacija CV-a', 'Prioritetna podrška'], footer: 'Jednokratna plaćanja. Nema pretplate. Nema obnavljanja.' } },
    aiDisclosure: { title: 'Kako se AI koristi u ovoj aplikaciji', items: ['Aplikacija koristi AI usluge trećih strana za generiranje sažetaka CV-a, ključnih točaka i teksta motivacijskog pisma.', 'Korisnički unosi (naziv pozicije, naziv tvrtke, preferencija tona, radno iskustvo) obrađuju se AI uslugama samo za generiranje teksta.', 'Korisnički unosi se trajno ne pohranjuju od strane aplikacije ili AI usluga.', 'Sadržaj generiran s AI-om može sadržavati netočnosti. Korisnici su odgovorni za pregled svih sadržaja prije slanja poslodavcima.', 'Gumb AI je jasno označen: "Generiraj s AI-om ✨"'] },
    ageAndContent: { title: 'Dobna granica i upozorenje o sadržaju', ageRating: 'Dobna granica: 3+', ageRatingDesc: 'Prikladno za sve dobi. Bez sadržaja za odrasle.', disclaimer: 'Sadržaj generiran s AI-om može sadržavati netočnosti, gramatičke greške ili probleme specifične za kontekst. Korisnici su potpuno odgovorni za pregled, uređivanje i provjeru svih tekstova generiranih s AI-om prije nego što ih pošalju poslodavcima ili trećim stranama.', noLiability: 'CV Pro AI pruža alate za pomoć pri kreiranju CV-a i motivacijskih pisama. Ne dajemo nikakve garancije za rezultate zaposlenja. Korištenje sadržaja generiranog s AI-om je na rizik korisnika.', privacy: 'Podaci CV-a se pohranjuju lokalno na korisnikovoj uređaju. Osobni podaci se ne prodaju i ne dijele s trećim stranama u svrhe marketinga.' },
    languages: { title: 'Podržani jezici', list: ['English', 'Deutsch (German)', 'Español (Spanish)', 'Français (French)', 'Italiano (Italian)', 'العربية (Arabic) — RTL', 'Srpski (Serbian)', 'Hrvatski (Croatian)', 'Русский (Russian)', 'Português (Brazil)', 'हिन्दी (Hindi)', '日本語 (Japanese)'] },
    restorePurchase: { title: 'Povrati kupnju', description: 'Ako ste prethodno kupili Pro i trebate vratiti pristup, dotaknite gumb "Povrati kupnju" na stranici Cijene. Vaš Pro pristup će biti odmah vraćen na trenutnu uređaju. Ako naiđete na probleme, kontaktirajte nas na help.cvappai@gmail.com.' },
    legal: { title: 'Pravno', privacyPolicy: 'Politika privatnosti', termsOfService: 'Uvjeti pružanja usluge', contact: 'Kontakt: help.cvappai@gmail.com', viewPricing: 'Prikaži cijene i nadogradite se na Pro' }
  }
};

const ru: TranslationKeys = {
  nav: { home: 'Главная', cvBuilder: 'Конструктор CV', coverLetter: 'Письмо', templates: 'Шаблоны', pricing: 'Цены', about: 'О нас', contact: 'Контакт', login: 'Войти', register: 'Регистрация', dashboard: 'Панель', logout: 'Выйти' },
  hero: { title: 'Создайте профессиональное CV за минуты.', professionalResumesAiPowered: 'Профессиональные резюме. На базе ИИ.', subtitle: 'Конструктор CV на базе ИИ с премиум-шаблонами и умной оптимизацией.', valueDesc: 'Создайте профессиональное резюме за несколько минут. Откройте доступ к 10 премиум-шаблонам и расширенным инструментам с Pro.', cta: 'Создать CV', ctaSecondary: 'Посмотреть шаблоны', badge: 'Конструктор CV с ИИ', footerText: 'Единоразовый платеж. Пожизненный доступ.' },
  features: { title: 'Все, что вам нужно.', subtitle: 'Мощные инструменты ИИ для глобального рынка', badge: 'Что включено', ai: { title: 'Умное написание', desc: 'Улучшает четкость и структуру автоматически.' }, multilingual: { title: 'Многоязычность', desc: 'Создавайте CV на 9 языках.' }, templates: { title: 'Премиум-шаблоны', desc: '8 премиум + 3 бесплатных.' }, ats: { title: 'ATS-Friendly', desc: 'Проходит системы проверки кандидатов.' }, region: { title: 'Региональная оптимизация', desc: 'Адаптация для США, ЕС, Балкан и Ближнего Востока.' }, export: { title: 'Экспорт в разные форматы', desc: 'DOCX или буфер обмена.' }, analyzer: { title: 'Анализатор вакансий', desc: 'Сопоставьте CV с вакансией с точностью ИИ.' } },
  howItWorks: { title: 'Как это работает', step: 'ШАГ', step1: { title: 'Добавьте свою информацию', desc: 'Заполните личные данные, опыт работы и образование, чтобы начать создание резюме.' }, step2: { title: 'Улучшите своё резюме', desc: 'Используйте умные инструменты и подсказки, чтобы сделать резюме сильнее и профессиональнее.' }, step3: { title: 'Скачайте резюме', desc: 'Экспортируйте готовое резюме в формате DOCX, готовое к отправке работодателям.' } },
  whoIsThisFor: { title: 'Для кого этот конструктор резюме?', items: ['Соискатели работы', 'Студенты и выпускники', 'Профессионалы, меняющие карьеру', 'Все, кто хочет современное профессиональное резюме'] },
  privacyFirst: { title: 'Конфиденциальность прежде всего', desc: 'Данные вашего резюме остаются на вашем устройстве. Мы не храним, не продаём и не передаём ваши личные данные.', local: 'Этот конструктор резюме работает локально на вашем устройстве для защиты вашей информации.' },
  simplePricing: { title: 'Простое ценообразование', desc: 'Без подписки. Разовая покупка для разблокировки всех Pro-шаблонов и расширенных инструментов.' },
  pricing: { 
    title: 'Простые цены.', 
    subtitle: 'Без подписок. Платите один раз.', 
    oneTime: '3.99$ один раз', 
    getStarted: 'Начать',
    footerText: 'Единоразовый платеж · Пожизненный доступ · Без подписки',
        free: { name: 'Бесплатно', price: '0$', features: ['3 стандартных шаблона', '1 скачивание CV', '1 сопроводительное письмо', 'Все языки'], cta: 'Начать бесплатно', desc: 'Начните без затрат.' }, 
        pro: { name: 'Pro', price: '3.99$', features: ['10 премиум-шаблонов', 'Безлимитные скачивания CV', 'Безлимитные AI-сопроводительные письма', 'Анализатор вакансий', 'Улучшения ИИ', 'Все языки'], cta: 'Перейти на Pro', desc: 'Оплатите один раз. Пользуйтесь всегда.', badge: 'Pro — Пожизненный доступ', footer: 'Безопасная оплата. Мгновенная активация.', noSubscription: 'Без подписки. Без продления.' },
    tableTitle: 'Сравнение функций',
    tableHeaderFeature: 'Функция',
    tableHeaderFree: 'Бесплатно',
    tableHeaderPro: 'Pro',
    tableRowCV: 'Скачивания CV',
    tableRowCoverLetter: 'Скачивания сопроводительных писем',
    tableRowTemplates: 'Шаблоны',
    tableRowAI: 'ИИ-генерация резюме',
    tableRowRewrite: 'ИИ-инструменты переписывания',
    tableRowAnalyzer: 'Анализатор вакансий',
    tableRowLanguages: 'Все языки',
    tableRowSupport: 'Приоритетная поддержка',
    unlimited: 'Безлимитно',
    threeStandard: '3 стандартных',
    proTemplatesCount: '10 премиум + 3 бесплатных',
    oneCount: '1',
    popularBadge: 'Самый популярный',
    bestValueBadge: 'Лучшая цена',
    coverLetterFreeValue: '1 загрузка сопроводительного письма',
    coverLetterProValue: 'Неограниченные сопроводительные письма на базе ИИ',
    restoreTitle: 'Уже купили Pro?',
    restoreDesc: 'Восстановите предыдущую покупку, чтобы вернуть доступ Pro на этом устройстве.',
    restoreButton: 'Восстановить покупку',
    proActive: 'Pro Активен',
    restoringText: 'Восстановление...',
    needHelp: 'Нужна помощь?',
    fairUse: 'Могут применяться ограничения использования для предотвращения злоупотреблений и обеспечения стабильной работы сервиса.'
  },
  faq: { title: 'Частые вопросы', items: [
    { q: 'Что включено в бесплатный план?', a: 'Бесплатный план позволяет создать 1 резюме и сгенерировать 1 сопроводительное письмо. Вы также можете использовать AI-инструменты с ограниченным доступом для улучшения контента.' },
    { q: 'Сколько сопроводительных писем можно сгенерировать бесплатно?', a: 'Вы можете сгенерировать 1 сопроводительное письмо бесплатно, включая 1 попытку регенерации.' },
    { q: 'Что происходит после использования бесплатного письма?', a: 'После использования бесплатного письма вы можете перейти на Pro для безлимитных писем и полного доступа к AI-функциям.' },
    { q: 'Что я получаю с Pro?', a: 'Pro даёт безлимитные сопроводительные письма, полный доступ ко всем AI-инструментам, премиум-шаблоны и расширенные функции оптимизации резюме.' },
    { q: 'Являются ли AI-функции бесплатными?', a: 'Некоторые AI-функции доступны бесплатно с ограниченным использованием. Перейдите на Pro для безлимитного доступа.' },
    { q: 'Можно ли использовать приложение на разных языках?', a: 'Да, приложение поддерживает несколько языков, чтобы вы могли создавать резюме и сопроводительное письмо на предпочтительном языке.' },
    { q: 'Являются ли шаблоны ATS-совместимыми?', a: 'Безусловно. Все шаблоны разработаны для прохождения ATS-систем, используемых крупными работодателями по всему миру.' },
    { q: 'Как работает AI? Хранятся ли мои данные?', a: 'AI использует только ваши вводные данные (должность, компания, тон и т.д.) для генерации текста. Ваши личные данные не хранятся постоянно. Приложение использует AI-сервисы третьих сторон для обработки запросов.' },
    { q: 'Всегда ли AI-сгенерированный контент точен?', a: 'AI-сгенерированный контент может содержать неточности. Пожалуйста, внимательно проверяйте все AI-тексты перед отправкой работодателям. Пользователи несут ответственность за окончательный контент.' }
  ] },
  cv: { title: 'Конструктор CV', personal: 'Личная информация', experience: 'Опыт работы', education: 'Образование', skills: 'Навыки', certifications: 'Сертификаты', languages: 'Языки', summary: 'Профессиональное резюме', generate: 'Создать с ИИ', rewrite: 'Переписать', translate: 'Перевести', analyzeJob: 'Анализ вакансии', download: 'Скачать', downloadCv: 'Скачать CV', downloadPdf: 'PDF', downloadDocx: 'DOCX', downloadPdfDesc: 'Рекомендуется · Готово к отправке', downloadDocxDesc: 'Редактируемая версия', downloadNote: 'PDF сохраняет выбранный дизайн. DOCX доступен для редактирования и может иметь незначительные отличия в оформлении в зависимости от Word, Google Docs или мобильных просмотрщиков.', pdfExportFailed: 'Экспорт PDF не удался. Пожалуйста, попробуйте снова.',
    wordExportFailed: 'Ошибка экспорта Word. Пожалуйста, попробуйте снова.', preview: 'Предпросмотр', selectTemplate: 'Выбрать шаблон', jobTitle: 'Должность', fullName: 'Имя и фамилия', email: 'Email', phone: 'Телефон', address: 'Адрес', fathersName: 'Имя отца', nationality: 'Гражданство', dateOfBirth: 'Дата рождения', company: 'Компания', position: 'Позиция', startDate: 'Начало', endDate: 'Конец', present: 'По наст. время', description: 'Описание', degree: 'Степень', school: 'Школа / Университет', addMore: 'Добавить еще', remove: 'Удалить', region: 'Целевой регион', ready: 'Готовы создать CV?', readySubtitle: 'Начните бесплатно. Перейдите на Pro, когда будете готовы.', edit: 'Правка', copied: 'Скопировано!', copy: 'Копировать', jobTitlePlaceholder: 'напр. Software Engineer', fullNamePlaceholder: 'Иван Иванов', aiBullets: 'Улучшения ИИ', skillPlaceholder: 'Введите навык и нажмите Enter', certPlaceholder: 'напр. Сертификат AWS', langPlaceholder: 'Язык', levelPlaceholder: 'Уровень',       summaryPlaceholder: 'Напишите или создайте резюме...',
      jobDescPlaceholder: 'Вставьте описание вакансии здесь...',
      short: 'Короче',
 strong: 'Сильнее', professional: 'Профессионально', keywordsFound: 'Найденные слова', suggestions: 'Предложения', suggestedSkills: 'Предлагаемые навыки', skillCategories: { technical: 'Технические навыки', soft: 'Гибкие навыки' }, aiRecommend: 'ИИ Рекомендует', recommendedToast: 'Рекомендовано', recommendedForYou: '⭐ Рекомендовано для вас', bestResultsTemplate: 'Лучшие результаты с этим шаблоном', optimizedForProfile: 'Оптимизировано под ваш профиль', unlockWithPro: 'Разблокируйте шаблон с Pro', saveRequired: 'Пожалуйста, войдите.', saved: 'CV сохранено!', draftSaved: 'Draft saved', genSuccess: 'Резюме создано!', bulletsSuccess: 'Улучшения ИИ применены!', rewriteSuccess: 'Переписано', levels: { native: 'Родной', fluent: 'Свободный', advanced: 'Продвинутый', intermediate: 'Средний', basic: 'Базовый' }, regions: { us: 'США', eu: 'ЕС', balkan: 'Балканы', middleEast: 'Ближний Восток', india: 'Индия', japan: 'Япония' }, gender: 'Пол', genderMale: 'Мужской', genderFemale: 'Женский', genderOther: 'Другой', coverLetterSection: 'Сопроводительное письмо', photo: { title: 'Фото профиля', optional: '(Необязательно)', shown: 'Показано в CV', hidden: 'Скрыто в CV', shownDesc: 'Показано по умолчанию для вашего региона', hiddenDesc: 'Фото скрыто.', change: 'Изменить', upload: 'Загрузить', recrop: 'Обрезать снова', remove: 'Удалить', hint: 'JPG или PNG, макс 5МБ.', aiEnhance: 'AI улучшение фото', aiEnhancing: 'Улучшение...', applied: 'Применено', upgrade: 'Перейти на Pro', features: ['Размытие фона', 'Яркость и контраст', 'Естественный тон кожи', 'Автоцентрирование'], cropTitle: 'Обрезать фото', cropHint: 'Перетащите для перемещения', apply: 'Применить', usRegion: 'Скрыто по умолчанию (США)', otherRegion: 'Показано по умолчанию для вашего региона', errorFormat: 'Загрузите изображение JPG или PNG.' }, industryLabel: 'Отрасль', levelLabel: 'Уровень', industryPlaceholder: 'Выберите отрасль', industries: { tech: 'IT / Разработка ПО', data_ai: 'Данные / ИИ / Машинное обучение', cybersecurity: 'Кибербезопасность', sales_retail: 'Продажи (Розница)', sales_b2b: 'Продажи (B2B)', marketing: 'Маркетинг / Цифровой маркетинг', sales: 'Продажи', finance: 'Финансы / Бухгалтерия', banking_fintech: 'Банковское дело / FinTech', healthcare: 'Здравоохранение / Медицина', pharmacy: 'Фармация', education: 'Образование / Преподавание', human_resources: 'Управление персоналом', customer_service: 'Служба поддержки / Колл-центр', logistics: 'Логистика / Цепочка поставок', operations: 'Операции / Производство', executive: 'Менеджмент / Руководство', project_management: 'Управление проектами', design: 'Дизайн / UX / UI', engineering: 'Инженерия (Механическая / Электрическая)', construction: 'Строительство / Архитектура', hospitality: 'Гостиничный бизнес / Туризм', legal: 'Право', administration: 'Администрирование / Офис', general: 'Общее' }, bulletLevels: { entry: 'Начальный уровень', mid: 'Средний уровень', senior: 'Старший уровень', lead: 'Руководитель / Директор' }, aiExperienceIntro: '✨ Улучшите опыт работы с помощью ИИ', aiExperienceIntroSub: 'Пишите более сильные, чёткие и профессиональные описания за секунды.', aiSummaryIntro: '✨ Создайте мощное профессиональное резюме', aiSummaryIntroSub: 'Сгенерируйте или улучшите резюме, чтобы выделиться среди рекрутеров.', generateSubtext: 'Сильное резюме за несколько секунд', shorterSubtext: 'Текст лаконичнее и чище', strongerSubtext: 'Выделите достижения и результаты', professionalSubtext: 'Улучшите тон и формулировки', aiBulletsSubtext: 'Опыт в сильные пункты', analyzeJobSubtext: 'Адаптируйте CV под требования вакансии', analyzeJobProOnly: 'Анализ описания вакансии доступен только в Pro.', aiRecommendSubtext: 'Найдите лучший шаблон для вас', proHint: 'Рекомендуется', proHintPopular: 'Самый популярный', jobAnalysis: { title: 'Анализ вашего CV', subtitle: 'Насколько ваш CV соответствует вакансии', matchScore: 'Совпадение', matchGood: 'Хорошее совпадение — но можно улучшить', matchAverage: 'Среднее совпадение — выявлено несколько пробелов', matchWeak: 'Слабое совпадение — необходимы значительные улучшения', keyInsights: 'Ключевые выводы', insight1: 'Найден релевантный опыт', insight2: 'Отсутствуют ключевые навыки', insight3: 'Слабые описания достижений', importantKeywords: 'Важные ключевые слова', unlockFull: 'Откройте полный список с Pro', suggestedImprovements: 'Рекомендуемые улучшения', improve1: 'Добавьте измеримые результаты', improve2: 'Используйте более сильные глаголы', improve3: 'Включите недостающие навыки', proCardTitle: 'Улучшите CV прямо сейчас', proCardText: 'Откройте полный анализ, все ключевые слова и AI-улучшения', proCardCta: 'Перейти на Pro', proCardNote: 'Единоразовая оплата', analyzing: 'Анализ вашего CV...' } },
  coverLetter: { title: 'Конструктор письма', firstName: 'Имя', lastName: 'Фамилия', gender: 'Пол', genderMale: 'Мужской', genderFemale: 'Женский', genderPreferNot: 'Не указывать', identitySection: 'Ваши данные', jobTitle: 'Должность', companyName: 'Компания',tone: 'Тон', tones: { formal: 'Формальный', confident: 'Уверенный', friendly: 'Дружелюбный' }, generate: 'Создать письмо', generating: 'Создание письма…', regenerate: 'Регенерировать', regenerating: 'Регенерация…', regenerateSubtitle: 'Получить новый вариант', edit: 'Правка', companyPlaceholder: 'напр. Google', firstNamePlaceholder: 'Иван', lastNamePlaceholder: 'Иванов', genSuccess: 'Письмо создано!', saved: 'Сохранено!', draftSaved: 'Draft saved', placeholder: 'Ваше письмо появится здесь...', preview: 'Предпросмотр', filename: 'Сопроводительное письмо',regenLeft: 'осталось', regenExhausted: 'Вы достигли максимального количества регенераций для этого письма.', paywallMessage: 'Создание писем сверх бесплатного лимита — функция Pro. Перейдите на Pro для неограниченного создания писем с ИИ.', downloadCl: 'Скачать сопроводительное письмо', generateSubtitle: 'Адаптировано под вакансию и компанию', aiDisclaimer: 'Контент, созданный ИИ, может содержать неточности. Пожалуйста, проверьте весь текст, созданный ИИ, перед отправкой.' },
  auth: { login: 'Войти', register: 'Регистрация', email: 'Email', password: 'Пароль', confirmPassword: 'Подтвердите', name: 'Имя', forgotPassword: 'Забыли пароль?', noAccount: 'Нет аккаунта?', hasAccount: 'Уже есть аккаунт?', invalidCredentials: 'Неверные данные.', emailTaken: 'Email уже зарегистрирован.' },
  dashboard: { title: 'Панель', myCVs: 'Мои резюме', myCoverLetters: 'Мои письма', createNew: 'Создать', edit: 'Правка', delete: 'Удалить', lastEdited: 'Изменено', upgrade: 'Перейти на Pro', plan: 'Текущий план', welcome: 'С возвращением', noCVs: 'Пока нет CV.', noLetters: 'Пока нет писем.', untitled: 'Без названия', cvDeleted: 'CV удалено', letterDeleted: 'Письмо удалено', loginRequired: 'Пожалуйста, войдите.', upgradeBanner: '1 CV и 1 сопроводительное письмо включены.' },
  common: { save: 'Сохранить', cancel: 'Отмена', back: 'Назад', next: 'Далее', loading: 'Загрузка...', proAccessRequired: 'Требуется доступ Pro. Перейдите на Pro, чтобы продолжить.', proAuthorizationUnavailable: 'Авторизация Pro синхронизируется. Повторите попытку через минуту.', error: 'Ошибка', success: 'Успешно!', darkMode: 'Темная тема', lightMode: 'Светлая тема', language: 'Язык', legal: 'Юридическая информация', previewBadge: 'Бесплатный шаблон', slide: 'Слайд', appName: 'CV Pro AI', docx: 'DOCX' },
  footer: { rights: '© 2026 CV Pro AI. Все права защищены.', privacy: 'Приватность', terms: 'Условия', backToHome: 'На главную' },
  templates: {
    title: 'Шаблоны', subtitle: '13 профессиональных шаблонов.', showcase: 'Витрина', showcaseSubtitle: 'Современные стандарты.', freeCount: 'Бесплатно — 3 шаблона', proCount: 'Pro — 10 премиум', proBadge: 'PRO', unlockPro: 'Открыть всё за 3.99$', browseAll: 'Все шаблоны',
    categories: { ats: 'ATS-Friendly', creative: 'Креативный', executive: 'Исполнительный', modern: 'Современный', japanese: 'Японский' },
    items: {
      'modern-minimal': { name: 'Современный Минимал', description: 'Чистый ATS-оптимизированный дизайн — рекрутеры замечают сразу.', category: 'ATS-Friendly' },
      'clean-simple': { name: 'Чистый и Простой', description: 'Ясный и лаконичный — идеален для студентов и первых откликов.', category: 'ATS-Friendly' },
      'professional-classic': { name: 'Профессиональная Классика', description: 'Вневременной и надёжный — любимый выбор рекрутеров во всех отраслях.', category: 'ATS-Friendly' },
      'creative-bold': { name: 'Креативный Смелый', description: 'Выделитесь мгновенно с ярким дизайном для творческих профессий.', category: 'Креативный' },
      'creative-artistic': { name: 'Креативный Артистический', description: 'Выразите индивидуальность через современный стиль, который запоминается.', category: 'Креативный' },
      'elegant-formal': { name: 'Элегантный Формальный', description: 'Утончённый и авторитетный — для руководящих позиций, где детали решают всё.', category: 'Исполнительный' },
      'ats-standard': { name: 'ATS Стандарт', description: 'Максимизируйте шансы пройти каждый автоматический фильтр отбора.', category: 'ATS-Friendly' },
      'executive-premium': { name: 'Исполнительный Премиум', description: 'Представительный дизайн для топ-менеджеров, где каждое слово на счету.', category: 'Исполнительный' },
        'nordic-clean': { name: 'Скандинавский Чистый', description: 'Спокойный и сфокусированный — ваш опыт говорит сам за себя.', category: 'Современный' },
        'tech-sidebar': { name: 'Тех с Боковой Панелью', description: 'Двухколоночная структура, которая выгодно представляет навыки и опыт.', category: 'Современный' },
        'corporate-navy': { name: 'Корпоративный Синий', description: 'Сильный и уверенный — производит мощное впечатление с первого взгляда.', category: 'Исполнительный' },
        'modern-minimal-executive': { name: 'Современный Минимал Исполнительный', description: 'Современное руководящее присутствие со структурированной боковой панелью.', category: 'Исполнительный' },
        'contemporary-bold': { name: 'Современный Смелый', description: 'Яркий, структурированный дизайн для tech и стартап-позиций.', category: 'Современный' },
        'rirekisho': { name: 'Rirekisho', description: 'Аутентичный японский формат резюме — полностью соответствует местным стандартам.', category: 'Японский' }
      }
    },
  legal: {
    privacy: {
      title: 'Политика конфиденциальности', effectiveDate: 'Действует с: апреля 2026',
      sections: [
        { title: '1. Введение', content: 'CV Pro AI уважает вашу конфиденциальность и стремится защитить ваши персональные данные. Данная Политика конфиденциальности описывает, как мы собираем, используем и защищаем вашу информацию при использовании нашего ИИ-инструмента для создания резюме и сопроводительных писем.' },
        { title: '2. Данные, которые мы собираем', content: 'При использовании приложения мы можем собирать следующую информацию:', items: ['Имя (если указано)', 'Адрес электронной почты (если указан)', 'Содержимое резюме, которое вы вводите', 'Базовые данные об использовании и аналитика'] },
        { title: '3. Как мы используем ваши данные', content: 'Ваши данные используются исключительно в следующих целях:', items: ['Создание резюме и сопроводительных писем', 'Улучшение функций ИИ и качества приложения', 'Обеспечение основной функциональности приложения'] },
        { title: '4. Обработка ИИ', content: 'Ваши вводимые данные могут безопасно передаваться сторонним поставщикам ИИ для создания сводок резюме, маркированных списков, сопроводительных писем и другого контента на основе ИИ. Данные обрабатываются исключительно с целью создания запрошенного контента. CV Pro AI не использует ваш контент в рекламных целях.' },
        { title: '5. Передача данных третьим лицам', content: 'Мы уважаем вашу конфиденциальность и ответственно обращаемся с вашими данными:', items: ['Мы НЕ продаём данные пользователей третьим лицам', 'Данные не передаются третьим лицам, за исключением необходимых сервисов для работы приложения'] },
        { title: '6. Хранение и безопасность данных', content: 'Данные вашего резюме хранятся локально на вашем устройстве. Приложение использует автосохранение для хранения черновиков локально на вашем устройстве. Определенный контент может безопасно передаваться при использовании функций ИИ, требующих генерации или улучшения контента. Мы применяем стандартные меры безопасности, включая шифрование TLS. Принимаются разумные меры для защиты всей информации пользователей.', items: ['Контент, созданный ИИ, и данные черновиков сохраняются только в той мере, в какой это необходимо для предоставления запрошенной функциональности. Черновики, хранящиеся локально, остаются под контролем пользователя и могут быть удалены в любое время путем очистки черновика или сброса приложения.'] },
        { title: '7. Ваши права и защита GDPR', content: 'Вы имеете полный контроль над своими персональными данными. Если вы находитесь в Европейской экономической зоне (ЕЭЗ), у вас есть дополнительные права в соответствии с Общим регламентом по защите данных (GDPR):', items: ['Запросить доступ к своим персональным данным', 'Запросить удаление своих данных (право на забвение)', 'Запросить исправление неточных данных', 'Запросить ограничение обработки (пользователи из ЕЭЗ)', 'Переносимость данных — получение ваших данных в структурированном, машиночитаемом формате (пользователи из ЕЭЗ)', 'Отозвать согласие в любое время, если обработка основана на согласии'] },
        { title: '8. Файлы cookie и аналитика', content: 'Приложение может использовать базовые аналитические инструменты для понимания паттернов использования и улучшения работы. Личные данные не передаются рекламным сетям.' },
        { title: '9. Платежи и покупки', content: 'Покупки Pro-плана обрабатываются безопасно через сторонних платежных процессоров:', items: ['Платежи обрабатываются через Apple App Store, Google Play Store и RevenueCat', 'CV Pro AI НЕ собирает, не обрабатывает и не хранит данные вашей платежной карты', 'Все платежные данные управляются непосредственно соответствующим магазином приложений и платежным процессором в соответствии с их собственными политиками конфиденциальности и безопасности', 'Проверка покупок и управление правами могут предоставляться через RevenueCat или аналогичных поставщиков платежной инфраструктуры.'] },
        { title: '10. Конфиденциальность детей', content: 'Данное приложение не предназначено для пользователей младше 13 лет. Мы не собираем намеренно персональные данные детей до 13 лет. Если вы считаете, что ребёнок предоставил нам данные, немедленно свяжитесь с нами.' },
        { title: '11. Отсутствие гарантий', content: 'CV Pro AI не гарантирует трудоустройство, собеседования, предложения о работе или результаты подачи заявок. Пользователи остаются ответственными за проверку, редактирование и подтверждение всего сгенерированного контента перед его отправкой работодателям или третьим лицам.' },
        { title: '12. Контакт', content: 'По любым вопросам или запросам, касающимся данной Политики конфиденциальности, обращайтесь к нам по адресу help.cvappai@gmail.com.' }
      ]
    },
    terms: {
      title: 'Условия использования', effectiveDate: 'Действует с: апреля 2026',
      sections: [
        { title: '1. Введение', content: 'CV Pro AI — инструмент для создания резюме и сопроводительных писем с помощью ИИ. Используя приложение, вы соглашаетесь с настоящими Условиями использования.' },
        { title: '2. Описание сервиса', content: 'CV Pro AI — ИИ-конструктор резюме и сопроводительных писем. Доступны бесплатный план и план Pro. Бесплатный план: 1 скачивание сопроводительного письма и 1 попытка регенерации. Pro план (разовый платёж 3,99 $): безлимитные скачивания, безлимитная генерация, 10 премиум-шаблонов, инструменты ИИ-переписывания и анализатор вакансий.' },
        { title: '3. Отказ от ответственности за ИИ', content: 'Контент, созданный ИИ, предоставляется только в качестве помощи и может требовать проверки пользователем. Он может содержать неточности или стилистические варианты. Вы несёте единоличную ответственность за проверку и редактирование всех сгенерированных текстов перед отправкой работодателям.' },
        { title: '4. Ответственность пользователя', content: 'Вы несёте ответственность за достоверность информации, вводимой в приложение. Убедитесь, что все данные правдивы и актуальны. Окончательная ответственность за ваши материалы для заявки лежит на вас.' },
        { title: '5. Допустимое использование', content: 'Вы соглашаетесь не злоупотреблять приложением, не загружать незаконный контент и не использовать его способами, нарушающими действующее законодательство. Злоупотребление сервисом может повлечь ограничение доступа.' },
        { title: '6. Оплата', content: 'Plan Pro доступен за разовый платёж в размере 3,99 $ с пожизненным доступом без подписки и автопродления. Если вы ранее покупали Pro, используйте кнопку "Восстановить покупку" на странице тарифов.' },
        { title: '7. Отсутствие гарантий', content: 'CV Pro AI предоставляет инструменты для помощи в создании резюме. Мы не гарантируем, что использование приложения приведёт к предложениям работы, приглашениям на собеседование или трудоустройству.' },
        { title: '8. Ограничение ответственности', content: 'Приложение предоставляется "как есть" без каких-либо гарантий. CV Pro AI не несёт ответственности за косвенный или побочный ущерб, возникший в результате использования приложения.' },
        { title: '9. Прекращение доступа', content: 'Мы оставляем за собой право ограничить или прекратить доступ к приложению в случае нарушения настоящих Условий, включая злоупотребление или противоправную деятельность.' },
        { title: '10. Изменения Условий', content: 'Мы можем периодически обновлять настоящие Условия. Продолжение использования приложения после публикации изменений означает ваше согласие с обновлёнными Условиями.' },
        { title: '11. Контакт', content: 'Для поддержки или вопросов по настоящим Условиям обращайтесь по адресу help.cvappai@gmail.com.' }
      ]
    }
  },
    comparison: {
      title: 'Посмотрите разницу', subtitle: 'Бесплатно против Pro.', freePlan: 'Бесплатный план', proPlan: 'Pro план', good: 'Хорошо', hireReady: 'Готов к найму', proBadge: 'PRO', freeFeatures: ['Базовый макет', 'Мин. иерархия', 'Стандартные отступы'], proFeatures: ['Премиум типографика', 'Межд. стандарт', 'Улучшенная структура'], summary: 'Резюме', experience: 'Опыт', expertise: 'Экспертиза', languages: 'Языки', chips: ['SEO стратегия', 'Аналитика', 'Контент', 'Email'], persuasiveText: 'Профессиональные макеты помогают вашему резюме выделиться на конкурентных рынках.'
    },
  previews: {
    name: 'Алекс Джонсон', role: 'Старший продакт-менеджер', email: 'alex@email.com', phone: '+1 555 123 456', location: 'Берлин / Нью-Йорк', experience: 'Опыт', education: 'Образование', skills: 'Навыки', contact: 'Контакты', headOfProduct: 'Руководитель продукта', productManager: 'Продакт-менеджер', jrPm: 'Мл. менеджер', techCorp: 'ТехКорп', startupXY: 'СтартапXY', digitalAgency: 'DigitalAgency', techCorpDesc: 'Руководство командой из 12 чел, 3 продукта, +40% выручки.', startupDesc: 'Дорожная карта, исследования, +28% удержание.', agencyDesc: 'Разработка функций для 5 клиентов.', mba: 'MBA', columbia: 'Колумбийский университет', present: 'Наст. время', now: 'Сейчас', productVision: 'Видение продукта', teamLeadership: 'Лидерство', gtm: 'Go-to-Market', dataAnalysis: 'Анализ данных', productStrategy: 'Стратегия', uxResearch: 'UX исследования', agile: 'Agile / Scrum', techCorpYears: '2021–Наст. время', startupYears: '2018–2021', educationYears: '2016–2018', agencyYears: '2016–2018'
  },
  onboarding: {
    title: 'Добро пожаловать в Конструктор CV с ИИ ✨',
    subtitle: 'Создайте профессиональное резюме и сопроводительное письмо за считанные минуты. Начните бесплатно — переходите на Pro когда будете готовы.',
    freeLabel: 'Бесплатно',
    freeFeatures: ['3 Стандартных Шаблона', '1 загрузка Письма', '1 попытка Регенерации ИИ', 'Все 12 языков'],
    proLabel: 'Pro — 3,99 $',
    proRecommendedBadge: 'РЕКОМЕНДУЕТСЯ',
    proFeatures: ['Неограниченные Письма', 'Инструменты Переписывания с ИИ', '10 Премиум Шаблонов', 'Анализатор Вакансий + Приоритетная Поддержка'],
    oneTimePayment: 'Одноразовая оплата. Без подписки.',
    aiFeatureTitle: 'Возможности ИИ',
    aiFeatureDesc: 'ИИ использует ваши данные только для создания текста и не хранит данные постоянно. Пожалуйста, проверьте весь текст, созданный ИИ, перед отправкой.',
    startFree: 'Начать Бесплатно',
    upgradeToPro: 'Перейти на Pro',
    secureCheckout: 'Безопасная оплата. Мгновенная активация. Без подписки.'
  },
  about: { hero: { badge: 'Описание для Google Play и App Store', title: 'CV Pro AI', description: 'Создайте профессиональное резюме за минуты. Начните бесплатно — обновитесь один раз и пользуйтесь без ограничений.', ageRating: 'Возрастной рейтинг: 3+', languages: '12 языков', privacyFirst: 'Конфиденциальность прежде всего' }, description: { title: 'Описание приложения', paragraphs: ['CV Pro AI — умный конструктор резюме и сопроводительных писем с поддержкой ИИ.', 'Доступно для Android (Google Play) и iPhone (Apple App Store).', 'Сервис помогает быстро собрать резюме, адаптировать его под вакансию и скачать в профессиональном формате DOCX.', 'Приложение изначально рассчитано на международные рынки: локализация, шаблоны и формулировки работают последовательно для всех поддерживаемых языков и регионов.'] }, features: { title: 'Бесплатно и Pro', free: { label: 'Бесплатно', items: ['3 стандартных шаблона', '1 загрузка сопроводительного письма', '1 попытка регенерации письма', 'Генерация профессионального summary с ИИ', 'Все 12 языков', 'Экспорт в DOCX'], disabledItems: ['Инструменты переписывания с ИИ', 'Анализатор вакансий', '10 премиум-шаблонов', 'Неограниченные письма'] }, pro: { label: 'Pro', price: '$3.99', items: ['10 премиум-шаблонов (+ 3 бесплатных)', 'Неограниченные сопроводительные письма', 'Неограниченные регенерации', 'Инструменты переписывания с ИИ', 'Анализ вакансии', 'Приоритетная поддержка'], footer: 'Разовая оплата. Без подписки и без автопродления.' } }, aiDisclosure: { title: 'Как используется ИИ', items: ['Приложение использует сторонние AI-сервисы для генерации summary, маркеров списка и сопроводительных писем.', 'Введённые данные обрабатываются только для подготовки текста и не используются для маркетинговых целей.', 'AI-контент может содержать неточности, поэтому перед отправкой работодателю его нужно обязательно проверить.', 'Кнопки, запускающие ИИ, помечены явно и не скрывают использование генерации.'] }, ageAndContent: { title: 'Возрастной рейтинг и предупреждение о контенте', ageRating: 'Возрастной рейтинг: 3+', ageRatingDesc: 'Подходит для всех возрастов. Контент для взрослых отсутствует.', disclaimer: 'Текст, созданный ИИ, может содержать фактические неточности, стилистические шероховатости или формулировки, не подходящие для конкретной вакансии. Пользователь обязан проверить и отредактировать итоговый текст перед отправкой.', noLiability: 'CV Pro AI предоставляет инструменты для подготовки резюме и писем, но не гарантирует приглашение на собеседование или трудоустройство. Итоговое использование материалов остаётся на усмотрение пользователя.', privacy: 'Данные резюме хранятся локально на устройстве пользователя. Личная информация не продаётся и не передаётся третьим лицам в рекламных целях.' }, languages: { title: 'Поддерживаемые языки', list: ['English', 'Deutsch', 'Español', 'Français', 'Italiano', 'العربية', 'Srpski', 'Hrvatski', 'Русский', 'Português (Brasil)', 'हिन्दी', '日本語'] }, restorePurchase: { title: 'Восстановить покупку', description: 'Если вы уже приобретали Pro и хотите вернуть доступ на текущем устройстве, нажмите кнопку восстановления покупки на странице тарифов. Если восстановление не сработает, свяжитесь с нами по адресу help.cvappai@gmail.com.' }, legal: { title: 'Юридические документы', privacyPolicy: 'Политика конфиденциальности', termsOfService: 'Условия обслуживания', contact: 'Контакт', viewPricing: 'Посмотреть тарифы' } }
};

const ptBR: TranslationKeys = {
  nav: { home: 'Início', cvBuilder: 'Construtor de CV', coverLetter: 'Carta de Apresentação', templates: 'Modelos', pricing: 'Preços', about: 'Sobre', contact: 'Contato', login: 'Entrar', register: 'Cadastrar', dashboard: 'Painel', logout: 'Sair' },
  hero: { title: 'Crie um currículo profissional em minutos.', professionalResumesAiPowered: 'Currículos profissionais. Com tecnologia de IA.', subtitle: 'Construtor de CV com IA, modelos premium e otimização inteligente para vagas.', valueDesc: 'Crie um currículo profissional em minutos. Desbloqueie 10 modelos premium e ferramentas avançadas com o Pro.', cta: 'Criar meu currículo', ctaSecondary: 'Ver modelos', badge: 'Construtor de CV com IA', footerText: 'Pagamento único. Acesso vitalício. Sem assinaturas.' },
  features: { title: 'Tudo o que você precisa.', subtitle: 'Poderosas ferramentas de IA para o mercado global', badge: 'O que está incluído', ai: { title: 'Escrita inteligente com IA', desc: 'Melhora clareza, estrutura e impacto automaticamente.' }, multilingual: { title: 'Suporte multilíngue', desc: 'Crie currículos em 9 idiomas instantaneamente.' }, templates: { title: 'Modelos Premium', desc: '10 premium + 3 modelos gratuitos. Designs modernos.' }, ats: { title: 'Compatível com ATS', desc: 'Todos os modelos passam pelos sistemas de triagem (ATS).' }, region: { title: 'Otimizado por região', desc: 'Adaptação automática para EUA, Europa e outros mercados.' }, export: { title: 'Exportação em vários formatos', desc: 'Baixe em DOCX ou copie para a área de transferência.' }, analyzer: { title: 'Analisador de descrição de vaga', desc: 'Combine seu CV com anúncios de emprego com precisão de IA. Somente Pro.' } },
  howItWorks: { title: 'Como funciona', step: 'PASSO', step1: { title: 'Adicione suas informações', desc: 'Preencha seus dados pessoais, experiência profissional e formação para começar a criar seu currículo.' }, step2: { title: 'Melhore seu currículo', desc: 'Use ferramentas inteligentes e sugestões para tornar seu currículo mais forte e profissional.' }, step3: { title: 'Baixe seu currículo', desc: 'Exporte seu currículo finalizado em formato DOCX pronto para enviar aos empregadores.' } },
  whoIsThisFor: { title: 'Para quem é este criador de currículo?', items: ['Pessoas em busca de emprego', 'Estudantes e recém-formados', 'Profissionais em transição de carreira', 'Qualquer pessoa que queira um currículo moderno e profissional'] },
  privacyFirst: { title: 'Privacidade em primeiro lugar', desc: 'Os dados do seu currículo ficam no seu dispositivo. Não armazenamos, vendemos ou compartilhamos suas informações pessoais.', local: 'Este criador de currículo funciona localmente no seu dispositivo para manter suas informações seguras.' },
  simplePricing: { title: 'Preços simples', desc: 'Sem assinatura. Compra única para desbloquear todos os modelos Pro e ferramentas avançadas.' },
  pricing: { 
    title: 'Preços simples.', 
    subtitle: 'Sem assinaturas. Sem taxas mensais. Pague uma vez.', 
    oneTime: 'R$ 19,90 único', 
    getStarted: 'Começar',
    footerText: 'Pagamento único · Acesso vitalício · Sem assinatura',
        free: { name: 'Grátis', price: 'R$ 0', features: ['3 Modelos padrão', '1 Download de CV', '1 Carta de Apresentação', 'Todos os idiomas'], cta: 'Começar Grátis', desc: 'Comece sem custo.' }, 
        pro: { name: 'Pro', price: 'R$ 19,90', features: ['10 Modelos Premium', 'Downloads de CV ilimitados', 'Cartas de Apresentação IA ilimitadas', 'Analisador de vagas', 'Melhorias de escrita com IA', 'Todos os idiomas'], cta: 'Atualizar para Pro', desc: 'Pague uma vez. Use para sempre.', badge: 'Pro — Acesso Vitalício', footer: 'Checkout seguro. Ativação instantânea.', noSubscription: 'Sem assinatura. Sem renovação.' },
    tableTitle: 'Comparação de recursos',
    tableHeaderFeature: 'Recurso',
    tableHeaderFree: 'Grátis',
    tableHeaderPro: 'Pro',
    tableRowCV: 'Downloads de CV',
    tableRowCoverLetter: 'Downloads de Carta',
    tableRowTemplates: 'Modelos',
    tableRowAI: 'Geração de resumo com IA',
    tableRowRewrite: 'Ferramentas de reescrita com IA',
    tableRowAnalyzer: 'Analisador de descrição de vaga',
    tableRowLanguages: 'Todos os idiomas',
    tableRowSupport: 'Suporte prioritário',
    unlimited: 'Ilimitado',
    threeStandard: '3 Padrão',
    proTemplatesCount: '10 Premium + 3 Grátis',
    oneCount: '1',
    popularBadge: 'Mais Popular',
    bestValueBadge: 'Melhor Valor',
    coverLetterFreeValue: '1 download de Carta de Apresentação',
    coverLetterProValue: 'Cartas de Apresentação ilimitadas com IA',
    restoreTitle: 'Já comprou Pro?',
    restoreDesc: 'Restaure sua compra anterior para recuperar o acesso Pro neste dispositivo.',
    restoreButton: 'Restaurar compra',
    proActive: 'Pro Ativo',
    restoringText: 'Restaurando...',
    needHelp: 'Precisa de ajuda?',
    fairUse: 'Limites de uso justo podem ser aplicados para evitar abusos e garantir a confiabilidade do serviço.'
  },
  faq: { title: 'Perguntas Frequentes', items: [
    { q: 'O que está incluído no plano gratuito?', a: 'O plano gratuito permite criar 1 currículo e gerar 1 carta de apresentação. Você também pode usar ferramentas de IA com acesso limitado para melhorar seu conteúdo.' },
    { q: 'Quantas cartas de apresentação posso gerar gratuitamente?', a: 'Você pode gerar 1 carta de apresentação gratuitamente, incluindo 1 tentativa de regeneração.' },
    { q: 'O que acontece depois de usar minha carta gratuita?', a: 'Após usar sua carta gratuita, você pode atualizar para o Pro para cartas ilimitadas e acesso completo às funcionalidades de IA.' },
    { q: 'O que eu ganho com o Pro?', a: 'O Pro oferece cartas de apresentação ilimitadas, acesso completo a todas as ferramentas de IA, modelos premium e funcionalidades avançadas de otimização de currículo.' },
    { q: 'As funcionalidades de IA são gratuitas?', a: 'Algumas funcionalidades de IA estão disponíveis gratuitamente com uso limitado. Atualize para o Pro para desbloquear acesso ilimitado.' },
    { q: 'Posso usar o aplicativo em diferentes idiomas?', a: 'Sim, o aplicativo suporta vários idiomas para que você possa criar seu currículo e carta de apresentação no idioma de sua preferência.' },
    { q: 'Os modelos são compatíveis com ATS?', a: 'Com certeza. Todos os nossos modelos são projetados para passar pelos Sistemas de Rastreamento de Candidatos (ATS) usados por grandes empresas em todo o mundo.' },
    { q: 'Como funciona a IA? Meus dados são armazenados?', a: 'A IA usa apenas suas entradas (cargo, empresa, tom, etc.) para gerar texto. Seus dados pessoais não são armazenados permanentemente. O aplicativo usa serviços de IA de terceiros para processar solicitações de geração.' },
    { q: 'O conteúdo gerado por IA é sempre preciso?', a: 'O conteúdo gerado por IA pode conter imprecisões. Revise cuidadosamente todos os textos gerados antes de enviá-los aos empregadores. Os usuários são responsáveis pelo conteúdo final.' }
  ] },
  cv: { title: 'Construtor de CV', personal: 'Informações Pessoais', experience: 'Experiência Profissional', education: 'Formação Acadêmica', skills: 'Habilidades', certifications: 'Certificações', languages: 'Idiomas', summary: 'Resumo Profissional', generate: 'Gerar com IA', rewrite: 'Reescrever', translate: 'Traduzir', analyzeJob: 'Analisar Vaga', download: 'Baixar', downloadCv: 'Baixar CV', downloadPdf: 'PDF', downloadDocx: 'DOCX', downloadPdfDesc: 'Recomendado · Pronto para enviar', downloadDocxDesc: 'Versão editável', downloadNote: 'O PDF preserva o design selecionado. O DOCX é editável e pode ter pequenas diferenças de layout dependendo do Word, Google Docs ou visualizadores móveis.', pdfExportFailed: 'Falha ao exportar PDF. Por favor, tente novamente.',
    wordExportFailed: 'Falha na exportação do Word. Tente novamente.', preview: 'Visualizar', selectTemplate: 'Selecionar Modelo', jobTitle: 'Cargo', fullName: 'Nome Completo', email: 'E-mail', phone: 'Telefone', address: 'Endereço', fathersName: 'Nome do pai', nationality: 'Nacionalidade', dateOfBirth: 'Data de nascimento', company: 'Empresa', position: 'Cargo', startDate: 'Data de Início', endDate: 'Data de Término', present: 'Atualmente', description: 'Descrição', degree: 'Curso/Grau', school: 'Escola / Universidade', addMore: 'Adicionar mais', remove: 'Remover', region: 'Região de Destino', ready: 'Pronto para criar seu currículo?', readySubtitle: 'Comece grátis. Atualize quando estiver pronto.', edit: 'Editar', copied: 'Copiado!', copy: 'Copiar', jobTitlePlaceholder: 'ex: Engenheiro de Software', fullNamePlaceholder: 'João Silva', aiBullets: 'Melhorias com IA', skillPlaceholder: 'Digite uma habilidade e pressione Enter', certPlaceholder: 'ex: Certificado AWS', langPlaceholder: 'Idioma', levelPlaceholder: 'Nível', summaryPlaceholder: 'Escreva ou gere seu resumo profissional...', jobDescPlaceholder: 'Cole a descrição da vaga aqui para analisar...', short: 'Encurtar', strong: 'Fortalecer', professional: 'Profissional', keywordsFound: 'Palavras-chave encontradas', suggestions: 'Sugestões', suggestedSkills: 'Habilidades Sugeridas', skillCategories: { technical: 'Habilidades técnicas', soft: 'Habilidades interpessoais' }, aiRecommend: 'Recomendação IA', recommendedToast: 'Recomendado', recommendedForYou: '⭐ Recomendado para você', bestResultsTemplate: 'Melhores resultados com este modelo', optimizedForProfile: 'Otimizado para o seu perfil', unlockWithPro: 'Desbloqueie este modelo com Pro', saveRequired: 'Faça login para salvar seu CV.', saved: 'CV salvo!', draftSaved: 'Draft saved', genSuccess: 'Resumo gerado!', bulletsSuccess: 'Melhorias com IA aplicadas!', rewriteSuccess: 'Reescrito', levels: { native: 'Nativo', fluent: 'Fluente', advanced: 'Avançado', intermediate: 'Intermediário', basic: 'Básico' }, regions: { us: 'EUA', eu: 'Europa', balkan: 'Bálcãs', middleEast: 'Oriente Médio', india: 'Índia', japan: 'Japão' }, gender: 'Gênero', genderMale: 'Masculino', genderFemale: 'Feminino', genderOther: 'Outro', coverLetterSection: 'Carta de apresentação', photo: { title: 'Foto de Perfil', optional: '(Opcional)', shown: 'Visível no CV', hidden: 'Oculta no CV', shownDesc: 'Visível por padrão para sua região', hiddenDesc: 'A foto será ocultada no currículo final.', change: 'Alterar foto', upload: 'Enviar foto', recrop: 'Recortar novamente', remove: 'Remover foto', hint: 'JPG ou PNG, máx 5MB. Será recortada em quadrado (1:1).', aiEnhance: 'Melhoria de Foto com IA', aiEnhancing: 'Melhorando...', applied: 'Aplicado', upgrade: 'Atualizar para Pro', features: ['Desfoque de fundo', 'Brilho e contraste', 'Tom de pele natural', 'Centralização facial automática'], cropTitle: 'Recortar Foto', cropHint: 'Arraste para reposicionar · Role para dar zoom', apply: 'Aplicar Recorte', usRegion: 'Oculta por padrão para os EUA (não recomendado)', otherRegion: 'Visível por padrão para sua região', errorFormat: 'Envie uma imagem JPG ou PNG.' }, industryLabel: 'Setor', levelLabel: 'Nível', industryPlaceholder: 'Selecionar setor', industries: { tech: 'TI / Desenvolvimento de Software', data_ai: 'Dados / IA / Machine Learning', cybersecurity: 'Segurança Cibernética', sales_retail: 'Vendas (Varejo)', sales_b2b: 'Vendas (B2B)', marketing: 'Marketing / Marketing Digital', sales: 'Vendas', finance: 'Finanças / Contabilidade', banking_fintech: 'Banco / FinTech', healthcare: 'Saúde / Medicina', pharmacy: 'Farmácia', education: 'Educação / Ensino', human_resources: 'Recursos Humanos', customer_service: 'Suporte ao Cliente / Call Center', logistics: 'Logística / Cadeia de Suprimentos', operations: 'Operações / Produção', executive: 'Gestão / Liderança', project_management: 'Gerenciamento de Projetos', design: 'Design / UX / UI', engineering: 'Engenharia (Mecânica / Elétrica)', construction: 'Construção / Arquitetura', hospitality: 'Hotelaria / Turismo', legal: 'Direito', administration: 'Administração / Escritório', general: 'Geral' }, bulletLevels: { entry: 'Nível Inicial', mid: 'Nível Intermediário', senior: 'Nível Sênior', lead: 'Líder / Diretor' }, aiExperienceIntro: '✨ Melhore sua experiência profissional com IA', aiExperienceIntroSub: 'Escreva descrições mais fortes, claras e profissionais em segundos.', aiSummaryIntro: '✨ Crie um resumo profissional poderoso', aiSummaryIntroSub: 'Gere ou melhore seu resumo para se destacar com os recrutadores.', generateSubtext: 'Resumo poderoso em segundos', shorterSubtext: 'Texto mais conciso e direto', strongerSubtext: 'Realce conquistas e impacto', professionalSubtext: 'Melhore o tom e a redação', aiBulletsSubtext: 'Transforme experiência em resultados', analyzeJobSubtext: 'Alinhe seu CV aos requisitos da vaga', analyzeJobProOnly: 'A análise de descrição de vaga está disponível apenas no Pro.', aiRecommendSubtext: 'Encontre o melhor modelo para você', proHint: 'Recomendado', proHintPopular: 'Mais popular', jobAnalysis: { title: 'Análise do seu CV', subtitle: 'Veja como seu CV corresponde à vaga', matchScore: 'Correspondência', matchGood: 'Boa correspondência — mas pode melhorar', matchAverage: 'Correspondência média — lacunas encontradas', matchWeak: 'Correspondência fraca — melhorias significativas necessárias', keyInsights: 'Pontos-chave', insight1: 'Experiência relevante encontrada', insight2: 'Habilidades essenciais ausentes', insight3: 'Descrições de impacto fracas', importantKeywords: 'Palavras-chave importantes', unlockFull: 'Desbloqueie a lista completa com Pro', suggestedImprovements: 'Melhorias sugeridas', improve1: 'Adicione resultados mensuráveis', improve2: 'Use verbos de ação mais fortes', improve3: 'Inclua habilidades ausentes', proCardTitle: 'Melhore seu CV instantaneamente', proCardText: 'Desbloqueie análise completa, todas as palavras-chave e melhorias com IA', proCardCta: 'Atualizar para Pro', proCardNote: 'Pagamento único', analyzing: 'Analisando seu CV...' } },
  coverLetter: { title: 'Construtor de Carta de Apresentação', firstName: 'Nome', lastName: 'Sobrenome', gender: 'Gênero', genderMale: 'Masculino', genderFemale: 'Feminino', genderPreferNot: 'Prefiro não informar', identitySection: 'Suas informações', jobTitle: 'Cargo', companyName: 'Nome da Empresa',tone: 'Tom', tones: { formal: 'Formal', confident: 'Confiante', friendly: 'Amigável' }, generate: 'Gerar Carta', generating: 'Gerando sua carta de apresentação…', regenerate: 'Regenerar', regenerating: 'Regenerando…', regenerateSubtitle: 'Obtenha uma nova variação', edit: 'Editar', companyPlaceholder: 'ex: Google', firstNamePlaceholder: 'João', lastNamePlaceholder: 'Silva', genSuccess: 'Carta gerada!', saved: 'Salvo!', draftSaved: 'Draft saved', placeholder: 'Sua carta aparecerá aqui...', preview: 'Visualizar', filename: 'Carta de Apresentacao',regenLeft: 'restantes', regenExhausted: 'Você atingiu o número máximo de regenerações para esta carta.', paywallMessage: 'A geração de cartas além do limite gratuito é uma função Pro. Atualize para Pro para gerar cartas de apresentação ilimitadas com IA.', downloadCl: 'Baixar carta de apresentação', generateSubtitle: 'Personalizada para a vaga e a empresa', aiDisclaimer: 'O conteúdo gerado por IA pode conter imprecisões. Revise todo o texto gerado por IA antes de enviar.' },
  auth: { login: 'Entrar', register: 'Criar conta', email: 'E-mail', password: 'Senha', confirmPassword: 'Confirmar Senha', name: 'Nome Completo', forgotPassword: 'Esqueceu a senha?', noAccount: 'Não tem uma conta?', hasAccount: 'Já tem uma conta?', invalidCredentials: 'Credenciais inválidas. Verifique seus dados.', emailTaken: 'Este e-mail já está cadastrado.' },
  dashboard: { title: 'Painel', myCVs: 'Meus Currículos', myCoverLetters: 'Minhas Cartas', createNew: 'Criar Novo', edit: 'Editar', delete: 'Excluir', lastEdited: 'Editado em', upgrade: 'Atualizar para Pro', plan: 'Plano Atual', welcome: 'Bem-vindo de volta', noCVs: 'Nenhum CV criado ainda. Comece agora!', noLetters: 'Nenhuma carta criada ainda.', untitled: 'Sem título', cvDeleted: 'CV excluído', letterDeleted: 'Carta excluída', loginRequired: 'Faça login para acessar seu painel.', upgradeBanner: '1 CV e 1 Carta de Apresentação incluídos.' },
  common: { save: 'Salvar', cancel: 'Cancelar', back: 'Voltar', next: 'Próximo', loading: 'Carregando...', proAccessRequired: 'Acesso Pro necessário. Atualize para continuar.', proAuthorizationUnavailable: 'A autorização Pro está sincronizando. Tente novamente em instantes.', error: 'Algo deu errado', success: 'Sucesso!', darkMode: 'Modo Escuro', lightMode: 'Modo Claro', language: 'Idioma', legal: 'Jurídico', previewBadge: 'Modelo Grátis', slide: 'Slide', appName: 'CV Pro AI', docx: 'DOCX' },
  footer: { rights: '© 2026 CV Pro AI. Todos os direitos reservados.', privacy: 'Política de Privacidade', terms: 'Termos de Serviço', backToHome: 'Voltar para o início' },
  templates: {
    title: 'Modelos', subtitle: '13 modelos profissionais — 3 grátis, 10 premium.', showcase: 'Galeria de Modelos', showcaseSubtitle: 'Projetados para atender aos padrões modernos de contratação.', freeCount: 'Grátis — 3 Modelos', proCount: 'Pro — 10 Modelos Premium', proBadge: 'PRO', unlockPro: 'Desbloqueie os 10 modelos Premium com o Pro', browseAll: 'Ver todos os modelos',
    categories: { ats: 'Amigável para ATS', creative: 'Criativo', executive: 'Executivo', modern: 'Moderno', japanese: 'Japonês' },
    items: {
      'modern-minimal': { name: 'Moderno Minimalista', description: 'Design limpo e pronto para ATS — percebido pelos recrutadores na primeira leitura.', category: 'Amigável para ATS' },
      'clean-simple': { name: 'Limpo e Simples', description: 'Claro e objetivo — perfeito para estudantes e primeiras candidaturas.', category: 'Amigável para ATS' },
      'professional-classic': { name: 'Profissional Clássico', description: 'Atemporal e confiável — o preferido dos recrutadores em todos os setores.', category: 'Amigável para ATS' },
      'creative-bold': { name: 'Criativo Ousado', description: 'Destaque-se imediatamente com um layout impactante para áreas criativas.', category: 'Criativo' },
      'creative-artistic': { name: 'Criativo Artístico', description: 'Expresse sua personalidade com um design moderno que deixa impressão duradoura.', category: 'Criativo' },
      'elegant-formal': { name: 'Elegante Formal', description: 'Refinado e imponente — ideal para cargos sêniores onde cada detalhe conta.', category: 'Executivo' },
      'ats-standard': { name: 'ATS Padrão', description: 'Maximize suas chances de passar em cada filtro automático de seleção.', category: 'Amigável para ATS' },
      'executive-premium': { name: 'Executivo Premium', description: 'Design de alto impacto para líderes C-level que não deixam nada ao acaso.', category: 'Executivo' },
      'nordic-clean': { name: 'Nórdico Limpo', description: 'Layout calmo e focado — sua experiência fala por si mesma, sem distrações.', category: 'Moderno' },
      'tech-sidebar': { name: 'Tech Sidebar', description: 'Estrutura de duas colunas que organiza habilidades e experiência com máximo impacto.', category: 'Moderno' },
      'corporate-navy': { name: 'Corporativo Marinho', description: 'Forte e seguro — transmite autoridade desde o primeiro olhar.', category: 'Executivo' },
      'modern-minimal-executive': { name: 'Executivo Minimalista Moderno', description: 'Presença executiva moderna com barra lateral estruturada.', category: 'Executivo' },
      'contemporary-bold': { name: 'Contemporâneo Ousado', description: 'Design sólido e estruturado para tech e startups que exigem atenção.', category: 'Moderno' },
      'rirekisho': { name: 'Rirekisho', description: 'O formato japonês autêntico — totalmente alinhado com os padrões locais de contratação.', category: 'Japonês' }
    }
  },
  legal: {
    privacy: {
      title: 'Política de Privacidade', effectiveDate: 'Vigente a partir de: Abril de 2026',
      sections: [
        { title: '1. Introdução', content: 'O CV Pro AI respeita sua privacidade e está comprometido em proteger seus dados pessoais. Esta Política de Privacidade explica como coletamos, usamos e protegemos suas informações ao usar nossa ferramenta de criação de currículos e cartas de apresentação com IA.' },
        { title: '2. Dados que coletamos', content: 'Ao usar o aplicativo, podemos coletar as seguintes informações:', items: ['Nome (se fornecido)', 'Endereço de e-mail (se fornecido)', 'Conteúdo do currículo que você insere', 'Dados básicos de uso e análises'] },
        { title: '3. Como usamos seus dados', content: 'Seus dados são utilizados exclusivamente para as seguintes finalidades:', items: ['Gerar currículos e cartas de apresentação', 'Melhorar as funcionalidades de IA e a qualidade do app', 'Garantir o funcionamento básico do aplicativo'] },
        { title: '4. Processamento por IA', content: 'Suas entradas podem ser transmitidas com segurança para provedores terceiros de IA para gerar resumos curriculares, marcadores, cartas de apresentação e outros conteúdos com IA. Os dados são processados apenas com a finalidade de gerar o resultado solicitado. O CV Pro AI não usa seu conteúdo para fins publicitários.' },
        { title: '5. Compartilhamento de dados', content: 'Respeitamos sua privacidade e tratamos seus dados com responsabilidade:', items: ['NÃO vendemos dados de usuários a terceiros', 'Dados não são compartilhados com terceiros, exceto para serviços essenciais ao funcionamento do app'] },
        { title: '6. Armazenamento e segurança', content: 'Os dados do seu currículo são armazenados localmente no seu dispositivo. O app usa salvamento automático para armazenar rascunhos localmente no seu dispositivo. Certos conteúdos podem ser transmitidos com segurança quando você usa recursos de IA que exigem geração ou melhoria de conteúdo. Aplicamos medidas de segurança padrão, incluindo criptografia TLS. Medidas razoáveis são tomadas para proteger todas as informações dos usuários.', items: ['O conteúdo gerado por IA e os dados de rascunho são retidos apenas conforme necessário para fornecer a funcionalidade solicitada. Os rascunhos armazenados localmente permanecem sob controle do usuário e podem ser excluídos a qualquer momento, limpando o rascunho ou redefinindo o aplicativo.'] },
        { title: '7. Seus direitos e proteção RGPD', content: 'Você tem controle total sobre seus dados pessoais. Se estiver no Espaço Econômico Europeu (EEE), você tem direitos adicionais sob o Regulamento Geral sobre a Proteção de Dados (RGPD):', items: ['Solicitar acesso aos seus dados pessoais', 'Solicitar a exclusão dos seus dados (direito ao apagamento)', 'Solicitar a correção de dados imprecisos', 'Solicitar a limitação do processamento (usuários do EEE)', 'Portabilidade dos dados — receber seus dados em formato estruturado e legível por máquina (usuários do EEE)', 'Retirar o consentimento a qualquer momento quando o processamento for baseado em consentimento'] },
        { title: '8. Cookies e análises', content: 'O aplicativo pode usar ferramentas básicas de análise para entender padrões de uso e melhorar o desempenho. Nenhum dado pessoal é compartilhado com redes publicitárias.' },
        { title: '9. Pagamentos e compras', content: 'As compras do plano Pro são processadas com segurança por meio de processadores de pagamento terceirizados:', items: ['Os pagamentos são gerenciados pela Apple App Store, Google Play Store e RevenueCat', 'O CV Pro AI NÃO coleta, processa ou armazena as informações do seu cartão de pagamento', 'Todos os dados de pagamento são gerenciados diretamente pela respectiva loja de aplicativos e processador de pagamento de acordo com suas próprias políticas de privacidade e segurança', 'A validação de compras e o gerenciamento de direitos podem ser fornecidos por meio do RevenueCat ou provedores similares de infraestrutura de pagamento.'] },
        { title: '10. Privacidade de crianças', content: 'Este aplicativo não é destinado a usuários com menos de 13 anos. Não coletamos intencionalmente informações pessoais de crianças menores de 13 anos. Se você acredita que uma criança nos forneceu dados, entre em contato imediatamente.' },
        { title: '11. Sem garantias', content: 'O CV Pro AI não garante emprego, entrevistas, ofertas de trabalho ou resultados de candidaturas. Os usuários permanecem responsáveis por revisar, editar e verificar todo o conteúdo gerado antes de enviá-lo a empregadores ou terceiros.' },
        { title: '12. Contato', content: 'Para qualquer dúvida ou solicitação sobre esta Política de Privacidade, entre em contato em help.cvappai@gmail.com.' }
      ]
    },
    terms: {
      title: 'Termos de Serviço', effectiveDate: 'Vigente a partir de: Abril de 2026',
      sections: [
        { title: '1. Introdução', content: 'O CV Pro AI é uma ferramenta para criar currículos e cartas de apresentação com assistência de IA. Ao usar o aplicativo, você concorda com estes Termos de Serviço.' },
        { title: '2. Descrição do serviço', content: 'CV Pro AI é um criador de currículos e cartas de apresentação com IA. Oferece um plano gratuito e um plano Pro. O plano gratuito inclui 1 download de carta de apresentação e 1 regeneração por IA. O plano Pro (pagamento único de $3,99) oferece downloads ilimitados, geração por IA ilimitada, 10 modelos premium, ferramentas de reescrita com IA e o analisador de descrição de vagas.' },
        { title: '3. Aviso sobre IA', content: 'O conteúdo gerado por IA é fornecido apenas como assistência e pode exigir revisão do usuário. Pode conter imprecisões ou variações de estilo. Você é o único responsável por revisar e editar todos os textos gerados antes de enviá-los a empregadores.' },
        { title: '4. Responsabilidades do usuário', content: 'Você é responsável pela precisão das informações que insere no aplicativo. Certifique-se de que todos os dados sejam verdadeiros e atualizados. A responsabilidade final pelos seus materiais de candidatura é sua.' },
        { title: '5. Uso aceitável', content: 'Você concorda em não usar indevidamente o aplicativo, não enviar conteúdo ilegal e não utilizá-lo de forma que viole as leis aplicáveis. O abuso do serviço pode resultar em restrição de acesso.' },
        { title: '6. Pagamentos', content: 'O plano Pro está disponível por um pagamento único de $3,99, concedendo acesso vitalício sem assinatura ou renovação automática. Se já comprou o Pro, use o botão "Restaurar Compra" na página de Preços.' },
        { title: '7. Sem garantias', content: 'O CV Pro AI fornece ferramentas para auxiliar na criação de currículos. Não garantimos que o uso do aplicativo resultará em ofertas de emprego, entrevistas ou contratações. Os resultados dependem de muitos fatores fora do nosso controle.' },
        { title: '8. Limitação de responsabilidade', content: 'O aplicativo é fornecido "como está" sem garantias de qualquer tipo. O CV Pro AI não será responsável por danos indiretos ou consequentes decorrentes do uso do aplicativo.' },
        { title: '9. Rescisão', content: 'Reservamo-nos o direito de restringir ou encerrar o acesso ao aplicativo em caso de violação destes Termos, incluindo abuso, atividade ilegal ou mau uso do serviço.' },
        { title: '10. Alterações nos Termos', content: 'Podemos atualizar estes Termos periodicamente. O uso continuado do aplicativo após a publicação de alterações constitui aceitação dos Termos atualizados.' },
        { title: '11. Contato', content: 'Para suporte ou dúvidas sobre estes Termos, entre em contato em help.cvappai@gmail.com.' }
      ]
    }
  },
  comparison: {
    title: 'Veja a Diferença',
    subtitle: 'Uma visão lado a lado de como seu CV fica no plano Grátis vs. Pro.',
    freePlan: 'Layout Básico',
    proPlan: 'Layout Profissional',
    good: 'Bom',
    hireReady: 'Pronto para Contratação',
    proBadge: 'Pro',
    freeFeatures: ['Layout e tipografia básica', 'Hierarquia visual mínima', 'Espaçamento padrão'],
    proFeatures: ['Tipografia e hierarquia premium', 'Padrão visual internacional', 'Estrutura refinada'],
    summary: 'Resumo Profissional',
    experience: 'Experiência Profissional',
    expertise: 'Especialidades',
    languages: 'Idiomas',
    chips: ['Estratégia SEO', 'Analytics', 'Conteúdo', 'E-mail'],
    persuasiveText: 'Layouts profissionais ajudam seu CV a se destacar em mercados competitivos.'
  },
  previews: {
    name: 'Alexandre Oliveira',
    role: 'Gerente de Produto Sênior',
    email: 'alex@email.com',
    phone: '+55 11 98765-4321',
    location: 'São Paulo / NY',
    experience: 'Experiência',
    education: 'Formação',
    skills: 'Habilidades',
    contact: 'Contato',
    headOfProduct: 'Head de Produto',
    productManager: 'Gerente de Produto',
    jrPm: 'PM Jr.',
    techCorp: 'TechCorp',
    startupXY: 'StartupXY',
    digitalAgency: 'DigitalAgency',
    techCorpDesc: 'Liderou equipe de 12, lançou 3 produtos principais, cresceu ARR em 40%.',
    startupDesc: 'Definiu roadmap, realizou pesquisa de usuários, melhorou retenção em 28%.',
    agencyDesc: 'Entrega de funcionalidades em 5 produtos de clientes.',
    mba: 'MBA',
    columbia: 'Columbia University',
    present: 'Presente',
    now: 'Agora',
    productVision: 'Visão de Produto',
    teamLeadership: 'Liderança de Equipe',
    gtm: 'Go-to-Market',
    dataAnalysis: 'Análise de Dados',
    productStrategy: 'Estratégia de Produto',
    uxResearch: 'Pesquisa UX',
    agile: 'Agile / Scrum',
    techCorpYears: '2021–Presente',
    startupYears: '2018–2021',
    educationYears: '2016–2018',
    agencyYears: '2016–2018'
  },
  onboarding: {
    title: 'Bem-vindo ao Construtor de CV com IA ✨',
    subtitle: 'Crie um currículo e uma carta de apresentação profissionais em minutos. Comece gratuitamente — faça upgrade quando estiver pronto.',
    freeLabel: 'Grátis',
    freeFeatures: ['3 Modelos Padrão', '1 download de Carta', '1 tentativa de Regeneração com IA', 'Todos os 12 idiomas'],
    proLabel: 'Pro — R$ 19,99',
    proRecommendedBadge: 'RECOMENDADO',
    proFeatures: ['Cartas Ilimitadas', 'Ferramentas de Reescrita com IA', '10 Modelos Premium', 'Analisador de Vagas + Suporte Prioritário'],
    oneTimePayment: 'Pagamento único. Sem assinatura.',
    aiFeatureTitle: 'Recursos de IA',
    aiFeatureDesc: 'A IA usa seus dados apenas para gerar texto e não armazena dados permanentemente. Por favor, revise todo texto gerado por IA antes de enviar.',
    startFree: 'Comece Grátis',
    upgradeToPro: 'Faça Upgrade para Pro',
    secureCheckout: 'Pagamento seguro. Ativação instantânea. Sem assinatura.'
  },
  about: { hero: { badge: 'Descrição para Google Play e App Store', title: 'CV Pro AI', description: 'Crie um currículo profissional em minutos. Comece grátis e faça upgrade uma única vez quando quiser.', ageRating: 'Classificação etária: 3+', languages: '12 idiomas', privacyFirst: 'Privacidade em primeiro lugar' }, description: { title: 'Sobre o aplicativo', paragraphs: ['O CV Pro AI é um construtor de currículo e carta de apresentação com IA pensado para candidaturas modernas.', 'Disponível para Android (Google Play) e iPhone (Apple App Store).', 'Ele ajuda você a escrever resumos profissionais, reforçar conquistas e escolher modelos adequados para diferentes mercados.', 'A experiência foi desenhada para funcionar com consistência em todos os idiomas suportados, sem depender de fallback em inglês.'] }, features: { title: 'Plano grátis vs. Pro', free: { label: 'Grátis', items: ['3 modelos padrão', '1 download de carta de apresentação', '1 tentativa de regeneração', 'Resumo profissional com IA', 'Todos os 12 idiomas', 'Exportação em DOCX'], disabledItems: ['Ferramentas de reescrita com IA', 'Analisador de vagas', '10 modelos premium', 'Cartas de apresentação ilimitadas'] }, pro: { label: 'Pro', price: '$3.99', items: ['10 modelos premium (+ 3 gratuitos)', 'Cartas de apresentação ilimitadas', 'Regenerações ilimitadas', 'Ferramentas de reescrita com IA', 'Analisador de vagas', 'Suporte prioritário'], footer: 'Pagamento único. Sem assinatura e sem renovação automática.' } }, aiDisclosure: { title: 'Como a IA é usada', items: ['O app utiliza serviços de IA de terceiros para gerar resumos, tópicos e cartas de apresentação.', 'Os dados informados são processados apenas para produzir o texto solicitado.', 'O conteúdo gerado por IA pode conter imprecisões e deve ser revisado antes do envio.', 'Os recursos com IA são sempre identificados claramente na interface.'] }, ageAndContent: { title: 'Classificação etária e aviso de conteúdo', ageRating: 'Classificação etária: 3+', ageRatingDesc: 'Adequado para todas as idades. Sem conteúdo adulto.', disclaimer: 'O texto gerado por IA pode conter imprecisões, escolhas gramaticais inadequadas ou sugestões que não combinem com a vaga. Revise e ajuste tudo antes de enviar para recrutadores.', noLiability: 'O CV Pro AI fornece ferramentas para apoiar a criação do currículo e da carta, mas não garante contratação, entrevistas ou resultados específicos.', privacy: 'Os dados do currículo permanecem localmente no dispositivo do usuário. As informações pessoais não são vendidas nem compartilhadas para fins de marketing.' }, languages: { title: 'Idiomas suportados', list: ['English', 'Deutsch', 'Español', 'Français', 'Italiano', 'العربية', 'Srpski', 'Hrvatski', 'Русский', 'Português (Brasil)', 'हिन्दी', '日本語'] }, restorePurchase: { title: 'Restaurar compra', description: 'Se você já comprou o Pro e precisa restaurar o acesso neste dispositivo, use o botão de restauração na página de preços. Se houver qualquer problema, fale conosco em help.cvappai@gmail.com.' }, legal: { title: 'Informações legais', privacyPolicy: 'Privacidade', termsOfService: 'Termos', contact: 'Contato', viewPricing: 'Ver preços' } }
};

// ─── Hindi ────────────────────────────────────────────────────────────────────
const hi: TranslationKeys = {
  nav: { home: 'होम', cvBuilder: 'CV बनाएं', coverLetter: 'कवर लेटर', templates: 'टेम्पलेट', pricing: 'मूल्य', about: 'बारे में', contact: 'संपर्क', login: 'लॉग इन', register: 'साइन अप', dashboard: 'डैशबोर्ड', logout: 'लॉग आउट' },
  hero: { title: 'मिनटों में पेशेवर CV बनाएं।', professionalResumesAiPowered: 'पेशेवर रिज़्यूमे। एआई द्वारा संचालित।', subtitle: 'AI-संचालित CV बिल्डर — प्रीमियम टेम्पलेट और स्मार्ट जॉब ऑप्टिमाइज़ेशन के साथ।', valueDesc: 'मिनटों में एक पेशेवर रिज्यूमे बनाएं। Pro के साथ 10 प्रीमियम टेम्पलेट और एडवांस्ड टूल्स अनलॉक करें।', cta: 'मेरा CV बनाएं', ctaSecondary: 'टेम्पलेट देखें', badge: 'AI-संचालित CV बिल्डर', footerText: 'एकमुश्त भुगतान। आजीवन एक्सेस। कोई सदस्यता नहीं।' },
  features: { title: 'वह सब कुछ जो आपको चाहिए।', subtitle: 'वैश्विक नौकरी बाज़ार के लिए शक्तिशाली AI टूल', badge: 'क्या शामिल है', ai: { title: 'स्मार्ट AI लेखन', desc: 'स्वचालित रूप से स्पष्टता, संरचना और प्रभाव में सुधार करता है।' }, multilingual: { title: 'बहुभाषी समर्थन', desc: '10 भाषाओं में तुरंत CV बनाएं।' }, templates: { title: 'प्रीमियम टेम्पलेट', desc: '10 प्रीमियम + 3 मुफ़्त टेम्पलेट। आधुनिक डिज़ाइन।' }, ats: { title: 'ATS-अनुकूल', desc: 'सभी टेम्पलेट ATS सिस्टम से गुज़रते हैं।' }, region: { title: 'क्षेत्र अनुकूलित', desc: 'भारत, US, EU, बाल्कन और मध्य पूर्व के लिए स्वचालित अनुकूलन।' }, export: { title: 'DOCX निर्यात', desc: 'एक क्लिक में DOCX डाउनलोड करें या क्लिपबोर्ड पर कॉपी करें।' }, analyzer: { title: 'जॉब विवरण विश्लेषक', desc: 'AI की सटीकता से अपना CV नौकरी विज्ञापनों से मिलाएं। केवल Pro।' } },
  howItWorks: { title: 'यह कैसे काम करता है', step: 'चरण', step1: { title: 'अपनी जानकारी जोड़ें', desc: 'अपना रिज्यूमे बनाना शुरू करने के लिए अपने व्यक्तिगत विवरण, कार्य अनुभव और शिक्षा भरें।' }, step2: { title: 'अपना रिज्यूमे सुधारें', desc: 'अपने रिज्यूमे को मजबूत और अधिक पेशेवर बनाने के लिए स्मार्ट टूल्स और सुझावों का उपयोग करें।' }, step3: { title: 'अपना रिज्यूमे डाउनलोड करें', desc: 'नियोक्ताओं को भेजने के लिए तैयार उच्च-गुणवत्ता DOCX फॉर्मेट में अपना रिज्यूमे निर्यात करें।' } },
  whoIsThisFor: { title: 'यह रिज्यूमे बिल्डर किसके लिए है?', items: ['नौकरी खोजने वाले', 'छात्र और स्नातक', 'करियर बदलने वाले पेशेवर', 'जो भी एक आधुनिक पेशेवर रिज्यूमे चाहते हैं'] },
  privacyFirst: { title: 'गोपनीयता पहले', desc: 'आपके रिज्यूमे का डेटा आपके डिवाइस पर रहता है। हम आपकी व्यक्तिगत जानकारी संग्रहीत, बेच या साझा नहीं करते।', local: 'यह रिज्यूमे बिल्डर आपकी जानकारी को सुरक्षित रखने के लिए आपके डिवाइस पर स्थानीय रूप से काम करता है।' },
  simplePricing: { title: 'सरल मूल्य निर्धारण', desc: 'कोई सदस्यता नहीं। सभी Pro टेम्पलेट और उन्नत टूल्स अनलॉक करने के लिए एकमुश्त खरीदारी।' },
  pricing: {
    title: 'सरल मूल्य निर्धारण।',
    subtitle: 'कोई सदस्यता नहीं। कोई मासिक शुल्क नहीं। एक बार भुगतान करें।',
    oneTime: '$3.99 एकमुश्त',
    getStarted: 'शुरू करें',
    footerText: 'एकमुश्त भुगतान · आजीवन एक्सेस · कोई सदस्यता नहीं',
        free: { name: 'मुफ़्त', price: '$0', features: ['3 मानक टेम्पलेट', '1 CV डाउनलोड', '1 कवर लेटर डाउनलोड', 'सभी भाषाएँ'], cta: 'मुफ़्त शुरू करें', desc: 'बिना किसी लागत के शुरू करें।' },
        pro: { name: 'Pro', price: '$3.99', features: ['10 प्रीमियम टेम्पलेट', 'असीमित CV डाउनलोड', 'असीमित AI-जनरेटेड कवर लेटर', 'जॉब विवरण विश्लेषक', 'AI लेखन सुधार', 'सभी भाषाएँ'], cta: 'Pro में अपग्रेड करें', desc: 'एक बार भुगतान करें। हमेशा के लिए उपयोग करें।', badge: 'Pro — आजीवन एक्सेस', footer: 'सुरक्षित चेकआउट। तत्काल सक्रियण।', noSubscription: 'कोई सदस्यता नहीं। कोई नवीनीकरण नहीं।' },
    tableTitle: 'फीचर तुलना',
    tableHeaderFeature: 'फीचर',
    tableHeaderFree: 'मुफ़्त',
    tableHeaderPro: 'Pro',
    tableRowCV: 'CV डाउनलोड',
    tableRowCoverLetter: 'कवर लेटर डाउनलोड',
    tableRowTemplates: 'टेम्पलेट',
    tableRowAI: 'AI सारांश जनरेशन',
    tableRowRewrite: 'AI पुनर्लेखन टूल',
    tableRowAnalyzer: 'जॉब विवरण विश्लेषक',
    tableRowLanguages: 'सभी भाषाएँ',
    tableRowSupport: 'प्राथमिकता समर्थन',
    unlimited: 'असीमित',
    threeStandard: '3 मानक',
    proTemplatesCount: '10 प्रीमियम + 3 मुफ़्त',
    oneCount: '1',
    popularBadge: 'सबसे लोकप्रिय',
    bestValueBadge: 'सबसे अच्छा मूल्य',
    coverLetterFreeValue: '1 कवर लेटर डाउनलोड',
    coverLetterProValue: 'असीमित AI-जनरेटेड कवर लेटर',
    restoreTitle: 'क्या आपने पहले Pro खरीदा है?',
    restoreDesc: 'इस डिवाइस पर Pro एक्सेस वापस पाने के लिए अपनी पिछली खरीद पुनर्स्थापित करें।',
    restoreButton: 'खरीद पुनर्स्थापित करें',
    proActive: 'Pro सक्रिय',
    restoringText: 'पुनर्स्थापित हो रहा है...',
    needHelp: 'मदद चाहिए?',
    fairUse: 'दुरुपयोग रोकने और विश्वसनीय सेवा सुनिश्चित करने के लिए उचित उपयोग सीमाएँ लागू हो सकती हैं।'
  },
  faq: { title: 'अक्सर पूछे जाने वाले प्रश्न', items: [
    { q: 'मुफ़्त प्लान में क्या शामिल है?', a: 'मुफ़्त प्लान आपको 1 CV बनाने और 1 कवर लेटर जनरेट करने की सुविधा देता है। आप अपनी सामग्री को बेहतर बनाने के लिए सीमित पहुँच के साथ AI टूल का भी उपयोग कर सकते हैं।' },
    { q: 'मैं मुफ़्त में कितने कवर लेटर जनरेट कर सकता/सकती हूँ?', a: 'आप 1 कवर लेटर मुफ़्त में जनरेट कर सकते हैं, जिसमें 1 पुनर्निर्माण प्रयास शामिल है।' },
    { q: 'मुफ़्त कवर लेटर उपयोग करने के बाद क्या होता है?', a: 'मुफ़्त कवर लेटर का उपयोग करने के बाद, आप असीमित कवर लेटर और AI सुविधाओं तक पूर्ण पहुँच के लिए Pro में अपग्रेड कर सकते हैं।' },
    { q: 'Pro के साथ मुझे क्या मिलता है?', a: 'Pro आपको असीमित कवर लेटर, सभी AI टूल तक पूर्ण पहुँच, प्रीमियम टेम्पलेट और उन्नत CV अनुकूलन सुविधाएँ देता है।' },
    { q: 'क्या AI सुविधाएँ मुफ़्त हैं?', a: 'कुछ AI सुविधाएँ सीमित उपयोग के साथ मुफ़्त उपलब्ध हैं। असीमित पहुँच के लिए Pro में अपग्रेड करें।' },
    { q: 'क्या मैं ऐप को अलग-अलग भाषाओं में उपयोग कर सकता/सकती हूँ?', a: 'हाँ, ऐप कई भाषाओं का समर्थन करता है ताकि आप अपनी पसंदीदा भाषा में CV और कवर लेटर बना सकें।' },
    { q: 'क्या टेम्पलेट ATS-अनुकूल हैं?', a: 'बिल्कुल। हमारे सभी टेम्पलेट दुनिया भर के प्रमुख नियोक्ताओं द्वारा उपयोग किए जाने वाले ATS सिस्टम को पास करने के लिए डिज़ाइन किए गए हैं।' },
    { q: 'AI कैसे काम करता है? क्या मेरा डेटा संग्रहीत होता है?', a: 'AI केवल आपके इनपुट (नौकरी का शीर्षक, कंपनी, टोन आदि) का उपयोग टेक्स्ट उत्पन्न करने के लिए करता है। आपका व्यक्तिगत डेटा स्थायी रूप से संग्रहीत नहीं होता। ऐप पीढ़ी अनुरोधों को संसाधित करने के लिए तृतीय-पक्ष AI सेवाओं का उपयोग करता है।' },
    { q: 'क्या AI-जनित सामग्री हमेशा सटीक होती है?', a: 'AI-जनित सामग्री में अशुद्धियाँ हो सकती हैं। नियोक्ताओं को भेजने से पहले सभी AI-जनित टेक्स्ट को ध्यान से समीक्षा करें। उपयोगकर्ता अंतिम सामग्री के लिए जिम्मेदार हैं।' }
  ] },
  cv: {
    title: 'CV बिल्डर', personal: 'व्यक्तिगत जानकारी', experience: 'कार्य अनुभव', education: 'शिक्षा', skills: 'कौशल', certifications: 'प्रमाणपत्र', languages: 'भाषाएँ', summary: 'पेशेवर सारांश', generate: 'AI से जनरेट करें', rewrite: 'पुनर्लिखें', translate: 'अनुवाद करें', analyzeJob: 'जॉब विवरण विश्लेषण', download: 'डाउनलोड', downloadCv: 'CV डाउनलोड करें', downloadPdf: 'PDF', downloadDocx: 'DOCX', downloadPdfDesc: 'अनुशंसित · भेजने के लिए तैयार', downloadDocxDesc: 'संपादन योग्य संस्करण', downloadNote: 'PDF चुने हुए डिज़ाइन को सुरक्षित रखता है। DOCX संपादन योग्य है और Word, Google Docs या मोबाइल व्यूअर के आधार पर मामूली लेआउट अंतर हो सकते हैं।', pdfExportFailed: 'PDF निर्यात विफल हुआ। कृपया पुनः प्रयास करें।',
    wordExportFailed: 'Word निर्यात विफल। कृपया पुनः प्रयास करें।', preview: 'पूर्वावलोकन', selectTemplate: 'टेम्पलेट चुनें', jobTitle: 'पद का नाम', fullName: 'पूरा नाम', email: 'ईमेल', phone: 'फ़ोन', address: 'पता',
    fathersName: 'पिता का नाम',
    nationality: 'राष्ट्रीयता',
    dateOfBirth: 'जन्म तिथि',
    company: 'कंपनी', position: 'पद', startDate: 'प्रारंभ तिथि', endDate: 'समाप्ति तिथि', present: 'वर्तमान', description: 'विवरण', degree: 'डिग्री', school: 'स्कूल / विश्वविद्यालय', addMore: 'और जोड़ें', remove: 'हटाएं', region: 'लक्षित क्षेत्र', ready: 'अपना CV बनाने के लिए तैयार?', readySubtitle: 'मुफ़्त में शुरू करें। तैयार होने पर अपग्रेड करें।', edit: 'संपादित करें', copied: 'कॉपी हो गया!', copy: 'कॉपी करें', jobTitlePlaceholder: 'उदा. सॉफ्टवेयर इंजीनियर', fullNamePlaceholder: 'राहुल शर्मा', aiBullets: 'AI सुधार', skillPlaceholder: 'कौशल टाइप करें और Enter दबाएं', certPlaceholder: 'उदा. AWS प्रमाणित', langPlaceholder: 'भाषा', levelPlaceholder: 'स्तर',
    summaryPlaceholder: 'अपना पेशेवर सारांश लिखें या जनरेट करें...',
    jobDescPlaceholder: 'विश्लेषण के लिए यहाँ जॉब विवरण पेस्ट करें...',
    short: 'छोटा',
    strong: 'मज़बूत', professional: 'पेशेवर', keywordsFound: 'कीवर्ड मिले', suggestions: 'सुझाव', suggestedSkills: 'सुझावित कौशल', skillCategories: { technical: 'तकनीकी कौशल', soft: 'सॉफ्ट स्किल्स' }, aiRecommend: 'AI अनुशंसा', recommendedToast: 'अनुशंसित', recommendedForYou: '⭐ आपके लिए अनुशंसित', bestResultsTemplate: 'इस टेम्पलेट से सर्वोत्तम परिणाम', optimizedForProfile: 'आपके प्रोफ़ाइल के लिए अनुकूलित', unlockWithPro: 'Pro के साथ यह टेम्पलेट अनलॉक करें', saveRequired: 'अपना CV सेव करने के लिए लॉग इन करें।', saved: 'CV सेव हो गया!', draftSaved: 'Draft saved', genSuccess: 'सारांश जनरेट हो गया!', bulletsSuccess: 'AI सुधार लागू किए गए!', rewriteSuccess: 'पुनर्लिखा गया',
    levels: { native: 'मातृभाषा', fluent: 'धाराप्रवाह', advanced: 'उन्नत', intermediate: 'मध्यम', basic: 'मूल' },
    regions: { us: 'US', eu: 'EU', balkan: 'बाल्कन', middleEast: 'मध्य पूर्व', india: 'भारत', japan: 'जापान' }, gender: 'लिंग', genderMale: 'पुरुष', genderFemale: 'महिला', genderOther: 'अन्य', coverLetterSection: 'कवर लेटर',
    photo: { title: 'प्रोफ़ाइल फ़ोटो', optional: '(वैकल्पिक)', shown: 'CV में दिख रहा है', hidden: 'CV में छुपा हुआ', shownDesc: 'आपके क्षेत्र के लिए डिफ़ॉल्ट रूप से दिखाया गया', hiddenDesc: 'फ़ोटो CV आउटपुट से छुपा हुआ है।', change: 'फ़ोटो बदलें', upload: 'फ़ोटो अपलोड करें', recrop: 'पुनः क्रॉप करें', remove: 'फ़ोटो हटाएं', hint: 'JPG या PNG, अधिकतम 5MB। वर्गाकार (1:1) क्रॉप किया जाएगा।', aiEnhance: 'AI फ़ोटो सुधार', aiEnhancing: 'सुधार हो रहा है...', applied: 'लागू', upgrade: 'Pro में अपग्रेड करें', features: ['बैकग्राउंड ब्लर', 'चमक और कंट्रास्ट', 'प्राकृतिक त्वचा टोन', 'स्वत: चेहरा केंद्रित'], cropTitle: 'फ़ोटो क्रॉप करें', cropHint: 'पुनः स्थापित करने के लिए खींचें · ज़ूम के लिए स्क्रॉल करें', apply: 'क्रॉप लागू करें', usRegion: 'US क्षेत्र के लिए डिफ़ॉल्ट रूप से छुपा हुआ', otherRegion: 'आपके क्षेत्र के लिए डिफ़ॉल्ट रूप से दिखाया गया', errorFormat: 'कृपया JPG या PNG छवि अपलोड करें।' }, industryLabel: 'उद्योग', levelLabel: 'स्तर', industryPlaceholder: 'उद्योग चुनें', industries: { tech: 'IT / सॉफ़्टवेयर डेवलपमेंट', data_ai: 'डेटा / AI / मशीन लर्निंग', cybersecurity: 'साइबर सुरक्षा', sales_retail: 'बिक्री (रिटेल)', sales_b2b: 'बिक्री (B2B)', marketing: 'मार्केटिंग / डिजिटल मार्केटिंग', sales: 'बिक्री', finance: 'वित्त / लेखा', banking_fintech: 'बैंकिंग / फिनटेक', healthcare: 'स्वास्थ्य / चिकित्सा', pharmacy: 'फार्मेसी', education: 'शिक्षा / अध्यापन', human_resources: 'मानव संसाधन', customer_service: 'ग्राहक सेवा / कॉल सेंटर', logistics: 'लॉजिस्टिक्स / सप्लाई चेन', operations: 'संचालन / उत्पादन', executive: 'प्रबंधन / नेतृत्व', project_management: 'प्रोजेक्ट मैनेजमेंट', design: 'डिज़ाइन / UX / UI', engineering: 'इंजीनियरिंग (मैकेनिकल / इलेक्ट्रिकल)', construction: 'निर्माण / वास्तुकला', hospitality: 'होटल / पर्यटन', legal: 'कानून', administration: 'प्रशासन / कार्यालय', general: 'सामान्य' }, bulletLevels: { entry: 'प्रवेश स्तर', mid: 'मध्य स्तर', senior: 'वरिष्ठ स्तर', lead: 'लीड / निदेशक' }, aiExperienceIntro: '✨ AI से अपने कार्य अनुभव को बेहतर बनाएं', aiExperienceIntroSub: 'कुछ ही सेकंड में मजबूत, स्पष्ट और पेशेवर विवरण लिखें।', aiSummaryIntro: '✨ एक प्रभावी पेशेवर सारांश बनाएं', aiSummaryIntroSub: 'भर्तीकर्ताओं के सामने अलग दिखने के लिए अपना सारांश तैयार करें।', generateSubtext: 'कुछ सेकंड में मजबूत सारांश', shorterSubtext: 'टेक्स्ट संक्षिप्त और स्पष्ट बनाएं', strongerSubtext: 'उपलब्धियां और प्रभाव दिखाएं', professionalSubtext: 'टोन और शब्दावली सुधारें', aiBulletsSubtext: 'अनुभव को मजबूत पॉइंट्स में बदलें', analyzeJobSubtext: 'CV को नौकरी की जरूरतों से मिलाएं', analyzeJobProOnly: 'नौकरी विवरण विश्लेषण केवल Pro में उपलब्ध है।', aiRecommendSubtext: 'आपके प्रोफाइल के लिए सबसे अच्छा टेम्पलेट', proHint: 'अनुशंसित', proHintPopular: 'सबसे लोकप्रिय', jobAnalysis: { title: 'आपके CV का विश्लेषण', subtitle: 'देखें आपका CV इस नौकरी से कितना मेल खाता है', matchScore: 'मेल', matchGood: 'अच्छा मेल — लेकिन सुधार संभव है', matchAverage: 'औसत मेल — कुछ कमियां मिलीं', matchWeak: 'कमज़ोर मेल — महत्वपूर्ण सुधार ज़रूरी', keyInsights: 'मुख्य बातें', insight1: 'प्रासंगिक अनुभव मिला', insight2: 'मुख्य कौशल नहीं हैं', insight3: 'प्रभाव के विवरण कमज़ोर हैं', importantKeywords: 'महत्वपूर्ण कीवर्ड', unlockFull: 'Pro से पूरी सूची अनलॉक करें', suggestedImprovements: 'सुझाए गए सुधार', improve1: 'मापनीय परिणाम जोड़ें', improve2: 'मजबूत क्रिया शब्द उपयोग करें', improve3: 'गायब कौशल शामिल करें', proCardTitle: 'अपना CV तुरंत सुधारें', proCardText: 'पूरा विश्लेषण, सभी कीवर्ड और AI सुधार अनलॉक करें', proCardCta: 'Pro में अपग्रेड करें', proCardNote: 'एकमुश्त भुगतान', analyzing: 'आपका CV विश्लेषण हो रहा है...' }
  },
  coverLetter: { title: 'कवर लेटर बिल्डर', firstName: 'पहला नाम', lastName: 'अंतिम नाम', gender: 'लिंग', genderMale: 'पुरुष', genderFemale: 'महिला', genderPreferNot: 'बताना नहीं चाहता', identitySection: 'आपकी जानकारी', jobTitle: 'पद का नाम', companyName: 'कंपनी का नाम',tone: 'स्वर', tones: { formal: 'औपचारिक', confident: 'आत्मविश्वासी', friendly: 'मैत्रीपूर्ण' }, generate: 'कवर लेटर जनरेट करें', generating: 'आपका कवर लेटर जनरेट हो रहा है…', regenerate: 'पुनः जनरेट करें', regenerating: 'पुनः जनरेट हो रहा है…', regenerateSubtitle: 'नया संस्करण प्राप्त करें', edit: 'संपादित करें', companyPlaceholder: 'उदा. Google', firstNamePlaceholder: 'राहुल', lastNamePlaceholder: 'शर्मा', genSuccess: 'कवर लेटर जनरेट हो गया!', saved: 'सेव हो गया!', draftSaved: 'Draft saved', placeholder: 'आपका कवर लेटर यहाँ दिखाई देगा...', preview: 'पूर्वावलोकन', filename: 'Cover Letter',regenLeft: 'शेष', regenExhausted: 'आपने इस कवर लेटर के लिए पुनर्जनन की अधिकतम संख्या तक पहुंच गए हैं।', paywallMessage: 'मुफ्त सीमा से अधिक कवर लेटर जनरेट करना Pro सुविधा है। असीमित AI कवर लेटर के लिए Pro में अपग्रेड करें।', downloadCl: 'कवर लेटर डाउनलोड करें', generateSubtitle: 'नौकरी और कंपनी के अनुसार तैयार', aiDisclaimer: 'AI द्वारा उत्पन्न सामग्री में अशुद्धियाँ हो सकती हैं। कृपया सबमिट करने से पहले सभी AI-जनरेटेड टेक्स्ट की समीक्षा करें।' },
  auth: { login: 'लॉग इन', register: 'खाता बनाएं', email: 'ईमेल', password: 'पासवर्ड', confirmPassword: 'पासवर्ड की पुष्टि करें', name: 'पूरा नाम', forgotPassword: 'पासवर्ड भूल गए?', noAccount: 'खाता नहीं है?', hasAccount: 'पहले से खाता है?', invalidCredentials: 'अमान्य क्रेडेंशियल। पहले पंजीकरण करें।', emailTaken: 'ईमेल पहले से पंजीकृत है।' },
  dashboard: { title: 'डैशबोर्ड', myCVs: 'मेरे CV', myCoverLetters: 'मेरे कवर लेटर', createNew: 'नया बनाएं', edit: 'संपादित करें', delete: 'हटाएं', lastEdited: 'अंतिम संपादित', upgrade: 'Pro में अपग्रेड करें', plan: 'वर्तमान योजना', welcome: 'वापस स्वागत है', noCVs: 'अभी तक कोई CV नहीं। पहला बनाएं!', noLetters: 'अभी तक कोई कवर लेटर नहीं।', untitled: 'बिना शीर्षक', cvDeleted: 'CV हटाया गया', letterDeleted: 'कवर लेटर हटाया गया', loginRequired: 'डैशबोर्ड एक्सेस के लिए लॉग इन करें।', upgradeBanner: '1 CV और 1 कवर लेटर शामिल है।' },
  common: { save: 'सेव करें', cancel: 'रद्द करें', back: 'वापस', next: 'अगला', loading: 'लोड हो रहा है...', proAccessRequired: 'Pro एक्सेस आवश्यक है। जारी रखने के लिए अपग्रेड करें.', proAuthorizationUnavailable: 'Pro authorization सिंक हो रहा है। कृपया कुछ देर बाद फिर कोशिश करें.', error: 'कुछ गलत हो गया', success: 'सफलता!', darkMode: 'डार्क मोड', lightMode: 'लाइट मोड', language: 'भाषा', legal: 'कानूनी', previewBadge: 'मुफ़्त टेम्पलेट', slide: 'स्लाइड', appName: 'CV Pro AI', docx: 'DOCX' },
  footer: { rights: '© 2026 CV Pro AI. सर्वाधिकार सुरक्षित।', privacy: 'गोपनीयता नीति', terms: 'सेवा की शर्तें', backToHome: 'होम पर वापस जाएं' },
  templates: {
    title: 'टेम्पलेट', subtitle: '13 पेशेवर टेम्पलेट — 3 मुफ़्त, 10 प्रीमियम। हर करियर पथ के लिए।', showcase: 'टेम्पलेट शोकेस', showcaseSubtitle: 'आधुनिक भर्ती अपेक्षाओं को पूरा करने के लिए डिज़ाइन किया गया।', freeCount: 'मुफ़्त — 3 टेम्पलेट', proCount: 'Pro — 10 प्रीमियम टेम्पलेट', proBadge: 'PRO', unlockPro: '$3.99 एकमुश्त भुगतान के साथ सभी 10 प्रीमियम टेम्पलेट अनलॉक करें', browseAll: 'सभी टेम्पलेट देखें',
    categories: { ats: 'ATS-अनुकूल', creative: 'रचनात्मक', executive: 'कार्यकारी', modern: 'आधुनिक', japanese: 'जापानी' },
    items: {
      'modern-minimal': { name: 'मॉडर्न मिनिमल', description: 'साफ, ATS-तैयार डिज़ाइन — रिक्रूटर्स पहली नज़र में ध्यान देते हैं।', category: 'ATS-अनुकूल' },
      'clean-simple': { name: 'क्लीन सिंपल', description: 'स्पष्ट और सरल — छात्रों और पहली नौकरी के लिए एकदम सही।', category: 'ATS-अनुकूल' },
      'professional-classic': { name: 'प्रोफेशनल क्लासिक', description: 'कालातीत और भरोसेमंद — हर उद्योग में रिक्रूटर्स की पसंद।', category: 'ATS-अनुकूल' },
      'creative-bold': { name: 'क्रिएटिव बोल्ड', description: 'तुरंत ध्यान खींचें — रचनात्मक क्षेत्रों के लिए बोल्ड और प्रभावशाली डिज़ाइन।', category: 'रचनात्मक' },
      'creative-artistic': { name: 'क्रिएटिव आर्टिस्टिक', description: 'अपनी पहचान दिखाएं — आधुनिक स्टाइल जो याद रह जाए।', category: 'रचनात्मक' },
      'elegant-formal': { name: 'एलिगेंट फॉर्मल', description: 'परिष्कृत और प्रभावशाली — वरिष्ठ पदों के लिए जहाँ पहली छाप मायने रखती है।', category: 'कार्यकारी' },
      'ats-standard': { name: 'ATS स्टैंडर्ड', description: 'हर ऑटोमेटेड सिलेक्शन फ़िल्टर पास करने की संभावना बढ़ाएं।', category: 'ATS-अनुकूल' },
      'executive-premium': { name: 'एक्जीक्यूटिव प्रीमियम', description: 'C-लेवल लीडर्स के लिए प्रभावशाली डिज़ाइन जो हर शब्द को अर्थपूर्ण बनाता है।', category: 'कार्यकारी' },
      'nordic-clean': { name: 'नॉर्डिक क्लीन', description: 'शांत और केंद्रित लेआउट — आपका अनुभव खुद बोलता है।', category: 'आधुनिक' },
      'tech-sidebar': { name: 'टेक साइडबार', description: 'दो-कॉलम संरचना जो कौशल और अनुभव को अधिकतम प्रभाव के साथ प्रस्तुत करती है।', category: 'आधुनिक' },
      'corporate-navy': { name: 'कॉर्पोरेट नेवी', description: 'मज़बूत और आत्मविश्वासी — पहली नज़र से ही गहरी छाप छोड़ता है।', category: 'कार्यकारी' },
      'modern-minimal-executive': { name: 'मॉडर्न मिनिमल एक्जीक्यूटिव', description: 'संरचित साइडबार के साथ आधुनिक कार्यकारी उपस्थिति।', category: 'कार्यकारी' },
      'contemporary-bold': { name: 'कंटेम्पोरेरी बोल्ड', description: 'टेक और स्टार्टअप भूमिकाओं के लिए शक्तिशाली, संरचित डिज़ाइन।', category: 'आधुनिक' },
      'rirekisho': { name: 'Rirekisho', description: 'प्रामाणिक जापानी CV प्रारूप — स्थानीय भर्ती मानकों के साथ पूरी तरह संरेखित।', category: 'जापानी' }
    }
  },
  legal: {
    privacy: {
      title: 'गोपनीयता नीति', effectiveDate: 'प्रभावी: अप्रैल 2026',
      sections: [
        { title: '1. परिचय', content: 'CV Pro AI आपकी गोपनीयता का सम्मान करता है और आपके व्यक्तिगत डेटा की सुरक्षा के लिए प्रतिबद्ध है। यह गोपनीयता नीति बताती है कि हम AI-आधारित CV और कवर लेटर बिल्डर का उपयोग करते समय आपकी जानकारी कैसे एकत्र, उपयोग और सुरक्षित करते हैं।' },
        { title: '2. हम जो डेटा एकत्र करते हैं', content: 'ऐप का उपयोग करते समय हम निम्नलिखित जानकारी एकत्र कर सकते हैं:', items: ['नाम (यदि प्रदान किया गया)', 'ईमेल पता (यदि प्रदान किया गया)', 'आपके द्वारा दर्ज की गई CV सामग्री', 'बुनियादी उपयोग डेटा और विश्लेषण'] },
        { title: '3. हम आपके डेटा का उपयोग कैसे करते हैं', content: 'आपका डेटा केवल निम्नलिखित उद्देश्यों के लिए उपयोग किया जाता है:', items: ['CV और कवर लेटर तैयार करने के लिए', 'AI सुविधाओं और ऐप गुणवत्ता सुधारने के लिए', 'ऐप की मुख्य कार्यक्षमता प्रदान करने के लिए'] },
        { title: '4. AI प्रसंस्करण', content: 'आपका इनपुट रिज़्यूमे सारांश, बुलेट पॉइंट, कवर लेटर और अन्य AI-संचालित सामग्री तैयार करने के लिए तृतीय-पक्ष AI प्रदाताओं को सुरक्षित रूप से प्रेषित किया जा सकता है। डेटा केवल अनुरोधित आउटपुट उत्पन्न करने के उद्देश्य से संसाधित किया जाता है। CV Pro AI विज्ञापन उद्देश्यों के लिए आपकी सामग्री का उपयोग नहीं करता है।' },
        { title: '5. डेटा साझाकरण', content: 'हम आपकी गोपनीयता का सम्मान करते हैं और आपके डेटा को जिम्मेदारी से प्रबंधित करते हैं:', items: ['हम उपयोगकर्ता डेटा तीसरे पक्ष को नहीं बेचते', 'डेटा केवल ऐप के संचालन के लिए आवश्यक सेवाओं को ही साझा किया जाता है'] },
        { title: '6. डेटा भंडारण और सुरक्षा', content: 'आपका CV डेटा आपके डिवाइस पर स्थानीय रूप से संग्रहीत है। ऐप कार्य-प्रगति वाले ड्राफ्ट को आपके डिवाइस पर स्थानीय रूप से संग्रहीत करने के लिए ऑटोसेव का उपयोग करता है। जब आप AI-संचालित सुविधाओं का उपयोग करते हैं जिनमें सामग्री निर्माण या सुधार की आवश्यकता होती है, तो कुछ सामग्री सुरक्षित रूप से प्रेषित की जा सकती है। हम TLS एन्क्रिप्शन सहित उद्योग-मानक सुरक्षा उपाय लागू करते हैं। सभी उपयोगकर्ता जानकारी की सुरक्षा के लिए उचित उपाय किए जाते हैं।', items: ['AI द्वारा उत्पन्न सामग्री और ड्राफ्ट डेटा केवल अनुरोधित कार्यक्षमता प्रदान करने के लिए आवश्यकतानुसार बनाए रखा जाता है। स्थानीय रूप से संग्रहीत ड्राफ्ट सामग्री उपयोगकर्ता के नियंत्रण में रहती है और ड्राफ्ट साफ़ करके या एप्लिकेशन को रीसेट करके किसी भी समय हटाई जा सकती है।'] },
        { title: '7. आपके अधिकार और GDPR सुरक्षा', content: 'आपके पास अपने व्यक्तिगत डेटा पर पूरा नियंत्रण है। यदि आप यूरोपीय आर्थिक क्षेत्र (EEA) में स्थित हैं, तो आपको सामान्य डेटा संरक्षण विनियमन (GDPR) के तहत अतिरिक्त अधिकार प्राप्त हैं:', items: ['अपने व्यक्तिगत डेटा तक पहुंच का अनुरोध करें', 'अपने डेटा को हटाने का अनुरोध करें (मिटाए जाने का अधिकार)', 'गलत डेटा में सुधार का अनुरोध करें', 'प्रसंस्करण को प्रतिबंधित करने का अनुरोध करें (EEA उपयोगकर्ता)', 'डेटा पोर्टेबिलिटी — संरचित, मशीन-पठनीय प्रारूप में अपना डेटा प्राप्त करें (EEA उपयोगकर्ता)', 'जब प्रसंस्करण सहमति पर आधारित हो तो किसी भी समय सहमति वापस लें'] },
        { title: '8. कुकीज़ और विश्लेषण', content: 'ऐप उपयोग पैटर्न समझने और प्रदर्शन सुधारने के लिए बुनियादी विश्लेषण टूल का उपयोग कर सकता है। कोई भी व्यक्तिगत डेटा विज्ञापन नेटवर्क के साथ साझा नहीं किया जाता।' },
        { title: '9. भुगतान और खरीदारी', content: 'Pro प्लान की खरीदारी तृतीय-पक्ष भुगतान प्रोसेसर के माध्यम से सुरक्षित रूप से संसाधित की जाती है:', items: ['भुगतान Apple App Store, Google Play Store और RevenueCat द्वारा संभाले जाते हैं', 'CV Pro AI आपकी भुगतान कार्ड जानकारी एकत्र, प्रसंस्कृत या संग्रहीत नहीं करता है', 'सभी भुगतान डेटा सीधे संबंधित ऐप स्टोर और भुगतान प्रोसेसर द्वारा उनकी अपनी गोपनीयता और सुरक्षा नीतियों के अनुसार प्रबंधित किया जाता है', 'खरीद सत्यापन और अधिकार प्रबंधन RevenueCat या समान भुगतान बुनियादी ढांचा प्रदाताओं के माध्यम से प्रदान किया जा सकता है।'] },
        { title: '10. बच्चों की गोपनीयता', content: 'यह ऐप 13 वर्ष से कम आयु के उपयोगकर्ताओं के लिए नहीं है। हम जानबूझकर 13 वर्ष से कम आयु के बच्चों से व्यक्तिगत जानकारी एकत्र नहीं करते। यदि आपको लगता है कि किसी बच्चे ने हमें डेटा प्रदान किया है, तो कृपया तुरंत हमसे संपर्क करें।' },
        { title: '11. कोई गारंटी नहीं', content: 'CV Pro AI रोजगार, साक्षात्कार, नौकरी के प्रस्ताव या आवेदन परिणामों की गारंटी नहीं देता है। उपयोगकर्ता नियोक्ताओं या तीसरे पक्ष को प्रस्तुत करने से पहले सभी उत्पन्न सामग्री की समीक्षा, संपादन और सत्यापन करने के लिए जिम्मेदार रहते हैं।' },
        { title: '12. संपर्क', content: 'इस गोपनीयता नीति के संबंध में किसी भी प्रश्न या अनुरोध के लिए, help.cvappai@gmail.com पर हमसे संपर्क करें।' }
      ]
    },
    terms: {
      title: 'सेवा की शर्तें', effectiveDate: 'प्रभावी: अप्रैल 2026',
      sections: [
        { title: '1. परिचय', content: 'CV Pro AI AI सहायता का उपयोग करके CV और कवर लेटर बनाने का एक टूल है। ऐप का उपयोग करके, आप इन सेवा की शर्तों से सहमत होते हैं।' },
        { title: '2. सेवा का विवरण', content: 'CV Pro AI एक AI-संचालित CV और कवर लेटर बिल्डर है। ऐप एक निःशुल्क प्लान और एक Pro प्लान प्रदान करता है। निःशुल्क प्लान में 1 कवर लेटर डाउनलोड और 1 AI पुनर्जनन शामिल है। Pro प्लान ($3.99 एकमुश्त) असीमित डाउनलोड, असीमित AI उत्पादन, 10 प्रीमियम टेम्पलेट, AI रीराइट टूल्स और जॉब डिस्क्रिप्शन एनालाइज़र प्रदान करता है।' },
        { title: '3. AI अस्वीकरण', content: 'AI द्वारा उत्पन्न सामग्री केवल सहायता के लिए प्रदान की जाती है और उपयोगकर्ता समीक्षा की आवश्यकता हो सकती है। इसमें अशुद्धियां या शैलीगत भिन्नताएं हो सकती हैं। नियोक्ताओं को भेजने से पहले सभी AI-उत्पन्न टेक्स्ट की समीक्षा और संपादन करने की पूरी जिम्मेदारी आपकी है।' },
        { title: '4. उपयोगकर्ता जिम्मेदारियां', content: 'आप ऐप में दर्ज की गई जानकारी की सटीकता के लिए जिम्मेदार हैं। सुनिश्चित करें कि सभी डेटा सत्य और अद्यतित हो। आपकी आवेदन सामग्री की अंतिम जिम्मेदारी आपकी है।' },
        { title: '5. स्वीकार्य उपयोग', content: 'आप ऐप का दुरुपयोग न करने, अवैध सामग्री अपलोड न करने और इसे लागू कानूनों का उल्लंघन करने वाले तरीके से उपयोग न करने पर सहमत हैं। सेवा के दुरुपयोग से पहुंच प्रतिबंधित हो सकती है।' },
        { title: '6. भुगतान', content: 'Pro प्लान $3.99 के एकमुश्त भुगतान के साथ उपलब्ध है, जो आजीवन पहुंच प्रदान करता है, बिना किसी सदस्यता या स्वचालित नवीनीकरण के। यदि आपने पहले Pro खरीदा है, तो मूल्य निर्धारण पृष्ठ पर "खरीद पुनर्स्थापित करें" बटन का उपयोग करें।' },
        { title: '7. कोई गारंटी नहीं', content: 'CV Pro AI CV बनाने में सहायता के लिए टूल प्रदान करता है। हम गारंटी नहीं देते कि ऐप का उपयोग नौकरी के प्रस्तावों, साक्षात्कारों या रोजगार परिणामों में परिणत होगा।' },
        { title: '8. देयता की सीमा', content: 'ऐप किसी भी प्रकार की वारंटी के बिना "जैसा है" प्रदान किया जाता है। CV Pro AI ऐप के उपयोग से उत्पन्न किसी भी अप्रत्यक्ष या परिणामी नुकसान के लिए उत्तरदायी नहीं होगा।' },
        { title: '9. समाप्ति', content: 'हम इन शर्तों के उल्लंघन की स्थिति में ऐप तक पहुंच प्रतिबंधित करने या समाप्त करने का अधिकार सुरक्षित रखते हैं।' },
        { title: '10. शर्तों में बदलाव', content: 'हम समय-समय पर इन शर्तों को अपडेट कर सकते हैं। बदलाव पोस्ट होने के बाद ऐप का निरंतर उपयोग अपडेट की गई शर्तों की स्वीकृति मानी जाएगी।' },
        { title: '11. संपर्क', content: 'इन शर्तों के बारे में सहायता या प्रश्नों के लिए, help.cvappai@gmail.com पर हमसे संपर्क करें।' }
      ]
    }
  },
  comparison: {
    title: 'अंतर देखें',
    subtitle: 'मुफ़्त बनाम Pro योजना पर आपका CV कैसा दिखता है।',
    freePlan: 'बेसिक लेआउट',
    proPlan: 'पेशेवर लेआउट',
    good: 'अच्छा',
    hireReady: 'नौकरी के लिए तैयार',
    proBadge: 'Pro',
    freeFeatures: ['बेसिक लेआउट और टाइपोग्राफी', 'न्यूनतम दृश्य पदानुक्रम', 'मानक स्पेसिंग'],
    proFeatures: ['प्रीमियम टाइपोग्राफी और पदानुक्रम', 'पेशेवर दृश्य मानक', 'परिष्कृत स्पेसिंग और संरचना'],
    summary: 'पेशेवर सारांश',
    experience: 'पेशेवर अनुभव',
    expertise: 'विशेषज्ञता',
    languages: 'भाषाएँ',
    chips: ['SEO रणनीति', 'एनालिटिक्स', 'सामग्री', 'ईमेल'],
    persuasiveText: 'पेशेवर लेआउट प्रतिस्पर्धी बाज़ारों में आपके CV को अलग दिखाने में मदद करते हैं।'
  },
  previews: {
    name: 'राहुल शर्मा',
    role: 'सीनियर प्रोडक्ट मैनेजर',
    email: 'rahul@email.com',
    phone: '+91 98765 43210',
    location: 'मुंबई / दिल्ली',
    experience: 'अनुभव',
    education: 'शिक्षा',
    skills: 'कौशल',
    contact: 'संपर्क',
    headOfProduct: 'हेड ऑफ प्रोडक्ट',
    productManager: 'प्रोडक्ट मैनेजर',
    jrPm: 'Jr. PM',
    techCorp: 'TechCorp',
    startupXY: 'StartupXY',
    digitalAgency: 'DigitalAgency',
    techCorpDesc: '12 की क्रॉस-फंक्शनल टीम का नेतृत्व किया, 3 मुख्य उत्पाद लॉन्च किए, ARR 40% बढ़ाया।',
    startupDesc: 'रोडमैप परिभाषित किया, उपयोगकर्ता अनुसंधान किया, प्रतिधारण 28% सुधारा।',
    agencyDesc: '5 क्लाइंट उत्पादों में फीचर डिलीवरी।',
    mba: 'MBA',
    columbia: 'IIM अहमदाबाद',
    present: 'वर्तमान',
    now: 'अभी',
    productVision: 'उत्पाद दृष्टि',
    teamLeadership: 'टीम नेतृत्व',
    gtm: 'Go-to-Market',
    dataAnalysis: 'डेटा विश्लेषण',
    productStrategy: 'उत्पाद रणनीति',
    uxResearch: 'UX अनुसंधान',
    agile: 'Agile / Scrum',
    techCorpYears: '2021–वर्तमान',
    startupYears: '2018–2021',
    educationYears: '2016–2018',
    agencyYears: '2016–2018'
  },
  onboarding: {
    title: 'CV Pro AI में आपका स्वागत है ✨',
    subtitle: 'मिनटों में एक पेशेवर रिज्यूमे और कवर लेटर बनाएं। मुफ़्त से शुरू करें — तैयार होने पर अपग्रेड करें।',
    freeLabel: 'मुफ़्त',
    freeFeatures: ['3 मानक टेम्पलेट', '1 कवर लेटर डाउनलोड', '1 AI पुनर्जनन प्रयास', 'सभी 12 भाषाएँ'],
    proLabel: 'Pro — $3.99',
    proRecommendedBadge: 'अनुशंसित',
    proFeatures: ['असीमित कवर लेटर', 'AI पुनर्लेखन टूल', '10 प्रीमियम टेम्पलेट', 'जॉब विश्लेषक + प्राथमिकता सहायता'],
    oneTimePayment: 'एकमुश्त भुगतान। कोई सदस्यता नहीं।',
    aiFeatureTitle: 'AI फीचर',
    aiFeatureDesc: 'AI केवल आपके इनपुट का उपयोग टेक्स्ट उत्पन्न करने के लिए करता है और डेटा को स्थायी रूप से संग्रहीत नहीं करता है। सबमित करने से पहले सभी AI-जनित पाठ की समीक्षा करें।',
    startFree: 'मुफ़्त शुरू करें',
    upgradeToPro: 'Pro में अपग्रेड करें',
    secureCheckout: 'सुरक्षित चेकआउट। तत्काल सक्रियण। कोई सदस्यता नहीं।'
  },
  about: { hero: { badge: 'Google Play और App Store विवरण', title: 'CV Pro AI', description: 'कुछ ही मिनटों में पेशेवर CV बनाएं। मुफ़्त शुरू करें और ज़रूरत होने पर एक बार अपग्रेड करें।', ageRating: 'आयु रेटिंग: 3+', languages: '12 भाषाएँ', privacyFirst: 'गोपनीयता पहले' }, description: { title: 'ऐप के बारे में', paragraphs: ['CV Pro AI एक AI-संचालित CV और कवर लेटर बिल्डर है, जिसे आधुनिक नौकरी बाज़ार के लिए बनाया गया है।', 'Android (Google Play) और iPhone (Apple App Store) पर उपलब्ध।', 'यह प्रोफेशनल सारांश, उपलब्धियों के बुलेट बिंदु और अंतरराष्ट्रीय उपयोग के लिए उपयुक्त टेम्पलेट तैयार करने में मदद करता है।', 'ऐप का स्थानीयकरण सभी समर्थित भाषाओं में एकसमान अनुभव देने के लिए बनाया गया है, ताकि अंग्रेज़ी fallback पर निर्भरता न रहे।'] }, features: { title: 'मुफ़्त बनाम Pro', free: { label: 'मुफ़्त', items: ['3 मानक टेम्पलेट', '1 कवर लेटर डाउनलोड', '1 रीजनरेशन प्रयास', 'AI प्रोफेशनल सारांश', 'सभी 12 भाषाएँ', 'DOCX एक्सपोर्ट'], disabledItems: ['AI री-राइट टूल्स', 'जॉब डिस्क्रिप्शन एनालाइज़र', '10 प्रीमियम टेम्पलेट', 'असीमित कवर लेटर'] }, pro: { label: 'Pro', price: '$3.99', items: ['10 प्रीमियम टेम्पलेट (+ 3 मुफ़्त)', 'असीमित कवर लेटर', 'असीमित रीजनरेशन', 'AI री-राइट टूल्स', 'जॉब डिस्क्रिप्शन एनालाइज़र', 'प्राथमिकता सहायता'], footer: 'एक बार भुगतान। कोई सदस्यता नहीं। कोई नवीनीकरण नहीं।' } }, aiDisclosure: { title: 'AI का उपयोग कैसे होता है', items: ['ऐप रिज़्यूमे सारांश, बुलेट बिंदु और कवर लेटर बनाने के लिए तृतीय-पक्ष AI सेवाओं का उपयोग करता है।', 'दिए गए इनपुट केवल टेक्स्ट तैयार करने के उद्देश्य से प्रोसेस किए जाते हैं।', 'AI द्वारा तैयार सामग्री में त्रुटियाँ हो सकती हैं, इसलिए भेजने से पहले समीक्षा आवश्यक है।', 'AI सुविधाएँ इंटरफ़ेस में स्पष्ट रूप से लेबल की जाती हैं।'] }, ageAndContent: { title: 'आयु रेटिंग और सामग्री सूचना', ageRating: 'आयु रेटिंग: 3+', ageRatingDesc: 'सभी आयु समूहों के लिए उपयुक्त। कोई परिपक्व सामग्री नहीं।', disclaimer: 'AI द्वारा तैयार टेक्स्ट में तथ्यात्मक त्रुटियाँ, व्याकरण संबंधी समस्याएँ या भूमिका-विशेष के लिए अनुपयुक्त सुझाव हो सकते हैं। नियोक्ता को भेजने से पहले हर टेक्स्ट की समीक्षा करें।', noLiability: 'CV Pro AI CV और कवर लेटर तैयार करने के लिए उपकरण प्रदान करता है, लेकिन नौकरी मिलने या इंटरव्यू की कोई गारंटी नहीं देता।', privacy: 'CV डेटा उपयोगकर्ता के डिवाइस पर स्थानीय रूप से रहता है। व्यक्तिगत जानकारी को विपणन के लिए बेचा या साझा नहीं किया जाता।' }, languages: { title: 'समर्थित भाषाएँ', list: ['English', 'Deutsch', 'Español', 'Français', 'Italiano', 'العربية', 'Srpski', 'Hrvatski', 'Русский', 'Português (Brasil)', 'हिन्दी', '日本語'] }, restorePurchase: { title: 'खरीद पुनर्स्थापित करें', description: 'यदि आपने पहले Pro खरीदा है और इस डिवाइस पर एक्सेस वापस चाहिए, तो प्राइसिंग पेज पर रिस्टोर बटन का उपयोग करें। यदि कोई समस्या आए तो help.cvappai@gmail.com पर संपर्क करें।' }, legal: { title: 'कानूनी जानकारी', privacyPolicy: 'गोपनीयता', termsOfService: 'शर्तें', contact: 'संपर्क', viewPricing: 'मूल्य देखें' } }
};

const ja: TranslationKeys = {
  nav: { home: 'ホーム', cvBuilder: 'CV作成', coverLetter: '添え状', templates: 'テンプレート', pricing: '料金', about: '概要', contact: 'お問い合わせ', login: 'ログイン', register: '登録', dashboard: 'ダッシュボード', logout: 'ログアウト' },
  hero: { title: 'プロのCVを数分で作成。', professionalResumesAiPowered: 'プロ品質の履歴書。AI搭載。', subtitle: 'AI搭載のCV作成ツール。プレミアムテンプレートとスマートな求人最適化。', valueDesc: '数分でプロのレジュメを作成。Proプランで10種のプレミアムテンプレートと高度なツールをご利用いただけます。', cta: 'CVを作成する', ctaSecondary: 'テンプレートを見る', badge: 'AI搭載CV作成ツール', footerText: '一回限りの支払い。生涯アクセス。サブスクリプション不要。' },
  features: { title: '就職に必要なすべて。', subtitle: 'グローバル採用市場向けの強力なAIツール', badge: '含まれるもの', ai: { title: 'スマートAIライティング', desc: '明確さ、構成、インパクトを自動で改善。' }, multilingual: { title: '多言語サポート', desc: '9言語でCVを即座に作成。' }, templates: { title: 'プレミアムテンプレート', desc: 'プレミアム10枚＋無料3枚。モダンなデザイン。' }, ats: { title: 'ATS対応', desc: '全テンプレートが採用管理システムに対応。' }, region: { title: '地域最適化', desc: '日本・米国・EU・中東市場に自動適応。' }, export: { title: 'DOCXエクスポート', desc: 'DOCXでダウンロードまたはクリップボードへコピー。' }, analyzer: { title: '求人内容分析', desc: 'AIで求人票に合わせてCVを最適化。Proのみ。' } },
  howItWorks: { title: '使い方', step: 'ステップ', step1: { title: '情報を追加する', desc: '個人情報、職歴、学歴を入力してレジュメ作成を始めましょう。' }, step2: { title: 'レジュメを改善する', desc: 'スマートツールと提案を使ってレジュメをより強力かつプロフェッショナルにしましょう。' }, step3: { title: 'レジュメをダウンロード', desc: '高品質なDOCX形式でレジュメをエクスポートし、雇用主に送る準備を整えましょう。' } },
  whoIsThisFor: { title: 'このレジュメビルダーは誰のため？', items: ['求職中の方', '学生・卒業生', 'キャリアチェンジを考えるプロフェッショナル', '現代的でプロフェッショナルなレジュメを求める方'] },
  privacyFirst: { title: 'プライバシー最優先', desc: 'レジュメのデータはあなたのデバイスに残ります。個人情報を保存、販売、共有することはありません。', local: 'このレジュメビルダーはあなたの情報を安全に守るため、デバイス上でローカルに動作します。' },
  simplePricing: { title: 'シンプルな料金体系', desc: 'サブスクリプション不要。一回の購入で全てのProテンプレートと高度なツールをご利用いただけます。' },
  pricing: {
    title: 'シンプルな料金体系。',
    subtitle: 'サブスクなし。月額なし。一回払い。',
    oneTime: '$3.99 一回払い',
    getStarted: '始める',
    footerText: '一回払い · 生涯アクセス · サブスクなし',
        free: { name: '無料', price: '$0', features: ['標準テンプレート3枚', 'CVダウンロード1回', '添え状ダウンロード1件', '全言語対応'], cta: '無料で始める', desc: '費用なしで始める。' },
        pro: { name: 'Pro', price: '$3.99', features: ['プレミアムテンプレート10枚', 'CVダウンロード無制限', 'AI生成添え状無制限', '求人内容分析', 'AIライティング改善', '全言語対応'], cta: 'Proにアップグレード', desc: '一回払い。ずっと使える。', badge: 'Pro — 生涯アクセス', footer: '安全な決済。即時有効化。', noSubscription: 'サブスクなし。更新なし。' },
    tableTitle: '機能比較',
    tableHeaderFeature: '機能',
    tableHeaderFree: '無料',
    tableHeaderPro: 'Pro',
    tableRowCV: 'CVダウンロード',
    tableRowCoverLetter: '添え状ダウンロード',
    tableRowTemplates: 'テンプレート',
    tableRowAI: 'AI要約生成',
    tableRowRewrite: 'AI書き直しツール',
    tableRowAnalyzer: '求人内容分析',
    tableRowLanguages: '全言語',
    tableRowSupport: '優先サポート',
    unlimited: '無制限',
    threeStandard: '標準3枚',
    proTemplatesCount: 'プレミアム10枚＋無料3枚',
    oneCount: '1',
    popularBadge: '最も人気',
    bestValueBadge: '最もお得',
    coverLetterFreeValue: '添え状1件ダウンロード',
    coverLetterProValue: 'AI生成の添え状 無制限',
    restoreTitle: 'すでにProを購入済みですか？',
    restoreDesc: 'このデバイスでProアクセスを回復するために以前の購入を復元してください。',
    restoreButton: '購入を復元',
    proActive: 'Pro 有効',
    restoringText: '復元中...',
    needHelp: 'お困りですか？',
    fairUse: '不正利用を防ぎ、安定したサービスを提供するため、利用制限が適用される場合があります。'
  },
  faq: { title: 'よくある質問', items: [
    { q: '無料プランには何が含まれますか？', a: '無料プランでは、CV1件の作成と添え状1通の生成が可能です。また、コンテンツ改善のためにAIツールを限定的にご利用いただけます。' },
    { q: '無料で添え状を何通生成できますか？', a: '添え状1通を無料で生成できます。再生成は1回まで含まれています。' },
    { q: '無料の添え状を使い切った後はどうなりますか？', a: '無料の添え状を使用した後は、Proにアップグレードすることで無制限の添え状とAI機能へのフルアクセスが利用できます。' },
    { q: 'Proでは何が使えますか？', a: 'Proでは無制限の添え状、全AIツールへのフルアクセス、プレミアムテンプレート、高度なCV最適化機能が利用できます。' },
    { q: 'AI機能は無料ですか？', a: '一部のAI機能は無料で限定的にご利用いただけます。無制限のアクセスにはProにアップグレードしてください。' },
    { q: 'アプリをさまざまな言語で使用できますか？', a: 'はい。アプリは複数言語に対応しており、ご希望の言語でCVと添え状を作成できます。' },
    { q: 'テンプレートはATS対応ですか？', a: 'はい。全テンプレートは世界中の主要企業が使用するATSシステムを通過できるよう設計されています。' },
    { q: 'AIはどのように機能しますか？データは保存されますか？', a: 'AIはテキスト生成のためにあなたの入力（職種、会社名、トーンなど）のみを使用します。個人データは永久に保存されません。アプリはサードパーティのAIサービスを使用して生成リクエストを処理します。' },
    { q: 'AI生成コンテンツは常に正確ですか？', a: 'AI生成コンテンツには不正確な情報が含まれる場合があります。雇用主に送信する前に、AI生成テキストを必ず確認してください。最終的なコンテンツはユーザーの責任となります。' }
  ] },
  cv: { title: 'CV作成', personal: '個人情報', experience: '職歴', education: '学歴', skills: 'スキル', certifications: '資格・認定', languages: '語学', summary: '職務要約', generate: 'AIで生成', rewrite: '書き直す', translate: '翻訳', analyzeJob: '求人を分析', download: 'ダウンロード', downloadCv: 'CVをダウンロード', downloadPdf: 'PDF', downloadDocx: 'DOCX', downloadPdfDesc: 'おすすめ · 送信準備完了', downloadDocxDesc: '編集可能なバージョン', downloadNote: 'PDFは選択したデザインを保持します。DOCXは編集可能で、Word・Google Docs・モバイルビューアによってレイアウトに若干の違いが生じる場合があります。', pdfExportFailed: 'PDFのエクスポートに失敗しました。もう一度お試しください。',
    wordExportFailed: 'Wordのエクスポートに失敗しました。もう一度お試しください。', preview: 'プレビュー', selectTemplate: 'テンプレート選択', jobTitle: '職種', fullName: '氏名', email: 'メール', phone: '電話番号', address: '住所', fathersName: '父の名前', nationality: '国籍', dateOfBirth: '生年月日', company: '会社名', position: '役職', startDate: '開始日', endDate: '終了日', present: '現在', description: '職務内容', degree: '学位・専攻', school: '学校・大学', addMore: '追加', remove: '削除', region: '対象地域', ready: 'CVを作る準備はできましたか？', readySubtitle: '無料で始める。準備ができたらアップグレード。', edit: '編集', copied: 'コピー済み！', copy: 'コピー', jobTitlePlaceholder: '例：ソフトウェアエンジニア', fullNamePlaceholder: '田中 陽翔', aiBullets: 'AI改善', skillPlaceholder: 'スキルを入力してEnter', certPlaceholder: '例：AWS認定', langPlaceholder: '言語', levelPlaceholder: 'レベル', summaryPlaceholder: '職務要約を記入またはAIで生成...', jobDescPlaceholder: '求人内容をここに貼り付けて分析...', short: '短くする', strong: '強くする', professional: 'プロらしく', keywordsFound: 'キーワード', suggestions: '提案', suggestedSkills: '推奨スキル', skillCategories: { technical: '技術スキル', soft: 'ソフトスキル' }, aiRecommend: 'AIおすすめ', recommendedToast: 'おすすめ', recommendedForYou: '⭐ あなたへのおすすめ', bestResultsTemplate: 'このテンプレートで最良の結果', optimizedForProfile: 'あなたのプロフィールに最適化', unlockWithPro: 'Proでこのテンプレートを解放', saveRequired: 'CVを保存するにはログインしてください。', saved: 'CVを保存しました！', draftSaved: 'Draft saved', genSuccess: '要約を生成しました！', bulletsSuccess: 'AI改善を適用しました！', rewriteSuccess: '書き直しました', levels: { native: 'ネイティブ', fluent: '流暢', advanced: '上級', intermediate: '中級', basic: '基礎' }, regions: { us: 'アメリカ', eu: 'EU', balkan: 'バルカン', middleEast: '中東', india: 'インド', japan: '日本' }, gender: '性別', genderMale: '男', genderFemale: '女', genderOther: 'その他', coverLetterSection: '添え状', photo: { title: 'プロフィール写真', optional: '（任意）', shown: 'CVに表示', hidden: 'CVに非表示', shownDesc: 'あなたの地域ではデフォルトで表示', hiddenDesc: '写真はCV出力に表示されません。', change: '写真を変更', upload: '写真をアップロード', recrop: '再トリミング', remove: '写真を削除', hint: 'JPGまたはPNG、最大5MB。', aiEnhance: 'AI写真補正', aiEnhancing: '補正中...', applied: '適用済み', upgrade: 'Proにアップグレード', features: ['背景ぼかし', '明るさ・コントラスト', '自然な肌色', '自動顔センタリング'], cropTitle: '写真をトリミング', cropHint: 'ドラッグで位置調整', apply: 'トリミングを適用', usRegion: 'アメリカ地域ではデフォルト非表示', otherRegion: 'あなたの地域ではデフォルトで表示', errorFormat: 'JPGまたはPNG画像をアップロードしてください。' }, industryLabel: '業種', levelLabel: 'レベル', industryPlaceholder: '業種を選択', industries: { tech: 'IT / ソフトウェア開発', data_ai: 'データ / AI / 機械学習', cybersecurity: 'サイバーセキュリティ', sales_retail: '販売 (小売)', sales_b2b: '営業 (B2B)', marketing: 'マーケティング / デジタルマーケティング', sales: '営業', finance: '財務 / 会計', banking_fintech: '銀行 / フィンテック', healthcare: '医療 / ヘルスケア', pharmacy: '薬局', education: '教育 / 指導', human_resources: '人事', customer_service: 'カスタマーサポート / コールセンター', logistics: '物流 / サプライチェーン', operations: 'オペレーション / 生産', executive: '管理 / リーダーシップ', project_management: 'プロジェクト管理', design: 'デザイン / UX / UI', engineering: '機械・電気工学', construction: '建設 / 建築', hospitality: 'ホスピタリティ / 観光', legal: '法律', administration: '事務・管理', general: '一般' }, bulletLevels: { entry: '新卒・エントリー', mid: '中堅', senior: 'シニア', lead: 'リード / ディレクター' }, aiExperienceIntro: '✨ AIで職歴を強化する', aiExperienceIntroSub: '数秒でより力強く、明確でプロフェッショナルな職務説明を記述できます。', aiSummaryIntro: '✨ インパクトある職務要約を作成する', aiSummaryIntroSub: '採用担当者に響く要約を生成または改善します。', generateSubtext: '数秒で魅力的な職務要約を作成', shorterSubtext: '文章をすっきり簡潔に', strongerSubtext: '実績と成果を際立たせる', professionalSubtext: '表現とトーンを磨く', aiBulletsSubtext: '経験を成果中心の箇条書きに', analyzeJobSubtext: 'CVを求人要件に合わせる', analyzeJobProOnly: '求人分析はProプランのみご利用いただけます。', aiRecommendSubtext: '最適なテンプレートを見つける', proHint: 'おすすめ', proHintPopular: '人気', jobAnalysis: { title: 'あなたのCV分析', subtitle: 'CVがこの求人にどれだけ合っているか確認', matchScore: '一致率', matchGood: '良い一致 — でも改善の余地あり', matchAverage: '平均的な一致 — いくつかのギャップ発見', matchWeak: '弱い一致 — 大幅な改善が必要', keyInsights: '主なポイント', insight1: '関連する経験あり', insight2: '重要なスキルが不足', insight3: '実績の説明が弱い', importantKeywords: '重要なキーワード', unlockFull: 'Proで全リストを解放', suggestedImprovements: '改善提案', improve1: '具体的な成果を追加する', improve2: 'より強い動詞を使う', improve3: '不足スキルを追加する', proCardTitle: 'CVを今すぐ改善する', proCardText: '完全な分析、全キーワード、AI改善をアンロック', proCardCta: 'Proにアップグレード', proCardNote: '一回限りの支払い', analyzing: 'CV分析中...' } },
  coverLetter: { title: '添え状作成', firstName: '名前', lastName: '苗字', gender: '性別', genderMale: '男性', genderFemale: '女性', genderPreferNot: '回答しない', identitySection: 'あなたの情報', jobTitle: '職種', companyName: '会社名',tone: 'トーン', tones: { formal: 'フォーマル', confident: '自信あり', friendly: '親しみやすい' }, generate: '添え状を生成', generating: '添え状を生成中…', regenerate: '再生成', regenerating: '再生成中…', regenerateSubtitle: '新しいバリエーションを取得', edit: '編集', companyPlaceholder: '例：Google', firstNamePlaceholder: '陽翔', lastNamePlaceholder: '田中', genSuccess: '添え状を生成しました！', saved: '保存しました！', draftSaved: 'Draft saved', placeholder: '添え状がここに表示されます...', preview: 'プレビュー', filename: '添え状',regenLeft: '残り', regenExhausted: 'この添え状の再生成回数の上限に達しました。', paywallMessage: '無料枠を超えた添え状の生成はPro機能です。無制限のAI添え状生成にはProにアップグレードしてください。', downloadCl: '添え状をダウンロード', generateSubtitle: '求人と企業に合わせて作成', aiDisclaimer: 'AI生成コンテンツには不正確な情報が含まれる場合があります。提出前にAI生成テキストをすべて確認してください。' },
  auth: { login: 'ログイン', register: 'アカウント作成', email: 'メール', password: 'パスワード', confirmPassword: 'パスワード確認', name: '氏名', forgotPassword: 'パスワードを忘れた？', noAccount: 'アカウントをお持ちでない方？', hasAccount: 'すでにアカウントをお持ちの方？', invalidCredentials: '認証情報が無効です。先に登録してください。', emailTaken: 'このメールアドレスはすでに登録されています。' },
  dashboard: { title: 'ダッシュボード', myCVs: '私のCV', myCoverLetters: '私の添え状', createNew: '新規作成', edit: '編集', delete: '削除', lastEdited: '最終更新', upgrade: 'Proにアップグレード', plan: '現在のプラン', welcome: 'おかえりなさい', noCVs: 'CVはまだありません。最初の1枚を作成しましょう！', noLetters: '添え状はまだありません。最初の1枚を作成しましょう！', untitled: '無題', cvDeleted: 'CVを削除しました', letterDeleted: '添え状を削除しました', loginRequired: 'ダッシュボードにアクセスするにはログインしてください。', upgradeBanner: 'CV1枚と添え状1枚が含まれます。' },
  common: { save: '保存', cancel: 'キャンセル', back: '戻る', next: '次へ', loading: '読み込み中...', proAccessRequired: 'Proアクセスが必要です。続行するにはアップグレードしてください。', proAuthorizationUnavailable: 'Pro認証を同期中です。しばらくしてからもう一度お試しください。', error: 'エラーが発生しました', success: '成功！', darkMode: 'ダークモード', lightMode: 'ライトモード', language: '言語', legal: '法律', previewBadge: '無料テンプレート', slide: 'スライド', appName: 'CV Pro AI', docx: 'DOCX' },
  footer: { rights: '© 2026 CV Pro AI. All rights reserved.', privacy: 'プライバシーポリシー', terms: '利用規約', backToHome: 'ホームに戻る' },
  templates: {
    title: 'テンプレート', subtitle: '13種類のプロフェッショナルテンプレート — 無料3枚、プレミアム10枚。', showcase: 'テンプレート紹介', showcaseSubtitle: '世界の採用基準に対応したデザイン。', freeCount: '無料 — 3枚', proCount: 'Pro — プレミアム10枚', proBadge: 'PRO', unlockPro: 'Proで全10枚のプレミアムテンプレートを解放 — $3.99一回払い', browseAll: '全テンプレートを見る',
    categories: { ats: 'ATS対応', creative: 'クリエイティブ', executive: 'エグゼクティブ', modern: 'モダン', japanese: '日本式' },
    items: {
      'modern-minimal': { name: 'モダンミニマル', description: 'ATS対応のクリーンデザイン — 採用担当者に一目で刺さる。', category: 'ATS対応' },
      'clean-simple': { name: 'クリーン＆シンプル', description: 'シンプルで明快 — 新卒・学生の第一歩を確実に後押し。', category: 'ATS対応' },
      'professional-classic': { name: 'プロフェッショナルクラシック', description: '全業種で信頼される普遍的なデザイン。', category: 'ATS対応' },
      'creative-bold': { name: 'クリエイティブボールド', description: 'クリエイティブ職で即座に目を引くインパクトあるレイアウト。', category: 'クリエイティブ' },
      'creative-artistic': { name: 'クリエイティブアート', description: '個性を表現する洗練されたデザインで強い印象を残す。', category: 'クリエイティブ' },
      'elegant-formal': { name: 'エレガントフォーマル', description: '上品で権威ある — 第一印象が重要な管理職に最適。', category: 'エグゼクティブ' },
      'ats-standard': { name: 'ATSスタンダード', description: '自動選考フィルターを確実に突破し面接へ進む可能性を最大化。', category: 'ATS対応' },
      'executive-premium': { name: 'エグゼクティブプレミアム', description: 'Cレベル経営者向けの威圧感ある高品質デザイン。', category: 'エグゼクティブ' },
      'nordic-clean': { name: 'ノルディッククリーン', description: '落ち着いた集中できるレイアウト — あなたの経験が語る。', category: 'モダン' },
      'tech-sidebar': { name: 'テックサイドバー', description: 'スキルと経験を最大限に引き出す2カラム構成。', category: 'モダン' },
      'corporate-navy': { name: 'コーポレートネイビー', description: '力強く自信に満ちた — 第一印象から存在感を放つ。', category: 'エグゼクティブ' },
      'modern-minimal-executive': { name: 'モダンミニマルエグゼクティブ', description: '整ったサイドバーで現代的なエグゼクティブの存在感を表現。', category: 'エグゼクティブ' },
      'contemporary-bold': { name: 'コンテンポラリーボールド', description: '注目を集めるtechとスタートアップ向けの力強い構造デザイン。', category: 'モダン' },
      'rirekisho': { name: '履歴書 (Rirekisho)', description: '日本の採用基準に完全準拠した本格的な履歴書フォーマット。', category: '日本式' }
    }
  },
  legal: {
    privacy: {
      title: 'プライバシーポリシー', effectiveDate: '2026年4月 発効',
      sections: [
        { title: '1. はじめに', content: 'CV Pro AIはお客様のプライバシーを尊重し、個人データの保護に努めています。このプライバシーポリシーは、AIを活用した履歴書・添え状作成ツールをご利用いただく際に、当社がどのように情報を収集・利用・保護するかを説明するものです。' },
        { title: '2. 収集するデータ', content: 'アプリご利用時に収集する可能性のある情報：', items: ['お名前（ご入力いただいた場合）', 'メールアドレス（ご入力いただいた場合）', 'ご入力いただいた履歴書・CVの内容', '基本的な利用状況データと分析情報'] },
        { title: '3. データの利用目的', content: '収集したデータは以下の目的にのみ使用します：', items: ['履歴書・添え状のコンテンツ生成', 'AI機能の改善およびアプリ品質の向上', 'アプリの基本機能の提供'] },
        { title: '4. AIによる処理', content: 'お客様の入力内容は、履歴書の要約、箇条書き、カバーレター、その他のAI搭載コンテンツを生成するために、第三者AIプロバイダーに安全に送信される場合があります。データは要求された出力を生成する目的でのみ処理されます。CV Pro AIはお客様のコンテンツを広告目的で使用することはありません。' },
        { title: '5. データの第三者共有', content: 'お客様のプライバシーを尊重し、データを責任ある形で管理します：', items: ['ユーザーデータを第三者に販売することはありません', 'アプリの運営に必要な必須サービスを除き、第三者とデータを共有しません'] },
        { title: '6. データの保存とセキュリティ', content: 'CVのデータはお客様のデバイスにローカル保存されます。アプリは編集中のドラフトをお客様のデバイスにローカル保存するためオートセーブを使用します。AI搭載機能（コンテンツ生成や改善が必要な機能）をご利用になる際、特定のコンテンツが安全に送信される場合があります。TLS暗号化を含む業界標準のセキュリティ対策を実施しています。すべてのユーザー情報保護のために合理的な措置を講じています。', items: ['AI生成コンテンツとドラフトデータは、要求された機能を提供するために必要な期間のみ保持されます。ローカルに保存されたドラフトコンテンツはユーザーの管理下にあり、ドラフトをクリアするかアプリケーションをリセットすることでいつでも削除できます。'] },
        { title: '7. お客様の権利とGDPR保護', content: 'お客様は個人データを完全に管理できます。欧州経済領域（EEA）にお住まいの場合、一般データ保護規則（GDPR）に基づく追加の権利があります：', items: ['個人データへのアクセスの請求', 'データの削除の請求（消去権）', '不正確なデータの訂正の請求', '処理の制限の請求（EEAユーザー）', 'データポータビリティ — 構造化された機械可読形式でデータを受け取る権利（EEAユーザー）', '処理が同意に基づく場合、いつでも同意を撤回する権利'] },
        { title: '8. Cookieと分析', content: 'アプリは利用パターンを把握し、パフォーマンスを改善するために基本的な分析ツールを使用する場合があります。個人データを広告ネットワークと共有することはありません。' },
        { title: '9. お支払いと購入', content: 'Proプランの購入は、第三者決済プロセッサーにより安全に処理されます：', items: ['お支払いはApple App Store、Google Play Store、RevenueCatが処理します', 'CV Pro AIはお客様の支払いカード情報を収集、処理、保存することはありません', 'すべての支払いデータは、各アプリストアおよび決済プロセッサーのプライバシーポリシーとセキュリティポリシーに従って直接管理されます', '購入検証と権利管理は、RevenueCatまたは類似の決済インフラストラクチャプロバイダーを通じて提供される場合があります。'] },
        { title: '10. 子どものプライバシー', content: 'このアプリは13歳未満のユーザーを対象としていません。当社は13歳未満の子どもから意図的に個人情報を収集しません。子どもが個人データを提供したとお考えの場合は、直ちにご連絡ください。' },
        { title: '11. 保証の否定', content: 'CV Pro AIは雇用、面接、求人、または応募結果を保証しません。ユーザーは、生成されたすべてのコンテンツを雇用主または第三者に提出する前に、確認、編集、および検証する責任を負います。' },
        { title: '12. お問い合わせ', content: 'このプライバシーポリシーに関するご質問・ご要望は help.cvappai@gmail.com までご連絡ください。' }
      ]
    },
    terms: {
      title: '利用規約', effectiveDate: '2026年4月 発効',
      sections: [
        { title: '1. はじめに', content: 'CV Pro AIはAIを活用して履歴書・職務経歴書・添え状を作成するツールです。アプリをご利用いただくことで、この利用規約に同意したものとみなします。' },
        { title: '2. サービス内容', content: 'CV Pro AIはAI搭載の履歴書・添え状作成ツールです。無料プランとProプランをご用意しています。無料プランでは添え状1件のダウンロードとAI再生成1回が可能です。Proプラン（$3.99の買い切り）では、ダウンロード無制限、AI生成無制限、プレミアムテンプレート10種類、AI書き直しツール、求人情報アナライザーをご利用いただけます。' },
        { title: '3. AIに関する免責事項', content: 'AIが生成するコンテンツはあくまでも補助的なものであり、ユーザーによる確認が必要な場合があります。内容に不正確な表現やスタイルの差異が含まれる可能性があります。雇用主等への提出前に、すべてのAI生成テキストを確認・編集する責任はお客様にあります。' },
        { title: '4. ユーザーの責任', content: 'アプリに入力する情報の正確性についてはお客様の責任となります。すべてのデータが真実かつ最新であることを確認してください。応募書類の最終的な責任はお客様にあります。' },
        { title: '5. 利用上のルール', content: 'アプリの不正利用、違法なコンテンツのアップロード、適用法に違反する方法での利用を行わないことに同意するものとします。サービスの悪用によりアクセスが制限される場合があります。' },
        { title: '6. 支払い', content: 'Proプランは$3.99の一回払いで、サブスクリプションや自動更新なしに生涯アクセスが可能です。以前にProをご購入の場合は、料金ページの「購入を復元」ボタンをご利用ください。' },
        { title: '7. 保証の不提供', content: 'CV Pro AIは履歴書作成を支援するツールを提供します。アプリの利用が就職内定、面接、採用結果につながることを保証するものではありません。結果は当社のコントロール外の多くの要因に左右されます。' },
        { title: '8. 責任の制限', content: 'アプリはいかなる明示または黙示の保証もなく「現状のまま」提供されます。CV Pro AIはアプリの利用から生じる間接的または派生的な損害について責任を負いません。' },
        { title: '9. 利用停止', content: '利用規約の違反（不正使用、違法行為、サービスの悪用を含む）があった場合、当社はアプリへのアクセスを制限または停止する権利を保有します。' },
        { title: '10. 規約の変更', content: '本利用規約は随時更新される場合があります。変更の掲載後もアプリを引き続き利用することで、更新された規約に同意したものとみなします。' },
        { title: '11. お問い合わせ', content: 'サポートや本規約に関するご質問は help.cvappai@gmail.com までご連絡ください。' }
      ]
    }
  },
  comparison: {
    title: '違いを確認', subtitle: '無料プランとProの比較。', freePlan: 'ベーシックレイアウト', proPlan: 'プロフェッショナルレイアウト', good: '良い', hireReady: '採用準備完了', proBadge: 'Pro', freeFeatures: ['基本レイアウト・タイポグラフィ', '最小限の視覚階層', '標準スペーシング'], proFeatures: ['プレミアムタイポグラフィ', 'プロフェッショナルな視覚基準', '洗練されたスペーシング'], summary: '職務要約', experience: '職歴', expertise: '専門性', languages: '語学', chips: ['SEO戦略', '分析', 'コンテンツ', 'メール'], persuasiveText: 'プロのレイアウトで競争の激しい市場でCVを際立たせましょう。'
  },
  previews: {
    name: '山田 太郎', role: 'シニアプロダクトマネージャー', email: 'taro@email.com', phone: '+81 90 1234 5678', location: '東京', experience: '職歴', education: '学歴', skills: 'スキル', contact: '連絡先', headOfProduct: 'プロダクト責任者', productManager: 'プロダクトマネージャー', jrPm: 'Jr. PM', techCorp: 'テックコープ', startupXY: 'スタートアップXY', digitalAgency: 'デジタルエージェンシー', techCorpDesc: '12名のチームを率い、主力製品3件をリリース、ARRを40%向上。', startupDesc: 'ロードマップ策定、ユーザーリサーチ実施、継続率28%改善。', agencyDesc: '5つのクライアント製品の機能開発。', mba: 'MBA', columbia: '東京大学', present: '現在', now: '現在', productVision: 'プロダクトビジョン', teamLeadership: 'チームリーダーシップ', gtm: 'Go-to-Market', dataAnalysis: 'データ分析', productStrategy: 'プロダクト戦略', uxResearch: 'UXリサーチ', agile: 'アジャイル / スクラム', techCorpYears: '2021年〜現在', startupYears: '2018年〜2021年', educationYears: '2016年〜2018年', agencyYears: '2016年〜2018年'
  },
  onboarding: {
    title: 'AI搭載CV作成ツールへようこそ ✨',
    subtitle: 'プロのレジュメと添え状を数分で作成。無料で始める — 準備ができたらアップグレード。',
    freeLabel: '無料',
    freeFeatures: ['標準テンプレート3枚', '添え状ダウンロード1回', 'AI再生成1回', '全12言語対応'],
    proLabel: 'Pro — $3.99',
    proRecommendedBadge: 'おすすめ',
    proFeatures: ['添え状無制限', 'AI書き直しツール', 'プレミアムテンプレート10枚', '求人分析＋優先サポート'],
    oneTimePayment: '一回払い。サブスクなし。',
    aiFeatureTitle: 'AI機能',
    aiFeatureDesc: 'AIはテキスト生成のためにあなたの入力のみを使用し、データを永久に保存しません。送信前にすべてのAI生成テキストを確認してください。',
    startFree: '無料で始める',
    upgradeToPro: 'Proにアップグレード',
    secureCheckout: '安全な決済。即座に有効化。サブスクなし。'
  },
  about: { hero: { badge: 'Google Play & App Store 説明', title: 'CV Pro AI', description: '数分でプロ品質のCVを作成。まずは無料で始めて、必要になったら一度だけアップグレードできます。', ageRating: '年齢区分: 3+', languages: '12言語', privacyFirst: 'プライバシー重視' }, description: { title: 'アプリについて', paragraphs: ['CV Pro AIは、AIを活用したCV・職務経歴書・添え状の作成ツールです。', 'Android（Google Play）とiPhone（Apple App Store）でご利用いただけます。', '要約文の作成、実績の言い換え、求人内容に合わせた調整を、複数言語で一貫した品質で行えます。', 'ローカライズは全対応言語で統一された体験を提供する前提で設計されており、英語表示への依存を避けています。'] }, features: { title: '無料プランとPro', free: { label: '無料', items: ['標準テンプレート3枚', '添え状ダウンロード1件', '再生成1回', 'AI要約生成', '12言語すべてに対応', 'DOCX書き出し'], disabledItems: ['AI文章改善ツール', '求人内容分析', 'プレミアムテンプレート10枚', '添え状を無制限に生成'] }, pro: { label: 'Pro', price: '$3.99', items: ['プレミアムテンプレート10枚（＋無料3枚）', '添え状を無制限に生成', '再生成も無制限', 'AI文章改善ツール', '求人内容分析', '優先サポート'], footer: '買い切りです。サブスクリプションや自動更新はありません。' } }, aiDisclosure: { title: 'AIの利用について', items: ['本アプリは履歴書要約、箇条書き項目、添え状の生成に外部AIサービスを利用します。', '入力された内容は、必要な文章を生成する目的に限って処理されます。', 'AI生成テキストには不正確な表現が含まれる可能性があるため、提出前の確認が必要です。', 'AIを使う機能は画面上で明確に表示されます。'] }, ageAndContent: { title: '年齢区分とコンテンツ注意', ageRating: '年齢区分: 3+', ageRatingDesc: '全年齢向けです。成人向けコンテンツは含みません。', disclaimer: 'AIが生成した文章には、事実誤認、文法上の不自然さ、応募先に合わない表現が含まれる場合があります。送信前に必ず内容を確認し、必要に応じて修正してください。', noLiability: 'CV Pro AIは履歴書と添え状の作成を支援するツールであり、採用結果や面接獲得を保証するものではありません。', privacy: 'CVデータはユーザーの端末上にローカル保存されます。個人情報を広告目的で販売・共有することはありません。' }, languages: { title: '対応言語', list: ['English', 'Deutsch', 'Español', 'Français', 'Italiano', 'العربية', 'Srpski', 'Hrvatski', 'Русский', 'Português (Brasil)', 'हिन्दी', '日本語'] }, restorePurchase: { title: '購入を復元', description: '以前にProを購入済みで、この端末でアクセスを復元したい場合は、料金ページの復元ボタンをご利用ください。問題がある場合は help.cvappai@gmail.com までご連絡ください。' }, legal: { title: '法的情報', privacyPolicy: 'プライバシー', termsOfService: '利用規約', contact: 'お問い合わせ', viewPricing: '料金を見る' } }
};

export const translations: Record<Locale, TranslationKeys> = { en, de, es, fr, it, ar, sr, hr, ru, 'pt-BR': ptBR, hi, ja };
