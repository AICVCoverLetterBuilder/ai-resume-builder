/**
 * Map export integrity failure reasons to localized user-facing messages.
 * Prefer specific recovery guidance over a generic "PDF/DOCX export failed".
 * Preserve exact internal reasons until this final toast boundary.
 */
import type { Locale } from './i18n/translations';
import { SaveFailedError } from './native-save';

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

const EXPERIENCE_FACTS_REVIEW: Record<Locale, string> = {
  en: 'The saved experience duties could not be verified for export. Review the experience entries and export again.',
  de: 'Die gespeicherten Aufgaben konnten für den Export nicht überprüft werden. Prüfen Sie die Berufserfahrung und exportieren Sie erneut.',
  es: 'No se pudieron verificar las funciones de la experiencia para la exportación. Revise las experiencias y vuelva a exportar.',
  fr: 'Les missions enregistrées n’ont pas pu être vérifiées pour l’export. Vérifiez les expériences, puis réexportez.',
  it: 'Non è stato possibile verificare le mansioni salvate per l’esportazione. Controlla le esperienze ed esporta di nuovo.',
  ar: 'تعذر التحقق من مهام الخبرة المحفوظة للتصدير. راجع إدخالات الخبرة ثم أعد التصدير.',
  sr: 'Sačuvane dužnosti iz radnog iskustva nije moguće proveriti za izvoz. Pregledajte iskustva i pokušajte ponovo.',
  hr: 'Spremljene radne obveze nije moguće provjeriti za izvoz. Pregledajte iskustva i pokušajte ponovno.',
  ru: 'Не удалось проверить сохранённые обязанности для экспорта. Проверьте записи об опыте и повторите экспорт.',
  'pt-BR': 'Não foi possível verificar as atividades salvas para exportação. Revise as experiências e exporte novamente.',
  hi: 'निर्यात के लिए सहेजे गए अनुभव के कार्यों को सत्यापित नहीं किया जा सका। अनुभव प्रविष्टियाँ जाँचें और फिर निर्यात करें।',
  ja: '保存された職務内容をエクスポート用に確認できませんでした。職歴を確認して、もう一度エクスポートしてください。',
};

const LEGACY_SNAPSHOT_REVIEW: Record<Locale, string> = {
  en: 'The saved CV needs a quick refresh after the app update. Open the CV once, then export again.',
  de: 'Der gespeicherte Lebenslauf muss nach dem Update kurz aktualisiert werden. Öffnen Sie den Lebenslauf einmal und exportieren Sie erneut.',
  es: 'El CV guardado necesita actualizarse tras la actualización. Ábralo una vez y vuelva a exportar.',
  fr: 'Le CV enregistré doit être rafraîchi après la mise à jour. Ouvrez-le une fois, puis réexportez.',
  it: 'Il CV salvato va aggiornato dopo l’aggiornamento. Aprilo una volta e poi esporta di nuovo.',
  ar: 'تحتاج السيرة المحفوظة إلى تحديث سريع بعد تحديث التطبيق. افتحها مرة ثم أعد التصدير.',
  sr: 'Sačuvan CV treba kratko osveženje posle ažuriranja. Otvorite CV jednom, pa izvezite ponovo.',
  hr: 'Spremljeni CV treba kratko osvježenje nakon ažuriranja. Otvorite CV jednom, zatim ponovno izvezite.',
  ru: 'Сохранённое CV нужно кратко обновить после обновления приложения. Откройте CV один раз и экспортируйте снова.',
  'pt-BR': 'O currículo salvo precisa ser atualizado após a atualização. Abra-o uma vez e exporte novamente.',
  hi: 'ऐप अपडेट के बाद सहेजे गए CV को एक बार खोलें, फिर फिर से निर्यात करें।',
  ja: 'アップデート後、保存済みのCVを一度開いてから、もう一度エクスポートしてください。',
};

const FILE_SAVE_FAILED: Record<Locale, string> = {
  en: 'The file was generated but could not be saved on this device. Try again or choose another folder.',
  de: 'Die Datei wurde erzeugt, konnte auf diesem Gerät aber nicht gespeichert werden. Bitte erneut versuchen oder einen anderen Ordner wählen.',
  es: 'El archivo se generó, pero no se pudo guardar en este dispositivo. Inténtelo de nuevo o elija otra carpeta.',
  fr: 'Le fichier a été généré mais n’a pas pu être enregistré sur cet appareil. Réessayez ou choisissez un autre dossier.',
  it: 'Il file è stato generato ma non è stato possibile salvarlo su questo dispositivo. Riprova o scegli un’altra cartella.',
  ar: 'تم إنشاء الملف لكن تعذر حفظه على هذا الجهاز. حاول مرة أخرى أو اختر مجلدًا آخر.',
  sr: 'Fajl je generisan, ali nije sačuvan na uređaju. Pokušajte ponovo ili izaberite drugi folder.',
  hr: 'Datoteka je generirana, ali nije spremljena na uređaju. Pokušajte ponovno ili odaberite drugu mapu.',
  ru: 'Файл создан, но не удалось сохранить его на устройстве. Повторите попытку или выберите другую папку.',
  'pt-BR': 'O arquivo foi gerado, mas não pôde ser salvo neste dispositivo. Tente de novo ou escolha outra pasta.',
  hi: 'फ़ाइल बन गई, लेकिन इस डिवाइस पर सहेजी नहीं जा सकी। फिर कोशिश करें या दूसरा फ़ोल्डर चुनें।',
  ja: 'ファイルは生成されましたが、この端末に保存できませんでした。再試行するか、別のフォルダを選んでください。',
};

export class CvExportFailure extends Error {
  readonly reason: string;

  constructor(reason: string, message?: string) {
    super(message || reason);
    this.name = 'CvExportFailure';
    this.reason = reason;
  }
}

function isActualSummaryLanguageReason(reason: string): boolean {
  return /mixed_language_summary|mixed_locale_summary|unlocalized_skill_labels|wrong_language(?:_summary)?|summary:\s*English canonical dump blocked/i.test(reason);
}

function isTitleConflictReason(reason: string): boolean {
  return /summary_title_localization_conflict|forced-conflicting-title|invalid_occupational_title|duty_family_mismatch/i.test(reason);
}

function isExportWiringReason(reason: string): boolean {
  return /legacy_export_recovery_not_invoked|legacy_export_recovery_snapshot_overwritten|modern_minimal_stale_snapshot|modern_minimal_used_stale_snapshot|localized_display_projection_incomplete|summary_fact_set_used_stale_experience/i.test(reason);
}

function isSummaryFactsReason(reason: string): boolean {
  // Content-grounding only. Wiring/packaging/stale-snapshot bugs must not use this toast.
  return /summary_grounding_projection_failed|summary_proper_noun_rejected|summary_locale_state_mismatch|missing_provenance|migration_failure|recovery_failure|mixed_locale_projection|mixed_locale_field|summary_export_contract_mismatch|summary_recovery_projection_failed|summary_validation_failed_after_recovery|summary_authoritative_fact_set_empty|summary_fact_set_missing_recovered_duties|legacy_grounding_source_missing|legacy_grounding_recovery_failed|legacy_grounding_recovery_empty|legacy_export_recovery_no_safe_duties|legacy_grounding_recovery_not_invoked|legacy_grounding_recovery_overwritten/i.test(reason)
    && !isExportWiringReason(reason);
}

function isExperienceFactsReason(reason: string): boolean {
  return /legacy_export_recovery_no_safe_duties|legacy_grounding_source_missing|legacy_grounding_recovery_failed|legacy_grounding_recovery_empty|semantic_duty_fact_set_empty|legacy_user_origin_recovery_/i.test(reason);
}

function isLegacySnapshotReason(reason: string): boolean {
  return /legacy_runtime_snapshot_not_applied|legacy_runtime_snapshot_invalid|export_snapshot_stale|showAddress|regionSettings|invalid[_ ]?region|legacy_export_recovery_not_invoked|legacy_export_recovery_snapshot_overwritten|modern_minimal_stale_snapshot|localized_display_projection_incomplete/i.test(reason);
}

function isBlobGenerationReason(reason: string): boolean {
  return /pdf_blob_generation_failed|docx_blob_generation_failed|empty Blob|empty blob|DOCX generation produced an empty/i.test(reason);
}

function isAndroidSaveReason(reason: string): boolean {
  return /android_file_save_failed|SaveFailedError|File save failed|Native file save|Native SaveFile/i.test(reason);
}

/** Extract the exact internal export reason without losing structured `.reason`. */
export function extractCvExportFailureReason(err: unknown): string {
  if (err instanceof CvExportFailure) return err.reason;
  if (err && typeof err === 'object' && 'reason' in err) {
    const structured = String((err as { reason?: string }).reason || '').trim();
    if (structured) return structured;
  }
  if (err instanceof SaveFailedError) {
    return `android_file_save_failed: ${err.message}`;
  }
  if (err instanceof Error) {
    const message = err.message || err.name || '';
    if (/showAddress|regionSettings/i.test(message)) {
      return `legacy_runtime_snapshot_invalid: ${message}`;
    }
    if (/empty Blob|empty blob/i.test(message) && /pdf|PDF/i.test(message)) {
      return `pdf_blob_generation_failed: ${message}`;
    }
    if (/empty Blob|empty blob|empty DOCX|DOCX generation/i.test(message)) {
      return `docx_blob_generation_failed: ${message}`;
    }
    return message;
  }
  return '';
}

export function wrapCvExportFailure(err: unknown, fallbackReason: string): CvExportFailure {
  if (err instanceof CvExportFailure) return err;
  if (err && typeof err === 'object' && 'reason' in err) {
    const structured = String((err as { reason?: string }).reason || '').trim();
    if (structured) {
      return new CvExportFailure(
        structured,
        err instanceof Error ? err.message : structured,
      );
    }
  }
  const extracted = extractCvExportFailureReason(err);
  if (extracted) {
    return new CvExportFailure(extracted, err instanceof Error ? err.message : extracted);
  }
  return new CvExportFailure(
    fallbackReason,
    err instanceof Error ? err.message : fallbackReason,
  );
}

export function formatCvExportIntegrityToast(
  err: unknown,
  locale: Locale,
  kind: 'pdf' | 'docx',
): string {
  const reason = extractCvExportFailureReason(err);
  if (reason && isActualSummaryLanguageReason(reason)) {
    return SUMMARY_REGENERATE[locale] || SUMMARY_REGENERATE.en;
  }
  if (reason && isTitleConflictReason(reason)) {
    return TITLE_CONFLICT[locale] || TITLE_CONFLICT.en;
  }
  // Wiring/stale-snapshot failures must not look like Summary content errors.
  if (reason && isExportWiringReason(reason)) {
    return LEGACY_SNAPSHOT_REVIEW[locale] || LEGACY_SNAPSHOT_REVIEW.en;
  }
  if (reason && isExperienceFactsReason(reason)) {
    return EXPERIENCE_FACTS_REVIEW[locale] || EXPERIENCE_FACTS_REVIEW.en;
  }
  if (reason && isSummaryFactsReason(reason)) {
    return SUMMARY_FACTS_REVIEW[locale] || SUMMARY_FACTS_REVIEW.en;
  }
  if (reason && isLegacySnapshotReason(reason)) {
    return LEGACY_SNAPSHOT_REVIEW[locale] || LEGACY_SNAPSHOT_REVIEW.en;
  }
  if (reason && isAndroidSaveReason(reason)) {
    return FILE_SAVE_FAILED[locale] || FILE_SAVE_FAILED.en;
  }
  if (reason && isBlobGenerationReason(reason)) {
    return kind === 'pdf'
      ? (GENERIC_PDF[locale] || GENERIC_PDF.en)
      : (GENERIC_DOCX[locale] || GENERIC_DOCX.en);
  }
  // Truly unknown exceptions only.
  return kind === 'pdf'
    ? (GENERIC_PDF[locale] || GENERIC_PDF.en)
    : (GENERIC_DOCX[locale] || GENERIC_DOCX.en);
}
