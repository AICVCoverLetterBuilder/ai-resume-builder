/**
 * Source-owned Russian Experience projection for concrete design duties.
 *
 * This is deliberately a semantic bridge, not an occupation template: a
 * recognised source responsibility is projected one-for-one and the same
 * responsibility matcher validates provider, repair, fallback, and visible
 * candidates. Unknown duties return no projection and therefore fail closed.
 */
import { formatExperienceBullets, splitExperienceBullets } from './cv-canonical-facts';
import { extractSourceDutyUnits, stripDutyListPrefix } from './cv-source-fact-identity';

export const RUSSIAN_EXPERIENCE_SEMANTIC_GROUNDING_451_REVISION =
  'russian-experience-semantic-grounding-451-v1' as const;

export type RussianDesignSemanticFact =
  | 'graphic_materials_media'
  | 'visual_concepts_client_needs'
  | 'design_review_final_quality';

type SourceFact = {
  kind: RussianDesignSemanticFact;
  sourceIndex: number;
};

const PRINT = /(?:\bprint(?:ed)?\b|\bimprim[ée]s?\b|печа[тн]\w*|प्रिंट|मुद्रित|印刷|مطبوع|štamp|tiskan)/iu;
const DIGITAL_MEDIA = /(?:\bdigital(?:\s+(?:media|materials?|content))?\b|\bnum[ée]rique\w*|цифров\w*|डिजिटल|デジタル|رقمي|digitaln)/iu;
const GRAPHIC_MATERIALS = /(?:\bgraphic(?:al)?\s+(?:materials?|content|elements?)\b|\bvisual\s+materials?\b|материал\w*.{0,32}графическ\w*|графическ\w*.{0,32}материал\w*|ग्राफिक\s+सामग्री|グラフィック.{0,16}(?:素材|資料)|مواد.{0,24}(?:تصميم|رسومية)|grafičk\w*.{0,24}materijal)/iu;
const DEVELOP_CONCEPTS = /(?:\bdevelop\w*\b.{0,32}\b(?:visual\s+)?design\s+concepts?\b|\bconcepts?\b.{0,32}\bdesign\b|разрабатыва\w*.{0,32}концепц\w*.{0,32}дизайн\w*|विज़ुअल\s+डिज़ाइन\s+अवधारणाएँ.{0,32}विकसित|दृश्य\s+डिज़ाइन\s+अवधारणाएँ.{0,32}विकसित|ビジュアル.{0,20}コンセプト.{0,24}(?:開発|作成)|مفاهيم.{0,32}تصميم.{0,32}(?:طو|تطوير)|vizueln\w*.{0,24}koncept\w*.{0,24}dizajn)/iu;
const CLIENT_NEEDS = /(?:\bclient(?:s)?\s+(?:needs?|requirements?)\b|\bcustomer\s+needs?\b|\bbesoins?\s+des\s+clients?\b|потребност\w*.{0,24}клиент\w*|ग्राहक(?:ों)?\s+(?:की\s+)?आवश्यकताओं|クライアント.{0,24}(?:ニーズ|要件)|احتياجات.{0,24}(?:العملاء|العميل)|potreb\w*.{0,24}klijen)/iu;
const REVIEW_DESIGN = /(?:\breview\w*\b.{0,32}\bdesign\s+projects?\b|\bdesign\s+projects?\b.{0,32}\breview\w*|проверя\w*.{0,32}дизайн[- ]?проект\w*|डिज़ाइन\s+परियोजनाओं\s+की\s+समीक्षा|デザイン.{0,24}(?:レビュー|プロジェクト).{0,24}(?:確認|レビュー)|مراجعة.{0,32}(?:مشاريع|مشروع).{0,24}تصميم|pregled\w*.{0,24}dizajn\w*.{0,24}projek)/iu;
const FINAL_QUALITY = /(?:\bquality\b.{0,32}\bfinal\s+(?:outputs?|deliverables?|results?)\b|\bfinal\s+(?:outputs?|deliverables?|results?)\b.{0,32}\bquality\b|качеств\w*.{0,32}конечн\w*.{0,16}(?:результат|выход)\w*|अंतिम\s+(?:आउटपुट|परिणामों)\s+की\s+गुणवत्ता|最終.{0,24}(?:成果物|出力).{0,24}品質|جودة.{0,32}(?:المخرجات|النتائج).{0,24}النهائية|kvalitet\w*.{0,24}(?:konačn\w*\s+(?:rezultat|izlaz)|završn\w*\s+(?:rezultat|isporuk)))/iu;

const UNSUPPORTED_RU = /(?:платформ\w*|экран\w*|формат\w*|файл\w*|метрик\w*|\bKPI\b|\bSalesforce\b|лидер\w*|стандарт\w*|соответстви\w*\s+стандарт|всех|ежедневн\w*)/iu;
const PROJECT_REQUIREMENTS_RU = /(?:требовани\w*\s+проекта|проектн\w*\s+требовани\w*)/iu;

function sourceFacts(sourceDescription: string): SourceFact[] {
  const units = extractSourceDutyUnits(sourceDescription || '')
    .map((unit) => stripDutyListPrefix(unit))
    .filter(Boolean);
  const facts: SourceFact[] = [];
  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index]!;
    if (GRAPHIC_MATERIALS.test(unit) && PRINT.test(unit) && DIGITAL_MEDIA.test(unit)) {
      facts.push({ kind: 'graphic_materials_media', sourceIndex: index });
    } else if (DEVELOP_CONCEPTS.test(unit) && CLIENT_NEEDS.test(unit)) {
      facts.push({ kind: 'visual_concepts_client_needs', sourceIndex: index });
    } else if (REVIEW_DESIGN.test(unit) && FINAL_QUALITY.test(unit)) {
      facts.push({ kind: 'design_review_final_quality', sourceIndex: index });
    }
  }
  return facts;
}

export function sourceRequiresRussianDesignSemanticGrounding(sourceDescription: string): boolean {
  const kinds = new Set(sourceFacts(sourceDescription).map((fact) => fact.kind));
  return kinds.size === 3;
}

function candidateCovers(kind: RussianDesignSemanticFact, bullet: string): boolean {
  if (UNSUPPORTED_RU.test(bullet)) return false;
  switch (kind) {
    case 'graphic_materials_media':
      return GRAPHIC_MATERIALS.test(bullet) && PRINT.test(bullet) && DIGITAL_MEDIA.test(bullet);
    case 'visual_concepts_client_needs':
      return DEVELOP_CONCEPTS.test(bullet) && CLIENT_NEEDS.test(bullet) && !PROJECT_REQUIREMENTS_RU.test(bullet);
    case 'design_review_final_quality':
      return REVIEW_DESIGN.test(bullet) && FINAL_QUALITY.test(bullet);
  }
}

export type RussianDesignSemanticCoverage = {
  ok: boolean;
  required: RussianDesignSemanticFact[];
  covered: RussianDesignSemanticFact[];
  uncovered: RussianDesignSemanticFact[];
  addedSemanticArgumentCount: number;
  reason: string | null;
  revision: typeof RUSSIAN_EXPERIENCE_SEMANTIC_GROUNDING_451_REVISION;
};

export function validateRussianDesignSemanticProjection(
  sourceDescription: string,
  candidateDescription: string,
): RussianDesignSemanticCoverage {
  const required = sourceFacts(sourceDescription).map((fact) => fact.kind);
  const bullets = splitExperienceBullets(candidateDescription || '').map((bullet) => bullet.trim()).filter(Boolean);
  const used = new Set<number>();
  const covered: RussianDesignSemanticFact[] = [];
  for (const kind of required) {
    const hit = bullets.findIndex((bullet, index) => !used.has(index) && candidateCovers(kind, bullet));
    if (hit >= 0) {
      used.add(hit);
      covered.push(kind);
    }
  }
  const unsupported = bullets.filter((bullet) => UNSUPPORTED_RU.test(bullet)).length;
  // Every visible Russian duty must resolve to exactly one authoritative fact.
  // An additional unmatched duty is an unsourced semantic argument, not filler.
  const extraCandidateUnitCount = bullets.filter((_bullet, index) => !used.has(index)).length;
  const uncovered = required.filter((kind) => !covered.includes(kind));
  const addedSemanticArgumentCount = unsupported + extraCandidateUnitCount;
  const ok = required.length === 3 && uncovered.length === 0 && addedSemanticArgumentCount === 0;
  return {
    ok,
    required,
    covered,
    uncovered,
    addedSemanticArgumentCount,
    reason: ok ? null : (addedSemanticArgumentCount
      ? 'russian_design_unsupported_semantic_argument'
      : 'russian_design_semantic_fact_coverage_incomplete'),
    revision: RUSSIAN_EXPERIENCE_SEMANTIC_GROUNDING_451_REVISION,
  };
}

export function buildRussianDesignSemanticFallback(options: {
  sourceDescription: string;
  isPresent?: boolean;
  gender?: string;
}): string {
  const facts = sourceFacts(options.sourceDescription);
  if (new Set(facts.map((fact) => fact.kind)).size !== 3) return '';
  const present = options.isPresent !== false;
  const female = /^(female|f|женск|ženski|zenski)$/iu.test(String(options.gender || ''));
  const forms = present
    ? {
      graphic_materials_media: 'Создаёт графические материалы для печатных и цифровых медиа.',
      visual_concepts_client_needs: 'Разрабатывает концепции визуального дизайна в соответствии с потребностями клиентов.',
      design_review_final_quality: 'Проверяет дизайн-проекты и контролирует качество конечных результатов.',
    }
    : female
      ? {
        graphic_materials_media: 'Создавала графические материалы для печатных и цифровых медиа.',
        visual_concepts_client_needs: 'Разрабатывала концепции визуального дизайна в соответствии с потребностями клиентов.',
        design_review_final_quality: 'Проверяла дизайн-проекты и контролировала качество конечных результатов.',
      }
      : {
        graphic_materials_media: 'Создавал графические материалы для печатных и цифровых медиа.',
        visual_concepts_client_needs: 'Разрабатывал концепции визуального дизайна в соответствии с потребностями клиентов.',
        design_review_final_quality: 'Проверял дизайн-проекты и контролировал качество конечных результатов.',
      };
  return formatExperienceBullets(facts.map((fact) => forms[fact.kind]));
}
