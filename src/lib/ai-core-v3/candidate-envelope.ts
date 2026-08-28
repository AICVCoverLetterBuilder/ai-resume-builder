import {
  AI_CORE_V3_OPERATION_KINDS,
  type AiCoreV3CandidateEnvelope,
} from './contracts';
import { immutableCopy } from './immutability';
import { requireNonBlank } from './invariants';

export type AiCoreV3CandidateEnvelopeInput = AiCoreV3CandidateEnvelope;

export function createCandidateEnvelope(
  input: AiCoreV3CandidateEnvelopeInput,
): AiCoreV3CandidateEnvelope {
  requireNonBlank(input.operationId, 'operationId');
  requireNonBlank(input.candidateId, 'candidateId');
  if (!AI_CORE_V3_OPERATION_KINDS.includes(input.operationKind)) {
    throw new TypeError('operationKind is invalid');
  }
  requireNonBlank(input.targetLocale, 'targetLocale');
  requireNonBlank(input.sourceSnapshotHash, 'sourceSnapshotHash');
  if (typeof input.text !== 'string') {
    throw new TypeError('text must be a string');
  }
  if (input.units) {
    const unitIds = new Set<string>();
    for (const unit of input.units) {
      requireNonBlank(unit.unitId, 'unitId');
      if (unitIds.has(unit.unitId)) {
        throw new TypeError(`duplicate unitId: ${unit.unitId}`);
      }
      unitIds.add(unit.unitId);
      if (typeof unit.text !== 'string') {
        throw new TypeError('unit.text must be a string');
      }
    }
  }
  return immutableCopy({
    operationId: input.operationId,
    candidateId: input.candidateId,
    operationKind: input.operationKind,
    targetLocale: input.targetLocale,
    sourceSnapshotHash: input.sourceSnapshotHash,
    text: input.text,
    ...(input.units !== undefined ? { units: input.units } : {}),
    ...(input.providerMetadata !== undefined ? { providerMetadata: input.providerMetadata } : {}),
  }) as AiCoreV3CandidateEnvelope;
}
