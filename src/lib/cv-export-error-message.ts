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

function isSummaryLocaleReason(reason: string): boolean {
  return /summary|mixed.?language|unlocalized.?skill|english dump|no valid localized summary/i.test(reason);
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
  if (reason && isSummaryLocaleReason(reason)) {
    return SUMMARY_REGENERATE[locale] || SUMMARY_REGENERATE.en;
  }
  return kind === 'pdf'
    ? (GENERIC_PDF[locale] || GENERIC_PDF.en)
    : (GENERIC_DOCX[locale] || GENERIC_DOCX.en);
}
