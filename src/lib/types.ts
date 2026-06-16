export type Region = 'US' | 'EU' | 'Balkan' | 'MiddleEast' | 'India' | 'Japan';

export type TemplateId = 'modern-minimal' | 'creative-bold' | 'creative-artistic' | 'elegant-formal' | 'clean-simple' | 'professional-classic' | 'ats-standard' | 'executive-premium' | 'nordic-clean' | 'tech-sidebar' | 'corporate-navy' | 'contemporary-bold' | 'rirekisho';

export type ProfessionCategory = 'tech' | 'marketing' | 'executive' | 'student' | 'general' | 'startup';

export type Tone = 'formal' | 'confident' | 'friendly';

export interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  photo?: string;
  photoEnabled?: boolean;
  jobTitle: string;
  linkedIn?: string;
  website?: string;
  fathersName?: string;
  nationality?: string;
  dateOfBirth?: string;
  gender?: string;
}

export interface WorkExperience {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  isPresent: boolean;
  description: string;
}

export interface Education {
  id: string;
  school: string;
  degree: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface CVData {
  id: string;
  name: string;
  personal: PersonalInfo;
  summary: string;
  experience: WorkExperience[];
  education: Education[];
  skills: string[];
  certifications: string[];
  languages: { name: string; level: string }[];
  templateId: TemplateId;
  region: Region;
  createdAt: string;
  updatedAt: string;
}

export interface CoverLetterData {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female' | 'prefer_not_to_say' | '';
  jobTitle: string;
  companyName: string;
  tone: Tone;
  content: string;
  templateId: TemplateId;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  plan: 'free' | 'pro';
  cvs: CVData[];
  coverLetters: CoverLetterData[];
  downloadsUsed: { cv: number; cl: number };
}

export const regionSettings: Record<Region, {
  photoRequired: boolean;
  dateFormat: string;
  showAddress: boolean;
  showAge: boolean;
  formalTone: boolean;
}> = {
  US: { photoRequired: false, dateFormat: 'MM/YYYY', showAddress: false, showAge: false, formalTone: false },
  EU: { photoRequired: true, dateFormat: 'MM.YYYY', showAddress: true, showAge: false, formalTone: true },
  Balkan: { photoRequired: true, dateFormat: 'DD.MM.YYYY', showAddress: true, showAge: true, formalTone: true },
  MiddleEast: { photoRequired: true, dateFormat: 'DD/MM/YYYY', showAddress: true, showAge: true, formalTone: true },
  India: { photoRequired: true, dateFormat: 'DD/MM/YYYY', showAddress: true, showAge: true, formalTone: true },
  Japan: { photoRequired: true, dateFormat: 'YYYY/MM/DD', showAddress: true, showAge: true, formalTone: true },
};

export const templateInfo: Record<TemplateId, {
  name: string;
  category: string;
  professions: ProfessionCategory[];
  description: string;
  isPro: boolean;
}> = {
  'modern-minimal': { name: 'Modern Minimal', category: 'ATS-Friendly', professions: ['tech', 'general'], description: 'Clean, ATS-ready design that gets your profile noticed by recruiters fast.', isPro: false },
  'clean-simple': { name: 'Clean Simple', category: 'ATS-Friendly', professions: ['student', 'general'], description: 'Simple and clear layout that makes a strong impression for any first application.', isPro: false },
  'professional-classic': { name: 'Professional Classic', category: 'ATS-Friendly', professions: ['general', 'executive'], description: 'Trusted by recruiters across all industries — timeless, polished, dependable.', isPro: false },
  'creative-bold': { name: 'Creative Bold', category: 'Creative', professions: ['marketing'], description: 'Stand out instantly with a bold layout built to impress in creative industries.', isPro: true },
  'creative-artistic': { name: 'Creative Artistic', category: 'Creative', professions: ['marketing'], description: 'Express your personality with a stylish design that leaves a lasting impression.', isPro: true },
  'elegant-formal': { name: 'Elegant Formal', category: 'Executive', professions: ['executive'], description: 'Refined and authoritative — ideal for senior roles where first impressions matter.', isPro: true },
  'ats-standard': { name: 'ATS Standard', category: 'ATS-Friendly', professions: ['tech', 'general'], description: 'Built to pass every automated screen — maximise your chances of reaching the interview.', isPro: true },
  'executive-premium': { name: 'Executive Premium', category: 'Executive', professions: ['executive'], description: 'A commanding design for C-level leaders who need to make every word count.', isPro: true },
  'nordic-clean': { name: 'Nordic Clean', category: 'Modern', professions: ['tech', 'general'], description: 'Calm, focused layout that lets your experience speak clearly — no clutter.', isPro: true },
    'tech-sidebar': { name: 'Tech Sidebar', category: 'Modern', professions: ['tech', 'marketing'], description: 'Two-column structure that organises your skills and experience for maximum impact.', isPro: true },
    'corporate-navy': { name: 'Corporate Navy', category: 'Executive', professions: ['executive', 'general'], description: 'Bold and authoritative — signals confidence from the first glance.', isPro: true },
      'contemporary-bold': { name: 'Contemporary Bold', category: 'Modern', professions: ['tech', 'startup'], description: 'Strong, structured design for tech and startup roles that demand attention.', isPro: true },
      'rirekisho': { name: '履歴書 (Rirekisho)', category: 'Japanese', professions: ['general', 'tech', 'executive'], description: 'The authentic Japanese CV format — built to meet local hiring standards perfectly.', isPro: true },
    };

export function recommendTemplate(jobTitle: string, experienceLevel?: 'entry' | 'mid' | 'senior'): TemplateId {
  const lower = jobTitle.toLowerCase();
  const isEntryLevel = experienceLevel === 'entry' || /student|intern|junior|entry|graduate|trainee|apprentice/.test(lower);

  // Entry-level fallback → free template
  if (isEntryLevel) return 'clean-simple';

  // Tech roles → prioritize Pro tech templates
  if (/software|developer|engineer|devops|data scientist|machine learning|ai engineer|programmer|web|frontend|backend|fullstack|qa|cyber|cloud|sre|platform|mobile|android|ios/.test(lower)) {
    if (/senior|lead|principal|staff|architect/.test(lower)) return 'tech-sidebar';
    return 'ats-standard';
  }

  // IT / general tech → Pro nordic
  if (/it |information technology|systems|network|database|devops|cloud|infrastructure/.test(lower)) return 'nordic-clean';

  // Marketing / Creative → Pro creative templates
  if (/market|brand|content|social|growth|seo|sem|ppc|email market|product market/.test(lower)) return 'contemporary-bold';
  if (/design|creative|ux|ui|graphic|art|photo|video|media|animator|illustrator/.test(lower)) return 'creative-bold';

  // Executive / Leadership → Pro executive templates
  if (/ceo|cto|cfo|coo|cmo|cpo|chief|founder|co-founder/.test(lower)) return 'executive-premium';
  if (/director|vp|vice president|head of|managing|president/.test(lower)) return 'corporate-navy';
  if (/manager|lead|principal|senior manager|project manager|product manager|program manager/.test(lower)) return 'elegant-formal';

  // Finance / Legal / Consulting → Pro executive feel
  if (/finance|financial|banking|investment|analyst|consultant|accountant|auditor|legal|attorney|lawyer/.test(lower)) return 'corporate-navy';

  // Healthcare / Education → modern clean Pro
  if (/doctor|physician|nurse|healthcare|medical|therapist|pharmacist|dentist/.test(lower)) return 'nordic-clean';
  if (/teacher|professor|lecturer|educator|researcher|academic/.test(lower)) return 'ats-standard';

  // Startup / Product / Operations
  if (/startup|entrepreneur|product|operations|ops|scrum|agile|delivery/.test(lower)) return 'contemporary-bold';

  // Default → Pro professional classic feel
  return 'nordic-clean';
}
