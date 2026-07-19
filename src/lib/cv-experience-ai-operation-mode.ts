/**
 * Experience AI operation mode — thin adapter over the universal AI contract.
 * Generation fallback is title-grounded for arbitrary free-text occupations
 * (no occupation catalogue / per-title keyword branches).
 */
import type { Locale } from './i18n/translations';
import { formatExperienceBullets, splitExperienceBullets } from './cv-canonical-facts';
import { extractSourceDutyUnits } from './cv-source-fact-identity';
import {
  detectExperiencePersonMode,
  validateExperienceCvPerspective,
} from './cv-experience-perspective';
import { hasUnsupportedRegulatedPharmacyClaims } from './cv-experience-job-context';
import {
  aiOutputLooksGenericFillerOnly,
  countAiUnsafeInventionClaims,
  freeTextTitleStems,
  resolveAiOperationMode,
  textLooksRelevantToFreeTextTitle,
  toExperienceAiOperationModeCompat,
  type ExperienceAiOperationModeCompat,
} from './cv-ai-operation-contract';

export type ExperienceAiOperationMode = ExperienceAiOperationModeCompat;

export function resolveExperienceAiOperationMode(
  sourceDescription: string | null | undefined,
): ExperienceAiOperationMode {
  const units = extractSourceDutyUnits(sourceDescription || '');
  return toExperienceAiOperationModeCompat(
    resolveAiOperationMode({
      targetContent: sourceDescription,
      contentUnits: units,
    }),
  );
}

export function experienceAiSourceWasEmpty(sourceDescription: string | null | undefined): boolean {
  return resolveExperienceAiOperationMode(sourceDescription) === 'generate_from_job_context';
}

/** @deprecated Prefer freeTextTitleStems from cv-ai-operation-contract. */
export function titleRelevanceStems(position: string): string[] {
  return freeTextTitleStems(position);
}

export function generationTextLooksRelevantToTitle(
  text: string,
  position: string,
): boolean {
  return textLooksRelevantToFreeTextTitle(text, position);
}

export function generationLooksGenericFillerOnly(text: string): boolean {
  return aiOutputLooksGenericFillerOnly(text);
}

export type GenerationValidationResult = {
  ok: boolean;
  reason?: string;
  generatedBulletCount: number;
  relevanceValidationPassed: boolean;
  perspectiveValidationPassed: boolean;
  tenseValidationPassed: boolean;
  unsupportedClaimCount: number;
};

/**
 * Generation-mode postconditions — no source-fact coverage.
 */
export function validateExperienceGenerationOutput(
  text: string,
  options: {
    locale: Locale;
    position?: string;
    isPresent?: boolean;
  },
): GenerationValidationResult {
  const bullets = splitExperienceBullets(text || '').filter(Boolean);
  const generatedBulletCount = bullets.length;
  if (generatedBulletCount !== 3) {
    return {
      ok: false,
      reason: 'experience_generation_failed',
      generatedBulletCount,
      relevanceValidationPassed: false,
      perspectiveValidationPassed: false,
      tenseValidationPassed: false,
      unsupportedClaimCount: 0,
    };
  }
  const unique = new Set(bullets.map((b) => b.replace(/\s+/g, ' ').trim().toLowerCase()));
  if (unique.size < 3) {
    return {
      ok: false,
      reason: 'experience_generation_failed',
      generatedBulletCount,
      relevanceValidationPassed: false,
      perspectiveValidationPassed: false,
      tenseValidationPassed: false,
      unsupportedClaimCount: 0,
    };
  }
  if (generationLooksGenericFillerOnly(text)) {
    return {
      ok: false,
      reason: 'experience_generation_not_relevant',
      generatedBulletCount,
      relevanceValidationPassed: false,
      perspectiveValidationPassed: true,
      tenseValidationPassed: true,
      unsupportedClaimCount: 0,
    };
  }
  const relevanceValidationPassed = generationTextLooksRelevantToTitle(
    text,
    options.position || '',
  );
  if (!relevanceValidationPassed) {
    return {
      ok: false,
      reason: 'experience_generation_not_relevant',
      generatedBulletCount,
      relevanceValidationPassed: false,
      perspectiveValidationPassed: true,
      tenseValidationPassed: true,
      unsupportedClaimCount: 0,
    };
  }
  const perspective = validateExperienceCvPerspective(text, options.locale);
  if (!perspective.ok) {
    return {
      ok: false,
      reason: 'experience_generation_failed',
      generatedBulletCount,
      relevanceValidationPassed: true,
      perspectiveValidationPassed: false,
      tenseValidationPassed: true,
      unsupportedClaimCount: 0,
    };
  }
  const person = detectExperiencePersonMode(text, options.locale);
  const tenseValidationPassed = person !== 'first_singular';
  if (!tenseValidationPassed) {
    return {
      ok: false,
      reason: 'experience_generation_failed',
      generatedBulletCount,
      relevanceValidationPassed: true,
      perspectiveValidationPassed: perspective.ok,
      tenseValidationPassed: false,
      unsupportedClaimCount: 0,
    };
  }
  let unsupportedClaimCount = countAiUnsafeInventionClaims(text);
  if (hasUnsupportedRegulatedPharmacyClaims(text)) unsupportedClaimCount += 1;
  if (unsupportedClaimCount > 0) {
    return {
      ok: false,
      reason: 'experience_generation_unsafe_claims',
      generatedBulletCount,
      relevanceValidationPassed: true,
      perspectiveValidationPassed: true,
      tenseValidationPassed: true,
      unsupportedClaimCount,
    };
  }
  return {
    ok: true,
    generatedBulletCount,
    relevanceValidationPassed: true,
    perspectiveValidationPassed: true,
    tenseValidationPassed: true,
    unsupportedClaimCount: 0,
  };
}

function roleLabel(position: string, female: boolean, locale: Locale): string {
  const p = (position || '').trim();
  if (p) return p;
  if (locale === 'sr' || locale === 'hr') return female ? 'profesionalka' : 'profesionalac';
  if (locale === 'hi') return 'पेशेवर';
  if (locale === 'ar') return 'المهني';
  if (locale === 'ja') return '担当者';
  if (locale === 'de') return 'Fachkraft';
  if (locale === 'es') return 'profesional';
  if (locale === 'fr') return 'professionnel';
  if (locale === 'it') return 'professionista';
  if (locale === 'ru') return 'специалист';
  if (locale === 'pt-BR') return 'profissional';
  return 'Professional';
}

/**
 * Soft domain phrasing from free-text title — strips common role prefixes so
 * fallback bullets stay title-relevant without repeating the full title thrice.
 */
function softDomainFromTitle(position: string): string {
  const raw = (position || '').trim();
  if (!raw) return '';
  const stripped = raw.replace(
    /^(koordinator(?:ka)?|coordinator|specijalista|specialist|analitičar(?:ka)?|analyst|menadžer(?:ka)?|manager|saradnik(?:ca)?|assistant|responsável|coordenador(?:a)?|responsable)\s+/iu,
    '',
  ).trim();
  return stripped || raw;
}

/**
 * Deterministic job-context generation fallback (not source-preserving).
 * Grounds arbitrary free-text titles without occupation catalogues or keyword
 * branches. Separate from source-preserving enhancement fallback.
 */
export function buildJobContextGenerationFallback(options: {
  locale: Locale;
  gender?: string;
  position?: string;
  industry?: string;
  isPresent?: boolean;
}): string {
  const locale = options.locale;
  const present = options.isPresent !== false;
  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'ženski' || g === 'zenski';
  const role = roleLabel(options.position || '', female, locale);
  const domain = softDomainFromTitle(options.position || '') || role;
  void options.industry; // available for future soft framing; not a catalogue key

  if (locale === 'sr' || locale === 'hr') {
    return formatExperienceBullets(present
      ? [
        `Pregleda dokumentaciju povezanu sa svakodnevnim zadacima u oblasti ${domain} i proverava potpunost podataka.`,
        'Ažurira evidenciju i prati status dokumentacije u skladu sa potrebama radnog mesta.',
        'Koordiniše razmenu informacija sa kolegama radi pravovremenog kompletiranja dokumentacije.',
      ]
      : [
        female
          ? `Pregledala je dokumentaciju povezanu sa svakodnevnim zadacima u oblasti ${domain} i proveravala potpunost podataka.`
          : `Pregledao je dokumentaciju povezanu sa svakodnevnim zadacima u oblasti ${domain} i proveravao potpunost podataka.`,
        female
          ? 'Ažurirala je evidenciju i pratila status dokumentacije u skladu sa potrebama radnog mesta.'
          : 'Ažurirao je evidenciju i pratio status dokumentacije u skladu sa potrebama radnog mesta.',
        female
          ? 'Koordinisala je razmenu informacija sa kolegama radi pravovremenog kompletiranja dokumentacije.'
          : 'Koordinisao je razmenu informacija sa kolegama radi pravovremenog kompletiranja dokumentacije.',
      ]);
  }

  if (locale === 'en') {
    return formatExperienceBullets(present
      ? [
        `Review day-to-day records related to ${domain} and verify data completeness.`,
        'Update work documentation and track open items according to role needs.',
        'Coordinate information sharing with colleagues to complete documentation on time.',
      ]
      : [
        `Reviewed day-to-day records related to ${domain} and verified data completeness.`,
        'Updated work documentation and tracked open items according to role needs.',
        'Coordinated information sharing with colleagues to complete documentation on time.',
      ]);
  }

  if (locale === 'hi') {
    return formatExperienceBullets([
      `${domain} से जुड़े दैनिक रिकॉर्ड की समीक्षा करता है और डेटा की पूर्णता जाँचता है।`,
      'कार्य दस्तावेज़ अपडेट करता है और खुली मदों की स्थिति पर नज़र रखता है।',
      'सहयोगियों के साथ जानकारी का समन्वय करके दस्तावेज़ समय पर पूरा करता है।',
    ]);
  }

  if (locale === 'ar') {
    return formatExperienceBullets([
      `يراجع السجلات اليومية المرتبطة بـ ${domain} ويتحقق من اكتمال البيانات.`,
      'يحدّث وثائق العمل ويتابع البنود المفتوحة وفق احتياجات الدور.',
      'ينسّق تبادل المعلومات مع الزملاء لإكمال التوثيق في الوقت المناسب.',
    ]);
  }

  if (locale === 'ja') {
    return formatExperienceBullets([
      `${domain}に関する日常記録を確認し、データの完全性を検証する。`,
      '業務文書を更新し、未完了項目の状況を確認する。',
      '関係者と情報を調整し、文書を期限内に完了させる。',
    ]);
  }

  if (locale === 'de') {
    return formatExperienceBullets(present
      ? [
        `Prüft tägliche Unterlagen im Bereich ${domain} und kontrolliert die Vollständigkeit der Daten.`,
        'Aktualisiert Arbeitsdokumentation und verfolgt offene Vorgänge.',
        'Koordiniert den Informationsaustausch mit Kolleginnen und Kollegen zur fristgerechten Fertigstellung.',
      ]
      : [
        `Prüfte tägliche Unterlagen im Bereich ${domain} und kontrollierte die Vollständigkeit der Daten.`,
        'Aktualisierte Arbeitsdokumentation und verfolgte offene Vorgänge.',
        'Koordinierte den Informationsaustausch mit Kolleginnen und Kollegen zur fristgerechten Fertigstellung.',
      ]);
  }

  if (locale === 'es') {
    return formatExperienceBullets(present
      ? [
        `Revisa registros diarios relacionados con ${domain} y verifica la integridad de los datos.`,
        'Actualiza la documentación de trabajo y sigue asuntos abiertos.',
        'Coordina el intercambio de información con colegas para completar la documentación a tiempo.',
      ]
      : [
        `Revisó registros diarios relacionados con ${domain} y verificó la integridad de los datos.`,
        'Actualizó la documentación de trabajo y siguió asuntos abiertos.',
        'Coordinó el intercambio de información con colegas para completar la documentación a tiempo.',
      ]);
  }

  if (locale === 'fr') {
    return formatExperienceBullets(present
      ? [
        `Examine les dossiers quotidiens liés à ${domain} et vérifie l’exhaustivité des données.`,
        'Met à jour la documentation de travail et suit les dossiers ouverts.',
        'Coordonne l’échange d’informations avec les collègues pour finaliser la documentation.',
      ]
      : [
        `Examinait les dossiers quotidiens liés à ${domain} et vérifiait l’exhaustivité des données.`,
        'Mettait à jour la documentation de travail et suivait les dossiers ouverts.',
        'Coordonnait l’échange d’informations avec les collègues pour finaliser la documentation.',
      ]);
  }

  if (locale === 'it') {
    return formatExperienceBullets(present
      ? [
        `Esamina i registri quotidiani relativi a ${domain} e verifica la completezza dei dati.`,
        'Aggiorna la documentazione di lavoro e segue le pratiche aperte.',
        'Coordina lo scambio di informazioni con i colleghi per completare la documentazione.',
      ]
      : [
        `Esaminava i registri quotidiani relativi a ${domain} e verificava la completezza dei dati.`,
        'Aggiornava la documentazione di lavoro e seguiva le pratiche aperte.',
        'Coordinava lo scambio di informazioni con i colleghi per completare la documentazione.',
      ]);
  }

  if (locale === 'ru') {
    return formatExperienceBullets(present
      ? [
        `Проверяет повседневные записи по направлению ${domain} и полноту данных.`,
        'Обновляет рабочую документацию и отслеживает открытые пункты.',
        'Согласовывает обмен информацией с коллегами для своевременного завершения документации.',
      ]
      : [
        `Проверял повседневные записи по направлению ${domain} и полноту данных.`,
        'Обновлял рабочую документацию и отслеживал открытые пункты.',
        'Согласовывал обмен информацией с коллегами для своевременного завершения документации.',
      ]);
  }

  if (locale === 'pt-BR') {
    return formatExperienceBullets(present
      ? [
        `Revisa registros diários relacionados a ${domain} e verifica a completude dos dados.`,
        'Atualiza a documentação de trabalho e acompanha itens em aberto.',
        'Coordena a troca de informações com colegas para concluir a documentação no prazo.',
      ]
      : [
        `Revisava registros diários relacionados a ${domain} e verificava a completude dos dados.`,
        'Atualizava a documentação de trabalho e acompanhava itens em aberto.',
        'Coordenava a troca de informações com colegas para concluir a documentação no prazo.',
      ]);
  }

  return formatExperienceBullets(present
    ? [
      `Review day-to-day records related to ${domain} and verify data completeness.`,
      'Update work documentation and track open items according to role needs.',
      'Coordinate information sharing with colleagues to complete documentation on time.',
    ]
    : [
      `Reviewed day-to-day records related to ${domain} and verified data completeness.`,
      'Updated work documentation and tracked open items according to role needs.',
      'Coordinated information sharing with colleagues to complete documentation on time.',
    ]);
}
