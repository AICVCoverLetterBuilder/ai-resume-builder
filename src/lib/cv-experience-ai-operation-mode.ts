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
 * Deterministic job-context generation fallback (not source-preserving).
 * Embeds the free-text title into locale templates — no occupation catalogue
 * and no per-title keyword branches.
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
  void options.industry; // available for future soft framing; not a catalogue key

  if (locale === 'sr' || locale === 'hr') {
    return formatExperienceBullets(present
      ? [
        `Obavlja svakodnevne zadatke u ulozi ${role} uz proveru tačnosti podataka.`,
        `Ažurira evidenciju i prati status stavki vezanih za rad kao ${role}.`,
        'Koordiniše razmenu informacija sa kolegama radi blagovremenog zatvaranja zadataka.',
      ]
      : [
        female
          ? `Obavljala je svakodnevne zadatke u ulozi ${role} uz proveru tačnosti podataka.`
          : `Obavljao je svakodnevne zadatke u ulozi ${role} uz proveru tačnosti podataka.`,
        female
          ? `Ažurirala je evidenciju i pratila status stavki vezanih za rad kao ${role}.`
          : `Ažurirao je evidenciju i pratio status stavki vezanih za rad kao ${role}.`,
        female
          ? 'Koordinisala je razmenu informacija sa kolegama radi blagovremenog zatvaranja zadataka.'
          : 'Koordinisao je razmenu informacija sa kolegama radi blagovremenog zatvaranja zadataka.',
      ]);
  }

  if (locale === 'en') {
    return formatExperienceBullets(present
      ? [
        `Perform day-to-day duties as ${role} with attention to data accuracy.`,
        `Update work records and track open items related to the ${role} role.`,
        'Coordinate information sharing with colleagues to close tasks on time.',
      ]
      : [
        `Performed day-to-day duties as ${role} with attention to data accuracy.`,
        `Updated work records and tracked open items related to the ${role} role.`,
        'Coordinated information sharing with colleagues to close tasks on time.',
      ]);
  }

  if (locale === 'hi') {
    return formatExperienceBullets([
      `भूमिका ${role} में दैनिक कार्य सटीकता के साथ पूरा करता है।`,
      `${role} से जुड़े कार्य रिकॉर्ड अपडेट करता है और खुली मदों की स्थिति पर नज़र रखता है।`,
      'कार्य समय पर पूरा करने के लिए सहयोगियों के साथ जानकारी का समन्वय करता है।',
    ]);
  }

  if (locale === 'ar') {
    return formatExperienceBullets([
      `ينجز المهام اليومية في دور ${role} مع التحقق من دقة البيانات.`,
      `يحدّث سجلات العمل المرتبطة بدور ${role} ويتابع البنود المفتوحة.`,
      'ينسّق تبادل المعلومات مع الزملاء لإغلاق المهام في الوقت المناسب.',
    ]);
  }

  if (locale === 'ja') {
    return formatExperienceBullets([
      `${role}として日常業務を正確に遂行する。`,
      `${role}に関する業務記録を更新し、未完了項目の状況を確認する。`,
      '関係者と情報を調整し、業務を期限内に完了させる。',
    ]);
  }

  if (locale === 'de') {
    return formatExperienceBullets(present
      ? [
        `Erledigt tägliche Aufgaben als ${role} und prüft die Datenqualität.`,
        `Aktualisiert Arbeitsnachweise für die Rolle ${role} und verfolgt offene Vorgänge.`,
        'Koordiniert den Informationsaustausch mit Kolleginnen und Kollegen.',
      ]
      : [
        `Erledigte tägliche Aufgaben als ${role} und prüfte die Datenqualität.`,
        `Aktualisierte Arbeitsnachweise für die Rolle ${role} und verfolgte offene Vorgänge.`,
        'Koordinierte den Informationsaustausch mit Kolleginnen und Kollegen.',
      ]);
  }

  if (locale === 'es') {
    return formatExperienceBullets(present
      ? [
        `Realiza tareas diarias como ${role} y verifica la exactitud de los datos.`,
        `Actualiza registros de trabajo del rol ${role} y sigue asuntos abiertos.`,
        'Coordina el intercambio de información con colegas para cerrar tareas a tiempo.',
      ]
      : [
        `Realizó tareas diarias como ${role} y verificó la exactitud de los datos.`,
        `Actualizó registros de trabajo del rol ${role} y siguió asuntos abiertos.`,
        'Coordinó el intercambio de información con colegas para cerrar tareas a tiempo.',
      ]);
  }

  if (locale === 'fr') {
    return formatExperienceBullets(present
      ? [
        `Assure les tâches quotidiennes en tant que ${role} avec contrôle de l’exactitude des données.`,
        `Met à jour les registres liés au rôle de ${role} et suit les dossiers ouverts.`,
        'Coordonne l’échange d’informations avec les collègues pour clôturer les tâches.',
      ]
      : [
        `Assurait les tâches quotidiennes en tant que ${role} avec contrôle de l’exactitude des données.`,
        `Mettait à jour les registres liés au rôle de ${role} et suivait les dossiers ouverts.`,
        'Coordonnait l’échange d’informations avec les collègues pour clôturer les tâches.',
      ]);
  }

  if (locale === 'it') {
    return formatExperienceBullets(present
      ? [
        `Svolge i compiti quotidiani come ${role} verificando l’accuratezza dei dati.`,
        `Aggiorna i registri relativi al ruolo di ${role} e segue le pratiche aperte.`,
        'Coordina lo scambio di informazioni con i colleghi per chiudere le attività.',
      ]
      : [
        `Svolgeva i compiti quotidiani come ${role} verificando l’accuratezza dei dati.`,
        `Aggiornava i registri relativi al ruolo di ${role} e seguiva le pratiche aperte.`,
        'Coordinava lo scambio di informazioni con i colleghi per chiudere le attività.',
      ]);
  }

  if (locale === 'ru') {
    return formatExperienceBullets(present
      ? [
        `Выполняет повседневные задачи в роли ${role} с проверкой точности данных.`,
        `Обновляет рабочие записи по роли ${role} и отслеживает открытые пункты.`,
        'Согласовывает обмен информацией с коллегами для своевременного закрытия задач.',
      ]
      : [
        `Выполнял повседневные задачи в роли ${role} с проверкой точности данных.`,
        `Обновлял рабочие записи по роли ${role} и отслеживал открытые пункты.`,
        'Согласовывал обмен информацией с коллегами для своевременного закрытия задач.',
      ]);
  }

  if (locale === 'pt-BR') {
    return formatExperienceBullets(present
      ? [
        `Executa tarefas diárias como ${role} com verificação da precisão dos dados.`,
        `Atualiza registros do papel ${role} e acompanha itens em aberto.`,
        'Coordena a troca de informações com colegas para fechar tarefas no prazo.',
      ]
      : [
        `Executava tarefas diárias como ${role} com verificação da precisão dos dados.`,
        `Atualizava registros do papel ${role} e acompanhava itens em aberto.`,
        'Coordenava a troca de informações com colegas para fechar tarefas no prazo.',
      ]);
  }

  return formatExperienceBullets(present
    ? [
      `Perform day-to-day duties as ${role} with attention to accuracy.`,
      `Update work records for the ${role} role and track open items.`,
      'Coordinate information sharing with colleagues to complete tasks.',
    ]
    : [
      `Performed day-to-day duties as ${role} with attention to accuracy.`,
      `Updated work records for the ${role} role and tracked open items.`,
      'Coordinated information sharing with colleagues to complete tasks.',
    ]);
}
