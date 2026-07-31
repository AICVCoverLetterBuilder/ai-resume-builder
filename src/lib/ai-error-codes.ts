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
  'experience_generation_failed',
  'experience_generation_not_relevant',
  'experience_generation_locale_invalid',
  'experience_generation_unsafe_claims',
  'experience_enhancement_fact_coverage_incomplete',
  'summary_generation_failed',
  'summary_grounding_failed',
  'summary_rewrite_failed',
  'cover_letter_generation_failed',
  'cover_letter_regeneration_failed',
  'stronger_content_generation_failed',
  'ai_noop',
  'ai_request_stale',
  /** Selected candidate passed validation but visible/persisted commit failed. */
  'summary_state_write_failed',
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

const EXPERIENCE_GENERATION_FAILED: MsgMap = {
  en: 'Could not generate experience duties from the job details. Please try again.',
  sr: 'Nije moguće generisati dužnosti iz podataka o poslu. Pokušajte ponovo.',
  hr: 'Nije moguće generirati dužnosti iz podataka o poslu. Pokušajte ponovno.',
  hi: 'पद विवरण से अनुभव कर्तव्य उत्पन्न नहीं हो सके। कृपया पुनः प्रयास करें।',
  de: 'Aufgaben konnten aus den Stellenangaben nicht erzeugt werden. Bitte erneut versuchen.',
  es: 'No se pudieron generar las funciones a partir del puesto. Inténtalo de nuevo.',
  ar: 'تعذّر إنشاء مهام الخبرة من تفاصيل الوظيفة. يُرجى المحاولة مجددًا.',
  ja: '職種情報から職務内容を生成できませんでした。もう一度お試しください。',
  ru: 'Не удалось сформировать обязанности из данных о должности. Повторите попытку.',
  'pt-BR': 'Não foi possível gerar as funções a partir do cargo. Tente novamente.',
  fr: 'Impossible de générer les missions à partir du poste. Réessayez.',
  it: 'Impossibile generare le mansioni dal ruolo. Riprova.',
};

const EXPERIENCE_GENERATION_NOT_RELEVANT: MsgMap = {
  en: 'Generated duties were not relevant to the job title and were not applied.',
  sr: 'Generisane dužnosti nisu bile relevantne za poziciju i nisu primenjene.',
  hr: 'Generirane dužnosti nisu bile relevantne za poziciju i nisu primijenjene.',
  hi: 'उत्पन्न कर्तव्य पद से संबंधित नहीं थे और लागू नहीं किए गए।',
  de: 'Erzeugte Aufgaben passten nicht zur Stelle und wurden nicht übernommen.',
  es: 'Las funciones generadas no eran relevantes al puesto y no se aplicaron.',
  ar: 'المهام المُنشأة غير مرتبطة بالمسمى الوظيفي ولم تُطبَّق.',
  ja: '生成された職務が職種と関連しないため適用されませんでした。',
  ru: 'Сформированные обязанности не соответствуют должности и не применены.',
  'pt-BR': 'As funções geradas não eram relevantes ao cargo e não foram aplicadas.',
  fr: 'Les missions générées n’étaient pas pertinentes et n’ont pas été appliquées.',
  it: 'Le mansioni generate non erano pertinenti e non sono state applicate.',
};

const EXPERIENCE_GENERATION_LOCALE_INVALID: MsgMap = {
  en: 'Generated duties were not in the requested language and were not applied.',
  sr: 'Generisane dužnosti nisu bile na traženom jeziku i nisu primenjene.',
  hr: 'Generirane dužnosti nisu bile na traženom jeziku i nisu primijenjene.',
  hi: 'उत्पन्न कर्तव्य अनुरोधित भाषा में नहीं थे और लागू नहीं किए गए।',
  de: 'Erzeugte Aufgaben waren nicht in der gewünschten Sprache und wurden nicht übernommen.',
  es: 'Las funciones generadas no estaban en el idioma solicitado y no se aplicaron.',
  ar: 'المهام المُنشأة ليست باللغة المطلوبة ولم تُطبَّق.',
  ja: '生成された職務が指定言語ではなかったため適用されませんでした。',
  ru: 'Сформированные обязанности не на нужном языке и не применены.',
  'pt-BR': 'As funções geradas não estavam no idioma solicitado e não foram aplicadas.',
  fr: 'Les missions générées n’étaient pas dans la langue demandée et n’ont pas été appliquées.',
  it: 'Le mansioni generate non erano nella lingua richiesta e non sono state applicate.',
};

const EXPERIENCE_GENERATION_UNSAFE: MsgMap = {
  en: 'Generated duties included unsupported claims and were not applied.',
  sr: 'Generisane dužnosti su sadržale nepodržane tvrdnje i nisu primenjene.',
  hr: 'Generirane dužnosti sadržavale su nepodržane tvrdnje i nisu primijenjene.',
  hi: 'उत्पन्न कर्तव्यों में असमर्थित दावे थे और लागू नहीं किए गए।',
  de: 'Erzeugte Aufgaben enthielten unzulässige Angaben und wurden nicht übernommen.',
  es: 'Las funciones generadas incluían afirmaciones no admitidas y no se aplicaron.',
  ar: 'تضمنت المهام المُنشأة ادعاءات غير مدعومة ولم تُطبَّق.',
  ja: '生成された職務に根拠のない記述が含まれていたため適用されませんでした。',
  ru: 'В сформированных обязанностях были недопустимые утверждения — не применены.',
  'pt-BR': 'As funções geradas incluíam alegações não suportadas e não foram aplicadas.',
  fr: 'Les missions générées contenaient des affirmations non prises en charge et n’ont pas été appliquées.',
  it: 'Le mansioni generate contenevano affermazioni non supportate e non sono state applicate.',
};

const EXPERIENCE_ENHANCEMENT_COVERAGE: MsgMap = {
  en: 'AI could not preserve every duty from your description and was not applied.',
  sr: 'AI nije sačuvao sve dužnosti iz vašeg opisa i nije primenjen.',
  hr: 'AI nije sačuvao sve dužnosti iz vašeg opisa i nije primijenjen.',
  hi: 'AI आपके विवरण की हर ड्यूटी सुरक्षित नहीं रख सका और लागू नहीं किया गया।',
  de: 'Die KI konnte nicht alle Aufgaben Ihrer Beschreibung erhalten und wurde nicht übernommen.',
  es: 'La IA no pudo conservar todas las funciones de tu descripción y no se aplicó.',
  ar: 'تعذّر على الذكاء الاصطناعي الحفاظ على كل المهام من وصفك ولم يُطبَّق.',
  ja: '説明文の職務をすべて保持できなかったため適用されませんでした。',
  ru: 'ИИ не сохранил все обязанности из описания и не был применён.',
  'pt-BR': 'A IA não conseguiu preservar todas as funções da sua descrição e não foi aplicada.',
  fr: 'L’IA n’a pas pu conserver toutes les missions de votre description et n’a pas été appliquée.',
  it: 'L’IA non ha potuto conservare tutte le mansioni della descrizione e non è stata applicata.',
};

const SUMMARY_GENERATION_FAILED: MsgMap = {
  en: 'Could not generate a professional summary from your CV details. Please try again.',
  sr: 'Nije moguće generisati profesionalni rezime iz podataka CV-a. Pokušajte ponovo.',
  hi: 'CV विवरण से पेशेवर सारांश उत्पन्न नहीं हो सका। कृपया पुनः प्रयास करें।',
  de: 'Die berufliche Zusammenfassung konnte nicht erzeugt werden. Bitte erneut versuchen.',
  ja: 'CV情報から職務要約を生成できませんでした。もう一度お試しください。',
};

const SUMMARY_GROUNDING_FAILED: MsgMap = {
  en: 'The summary could not be grounded in your experience and was not applied.',
  sr: 'Rezime nije mogao da se usidri u vaše iskustvo i nije primenjen.',
  hi: 'सारांश आपके अनुभव पर आधारित नहीं हो सका और लागू नहीं किया गया।',
  de: 'Die Zusammenfassung konnte nicht an Ihre Erfahrung gebunden werden und wurde nicht übernommen.',
  ja: '要約を職歴に根拠付けできなかったため適用されませんでした。',
  hr: 'Sažetak nije bilo moguće utemeljiti u vaše iskustvo i nije primijenjen.',
  es: 'No se pudo generar un resumen basado fielmente en tu experiencia, por lo que no se aplicó ningún cambio.',
  fr: 'Le résumé n’a pas pu être ancré dans votre expérience et n’a pas été appliqué.',
  it: 'Il riepilogo non è stato ancorato alla tua esperienza e non è stato applicato.',
  ar: 'تعذّر تأسيس الملخص على خبرتك ولم يُطبَّق.',
  ru: 'Не удалось обосновать резюме вашим опытом — изменения не применены.',
  'pt-BR': 'O resumo não pôde ser fundamentado na sua experiência e não foi aplicado.',
};

const SUMMARY_REWRITE_FAILED: MsgMap = {
  en: 'Could not rewrite the professional summary safely. Please try again.',
  sr: 'Nije moguće bezbedno prepraviti profesionalni rezime. Pokušajte ponovo.',
  hi: 'पेशेवर सारांश को सुरक्षित रूप से पुनर्लेखित नहीं किया जा सका। कृपया पुनः प्रयास करें।',
  de: 'Die berufliche Zusammenfassung konnte nicht sicher umgeschrieben werden. Bitte erneut versuchen.',
  ja: '職務要約を安全に書き直せませんでした。もう一度お試しください。',
  hr: 'Nije moguće sigurno prepraviti profesionalni sažetak. Pokušajte ponovno.',
  es: 'No se pudo reescribir el resumen profesional de forma segura. Inténtalo de nuevo.',
  fr: 'Impossible de réécrire le résumé professionnel en toute sécurité. Réessayez.',
  it: 'Impossibile riscrivere in sicurezza il riepilogo professionale. Riprova.',
  ar: 'تعذّر إعادة صياغة الملخص المهني بأمان. يُرجى المحاولة مجددًا.',
  ru: 'Не удалось безопасно переписать профессиональное резюме. Повторите попытку.',
  'pt-BR': 'Não foi possível reescrever o resumo profissional com segurança. Tente novamente.',
};

const COVER_LETTER_GENERATION_FAILED: MsgMap = {
  en: 'Could not generate a cover letter from your CV facts. Please try again.',
  sr: 'Nije moguće generisati propratno pismo iz činjenica CV-a. Pokušajte ponovo.',
  hi: 'CV तथ्यों से कवर लेटर उत्पन्न नहीं हो सका। कृपया पुनः प्रयास करें।',
  de: 'Das Anschreiben konnte nicht aus Ihren CV-Fakten erzeugt werden. Bitte erneut versuchen.',
  ja: 'CVの事実からカバーレターを生成できませんでした。もう一度お試しください。',
};

const COVER_LETTER_REGENERATION_FAILED: MsgMap = {
  en: 'Could not regenerate the cover letter safely. Please try again.',
  sr: 'Nije moguće bezbedno regenerisati propratno pismo. Pokušajte ponovo.',
  hi: 'कवर लेटर को सुरक्षित रूप से पुनः उत्पन्न नहीं किया जा सका। कृपया पुनः प्रयास करें।',
  de: 'Das Anschreiben konnte nicht sicher neu erzeugt werden. Bitte erneut versuchen.',
  ja: 'カバーレターを安全に再生成できませんでした。もう一度お試しください。',
  hr: 'Nije moguće sigurno regenerirati propratno pismo. Pokušajte ponovno.',
  es: 'No se pudo regenerar la carta de presentación de forma segura. Inténtalo de nuevo.',
  fr: 'Impossible de régénérer la lettre de motivation en toute sécurité. Réessayez.',
  it: 'Impossibile rigenerare in sicurezza la lettera di presentazione. Riprova.',
  ar: 'تعذّر إعادة إنشاء خطاب التغطية بأمان. يُرجى المحاولة مجددًا.',
  ru: 'Не удалось безопасно пересоздать сопроводительное письмо. Повторите попытку.',
  'pt-BR': 'Não foi possível regenerar a carta de apresentação com segurança. Tente novamente.',
};

const STRONGER_CONTENT_FAILED: MsgMap = {
  en: 'Could not strengthen the content safely. Please try again.',
  sr: 'Nije moguće bezbedno ojačati sadržaj. Pokušajte ponovo.',
  hi: 'सामग्री को सुरक्षित रूप से मजबूत नहीं किया जा सका। कृपया पुनः प्रयास करें।',
  de: 'Der Inhalt konnte nicht sicher verstärkt werden. Bitte erneut versuchen.',
  ja: '内容を安全に強化できませんでした。もう一度お試しください。',
};

const AI_NOOP: MsgMap = {
  en: 'No meaningful change was produced, so nothing was applied.',
  sr: 'Nije proizvedena suštinska promena, pa ništa nije primenjeno.',
  hi: 'कोई सार्थक परिवर्तन नहीं हुआ, इसलिए कुछ लागू नहीं किया गया।',
  de: 'Es wurde keine sinnvolle Änderung erzeugt, daher wurde nichts übernommen.',
  ja: '意味のある変更がなかったため適用されませんでした。',
  hr: 'Nije proizvedena smislena promjena, pa ništa nije primijenjeno.',
  es: 'No se produjo ningún cambio significativo, así que no se aplicó nada.',
  fr: 'Aucun changement significatif n’a été produit, donc rien n’a été appliqué.',
  it: 'Non è stata prodotta alcuna modifica significativa, quindi non è stato applicato nulla.',
  ar: 'لم يُنتَج أي تغيير ذي معنى، لذلك لم يُطبَّق شيء.',
  ru: 'Существенных изменений не было, поэтому ничего не применено.',
  'pt-BR': 'Nenhuma alteração significativa foi produzida, então nada foi aplicado.',
};

const AI_REQUEST_STALE: MsgMap = {
  en: 'Your CV changed while AI was running. Please try again.',
  sr: 'CV se promenio dok je AI radio. Pokušajte ponovo.',
  hr: 'CV se promijenio dok je AI radio. Pokušajte ponovno.',
  hi: 'AI चलते समय आपका CV बदल गया। कृपया पुनः प्रयास करें।',
  de: 'Ihr CV hat sich während der KI-Anfrage geändert. Bitte erneut versuchen.',
  es: 'Tu CV cambió mientras la IA estaba en curso. Inténtalo de nuevo.',
  fr: 'Votre CV a changé pendant l’exécution de l’IA. Réessayez.',
  it: 'Il CV è cambiato mentre l’IA era in esecuzione. Riprova.',
  ar: 'تغيّر سيرتك الذاتية أثناء تشغيل الذكاء الاصطناعي. يُرجى المحاولة مجددًا.',
  ru: 'Ваше CV изменилось, пока работал ИИ. Повторите попытку.',
  'pt-BR': 'Seu CV mudou enquanto a IA estava em execução. Tente novamente.',
  ja: 'AIの処理中にCVが変更されました。もう一度お試しください。',
};

/** Candidate was valid; React/cvRef/textarea/persistence commit did not stick. */
const SUMMARY_STATE_WRITE_FAILED: MsgMap = {
  en: 'The updated summary could not be saved to the editor. Please try again.',
  de: 'Die aktualisierte Zusammenfassung konnte nicht im Editor gespeichert werden. Bitte erneut versuchen.',
  fr: 'Le résumé mis à jour n’a pas pu être enregistré dans l’éditeur. Réessayez.',
  es: 'No se pudo guardar el resumen actualizado en el editor. Inténtalo de nuevo.',
  it: 'Il riepilogo aggiornato non è stato salvato nell’editor. Riprova.',
  'pt-BR': 'Não foi possível salvar o resumo atualizado no editor. Tente novamente.',
  ru: 'Обновлённое резюме не удалось сохранить в редакторе. Повторите попытку.',
  sr: 'Ažurirani rezime nije mogao da se sačuva u uređivaču. Pokušajte ponovo.',
  hr: 'Ažurirani sažetak nije bilo moguće spremiti u uređivač. Pokušajte ponovno.',
  hi: 'अपडेट किया गया सारांश संपादक में सहेजा नहीं जा सका। कृपया पुनः प्रयास करें।',
  ar: 'تعذّر حفظ الملخص المحدَّث في المحرر. يُرجى المحاولة مجددًا.',
  ja: '更新された要約を編集画面に保存できませんでした。もう一度お試しください。',
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
    case 'experience_generation_failed':
      return pick(EXPERIENCE_GENERATION_FAILED, locale);
    case 'experience_generation_not_relevant':
      return pick(EXPERIENCE_GENERATION_NOT_RELEVANT, locale);
    case 'experience_generation_locale_invalid':
      return pick(EXPERIENCE_GENERATION_LOCALE_INVALID, locale);
    case 'experience_generation_unsafe_claims':
      return pick(EXPERIENCE_GENERATION_UNSAFE, locale);
    case 'experience_enhancement_fact_coverage_incomplete':
      return pick(EXPERIENCE_ENHANCEMENT_COVERAGE, locale);
    case 'summary_generation_failed':
      return pick(SUMMARY_GENERATION_FAILED, locale);
    case 'summary_grounding_failed':
      return pick(SUMMARY_GROUNDING_FAILED, locale);
    case 'summary_rewrite_failed':
      return pick(SUMMARY_REWRITE_FAILED, locale);
    case 'cover_letter_generation_failed':
      return pick(COVER_LETTER_GENERATION_FAILED, locale);
    case 'cover_letter_regeneration_failed':
      return pick(COVER_LETTER_REGENERATION_FAILED, locale);
    case 'stronger_content_generation_failed':
      return pick(STRONGER_CONTENT_FAILED, locale);
    case 'ai_noop':
      return pick(AI_NOOP, locale);
    case 'ai_request_stale':
      return pick(AI_REQUEST_STALE, locale);
    case 'summary_state_write_failed':
      return pick(SUMMARY_STATE_WRITE_FAILED, locale);
    default:
      return pick(PROVIDER_UNAVAILABLE, locale);
  }
}

/** Map finalize / Experience AI typed failure reasons onto AI error codes. */
export function mapExperienceAiFailureToErrorCode(
  reason: string | null | undefined,
): AiErrorCode {
  // Lazy import avoided — keep mapping local + aligned with universal contract.
  switch (reason) {
    case 'experience_generation_failed':
      return 'experience_generation_failed';
    case 'experience_generation_not_relevant':
      return 'experience_generation_not_relevant';
    case 'experience_generation_locale_invalid':
    case 'ai_output_locale_invalid':
      return 'experience_generation_locale_invalid';
    case 'experience_generation_unsafe_claims':
    case 'ai_output_unsafe_claims':
      return 'experience_generation_unsafe_claims';
    case 'experience_enhancement_fact_coverage_incomplete':
    case 'experience_material_fact_coverage_incomplete':
    case 'experience_enhancement_failed':
      return 'experience_enhancement_fact_coverage_incomplete';
    case 'summary_generation_failed':
      return 'summary_generation_failed';
    case 'summary_grounding_failed':
      return 'summary_grounding_failed';
    case 'summary_rewrite_failed':
      return 'summary_rewrite_failed';
    case 'cover_letter_generation_failed':
      return 'cover_letter_generation_failed';
    case 'cover_letter_regeneration_failed':
      return 'cover_letter_regeneration_failed';
    case 'stronger_content_generation_failed':
      return 'stronger_content_generation_failed';
    case 'ai_noop':
    case 'experience_ai_noop':
    case 'summary_noop_after_normalization':
      return 'ai_noop';
    case 'ai_request_stale':
    case 'stale_summary_edited_in_flight':
    case 'source_hash_changed_before_write':
      return 'ai_request_stale';
    case 'summary_state_write_failed':
    case 'visible_summary_hash_mismatch':
    case 'post_write_visible_hash_mismatch':
    case 'write_did_not_materialize_selected_hash':
      // Candidate already passed validation — do not claim content validation failed.
      return 'summary_state_write_failed';
    default:
      return 'generation_validation_failed';
  }
}
