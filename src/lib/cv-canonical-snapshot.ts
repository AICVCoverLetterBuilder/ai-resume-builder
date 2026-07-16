/**
 * Locale-aware canonical CV snapshot, revisions, projections, and legacy migration.
 * Creative Artistic fact-ID lock remains grounded on this snapshot — never assumes English.
 */
import type { CVData, WorkExperience } from './types';
import type { Locale } from './i18n/translations';
import {
  classifyDutyCategory,
  formatExperienceBullets,
  splitExperienceBullets,
  type CvDutyCategory,
} from './cv-canonical-facts';
import { localizeCvLanguageLevel } from './cv-language-levels';
import { validateSummaryCompleteness } from './cv-semantic-fidelity';
import {
  buildLocalizedSummaryProvenance,
  textMatchesRequestedFieldLocale,
  type LocalizedSummaryProvenance,
} from './cv-field-locale-integrity';

export type CanonicalCreatedFrom =
  | 'user_structured_input'
  | 'validated_ai_result'
  | 'legacy_migration';

export type CanonicalState = 'valid' | 'needs_rebuild';

export type CanonicalExperienceBullet = {
  factId: string;
  sourceText: string;
  semanticCategory: CvDutyCategory;
  order: number;
};

export type CanonicalExperienceSnapshot = {
  experienceId: string;
  role: string;
  company: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  bullets: CanonicalExperienceBullet[];
};

export type CanonicalCvSnapshot = {
  canonicalSummary: string;
  canonicalExperiences: CanonicalExperienceSnapshot[];
  /** Actual locale of the validated source content — never inferred as English by default. */
  canonicalLocale: Locale;
  canonicalRevision: number;
  canonicalSourceHash: string;
  canonicalCreatedFrom: CanonicalCreatedFrom;
  canonicalState: CanonicalState;
};

export type LocalizedProjectionBullet = {
  factId: string;
  semanticCategory: CvDutyCategory;
  localizedText: string;
  order: number;
};

export type LocalizedProjectionExperience = {
  experienceId: string;
  role: string;
  company: string;
  bullets: LocalizedProjectionBullet[];
};

export type ValidatedLocalizedCvProjection = {
  /** Immutable id shared by PDF and DOCX for one export action. */
  projectionId: string;
  requestedLocale: Locale;
  canonicalLocale: Locale;
  canonicalRevision: number;
  canonicalSourceHash: string;
  localizedSummary: string;
  localizedSummaryProvenance: LocalizedSummaryProvenance;
  localizedExperiences: LocalizedProjectionExperience[];
  localizedEducation: CVData['education'];
  localizedSkills: string[];
  localizedLanguageLevels: Array<{ name: string; level: string }>;
  validationStatus: 'passed' | 'repaired' | 'fallback';
  /** Precomputed duration — PDF/DOCX must not recalculate independently. */
  experienceDurationSnapshot?: import('./cv-experience-duration').ExperienceDurationSnapshot;
  gender?: string;
};

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function computeCanonicalSourceHash(parts: {
  canonicalLocale: Locale;
  canonicalSummary: string;
  canonicalExperiences: CanonicalExperienceSnapshot[];
  skills?: string[];
  education?: Array<{ degree: string; school: string; description?: string }>;
  languages?: Array<{ name: string; level: string }>;
}): string {
  return fnv1aHex(stableStringify({
    locale: parts.canonicalLocale,
    summary: parts.canonicalSummary.trim(),
    experiences: parts.canonicalExperiences.map((exp) => ({
      id: exp.experienceId,
      role: exp.role,
      company: exp.company,
      startDate: exp.startDate || '',
      endDate: exp.endDate || '',
      current: Boolean(exp.current),
      bullets: exp.bullets.map((b) => ({
        factId: b.factId,
        sourceText: b.sourceText,
        semanticCategory: b.semanticCategory,
        order: b.order,
      })),
    })),
    skills: parts.skills || [],
    education: parts.education || [],
    languages: parts.languages || [],
  }));
}

export function buildProjectionId(projection: Omit<ValidatedLocalizedCvProjection, 'projectionId'>): string {
  return `proj-${fnv1aHex(stableStringify({
    requestedLocale: projection.requestedLocale,
    canonicalLocale: projection.canonicalLocale,
    canonicalRevision: projection.canonicalRevision,
    canonicalSourceHash: projection.canonicalSourceHash,
    localizedSummary: projection.localizedSummary,
    localizedSummaryProvenance: projection.localizedSummaryProvenance,
    localizedExperiences: projection.localizedExperiences,
    localizedEducation: projection.localizedEducation,
    localizedSkills: projection.localizedSkills,
    localizedLanguageLevels: projection.localizedLanguageLevels,
    validationStatus: projection.validationStatus,
    experienceDurationSnapshot: projection.experienceDurationSnapshot || null,
    gender: projection.gender || '',
  }))}`;
}

function contentMatchesLocaleHint(text: string, hint: Locale): boolean {
  const detected = detectContentLocale(text);
  if (!detected) {
    // Hint is acceptable only when script family is compatible (Latin hint for Latin text).
    if (hint === 'ar') return /[\u0600-\u06FF]/.test(text);
    if (hint === 'hi') return /[\u0900-\u097F]/.test(text);
    if (hint === 'ja') return /[\u3040-\u30ff\u3400-\u9fff]/.test(text);
    if (hint === 'ru') return /[\u0400-\u04FF]/.test(text);
    if (hint === 'en' || hint === 'de' || hint === 'es' || hint === 'fr' || hint === 'it'
      || hint === 'sr' || hint === 'hr' || hint === 'pt-BR') {
      return /[A-Za-zÀ-ÖØ-öø-ÿŠšŽžĆćČčĐđ]/.test(text) && !/[\u0900-\u097F\u0600-\u06FF\u0400-\u04FF]/.test(text);
    }
    return false;
  }
  return detected === hint;
}

/** Detect content locale from script / lexicon. Returns null when ambiguous. */
export function detectContentLocale(text: string): Locale | null {
  const raw = (text || '').normalize('NFKC');
  if (!raw.trim()) return null;

  const letters = raw.replace(/\s+/g, '');
  if (!letters) return null;

  const dev = (raw.match(/[\u0900-\u097F]/g) || []).length;
  const arb = (raw.match(/[\u0600-\u06FF]/g) || []).length;
  const cyr = (raw.match(/[\u0400-\u04FF]/g) || []).length;
  const jap = (raw.match(/[\u3040-\u30ff\u3400-\u9fff]/g) || []).length;
  const latin = (raw.match(/[A-Za-zÀ-ÖØ-öø-ÿŠšŽžĆćČčĐđ]/g) || []).length;
  const total = Math.max(1, dev + arb + cyr + jap + latin);

  if (dev / total > 0.25) return 'hi';
  if (arb / total > 0.25) return 'ar';
  if (jap / total > 0.2) return 'ja';
  if (cyr / total > 0.25) {
    if (/\b(и\s+опыт|бармен|коктейл)/iu.test(raw)) return 'ru';
    return 'ru';
  }

  const lower = raw.toLowerCase();
  if (/\b(pripremio|pripremila|odžavan|gostima|zalihama|iskusan|iskusna|koktele)\b/iu.test(lower)
    || /[čćžšđ]/i.test(raw) && /\b(gost|zalih|higijen|koktel)\b/iu.test(lower)) {
    return 'sr';
  }
  if (/\b(pripremio|iskusan|gostima)\b/iu.test(lower) && /\b(hrvat|zagreb)\b/iu.test(lower)) return 'hr';
  if (/\b(Erfahrung|Tätigkeit|verantwortlich|Kunden)\b/u.test(raw)) return 'de';
  if (/\b(experiencia|clientes|bebidas|atención)\b/iu.test(lower)) return 'es';
  if (/\b(expérience|clients|boissons|accueil)\b/iu.test(lower)) return 'fr';
  if (/\b(esperienza|clienti|bevande|ospiti)\b/iu.test(lower)) return 'it';
  if (/\b(experiência|clientes|bebidas|atendimento)\b/iu.test(lower)) return 'pt-BR';
  if (/\b(prepared|served|customer|inventory|hygiene|bartender|experience)\b/i.test(lower)
    && latin / total > 0.6) {
    return 'en';
  }

  // Single-script Latin without clear lexicon → ambiguous.
  if (latin / total > 0.8) return null;
  return null;
}

function aggregateCvText(cv: CVData): string {
  return [
    cv.summary,
    cv.canonicalSummary,
    cv.personal?.jobTitle,
    ...cv.experience.flatMap((e) => [e.position, e.company, e.description, e.canonicalDescription]),
    ...cv.education.flatMap((e) => [e.degree, e.school, e.description]),
    ...cv.skills,
  ].filter(Boolean).join('\n');
}

function isTruncatedHindiStub(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  return (
    /मैंअप/u.test(t)
    || /आगेचलकर\s*मैंअप/u.test(t)
    || /आगेचलकर/u.test(t) && t.length < 80
    || /(?:करते|रहते|होते)\s*हु\s*$/u.test(t)
  );
}

function experienceDescriptionForCanonical(exp: WorkExperience): string {
  return (exp.canonicalDescription || exp.description || '').trim();
}

export function buildExperienceSnapshotFromText(
  exp: WorkExperience,
  experienceIndex: number,
): CanonicalExperienceSnapshot {
  const bullets = splitExperienceBullets(experienceDescriptionForCanonical(exp)).map((sourceText, order) => ({
    factId: `experience-${experienceIndex}-bullet-${order}`,
    sourceText,
    semanticCategory: classifyDutyCategory(sourceText),
    order,
  }));
  return {
    experienceId: exp.id,
    role: exp.position || '',
    company: exp.company || '',
    startDate: exp.startDate || undefined,
    endDate: exp.endDate || undefined,
    current: exp.isPresent,
    bullets,
  };
}

export function buildCanonicalSnapshotFromCv(
  cv: CVData,
  options: {
    canonicalLocale: Locale;
    createdFrom: CanonicalCreatedFrom;
    revision?: number;
    state?: CanonicalState;
  },
): CanonicalCvSnapshot {
  const summary = (cv.canonicalSummary || cv.summary || '').trim();
  const experiences = (cv.experience || []).map((exp, i) => buildExperienceSnapshotFromText(exp, i));
  const base = {
    canonicalSummary: summary,
    canonicalExperiences: experiences,
    canonicalLocale: options.canonicalLocale,
    canonicalRevision: options.revision ?? 1,
    canonicalCreatedFrom: options.createdFrom,
    canonicalState: options.state ?? 'valid',
  };
  return {
    ...base,
    canonicalSourceHash: computeCanonicalSourceHash({
      ...base,
      skills: cv.skills,
      education: cv.education.map((e) => ({
        degree: e.degree,
        school: e.school,
        description: e.description,
      })),
      languages: cv.languages,
    }),
  };
}

function contentEligibleForValidCanonical(cv: CVData, locale: Locale): boolean {
  const summary = (cv.canonicalSummary || cv.summary || '').trim();
  if (isTruncatedHindiStub(summary)) return false;
  if (summary && !validateSummaryCompleteness(summary, { locale }).valid) return false;

  for (const exp of cv.experience || []) {
    const desc = experienceDescriptionForCanonical(exp);
    if (!desc) continue;
    // Internal consistency: each bullet must classify without being empty noise.
    const bullets = splitExperienceBullets(desc);
    if (bullets.some((b) => !b.trim())) return false;
  }
  return true;
}

function withSyncedLegacyFields(cv: CVData, snapshot: CanonicalCvSnapshot): CVData {
  const byId = new Map(snapshot.canonicalExperiences.map((e) => [e.experienceId, e]));
  return {
    ...cv,
    canonicalSummary: snapshot.canonicalSummary,
    experience: (cv.experience || []).map((exp) => {
      const snap = byId.get(exp.id);
      if (!snap) return exp;
      return {
        ...exp,
        position: snap.role || exp.position,
        company: snap.company || exp.company,
        startDate: snap.startDate ?? exp.startDate,
        endDate: snap.endDate ?? exp.endDate,
        isPresent: snap.current ?? exp.isPresent,
        canonicalDescription: formatExperienceBullets(snap.bullets.map((b) => b.sourceText)),
      };
    }),
    canonicalSnapshot: snapshot,
  };
}

function markProjectionsStale(cv: CVData): CVData {
  if (!cv.localizedProjections || Object.keys(cv.localizedProjections).length === 0) return cv;
  // Keep stored projections for display recovery, but they fail export freshness checks.
  return { ...cv, localizedProjections: { ...cv.localizedProjections } };
}

/**
 * One-time, idempotent, non-destructive legacy migration.
 * Never invents an English canonical snapshot for non-English content.
 */
export function migrateLegacyCanonicalCv(
  cv: CVData,
  options?: { localeHint?: Locale },
): CVData {
  const existing = cv.canonicalSnapshot;
  if (existing?.canonicalState === 'valid' && existing.canonicalSourceHash && existing.canonicalRevision >= 1) {
    return cv;
  }
  if (existing?.canonicalState === 'needs_rebuild') {
    return cv;
  }

  const text = aggregateCvText(cv);
  const hasContent = Boolean(
    (cv.summary || cv.canonicalSummary || '').trim()
    || cv.experience.some((e) => (e.description || e.canonicalDescription || '').trim()),
  );
  if (!hasContent) {
    return cv;
  }

  const detected = detectContentLocale(text);
  const summary = (cv.canonicalSummary || cv.summary || '').trim();

  if (isTruncatedHindiStub(summary) || (detected === 'hi' && isTruncatedHindiStub(summary))) {
    const locale: Locale = detected === 'hi' ? 'hi' : (options?.localeHint === 'hi' ? 'hi' : 'hi');
    const snapshot = buildCanonicalSnapshotFromCv(cv, {
      canonicalLocale: locale,
      createdFrom: 'legacy_migration',
      revision: 0,
      state: 'needs_rebuild',
    });
    // Preserve display fields unchanged — only attach snapshot metadata.
    return {
      ...cv,
      canonicalSnapshot: snapshot,
    };
  }

  // Ambiguous or invalid: preserve user data, mark needs_rebuild, never invent English.
  if (!detected || !contentEligibleForValidCanonical(cv, detected)) {
    const rebuildLocale: Locale | null = detected
      ?? (options?.localeHint && contentMatchesLocaleHint(text, options.localeHint)
        ? options.localeHint
        : null);

    if (!rebuildLocale) {
      // Ambiguous provenance — attach needs_rebuild metadata without claiming English.
      return {
        ...cv,
        canonicalSnapshot: {
          canonicalSummary: summary,
          canonicalExperiences: (cv.experience || []).map((exp, i) => buildExperienceSnapshotFromText(exp, i)),
          // Placeholder only when truly ambiguous; state=needs_rebuild means exporters must fail closed.
          canonicalLocale: options?.localeHint || 'en',
          canonicalRevision: 0,
          canonicalSourceHash: '',
          canonicalCreatedFrom: 'legacy_migration',
          canonicalState: 'needs_rebuild',
        },
      };
    }

    const snapshot = buildCanonicalSnapshotFromCv(cv, {
      canonicalLocale: rebuildLocale,
      createdFrom: 'legacy_migration',
      revision: 0,
      state: 'needs_rebuild',
    });
    return { ...cv, canonicalSnapshot: snapshot };
  }

  const locale = detected;

  // Reliable structured content → valid snapshot once.
  const synced = {
    ...cv,
    canonicalSummary: summary || cv.summary,
    experience: cv.experience.map((exp) => ({
      ...exp,
      canonicalDescription: experienceDescriptionForCanonical(exp) || exp.description,
    })),
  };
  const snapshot = buildCanonicalSnapshotFromCv(synced, {
    canonicalLocale: locale,
    createdFrom: 'legacy_migration',
    revision: 1,
    state: 'valid',
  });
  return withSyncedLegacyFields(synced, snapshot);
}

/** Create or refresh canonical from first validated structured source (user or AI). */
export function sealCanonicalFromValidatedSource(
  cv: CVData,
  options: {
    locale: Locale;
    createdFrom: CanonicalCreatedFrom;
    /** When true, replace/revise even if a snapshot exists (direct source edit / accepted AI). */
    revise?: boolean;
  },
): CVData {
  const existing = cv.canonicalSnapshot;
  if (existing?.canonicalState === 'valid' && !options.revise) {
    // Locale switching / projection activation must not recreate snapshot.
    return cv;
  }

  if (!contentEligibleForValidCanonical(cv, options.locale)) {
    const snapshot = buildCanonicalSnapshotFromCv(cv, {
      canonicalLocale: options.locale,
      createdFrom: options.createdFrom,
      revision: existing?.canonicalRevision ?? 0,
      state: 'needs_rebuild',
    });
    return { ...cv, canonicalSnapshot: snapshot };
  }

  const nextRevision = options.revise
    ? (existing?.canonicalRevision ?? 0) + 1
    : (existing?.canonicalRevision && existing.canonicalRevision > 0 ? existing.canonicalRevision : 1);

  const synced = {
    ...cv,
    canonicalSummary: (cv.canonicalSummary || cv.summary || '').trim(),
    experience: cv.experience.map((exp) => ({
      ...exp,
      canonicalDescription: experienceDescriptionForCanonical(exp),
    })),
  };
  const snapshot = buildCanonicalSnapshotFromCv(synced, {
    canonicalLocale: existing?.canonicalState === 'valid' && !options.revise
      ? existing.canonicalLocale
      : (existing?.canonicalState === 'valid' ? existing.canonicalLocale : options.locale),
    createdFrom: options.createdFrom,
    revision: nextRevision,
    state: 'valid',
  });
  // Preserve original canonicalLocale on revise.
  if (existing?.canonicalState === 'valid' && options.revise) {
    snapshot.canonicalLocale = existing.canonicalLocale;
  }
  return markProjectionsStale(withSyncedLegacyFields(synced, snapshot));
}

export function isProjectionFresh(
  projection: ValidatedLocalizedCvProjection | undefined,
  snapshot: CanonicalCvSnapshot | undefined,
): boolean {
  if (!projection || !snapshot || snapshot.canonicalState !== 'valid') return false;
  return (
    projection.canonicalRevision === snapshot.canonicalRevision
    && projection.canonicalSourceHash === snapshot.canonicalSourceHash
    && projection.localizedSummaryProvenance?.requestedLocale === projection.requestedLocale
    && projection.localizedSummaryProvenance?.localizedLocale === projection.requestedLocale
    && projection.localizedSummaryProvenance?.canonicalLocale === snapshot.canonicalLocale
    && projection.localizedSummaryProvenance?.canonicalRevision === snapshot.canonicalRevision
    && projection.localizedSummaryProvenance?.canonicalSourceHash === snapshot.canonicalSourceHash
  );
}

export function applyCanonicalSummaryEdit(cv: CVData, summary: string, uiLocale: Locale): CVData {
  const next = {
    ...cv,
    summary,
    summaryOrigin: 'user' as const,
    updatedAt: new Date().toISOString(),
  };
  const snap = cv.canonicalSnapshot;
  if (!snap || snap.canonicalState !== 'valid') {
    const soft = { ...next, canonicalSummary: summary };
    if (!contentEligibleForValidCanonical(soft, uiLocale)) return soft;
    return sealCanonicalFromValidatedSource(soft, {
      locale: uiLocale,
      createdFrom: 'user_structured_input',
      revise: true,
    });
  }
  if (uiLocale === snap.canonicalLocale) {
    const soft = { ...next, canonicalSummary: summary };
    // Mid-typing incomplete text must not destroy a valid snapshot or invent needs_rebuild.
    if (!contentEligibleForValidCanonical(soft, uiLocale)) return soft;
    return sealCanonicalFromValidatedSource(soft, {
      locale: snap.canonicalLocale,
      createdFrom: 'user_structured_input',
      revise: true,
    });
  }
  // Editing a non-canonical locale updates display only (not canonical).
  return next;
}

export function applyCanonicalExperienceEdit(
  cv: CVData,
  experienceId: string,
  field: string,
  value: string | boolean,
  uiLocale: Locale,
): CVData {
  const structural = field === 'position' || field === 'company' || field === 'startDate'
    || field === 'endDate' || field === 'isPresent';
  const nextExp = cv.experience.map((e) => {
    if (e.id !== experienceId) return e;
    if (field === 'description' && typeof value === 'string') {
      const snap = cv.canonicalSnapshot;
      const syncCanonical = !snap
        || snap.canonicalState !== 'valid'
        || uiLocale === snap.canonicalLocale;
      return {
        ...e,
        description: value,
        ...(syncCanonical ? { canonicalDescription: value } : {}),
      };
    }
    return { ...e, [field]: value };
  });
  const next = { ...cv, experience: nextExp, updatedAt: new Date().toISOString() };
  const snap = cv.canonicalSnapshot;

  if (structural) {
    return sealCanonicalFromValidatedSource(next, {
      locale: snap?.canonicalLocale || uiLocale,
      createdFrom: 'user_structured_input',
      revise: Boolean(snap?.canonicalState === 'valid'),
    });
  }

  if (field === 'description') {
    if (!snap || snap.canonicalState !== 'valid' || uiLocale === snap.canonicalLocale) {
      if (!contentEligibleForValidCanonical(next, snap?.canonicalLocale || uiLocale)) {
        return next;
      }
      return sealCanonicalFromValidatedSource(next, {
        locale: snap?.canonicalLocale || uiLocale,
        createdFrom: 'user_structured_input',
        revise: Boolean(snap?.canonicalState === 'valid'),
      });
    }
  }
  return next;
}

export function applyCanonicalSkillsLanguagesEducationEdit(
  cv: CVData,
  patch: Partial<Pick<CVData, 'skills' | 'languages' | 'education'>>,
): CVData {
  const next = { ...cv, ...patch, updatedAt: new Date().toISOString() };
  if (!cv.canonicalSnapshot || cv.canonicalSnapshot.canonicalState !== 'valid') return next;
  return sealCanonicalFromValidatedSource(next, {
    locale: cv.canonicalSnapshot.canonicalLocale,
    createdFrom: 'user_structured_input',
    revise: true,
  });
}

export function acceptValidatedAiContent(
  cv: CVData,
  options: {
    locale: Locale;
    summary?: string;
    experienceId?: string;
    description?: string;
    summaryOrigin?: import('./types').CvSummaryOrigin;
  },
): CVData {
  let next = { ...cv };
  if (options.summary !== undefined) {
    if (!textMatchesRequestedFieldLocale(options.summary, options.locale, 'summary')) {
      return cv;
    }
    const snap = cv.canonicalSnapshot;
    const becomesCanonical = !snap
      || snap.canonicalState !== 'valid'
      || options.locale === snap.canonicalLocale;
    next = {
      ...next,
      summary: options.summary,
      summaryOrigin: options.summaryOrigin || 'ai_generated',
      ...(becomesCanonical ? { canonicalSummary: options.summary } : {}),
    };
  }
  if (options.experienceId && options.description !== undefined) {
    next = {
      ...next,
      experience: next.experience.map((e) => {
        if (e.id !== options.experienceId) return e;
        const snap = cv.canonicalSnapshot;
        const becomesCanonical = !snap
          || snap.canonicalState !== 'valid'
          || options.locale === snap.canonicalLocale;
        return {
          ...e,
          description: options.description!,
          ...(becomesCanonical
            ? { canonicalDescription: e.canonicalDescription?.trim() || options.description! }
            : {}),
        };
      }),
    };
  }

  const snap = cv.canonicalSnapshot;
  const reviseCanonical = !snap
    || snap.canonicalState !== 'valid'
    || options.locale === snap.canonicalLocale;

  if (reviseCanonical) {
    return sealCanonicalFromValidatedSource(next, {
      locale: snap?.canonicalLocale || options.locale,
      createdFrom: 'validated_ai_result',
      revise: Boolean(snap?.canonicalState === 'valid'),
    });
  }
  return next;
}

export function storeLocalizedProjection(
  cv: CVData,
  projection: ValidatedLocalizedCvProjection,
): CVData {
  return {
    ...cv,
    localizedProjections: {
      ...(cv.localizedProjections || {}),
      [projection.requestedLocale]: projection,
    },
  };
}

export function buildProjectionFromLocalizedCv(
  sourceCv: CVData,
  localizedCv: CVData,
  requestedLocale: Locale,
  validationStatus: ValidatedLocalizedCvProjection['validationStatus'],
): ValidatedLocalizedCvProjection {
  const snapshot = sourceCv.canonicalSnapshot
    || buildCanonicalSnapshotFromCv(sourceCv, {
      canonicalLocale: detectContentLocale(aggregateCvText(sourceCv)) || requestedLocale,
      createdFrom: 'user_structured_input',
      revision: 1,
      state: 'valid',
    });

  const experiences: LocalizedProjectionExperience[] = (localizedCv.experience || []).map((exp, experienceIndex) => {
    const snapExp = snapshot.canonicalExperiences.find((e) => e.experienceId === exp.id)
      || buildExperienceSnapshotFromText(
        {
          ...exp,
          description: exp.canonicalDescription || exp.description,
          canonicalDescription: exp.canonicalDescription || exp.description,
        },
        experienceIndex,
      );
    const localizedBullets = splitExperienceBullets(exp.description || '');
    return {
      experienceId: exp.id,
      role: exp.position || snapExp.role,
      company: exp.company || snapExp.company,
      bullets: snapExp.bullets.map((b, i) => ({
        factId: b.factId,
        semanticCategory: b.semanticCategory,
        localizedText: localizedBullets[i] || b.sourceText,
        order: b.order,
      })),
    };
  });

  const withoutId = {
    requestedLocale,
    canonicalLocale: snapshot.canonicalLocale,
    canonicalRevision: snapshot.canonicalRevision,
    canonicalSourceHash: snapshot.canonicalSourceHash,
    localizedSummary: localizedCv.summary || '',
    localizedSummaryProvenance: buildLocalizedSummaryProvenance({
      requestedLocale,
      canonicalLocale: snapshot.canonicalLocale,
      canonicalRevision: snapshot.canonicalRevision,
      canonicalSourceHash: snapshot.canonicalSourceHash,
      origin: localizedCv.summaryOrigin,
    }),
    localizedExperiences: experiences,
    localizedEducation: localizedCv.education || [],
    localizedSkills: localizedCv.skills || [],
    localizedLanguageLevels: (localizedCv.languages || []).map((lang) => ({
      name: lang.name,
      level: localizeCvLanguageLevel(lang.level, requestedLocale),
    })),
    validationStatus,
  };
  return {
    ...withoutId,
    projectionId: buildProjectionId(withoutId),
  };
}

export function applyProjectionToCv(cv: CVData, projection: ValidatedLocalizedCvProjection): CVData {
  const byId = new Map(projection.localizedExperiences.map((e) => [e.experienceId, e]));
  return {
    ...cv,
    summary: projection.localizedSummary,
    summaryOrigin: projection.localizedSummaryProvenance.origin,
    personal: {
      ...cv.personal,
    },
    experience: (cv.experience || []).map((exp) => {
      const loc = byId.get(exp.id);
      if (!loc) return exp;
      return {
        ...exp,
        position: loc.role || exp.position,
        company: loc.company || exp.company,
        description: formatExperienceBullets(loc.bullets.map((b) => b.localizedText)),
      };
    }),
    education: projection.localizedEducation || cv.education,
    skills: projection.localizedSkills || cv.skills,
    languages: (cv.languages || []).map((lang, i) => ({
      name: projection.localizedLanguageLevels[i]?.name || lang.name,
      level: projection.localizedLanguageLevels[i]?.level || lang.level,
    })),
  };
}
