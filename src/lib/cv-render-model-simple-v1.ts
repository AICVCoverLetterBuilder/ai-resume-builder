import type { Locale } from './i18n/translations';
import type { CVData, Education, PersonalInfo, WorkExperience } from './types';
import { getCvContentLocale, getCvSummaryText } from './cv-simple-v1';

export const CV_SIMPLE_V1_RENDER_MODEL_REVISION =
  'cv-simple-v1-render-model-m3-v1' as const;

export type CvRenderFormat = 'preview' | 'pdf' | 'docx';

export type CvRenderModel = Pick<
  CVData,
  | 'id'
  | 'name'
  | 'personal'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'certifications'
  | 'languages'
  | 'templateId'
  | 'region'
  | 'createdAt'
  | 'updatedAt'
> & { contentLocale: Locale };

export interface CvRenderSnapshot {
  readonly revision: typeof CV_SIMPLE_V1_RENDER_MODEL_REVISION;
  readonly model: CvRenderModel;
  readonly contentLocale: Locale;
  readonly renderModelHash: string;
  readonly summaryHash: string;
  readonly experienceHash: string;
}

function hashExactValue(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function freezeDeep<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
  return value;
}

function projectPersonal(personal: PersonalInfo): PersonalInfo {
  const source = personal as PersonalInfo & {
    originalPhoto?: string;
    circularPhoto?: string;
    rectangularPhoto?: string;
  };
  return {
    fullName: source.fullName,
    email: source.email,
    phone: source.phone,
    address: source.address,
    photo: source.photo,
    photoEnabled: source.photoEnabled,
    jobTitle: source.jobTitle,
    linkedIn: source.linkedIn,
    website: source.website,
    fathersName: source.fathersName,
    nationality: source.nationality,
    dateOfBirth: source.dateOfBirth,
    gender: source.gender,
    ...(source.originalPhoto === undefined ? {} : { originalPhoto: source.originalPhoto }),
    ...(source.circularPhoto === undefined ? {} : { circularPhoto: source.circularPhoto }),
    ...(source.rectangularPhoto === undefined ? {} : { rectangularPhoto: source.rectangularPhoto }),
  };
}

function projectExperience(entry: WorkExperience): WorkExperience {
  return {
    id: entry.id,
    company: entry.company,
    position: entry.position,
    startDate: entry.startDate,
    endDate: entry.endDate,
    isPresent: entry.isPresent,
    description: entry.description,
  };
}

function projectEducation(entry: Education): Education {
  return {
    id: entry.id,
    school: entry.school,
    degree: entry.degree,
    startDate: entry.startDate,
    endDate: entry.endDate,
    description: entry.description,
  };
}

/**
 * The only Simple V1 rendering authority. It copies current visible fields and
 * deliberately omits every legacy canonical, generated, recovery, and AI field.
 */
export function buildCvRenderModel(cv: CVData): CvRenderModel {
  const model: CvRenderModel = {
    id: cv.id,
    name: cv.name,
    personal: projectPersonal(cv.personal),
    summary: getCvSummaryText(cv),
    contentLocale: getCvContentLocale(cv),
    experience: (cv.experience || []).map(projectExperience),
    education: (cv.education || []).map(projectEducation),
    skills: [...(cv.skills || [])],
    certifications: [...(cv.certifications || [])],
    languages: (cv.languages || []).map((language) => ({
      name: language.name,
      level: language.level,
    })),
    templateId: cv.templateId,
    region: cv.region,
    createdAt: cv.createdAt,
    updatedAt: cv.updatedAt,
  };
  return freezeDeep(model);
}

/** Captures one detached render authority before any asynchronous file work. */
export function captureCvRenderSnapshot(cv: CVData): CvRenderSnapshot {
  const model = buildCvRenderModel(cv);
  const snapshot: CvRenderSnapshot = {
    revision: CV_SIMPLE_V1_RENDER_MODEL_REVISION,
    model,
    contentLocale: model.contentLocale as Locale,
    renderModelHash: hashExactValue(model),
    summaryHash: hashExactValue(model.summary),
    experienceHash: hashExactValue(model.experience),
  };
  return freezeDeep(snapshot);
}

/** Format adapters may alter photo presentation, never CV content authority. */
export function withCvRenderModelPhoto(
  snapshot: CvRenderSnapshot,
  photo: string | undefined,
): CvRenderModel {
  return {
    ...snapshot.model,
    personal: { ...snapshot.model.personal, photo },
  };
}

export function describeCvRenderTarget(
  snapshot: CvRenderSnapshot,
  format: CvRenderFormat,
): Readonly<{
  simpleV1: true;
  format: CvRenderFormat;
  templateId: CVData['templateId'];
  contentLocale: Locale;
  renderModelHash: string;
  summaryHash: string;
  experienceHash: string;
}> {
  return Object.freeze({
    simpleV1: true,
    format,
    templateId: snapshot.model.templateId,
    contentLocale: snapshot.contentLocale,
    renderModelHash: snapshot.renderModelHash,
    summaryHash: snapshot.summaryHash,
    experienceHash: snapshot.experienceHash,
  });
}
