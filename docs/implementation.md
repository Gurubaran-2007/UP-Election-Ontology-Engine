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

- [x] Import all 2019 LS UP candidate-level data, not only winners
- [x] Populate both `Candidate` nodes and `ElectionResult.all_candidates_json`
- [x] Import LS 2024 results for all 80 UP Lok Sabha seats
- [x] Import VS 2022 results for all 403 Vidhan Sabha seats
- [x] Add turnout data using electoral roll totals
- [x] Add affidavit data for winning candidates
- [x] Store `winner_votes`, `runner_up`, `runner_up_party_id`, and `runner_up_votes`
- [x] Store `margin_votes`, `margin_pct`, and `winner_vote_share` directly on `ElectionResult`
- [x] Store `nota_votes` where available
- [x] Add `Turnout` nodes to the graph
- [x] Add `Affidavit` nodes to the graph
- [x] Add `IS_INCUMBENT_IN` relationships
- [x] Complete `District -> LS -> VS` traversal for all districts
- [x] Validate that all civic nodes are queryable and source-cited

### Civic Import Script Fixes

- [x] Stop inheriting `VidhanSabhaConstituency.reservation` from the parent LS reservation
- [ ] Source real VS reservation values from ECI delimitation data
- [x] Fix `Candidate.party_id` so it stores canonical party IDs rather than lowercase party names
- [x] Stop defaulting candidate gender to unsupported values like `unknown`
- [x] Add provenance fields when creating `Party` nodes
- [x] Add `Party.type` during import
- [x] Add `election_id` to `Alliance` nodes
- [x] Use election-specific alliance IDs such as `nda_2024`
- [x] Rename legacy `HAS_LS` relationship usage to `CONTAINS`
- [x] Rename legacy `CONTESTS` relationship usage to `CONTESTS_IN`
- [x] Add relationship properties like `election_id`, `vote_share`, and `rank` where required

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
- [x] Add `GET /api/up/constituency/:name/results`
- [x] Add `GET /api/up/constituency/:name/candidates`
- [x] Add `GET /api/up/constituency/:name/classification`
- [x] Add `GET /api/up/constituency/:name/issues`
- [x] Add `GET /api/up/constituency/:name/recommendation`
- [x] Add `GET /api/up/seats/competitive`
- [x] Add `POST /api/up/recommendation/:rec_id/review`
- [x] Enforce authentication and validation on write endpoints
- [x] Remove API behavior that depends on out-of-scope booth-level targeting logic

### Constraints and Validation

- [x] Implement all PRD/ontology unique constraints for civic nodes
- [x] Implement all PRD/ontology unique constraints for governance nodes
- [x] Implement all PRD/ontology unique constraints for decision nodes
- [x] Remove obsolete constraints for excluded labels
- [ ] Add validation that competency questions can be answered by Cypher queries
- [ ] Use the ontology competency questions as acceptance tests for schema completeness

### AI Narration Layer

- [x] Limit AI to narration only, not fact generation or scoring
- [x] Feed AI precomputed graph facts instead of open-ended prompts
- [x] Remove fabricated numeric scoring fallbacks
- [ ] Label AI output as narrative summary rather than analysis
- [ ] Attach source citations from `EvidenceBundle` to generated narratives

---

## Phase 2: Generic India Architecture

**Goal:** Make the engine state-agnostic so any Indian state is plug-and-play. UP is the MVP data set; all other states are configuration + data swap.

**Design principles:**
- State config drives file paths, constituency counts, and API prefixes
- `/api/state/:stateCode/` is the canonical route; `/api/up/` is a UP alias
- Import scripts accept a `--state <code>` flag; file resolution comes from state config
- `state_code` property on every graph node enables multi-state queries
- No UP-specific hardcoding in route handlers or Cypher queries

### 2.1 State Configuration Layer

- [x] Create `data/states/up.json` — UP state config (region list, file paths, LS/VS seat counts)
- [x] Moved all UP data files to `data/states/UP/` (ls2024, ls2019, vs2022 results CSVs)
- [x] Add `State` node to Neo4j during import (`import_all.js` Step 1b)
- [x] Add `BELONGS_TO_STATE` relationship from every `LokSabhaConstituency` and `VidhanSabhaConstituency`
- [x] Add `state_code` property to `LokSabhaConstituency` and `VidhanSabhaConstituency` during import
- [ ] Add `state_code` property to `ElectionResult`, `Candidate`, `SeatClassification` nodes

### 2.2 Import Script Generalization

- [x] Add `--state UP` flag to `import_all.js` — reads state config, resolves file paths dynamically
- [x] Add `--state UP` flag to `import_tcpd.js`
- [x] Replace all UP-hardcoded file paths in import scripts with config-driven paths
- [ ] Write `scripts/import_state.js` — generic wrapper that calls all import steps for any state

### 2.3 API Route Generalization

- [x] Create `src/utils/state.js` — state config loader + `resolveState(stateCode)` helper
- [x] Create `src/routes/state.js` — generic `/api/state/:stateCode/*` routes
- [x] Add `/api/state/:stateCode/constituencies` route
- [x] Add `/api/state/:stateCode/constituency/:name/results`
- [x] Add `/api/state/:stateCode/constituency/:name/candidates`
- [x] Add `/api/state/:stateCode/constituency/:name/classification`
- [x] Add `/api/state/:stateCode/seats/competitive`
- [x] Mount generic routes in `src/server.js`; `/api/up/*` aliases remain for backward compat
- [ ] Keep `/api/up/*` as full Express forward to `/api/state/UP/*` (currently parallel mounts)

### 2.4 Data Availability (what we have for other states)

Available immediately (from downloaded datasets):

| Dataset | Coverage | Location |
|---------|----------|----------|
| LS 2024 all-candidate results | All 543 PC, all states | `data/eci/india_ls2024_results.csv` |
| LS 2024 winners + runners-up | All 543 PC, all states | `data/eci/india_ls2024_winners.csv` |
| VS elections 1951–2012 | All states | `india-election-data-master/assembly-elections/assembly.csv` |
| India state boundary shapefile | All states | `maps-master/Admin2.shp` (needs geopandas conversion) |
| District shapefiles | All states | `maps-master/Census_2001/` and `Census_2011/` |
| ECI AC boundary shapefiles | All states (S01-S36) | `maps-master/eci/AC_Data/States/` |

To add a new state (once generic infra is in place):
1. Create `data/states/<code>.json`
2. Drop state-specific result CSVs into `data/eci/`
3. Run `node scripts/import_state.js --state <CODE>`
4. Done — all APIs automatically serve the new state

### 2.5 Shapefile → GeoJSON Conversion (for India map)

- [ ] Install geopandas + shapely into `.venv`
- [ ] Write `scripts/convert_shapefiles.py` — converts Admin2.shp (states) to `public/maps/india_states.geojson`
- [ ] Convert Census_2011 district shapefiles to `public/maps/india_districts.geojson`
- [ ] Convert ECI AC shapefiles per state to `public/maps/states/<code>_ac.geojson`
- [ ] Wire GeoJSON files into the frontend map layer

---

## Notes

- This file is a working implementation checklist, not a replacement for the PRD.
- `ONTOLOGY_ANALYSIS.md` should be treated as the schema-gap reference for Phase 1.
- Anything that introduces voter-level profiling, caste inference, manipulative targeting, or uncited AI scoring remains out of scope.
- Local secrets may still exist in `.env`, which is expected for local development and should remain untracked.
- Phase 2 state configs use 2-letter ISO-style codes: `UP`, `MH`, `RJ`, `GJ`, `MP`, etc.
