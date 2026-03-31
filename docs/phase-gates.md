# Phase Implementation and Acceptance Gates

## Phase 0: Foundation
- Done when Electron + React + TypeScript skeleton builds and app boots.
- Gate: lint/test scripts wired and project structure established.

## Phase 1: Ingestion and index
- Done when scan start/progress/cancel pipeline exists with folder input model.
- Gate: supported/unsupported categorization and scan status visible.

## Phase 2: Duplicate detection
- Done when exact and likely duplicate group models are produced.
- Gate: confidence score and sensitivity mode feed grouping behavior.

## Phase 3: Review and decision
- Done when duplicate compare and keep/defer decisions are executable.
- Gate: difference highlighting and per-candidate decision action available.

## Phase 4: Safety and audit
- Done when quarantine move/restore workflow exists and actions are logged.
- Gate: no delete-like behavior bypasses quarantine by default.

## Phase 5: Rules and bulk
- Done when reusable profile/rule model influences decisions.
- Gate: bulk-preview path and conflict exclusion policy present.

## Phase 6: Metadata and artwork
- Done when batch metadata normalization and artwork search/apply flows exist.
- Gate: before/after preview and confirm-required apply action.

## Phase 7: Dashboard and hardening
- Done when dashboard counters and unresolved/resolved progress are visible.
- Gate: baseline performance scripts, release checklist, and docs are prepared.
