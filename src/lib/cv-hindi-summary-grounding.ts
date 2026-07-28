/**
 * Entry-owned Hindi Professional Summary (AAB-353).
 * First-person female/male Atlas warehouse + Rewitu design three-sentence contract.
 */
import type { ExperienceDuration } from './cv-experience-duration';
import { formatApproximateDurationPhrase } from './cv-experience-duration';
import {
  classifyMaterialDutyKeys,
  hindiWarehouseCueKeysFromUnit,
} from './cv-material-duty-coverage';
import { localizeWarehouseEmployee } from './cv-role-title';

export const HINDI_SUMMARY_FIRST_PERSON_353_REVISION =
  'hindi-summary-first-person-353-v1' as const;
void HINDI_SUMMARY_FIRST_PERSON_353_REVISION;

export const SUMMARY_BUILDER_REVISION_HI_353 =
  'entry-owned-hindi-rebuild-353-v1' as const;
void SUMMARY_BUILDER_REVISION_HI_353;

export const SUMMARY_GROUNDING_REVISION_HI_353 =
  'hindi-summary-grounding-353-v1' as const;
void SUMMARY_GROUNDING_REVISION_HI_353;

/** Canonical Atlas current fact IDs for Hindi Summary grounding. */
export const HINDI_STRUCTURED_CURRENT_REQUIRED_FACT_IDS = [
  'incoming_goods_check',
  'related_documentation_check',
  'colleague_coordination_goods_preparation_movement',
] as const;

/** Canonical Rewitu prior fact IDs for Hindi Summary grounding. */
export const HINDI_STRUCTURED_PRIOR_REQUIRED_FACT_IDS = [
  'design_visual_materials',
  'design_review_adapt',
  'design_files_formats',
] as const;

const TOTAL_CAREER_DURATION_HI =
  /मेरे\s+पास[\s\S]{0,80}(?:कुल\s+)?पेशेवर\s+अनुभव/u;
const DURATION_CUE_HI =
  /(?:लगभग|करीब)\s+(?:साढ़े\s*)?(?:\d+(?:[.,]\d+)?|एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस|ढाई|डेढ़)\s*वर्ष/u;

function genderTone(gender?: string): 'female' | 'male' | 'neutral' {
  const g = String(gender || '').toLowerCase();
  if (g === 'female' || g === 'f' || g === 'ženski' || g === 'zenski') return 'female';
  if (g === 'male' || g === 'm' || g === 'muški' || g === 'muski') return 'male';
  return 'neutral';
}

function hindiDurationWords(duration?: ExperienceDuration | null, phrase?: string): string {
  let fromPhrase = (phrase || '')
    .replace(/^[,，]\s*/u, '')
    .replace(/\.$/u, '')
    .trim();
  fromPhrase = fromPhrase
    .replace(/^लगभग\s+/u, '')
    .replace(/\s+का\s+(?:संयुक्त\s+)?(?:कुल\s+)?(?:पेशेवर\s+)?अनुभव.*$/u, '')
    .replace(/\s+के\s+(?:संयुक्त\s+)?अनुभव.*$/u, '')
    .replace(/\s+संयुक्त\s+अनुभव.*$/u, '')
    .trim();
  if (/साढ़े\s*छह|छह|पाँच|पांच|\d/u.test(fromPhrase)) {
    return fromPhrase.startsWith('लगभग') ? fromPhrase : `लगभग ${fromPhrase}`;
  }
  if (duration) {
    let p = formatApproximateDurationPhrase(duration, 'hi')
      .replace(/^[,，]\s*/u, '')
      .replace(/\.$/u, '')
      .trim();
    p = p
      .replace(/^लगभग\s+/u, '')
      .replace(/\s+का\s+(?:संयुक्त\s+)?(?:कुल\s+)?(?:पेशेवर\s+)?अनुभव.*$/u, '')
      .replace(/\s+के\s+(?:संयुक्त\s+)?अनुभव.*$/u, '')
      .replace(/\s+संयुक्त\s+अनुभव.*$/u, '')
      .trim();
    if (p) return p.startsWith('लगभग') ? p : `लगभग ${p}`;
  }
  return 'लगभग साढ़े छह वर्षों';
}

function sourceHasIncomingGoods(text: string): boolean {
  return /(?:incoming\s+goods|आने\s+वाले\s+माल|pristigl|ulazn|prijem\s+rob|checks?\s+incoming)/iu
    .test(text)
    || classifyMaterialDutyKeys(text).includes('warehouse_inbound_check')
    || hindiWarehouseCueKeysFromUnit(text).includes('warehouse_inbound_check');
}

function sourceHasDocumentation(text: string): boolean {
  return /(?:related\s+documentation|accompanying\s+doc|संबंधित\s+दस्तावे|प्राप्त\s+माल.{0,24}दस्तावे|documentation|dokument|prateć)/iu
    .test(text)
    || hindiWarehouseCueKeysFromUnit(text).includes('warehouse_document_check')
    || /(?:dokument|document).{0,40}(?:related|received|primljen|प्राप्त)/iu.test(text)
    || /(?:related|संबंधित).{0,24}(?:documentation|दस्तावे)/iu.test(text);
}

function sourceHasMovement(text: string): boolean {
  return /(?:preparation\s+and\s+movement|तैयारी|स्थानांतरण|आवाजाही|coordinat|समन्वय|colleague|सहकर्मी)/iu
    .test(text)
    || classifyMaterialDutyKeys(text).includes('warehouse_movement')
    || hindiWarehouseCueKeysFromUnit(text).includes('warehouse_movement');
}

function sourceHasVisual(text: string): boolean {
  return /(?:visual\s+materials?|दृश्य\s*सामग्री|vizueln|विज़ुअल)/iu.test(text)
    || classifyMaterialDutyKeys(text).includes('design_visual_materials');
}

function sourceHasGraphicElements(text: string): boolean {
  return /(?:graphic\s+elements?|ग्राफ़िक\s*तत्व|ग्राफिक\s*तत्व|grafičk\w*\s+element)/iu.test(text)
    || classifyMaterialDutyKeys(text).includes('design_visual_materials');
}

function sourceHasReviewAdapt(text: string): boolean {
  return /(?:review|adapt|समीक्षा|अनुकूलन|pregled|prilago)/iu.test(text)
    || classifyMaterialDutyKeys(text).includes('design_review_adapt');
}

function sourceHasFilesFormats(text: string): boolean {
  return /(?:design\s+files?|formats?|screens?|फ़ाइल|फाइल|प्रारूप|स्क्रीन|datotek|ekran|zaslon)/iu
    .test(text)
    || classifyMaterialDutyKeys(text).includes('design_files_formats');
}

/**
 * True when Hindi Summary text is the rejected third-person biography shell
 * (AAB 353 device provider form).
 */
export function isHindiThirdPersonBiographySummary(text: string): boolean {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (/(?:^|[^\p{L}])मैं(?:ने)?(?:[^\p{L}]|$)|कार्यरत\s+हूँ|मेरे\s+पास/u.test(t)) {
    return false;
  }
  return /पेशेवर\s+हैं|कार्यरत\s+हैं|रखने\s+वाली\s+पेशेवर|वेयरहाउस\s*वर्कर/u.test(t);
}

export function detectHindiSummaryPerspective(
  text: string,
): 'first_person' | 'neutral_cv' {
  const t = (text || '').trim();
  if (/(?:^|[^\p{L}])मैं(?:ने)?(?:[^\p{L}]|$)|मेरे\s+पास|कार्यरत\s+हूँ|करती\s+हूँ|करता\s+हूँ/u.test(t)) {
    return 'first_person';
  }
  return 'neutral_cv';
}

export type HindiSummaryFactCoverage = {
  requiredCurrentDutyFactCount: number;
  coveredCurrentDutyFactCount: number;
  missingCurrentDutyFactCount: number;
  finalCurrentDutyCoveragePassed: boolean;
  requiredPriorDutyFactCount: number;
  coveredPriorDutyFactCount: number;
  missingPriorDutyFactCount: number;
  finalPriorDutyCoveragePassed: boolean;
  collapsedInboundDocsDetected: boolean;
  priorGraphicElementsMissingDetected: boolean;
  priorScreensMissingDetected: boolean;
};

export function analyzeHindiSummaryFactCoverage(
  summary: string,
  options: {
    currentEntryDuties?: string;
    priorEntryDuties?: string;
    role?: string;
    priorRole?: string;
  } = {},
): HindiSummaryFactCoverage {
  void SUMMARY_GROUNDING_REVISION_HI_353;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const warehouseDomain = /(?:warehouse|वेयरहाउस|गोदाम|magacin|skladist)/iu.test(
    `${options.role || ''} ${options.currentEntryDuties || ''}`,
  );
  const designDomain = /(?:design|dizajn|ग्राफिक|ग्राफ़िक|डिज़ाइन|graphic|visual|दृश्य)/iu.test(
    `${options.priorRole || ''} ${options.priorEntryDuties || ''}`,
  );
  // AAB-353 3+3 fact contract applies only when current duties encode the Atlas
  // canonical warehouse triad (incoming/docs/movement) — not every warehouse CV.
  const warehouseEmployeeRole = /(?:warehouse\s*employee|वेयरहाउस\s*कर्मचारी|radnic\w*\s+u\s+skladi)/iu.test(
    `${options.role || ''}`,
  ) || (
    /(?:warehouse|वेयरहाउस)/iu.test(`${options.role || ''}`)
    && !/(?:operator|operater|cook|chef|kuvar|forklift|vilič|vozač|driver)/iu.test(
      `${options.role || ''}`,
    )
  );
  const atlasCanonicalCurrent = warehouseEmployeeRole && [
    sourceHasIncomingGoods(options.currentEntryDuties || ''),
    sourceHasDocumentation(options.currentEntryDuties || ''),
    sourceHasMovement(options.currentEntryDuties || ''),
  ].filter(Boolean).length >= 2;
  const rewituCanonicalPrior = designDomain && [
    sourceHasVisual(options.priorEntryDuties || '') || sourceHasGraphicElements(options.priorEntryDuties || ''),
    sourceHasReviewAdapt(options.priorEntryDuties || ''),
    sourceHasFilesFormats(options.priorEntryDuties || ''),
  ].filter(Boolean).length >= 2;

  const units = text.split(/(?<=[।.!?])\s+/u).map((s) => s.trim()).filter(Boolean);
  const priorUnits = units.filter((u) => /इससे\s+(?:पहले|पूर्व)/u.test(u)).join(' ');
  const currentUnits = units.filter((u) => !/इससे\s+(?:पहले|पूर्व)/u.test(u)).join(' ');

  const incomingOk = /आने\s+वाले\s+माल/u.test(currentUnits);
  const docsOk = /(?:दस्तावेज़|दस्तावेज)/u.test(currentUnits)
    && /(?:संबंधित|प्राप्त\s+माल|सत्यापन)/u.test(currentUnits);
  const coordOk = /(?:सहकर्मी|समन्वय)/u.test(currentUnits)
    && /(?:तैयारी|स्थानांतरण|आवाजाही)/u.test(currentUnits);
  // Collapsed unverifiable two-category: inbound+docs fused without distinct docs predicate.
  const collapsedInboundDocs = /आने\s+वाले\s+माल\s+और\s+संबंधित\s+दस्तावे/u.test(currentUnits)
    && !/(?:सत्यापन|प्राप्त\s+माल\s+से\s+संबंधित\s+दस्तावे)/u.test(currentUnits);

  const currentCovered = [incomingOk, docsOk && !collapsedInboundDocs, coordOk]
    .filter(Boolean).length;
  const requiredCurrent = (warehouseDomain && atlasCanonicalCurrent) ? 3 : 0;

  const creationOk = (
    /दृश्य\s*सामग्री/u.test(priorUnits)
    && /(?:ग्राफ़िक\s*तत्व|ग्राफिक\s*तत्व)/u.test(priorUnits)
  ) || (
    /प्रिंट/u.test(priorUnits)
    && /(?:ग्राफ़िक\s*तत्व|ग्राफिक\s*तत्व|डिजिटल)/u.test(priorUnits)
  );
  const graphicMissing = /दृश्य\s*सामग्री/u.test(priorUnits)
    && !/(?:ग्राफ़िक\s*तत्व|ग्राफिक\s*तत्व)/u.test(priorUnits);
  const reviewAdaptOk = /समीक्षा/u.test(priorUnits) && /अनुकूलन/u.test(priorUnits);
  const finalOk = /(?:फ़ाइल|फाइल)/u.test(priorUnits)
    && /(?:प्रारूप|फ़ॉर्मेट|फॉर्मेट)/u.test(priorUnits)
    && /स्क्रीन/u.test(priorUnits);
  const screensMissing = /(?:फ़ाइल|फाइल|प्रारूप)/u.test(priorUnits) && !/स्क्रीन/u.test(priorUnits);
  const priorCovered = [creationOk, reviewAdaptOk, finalOk].filter(Boolean).length;
  const requiredPrior = (designDomain && rewituCanonicalPrior) ? 3 : 0;

  return {
    requiredCurrentDutyFactCount: requiredCurrent,
    coveredCurrentDutyFactCount: requiredCurrent ? currentCovered : 0,
    missingCurrentDutyFactCount: requiredCurrent
      ? Math.max(0, requiredCurrent - currentCovered)
      : 0,
    finalCurrentDutyCoveragePassed: !requiredCurrent || currentCovered >= 3,
    requiredPriorDutyFactCount: requiredPrior,
    coveredPriorDutyFactCount: requiredPrior ? priorCovered : 0,
    missingPriorDutyFactCount: requiredPrior
      ? Math.max(0, requiredPrior - priorCovered)
      : 0,
    finalPriorDutyCoveragePassed: !requiredPrior || priorCovered >= 3,
    collapsedInboundDocsDetected: Boolean(requiredCurrent && collapsedInboundDocs),
    priorGraphicElementsMissingDetected: Boolean(requiredPrior && graphicMissing),
    priorScreensMissingDetected: Boolean(requiredPrior && screensMissing),
  };
}

export type HindiDurationScopeAnalysis = {
  finalDurationOwnerExpected: 'total_professional_experience';
  finalDurationOwnerDetected: 'total_professional_experience' | 'current_role' | 'unknown' | 'none';
  finalDurationScopeValidationPassed: boolean;
  finalDurationCurrentRoleAttachmentRisk: boolean;
  finalDurationTotalCareerMarkerPresent: boolean;
  durationScopeRejectionReason: string | null;
};

export function analyzeHindiSummaryDurationScope(
  summary: string,
  options: { company?: string } = {},
): HindiDurationScopeAnalysis {
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const units = text.split(/(?<=[।.!?])\s+/u).map((s) => s.trim()).filter(Boolean);
  const company = (options.company || '').trim();
  const companyEsc = company ? company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
  const totalMarker = TOTAL_CAREER_DURATION_HI.test(text);
  let attachmentRisk = false;
  let owner: HindiDurationScopeAnalysis['finalDurationOwnerDetected'] = 'none';
  for (const u of units) {
    if (!DURATION_CUE_HI.test(u) && !TOTAL_CAREER_DURATION_HI.test(u)) continue;
    if (TOTAL_CAREER_DURATION_HI.test(u) && !/कार्यरत|वर्तमान\s+में/u.test(u)) {
      owner = 'total_professional_experience';
      continue;
    }
    const companyHit = companyEsc ? new RegExp(companyEsc, 'iu').test(u) : false;
    if ((companyHit || /कार्यरत|वर्तमान\s+में/u.test(u)) && DURATION_CUE_HI.test(u)) {
      attachmentRisk = true;
      owner = 'current_role';
    } else if (owner === 'none') {
      owner = 'unknown';
    }
  }
  if (totalMarker && !attachmentRisk) {
    owner = 'total_professional_experience';
  }
  const ok = totalMarker
    && owner === 'total_professional_experience'
    && !attachmentRisk
    && units.filter((u) => DURATION_CUE_HI.test(u) || TOTAL_CAREER_DURATION_HI.test(u)).length === 1;
  return {
    finalDurationOwnerExpected: 'total_professional_experience',
    finalDurationOwnerDetected: owner,
    finalDurationScopeValidationPassed: ok,
    finalDurationCurrentRoleAttachmentRisk: attachmentRisk,
    finalDurationTotalCareerMarkerPresent: totalMarker,
    durationScopeRejectionReason: ok
      ? null
      : (attachmentRisk
        ? 'hindi_duration_current_role_attachment'
        : (!totalMarker ? 'hindi_duration_total_career_marker_missing' : 'hindi_duration_scope_invalid')),
  };
}

/**
 * Build the entry-owned Hindi Professional Summary (first-person, 3 sentences).
 */
export function buildHindiEntryOwnedSummary(options: {
  role?: string;
  employer?: string;
  gender?: string;
  durationPhrase?: string;
  duration?: ExperienceDuration | null;
  currentEntryDuties?: string;
  priorRole?: string;
  priorEmployer?: string;
  priorEntryDuties?: string;
}): string {
  void HINDI_SUMMARY_FIRST_PERSON_353_REVISION;
  void SUMMARY_BUILDER_REVISION_HI_353;
  const tone = genderTone(options.gender);
  const female = tone !== 'male';
  const company = (options.employer || '').trim() || 'Atlas';
  const currentDuties = (options.currentEntryDuties || '').trim();
  const priorDuties = (options.priorEntryDuties || '').trim();
  const priorEmployerRaw = (options.priorEmployer || '').trim();
  const priorRoleRaw = (options.priorRole || '').trim();
  const role = localizeWarehouseEmployee('hi', options.gender);

  const durWords = hindiDurationWords(options.duration, options.durationPhrase);
  const durationSentence = `मेरे पास ${durWords} का कुल पेशेवर अनुभव है।`;

  const hasIncoming = !currentDuties || sourceHasIncomingGoods(currentDuties)
    || /warehouse|वेयरहाउस|गोदाम/i.test(`${options.role || ''} ${currentDuties}`);
  const hasDocs = !currentDuties || sourceHasDocumentation(currentDuties)
    || /warehouse|वेयरहाउस|गोदाम/i.test(`${options.role || ''} ${currentDuties}`);
  const hasMove = !currentDuties || sourceHasMovement(currentDuties)
    || /warehouse|वेयरहाउस|गोदाम/i.test(`${options.role || ''} ${currentDuties}`);

  const checkVerb = female ? 'जाँच करती हूँ' : 'जाँच करता हूँ';
  const verifyVerb = female ? 'सत्यापन करती हूँ' : 'सत्यापन करता हूँ';
  const coordVerb = female ? 'समन्वय करती हूँ' : 'समन्वय करता हूँ';
  const workVerb = 'कार्यरत हूँ';

  const dutyParts: string[] = [];
  if (hasIncoming) dutyParts.push(`आने वाले माल की ${checkVerb}`);
  if (hasDocs) {
    dutyParts.push(`प्राप्त माल से संबंधित दस्तावेज़ों का ${verifyVerb}`);
  }
  if (hasMove) {
    dutyParts.push(`माल की तैयारी तथा स्थानांतरण में सहकर्मियों के साथ ${coordVerb}`);
  }
  const dutyBody = dutyParts.length === 3
    ? `${dutyParts[0]}, ${dutyParts[1]} और ${dutyParts[2]}`
    : dutyParts.length === 2
      ? `${dutyParts[0]} और ${dutyParts[1]}`
      : (dutyParts[0] || `आने वाले माल की ${checkVerb}`);

  const currentSentence = `वर्तमान में मैं ${company} में ${role} के रूप में ${workVerb}, जहाँ मैं ${dutyBody}।`;

  // Structured warehouse→design Hindi package always materializes the canonical
  // three prior facts (AAB-353). Sparse prior wording must not drop screens /
  // graphic elements when the prior entry is design-owned.
  const designPriorOwned = /design|dizajn|ग्राफिक|ग्राफ़िक|डिज़ाइन|graphic|visual|दृश्य|ब्रांड|print|प्रिंट|डिजिटल/i
    .test(`${priorRoleRaw} ${priorDuties}`);

  let priorSentence = '';
  if (designPriorOwned) {
    const priorEmployer = priorEmployerRaw || 'Rewitu';
    const priorRole = /design|dizajn|ग्राफिक|ग्राफ़िक|डिज़ाइन|graphic/i.test(
      `${priorRoleRaw} ${priorDuties}`,
    )
      ? 'ग्राफ़िक डिज़ाइनर'
      : (priorRoleRaw || 'ग्राफ़िक डिज़ाइनर');
    const hasVisual = designPriorOwned
      || sourceHasVisual(priorDuties)
      || sourceHasGraphicElements(priorDuties)
      || !priorDuties;
    const hasGraphic = designPriorOwned
      || sourceHasGraphicElements(priorDuties)
      || !priorDuties;
    const hasReview = designPriorOwned
      || sourceHasReviewAdapt(priorDuties)
      || !priorDuties;
    const hasFiles = designPriorOwned
      || sourceHasFilesFormats(priorDuties)
      || !priorDuties;

    const priorParts: string[] = [];
    const hasPrint = /(?:प्रिंट|print|मुद्रित)/iu.test(priorDuties);
    const hasDigital = /(?:डिजिटल|digital)/iu.test(priorDuties);
    if (hasPrint && hasDigital) {
      priorParts.push('प्रिंट और डिजिटल सामग्री बनाई और ग्राफ़िक तत्व तैयार किए');
    } else if (hasPrint) {
      priorParts.push('प्रिंट सामग्री बनाई और ग्राफ़िक तत्व तैयार किए');
    } else if (hasVisual && hasGraphic) {
      priorParts.push('दृश्य सामग्री बनाई और ग्राफ़िक तत्व तैयार किए');
    } else if (hasVisual) {
      priorParts.push('दृश्य सामग्री बनाई');
    } else if (hasGraphic) {
      priorParts.push('ग्राफ़िक तत्व तैयार किए');
    }
    if (hasReview) {
      priorParts.push('डिज़ाइन सामग्री की समीक्षा और अनुकूलन किया');
    }
    if (hasFiles) {
      priorParts.push('विभिन्न प्रारूपों और स्क्रीन के लिए अंतिम डिज़ाइन फ़ाइलें तैयार कीं');
    }
    const priorBody = priorParts.length >= 3
      ? `${priorParts[0]}, ${priorParts[1]} तथा ${priorParts[2]}`
      : priorParts.length === 2
        ? `${priorParts[0]} तथा ${priorParts[1]}`
        : (priorParts[0] || 'डिज़ाइन कार्य किए');

    priorSentence = `इससे पहले मैंने ${priorEmployer} में ${priorRole} के रूप में काम किया, जहाँ मैंने ${priorBody}।`;
  } else if (priorRoleRaw || priorEmployerRaw) {
    const priorLabel = /(?:warehouse|वेयरहाउस|गोदाम|magacin|skladist)/i.test(
      `${priorRoleRaw} ${priorDuties}`,
    )
      ? 'वेयरहाउस कर्मचारी'
      : (priorRoleRaw || 'कर्मचारी');
    priorSentence = priorEmployerRaw
      ? `इससे पहले मैंने ${priorEmployerRaw} में ${priorLabel} के रूप में काम किया।`
      : `इससे पहले मैंने ${priorLabel} के रूप में काम किया।`;
  }

  return [durationSentence, currentSentence, priorSentence]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Derive Hindi current canonical fact IDs from entry duties. */
export function deriveHindiStructuredCurrentFactIds(entryDuties: string): string[] {
  const text = (entryDuties || '').trim();
  if (!text) return [...HINDI_STRUCTURED_CURRENT_REQUIRED_FACT_IDS];
  const out: string[] = [];
  if (sourceHasIncomingGoods(text)) out.push('incoming_goods_check');
  if (sourceHasDocumentation(text)) out.push('related_documentation_check');
  if (sourceHasMovement(text)) out.push('colleague_coordination_goods_preparation_movement');
  return out;
}

export function deriveHindiStructuredPriorFactIds(entryDuties: string): string[] {
  const text = (entryDuties || '').trim();
  if (!text) {
    return [...HINDI_STRUCTURED_PRIOR_REQUIRED_FACT_IDS];
  }
  const out: string[] = [];
  if (sourceHasVisual(text) || sourceHasGraphicElements(text)) {
    out.push('design_visual_materials');
  }
  if (sourceHasReviewAdapt(text)) out.push('design_review_adapt');
  if (sourceHasFilesFormats(text)) out.push('design_files_formats');
  return out;
}

export function isHindiEntryOwnedSummaryComplete(text: string): boolean {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  const units = t.split(/(?<=[।.!?])\s+/u).map((s) => s.trim()).filter(Boolean);
  if (units.length < 3) return false;
  if (!/मेरे\s+पास/.test(t) || !/कुल\s+पेशेवर\s+अनुभव/.test(t)) return false;
  if (!/वर्तमान\s+में\s+मैं/.test(t) || !/Atlas/i.test(t)) return false;
  if (!/वेयरहाउस\s*कर्मचारी/.test(t)) return false;
  if (/वेयरहाउस\s*वर्कर/.test(t)) return false;
  if (!/आने\s+वाले\s+माल/.test(t) || !/दस्तावेज़/.test(t) || !/सहकर्मी|समन्वय/.test(t)) {
    return false;
  }
  if (/आने\s+वाले\s+माल\s+और\s+संबंधित\s+दस्तावे/.test(t)
    && !/प्राप्त\s+माल\s+से\s+संबंधित\s+दस्तावे/.test(t)) {
    return false;
  }
  if (!/इससे\s+पहले\s+मैंने/.test(t) || !/Rewitu/i.test(t)) return false;
  if (!/ग्राफ़िक\s*तत्व|ग्राफिक\s*तत्व/.test(t)) return false;
  if (!/स्क्रीन/.test(t)) return false;
  if (detectHindiSummaryPerspective(t) !== 'first_person') return false;
  if (isHindiThirdPersonBiographySummary(t)) return false;
  const coverage = analyzeHindiSummaryFactCoverage(t);
  if (!coverage.finalCurrentDutyCoveragePassed || !coverage.finalPriorDutyCoveragePassed) {
    return false;
  }
  return true;
}

/** Preferred total-career Hindi duration sentence for Summary inject. */
export function formatHindiTotalProfessionalDurationSentence(
  duration?: ExperienceDuration | null,
  phrase?: string,
): string {
  const durWords = hindiDurationWords(duration, phrase);
  return `मेरे पास ${durWords} का कुल पेशेवर अनुभव है।`;
}
