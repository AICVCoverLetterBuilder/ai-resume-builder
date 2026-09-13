import { describe, expect, it, vi } from 'vitest';
import type { CVData } from '../../types';
import { captureSummaryV3GenerateOperationSnapshot, executeSummaryV3GenerateServer,
  SUMMARY_V3_WRITER_TOOL_NAME, SUMMARY_V3_EVALUATOR_TOOL_NAME,
  parseSummaryV3EvaluatorOutput, runSummaryV3GenerateAdapter,
  type SummaryV3GenerateAdapterInput, type SummaryV3GenerateTerminalEvent, type SummaryV3Manifest } from '..';

const checks = ['factRetention', 'entryOwnership', 'currentPriorSeparation', 'unsupportedClaimsAbsent',
  'roleEmployerStateAccurate', 'durationMeaningAndScope', 'optionalAuthorityRespected',
  'targetLanguageAndScript', 'firstPersonPerspective', 'currentRoleTense', 'priorRoleTense',
  'grammarAndClarity', 'duplicationAndDegradationAbsent', 'completeSummaryUsable'];

function fixtureInput(): SummaryV3GenerateAdapterInput {
  const cv: CVData = { id: 'aab584', name: 'Synthetic', personal: { fullName: '', email: '', phone: '',
    address: '', jobTitle: '', gender: 'male' }, summary: '', contentLocale: 'en',
    experience: [{ id: 'current', position: 'Servicetechniker Elektrotechnik', company: 'NordWerk Elektroservice Test',
      startDate: '2023-08', endDate: '', isPresent: true, positionSourceLocale: 'de', descriptionSourceLocale: 'de',
      description: 'Wartung elektrischer Anlagen\nLokalisierung und Behebung von Fehlern in elektrischen Anlagen\nUnterstützung bei der Installation elektrischer Komponenten' }],
    education: [], skills: [], certifications: [], languages: [], templateId: 'modern-minimal', region: 'EU', createdAt: '', updatedAt: '' };
  return { enabled: true, operationKind: 'summary_generate',
    operationId: 'op584', requestId: 'req584', cv, requestedLocale: 'en', uiLocale: 'en', storedContentLocale: 'en',
    exactVisibleSummary: '', referenceDateIso: '2026-09-13', jobContextHash: 'context584', usageCountBefore: 6 };
}

function fixture() { return captureSummaryV3GenerateOperationSnapshot(fixtureInput()); }

function writer(manifest: SummaryV3Manifest, corrected: boolean) {
  return { stopReason: 'tool_use', content: [{ type: 'tool_use' as const, name: SUMMARY_V3_WRITER_TOOL_NAME, input: {
    operationId: manifest.operationId, snapshotHash: manifest.sourceSnapshotHash, locale: manifest.targetLocale,
    units: [{ slot: 'duration', entryId: null, factIds: [], text: 'I bring approximately three years of experience.' },
      { slot: 'experience', entryId: manifest.selectedEntries[0].entryId,
        factIds: manifest.selectedEntries[0].facts.map(f => f.factId),
        text: 'I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, finding and resolving electrical faults and assisting with component installation.'
          + (corrected ? ' I maintain electrical systems.' : '') }] } }] };
}

function evaluation(manifest: SummaryV3Manifest, rejected: boolean, failedCheck = 'factRetention') {
  return { stopReason: 'tool_use', content: [{ type: 'tool_use' as const, name: SUMMARY_V3_EVALUATOR_TOOL_NAME, input: {
    operationId: manifest.operationId, snapshotHash: manifest.sourceSnapshotHash, locale: manifest.targetLocale,
    checks: Object.fromEntries(checks.map(check => [check, !(rejected && check === failedCheck)])),
    phases: { semantic: rejected ? { status: 'failed', violations: [{ category: 'semantic', code: 'Missing material duty',
      detail: 'Restore the material duty bound to the supplied fact.', factIds: [manifest.selectedEntries[0].facts[0].factId], entryIds: ['current'] }] }
      : { status: 'passed', violations: [] }, language_quality: { status: 'passed', violations: [] } } } }] };
}

describe('AAB584 structured semantic repair evidence', () => {
  it('carries the exact failed check and original fact binding into the repair writer', async () => {
    const { manifest } = fixture();
    let calls = 0;
    let repairPrompt = '';
    const result = await executeSummaryV3GenerateServer({ manifest }, {
      write: async (prompt, phase) => { if (phase === 'repair_writer') repairPrompt = prompt; return writer(manifest, phase === 'repair_writer'); },
      evaluate: async () => evaluation(manifest, calls++ === 0),
    });
    expect(result.ok).toBe(true);
    expect(calls).toBe(2);
    const payload = JSON.parse(repairPrompt.split('\n').at(-1)!);
    expect(payload.repairEvidence.failedCheckIds).toEqual(['factRetention']);
    expect(payload.violations[0].factIds).toEqual([manifest.selectedEntries[0].facts[0].factId]);
  });

  it('explains the physical count=1 / codes=[] gap without claiming a recovered live reason', () => {
    const { manifest } = fixture();
    const raw = evaluation(manifest, true).content[0].input;
    const parsed = parseSummaryV3EvaluatorOutput(raw, manifest)!;
    expect(parsed.phases.semantic.violations).toHaveLength(1);
    expect(parsed.phases.semantic.violations.map(v => v.code).filter(c => /^[a-z][a-z0-9_]{0,63}$/u.test(c))).toEqual([]);
    expect(parsed.checks.factRetention).toBe(false);
    // A check=false alone cannot explain this terminal: empty failed violations
    // or a passed phase with violations fails the real parser, not semantics.
    expect(parseSummaryV3EvaluatorOutput({ ...raw, phases: { ...raw.phases,
      semantic: { status: 'failed', violations: [] } } }, manifest)).toBeNull();
    expect(parseSummaryV3EvaluatorOutput({ ...raw, checks: Object.fromEntries(checks.map(c => [c, true])) }, manifest)).toBeNull();
  });

  it('keeps a genuinely bad repair rejected and exposes bounded failed-check evidence without prose', async () => {
    const input = fixtureInput();
    const { manifest } = fixture();
    const events: SummaryV3GenerateTerminalEvent[] = [];
    const write = vi.fn(async () => writer(manifest, false));
    const evaluate = vi.fn(async () => evaluation(manifest, true));
    const commitCandidate = vi.fn();
    const result = await runSummaryV3GenerateAdapter(input, {
      request: async () => executeSummaryV3GenerateServer({ manifest }, { write, evaluate }),
      getLiveState: () => ({ ...input, cv: input.cv }), getActiveOperationId: () => input.operationId,
      commitCandidate, onTerminal: event => events.push(event), getRouteHttpStatus: () => 422,
    });
    expect(result).toEqual({ kind: 'handled_failure', typedReason: 'repair_validation_rejected' });
    expect(write).toHaveBeenCalledTimes(2); expect(evaluate).toHaveBeenCalledTimes(2);
    expect(commitCandidate).not.toHaveBeenCalled();
    expect(input.usageCountBefore).toBe(6);
    expect(events[0]).toMatchObject({ applyCommitted: false, usageAfter: 6,
      evidence: { semanticViolationCodes: ['evaluator_check_fact_retention'],
        primaryValidationRejectionCode: 'evaluator_check_fact_retention' } });
    const safe = JSON.stringify(events[0].evidence);
    for (const privateText of ['NordWerk', 'Servicetechniker', 'Missing material duty', 'Restore the material duty', 'Wartung']) {
      expect(safe).not.toContain(privateText);
    }
  });
});

// Provider semantics are injected as independently labelled complete/incomplete
// fixture surfaces. This tests transport and evidence, not an in-test synonym
// classifier or a claim that a live model accepts these sentences.
const locales = [
  ['sr', 'en', 'Reviews invoices.', 'Files invoices.', 'Imam približno tri godine iskustva.', 'Pregledam fakture.', 'Arhiviram fakture.'],
  ['en', 'de', 'Prüft Kabel.', 'Dokumentiert Prüfungen.', 'I have about three years of experience.', 'I inspect cables.', 'I record inspection results.'],
  ['hi', 'en', 'Checks deliveries.', 'Records inventory.', 'मेरे पास लगभग तीन साल का अनुभव है।', 'मैं डिलीवरी जाँचता हूँ।', 'मैं भंडार का रिकॉर्ड रखता हूँ।'],
  ['ar', 'en', 'Schedules appointments.', 'Maintains records.', 'لدي خبرة تقارب ثلاث سنوات.', 'أنظم المواعيد.', 'أحافظ على السجلات.'],
  ['ja', 'en', 'Inspects parts.', 'Logs defects.', '約3年間の経験があります。', '部品を検査しています。', '不具合を記録しています。'],
  ['de', 'de', 'Prüft Bestellungen.', 'Erfasst Lieferungen.', 'Ich habe ungefähr drei Jahre Erfahrung.', 'Ich prüfe Bestellungen.', 'Ich erfasse Lieferungen.'],
  ['fr', 'fr', 'Vérifie les dossiers.', 'Classe les documents.', "J’ai environ trois ans d’expérience.", 'Je vérifie les dossiers.', 'Je classe les documents.'],
  ['es', 'es', 'Revisa pedidos.', 'Registra entregas.', 'Tengo aproximadamente tres años de experiencia.', 'Reviso pedidos.', 'Registro entregas.'],
  ['it', 'it', 'Controlla fatture.', 'Archivia ricevute.', 'Ho circa tre anni di esperienza.', 'Controllo le fatture.', 'Archivio le ricevute.'],
  ['hr', 'hr', 'Provjerava opremu.', 'Bilježi kvarove.', 'Imam približno tri godine iskustva.', 'Provjeravam opremu.', 'Bilježim kvarove.'],
  ['pt-BR', 'pt-BR', 'Verifica pedidos.', 'Registra pagamentos.', 'Tenho aproximadamente três anos de experiência.', 'Verifico pedidos.', 'Registro pagamentos.'],
  ['ru', 'ru', 'Проверяет документы.', 'Ведёт журнал.', 'У меня около трёх лет опыта.', 'Я проверяю документы.', 'Я веду журнал.'],
] as const;

const currentIdentity: Record<(typeof locales)[number][0], readonly [string, string]> = {
  sr: ['Operater', 'Trenutno radim kao operater u kompaniji Example.'],
  en: ['Operator', 'I currently work as an operator at Example.'],
  hi: ['ऑपरेटर', 'मैं वर्तमान में Example में ऑपरेटर के रूप में काम करता हूँ।'],
  ar: ['مشغل', 'أعمل حالياً مشغلاً لدى Example.'],
  ja: ['オペレーター', '現在Exampleでオペレーターとして働いています。'],
  de: ['Operator', 'Ich arbeite derzeit als Operator bei Example.'],
  fr: ['Opérateur', 'Je travaille actuellement comme opérateur chez Example.'],
  es: ['Operador', 'Actualmente trabajo como operador en Example.'],
  it: ['Operatore', 'Attualmente lavoro come operatore presso Example.'],
  hr: ['Operater', 'Trenutno radim kao operater u tvrtki Example.'],
  'pt-BR': ['Operador', 'Atualmente trabalho como operador na Example.'],
  ru: ['Оператор', 'Сейчас я работаю оператором в Example.'],
};

describe('M4 language-independent repair evidence', () => {
  it.each(locales)('%s receives its missing source fact, restores it, and is independently reevaluated',
    async (locale, sourceLocale, factA, factB, duration, first, restored) => {
      const input = fixtureInput();
      const [role, identity] = currentIdentity[locale];
      const cv = { ...input.cv, contentLocale: locale, experience: [{ ...input.cv.experience[0],
        id: `entry-${locale}`, position: role, company: 'Example', description: `${factA}\n${factB}`,
        descriptionSourceLocale: sourceLocale, positionSourceLocale: locale }] };
      const { manifest } = captureSummaryV3GenerateOperationSnapshot({ ...input, cv,
        requestedLocale: locale, uiLocale: locale, storedContentLocale: locale });
      const makeWriter = (repaired: boolean) => {
        const response = writer(manifest, false);
        response.content[0].input.units[0].text = duration;
        response.content[0].input.units[1].text = `${identity} ${first}` + (repaired ? ` ${restored}` : '');
        return response;
      };
      const complete = `${duration} ${identity} ${first} ${restored}`;
      const seen: string[] = [];
      const result = await executeSummaryV3GenerateServer({ manifest }, {
        write: async (prompt, phase) => {
          if (phase === 'repair_writer') {
            const payload = JSON.parse(prompt.split('\n').at(-1)!);
            expect(payload.repairEvidence.failedCheckIds).toEqual(['factRetention']);
            expect(payload.violations[0].factIds).toEqual([manifest.selectedEntries[0].facts[1].factId]);
            expect(payload.violations[0].entryIds).toEqual([`entry-${locale}`]);
            expect(payload.manifest.selectedEntries[0].facts.map((f: { text: string }) => f.text)).toEqual([factA, factB]);
          }
          return makeWriter(phase === 'repair_writer');
        },
        evaluate: async (prompt) => {
          const candidate = JSON.parse(prompt.split('\n').at(-1)!).candidate.text;
          seen.push(candidate);
          const response = evaluation(manifest, candidate !== complete);
          response.content[0].input.phases.semantic.violations[0]?.factIds.splice(0, 1, manifest.selectedEntries[0].facts[1].factId);
          response.content[0].input.phases.semantic.violations[0]?.entryIds.splice(0, 1, `entry-${locale}`);
          return response;
        },
      });
      expect(seen).toEqual([`${duration} ${identity} ${first}`, complete]);
      expect(result).toMatchObject({ ok: true, repairAttempted: true, candidate: { text: complete } });
    });
});

const badRepairs = [
  ['metric', 'I increased output by 50%.', 'unsupportedClaimsAbsent'],
  ['certification', 'I hold an electrical safety certification.', 'unsupportedClaimsAbsent'],
  ['seniority', 'I am a senior manager.', 'unsupportedClaimsAbsent'],
  ['tool', 'I use SAP every day.', 'unsupportedClaimsAbsent'],
  ['achievement', 'I won an industry award.', 'unsupportedClaimsAbsent'],
  ['employer', 'I work for a different employer.', 'roleEmployerStateAccurate'],
  ['date', 'I started in January 2020.', 'durationMeaningAndScope'],
  ['former', 'I formerly worked in this role.', 'roleEmployerStateAccurate'],
  ['previously worked', 'I previously worked in this role.', 'roleEmployerStateAccurate'],
  ['completed', 'My employment in this role has ended.', 'roleEmployerStateAccurate'],
  ['current conflict', 'I currently work here but no longer hold this role.', 'roleEmployerStateAccurate'],
  ['five years', 'I have five years of experience.', 'durationMeaningAndScope'],
  ['ten years', 'I have ten years of experience.', 'durationMeaningAndScope'],
  ['less than one year', 'I have less than one year of experience.', 'durationMeaningAndScope'],
] as const;

describe('M4 repair guidance never authorizes bad content', () => {
  it.each(badRepairs)('rejects repaired %s even after receiving guidance', async (_name, unsupported, check) => {
    const { manifest } = fixture();
    let calls = 0;
    const result = await executeSummaryV3GenerateServer({ manifest }, {
      write: async (_prompt, phase) => {
        const response = writer(manifest, phase === 'repair_writer');
        if (phase === 'repair_writer') response.content[0].input.units[1].text += ` ${unsupported}`;
        return response;
      },
      evaluate: async (prompt) => {
        calls++;
        const text = JSON.parse(prompt.split('\n').at(-1)!).candidate.text;
        if (calls === 2) expect(text).toContain(unsupported);
        return evaluation(manifest, true, calls === 1 ? 'factRetention' : check);
      },
    });
    expect(calls).toBe(2);
    expect(result).toMatchObject({ ok: false, typedReason: 'repair_validation_rejected', repairAttempted: true });
  });
});
