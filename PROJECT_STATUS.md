# CV Pro AI Project Status

## Status Authority

This file is the canonical repository owner for CV Pro AI milestone state, current stable Android baseline, and next-phase status. When milestone or stable-baseline state changes, this file must be updated in the same authorized change. It owns project status only; it does not own runtime configuration, API secrets, deployment configuration, user data, or product documentation.

Project: CV Pro AI / AI & Smart Resume Builder
Current project phase: STABILITY PERIOD BEFORE M10

## Milestones

| Milestone | Status |
| --- | --- |
| M1 | COMPLETE |
| M2 | COMPLETE |
| M3 | COMPLETE |
| M4 | COMPLETE |
| M5 | COMPLETE |
| M6 | COMPLETE |
| M7 | COMPLETE |
| M8 | COMPLETE |
| M9 | COMPLETE |
| M10 | NOT_STARTED |

## Current Stable Android Baseline

CURRENT_STABLE_AAB=CV-Pro-AI-606-M9-V3-DEFAULT-RESTORE-COMMERCIAL.aab
CURRENT_STABLE_VERSION=606 / 1.0.606
CURRENT_STABLE_PACKAGE=com.cvproai.app
CURRENT_STABLE_SHA256=d3e890b5f709137f0f4ff61350950b17647ed62ef5737be7e8aaa234ec58404b
CURRENT_STABLE_AI_CORE_MODE=v3_default
CURRENT_STABLE_SOURCE_COMMIT=9d4aa856afdb8c7e8e870a08df23f2574122448c
AAB606_IS_CURRENT_STABLE_BASELINE=true

AAB606 was installed over AAB605 without uninstalling or clearing application data/cache. CV data and the Pro entitlement were preserved.

## Retained M9 Rollback Artifact

ROLLBACK_ARTIFACT=CV-Pro-AI-605-M9-EXPLICIT-V2-ROLLBACK-CONTROLLED.aab
ROLLBACK_VERSION=605 / 1.0.605
ROLLBACK_SHA256=112d6e1c46974c1bb307fc06a35b2a3368c3f3cb38e5613142a2481556935800
ROLLBACK_ROLE=CONTROLLED_M9_ROLLBACK_TEST_ARTIFACT
AAB605_IS_CURRENT_STABLE_BASELINE=false

AAB605 is retained as the verified controlled rollback test artifact; it is not the production-default build.

## M9 Final Architecture State

M9=COMPLETE
M9_DEFAULT_V3_DEVICE_MATRIX=PASS
M9_ROLLBACK_DEVICE_MATRIX=PASS
M9_FINAL_RESTORE_UPDATE=PASS
M9_CV_DATA_PRESERVATION=PASS
M9_PRO_ENTITLEMENT_PRESERVATION=PASS

The normal/default AI core is V3. Explicit V2 rollback remains available through one selector and one policy owner:

M9_SINGLE_SELECTOR_OWNER=true
M9_SELECTOR=NEXT_PUBLIC_AI_CORE_V3_ENABLED
M9_POLICY_OWNER=src/lib/ai-core-v3/feature-flag.ts
M9_NORMAL_MODE=v3_default
M9_ROLLBACK_MODE=v2_rollback
M9_V2_CODE_RETAINED=true
M9_CONTENT_LOCALIZE_ROLLBACK_FAIL_CLOSED=true

Selector semantics: absent -> `v3_default`; true -> `v3_default`; false -> `v2_rollback`; invalid non-empty -> `v2_rollback` fail-closed. These describe the routing contract; this document does not set runtime selector configuration.

## Known Legacy V2 Quality Debt

Legacy V2 quality debt remains intentionally separate from M9 routing completion. The accepted historical profile is 27 files, 138 tests, 107 passing and 31 pre-existing failures. The AAB605 physical Summary and Experience rollback tests proved legacy V2 ownership, while individual legacy content operations could still fail closed. These failures are recorded, not hidden, and are not treated as M9 routing regressions.

LEGACY_V2_QUALITY_DEBT_RECORDED=true
LEGACY_V2_QUALITY_DEBT_REOPENED=false
LEGACY_V2_QUALITY_DEBT_BLOCKS_M9=false

## Production Backend

PRODUCTION_HOST=https://ai-resume-builder-six-gamma.vercel.app
ACCEPTED_DEPLOYMENT=dpl_GrHJkBH4sX8C4p5zKnMuKtdUuZPN

This records accepted backend authority; it does not authorize deployment, alias changes, or Vercel environment changes.

## Next Phase

M10=NOT_STARTED
NEXT_PROJECT_PHASE=STABILITY_PERIOD_BEFORE_M10
M10_START_CONDITION=SEPARATE_EXPLICIT_AUTHORIZATION_AFTER_STABLE_PERIOD
STABLE_PERIOD_DURATION=NOT_PREVIOUSLY_FIXED
M10_AUTOMATIC_START=false
M10_WORK_PERFORMED=false

V2_FILES_DELETED=0
V2_RUNTIME_BRANCHES_DELETED=0
ROLLBACK_SELECTOR_REMOVED=false
FEATURE_FLAG_OWNER_REMOVED=false

No V2 removal or compatibility cleanup is authorized during the stability period. M10 requires separate explicit authorization; no duration is implied here.
