# Cleanup Checklist

Tracks all cleanup required before Phase 1 implementation begins. Based on `PRD.md` Part 0 audit, `ONTOLOGY_ANALYSIS.md` findings, and direct code inspection.

---

## Priority 0 — Security (Do First, Before Any Other Work)

- [x] Rotate Neo4j password `guru@9114` — DONE
- [x] Rotate Sarvam AI key `sk_v9tiidlu_SUEXI3slP6thUJCk0F7DMDc8` — DONE
- [x] Rotate all 13 NewsData API keys — DONE
- [x] Remove hardcoded `'guru@9114'` fallback from `server.js`
- [x] Remove hardcoded Sarvam key from `server.js`
- [x] Remove all hardcoded NewsData keys from `server.js`
- [x] Remove hardcoded `'guru@9114'` fallback from `scripts/import_all.js`
- [x] Create `.env.example` with placeholder variable names only (no real values)
- [x] Verify `.env` is in `.gitignore`

---

## Priority 1 — Normalization (PRD Schema Alignment)

- [x] Normalize District node properties to `snake_case` (e.g., `total_population`)
- [x] Normalize ElectionResult node properties (e.g., `winner_party_id`, `margin_pct`)
- [x] Normalize Candidate node properties (e.g., `party_id`, `vote_share`)
- [x] Populate `all_candidates_json` in `ElectionResult` (PRD C-04)
- [x] Update `server.js` to use `snake_case` properties in all queries
- [x] Update `public/upmap.js` to consume `snake_case` properties from API
- [x] Harmonized frontend/backend census data mapping

---

---

## Phase 0 — Implementation Priority Order (ONTOLOGY_ANALYSIS.md)

- [x] **Step 1:** Rotate all compromised credentials — DONE
- [x] **Step 2:** Fix `createConstraints()` (Remove legacy, add PRD labels) — DONE
- [x] **Step 3:** Fix `importConstituencies()` (Shared label, CONTAINS rel, provenance, VS reservation fix) — DONE
- [x] **Step 4:** Fix `importElections()` (ENUM sync, phase parsing, provenance) — DONE
- [x] **Step 5:** Fix `importConstituencyResults()` (All candidates, party_id fix, margin/vote share compute) — DONE
- [x] **Step 6:** Add `importTurnout()` step (ECI rolls data) — DONE
- [x] **Step 7:** Add `importAffidavits()` step (MyNeta data) — DONE
- [x] **Step 8:** Remove/Rewrite `importSocialStructure()` (Retain Issue nodes only) — DONE
- [x] **Step 9:** Add validation layer (Pre-merge provenance/field checks) — DONE
- [x] **Step 10:** Fix API routes (Replace fake data with Neo4j queries) — DONE

---

## Priority 2 — `import_all.js` Code Surgery

- [x] Remove excluded node types (Booth, CasteGroup, etc.) from `createConstraints()`
- [x] Implement unique constraints for ALL PRD node types (District, LS, VS, Party, Cand, Election, Issue, Result, Turnout, Alliance, Scheme, Affidavit, Classification, Observation, Recommendation, Bundle, Topic, Rule)
- [x] Update `verifyCounts()` to include all PRD node types
- [x] Fix `importConstituencyResults()` with missing fields (margin, winner_vote_share, etc.)
- [x] Standardized `toPartyId()` mapping logic
- [x] Added provenance fields to all imported entities

---

## Priority 3 — `server.js` Code Surgery

- [x] Remove `GET /api/db-check` diagnostic route — exposes database connectivity to unauthenticated callers; must not exist in production
- [x] Remove fabricated mock data from `GET /api/up/constituency/:constName/analysis`
- [x] Remove broken `axios` dependency usage — `axios` is not installed; routes using it always throw `ReferenceError` and fall back to mock data
- [x] Replace mock district constituencies response in `GET /api/up/district/:district/constituencies` with real graph traversal
- [ ] Fix `closeDistrictPanel()` undefined reference in `public/upmap.js`
- [ ] Add authentication middleware for all `DecisionRecommendation` write endpoints (PRD §7.6)
- [ ] Enforce `reviewed_by` + `reviewed_at` check before status can be set to `actioned` (PRD §7.2, requirement D-03)

---

## Priority 4 — `data/` Files

- [x] `data/mappings/community_blocks.json` is excluded from the active import path until redesigned
- [ ] `data/eci/elections.json` — `type` field uses `"Lok Sabha"` / `"Vidhan Sabha"` strings; must be changed to `"LS"` / `"VS"` to match PRD schema ENUM
- [ ] `data/eci/elections.json` — contains partisan seat counts (`bjp_seats`, `sp_seats`, etc.) at top level; remove these fields

---

## Priority 5 — Schema Gaps (Before Phase 1 Code is Written)

These are gaps in the PRD schema itself, identified by ONTOLOGY_ANALYSIS.md. Fix before writing import scripts for new node types.

- [ ] Define `RuleDefinition` node schema — referenced in PRD §4.4 and requirement D-04 but never defined with fields
- [ ] Resolve `seat_status = "lost"` — listed in `SeatClassification` ENUM but no rule produces it; either write the rule or remove the value
- [ ] Fix ENUM mismatch: rule outputs `"multiple_cases_flagged"` but schema ENUM says `"multiple_cases"` — pick one
- [ ] Fix ENUM mismatch: rule outputs `"partial_coverage"` but schema ENUM says `"partial"` — pick one
- [ ] Write org_status classification rule (R-07) — `SeatClassification.org_status` has no producing rule in Rule Set v1.0
- [ ] Write `LEADERSHIP_VISIT` triggering rule (R-08) — action type exists but has no rule
- [ ] Integrate `turnout_trend` into at least one decision rule — currently classified but never consumed
- [ ] Replace generic `(Constituency)` label in PRD §4.2 relationship definitions with explicit labels — add dual `:LokSabhaConstituency:Constituency` label strategy or enumerate which label each relationship applies to
- [ ] Define `MediaTopic.sentiment` computation method — field exists in schema but computation is undefined; risk of violating PRD §1.2 exclusion on individual-level sentiment

---

## Done

- [x] Deleted `ONTOLOGY_IMPLEMENTATION_PLAN.md` — superseded by PRD, contained booth-level partisan targeting schema
- [x] Created `ONTOLOGY_ANALYSIS.md` — full 7-step Stanford ontology analysis, pre-implementation reference
- [x] Created `implementation.md` — PRD-aligned working checklist
- [x] Moved active project documentation into `docs/`
- [x] Created `.env.example` and local `.env` scaffolding for env-based configuration
- [x] Cleaned up `docker-compose.yml` to use env-based Neo4j auth instead of a hardcoded password
- [x] Verified local Neo4j Docker startup with env-based credentials

---

## Notes

- Credential rotation (Priority 0) must happen before any new code is pushed to any remote
- Priorities 1 and 2 can be done in parallel by different team members
- Priority 5 schema gaps must be resolved before Phase 1 import scripts are written — writing code against a schema with known inconsistencies will require a rewrite
- `implementation.md` is the working task tracker; this file tracks cleanup only
- `datasources.md` is the consolidated source inventory before further build work
