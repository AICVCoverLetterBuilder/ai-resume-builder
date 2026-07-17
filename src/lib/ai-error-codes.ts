/**
 * Distinct AI failure classes — never collapse unrelated failures into one toast.
 */
import type { Locale } from './i18n/translations';

export const AI_ERROR_CODES = [
  'free_ai_limit_reached',
  'pro_safety_limit_reached',
  'client_rate_limited',
  'server_rate_limited',
  'provider_rate_limited',
  'provider_temporarily_unavailable',
  'provider_auth_error',
  'provider_credit_exhausted',
  'network_error',
  'request_timeout',
  'invalid_pro_token',
  'circuit_breaker_open',
  'generation_validation_failed',
  'experience_description_required',
] as const;

export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export interface AiErrorPayload {
  code: AiErrorCode;
  httpStatus?: number;
  providerStatus?: number | string | null;
  retryAfterSec?: number | null;
  message?: string;
}

type MsgMap = Partial<Record<Locale, string>>;

const FREE_LIMIT: MsgMap = {
  en: 'You have reached the free AI limit. Upgrade to Pro for more generations.',
  hi: 'आप मुफ़्त AI सीमा तक पहुँच चुके हैं। अधिक जनरेशन के लिए Pro में अपग्रेड करें।',
  de: 'Sie haben das kostenlose KI-Limit erreicht. Upgraden Sie auf Pro für weitere Generierungen.',
  es: 'Has alcanzado el límite gratuito de IA. Mejora a Pro para más generaciones.',
  fr: 'Vous avez atteint la limite IA gratuite. Passez à Pro pour plus de générations.',
  it: 'Hai raggiunto il limite IA gratuito. Passa a Pro per altre generazioni.',
  ar: 'لقد وصلت إلى حد الذكاء الاصطناعي المجاني. قم بالترقية إلى Pro للمزيد.',
  sr: 'Dostigli ste besplatni AI limit. Nadogradite na Pro za više generisanja.',
  hr: 'Dosegli ste besplatni AI limit. Nadogradite na Pro za više generiranja.',
  ru: 'Вы достигли бесплатного лимита ИИ. Перейдите на Pro для дополнительных генераций.',
  'pt-BR': 'Você atingiu o limite gratuito de IA. Atualize para Pro para mais gerações.',
  ja: '無料のAI利用上限に達しました。さらに生成するにはProにアップグレードしてください。',
};

const PRO_SAFETY: MsgMap = {
  en: 'AI is temporarily pausing high usage for protection. Please try again later.',
  hi: 'सुरक्षा के लिए AI अस्थायी रूप से उच्च उपयोग रोक रहा है। कृपया बाद में पुनः प्रयास करें।',
  de: 'Die KI pausiert vorübergehend bei hoher Nutzung zum Schutz. Bitte versuchen Sie es später erneut.',
  es: 'La IA pausa temporalmente el uso intenso por protección. Inténtalo más tarde.',
  fr: 'L’IA met temporairement en pause une utilisation intensive pour protection. Réessayez plus tard.',
  it: 'L’IA mette temporaneamente in pausa l’uso intensivo per protezione. Riprova più tardi.',
  ar: 'يوقف الذكاء الاصطناعي مؤقتًا الاستخدام المرتفع للحماية. يُرجى المحاولة لاحقًا.',
  sr: 'AI privremeno pauzira visoku upotrebu radi zaštite. Pokušajte ponovo kasnije.',
  hr: 'AI privremeno pauzira visoku upotrebu radi zaštite. Pokušajte ponovno kasnije.',
  ru: 'ИИ временно приостанавливает высокую нагрузку для защиты. Повторите попытку позже.',
  'pt-BR': 'A IA está pausando temporariamente o uso intenso por proteção. Tente novamente mais tarde.',
  ja: '保護のため、AIは一時的に高頻度の利用を制限しています。しばらくしてからもう一度お試しください。',
};

const RATE_LIMIT: MsgMap = {
  en: 'Too many AI requests. Please wait {seconds} seconds and try again.',
  hi: 'बहुत अधिक AI अनुरोध। कृपया {seconds} सेकंड प्रतीक्षा करके पुनः प्रयास करें।',
  de: 'Zu viele KI-Anfragen. Bitte warten Sie {seconds} Sekunden und versuchen Sie es erneut.',
  es: 'Demasiadas solicitudes de IA. Espera {seconds} segundos e inténtalo de nuevo.',
  fr: 'Trop de requêtes IA. Patientez {seconds} secondes puis réessayez.',
  it: 'Troppe richieste IA. Attendi {seconds} secondi e riprova.',
  ar: 'طلبات ذكاء اصطناعي كثيرة جدًا. يُرجى الانتظار {seconds} ثانية ثم المحاولة مجددًا.',
  sr: 'Previše AI zahteva. Sačekajte {seconds} sekundi i pokušajte ponovo.',
  hr: 'Previše AI zahtjeva. Pričekajte {seconds} sekundi i pokušajte ponovno.',
  ru: 'Слишком много запросов к ИИ. Подождите {seconds} сек. и повторите попытку.',
  'pt-BR': 'Muitas solicitações de IA. Aguarde {seconds} segundos e tente novamente.',
  ja: 'AIリクエストが多すぎます。{seconds}秒待ってからもう一度お試しください。',
};

const PROVIDER_UNAVAILABLE: MsgMap = {
  en: 'The AI provider is temporarily unavailable. Please try again shortly.',
  hi: 'AI प्रदाता अस्थायी रूप से उपलब्ध नहीं है। कृपया थोड़ी देर बाद पुनः प्रयास करें।',
  de: 'Der KI-Anbieter ist vorübergehend nicht verfügbar. Bitte versuchen Sie es in Kürze erneut.',
  es: 'El proveedor de IA no está disponible temporalmente. Inténtalo en breve.',
  fr: 'Le fournisseur IA est temporairement indisponible. Réessayez sous peu.',
  it: 'Il provider IA non è temporaneamente disponibile. Riprova a breve.',
  ar: 'مزود الذكاء الاصطناعي غير متاح مؤقتًا. يُرجى المحاولة بعد قليل.',
  sr: 'AI provajder je privremeno nedostupan. Pokušajte ponovo uskoro.',
  hr: 'AI pružatelj je privremeno nedostupan. Pokušajte ponovno uskoro.',
  ru: 'Провайдер ИИ временно недоступен. Повторите попытку чуть позже.',
  'pt-BR': 'O provedor de IA está temporariamente indisponível. Tente novamente em breve.',
  ja: 'AIプロバイダーが一時的に利用できません。しばらくしてからもう一度お試しください。',
};

const PROVIDER_AUTH: MsgMap = {
  en: 'AI provider authentication failed. Please try again later.',
  hi: 'AI प्रदाता प्रमाणीकरण विफल रहा। कृपया बाद में पुनः प्रयास करें।',
  de: 'KI-Anbieter-Authentifizierung fehlgeschlagen. Bitte später erneut versuchen.',
  es: 'Falló la autenticación del proveedor de IA. Inténtalo más tarde.',
  fr: 'Échec d’authentification du fournisseur IA. Réessayez plus tard.',
  it: 'Autenticazione del provider IA non riuscita. Riprova più tardi.',
  ar: 'فشل مصادقة مزود الذكاء الاصطناعي. يُرجى المحاولة لاحقًا.',
  sr: 'Autentifikacija AI provajdera nije uspela. Pokušajte ponovo kasnije.',
  hr: 'Autentifikacija AI pružatelja nije uspjela. Pokušajte ponovno kasnije.',
  ru: 'Ошибка аутентификации провайдера ИИ. Повторите попытку позже.',
  'pt-BR': 'Falha na autenticação do provedor de IA. Tente novamente mais tarde.',
  ja: 'AIプロバイダーの認証に失敗しました。しばらくしてからもう一度お試しください。',
};

const PROVIDER_CREDIT: MsgMap = {
  en: 'AI provider credits are exhausted. Please try again later.',
  hi: 'AI प्रदाता क्रेडिट समाप्त हो गए हैं। कृपया बाद में पुनः प्रयास करें।',
  de: 'KI-Anbieter-Guthaben ist aufgebraucht. Bitte später erneut versuchen.',
  es: 'Se agotaron los créditos del proveedor de IA. Inténtalo más tarde.',
  fr: 'Les crédits du fournisseur IA sont épuisés. Réessayez plus tard.',
  it: 'I crediti del provider IA sono esauriti. Riprova più tardi.',
  ar: 'نفدت أرصدة مزود الذكاء الاصطناعي. يُرجى المحاولة لاحقًا.',
  sr: 'AI provajderu su ponestali krediti. Pokušajte ponovo kasnije.',
  hr: 'AI pružatelju su ponestali krediti. Pokušajte ponovno kasnije.',
  ru: 'Кредиты провайдера ИИ исчерпаны. Повторите попытку позже.',
  'pt-BR': 'Os créditos do provedor de IA acabaram. Tente novamente mais tarde.',
  ja: 'AIプロバイダーのクレジットが不足しています。しばらくしてからもう一度お試しください。',
};

const NETWORK: MsgMap = {
  en: 'Network error. Check your connection and try again.',
  hi: 'नेटवर्क त्रुटि। अपना कनेक्शन जाँचें और पुनः प्रयास करें।',
  de: 'Netzwerkfehler. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
  es: 'Error de red. Comprueba tu conexión e inténtalo de nuevo.',
  fr: 'Erreur réseau. Vérifiez votre connexion et réessayez.',
  it: 'Errore di rete. Controlla la connessione e riprova.',
  ar: 'خطأ في الشبكة. تحقق من اتصالك وحاول مجددًا.',
  sr: 'Mrežna greška. Proverite vezu i pokušajte ponovo.',
  hr: 'Mrežna greška. Provjerite vezu i pokušajte ponovno.',
  ru: 'Ошибка сети. Проверьте подключение и повторите попытку.',
  'pt-BR': 'Erro de rede. Verifique sua conexão e tente novamente.',
  ja: 'ネットワークエラーです。接続を確認してもう一度お試しください。',
};

const TIMEOUT: MsgMap = {
  en: 'The AI request timed out. Please try again.',
  hi: 'AI अनुरोध का समय समाप्त हो गया। कृपया पुनः प्रयास करें।',
  de: 'Die KI-Anfrage ist abgelaufen. Bitte erneut versuchen.',
  es: 'La solicitud de IA agotó el tiempo de espera. Inténtalo de nuevo.',
  fr: 'La requête IA a expiré. Veuillez réessayer.',
  it: 'La richiesta IA è scaduta. Riprova.',
  ar: 'انتهت مهلة طلب الذكاء الاصطناعي. يُرجى المحاولة مجددًا.',
  sr: 'AI zahtev je istekao. Pokušajte ponovo.',
  hr: 'AI zahtjev je istekao. Pokušajte ponovno.',
  ru: 'Истекло время ожидания запроса к ИИ. Повторите попытку.',
  'pt-BR': 'A solicitação de IA expirou. Tente novamente.',
  ja: 'AIリクエストがタイムアウトしました。もう一度お試しください。',
};

const INVALID_PRO: MsgMap = {
  en: 'Pro authorization needs to be refreshed. Please try again in a moment.',
  hi: 'Pro प्राधिकरण को रीफ़्रेश करने की आवश्यकता है। कृपया कुछ देर बाद पुनः प्रयास करें।',
  de: 'Die Pro-Autorisierung muss aktualisiert werden. Bitte versuchen Sie es gleich erneut.',
  es: 'Hay que actualizar la autorización Pro. Inténtalo de nuevo en un momento.',
  fr: 'L’autorisation Pro doit être actualisée. Réessayez dans un instant.',
  it: 'L’autorizzazione Pro deve essere aggiornata. Riprova tra un momento.',
  ar: 'يلزم تحديث تفويض Pro. يُرجى المحاولة بعد قليل.',
  sr: 'Pro autorizacija mora da se osveži. Pokušajte ponovo za trenutak.',
  hr: 'Pro autorizacija mora se osvježiti. Pokušajte ponovno za trenutak.',
  ru: 'Требуется обновить авторизацию Pro. Повторите попытку через минуту.',
  'pt-BR': 'A autorização Pro precisa ser atualizada. Tente novamente em instantes.',
  ja: 'Pro認証の更新が必要です。しばらくしてからもう一度お試しください。',
};

const CIRCUIT_OPEN: MsgMap = {
  en: 'AI is cooling down after recent errors. Please try again in {seconds} seconds.',
  hi: 'हाल की त्रुटियों के बाद AI ठंडा हो रहा है। कृपया {seconds} सेकंड में पुनः प्रयास करें।',
  de: 'Die KI pausiert nach kürzlichen Fehlern. Bitte in {seconds} Sekunden erneut versuchen.',
  es: 'La IA está en pausa tras errores recientes. Inténtalo en {seconds} segundos.',
  fr: 'L’IA est en pause après des erreurs récentes. Réessayez dans {seconds} secondes.',
  it: 'L’IA è in pausa dopo errori recenti. Riprova tra {seconds} secondi.',
  ar: 'الذكاء الاصطناعي في فترة تهدئة بعد أخطاء حديثة. حاول بعد {seconds} ثانية.',
  sr: 'AI se hladi posle nedavnih grešaka. Pokušajte ponovo za {seconds} sekundi.',
  hr: 'AI se hladi nakon nedavnih grešaka. Pokušajte ponovno za {seconds} sekundi.',
  ru: 'ИИ на паузе после недавних ошибок. Повторите через {seconds} сек.',
  'pt-BR': 'A IA está em pausa após erros recentes. Tente novamente em {seconds} segundos.',
  ja: '最近のエラーのためAIがクールダウン中です。{seconds}秒後にもう一度お試しください。',
};

const VALIDATION: MsgMap = {
  en: 'AI output failed validation and was not applied. Please try again.',
  hi: 'AI आउटपुट सत्यापन में विफल रहा और लागू नहीं किया गया। कृपया पुनः प्रयास करें।',
  de: 'KI-Ausgabe hat die Prüfung nicht bestanden und wurde nicht übernommen. Bitte erneut versuchen.',
  es: 'La salida de IA no pasó la validación y no se aplicó. Inténtalo de nuevo.',
  fr: 'La sortie IA a échoué à la validation et n’a pas été appliquée. Réessayez.',
  it: 'L’output IA non ha superato la convalida e non è stato applicato. Riprova.',
  ar: 'فشل التحقق من مخرجات الذكاء الاصطناعي ولم تُطبَّق. يُرجى المحاولة مجددًا.',
  sr: 'AI izlaz nije prošao validaciju i nije primenjen. Pokušajte ponovo.',
  hr: 'AI izlaz nije prošao validaciju i nije primijenjen. Pokušajte ponovno.',
  ru: 'Результат ИИ не прошёл проверку и не был применён. Повторите попытку.',
  'pt-BR': 'A saída da IA falhou na validação e não foi aplicada. Tente novamente.',
  ja: 'AI出力の検証に失敗したため適用されませんでした。もう一度お試しください。',
};

const EXPERIENCE_DESCRIPTION_REQUIRED: MsgMap = {
  en: 'Enter a work-experience description first.',
  hi: 'कृपया पहले कार्य अनुभव का विवरण दर्ज करें।',
  de: 'Bitte geben Sie zuerst eine Berufserfahrungsbeschreibung ein.',
  es: 'Introduce primero una descripción de la experiencia laboral.',
  fr: 'Saisissez d’abord une description de l’expérience professionnelle.',
  it: 'Inserisci prima una descrizione dell’esperienza lavorativa.',
  ar: 'يرجى إدخال وصف خبرة العمل أولاً.',
  sr: 'Prvo unesite opis radnog iskustva.',
  hr: 'Prvo unesite opis radnog iskustva.',
  ru: 'Сначала введите описание опыта работы.',
  'pt-BR': 'Insira primeiro uma descrição da experiência profissional.',
  ja: '先に職歴の説明を入力してください。',
};

function pick(map: MsgMap, locale: Locale | string): string {
  return map[locale as Locale] ?? map.en ?? '';
}

function withSeconds(template: string, seconds?: number | null): string {
  const sec = Math.max(1, Math.ceil(seconds ?? 30));
  return template.replace(/\{seconds\}/g, String(sec));
}

/** Localized user-facing message for an AI error code. */
export function aiErrorMessage(
  code: AiErrorCode,
  locale: Locale | string,
  retryAfterSec?: number | null,
): string {
  switch (code) {
    case 'free_ai_limit_reached':
      return pick(FREE_LIMIT, locale);
    case 'pro_safety_limit_reached':
      return pick(PRO_SAFETY, locale);
    case 'client_rate_limited':
    case 'server_rate_limited':
    case 'provider_rate_limited':
      return withSeconds(pick(RATE_LIMIT, locale), retryAfterSec);
    case 'provider_temporarily_unavailable':
      return pick(PROVIDER_UNAVAILABLE, locale);
    case 'provider_auth_error':
      return pick(PROVIDER_AUTH, locale);
    case 'provider_credit_exhausted':
      return pick(PROVIDER_CREDIT, locale);
    case 'network_error':
      return pick(NETWORK, locale);
    case 'request_timeout':
      return pick(TIMEOUT, locale);
    case 'invalid_pro_token':
      return pick(INVALID_PRO, locale);
    case 'circuit_breaker_open':
      return withSeconds(pick(CIRCUIT_OPEN, locale), retryAfterSec);
    case 'generation_validation_failed':
      return pick(VALIDATION, locale);
    case 'experience_description_required':
      return pick(EXPERIENCE_DESCRIPTION_REQUIRED, locale);
    default:
      return pick(PROVIDER_UNAVAILABLE, locale);
  }
}
