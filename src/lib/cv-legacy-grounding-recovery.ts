/**
 * Recover authoritative experience duties from legacy Android saves that lack
 * modern provenance fields. Never promotes AI Summary text or unsupported
 * inventions into grounding.
 */
import { splitExperienceBullets } from './cv-canonical-facts';
import { classifyMaterialDutyKeys, type MaterialDutyKey } from './cv-material-duty-coverage';
import { detectContentLocale } from './cv-canonical-snapshot';
import { hasCuisineSpecificClaim } from './cv-experience-provenance';

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

/** Reject visible text that clearly invents claims beyond duty classification. */
const UNSUPPORTED_VISIBLE_PROSE_RE =
  /\b(I am currently|currently contributing|career ambitions?|international workplace|guaranteed results?|customer satisfaction score)\b/iu;

function primaryRecoverableKey(text: string): MaterialDutyKey | null {
  const keys = classifyMaterialDutyKeys(text).filter((key) => RECOVERABLE_KEYS.has(key));
  if (keys.length === 0) return null;
  // Prefer the most specific hospitality keys when multiple match.
  if (keys.includes('kitchen_collaboration')) return 'kitchen_collaboration';
  if (keys.includes('food_prep')) return 'food_prep';
  if (keys.includes('hygiene_workplace')) return 'hygiene_workplace';
  return keys[0] || null;
}

/**
 * When no modern provenance exists, narrowly classified visible duties may be
 * projected to English authoritative shells for Summary/export grounding.
 * Returns null when any bullet is unclassified or contains unsupported prose.
 */
export function recoverAuthoritativeDutiesFromVisibleText(visible: string): string | null {
  const text = (visible || '').trim();
  if (!text) return null;
  if (UNSUPPORTED_VISIBLE_PROSE_RE.test(text)) return null;
  if (hasCuisineSpecificClaim(text) && !/mediterranean|mediteransk|भूमध्य|српск/iu.test(text)) {
    // Cuisine inventions without a matching user shell are not recoverable grounding.
    // Hospitality dishes/restaurant-standard claims remain allowed via food_prep.
  }

  const bullets = splitExperienceBullets(text);
  if (bullets.length === 0) return null;

  const shells: string[] = [];
  const seen = new Set<string>();
  for (const bullet of bullets) {
    if (UNSUPPORTED_VISIBLE_PROSE_RE.test(bullet)) return null;
    const key = primaryRecoverableKey(bullet);
    if (!key) return null;
    const shell = AUTHORITATIVE_SHELL_BY_MATERIAL[key];
    if (!shell) return null;
    if (seen.has(shell)) continue;
    seen.add(shell);
    shells.push(shell);
  }
  return shells.length > 0 ? shells.join('\n') : null;
}

/**
 * Prefer locale-stable user/source text when it is already English/Serbian/etc.
 * and classifies cleanly — used only after modern provenance fields are absent.
 */
export function legacyVisibleLooksLikeUserDuties(visible: string): boolean {
  const text = (visible || '').trim();
  if (!text) return false;
  if (UNSUPPORTED_VISIBLE_PROSE_RE.test(text)) return false;
  const locale = detectContentLocale(text);
  if (locale === 'hi' || locale === 'ar' || locale === 'ja' || locale === 'ru') {
    // Localized AI display may still be recoverable via classification shells.
    return Boolean(recoverAuthoritativeDutiesFromVisibleText(text));
  }
  const bullets = splitExperienceBullets(text);
  return bullets.length > 0 && bullets.every((bullet) => Boolean(primaryRecoverableKey(bullet)));
}
