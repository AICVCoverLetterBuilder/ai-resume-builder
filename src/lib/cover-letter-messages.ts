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
  de: 'Das generierte Anschreiben entspricht nicht der ausgewählten Sprache. Bitte erneut versuchen.',
  es: 'La carta generada no coincide con el idioma seleccionado. Inténtelo de nuevo.',
  fr: 'La lettre générée ne correspond pas à la langue sélectionnée. Veuillez réessayer.',
  it: 'La lettera generata non corrisponde alla lingua selezionata. Riprova.',
  sr: 'Generisano propratno pismo ne odgovara izabranom jeziku. Pokušajte ponovo.',
  hr: 'Generirano popratno pismo ne odgovara odabranom jeziku. Pokušajte ponovno.',
  ru: 'Сгенерированное письмо не соответствует выбранному языку. Повторите попытку.',
  'pt-BR': 'A carta gerada não corresponde ao idioma selecionado. Tente novamente.',
  ja: '生成されたカバーレターが選択した言語と一致しません。もう一度お試しください。',
};

const STALE_CONTENT: Partial<Record<Locale, string>> = {
  en: 'Generate a cover letter in the current language before downloading.',
  ar: 'يُرجى توليد خطاب تقديم باللغة الحالية قبل التنزيل.',
  hi: 'डाउनलोड करने से पहले वर्तमान भाषा में कवर लेटर जनरेट करें।',
  de: 'Bitte generieren Sie ein Anschreiben in der aktuellen Sprache vor dem Download.',
  es: 'Genere una carta en el idioma actual antes de descargar.',
  fr: 'Générez une lettre dans la langue actuelle avant de télécharger.',
  it: 'Genera una lettera nella lingua corrente prima di scaricare.',
  sr: 'Generišite propratno pismo na trenutnom jeziku pre preuzimanja.',
  hr: 'Generirajte popratno pismo na trenutačnom jeziku prije preuzimanja.',
  ru: 'Сгенерируйте письмо на текущем языке перед загрузкой.',
  'pt-BR': 'Gere uma carta no idioma atual antes de baixar.',
  ja: 'ダウンロード前に、現在の言語でカバーレターを生成してください。',
};

const GROUNDING_FAILED: Partial<Record<Locale, string>> = {
  en: 'The generated cover letter contained unsupported information and could not be used safely. Please try again.',
  ar: 'احتوى خطاب التقديم المُولَّد على معلومات غير مدعومة ولم يكن من الآمن استخدامه. يُرجى المحاولة مرة أخرى.',
  hi: 'उत्पन्न कवर लेटर में असमर्थित जानकारी थी और उसे सुरक्षित रूप से उपयोग नहीं किया जा सका। कृपया पुनः प्रयास करें।',
  de: 'Das generierte Anschreiben enthielt nicht belegte Angaben und konnte nicht sicher verwendet werden. Bitte erneut versuchen.',
  es: 'La carta generada contenía información no respaldada y no pudo usarse de forma segura. Inténtelo de nuevo.',
  fr: 'La lettre générée contenait des informations non étayées et n\'a pas pu être utilisée en toute sécurité. Veuillez réessayer.',
  it: 'La lettera generata conteneva informazioni non supportate e non poteva essere usata in sicurezza. Riprova.',
  sr: 'Generisano propratno pismo je sadržalo nepodržane informacije i nije moglo bezbedno da se koristi. Pokušajte ponovo.',
  hr: 'Generirano popratno pismo sadržavalo je nepodržane informacije i nije se moglo sigurno koristiti. Pokušajte ponovno.',
  ru: 'Сгенерированное письмо содержало неподтверждённые сведения и не могло быть безопасно использовано. Повторите попытку.',
  'pt-BR': 'A carta gerada continha informações sem respaldo e não pôde ser usada com segurança. Tente novamente.',
  ja: '生成されたカバーレターに裏付けのない情報が含まれていたため、安全に使用できませんでした。もう一度お試しください。',
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

export function coverLetterGroundingFailed(locale: Locale | string): string {
  return GROUNDING_FAILED[locale as Locale] ?? GROUNDING_FAILED.en!;
}
