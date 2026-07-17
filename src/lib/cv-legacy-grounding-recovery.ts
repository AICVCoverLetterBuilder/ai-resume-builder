/**
 * Recover authoritative experience duties from legacy Android saves that lack
 * modern provenance fields. Never promotes AI Summary text or unsupported
 * inventions into grounding.
 */
import { splitExperienceBullets } from './cv-canonical-facts';
import { classifyMaterialDutyKeys, type MaterialDutyKey } from './cv-material-duty-coverage';
import { detectContentLocale } from './cv-canonical-snapshot';
import type { CVData, WorkExperience } from './types';

/** Stable English shells used as export grounding for classified legacy duties. */
const AUTHORITATIVE_SHELL_BY_MATERIAL: Partial<Record<MaterialDutyKey, string>> = {
  food_prep: 'Prepare dishes according to restaurant standards.',
  hygiene_workplace: 'Maintain workplace hygiene.',
  kitchen_collaboration: 'Collaborate with the kitchen team.',
  logistics_transport: 'Transport goods according to schedule.',
  logistics_loading: 'Load and unload goods safely.',
  logistics_delivery: 'Complete deliveries according to route plans.',
  team_collaboration: 'Collaborate with the team.',
  process_internal: 'Follow established internal processes.',
};

const RECOVERABLE_KEYS = new Set<MaterialDutyKey>([
  'food_prep',
  'hygiene_workplace',
  'kitchen_collaboration',
  'logistics_transport',
  'logistics_loading',
  'logistics_delivery',
  'team_collaboration',
  'process_internal',
]);

const KEY_ORDER: MaterialDutyKey[] = [
  'food_prep',
  'hygiene_workplace',
  'kitchen_collaboration',
  'logistics_transport',
  'logistics_loading',
  'logistics_delivery',
  'team_collaboration',
  'process_internal',
];

/** Export-facing duty keys (Summary fact categories). */
export const MATERIAL_TO_DUTY_KEY: Partial<Record<MaterialDutyKey, string>> = {
  food_prep: 'food_preparation',
  hygiene_workplace: 'hygiene_workplace',
  kitchen_collaboration: 'kitchen_collaboration',
  logistics_transport: 'logistics_transport',
  logistics_loading: 'logistics_loading',
  logistics_delivery: 'logistics_delivery',
  team_collaboration: 'team_collaboration',
  process_internal: 'process_internal',
};

export const LEGACY_RECOVERED_DISPLAY_DUTIES = 'legacy_recovered_display_duties' as const;
export type LegacyGroundingRecoveryProvenance = typeof LEGACY_RECOVERED_DISPLAY_DUTIES;

/** Reject visible text that clearly invents claims beyond duty classification. */
const UNSUPPORTED_VISIBLE_PROSE_RE =
  /\b(I am currently|currently contributing|career ambitions?|international workplace|guaranteed results?|customer satisfaction score|storage|inventory|leadership behavior|under pressure|efficiency)\b/iu;

const UNSUPPORTED_RECOVERY_HINT_RE =
  /भंडारण|स्टॉक|इन्वेंटरी|नेतृत्व|दबाव|कुशलता|storage|inventory|leadership|pressure|efficiency|cuisine type|health standard/iu;

function orderedRecoverableKeys(text: string): MaterialDutyKey[] {
  const found = new Set(
    classifyMaterialDutyKeys(text).filter((key) => RECOVERABLE_KEYS.has(key)),
  );
  return KEY_ORDER.filter((key) => found.has(key));
}

function shellsFromKeys(keys: MaterialDutyKey[]): string[] {
  const shells: string[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    const shell = AUTHORITATIVE_SHELL_BY_MATERIAL[key];
    if (!shell || seen.has(shell)) continue;
    seen.add(shell);
    shells.push(shell);
  }
  return shells;
}

/**
 * When no modern provenance exists, narrowly classified visible duties may be
 * projected to English authoritative shells for Summary/export grounding.
 *
 * Multiple duty meanings on one display line (e.g. hygiene + kitchen collaboration)
 * are all recovered — do not keep only the primary key.
 */
export function recoverAuthoritativeDutiesFromVisibleText(visible: string): string | null {
  const text = (visible || '').trim();
  if (!text) return null;
  if (UNSUPPORTED_VISIBLE_PROSE_RE.test(text)) return null;
  if (UNSUPPORTED_RECOVERY_HINT_RE.test(text)) return null;

  const bullets = splitExperienceBullets(text);
  if (bullets.length === 0) return null;

  const allKeys: MaterialDutyKey[] = [];
  const seenKey = new Set<MaterialDutyKey>();
  for (const bullet of bullets) {
    if (UNSUPPORTED_VISIBLE_PROSE_RE.test(bullet) || UNSUPPORTED_RECOVERY_HINT_RE.test(bullet)) {
      return null;
    }
    const keys = orderedRecoverableKeys(bullet);
    if (keys.length === 0) return null;
    for (const key of keys) {
      if (seenKey.has(key)) continue;
      seenKey.add(key);
      allKeys.push(key);
    }
  }
  const shells = shellsFromKeys(allKeys);
  return shells.length > 0 ? shells.join('\n') : null;
}

export function recoveredDutyKeysFromVisibleText(visible: string): string[] {
  const text = (visible || '').trim();
  if (!text || UNSUPPORTED_VISIBLE_PROSE_RE.test(text) || UNSUPPORTED_RECOVERY_HINT_RE.test(text)) {
    return [];
  }
  const bullets = splitExperienceBullets(text);
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const bullet of bullets) {
    for (const material of orderedRecoverableKeys(bullet)) {
      const duty = MATERIAL_TO_DUTY_KEY[material];
      if (!duty || seen.has(duty)) continue;
      seen.add(duty);
      keys.push(duty);
    }
  }
  return keys;
}

/**
 * True when legacy visible text can supply duty grounding (either directly as
 * Latin/source duties or via classified shell projection).
 */
export function legacyVisibleLooksLikeUserDuties(visible: string): boolean {
  const text = (visible || '').trim();
  if (!text) return false;
  if (UNSUPPORTED_VISIBLE_PROSE_RE.test(text)) return false;
  const locale = detectContentLocale(text);
  if (locale === 'hi' || locale === 'ar' || locale === 'ja' || locale === 'ru') {
    return Boolean(recoverAuthoritativeDutiesFromVisibleText(text));
  }
  const bullets = splitExperienceBullets(text);
  return bullets.length > 0 && bullets.every((bullet) => orderedRecoverableKeys(bullet).length > 0);
}

export type LegacyExperienceGroundingSource =
  | 'originalUserDescription'
  | 'canonicalSnapshot'
  | 'canonicalDescription'
  | 'legacyDescription'
  | 'legacy_recovered_display_duties'
  | 'none';

function shellCount(text?: string): number {
  return splitExperienceBullets(text || '').filter(Boolean).length;
}

/**
 * Export-boundary recovery: fill missing/incomplete authoritative duties from
 * narrowly classified legacy display text. Idempotent. Does not invent cuisine,
 * storage, leadership, metrics, or other unsupported claims.
 */
export function recoverLegacyExperienceGrounding(input: CVData): {
  cv: CVData;
  invoked: boolean;
  experienceSources: LegacyExperienceGroundingSource[];
  recoveredDutyKeys: string[];
} {
  const experienceSources: LegacyExperienceGroundingSource[] = [];
  const recoveredDutyKeys: string[] = [];
  let changed = false;

  const experience = (input.experience || []).map((exp) => {
    const original = (exp.originalUserDescription || '').trim();
    const visible = (exp.description || '').trim();
    const generated = (exp.generatedDescription || '').trim();
    const display = visible || generated;
    const classified = recoverAuthoritativeDutiesFromVisibleText(display);
    const classifiedKeys = recoveredDutyKeysFromVisibleText(display);

    if (original) {
      // Upgrade incomplete prior recovery when visible text classifies to more duties.
      if (
        exp.groundingRecoverySource === LEGACY_RECOVERED_DISPLAY_DUTIES
        && classified
        && shellCount(classified) > shellCount(original)
      ) {
        changed = true;
        experienceSources.push('legacy_recovered_display_duties');
        recoveredDutyKeys.push(...classifiedKeys);
        return {
          ...exp,
          originalUserDescription: classified,
          canonicalDescription: classified,
          groundingRecoverySource: LEGACY_RECOVERED_DISPLAY_DUTIES,
        } satisfies WorkExperience;
      }
      if (exp.groundingRecoverySource === LEGACY_RECOVERED_DISPLAY_DUTIES) {
        experienceSources.push('legacy_recovered_display_duties');
        const keysFromShells = recoveredDutyKeysFromVisibleText(original);
        recoveredDutyKeys.push(...(keysFromShells.length ? keysFromShells : classifiedKeys));
        return exp;
      }
      experienceSources.push('originalUserDescription');
      return exp;
    }

    if (!classified) {
      experienceSources.push('none');
      return exp;
    }

    changed = true;
    experienceSources.push('legacy_recovered_display_duties');
    recoveredDutyKeys.push(...classifiedKeys);
    return {
      ...exp,
      originalUserDescription: classified,
      canonicalDescription: classified,
      groundingRecoverySource: LEGACY_RECOVERED_DISPLAY_DUTIES,
      descriptionOrigin: exp.descriptionOrigin || 'ai_generated',
    } satisfies WorkExperience;
  });

  if (!changed) {
    return {
      cv: input,
      invoked: true,
      experienceSources,
      recoveredDutyKeys: [...new Set(recoveredDutyKeys)],
    };
  }

  return {
    cv: { ...input, experience },
    invoked: true,
    experienceSources,
    recoveredDutyKeys: [...new Set(recoveredDutyKeys)],
  };
}
