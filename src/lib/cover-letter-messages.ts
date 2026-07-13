import type { Locale } from './i18n/translations';

const AI_UNAVAILABLE: Partial<Record<Locale, string>> = {
  en: 'AI service is temporarily unavailable. Please try again later.',
  ar: 'خدمة الذكاء الاصطناعي غير متاحة مؤقتًا. يُرجى المحاولة لاحقًا.',
  hi: 'AI सेवा अस्थायी रूप से उपलब्ध नहीं है। कृपया बाद में पुनः प्रयास करें।',
  de: 'Der KI-Dienst ist vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.',
  es: 'El servicio de IA no está disponible temporalmente. Inténtelo de nuevo más tarde.',
  fr: 'Le service IA est temporairement indisponible. Veuillez réessayer plus tard.',
  it: 'Il servizio IA non è temporaneamente disponibile. Riprova più tardi.',
  sr: 'AI usluga je privremeno nedostupna. Pokušajte ponovo kasnije.',
  hr: 'AI usluga je privremeno nedostupna. Pokušajte ponovo kasnije.',
  ru: 'Сервис ИИ временно недоступен. Повторите попытку позже.',
  'pt-BR': 'O serviço de IA está temporariamente indisponível. Tente novamente mais tarde.',
  ja: 'AIサービスは一時的に利用できません。しばらくしてからもう一度お試しください。',
};

const WRONG_LANGUAGE: Partial<Record<Locale, string>> = {
  en: 'The generated cover letter does not match the selected language. Please try again.',
  ar: 'خطاب التقديم المُولَّد لا يطابق اللغة المحددة. يُرجى المحاولة مرة أخرى.',
  hi: 'उत्पन्न कवर लेटर चयनित भाषा से मेल नहीं खाता। कृपया पुनः प्रयास करें।',
};

const STALE_CONTENT: Partial<Record<Locale, string>> = {
  en: 'Generate a cover letter in the current language before downloading.',
  ar: 'يُرجى توليد خطاب تقديم باللغة الحالية قبل التنزيل.',
  hi: 'डाउनलोड करने से पहले वर्तमान भाषा में कवर लेटर जनरेट करें।',
};

export function coverLetterAiUnavailable(locale: Locale | string): string {
  return AI_UNAVAILABLE[locale as Locale] ?? AI_UNAVAILABLE.en!;
}

export function coverLetterWrongLanguage(locale: Locale | string): string {
  return WRONG_LANGUAGE[locale as Locale] ?? WRONG_LANGUAGE.en!;
}

export function coverLetterStaleContent(locale: Locale | string): string {
  return STALE_CONTENT[locale as Locale] ?? STALE_CONTENT.en!;
}
