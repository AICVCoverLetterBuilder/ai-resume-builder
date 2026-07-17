/**
 * Map export integrity failure reasons to localized user-facing messages.
 * Prefer specific recovery guidance over a generic "PDF/DOCX export failed".
 */
import type { Locale } from './i18n/translations';

const SUMMARY_REGENERATE: Record<Locale, string> = {
  en: 'The professional summary mixes languages. Please regenerate the summary in the selected language, then export again.',
  de: 'Die berufliche Zusammenfassung mischt Sprachen. Bitte generieren Sie die Zusammenfassung erneut in der gewählten Sprache und exportieren Sie dann erneut.',
  es: 'El resumen profesional mezcla idiomas. Vuelva a generar el resumen en el idioma seleccionado y exporte de nuevo.',
  fr: 'Le résumé professionnel mélange les langues. Régénérez le résumé dans la langue sélectionnée, puis exportez à nouveau.',
  it: 'Il riassunto professionale mescola le lingue. Rigenera il riassunto nella lingua selezionata e poi esporta di nuovo.',
  ar: 'الملخص المهني يخلط بين اللغات. يرجى إعادة إنشاء الملخص باللغة المحددة ثم التصدير مرة أخرى.',
  sr: 'Profesionalni rezime meša jezike. Ponovo generišite rezime na izabranom jeziku, pa izvezite ponovo.',
  hr: 'Profesionalni sažetak miješa jezike. Ponovno generirajte sažetak na odabranom jeziku, zatim ponovno izvezite.',
  ru: 'Профессиональное резюме смешивает языки. Сгенерируйте резюме снова на выбранном языке, затем повторите экспорт.',
  'pt-BR': 'O resumo profissional mistura idiomas. Gere novamente o resumo no idioma selecionado e exporte de novo.',
  hi: 'पेशेवर सारांश में भाषाएँ मिल गई हैं। कृपया चयनित भाषा में सारांश फिर से जनरेट करें, फिर निर्यात करें।',
  ja: '職務要約に複数の言語が混在しています。選択した言語で要約を再生成してから、もう一度エクスポートしてください。',
};

const GENERIC_PDF: Record<Locale, string> = {
  en: 'PDF export failed. Please try again.',
  de: 'PDF-Export fehlgeschlagen. Bitte erneut versuchen.',
  es: 'Error al exportar PDF. Por favor, inténtalo de nuevo.',
  fr: 'Échec de l\'export PDF. Veuillez réessayer.',
  it: 'Esportazione PDF fallita. Riprova.',
  ar: 'فشل تصدير PDF. الرجاء المحاولة مرة أخرى.',
  sr: 'Izvoz PDF-a nije uspeo. Pokušajte ponovo.',
  hr: 'Izvoz PDF-a nije uspio. Pokušajte ponovo.',
  ru: 'Ошибка экспорта PDF. Пожалуйста, попробуйте снова.',
  'pt-BR': 'Falha ao exportar PDF. Por favor, tente novamente.',
  hi: 'PDF निर्यात विफल। कृपया पुनः प्रयास करें।',
  ja: 'PDFのエクスポートに失敗しました。もう一度お試しください。',
};

const GENERIC_DOCX: Record<Locale, string> = {
  en: 'Word export failed. Please try again.',
  de: 'Word-Export fehlgeschlagen. Bitte erneut versuchen.',
  es: 'Error al exportar Word. Por favor, inténtalo de nuevo.',
  fr: 'Échec de l\'export Word. Veuillez réessayer.',
  it: 'Esportazione Word fallita. Riprova.',
  ar: 'فشل تصدير Word. يرجى المحاولة مرة أخرى.',
  sr: 'Word izvoz nije uspeo. Pokušajte ponovo.',
  hr: 'Word izvoz nije uspio. Pokušajte ponovo.',
  ru: 'Ошибка экспорта Word. Пожалуйста, попробуйте снова.',
  'pt-BR': 'Falha na exportação do Word. Tente novamente.',
  hi: 'Word निर्यात विफल। कृपया पुनः प्रयास करें।',
  ja: 'Wordのエクスポートに失敗しました。もう一度お試しください。',
};

const TITLE_CONFLICT: Record<Locale, string> = {
  en: 'The saved job title conflicts with the confirmed experience. Review the title and duties, then export again.',
  de: 'Die gespeicherte Berufsbezeichnung widerspricht der bestätigten Erfahrung. Prüfen Sie Titel und Aufgaben und exportieren Sie erneut.',
  es: 'El puesto guardado entra en conflicto con la experiencia confirmada. Revise el puesto y las funciones y vuelva a exportar.',
  fr: 'Le poste enregistré est en conflit avec l’expérience confirmée. Vérifiez le poste et les missions, puis réexportez.',
  it: 'Il ruolo salvato è in conflitto con l’esperienza confermata. Controlla ruolo e mansioni, quindi esporta di nuovo.',
  ar: 'يتعارض المسمى الوظيفي المحفوظ مع الخبرة المؤكدة. راجع المسمى والمهام ثم أعد التصدير.',
  sr: 'Sačuvan naziv pozicije nije usklađen sa potvrđenim iskustvom. Proverite naziv i dužnosti, pa pokušajte ponovo.',
  hr: 'Spremljeni naziv radnog mjesta nije usklađen s potvrđenim iskustvom. Provjerite naziv i dužnosti pa pokušajte ponovno.',
  ru: 'Сохранённая должность не соответствует подтверждённому опыту. Проверьте должность и обязанности и повторите экспорт.',
  'pt-BR': 'O cargo salvo está em conflito com a experiência confirmada. Revise o cargo e as atividades e exporte novamente.',
  hi: 'सहेजा गया पद पुष्टि किए गए अनुभव से मेल नहीं खाता। पद और जिम्मेदारियाँ जाँचकर फिर निर्यात करें।',
  ja: '保存された職種が確認済みの職歴と一致しません。職種と業務内容を確認して再度エクスポートしてください。',
};

const SUMMARY_FACTS_REVIEW: Record<Locale, string> = {
  en: 'The professional summary could not be verified against the saved experience. Review the saved CV and export again.',
  de: 'Die Zusammenfassung konnte nicht anhand der gespeicherten Erfahrung geprüft werden. Prüfen Sie den Lebenslauf und exportieren Sie erneut.',
  es: 'No se pudo verificar el resumen con la experiencia guardada. Revise el CV y vuelva a exportar.',
  fr: 'Le résumé n’a pas pu être vérifié avec l’expérience enregistrée. Vérifiez le CV puis réexportez.',
  it: 'Non è stato possibile verificare il riepilogo con l’esperienza salvata. Controlla il CV ed esporta di nuovo.',
  ar: 'تعذر التحقق من الملخص مقابل الخبرة المحفوظة. راجع السيرة الذاتية ثم أعد التصدير.',
  sr: 'Rezime nije moguće proveriti prema sačuvanom iskustvu. Pregledajte CV i pokušajte ponovo.',
  hr: 'Sažetak nije moguće provjeriti prema spremljenom iskustvu. Pregledajte CV i pokušajte ponovno.',
  ru: 'Не удалось сверить резюме с сохранённым опытом. Проверьте CV и повторите экспорт.',
  'pt-BR': 'Não foi possível verificar o resumo com a experiência salva. Revise o currículo e exporte novamente.',
  hi: 'पेशेवर सारांश को सहेजे गए अनुभव से सत्यापित नहीं किया जा सका। CV जाँचकर फिर निर्यात करें।',
  ja: '職務要約を保存済みの職歴と照合できませんでした。CVを確認して再度エクスポートしてください。',
};

function isActualSummaryLanguageReason(reason: string): boolean {
  return /mixed_language_summary|mixed_locale_summary|unlocalized_skill_labels|wrong_language(?:_summary)?|summary:\s*English canonical dump blocked/i.test(reason);
}

function isTitleConflictReason(reason: string): boolean {
  return /summary_title_localization_conflict|forced-conflicting-title|invalid_occupational_title|duty_family_mismatch/i.test(reason);
}

function isSummaryFactsReason(reason: string): boolean {
  return /summary_grounding_projection_failed|summary_proper_noun_rejected|summary_locale_state_mismatch|missing_provenance|migration_failure|recovery_failure/i.test(reason);
}

export function formatCvExportIntegrityToast(
  err: unknown,
  locale: Locale,
  kind: 'pdf' | 'docx',
): string {
  const reason = err && typeof err === 'object' && 'reason' in err
    ? String((err as { reason?: string }).reason || '')
    : err instanceof Error
      ? err.message
      : '';
  if (reason && isActualSummaryLanguageReason(reason)) {
    return SUMMARY_REGENERATE[locale] || SUMMARY_REGENERATE.en;
  }
  if (reason && isTitleConflictReason(reason)) {
    return TITLE_CONFLICT[locale] || TITLE_CONFLICT.en;
  }
  if (reason && isSummaryFactsReason(reason)) {
    return SUMMARY_FACTS_REVIEW[locale] || SUMMARY_FACTS_REVIEW.en;
  }
  return kind === 'pdf'
    ? (GENERIC_PDF[locale] || GENERIC_PDF.en)
    : (GENERIC_DOCX[locale] || GENERIC_DOCX.en);
}
