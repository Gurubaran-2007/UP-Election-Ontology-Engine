# Implementation Checklist

This checklist tracks what is built, what is partially built, and what still needs to be implemented in the UP Election Ontology Engine.

It has been updated using:
- `PRD.md`
- `ONTOLOGY_ANALYSIS.md`
- `datasources.md`
- `cleanup.md`
- the current backend and import code

## Done

- [x] Express server scaffold exists
- [x] Neo4j driver integration exists
- [x] Static frontend assets exist in `public/`
- [x] Region-to-district mapping API exists at `GET /api/up/region/:regionId/districts`
- [x] Import scripts exist in `scripts/`
- [x] 2019 UP LS result data files exist in `data/eci/`
- [x] LS-to-VS mapping data exists in `data/mappings/up_ls_vs_mapping.json`
- [x] Core planning documents now exist in the repo
- [x] `ONTOLOGY_ANALYSIS.md` defines competency questions and schema-gap analysis

## In Progress / Partially Built

- [ ] LS and VS constituency structure exists, but schema coverage is incomplete
- [ ] Neo4j data exists locally, but local Docker Neo4j and AuraDB are not unified
- [ ] Candidate and result imports exist, but they do not yet satisfy the PRD schema
- [ ] Constituency and booth APIs exist, but they still fall back to mock or fabricated data
- [ ] Issue and risk concepts exist, but are not connected into the PRD decision pipeline
- [ ] Frontend map and constituency experience exist, but are not fully graph-backed
- [ ] Older ontology remnants still exist in code and need to be removed or migrated

## Execution Board

### P0: Must Fix First

- [x] Remove all hardcoded secrets from `server.js`
- [x] Move Neo4j, Sarvam, and NewsData credentials to environment variables only
- [ ] Rotate compromised credentials already committed to git history
- [x] Remove fabricated fallback analysis responses presented as real data
- [x] Replace broken `axios` usage in `server.js` or install and correctly wire the dependency
- [x] Remove or lock down unsafe diagnostic endpoints in production
- [x] Add shared `Constituency` base label to both `LokSabhaConstituency` and `VidhanSabhaConstituency`
- [x] Remove legacy `RiskCategory`, `CommunityBlock`, and `CasteGroup` creation from the active ontology path
- [x] Remove `bjp_affinity_2024` from imports and graph data
- [ ] Normalize enum/property mismatches such as `delivery_status`, `candidate_risk`, `winner_party_id`, and `all_candidates_json`
- [x] Add provenance fields to every node and relationship
- [x] Fail imports when required provenance fields are missing
- [x] Replace fake `GET /api/up/district/:district/constituencies` output with a real Neo4j query
- [x] Replace `GET /api/up/constituency/:constName/analysis` AI-first analysis with graph-backed data

### P1: Core Product Build

- [ ] Import all 2019 LS UP candidate-level data, not only winners
- [ ] Populate both `Candidate` nodes and `ElectionResult.all_candidates_json`
- [ ] Import LS 2024 results for all 80 UP Lok Sabha seats
- [ ] Import VS 2022 results for all 403 Vidhan Sabha seats
- [ ] Add turnout data using electoral roll totals
- [ ] Add affidavit data for winning candidates
- [ ] Store complete election result fields including winner, runner-up, margin, vote share, and NOTA
- [ ] Complete `District -> LS -> VS` traversal for all districts
- [ ] Implement all PRD/ontology unique constraints
- [ ] Add `GET /api/up/constituency/:name/results`
- [ ] Add `GET /api/up/constituency/:name/candidates`
- [ ] Add `GET /api/up/constituency/:name/classification`
- [ ] Add validation that competency questions can be answered by Cypher queries

### P2: Governance, Decisions, and Narration

- [ ] Add `IssueObservation` nodes linked to constituencies
- [ ] Import PM Awas Yojana and MGNREGA delivery coverage
- [ ] Compute `coverage_pct` and `delivery_status`
- [ ] Implement `SeatClassification` generation for all constituencies
- [ ] Add `RuleDefinition`, `DecisionRecommendation`, and `EvidenceBundle`
- [ ] Enforce review lifecycle before recommendations can be actioned
- [ ] Add authenticated review APIs
- [ ] Make all decision outputs auditable through source-linked evidence bundles
- [ ] Limit AI to narration only and attach citations to generated narratives

## Detailed Checklist

### Security and Production Fixes

- [x] Remove all hardcoded secrets from `server.js`
- [x] Move Neo4j, Sarvam, and NewsData credentials to environment variables only
- [ ] Rotate compromised credentials already committed to git history
- [x] Remove fabricated fallback analysis responses presented as real data
- [x] Replace broken `axios` usage in `server.js` or install and correctly wire the dependency
- [x] Remove or lock down unsafe diagnostic endpoints in production
- [ ] Add authentication for all recommendation write and review endpoints
- [ ] Remove undocumented schema/query remnants such as `Strategy` and `Leader` dependencies if they are not part of the PRD model

### Ontology Cleanup

- [x] Add shared `Constituency` base label to both `LokSabhaConstituency` and `VidhanSabhaConstituency`
- [x] Update import scripts to create LS nodes as `:Constituency:LokSabhaConstituency`
- [x] Update import scripts to create VS nodes as `:Constituency:VidhanSabhaConstituency`
- [ ] Add `RuleDefinition` to the implemented schema
- [ ] Add `TRIGGERED_BY` relationship from `DecisionRecommendation` to `RuleDefinition`
- [x] Remove legacy `RiskCategory` node creation
- [x] Remove legacy `CommunityBlock` node creation
- [x] Remove legacy `CasteGroup` node creation
- [x] Remove legacy `Booth` constraints and schema work from Phase 1 scope
- [x] Remove legacy `BoothResult` constraints and schema work from Phase 1 scope
- [x] Remove `bjp_affinity_2024` from imports and graph data
- [x] Exclude `community_blocks.json` from Phase 1 imports unless redesigned to match the PRD

### Schema Consistency Fixes

- [ ] Normalize `SeatClassification.delivery_status` values so schema and rules match
- [ ] Normalize `SeatClassification.candidate_risk` values so schema and rules match
- [ ] Decide whether `seat_status = lost` is actually used; remove it or add the missing rule
- [ ] Replace generic undocumented node assumptions with explicit PRD-defined labels
- [ ] Standardize property naming to PRD conventions such as `snake_case`
- [ ] Reconcile existing district property names with PRD field names
- [ ] Standardize `winner_party_id` vs legacy `winner_party`
- [ ] Standardize `all_candidates_json` vs legacy `votes_json`
- [ ] Add provenance fields to every node and relationship
- [ ] Fail imports when required provenance fields are missing

### Civic Layer

- [ ] Import all 2019 LS UP candidate-level data, not only winners
- [ ] Populate both `Candidate` nodes and `ElectionResult.all_candidates_json`
- [ ] Import LS 2024 results for all 80 UP Lok Sabha seats
- [ ] Import VS 2022 results for all 403 Vidhan Sabha seats
- [ ] Add turnout data using electoral roll totals
- [ ] Add affidavit data for winning candidates
- [ ] Store `winner_votes`, `runner_up`, `runner_up_party_id`, and `runner_up_votes`
- [ ] Store `margin_votes`, `margin_pct`, and `winner_vote_share` directly on `ElectionResult`
- [ ] Store `nota_votes` where available
- [ ] Add `Turnout` nodes to the graph
- [ ] Add `Affidavit` nodes to the graph
- [ ] Add `IS_INCUMBENT_IN` relationships
- [ ] Complete `District -> LS -> VS` traversal for all districts
- [ ] Validate that all civic nodes are queryable and source-cited

### Civic Import Script Fixes

- [ ] Stop inheriting `VidhanSabhaConstituency.reservation` from the parent LS reservation
- [ ] Source real VS reservation values from ECI delimitation data
- [ ] Fix `Candidate.party_id` so it stores canonical party IDs rather than lowercase party names
- [ ] Stop defaulting candidate gender to unsupported values like `unknown`
- [ ] Add provenance fields when creating `Party` nodes
- [ ] Add `Party.type` during import
- [ ] Add `election_id` to `Alliance` nodes
- [ ] Use election-specific alliance IDs such as `nda_2024`
- [ ] Rename legacy `HAS_LS` relationship usage to `CONTAINS`
- [ ] Rename legacy `CONTESTS` relationship usage to `CONTESTS_IN`
- [ ] Add relationship properties like `election_id`, `vote_share`, and `rank` where required

### Governance Layer

- [ ] Add `IssueObservation` nodes linked to constituencies
- [ ] Make top issues queryable per constituency
- [ ] Import PM Awas Yojana delivery coverage
- [ ] Import MGNREGA delivery coverage
- [ ] Add `Scheme` and `SchemeDelivery` nodes
- [ ] Compute `coverage_pct` for each tracked scheme
- [ ] Compute `delivery_status` for all constituencies
- [ ] Import and normalize census and socioeconomic data into the graph
- [ ] Add public grievance and issue evidence sources
- [ ] Define how `MediaTopic.sentiment` is assigned before implementing that part of the schema

### Decision Layer

- [ ] Implement `SeatClassification` generation for all constituencies
- [ ] Implement deterministic rule evaluation from Rule Set v1.0
- [ ] Add `DecisionRecommendation` nodes
- [ ] Add `EvidenceBundle` nodes with citations to source facts
- [ ] Store `RuleDefinition` nodes with version metadata
- [ ] Enforce review lifecycle before recommendations can be actioned
- [ ] Add bias-audit metadata and release checks for rule versions
- [ ] Make all decision outputs auditable through source-linked evidence bundles

### API Layer

- [x] Replace fake `GET /api/up/district/:district/constituencies` output with a real Neo4j query
- [x] Replace `GET /api/up/constituency/:constName/analysis` AI-first analysis with graph-backed data
- [ ] Add `GET /api/up/constituency/:name/results`
- [ ] Add `GET /api/up/constituency/:name/candidates`
- [ ] Add `GET /api/up/constituency/:name/classification`
- [ ] Add `GET /api/up/constituency/:name/issues`
- [ ] Add `GET /api/up/constituency/:name/recommendation`
- [ ] Add `GET /api/up/seats/competitive`
- [ ] Add `POST /api/up/recommendation/:rec_id/review`
- [ ] Enforce authentication and validation on write endpoints
- [ ] Remove API behavior that depends on out-of-scope booth-level targeting logic

### Constraints and Validation

- [ ] Implement all PRD/ontology unique constraints for civic nodes
- [ ] Implement all PRD/ontology unique constraints for governance nodes
- [ ] Implement all PRD/ontology unique constraints for decision nodes
- [ ] Remove obsolete constraints for excluded labels
- [ ] Add validation that competency questions can be answered by Cypher queries
- [ ] Use the ontology competency questions as acceptance tests for schema completeness

### AI Narration Layer

- [ ] Limit AI to narration only, not fact generation or scoring
- [ ] Feed AI precomputed graph facts instead of open-ended prompts
- [ ] Remove fabricated numeric scoring fallbacks
- [ ] Label AI output as narrative summary rather than analysis
- [ ] Attach source citations from `EvidenceBundle` to generated narratives

## Notes

- This file is a working implementation checklist, not a replacement for the PRD.
- `ONTOLOGY_ANALYSIS.md` should be treated as the schema-gap reference for Phase 1.
- Anything that introduces voter-level profiling, caste inference, manipulative targeting, or uncited AI scoring remains out of scope.
- Local secrets may still exist in `.env`, which is expected for local development and should remain untracked.
