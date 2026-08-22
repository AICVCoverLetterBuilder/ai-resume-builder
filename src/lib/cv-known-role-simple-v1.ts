import type { Locale } from './i18n/translations';
import type { CVData, KnownRoleKey, WorkExperience } from './types';
import {
  localizeGraphicDesigner,
  localizeWarehouseEmployee,
} from './cv-known-role-title-mappings';

export const SIMPLE_V1_KNOWN_ROLE_KEYS = [
  'graphic_designer',
  'warehouse_worker',
] as const satisfies readonly KnownRoleKey[];

const KNOWN_ROLE_TITLE_RESOLVERS: Record<
  KnownRoleKey,
  (locale: Locale, gender?: string) => string
> = {
  graphic_designer: localizeGraphicDesigner,
  warehouse_worker: localizeWarehouseEmployee,
};

export function isKnownRoleKey(value: unknown): value is KnownRoleKey {
  return typeof value === 'string'
    && (SIMPLE_V1_KNOWN_ROLE_KEYS as readonly string[]).includes(value);
}

/**
 * The only Simple V1 known-role display authority. A role is localized only
 * when app-owned identity is explicit; arbitrary or unknown titles stay exact.
 */
export function getRoleDisplayTitle(options: {
  roleKey?: unknown;
  rawPosition: string;
  contentLocale: Locale;
  gender?: string;
}): string {
  if (!isKnownRoleKey(options.roleKey)) return options.rawPosition;
  return KNOWN_ROLE_TITLE_RESOLVERS[options.roleKey](
    options.contentLocale,
    options.gender,
  ) || options.rawPosition;
}

export function resolveExperienceRoleDisplayTitle(
  experience: Pick<WorkExperience, 'position' | 'positionSourceKey'>,
  contentLocale: Locale,
  gender?: string,
): string {
  return getRoleDisplayTitle({
    roleKey: experience.positionSourceKey,
    rawPosition: experience.position,
    contentLocale,
    gender,
  });
}

/** Projects presentation/context copies without changing stored experiences. */
export function projectExperienceRoleDisplayTitles(
  experience: readonly WorkExperience[],
  contentLocale: Locale,
  gender?: string,
): WorkExperience[] {
  return experience.map((entry) => ({
    ...entry,
    position: resolveExperienceRoleDisplayTitle(entry, contentLocale, gender),
  }));
}

/** Manual editor text is free text and therefore cannot retain catalog identity. */
export function clearKnownRoleIdentityForManualPositionEdit(
  cv: CVData,
  experienceId: string,
): CVData {
  let cleared = false;
  const experience = cv.experience.map((entry) => {
    if (entry.id !== experienceId || !entry.positionSourceKey) return entry;
    const { positionSourceKey: _knownRoleKey, ...freeTextEntry } = entry;
    void _knownRoleKey;
    cleared = true;
    return freeTextEntry;
  });
  return cleared ? { ...cv, experience } : cv;
}
