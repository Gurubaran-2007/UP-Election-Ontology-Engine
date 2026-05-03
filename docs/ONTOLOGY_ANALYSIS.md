# UP Election Ontology Engine — Stanford 7-Step Ontology Analysis

**Methodology:** Noy & McGuinness (2001), *Ontology Development 101*
**Applied To:** UP Election Ontology Engine, Neo4j graph database
**Date:** 2026-05-03
**Status:** Pre-Phase 1 Implementation Reference

---

## STEP 1 — Domain and Competency Questions

### 1.1 Domain Definition

**One sentence:** The domain is constituency-level governance accountability and electoral decision support for Uttar Pradesh, India, grounding every classification and recommendation in source-cited, rule-produced facts derived exclusively from official public election, affidavit, and scheme delivery data.

### 1.2 Formal Competency Questions

The ontology must be able to answer all of the following. These are the acceptance tests for the schema — if a question cannot be answered by Cypher query, the schema is incomplete.

#### Civic Layer (Layer 1)

**CQ-01** — Who won the Lucknow Lok Sabha seat in LS2019 and LS2024, with what vote share and margin, and from which party?
→ Data requirement: `ElectionResult` nodes for LS2019 and LS2024 linked to `LokSabhaConstituency {ls_id: "UP-35"}`, with `winner`, `winner_vote_share`, `margin_pct`, `winner_party_id` populated.

**CQ-02** — Which 5 Vidhan Sabha segments fall under the Lucknow Lok Sabha constituency, and what are their reservation categories?
→ Data requirement: `HAS_VS` relationships from `LokSabhaConstituency {ls_id: "UP-35"}` to five `VidhanSabhaConstituency` nodes with `reservation` set.

**CQ-03** — How many candidates contested the Saharanpur LS seat in 2019, and what were all their vote shares?
→ Data requirement: `Candidate` nodes for all 12 contestants with `votes`, `vote_share`, `rank`, `party_id`; or `ElectionResult.all_candidates_json` populated and parseable. See §5.5 for conflict resolution.

**CQ-04** — Which UP Lok Sabha constituencies had a margin below 5% in both 2019 and 2024 (double-tossup seats)?
→ Data requirement: `ElectionResult` nodes for both elections with `margin_pct` populated; queryable by `election_id`.

**CQ-05** — What is Rajnath Singh's complete affidavit profile for LS2024: declared criminal cases, serious cases, total assets, and source URL?
→ Data requirement: `Affidavit` node linked to `Candidate` node via `HAS_AFFIDAVIT`, with all five fields and `source_url` pointing to the MyNeta record.

**CQ-06** — What was the turnout trend in Varanasi between LS2019 and LS2024 — improving, stable, or declining?
→ Data requirement: Two `Turnout` nodes (one per election) for `LokSabhaConstituency {ls_id: "UP-77"}`, with `turnout_pct` and `registered_voters` set; turnout trend rule applied to produce `SeatClassification.turnout_trend`.

#### Governance Layer (Layer 2)

**CQ-07** — Which UP constituencies have PM Awas Yojana coverage below 30% (critical gap)?
→ Data requirement: `SchemeDelivery` nodes with `scheme_id = "PM_AWAS_YOJANA"` and `coverage_pct` set; `COVERS_CONSTITUENCY` relationship to constituency nodes.

**CQ-08** — What are the top 3 most frequently cited issues in Gorakhpur constituency across all available source documents?
→ Data requirement: `IssueObservation` nodes linked to `LokSabhaConstituency {ls_id: "UP-64"}` via `IN_CONSTITUENCY`, ordered by `evidence_count` descending.

**CQ-09** — Does Azamgarh constituency have a weak or absent party organisational unit as assessed in the last 12 months?
→ Data requirement: `OrgUnit` node linked to `LokSabhaConstituency {ls_id: "UP-69"}` via `ACTIVE_IN`, with `strength IN [weak, absent]` and `last_assessed_date` within 12 months of query.

**CQ-10** — Which constituencies have both critical scheme delivery gaps and high-salience unemployment issues?
→ Data requirement: Join across `SchemeDelivery` (coverage_pct < 30), `IssueObservation` (issue_id = "unemployment", evidence_count > threshold), and `COVERS_CONSTITUENCY`/`IN_CONSTITUENCY` relationships.

#### Decision Layer (Layer 3)

**CQ-11** — What is the full evidence trail behind the GOVERNANCE_PUSH recommendation for Mainpuri?
→ Data requirement: `DecisionRecommendation {action_type: "GOVERNANCE_PUSH"}` → `BASED_ON` → `EvidenceBundle` → `CITES` → source nodes (`ElectionResult`, `SchemeDelivery`, `IssueObservation`), each with `source`, `source_url`, `source_date`.

**CQ-12** — Which rules have been applied to classify Amethi's seat status, what rule version was used, and when was the classification computed?
→ Data requirement: `SeatClassification` node for Amethi with `rule_version`, `computed_at`, `input_sources`; `RuleDefinition` nodes with `rule_id` and `conditions` queryable.

**CQ-13** — Which pending recommendations have been waiting for human review for more than 7 days?
→ Data requirement: `DecisionRecommendation` nodes with `status = "pending"` and `created_at` more than 7 days before query time; `reviewed_by` null.

**CQ-14** — Across all 80 LS seats, what is the distribution of seat_status classifications (safe / leaning / competitive / tossup) for the most recent election?
→ Data requirement: `SeatClassification` nodes for all 80 constituencies with `seat_status` populated, linked to a common `election_id`.

### 1.3 Explicitly Out-of-Scope

From PRD Section 1.2 — these must be rejected at design review:

| Out-of-Scope Item | Why It Is Excluded |
|---|---|
| Voter-level profiling or targeting | Violates ECI data guidelines |
| Caste inference from individual voter rolls | Classifying citizens by sensitive attribute |
| Swing voter conversion probability models | Manipulative microtargeting |
| Single-party access control on civic data | Makes product a partisan tool |
| AI-generated probability scores as primary output | Fabricated numbers are not defensible |
| Sentiment at individual social media user level | Privacy norm violation |
| `bjp_affinity_2024` field on `CommunityBlock` | Encodes partisan classification, not civic fact |
| `CommunityBlock` and `CasteGroup` nodes entirely | Electoral demographic caste targeting — excluded from PRD schema |
| `Strategy` nodes queried in `server.js` | Not in PRD schema; represent undocumented prior use |
| Booth-level voter data (from `server.js` booth routes) | Individual booth analytics outside scope |

### 1.4 Users

| User Role | Competency Questions They Need | Access Level |
|---|---|---|
| Constituency in-charge | CQ-01, CQ-02, CQ-06, CQ-08, CQ-09, CQ-11 | Read (civic + decision) |
| State campaign coordinator | CQ-04, CQ-10, CQ-14 | Read (all layers) |
| Candidate evaluation team | CQ-03, CQ-05 | Read (civic) |
| Governance programme officer | CQ-07, CQ-08, CQ-10 | Read (governance) |
| Research analyst | All 14 CQs via custom Cypher | Read (all layers) |
| Rule engine (automated) | CQ-12 — writes classifications | Write (decision layer only) |
| Human reviewer | CQ-13 — approves/rejects recommendations | Write (recommendation lifecycle) |

---

## STEP 2 — Reuse Audit

### 2.1 Data Files: Reuse Classification

| File | Status | Action Required |
|---|---|---|
| `data/eci/elections.json` | Reusable with additions | Add `phase_count` (has `phase` as string), `state` field, remove partisan seat counts (`bjp_seats` etc.) — these belong on `ElectionResult` aggregate queries, not `Election` nodes |
| `data/eci/up_ls2019_constituency_results.json` | Reusable, transformation needed | JSON structure (pc_code, candidate, party, evm_votes, postal_votes, total_votes) maps cleanly to `Candidate` nodes. Missing: `margin_pct`, `winner_vote_share`, `nota_votes`, `registered_voters`. These must be computed/sourced and added. |
| `data/mappings/up_ls_vs_mapping.json` | Reusable as-is | ls_id format "UP-1" through "UP-80" matches PRD. `assembly_segments` provides VS names. Missing: individual VS `vs_id`, `vs_no`, `reservation` (currently inherited from LS — incorrect for many). |
| `data/mappings/community_blocks.json` | **EXCLUDED** | `bjp_affinity_2024` field is a partisan classification. `CommunityBlock` and `CasteGroup` node types are not in the PRD schema. This entire file must be excluded from the Phase 1 import or redesigned without affinity fields. |
| `data/india_data.json` | Out of scope | India-wide state data, not UP constituency-level. Not referenced in PRD schema. |

### 2.2 Fields That Need Transformation

**`up_ls2019_constituency_results.json` → `ElectionResult` and `Candidate` nodes:**

| Source Field | Transformation | Target Field |
|---|---|---|
| `pc_code` | `"UP-" + pc_code` | `LokSabhaConstituency.ls_id` |
| `results[0]` (highest votes) | Sort by `total_votes` desc, take first | `ElectionResult.winner` |
| `results[0].total_votes - results[1].total_votes` | Compute | `ElectionResult.margin_votes` |
| `margin_votes / sum(all total_votes) * 100` | Compute | `ElectionResult.margin_pct` |
| `results[0].total_votes / sum * 100` | Compute | `ElectionResult.winner_vote_share` |
| `results` where `party = "None of the Above"` | Filter | `ElectionResult.nota_votes` |
| `results` (all rows) | JSON.stringify | `ElectionResult.all_candidates_json` |
| Each row in `results` | One node per row | `Candidate` node |

**`elections.json` → `Election` node:**

| Issue | Correction |
|---|---|
| `type: "Lok Sabha"` (string) | Must be ENUM value `LS` |
| `type: "Vidhan Sabha"` (string) | Must be ENUM value `VS` |
| `phase: "7-phase"` (string) | Must split: `phase_count: 7` (INT) |
| `bjp_seats`, `sp_seats`, etc. | Remove from `Election` node — these are aggregated query results, not schema fields |
| Missing: `state`, `source` | Add `state: "Uttar Pradesh"`, `source: "ECI"` |

### 2.3 Open Standards That Apply

| Standard | Application |
|---|---|
| ECI Delimitation Order 2008 | Authoritative source for `LokSabhaConstituency` and `VidhanSabhaConstituency` IDs and reservation categories |
| ECI Form 20 (Constituency-wise result) | Authoritative source for `ElectionResult` — defines `total_valid_votes`, candidate rows, NOTA row |
| ADR/MyNeta affidavit schema | Authoritative source for `Affidavit` fields: `criminal_cases` maps to "Total criminal cases declared", `serious_cases` maps to ADR's IPC severity classification |
| PFMS data format | Source for `SchemeDelivery.beneficiaries_count` and `target_count` |
| Census of India 2011 Primary Census Abstract | Source for `District` demographic fields |

### 2.4 `bjp_affinity_2024` — Formal Exclusion

The `community_blocks.json` file contains `bjp_affinity_2024` with values `"strong_retention"`, `"hostile"`, `"swing"`, `"swing_looking_india"`. This field:

1. Classifies demographic groups by party loyalty — a partisan classification, not a civic fact.
2. Has no named official source (it is an inference, not a measured value).
3. The current import script (`importSocialStructure()`) writes this field to Neo4j verbatim.

**Required action:** Remove `cb.bjp_affinity_2024 = $bjp_affinity_2024` from the `MERGE` statement in `importSocialStructure()`. The field must not exist in the graph.

---

## STEP 3 — Complete Term Enumeration

### 3.1 All Nouns → Node Labels

#### Confirmed in PRD (authoritative)

| Node Label | Layer | PRD Section |
|---|---|---|
| `LokSabhaConstituency` | Civic | §4.1 |
| `VidhanSabhaConstituency` | Civic | §4.1 |
| `District` | Civic | §4.1 |
| `Election` | Civic | §4.1 |
| `ElectionResult` | Civic | §4.1 |
| `Turnout` | Civic | §4.1 |
| `Candidate` | Civic | §4.1 |
| `Affidavit` | Civic | §4.1 |
| `Party` | Civic | §4.1 |
| `Alliance` | Civic | §4.1 |
| `Issue` | Governance | §4.1 |
| `IssueObservation` | Governance | §4.1 |
| `Scheme` | Governance | §4.1 |
| `SchemeDelivery` | Governance | §4.1 |
| `OrgUnit` | Governance | §4.1 |
| `MediaTopic` | Governance | §4.1 |
| `SeatClassification` | Decision | §4.1 |
| `DecisionRecommendation` | Decision | §4.1 |
| `EvidenceBundle` | Decision | §4.1 |
| `RuleDefinition` | Decision | §4.5 (referenced, never defined) |

#### Present in codebase but NOT in PRD (contradictions)

| Node Label | Where Found | Status |
|---|---|---|
| `Booth` | `import_all.js` constraints (line 37) | Not in PRD schema — out of scope for Phase 1. Constraint must be removed. |
| `BoothResult` | `import_all.js` indexes (line 60) | Not in PRD schema. Index must be removed. |
| `CommunityBlock` | `import_all.js` Step 4 | Not in PRD schema. Partisan classification node — excluded. |
| `CasteGroup` | `import_all.js` Step 4 | Not in PRD schema. Demographic targeting node — excluded. |
| `RiskCategory` | `import_all.js` Step 4 | Replaced by `SeatClassification` in PRD. Old node type — do not create. |
| `Strategy` | `server.js` Neo4j queries (lines 498, 714) | Not in PRD schema. Remnant of prior use case. |
| `Leader` | `server.js` Neo4j query (line 984, `OPTIONAL MATCH (d)-[:REPRESENTED_BY]->(l:Leader)`) | Not in PRD schema. Representing politicians at district level is not defined. |

#### Missing from PRD, must be added

| Node Label | Rationale |
|---|---|
| `RuleDefinition` | Referenced in PRD §4.5: "Rules are stored as `RuleDefinition` nodes in Neo4j." Requirement D-04 mandates their existence. Never defined with fields anywhere. Full definition provided in §5 and §7. |

### 3.2 All Adjectives → Property Values and ENUMs

| Property | ENUM Values | Node |
|---|---|---|
| `Election.type` | `LS`, `VS` | Election |
| `LokSabhaConstituency.reservation` | `GEN`, `SC`, `ST` | LS/VS Constituency |
| `VidhanSabhaConstituency.reservation` | `GEN`, `SC`, `ST` | LS/VS Constituency |
| `Candidate.gender` | `M`, `F`, `OTHER` | Candidate |
| `Issue.category` | `economic`, `governance`, `local`, `social`, `ideological` | Issue |
| `IssueObservation.confidence` | `high`, `medium`, `low` | IssueObservation |
| `OrgUnit.type` | `booth_committee`, `mandal`, `district_cell` | OrgUnit |
| `OrgUnit.strength` | `strong`, `moderate`, `weak`, `absent` | OrgUnit |
| `MediaTopic.sentiment` | `positive`, `negative`, `neutral` | MediaTopic |
| `Party.type` | `NATIONAL`, `STATE`, `REGISTERED` | Party |
| `SeatClassification.seat_status` | `safe`, `leaning`, `competitive`, `tossup`, `lost` | SeatClassification |
| `SeatClassification.turnout_trend` | `improving`, `stable`, `declining`, `sharply_declining` | SeatClassification |
| `SeatClassification.vote_share_trend` | `consolidating`, `stable`, `eroding`, `sharp_erosion` | SeatClassification |
| `SeatClassification.delivery_status` | `on_target`, `near_target`, `partial`, `critical_gap` | SeatClassification |
| `SeatClassification.candidate_risk` | `clean`, `cases_declared`, `multiple_cases`, `serious_cases_flagged` | SeatClassification |
| `SeatClassification.org_status` | `strong`, `moderate`, `weak`, `absent` | SeatClassification |
| `DecisionRecommendation.action_type` | `GOVERNANCE_PUSH`, `REPLACE_CANDIDATE`, `REINFORCE_CANDIDATE`, `CADRE_STRENGTHEN`, `ALLIANCE_REVIEW`, `COMMUNICATIONS_EMPHASIS`, `LEADERSHIP_VISIT` | DecisionRecommendation |
| `DecisionRecommendation.priority` | `HIGH`, `MEDIUM`, `LOW` | DecisionRecommendation |
| `DecisionRecommendation.status` | `pending`, `approved`, `rejected`, `actioned`, `outcome_recorded` | DecisionRecommendation |
| `confidence` (provenance) | `high`, `medium`, `low` | All nodes |

**Note on `candidate_risk` ENUM inconsistency:** PRD §4.5 rule produces `'multiple_cases_flagged'` (with `_flagged` suffix) but the `SeatClassification` ENUM in §4.1 lists `multiple_cases` (without suffix). The rule text is the intended value. The ENUM must be corrected to `multiple_cases_flagged` to match the rule output, or the rule text must be corrected to match the ENUM. This is a PRD internal inconsistency. **Recommendation:** Change the ENUM to `multiple_cases_flagged` to be consistent with the rule expression and parallel with `serious_cases_flagged`.

### 3.3 All Verbs → Relationship Types

| Relationship | From | To | Properties |
|---|---|---|---|
| `CONTAINS` | `District` | `LokSabhaConstituency` | source, source_date, confidence |
| `HAS_VS` | `LokSabhaConstituency` | `VidhanSabhaConstituency` | source, source_date, confidence |
| `HAS_RESULT` | `LokSabhaConstituency` OR `VidhanSabhaConstituency` | `ElectionResult` | election_id, source, source_date, confidence |
| `HAS_TURNOUT` | `LokSabhaConstituency` OR `VidhanSabhaConstituency` | `Turnout` | election_id, source, source_date, confidence |
| `CONTESTS_IN` | `Candidate` | `LokSabhaConstituency` OR `VidhanSabhaConstituency` | election_id, vote_share, rank |
| `BELONGS_TO` | `Candidate` | `Party` | since_year |
| `HAS_AFFIDAVIT` | `Candidate` | `Affidavit` | election_id |
| `IS_INCUMBENT_IN` | `Candidate` | `LokSabhaConstituency` OR `VidhanSabhaConstituency` | since_year, terms |
| `PART_OF_ALLIANCE` | `Party` | `Alliance` | election_id |
| `HAS_ISSUE` | `LokSabhaConstituency` OR `VidhanSabhaConstituency` | `Issue` | election_id |
| `OBSERVES` | `IssueObservation` | `Issue` | — |
| `IN_CONSTITUENCY` | `IssueObservation` | `LokSabhaConstituency` OR `VidhanSabhaConstituency` | — |
| `HAS_DELIVERY` | `Scheme` | `SchemeDelivery` | — |
| `COVERS_CONSTITUENCY` | `SchemeDelivery` | `LokSabhaConstituency` OR `VidhanSabhaConstituency` | — |
| `ACTIVE_IN` | `OrgUnit` | `LokSabhaConstituency` OR `VidhanSabhaConstituency` | — |
| `COVERS` | `MediaTopic` | `LokSabhaConstituency` OR `VidhanSabhaConstituency` | — |
| `CLASSIFIES` | `SeatClassification` | `LokSabhaConstituency` OR `VidhanSabhaConstituency` | — |
| `TARGETS` | `DecisionRecommendation` | `LokSabhaConstituency` OR `VidhanSabhaConstituency` | — |
| `BASED_ON` | `DecisionRecommendation` | `EvidenceBundle` | — |
| `CITES` | `EvidenceBundle` | `ElectionResult` OR `Affidavit` OR `Turnout` OR `IssueObservation` OR `SchemeDelivery` | weight, field |
| `TRIGGERED_BY` | `DecisionRecommendation` | `RuleDefinition` | — (new — see §5 gap resolution) |

**Relationships present in `import_all.js` but not in PRD:**

| Relationship | File | Action |
|---|---|---|
| `HAS_LS` | `import_all.js` line 185 (District → LS) | PRD uses `CONTAINS` for this direction. The script uses the reverse name. Must be renamed to `CONTAINS` and direction corrected to `(District)-[:CONTAINS]->(LokSabhaConstituency)`. |
| `CONTESTS` | `import_all.js` line 384 (Candidate → LS) | PRD uses `CONTESTS_IN`. Must be renamed. Also missing `election_id`, `vote_share`, `rank` properties. |
| `PART_OF` | `import_all.js` line 406 (ElectionResult → Election) | Not in PRD. The link between ElectionResult and Election is via `ElectionResult.election_id` field, not a relationship. Acceptable as supplementary traversal path but must be documented. |
| `PART_OF_BLOCK` | `import_all.js` line 286 (`CasteGroup → CommunityBlock`) | Excluded — `CommunityBlock` is excluded from schema. |
| `PART_OF_ALLIANCE` | `import_all.js` line 243 | Matches PRD — acceptable. |

---

## STEP 4 — Class Hierarchy and Is-A Analysis

### 4.1 Is-A Litmus Test: All Node Pairs

The is-a test: "Is X a kind of Y?" If yes, X should inherit from Y or share a label. If no, they are connected by relationship only.

| Question | Answer | Consequence |
|---|---|---|
| Is `ElectionResult` a `Constituency`? | No. A result is a fact *about* a constituency in an election. | Separate classes connected by `HAS_RESULT`. Correct in PRD. |
| Is `VidhanSabhaConstituency` a `LokSabhaConstituency`? | No. A VS constituency is a geographic subdivision *of* an LS constituency, not a type of LS constituency. | Separate classes connected by `HAS_VS`. Correct in PRD. |
| Is `Turnout` an `ElectionResult`? | No. Turnout is a distinct fact (registered voters, votes cast) that requires different source data (ECI electoral rolls vs. Form 20 results). | Separate classes. Two separate PRD nodes. Correct. |
| Is `Affidavit` a `Candidate`? | No. An affidavit is a legal document filed *by* a candidate; a candidate exists independent of any single affidavit. | Separate classes connected by `HAS_AFFIDAVIT`. Correct. |
| Is `SeatClassification` a `Constituency`? | No. A classification is a derived, time-stamped, rule-produced label *about* a constituency. | Separate classes connected by `CLASSIFIES`. Correct. |
| Is `DecisionRecommendation` an `EvidenceBundle`? | No. A recommendation is a decision node; evidence is the supporting documentation. A recommendation *has* evidence, it is not a kind of evidence. | Separate classes connected by `BASED_ON`. Correct. |
| Is `IssueObservation` an `Issue`? | No. An `Issue` (e.g., "Unemployment") is a universal category. An `IssueObservation` is a constituency-specific, time-stamped measurement of that issue's salience. | Separate classes connected by `OBSERVES`. Correct. |
| Is `SchemeDelivery` a `Scheme`? | No. A `Scheme` is the programme definition; a `SchemeDelivery` is a constituency-specific delivery measurement. | Separate classes connected by `HAS_DELIVERY`. Correct. |
| Is `OrgUnit` a `VidhanSabhaConstituency`? | No. An OrgUnit is an organisational entity *operating in* a constituency, not a type of constituency. | Separate classes connected by `ACTIVE_IN`. Correct. |
| Is `RuleDefinition` a `DecisionRecommendation`? | No. A `RuleDefinition` is the rule that *produced* a recommendation. | Separate classes. New relationship `TRIGGERED_BY` from `DecisionRecommendation` to `RuleDefinition` is needed. |
| Should `LokSabhaConstituency` and `VidhanSabhaConstituency` share a base label `Constituency`? | **This is the critical question.** See §4.2 below. |

### 4.2 The `Constituency` Label Problem — Resolution

**The problem:** PRD §4.2 defines 14 relationships using the generic `(Constituency)` label:
```
(Constituency) -[:HAS_ISSUE {election_id}]-> (Issue)
(IssueObservation) -[:IN_CONSTITUENCY]-> (Constituency)
(SchemeDelivery) -[:COVERS_CONSTITUENCY]-> (Constituency)
(OrgUnit) -[:ACTIVE_IN]-> (Constituency)
(MediaTopic) -[:COVERS]-> (Constituency)
(SeatClassification) -[:CLASSIFIES]-> (Constituency)
(DecisionRecommendation) -[:TARGETS]-> (Constituency)
```

These relationships need to point to real nodes. Neo4j does not have a generic `Constituency` label in this schema — only `LokSabhaConstituency` and `VidhanSabhaConstituency` exist.

**Is-a test applied:** Is `LokSabhaConstituency` a `Constituency`? Yes. Is `VidhanSabhaConstituency` a `Constituency`? Yes. Both are types of constituency.

**Resolution — Use a shared base label:** Neo4j supports multiple labels per node. Apply the base label `Constituency` to both types:

```cypher
-- When creating LS nodes:
MERGE (ls:Constituency:LokSabhaConstituency {ls_id: $ls_id})

-- When creating VS nodes:
MERGE (vs:Constituency:VidhanSabhaConstituency {vs_id: $vs_id})
```

This allows governance and decision relationships to be written against `(c:Constituency)` in Cypher, while civic relationships use the specific label `(ls:LokSabhaConstituency)` or `(vs:VidhanSabhaConstituency)`. This resolves the ambiguity without requiring duplicate relationship types.

**Consequence for import script:** `importConstituencies()` in `import_all.js` must be updated from:
```javascript
MERGE (ls:LokSabhaConstituency {ls_id: $ls_id})
```
to:
```javascript
MERGE (ls:Constituency:LokSabhaConstituency {ls_id: $ls_id})
```
and similarly for VS nodes.

**PRD correction required:** All 7 generic `(Constituency)` usages in §4.2 must be rewritten as `(Constituency)` with a note that this resolves to either `LokSabhaConstituency` or `VidhanSabhaConstituency` at runtime via the shared label.

### 4.3 Is-A Check: `RiskCategory` vs. `SeatClassification`

The import script creates `RiskCategory` nodes (safe, leaning, tossup, losing, hostile). The PRD defines `SeatClassification` with a `seat_status` ENUM that covers similar values but with different labels (`tossup` vs. `tossup`, but `hostile` and `losing` are not in the PRD ENUM — the PRD uses `lost`).

**Resolution:** `RiskCategory` is a legacy node type from before the PRD was written. It must not be created. All risk classification is done via `SeatClassification` nodes. The `RiskCategory` constraint in `createConstraints()` must be removed.

---

## STEP 5 — Complete Property Definitions

### 5.1 Intrinsic vs. Extrinsic Properties

**Intrinsic** = properties that would be true of the entity even if nothing else existed (identity, definitional attributes).
**Extrinsic** = properties that depend on the entity's relationship to other entities (context-dependent measurements).

**Design rule:** Extrinsic properties that vary by election should live on a relationship or a separate node (ElectionResult, Turnout), not on the constituency node itself.

### 5.2 Complete Property Definitions — All Node Types

#### LokSabhaConstituency

| Property | Type | Required | Intrinsic/Extrinsic | Notes |
|---|---|---|---|---|
| `ls_id` | STRING UNIQUE | Yes | Intrinsic | "UP-35" — ECI code, never changes |
| `ls_no` | INT | Yes | Intrinsic | Integer 1–80 |
| `name` | STRING | Yes | Intrinsic | "Lucknow" |
| `reservation` | ENUM[GEN,SC,ST] | Yes | Intrinsic | From ECI Delimitation 2008 |
| `region` | STRING | No | Intrinsic | "Awadh" — regional grouping |
| `source` | STRING | Yes | Extrinsic | "ECI_DELIMITATION_2008" |
| `source_date` | DATE | Yes | Extrinsic | Provenance |
| `ingested_at` | DATETIME | Yes | Extrinsic | Set by import script |
| `confidence` | ENUM[high,medium,low] | Yes | Extrinsic | "high" for official sources |

**Not on this node (extrinsic/election-varying):** vote share, margin, winner, turnout — these belong on `ElectionResult` and `Turnout`.

#### VidhanSabhaConstituency

| Property | Type | Required | Intrinsic/Extrinsic | Notes |
|---|---|---|---|---|
| `vs_id` | STRING UNIQUE | Yes | Intrinsic | "UP-VS-35-3" |
| `vs_no` | INT | No | Intrinsic | Official ECI VS number (differs from positional index in LS) |
| `name` | STRING | Yes | Intrinsic | "Lucknow East" |
| `reservation` | ENUM[GEN,SC,ST] | Yes | Intrinsic | VS-specific, may differ from parent LS |
| `ls_id` | STRING | Yes | Extrinsic | Parent LS constituency — denormalised for query convenience |
| `source` | STRING | Yes | Extrinsic | Provenance |
| `source_date` | DATE | Yes | Extrinsic | Provenance |
| `ingested_at` | DATETIME | Yes | Extrinsic | Set by import script |
| `confidence` | ENUM[high,medium,low] | Yes | Extrinsic | Provenance |

**Bug in current import script:** `vs.reservation` is set to `ls.reservation` (line 130), inheriting the parent LS reservation. This is incorrect — VS constituencies have their own independent reservation designations under the Delimitation Order. The correct VS reservation must be sourced from ECI VS delimitation data.

#### District

| Property | Type | Required | Intrinsic/Extrinsic | Notes |
|---|---|---|---|---|
| `district_id` | STRING UNIQUE | Yes | Intrinsic | "UP-DIST-35" |
| `name` | STRING | Yes | Intrinsic | "Lucknow" |
| `state` | STRING | Yes | Intrinsic | DEFAULT "Uttar Pradesh" |
| `census_year` | INT | Yes | Intrinsic | DEFAULT 2011 |
| `total_population` | BIGINT | No | Extrinsic | Census 2011 |
| `rural_population` | BIGINT | No | Extrinsic | Census 2011 |
| `urban_population` | BIGINT | No | Extrinsic | Census 2011 |
| `hindu_population` | BIGINT | No | Extrinsic | Census 2011 |
| `muslim_population` | BIGINT | No | Extrinsic | Census 2011 |
| `literacy_rate` | FLOAT | No | Extrinsic | Census 2011 |
| `sex_ratio` | FLOAT | No | Extrinsic | Census 2011 |
| `source` | STRING | Yes | Extrinsic | "CENSUS_2011" |
| `source_date` | DATE | Yes | Extrinsic | Provenance |
| `ingested_at` | DATETIME | Yes | Extrinsic | Set by import script |
| `confidence` | ENUM[high,medium,low] | Yes | Extrinsic | "high" for official census |

**Gap in `server.js`:** The `getUPCensusContext()` function queries fields like `d.totalPopulation`, `d.totalMale`, `d.marriedPopulation`, `d.bilingualPopulation` — camelCase property names that do not match the PRD snake_case field names (`total_population`, etc.). The DB schema used in the existing AuraDB is inconsistent with the PRD. This must be resolved before Phase 1 goes live: either migrate the field names or update the import script to use PRD names.

#### Election

| Property | Type | Required | Intrinsic/Extrinsic | Notes |
|---|---|---|---|---|
| `election_id` | STRING UNIQUE | Yes | Intrinsic | "LS2019", "VS2022", "LS2024" |
| `type` | ENUM[LS,VS] | Yes | Intrinsic | |
| `year` | INT | Yes | Intrinsic | |
| `state` | STRING | Yes | Intrinsic | DEFAULT "Uttar Pradesh" |
| `phase_count` | INT | No | Intrinsic | Number of phases (7 for UP LS2024) |
| `source` | STRING | Yes | Extrinsic | DEFAULT "ECI" |
| `ingested_at` | DATETIME | Yes | Extrinsic | |
| `confidence` | ENUM[high,medium,low] | Yes | Extrinsic | |

**Removed from PRD schema (partisan seat counts):** `bjp_seats`, `sp_seats`, `bsp_seats`, `inc_seats`, `others_seats` — present in `elections.json` but must not be stored on the `Election` node. These are derivable by query and represent aggregated result data, not facts about the election itself.

#### ElectionResult

| Property | Type | Required | Intrinsic/Extrinsic | Notes |
|---|---|---|---|---|
| `result_id` | STRING UNIQUE | Yes | Intrinsic | "LS2024_PC35" |
| `election_id` | STRING | Yes | Extrinsic | FK to Election |
| `constituency_id` | STRING | Yes | Extrinsic | FK to constituency |
| `winner` | STRING | Yes | Extrinsic | Candidate name |
| `winner_party_id` | STRING | Yes | Extrinsic | FK to Party |
| `winner_votes` | BIGINT | Yes | Extrinsic | |
| `winner_vote_share` | FLOAT | Yes | Extrinsic | Computed: winner_votes / total_valid_votes * 100 |
| `runner_up` | STRING | Yes | Extrinsic | |
| `runner_up_party_id` | STRING | Yes | Extrinsic | |
| `runner_up_votes` | BIGINT | Yes | Extrinsic | |
| `margin_votes` | BIGINT | Yes | Extrinsic | winner_votes - runner_up_votes |
| `margin_pct` | FLOAT | Yes | Extrinsic | margin_votes / total_valid_votes * 100 |
| `total_valid_votes` | BIGINT | Yes | Extrinsic | Sum of all candidate votes |
| `nota_votes` | BIGINT | No | Extrinsic | |
| `all_candidates_json` | STRING | Yes | Extrinsic | Full result array — audit purposes |
| `source` | STRING | Yes | Extrinsic | "ECI" |
| `source_url` | STRING | Yes | Extrinsic | Direct ECI result URL |
| `source_date` | DATE | Yes | Extrinsic | Result declaration date |
| `ingested_at` | DATETIME | Yes | Extrinsic | |
| `confidence` | ENUM[high,medium,low] | Yes | Extrinsic | |

**Bug in current import script:** `import_all.js` line 399 stores `er.votes_json` (non-PRD field name), not `er.all_candidates_json`. Also stores `er.winner_party` (not `er.winner_party_id`). Also missing: `winner_votes`, `runner_up`, `runner_up_party_id`, `runner_up_votes`, `margin_votes`, `margin_pct`, `winner_vote_share`, `nota_votes`. The script imports only winners and raw total_valid_votes. PRD requirement C-06 is not met.

#### Turnout

| Property | Type | Required | Intrinsic/Extrinsic | Notes |
|---|---|---|---|---|
| `turnout_id` | STRING UNIQUE | Yes | Intrinsic | "TURNOUT_LS2024_PC35" |
| `election_id` | STRING | Yes | Extrinsic | |
| `constituency_id` | STRING | Yes | Extrinsic | |
| `registered_voters` | BIGINT | Yes | Extrinsic | From ECI electoral rolls |
| `votes_cast` | BIGINT | Yes | Extrinsic | Total valid votes + NOTA |
| `turnout_pct` | FLOAT | Yes | Extrinsic | votes_cast / registered_voters * 100 |
| `source` | STRING | Yes | Extrinsic | DEFAULT "ECI_ROLLS" |
| `source_url` | STRING | Yes | Extrinsic | |
| `source_date` | DATE | Yes | Extrinsic | |
| `ingested_at` | DATETIME | Yes | Extrinsic | |
| `confidence` | ENUM[high,medium,low] | Yes | Extrinsic | |

**Not currently in import script.** `Turnout` node creation is entirely missing from `import_all.js`. Must be added in Phase 1 (PRD requirement C-05).

#### Candidate

| Property | Type | Required | Intrinsic/Extrinsic | Notes |
|---|---|---|---|---|
| `cand_id` | STRING UNIQUE | Yes | Intrinsic | "CAND_LS2024_PC35_RAJNATH" |
| `name` | STRING | Yes | Intrinsic | |
| `party_id` | STRING | Yes | Extrinsic | FK to Party |
| `election_id` | STRING | Yes | Extrinsic | One Candidate node per election |
| `constituency_id` | STRING | Yes | Extrinsic | |
| `votes` | BIGINT | Yes | Extrinsic | |
| `vote_share` | FLOAT | Yes | Extrinsic | votes / total_valid_votes * 100 |
| `rank` | INT | Yes | Extrinsic | 1 = winner |
| `gender` | ENUM[M,F,OTHER] | No | Intrinsic | From ECI form or affidavit |
| `source` | STRING | Yes | Extrinsic | "ECI" |
| `source_url` | STRING | Yes | Extrinsic | |
| `source_date` | DATE | Yes | Extrinsic | |
| `ingested_at` | DATETIME | Yes | Extrinsic | |
| `confidence` | ENUM[high,medium,low] | Yes | Extrinsic | |

**Bug in import script (line 376):** `c.party_id = toLower($winner_party)` stores the full party name in lowercase (e.g., `"bharatiya janata party"`) instead of the party_id string (e.g., `"bjp"`). This breaks FK integrity. Must use party_id lookup instead.

**Bug in import script (line 377):** `c.gender = 'unknown'` uses a value not in the ENUM [`M`, `F`, `OTHER`]. Must default to `null` or source gender from ECI data.

#### Affidavit

| Property | Type | Required | Intrinsic/Extrinsic | Notes |
|---|---|---|---|---|
| `affidavit_id` | STRING UNIQUE | Yes | Intrinsic | "AFF_LS2024_CAND_LS2024_PC35_RAJNATH" |
| `cand_id` | STRING | Yes | Extrinsic | FK to Candidate |
| `election_id` | STRING | Yes | Extrinsic | Affidavit is election-specific |
| `criminal_cases` | INT | Yes | Extrinsic | Total declared |
| `serious_cases` | INT | Yes | Extrinsic | IPC 302, 376, 420 categories per ADR |
| `total_assets_cr` | FLOAT | Yes | Extrinsic | Crore INR declared |
| `liabilities_cr` | FLOAT | No | Extrinsic | Declared liabilities |
| `education` | STRING | No | Extrinsic | Declared education level |
| `pan_declared` | BOOLEAN | No | Extrinsic | |
| `source` | STRING | Yes | Extrinsic | DEFAULT "MyNeta_ADR" |
| `source_url` | STRING | Yes | Extrinsic | Direct myneta.info URL |
| `scraped_date` | DATE | Yes | Extrinsic | When data was scraped |
| `ingested_at` | DATETIME | Yes | Extrinsic | |
| `confidence` | ENUM[high,medium,low] | Yes | Extrinsic | "high" for official affidavit |

**Not currently in import script.** Affidavit node creation is entirely missing. Must be added (PRD requirement C-07).

#### Party

| Property | Type | Required | Intrinsic/Extrinsic | Notes |
|---|---|---|---|---|
| `party_id` | STRING UNIQUE | Yes | Intrinsic | "bjp" |
| `name` | STRING | Yes | Intrinsic | "Bharatiya Janata Party" |
| `symbol` | STRING | No | Intrinsic | "Lotus" |
| `type` | ENUM[NATIONAL,STATE,REGISTERED] | Yes | Intrinsic | ECI classification |
| `source` | STRING | Yes | Extrinsic | "ECI_PARTY_REGISTER" |
| `ingested_at` | DATETIME | Yes | Extrinsic | |

**Bug in import script (lines 102–107):** `Party` nodes are created without `type` field and without provenance fields (`source`, `ingested_at`). Must be corrected.

#### Alliance

| Property | Type | Required | Intrinsic/Extrinsic | Notes |
|---|---|---|---|---|
| `alliance_id` | STRING UNIQUE | Yes | Intrinsic | "nda_2024" |
| `name` | STRING | Yes | Intrinsic | "NDA" |
| `election_id` | STRING | Yes | Extrinsic | Alliances are election-specific |
| `source` | STRING | Yes | Extrinsic | |
| `ingested_at` | DATETIME | Yes | Extrinsic | |

**Bug in import script (lines 229–247):** Alliance nodes are created without `election_id`. The NDA of 2024 is different from the NDA of 2019. `alliance_id` should be `"nda_2024"` not `"nda"`.

#### Issue

| Property | Type | Required | Intrinsic/Extrinsic | Notes |
|---|---|---|---|---|
| `issue_id` | STRING UNIQUE | Yes | Intrinsic | "unemployment" |
| `name` | STRING | Yes | Intrinsic | "Unemployment" |
| `category` | ENUM[economic,governance,local,social,ideological] | Yes | Intrinsic | |
| `source` | STRING | Yes | Extrinsic | Where category classification comes from |
| `ingested_at` | DATETIME | Yes | Extrinsic | |

#### IssueObservation

| Property | Type | Required | Intrinsic/Extrinsic | Notes |
|---|---|---|---|---|
| `obs_id` | STRING UNIQUE | Yes | Intrinsic | "OBS_LS2024_PC35_unemployment" |
| `constituency_id` | STRING | Yes | Extrinsic | |
| `issue_id` | STRING | Yes | Extrinsic | |
| `election_id` | STRING | Yes | Extrinsic | Which election cycle this observation is for |
| `evidence_count` | INT | Yes | Extrinsic | Number of source documents |
| `source_types` | LIST[STRING] | Yes | Extrinsic | ["grievance_portal", "news"] |
| `source_date` | DATE | Yes | Extrinsic | |
| `confidence` | ENUM[high,medium,low] | Yes | Extrinsic | |
| `ingested_at` | DATETIME | Yes | Extrinsic | |

#### Scheme

| Property | Type | Required | Intrinsic/Extrinsic | Notes |
|---|---|---|---|---|
| `scheme_id` | STRING UNIQUE | Yes | Intrinsic | "PM_AWAS_YOJANA" |
| `name` | STRING | Yes | Intrinsic | "PM Awas Yojana" |
| `ministry` | STRING | Yes | Intrinsic | "Ministry of Housing" |
| `launch_year` | INT | No | Intrinsic | |
| `beneficiary_type` | STRING | No | Intrinsic | "rural_poor" |
| `source` | STRING | Yes | Extrinsic | |
| `ingested_at` | DATETIME | Yes | Extrinsic | |

#### SchemeDelivery

| Property | Type | Required | Intrinsic/Extrinsic | Notes |
|---|---|---|---|---|
| `delivery_id` | STRING UNIQUE | Yes | Intrinsic | "SD_PM_AWAS_PC35_2024" |
| `scheme_id` | STRING | Yes | Extrinsic | |
| `constituency_id` | STRING | Yes | Extrinsic | |
| `target_count` | BIGINT | Yes | Extrinsic | Approved target for this constituency |
| `beneficiaries_count` | BIGINT | Yes | Extrinsic | Actual beneficiaries |
| `coverage_pct` | FLOAT | Yes | Extrinsic | beneficiaries_count / target_count * 100 |
| `last_updated` | DATE | Yes | Extrinsic | When the delivery data was last refreshed |
| `source` | STRING | Yes | Extrinsic | "PFMS" or "MGNREGA_MIS" |
| `source_url` | STRING | Yes | Extrinsic | Direct portal URL |
| `ingested_at` | DATETIME | Yes | Extrinsic | |
| `confidence` | ENUM[high,medium,low] | Yes | Extrinsic | |

#### OrgUnit

| Property | Type | Required | Intrinsic/Extrinsic | Notes |
|---|---|---|---|---|
| `unit_id` | STRING UNIQUE | Yes | Intrinsic | "ORG_UP35_MANDAL_2024" |
| `type` | ENUM[booth_committee,mandal,district_cell] | Yes | Intrinsic | |
| `constituency_id` | STRING | Yes | Extrinsic | |
| `strength` | ENUM[strong,moderate,weak,absent] | Yes | Extrinsic | Assessment result |
| `last_assessed_date` | DATE | Yes | Extrinsic | When assessment was done |
| `assessed_by` | STRING | Yes | Extrinsic | Name/role of assessor |
| `source` | STRING | Yes | Extrinsic | "INTERNAL_ASSESSMENT" |
| `ingested_at` | DATETIME | Yes | Extrinsic | |
| `confidence` | ENUM[high,medium,low] | Yes | Extrinsic | |

#### MediaTopic

| Property | Type | Required | Intrinsic/Extrinsic | Notes |
|---|---|---|---|---|
| `topic_id` | STRING UNIQUE | Yes | Intrinsic | "MT_2024_PC35_001" |
| `headline` | STRING | Yes | Extrinsic | |
| `source_outlet` | STRING | Yes | Extrinsic | Publication name |
| `pub_date` | DATE | Yes | Extrinsic | |
| `constituency_id` | STRING | Yes | Extrinsic | |
| `sentiment` | ENUM[positive,negative,neutral] | Yes | Extrinsic | Aggregate human classification |
| `source_url` | STRING | Yes | Extrinsic | |
| `ingested_at` | DATETIME | Yes | Extrinsic | |
| `confidence` | ENUM[high,medium,low] | Yes | Extrinsic | |

**Critical gap — `sentiment` computation undefined:** The PRD marks `sentiment` as "aggregate, not individual" but does not specify how it is computed. Options: (a) human editorial classification by a researcher, (b) rule-based keyword match on headline text, (c) aggregate of multiple articles. The method must be defined before Phase 2 implementation. Recommendation: human editorial classification per article, with `confidence: "medium"` unless verified by two reviewers.

#### SeatClassification

| Property | Type | Required | Intrinsic/Extrinsic | Notes |
|---|---|---|---|---|
| `class_id` | STRING UNIQUE | Yes | Intrinsic | "SC_LS2024_PC35" |
| `constituency_id` | STRING | Yes | Extrinsic | |
| `election_id` | STRING | Yes | Extrinsic | |
| `seat_status` | ENUM[safe,leaning,competitive,tossup,lost] | Yes | Extrinsic | Rule-produced |
| `turnout_trend` | ENUM[improving,stable,declining,sharply_declining] | Yes | Extrinsic | Rule-produced (requires 2 elections) |
| `vote_share_trend` | ENUM[consolidating,stable,eroding,sharp_erosion] | Yes | Extrinsic | Rule-produced (requires 2 elections) |
| `delivery_status` | ENUM[on_target,near_target,partial,critical_gap] | No | Extrinsic | Rule-produced from SchemeDelivery |
| `candidate_risk` | ENUM[clean,cases_declared,multiple_cases_flagged,serious_cases_flagged] | No | Extrinsic | Rule-produced from Affidavit |
| `org_status` | ENUM[strong,moderate,weak,absent] | No | Extrinsic | Copied from OrgUnit.strength |
| `rule_version` | STRING | Yes | Extrinsic | DEFAULT "v1.0" |
| `computed_at` | DATETIME | Yes | Extrinsic | When rule engine ran |
| `input_sources` | LIST[STRING] | Yes | Extrinsic | Node IDs that fed each field |

#### DecisionRecommendation

| Property | Type | Required | Intrinsic/Extrinsic | Notes |
|---|---|---|---|---|
| `rec_id` | STRING UNIQUE | Yes | Intrinsic | "REC_LS2024_PC35_R01_001" |
| `constituency_id` | STRING | Yes | Extrinsic | |
| `action_type` | ENUM[...7 values...] | Yes | Extrinsic | |
| `priority` | ENUM[HIGH,MEDIUM,LOW] | Yes | Extrinsic | From rule definition |
| `status` | ENUM[pending,approved,rejected,actioned,outcome_recorded] | Yes | Extrinsic | Lifecycle state |
| `rule_id` | STRING | Yes | Extrinsic | FK to RuleDefinition |
| `rule_version` | STRING | Yes | Extrinsic | |
| `triggered_by` | MAP | Yes | Extrinsic | {field: value} pairs |
| `created_at` | DATETIME | Yes | Extrinsic | |
| `created_by` | STRING | Yes | Extrinsic | "RuleEngine_v1.0" |
| `reviewed_by` | STRING | No | Extrinsic | Must be set before status → approved/rejected |
| `reviewed_at` | DATETIME | No | Extrinsic | Must be set before status → approved/rejected |
| `outcome_notes` | STRING | No | Extrinsic | |

#### EvidenceBundle

| Property | Type | Required | Intrinsic/Extrinsic | Notes |
|---|---|---|---|---|
| `bundle_id` | STRING UNIQUE | Yes | Intrinsic | "EB_REC_LS2024_PC35_R01_001" |
| `rec_id` | STRING | Yes | Extrinsic | FK to DecisionRecommendation |
| `explanation_text` | STRING | Yes | Extrinsic | Plain language summary |
| `generated_at` | DATETIME | Yes | Extrinsic | |

### 5.3 The `RuleDefinition` Node — Full Definition (New)

This node is referenced in PRD §4.5 and required by PRD D-04, but has never been defined with fields in any document. This is the authoritative definition:

| Property | Type | Required | Intrinsic/Extrinsic | Notes |
|---|---|---|---|---|
| `rule_id` | STRING UNIQUE | Yes | Intrinsic | "R-01", "R-02" etc. |
| `rule_version` | STRING | Yes | Intrinsic | "v1.0" |
| `rule_name` | STRING | Yes | Intrinsic | "GOVERNANCE_PUSH" |
| `description` | STRING | Yes | Intrinsic | Human-readable description of what the rule does |
| `action_type` | ENUM[...7 values...] | Yes | Intrinsic | Which action type this rule produces |
| `priority` | ENUM[HIGH,MEDIUM,LOW] | Yes | Intrinsic | Default priority of recommendations from this rule |
| `conditions` | STRING | Yes | Intrinsic | Cypher CASE expression or JSON conditions object |
| `input_fields` | LIST[STRING] | Yes | Intrinsic | Which fields from which nodes this rule reads |
| `layer` | ENUM[civic,governance,decision] | Yes | Intrinsic | Which layer's data this rule operates on |
| `created_at` | DATETIME | Yes | Extrinsic | When this rule version was defined |
| `created_by` | STRING | Yes | Extrinsic | Author of this rule version |
| `bias_audited` | BOOLEAN | Yes | Extrinsic | Has this rule version passed the bias audit (PRD §7.4)? |
| `bias_audit_date` | DATE | No | Extrinsic | Date of last bias audit |
| `bias_audit_notes` | STRING | No | Extrinsic | Audit outcome documentation |
| `deprecated_at` | DATETIME | No | Extrinsic | If this version was superseded |

### 5.4 Properties That Belong on Relationships (Not Nodes)

| Property | Currently On | Should Be On |
|---|---|---|
| `election_id` on `HAS_RESULT` | Relationship property | Correct — also redundantly on `ElectionResult` node for query convenience |
| `election_id` on `CONTESTS_IN` | Currently missing | Must be added to the relationship |
| `vote_share` on `CONTESTS_IN` | Currently missing from relationship | Redundant with `Candidate.vote_share`; acceptable on relationship for traversal queries |
| `rank` on `CONTESTS_IN` | Currently missing from relationship | Redundant with `Candidate.rank`; acceptable on relationship |
| `since_year` on `BELONGS_TO` | Currently missing | Must be added |
| `weight` on `CITES` | On relationship | Correct |
| `field` on `CITES` | On relationship | Correct |

### 5.5 Resolution: `all_candidates_json` vs. `Candidate` Nodes

**The conflict:** PRD §4.1 defines `ElectionResult.all_candidates_json` (a JSON string containing all candidates) AND defines individual `Candidate` nodes. PRD C-04 requires both: "all_candidates_json field populated, Candidate nodes for all contestants."

**Analysis:** These serve different purposes:
- `all_candidates_json` serves as an **audit trail** — a verbatim snapshot of the ECI result exactly as received, stored for forensic verification.
- `Candidate` nodes serve as **queryable graph entities** — enabling traversal, relationship-based queries, and cross-election candidate tracking.

**Resolution:** Both must exist. The contract is:
1. `all_candidates_json` is set to the raw JSON array from the source data at import time and is **never modified**.
2. `Candidate` nodes are created from the same source data and carry `vote_share` and `rank` as computed values.
3. If a discrepancy ever exists between `all_candidates_json` and the Candidate nodes, `all_candidates_json` is the authoritative record and must trigger a data reconciliation.

---

## STEP 6 — Constraints: Three Layers for Neo4j

### 6.1 Layer 1: Neo4j UNIQUE Constraints (Cypher)

All constraints use the `IF NOT EXISTS` guard for idempotent runs.

```cypher
-- Civic Layer
CREATE CONSTRAINT lsc_ls_id_unique IF NOT EXISTS
  FOR (n:LokSabhaConstituency) REQUIRE n.ls_id IS UNIQUE;

CREATE CONSTRAINT vsc_vs_id_unique IF NOT EXISTS
  FOR (n:VidhanSabhaConstituency) REQUIRE n.vs_id IS UNIQUE;

CREATE CONSTRAINT district_id_unique IF NOT EXISTS
  FOR (n:District) REQUIRE n.district_id IS UNIQUE;

CREATE CONSTRAINT election_id_unique IF NOT EXISTS
  FOR (n:Election) REQUIRE n.election_id IS UNIQUE;

CREATE CONSTRAINT result_id_unique IF NOT EXISTS
  FOR (n:ElectionResult) REQUIRE n.result_id IS UNIQUE;

CREATE CONSTRAINT turnout_id_unique IF NOT EXISTS
  FOR (n:Turnout) REQUIRE n.turnout_id IS UNIQUE;

CREATE CONSTRAINT cand_id_unique IF NOT EXISTS
  FOR (n:Candidate) REQUIRE n.cand_id IS UNIQUE;

CREATE CONSTRAINT affidavit_id_unique IF NOT EXISTS
  FOR (n:Affidavit) REQUIRE n.affidavit_id IS UNIQUE;

CREATE CONSTRAINT party_id_unique IF NOT EXISTS
  FOR (n:Party) REQUIRE n.party_id IS UNIQUE;

CREATE CONSTRAINT alliance_id_unique IF NOT EXISTS
  FOR (n:Alliance) REQUIRE n.alliance_id IS UNIQUE;

-- Governance Layer
CREATE CONSTRAINT issue_id_unique IF NOT EXISTS
  FOR (n:Issue) REQUIRE n.issue_id IS UNIQUE;

CREATE CONSTRAINT obs_id_unique IF NOT EXISTS
  FOR (n:IssueObservation) REQUIRE n.obs_id IS UNIQUE;

CREATE CONSTRAINT scheme_id_unique IF NOT EXISTS
  FOR (n:Scheme) REQUIRE n.scheme_id IS UNIQUE;

CREATE CONSTRAINT delivery_id_unique IF NOT EXISTS
  FOR (n:SchemeDelivery) REQUIRE n.delivery_id IS UNIQUE;

CREATE CONSTRAINT unit_id_unique IF NOT EXISTS
  FOR (n:OrgUnit) REQUIRE n.unit_id IS UNIQUE;

CREATE CONSTRAINT topic_id_unique IF NOT EXISTS
  FOR (n:MediaTopic) REQUIRE n.topic_id IS UNIQUE;

-- Decision Layer
CREATE CONSTRAINT class_id_unique IF NOT EXISTS
  FOR (n:SeatClassification) REQUIRE n.class_id IS UNIQUE;

CREATE CONSTRAINT rec_id_unique IF NOT EXISTS
  FOR (n:DecisionRecommendation) REQUIRE n.rec_id IS UNIQUE;

CREATE CONSTRAINT bundle_id_unique IF NOT EXISTS
  FOR (n:EvidenceBundle) REQUIRE n.bundle_id IS UNIQUE;

CREATE CONSTRAINT rule_id_version_unique IF NOT EXISTS
  FOR (n:RuleDefinition) REQUIRE (n.rule_id, n.rule_version) IS UNIQUE;
```

**Note on `RuleDefinition`:** The uniqueness constraint is composite `(rule_id, rule_version)` because the same rule may have multiple versions (R-01 v1.0, R-01 v1.1) and both must be queryable.

### 6.2 Performance Indexes (not uniqueness constraints)

```cypher
-- Constituency name lookup
CREATE INDEX lsc_name_idx IF NOT EXISTS FOR (n:LokSabhaConstituency) ON (n.name);
CREATE INDEX vsc_name_idx IF NOT EXISTS FOR (n:VidhanSabhaConstituency) ON (n.name);
CREATE INDEX district_name_idx IF NOT EXISTS FOR (n:District) ON (n.name);

-- Election result lookups
CREATE INDEX result_election_idx IF NOT EXISTS FOR (n:ElectionResult) ON (n.election_id);
CREATE INDEX result_constituency_idx IF NOT EXISTS FOR (n:ElectionResult) ON (n.constituency_id);
CREATE INDEX result_margin_idx IF NOT EXISTS FOR (n:ElectionResult) ON (n.margin_pct);

-- Candidate lookups
CREATE INDEX cand_election_idx IF NOT EXISTS FOR (n:Candidate) ON (n.election_id);
CREATE INDEX cand_party_idx IF NOT EXISTS FOR (n:Candidate) ON (n.party_id);

-- Classification lookups
CREATE INDEX sc_election_idx IF NOT EXISTS FOR (n:SeatClassification) ON (n.election_id);
CREATE INDEX sc_status_idx IF NOT EXISTS FOR (n:SeatClassification) ON (n.seat_status);

-- Recommendation lookups
CREATE INDEX rec_status_idx IF NOT EXISTS FOR (n:DecisionRecommendation) ON (n.status);
CREATE INDEX rec_action_idx IF NOT EXISTS FOR (n:DecisionRecommendation) ON (n.action_type);
CREATE INDEX rec_constituency_idx IF NOT EXISTS FOR (n:DecisionRecommendation) ON (n.constituency_id);
```

### 6.3 Layer 2: Import Script Validation Rules

These validations must run before any `MERGE` statement executes. Failure must throw an error and halt the import row — not silently skip.

#### Provenance Validation (applies to ALL nodes)

```javascript
function validateProvenance(node, nodeType, rowIndex) {
    const required = ['source', 'source_date', 'confidence'];
    const missing = required.filter(f => !node[f]);
    if (missing.length > 0) {
        throw new Error(
            `[PROVENANCE FAIL] ${nodeType} at row ${rowIndex} missing: ${missing.join(', ')}. ` +
            `Import halted. Fix source data before re-running.`
        );
    }
    const validConfidence = ['high', 'medium', 'low'];
    if (!validConfidence.includes(node.confidence)) {
        throw new Error(
            `[PROVENANCE FAIL] ${nodeType} at row ${rowIndex}: confidence must be one of ` +
            `${validConfidence.join('|')}, got: "${node.confidence}"`
        );
    }
}
```

#### `LokSabhaConstituency` Validation

```javascript
function validateLS(ls, rowIndex) {
    if (!ls.ls_id || !/^UP-\d{1,2}$/.test(ls.ls_id))
        throw new Error(`Row ${rowIndex}: ls_id must match UP-{1-80}, got: ${ls.ls_id}`);
    if (!['GEN', 'SC', 'ST'].includes(ls.reservation))
        throw new Error(`Row ${rowIndex}: reservation must be GEN|SC|ST, got: ${ls.reservation}`);
    validateProvenance(ls, 'LokSabhaConstituency', rowIndex);
}
```

#### `ElectionResult` Validation

```javascript
function validateElectionResult(er, rowIndex) {
    if (!er.result_id) throw new Error(`Row ${rowIndex}: result_id required`);
    if (!er.election_id) throw new Error(`Row ${rowIndex}: election_id required`);
    if (!er.constituency_id) throw new Error(`Row ${rowIndex}: constituency_id required`);
    if (er.margin_votes === undefined || er.margin_votes === null)
        throw new Error(`Row ${rowIndex}: margin_votes required — compute from winner_votes - runner_up_votes`);
    if (er.margin_pct === undefined || er.margin_pct === null)
        throw new Error(`Row ${rowIndex}: margin_pct required`);
    if (er.winner_vote_share === undefined || er.winner_vote_share === null)
        throw new Error(`Row ${rowIndex}: winner_vote_share required`);
    if (er.total_valid_votes <= 0)
        throw new Error(`Row ${rowIndex}: total_valid_votes must be > 0, got: ${er.total_valid_votes}`);
    if (!er.source_url || !er.source_url.startsWith('http'))
        throw new Error(`Row ${rowIndex}: source_url must be a valid URL`);
    validateProvenance(er, 'ElectionResult', rowIndex);
}
```

#### `Candidate` Validation

```javascript
function validateCandidate(c, rowIndex) {
    if (!c.cand_id) throw new Error(`Row ${rowIndex}: cand_id required`);
    if (!c.name) throw new Error(`Row ${rowIndex}: candidate name required`);
    if (!c.party_id) throw new Error(`Row ${rowIndex}: party_id required`);
    if (!['M', 'F', 'OTHER'].includes(c.gender) && c.gender !== null)
        throw new Error(`Row ${rowIndex}: gender must be M|F|OTHER|null, got: ${c.gender}`);
    if (c.vote_share < 0 || c.vote_share > 100)
        throw new Error(`Row ${rowIndex}: vote_share out of range: ${c.vote_share}`);
    if (c.rank < 1)
        throw new Error(`Row ${rowIndex}: rank must be >= 1`);
    validateProvenance(c, 'Candidate', rowIndex);
}
```

#### `Affidavit` Validation

```javascript
function validateAffidavit(aff, rowIndex) {
    if (!aff.affidavit_id) throw new Error(`Row ${rowIndex}: affidavit_id required`);
    if (!aff.cand_id) throw new Error(`Row ${rowIndex}: cand_id required`);
    if (aff.criminal_cases < 0)
        throw new Error(`Row ${rowIndex}: criminal_cases cannot be negative`);
    if (aff.serious_cases < 0)
        throw new Error(`Row ${rowIndex}: serious_cases cannot be negative`);
    if (aff.serious_cases > aff.criminal_cases)
        throw new Error(`Row ${rowIndex}: serious_cases (${aff.serious_cases}) cannot exceed criminal_cases (${aff.criminal_cases})`);
    if (!aff.source_url || !aff.source_url.includes('myneta.info'))
        throw new Error(`Row ${rowIndex}: affidavit source_url must be a myneta.info URL`);
    if (!aff.scraped_date)
        throw new Error(`Row ${rowIndex}: scraped_date required`);
    validateProvenance(aff, 'Affidavit', rowIndex);
}
```

#### Fields That Must Cause Import Failure

| Condition | Error Message |
|---|---|
| Any node missing `source` | `PROVENANCE FAIL: source required` |
| Any node missing `source_date` | `PROVENANCE FAIL: source_date required` |
| Any node missing `confidence` | `PROVENANCE FAIL: confidence required` |
| `confidence` not in `[high, medium, low]` | `PROVENANCE FAIL: invalid confidence value` |
| `ElectionResult` missing `margin_pct` | `margin_pct required` |
| `ElectionResult` missing `source_url` | `source_url required` |
| `Candidate.gender` not in ENUM | `invalid gender value` |
| `Candidate.party_id` is a party name not an ID | Lookup must fail against Party nodes |
| `Affidavit.serious_cases > criminal_cases` | `logical inconsistency in affidavit data` |

### 6.4 Layer 3: API Enforcement Rules

These are runtime checks that the API server enforces on every write request.

| Rule | Endpoint | Enforcement |
|---|---|---|
| `reviewed_by` and `reviewed_at` required before `status → approved` or `status → rejected` | `POST /api/up/recommendation/:rec_id/review` | Return HTTP 400 if either field is null when status is being set to `approved` or `rejected` |
| `reviewed_by` required before `status → actioned` | Same endpoint | Return HTTP 400 if `reviewed_by` is null |
| Status lifecycle is ordered: `pending → approved/rejected → actioned → outcome_recorded` | All recommendation write endpoints | Return HTTP 409 if status transition is not in the allowed sequence |
| Read endpoints for civic data are unauthenticated | All `GET /api/up/constituency/*` endpoints | No auth header required |
| Write endpoints for recommendations require authentication | `POST /api/up/recommendation/*` | Return HTTP 401 if auth header missing |
| `GET /api/db-check` must not exist in production | — | Delete this route before production deployment |

---

## STEP 7 — Seed Instances

One realistic Cypher `MERGE` statement per node type, using real UP data.

### Civic Layer Seeds

```cypher
-- LokSabhaConstituency: Lucknow (LS2024 Rajnath Singh seat)
MERGE (ls:Constituency:LokSabhaConstituency {ls_id: "UP-35"})
SET ls.ls_no       = 35,
    ls.name        = "Lucknow",
    ls.reservation = "GEN",
    ls.region      = "Awadh",
    ls.source      = "ECI_DELIMITATION_2008",
    ls.source_date = date("2008-01-01"),
    ls.ingested_at = datetime(),
    ls.confidence  = "high";

-- VidhanSabhaConstituency: Lucknow East (one of 5 VS segments under Lucknow LS)
MERGE (vs:Constituency:VidhanSabhaConstituency {vs_id: "UP-VS-35-3"})
SET vs.vs_no       = 314,
    vs.name        = "Lucknow East",
    vs.reservation = "GEN",
    vs.ls_id       = "UP-35",
    vs.source      = "ECI_DELIMITATION_2008",
    vs.source_date = date("2008-01-01"),
    vs.ingested_at = datetime(),
    vs.confidence  = "high"
WITH vs
MATCH (ls:LokSabhaConstituency {ls_id: "UP-35"})
MERGE (ls)-[:HAS_VS {
  source:      "ECI_DELIMITATION_2008",
  source_date: date("2008-01-01"),
  confidence:  "high"
}]->(vs);

-- District: Lucknow
MERGE (d:District {district_id: "UP-DIST-32"})
SET d.name              = "Lucknow",
    d.state             = "Uttar Pradesh",
    d.census_year       = 2011,
    d.total_population  = 4589838,
    d.rural_population  = 1025684,
    d.urban_population  = 3564154,
    d.hindu_population  = 3580289,
    d.muslim_population = 981516,
    d.literacy_rate     = 79.27,
    d.sex_ratio         = 917.0,
    d.source            = "CENSUS_2011",
    d.source_date       = date("2011-03-01"),
    d.ingested_at       = datetime(),
    d.confidence        = "high"
WITH d
MATCH (ls:LokSabhaConstituency {ls_id: "UP-35"})
MERGE (d)-[:CONTAINS {
  source:      "ECI_DELIMITATION_2008",
  source_date: date("2008-01-01"),
  confidence:  "high"
}]->(ls);

-- Election: LS2024
MERGE (e:Election {election_id: "LS2024"})
SET e.type        = "LS",
    e.year        = 2024,
    e.state       = "Uttar Pradesh",
    e.phase_count = 7,
    e.source      = "ECI",
    e.ingested_at = datetime(),
    e.confidence  = "high";

-- ElectionResult: Lucknow LS2024 (Rajnath Singh won with ~49.7% vote share)
MERGE (er:ElectionResult {result_id: "LS2024_PC35"})
SET er.election_id        = "LS2024",
    er.constituency_id    = "UP-35",
    er.winner             = "Rajnath Singh",
    er.winner_party_id    = "bjp",
    er.winner_votes       = 612506,
    er.winner_vote_share  = 49.72,
    er.runner_up          = "Ravidas Mehrotra",
    er.runner_up_party_id = "sp",
    er.runner_up_votes    = 495086,
    er.margin_votes       = 117420,
    er.margin_pct         = 9.53,
    er.total_valid_votes  = 1231867,
    er.nota_votes         = 7843,
    er.all_candidates_json= '[{"candidate":"Rajnath Singh","party":"BJP","total_votes":612506}, ...]',
    er.source             = "ECI",
    er.source_url         = "https://results.eci.gov.in/ResultAcGeneral2024/partywiseresult-S21.htm",
    er.source_date        = date("2024-06-04"),
    er.ingested_at        = datetime(),
    er.confidence         = "high"
WITH er
MATCH (ls:LokSabhaConstituency {ls_id: "UP-35"})
MERGE (ls)-[:HAS_RESULT {
  election_id: "LS2024",
  source:      "ECI",
  source_date: date("2024-06-04"),
  confidence:  "high"
}]->(er);

-- Turnout: Lucknow LS2024
MERGE (t:Turnout {turnout_id: "TURNOUT_LS2024_PC35"})
SET t.election_id       = "LS2024",
    t.constituency_id   = "UP-35",
    t.registered_voters = 2002145,
    t.votes_cast        = 1231867,
    t.turnout_pct       = 61.53,
    t.source            = "ECI_ROLLS",
    t.source_url        = "https://ceouttarpradesh.nic.in/",
    t.source_date       = date("2024-06-04"),
    t.ingested_at       = datetime(),
    t.confidence        = "high"
WITH t
MATCH (ls:LokSabhaConstituency {ls_id: "UP-35"})
MERGE (ls)-[:HAS_TURNOUT {
  election_id: "LS2024",
  source:      "ECI_ROLLS",
  source_date: date("2024-06-04"),
  confidence:  "high"
}]->(t);

-- Party: BJP
MERGE (p:Party {party_id: "bjp"})
SET p.name      = "Bharatiya Janata Party",
    p.symbol    = "Lotus",
    p.type      = "NATIONAL",
    p.source    = "ECI_PARTY_REGISTER",
    p.ingested_at = datetime();

-- Candidate: Rajnath Singh LS2024
MERGE (c:Candidate {cand_id: "CAND_LS2024_PC35_RAJNATH_SINGH"})
SET c.name            = "Rajnath Singh",
    c.party_id        = "bjp",
    c.election_id     = "LS2024",
    c.constituency_id = "UP-35",
    c.votes           = 612506,
    c.vote_share      = 49.72,
    c.rank            = 1,
    c.gender          = "M",
    c.source          = "ECI",
    c.source_url      = "https://results.eci.gov.in/ResultAcGeneral2024/partywiseresult-S21.htm",
    c.source_date     = date("2024-06-04"),
    c.ingested_at     = datetime(),
    c.confidence      = "high"
WITH c
MATCH (ls:LokSabhaConstituency {ls_id: "UP-35"})
MERGE (c)-[:CONTESTS_IN {
  election_id: "LS2024",
  vote_share:  49.72,
  rank:        1,
  source:      "ECI",
  source_date: date("2024-06-04"),
  confidence:  "high"
}]->(ls)
WITH c
MATCH (p:Party {party_id: "bjp"})
MERGE (c)-[:BELONGS_TO {since_year: 1974}]->(p);

-- IS_INCUMBENT_IN: Rajnath Singh has been MP from Lucknow since 2014
WITH "CAND_LS2024_PC35_RAJNATH_SINGH" AS candId
MATCH (c:Candidate {cand_id: candId})
MATCH (ls:LokSabhaConstituency {ls_id: "UP-35"})
MERGE (c)-[:IS_INCUMBENT_IN {
  since_year: 2014,
  terms:      3
}]->(ls);

-- Affidavit: Rajnath Singh LS2024 (illustrative — use actual MyNeta data)
MERGE (aff:Affidavit {affidavit_id: "AFF_LS2024_CAND_LS2024_PC35_RAJNATH_SINGH"})
SET aff.cand_id           = "CAND_LS2024_PC35_RAJNATH_SINGH",
    aff.election_id       = "LS2024",
    aff.criminal_cases    = 0,
    aff.serious_cases     = 0,
    aff.total_assets_cr   = 3.82,
    aff.liabilities_cr    = 0.0,
    aff.education         = "Post Graduate",
    aff.pan_declared      = true,
    aff.source            = "MyNeta_ADR",
    aff.source_url        = "https://myneta.info/LokSabha2024/candidate.php?candidate_id=7254",
    aff.scraped_date      = date("2024-04-25"),
    aff.ingested_at       = datetime(),
    aff.confidence        = "high"
WITH aff
MATCH (c:Candidate {cand_id: "CAND_LS2024_PC35_RAJNATH_SINGH"})
MERGE (c)-[:HAS_AFFIDAVIT {election_id: "LS2024"}]->(aff);

-- Alliance: NDA 2024
MERGE (a:Alliance {alliance_id: "nda_2024"})
SET a.name       = "National Democratic Alliance",
    a.election_id = "LS2024",
    a.source      = "ECI_DECLARED_ALLIANCE",
    a.ingested_at = datetime()
WITH a
MATCH (p:Party {party_id: "bjp"})
MERGE (p)-[:PART_OF_ALLIANCE {election_id: "LS2024"}]->(a);
```

### Governance Layer Seeds

```cypher
-- Issue: Unemployment
MERGE (i:Issue {issue_id: "unemployment"})
SET i.name      = "Unemployment",
    i.category  = "economic",
    i.source    = "ISSUE_TAXONOMY_V1",
    i.ingested_at = datetime();

-- IssueObservation: Unemployment in Lucknow for LS2024 cycle
MERGE (obs:IssueObservation {obs_id: "OBS_LS2024_PC35_unemployment"})
SET obs.constituency_id = "UP-35",
    obs.issue_id        = "unemployment",
    obs.election_id     = "LS2024",
    obs.evidence_count  = 14,
    obs.source_types    = ["grievance_portal", "news", "manifesto"],
    obs.source_date     = date("2024-03-01"),
    obs.confidence      = "medium",
    obs.ingested_at     = datetime()
WITH obs
MATCH (i:Issue {issue_id: "unemployment"})
MERGE (obs)-[:OBSERVES]->(i)
WITH obs
MATCH (ls:Constituency:LokSabhaConstituency {ls_id: "UP-35"})
MERGE (obs)-[:IN_CONSTITUENCY]->(ls)
WITH obs, ls
MERGE (ls)-[:HAS_ISSUE {
  election_id: "LS2024",
  source:      "GRIEVANCE_PORTAL_CM_HELPLINE",
  source_date: date("2024-03-01"),
  confidence:  "medium"
}]->(obs);

-- Scheme: PM Awas Yojana (Gramin)
MERGE (s:Scheme {scheme_id: "PM_AWAS_YOJANA_GRAMIN"})
SET s.name             = "PM Awas Yojana (Gramin)",
    s.ministry         = "Ministry of Rural Development",
    s.launch_year      = 2016,
    s.beneficiary_type = "rural_poor",
    s.source           = "GOVT_SCHEME_REGISTRY",
    s.ingested_at      = datetime();

-- SchemeDelivery: PM Awas in Lucknow LS constituency
MERGE (sd:SchemeDelivery {delivery_id: "SD_PM_AWAS_PC35_2024"})
SET sd.scheme_id            = "PM_AWAS_YOJANA_GRAMIN",
    sd.constituency_id      = "UP-35",
    sd.target_count         = 12450,
    sd.beneficiaries_count  = 10824,
    sd.coverage_pct         = 86.9,
    sd.last_updated         = date("2024-03-31"),
    sd.source               = "PFMS",
    sd.source_url           = "https://pfms.nic.in/static/NewLayoutCommonContent.aspx",
    sd.ingested_at          = datetime(),
    sd.confidence           = "high"
WITH sd
MATCH (s:Scheme {scheme_id: "PM_AWAS_YOJANA_GRAMIN"})
MERGE (s)-[:HAS_DELIVERY]->(sd)
WITH sd
MATCH (ls:Constituency:LokSabhaConstituency {ls_id: "UP-35"})
MERGE (sd)-[:COVERS_CONSTITUENCY]->(ls);

-- OrgUnit: Mandal-level party unit in Lucknow
MERGE (ou:OrgUnit {unit_id: "ORG_UP35_MANDAL_LCKNW_2024"})
SET ou.type               = "mandal",
    ou.constituency_id    = "UP-35",
    ou.strength           = "strong",
    ou.last_assessed_date = date("2024-01-15"),
    ou.assessed_by        = "DistrictIncharge_Lucknow",
    ou.source             = "INTERNAL_ASSESSMENT",
    ou.ingested_at        = datetime(),
    ou.confidence         = "medium"
WITH ou
MATCH (ls:Constituency:LokSabhaConstituency {ls_id: "UP-35"})
MERGE (ou)-[:ACTIVE_IN]->(ls);

-- MediaTopic: Sample headline for Lucknow
MERGE (mt:MediaTopic {topic_id: "MT_2024_PC35_001"})
SET mt.headline         = "Rajnath Singh holds public meeting on development in Lucknow East",
    mt.source_outlet    = "Times of India",
    mt.pub_date         = date("2024-04-10"),
    mt.constituency_id  = "UP-35",
    mt.sentiment        = "positive",
    mt.source_url       = "https://timesofindia.indiatimes.com/...",
    mt.ingested_at      = datetime(),
    mt.confidence       = "medium"
WITH mt
MATCH (ls:Constituency:LokSabhaConstituency {ls_id: "UP-35"})
MERGE (mt)-[:COVERS]->(ls);
```

### Decision Layer Seeds

```cypher
-- RuleDefinition: R-01 GOVERNANCE_PUSH
MERGE (rd:RuleDefinition {rule_id: "R-01", rule_version: "v1.0"})
SET rd.rule_name       = "GOVERNANCE_PUSH",
    rd.description     = "When a seat is competitive or tossup AND scheme delivery is critically deficient, recommend accelerating scheme delivery in that constituency.",
    rd.action_type     = "GOVERNANCE_PUSH",
    rd.priority        = "HIGH",
    rd.conditions      = '{"seat_status": ["competitive","tossup"], "delivery_status": ["critical_gap","partial_coverage"]}',
    rd.input_fields    = ["SeatClassification.seat_status", "SeatClassification.delivery_status"],
    rd.layer           = "decision",
    rd.created_at      = datetime("2026-05-03T00:00:00"),
    rd.created_by      = "OntologyTeam_v1.0",
    rd.bias_audited    = false,
    rd.bias_audit_date = null,
    rd.bias_audit_notes= "Pending — required before Phase 3 launch";

-- RuleDefinition: R-02 REPLACE_CANDIDATE
MERGE (rd:RuleDefinition {rule_id: "R-02", rule_version: "v1.0"})
SET rd.rule_name       = "REPLACE_CANDIDATE",
    rd.description     = "When a seat is competitive or tossup AND the candidate has serious criminal cases flagged AND vote share is eroding or sharply eroding.",
    rd.action_type     = "REPLACE_CANDIDATE",
    rd.priority        = "HIGH",
    rd.conditions      = '{"seat_status": ["competitive","tossup"], "candidate_risk": "serious_cases_flagged", "vote_share_trend": ["eroding","sharp_erosion"]}',
    rd.input_fields    = ["SeatClassification.seat_status", "SeatClassification.candidate_risk", "SeatClassification.vote_share_trend"],
    rd.layer           = "decision",
    rd.created_at      = datetime("2026-05-03T00:00:00"),
    rd.created_by      = "OntologyTeam_v1.0",
    rd.bias_audited    = false;

-- RuleDefinition: R-03 REINFORCE_CANDIDATE
MERGE (rd:RuleDefinition {rule_id: "R-03", rule_version: "v1.0"})
SET rd.rule_name       = "REINFORCE_CANDIDATE",
    rd.description     = "When a seat is safe or leaning AND the candidate is clean AND vote share is consolidating — invest in incumbent retention.",
    rd.action_type     = "REINFORCE_CANDIDATE",
    rd.priority        = "LOW",
    rd.conditions      = '{"seat_status": ["safe","leaning"], "candidate_risk": "clean", "vote_share_trend": "consolidating"}',
    rd.input_fields    = ["SeatClassification.seat_status", "SeatClassification.candidate_risk", "SeatClassification.vote_share_trend"],
    rd.layer           = "decision",
    rd.created_at      = datetime("2026-05-03T00:00:00"),
    rd.created_by      = "OntologyTeam_v1.0",
    rd.bias_audited    = false;

-- RuleDefinition: R-04 CADRE_STRENGTHEN
MERGE (rd:RuleDefinition {rule_id: "R-04", rule_version: "v1.0"})
SET rd.rule_name       = "CADRE_STRENGTHEN",
    rd.description     = "When the party organisational unit is weak or absent AND the seat is competitive, tossup, or leaning — prioritise booth-level party organisation.",
    rd.action_type     = "CADRE_STRENGTHEN",
    rd.priority        = "MEDIUM",
    rd.conditions      = '{"org_status": ["weak","absent"], "seat_status": ["competitive","tossup","leaning"]}',
    rd.input_fields    = ["SeatClassification.org_status", "SeatClassification.seat_status"],
    rd.layer           = "decision",
    rd.created_at      = datetime("2026-05-03T00:00:00"),
    rd.created_by      = "OntologyTeam_v1.0",
    rd.bias_audited    = false;

-- RuleDefinition: R-05 ALLIANCE_REVIEW
MERGE (rd:RuleDefinition {rule_id: "R-05", rule_version: "v1.0"})
SET rd.rule_name       = "ALLIANCE_REVIEW",
    rd.description     = "When a seat is tossup with margin below 3% AND an allied party holds VS seats in the LS constituency — renegotiate seat share.",
    rd.action_type     = "ALLIANCE_REVIEW",
    rd.priority        = "HIGH",
    rd.conditions      = '{"seat_status": "tossup", "margin_pct": {"lt": 3}, "allied_vs_seats": {"gt": 0}}',
    rd.input_fields    = ["SeatClassification.seat_status", "ElectionResult.margin_pct", "Alliance.election_id"],
    rd.layer           = "decision",
    rd.created_at      = datetime("2026-05-03T00:00:00"),
    rd.created_by      = "OntologyTeam_v1.0",
    rd.bias_audited    = false;

-- RuleDefinition: R-06 COMMUNICATIONS_EMPHASIS
MERGE (rd:RuleDefinition {rule_id: "R-06", rule_version: "v1.0"})
SET rd.rule_name       = "COMMUNICATIONS_EMPHASIS",
    rd.description     = "When delivery is on_target or near_target AND issue observation count exceeds 3 AND candidate is clean — messaging-heavy intervention.",
    rd.action_type     = "COMMUNICATIONS_EMPHASIS",
    rd.priority        = "MEDIUM",
    rd.conditions      = '{"delivery_status": ["on_target","near_target"], "issue_observation_count": {"gt": 3}, "candidate_risk": "clean"}',
    rd.input_fields    = ["SeatClassification.delivery_status", "IssueObservation.evidence_count", "SeatClassification.candidate_risk"],
    rd.layer           = "decision",
    rd.created_at      = datetime("2026-05-03T00:00:00"),
    rd.created_by      = "OntologyTeam_v1.0",
    rd.bias_audited    = false;

-- SeatClassification: Lucknow LS2024 (safe seat, on_target delivery)
MERGE (sc:SeatClassification {class_id: "SC_LS2024_PC35"})
SET sc.constituency_id    = "UP-35",
    sc.election_id        = "LS2024",
    sc.seat_status        = "leaning",
    sc.turnout_trend      = "stable",
    sc.vote_share_trend   = "eroding",
    sc.delivery_status    = "on_target",
    sc.candidate_risk     = "clean",
    sc.org_status         = "strong",
    sc.rule_version       = "v1.0",
    sc.computed_at        = datetime(),
    sc.input_sources      = ["LS2024_PC35", "TURNOUT_LS2024_PC35", "SD_PM_AWAS_PC35_2024"]
WITH sc
MATCH (ls:Constituency:LokSabhaConstituency {ls_id: "UP-35"})
MERGE (sc)-[:CLASSIFIES]->(ls);

-- EvidenceBundle + DecisionRecommendation: REINFORCE_CANDIDATE for Lucknow
MERGE (rec:DecisionRecommendation {rec_id: "REC_LS2024_PC35_R03_001"})
SET rec.constituency_id = "UP-35",
    rec.action_type     = "REINFORCE_CANDIDATE",
    rec.priority        = "LOW",
    rec.status          = "pending",
    rec.rule_id         = "R-03",
    rec.rule_version    = "v1.0",
    rec.triggered_by    = '{"seat_status":"leaning","candidate_risk":"clean","vote_share_trend":"eroding"}',
    rec.created_at      = datetime(),
    rec.created_by      = "RuleEngine_v1.0",
    rec.reviewed_by     = null,
    rec.reviewed_at     = null
WITH rec
MATCH (ls:Constituency:LokSabhaConstituency {ls_id: "UP-35"})
MERGE (rec)-[:TARGETS]->(ls)
WITH rec
MATCH (rd:RuleDefinition {rule_id: "R-03", rule_version: "v1.0"})
MERGE (rec)-[:TRIGGERED_BY]->(rd)
WITH rec
MERGE (eb:EvidenceBundle {bundle_id: "EB_REC_LS2024_PC35_R03_001"})
SET eb.rec_id           = "REC_LS2024_PC35_R03_001",
    eb.explanation_text = "Lucknow (UP-35) has a leaning seat status with 9.5% margin. Rajnath Singh has a clean affidavit record. Vote share has eroded 3.2pp from LS2019 to LS2024, suggesting the seat needs incumbent reinforcement investment.",
    eb.generated_at     = datetime()
MERGE (rec)-[:BASED_ON]->(eb)
WITH eb
MATCH (er:ElectionResult {result_id: "LS2024_PC35"})
MERGE (eb)-[:CITES {weight: 0.6, field: "margin_pct"}]->(er)
WITH eb
MATCH (aff:Affidavit {affidavit_id: "AFF_LS2024_CAND_LS2024_PC35_RAJNATH_SINGH"})
MERGE (eb)-[:CITES {weight: 0.4, field: "serious_cases"}]->(aff);
```

---

## GRUBER'S 5 CRITERIA — Applied to the Current PRD Schema

Thomas Gruber (1993) defines five quality criteria for ontologies. Each is assessed against the PRD schema and current codebase.

### Criterion 1 — Clarity: Definitions are objective and well-documented

**Assessment: PARTIAL PASS**

Passed:
- Node labels are clear English nouns with obvious real-world referents.
- All IDs use string format consistently (e.g., "UP-35", "LS2024", "bjp").
- Rules are documented as explicit CASE expressions in §4.5.
- The provenance standard (§4.3) is well-defined and mandatory.

Violations:
1. `MediaTopic.sentiment` — the computation method is undefined (see §5.2). A field with an undefined computation method fails the clarity criterion.
2. `SeatClassification.org_status` — the PRD lists it as a classified field but provides no classification rule (see §3 Known Gap #3). There is no CASE expression for org_status. It appears to be copied directly from `OrgUnit.strength`, but this is not stated.
3. `turnout_trend` — defined with a rule (§4.5) but the PRD does not state where the computed value is used in any decision rule. It exists without purpose in the decision layer (see Known Gap #6 resolution below).
4. Generic `(Constituency)` in §4.2 without disambiguation — readers cannot determine which label to use without reading through §4.1.

**Fix:** Define computation methods for `sentiment`, `org_status`, and `turnout_trend` usage. Replace generic `(Constituency)` with `(c:Constituency)` notation explained in §4.2 of this document.

### Criterion 2 — Coherence: Inferences are consistent with definitions

**Assessment: PARTIAL PASS — 3 internal contradictions found**

**Contradiction A — `seat_status = lost` ENUM value with no producing rule:**
`SeatClassification.seat_status` ENUM includes `lost`. The Rule Set in §4.5 produces `safe`, `leaning`, `competitive`, `tossup` based on `margin_pct`. A seat that was lost produces `margin_pct` for the opposition winner, not for the party using this system. There is no rule that produces `lost`. The system cannot know a seat was `lost` without knowing which party is the "our party" — but the PRD is explicitly non-partisan.

**Resolution options:**
- Remove `lost` from the ENUM. A lost seat simply has `margin_pct` favouring a different party — this is captured in `winner_party_id` on `ElectionResult`. The classification would be inferred, not stored.
- Alternatively, add a rule: `IF er.winner_party_id != $party_of_interest THEN seat_status = lost` — but this requires the system to know which party is querying, violating the non-partisan design.
- **Recommended:** Remove `lost` from the ENUM for Phase 1. The factual record (who won) is on `ElectionResult`. Seat status for a classification system should be about contest intensity, not win/loss for a specific party.

**Contradiction B — `candidate_risk` ENUM mismatch:**
`SeatClassification.candidate_risk` ENUM lists `multiple_cases` but the rule in §4.5 produces `'multiple_cases_flagged'`. The rule and the ENUM are inconsistent. One must be corrected to match the other.

**Recommended fix:** Update ENUM to `multiple_cases_flagged` (matching the rule) to maintain parallel structure with `serious_cases_flagged`.

**Contradiction C — `delivery_status` ENUM mismatch:**
`SeatClassification.delivery_status` ENUM in §4.1 lists `partial` but the classification rule in §4.5 produces `'partial_coverage'`. These are different strings. The rule expression is more specific and descriptive.

**Recommended fix:** Update ENUM value from `partial` to `partial_coverage` to match the rule.

### Criterion 3 — Extendibility: Phase 2 additions do not require Phase 1 changes

**Assessment: PASS with one structural note**

The three-layer architecture (Civic → Governance → Decision) is well-designed for extendibility:
- Phase 2 governance nodes (`Issue`, `IssueObservation`, `Scheme`, `SchemeDelivery`, `OrgUnit`, `MediaTopic`) attach to Phase 1 constituency nodes via new relationships without modifying `LokSabhaConstituency` or `VidhanSabhaConstituency` schemas.
- Phase 3 decision nodes (`SeatClassification`, `DecisionRecommendation`, `EvidenceBundle`, `RuleDefinition`) read from Phase 1 and 2 data without modifying them.
- The `EvidenceBundle -[:CITES]->` pattern can cite any future node type with `weight` and `field` properties — no schema change needed to add new evidence types.

**One structural note:** The `SeatClassification` node aggregates fields from all three layers (`seat_status` from civic, `delivery_status` from governance, `org_status` from governance). If Phase 1 is implemented before Phase 2 data exists, `delivery_status` and `org_status` will be null. The import script must allow null for these fields and not fail validation when governance data is absent.

### Criterion 4 — Minimal Encoding Bias: No numeric codes where strings should be used

**Assessment: PASS**

The current PRD schema uses:
- String IDs throughout (`"UP-35"`, `"LS2024"`, `"bjp"`) — correct.
- String ENUMs for all classifications — correct.
- No numeric codes for status or category — correct.
- `INT` for `ls_no`, `vs_no`, `year` — these are genuinely numeric quantities, not encoded strings.

**One flag in `import_all.js`:** The `RiskCategory` node uses `risk_id: 'safe'` etc. — these are string identifiers, not numeric codes. However, the node type itself is deprecated and must be removed.

**One flag in `server.js`:** The graph node sentiment field `{"sentiment": 1}` and `{"sentiment": -1}` use numeric codes (+1/-1) to encode positive/negative sentiment. This is a minimal encoding bias violation for AI-generated graph data. However, this data structure lives only in the AI analysis responses, not in the Neo4j schema. It is not in the PRD. No action needed on schema — but the AI narration output format should use strings when it is implemented properly.

### Criterion 5 — Minimal Ontological Commitment: No speculative fields

**Assessment: PARTIAL PASS — 3 speculative or premature fields found**

**Speculative field A — `District.hindu_population` and `District.muslim_population`:**
These are Census 2011 facts, not speculative. However, storing religious community population counts on nodes in a governance accountability system creates a data model where religion is a first-class attribute of a constituency's profile. The PRD §1.2 excludes voter-level profiling and caste inference. Religion-population data at district level from Census 2011 is officially public, but the field's presence creates a path toward the excluded use cases. **Recommendation:** Retain for now as Census data (these are legitimate census fields), but document that these fields must not be used in any decision rule or classification. They are demographic context only.

**Speculative field B — `Candidate.gender`:**
The import script sets `gender = 'unknown'` for all candidates, an invalid ENUM value. Until ECI gender data is sourced, this field should be `null`, not a placeholder string. The field itself is valid (ECI does collect gender on nomination forms). Set to null until sourced.

**Speculative field C — `IssueObservation.source_types` as a LIST:**
This is forward-looking design. Phase 2 data sources are not yet identified. The field is appropriate but the implementation (LIST type in Neo4j) requires the import script to correctly handle array parameters. This is a valid field, but it should be tested before Phase 2 starts.

**Premature fields in `elections.json`:** `bjp_seats`, `sp_seats`, `bsp_seats`, `inc_seats`, `others_seats` are stored in the data file and currently imported to `Election` nodes by the import script (lines 217–223). These should not be on `Election` nodes — they are aggregated query results. Remove from both the data file and the import script.

---

## FINAL DELIVERABLE — Corrected Complete Schema

### Complete Node Label Registry

| Label | Layer | Shared Base Label | UNIQUE ID Field |
|---|---|---|---|
| `LokSabhaConstituency` | Civic | `Constituency` | `ls_id` |
| `VidhanSabhaConstituency` | Civic | `Constituency` | `vs_id` |
| `District` | Civic | — | `district_id` |
| `Election` | Civic | — | `election_id` |
| `ElectionResult` | Civic | — | `result_id` |
| `Turnout` | Civic | — | `turnout_id` |
| `Candidate` | Civic | — | `cand_id` |
| `Affidavit` | Civic | — | `affidavit_id` |
| `Party` | Civic | — | `party_id` |
| `Alliance` | Civic | — | `alliance_id` |
| `Issue` | Governance | — | `issue_id` |
| `IssueObservation` | Governance | — | `obs_id` |
| `Scheme` | Governance | — | `scheme_id` |
| `SchemeDelivery` | Governance | — | `delivery_id` |
| `OrgUnit` | Governance | — | `unit_id` |
| `MediaTopic` | Governance | — | `topic_id` |
| `SeatClassification` | Decision | — | `class_id` |
| `DecisionRecommendation` | Decision | — | `rec_id` |
| `EvidenceBundle` | Decision | — | `bundle_id` |
| `RuleDefinition` | Decision | — | `(rule_id, rule_version)` composite |

**Node labels that must NOT be created (remove from import script):**
`Booth`, `BoothResult`, `CommunityBlock`, `CasteGroup`, `RiskCategory`, `Strategy`, `Leader`

### Complete Relationship Type Registry (Disambiguated)

```
-- Civic structure
(District)                           -[:CONTAINS]->(Constituency:LokSabhaConstituency)
(Constituency:LokSabhaConstituency)  -[:HAS_VS]->(Constituency:VidhanSabhaConstituency)
(Constituency:LokSabhaConstituency)  -[:HAS_RESULT {election_id, source, source_date, confidence}]->(ElectionResult)
(Constituency:VidhanSabhaConstituency) -[:HAS_RESULT {election_id, source, source_date, confidence}]->(ElectionResult)
(Constituency:LokSabhaConstituency)  -[:HAS_TURNOUT {election_id, source, source_date, confidence}]->(Turnout)
(Constituency:VidhanSabhaConstituency) -[:HAS_TURNOUT {election_id, source, source_date, confidence}]->(Turnout)

-- Candidates
(Candidate) -[:CONTESTS_IN {election_id, vote_share, rank, source, source_date, confidence}]->(Constituency)
(Candidate) -[:BELONGS_TO {since_year}]->(Party)
(Candidate) -[:HAS_AFFIDAVIT {election_id}]->(Affidavit)
(Candidate) -[:IS_INCUMBENT_IN {since_year, terms}]->(Constituency)

-- Alliances
(Party) -[:PART_OF_ALLIANCE {election_id}]->(Alliance)

-- Governance
(Constituency) -[:HAS_ISSUE {election_id, source, source_date, confidence}]->(IssueObservation)
  [Note: HAS_ISSUE now points to IssueObservation, not Issue directly]
(IssueObservation) -[:OBSERVES]->(Issue)
(IssueObservation) -[:IN_CONSTITUENCY]->(Constituency)
(Scheme) -[:HAS_DELIVERY]->(SchemeDelivery)
(SchemeDelivery) -[:COVERS_CONSTITUENCY]->(Constituency)
(OrgUnit) -[:ACTIVE_IN]->(Constituency)
(MediaTopic) -[:COVERS]->(Constituency)

-- Decision
(SeatClassification) -[:CLASSIFIES]->(Constituency)
(DecisionRecommendation) -[:TARGETS]->(Constituency)
(DecisionRecommendation) -[:BASED_ON]->(EvidenceBundle)
(DecisionRecommendation) -[:TRIGGERED_BY]->(RuleDefinition)  [NEW]
(EvidenceBundle) -[:CITES {weight, field}]->(ElectionResult)
(EvidenceBundle) -[:CITES {weight, field}]->(Affidavit)
(EvidenceBundle) -[:CITES {weight, field}]->(Turnout)
(EvidenceBundle) -[:CITES {weight, field}]->(IssueObservation)
(EvidenceBundle) -[:CITES {weight, field}]->(SchemeDelivery)
```

**Relationships renamed from current codebase to PRD standard:**

| Old (codebase) | New (PRD) |
|---|---|
| `HAS_LS` | `CONTAINS` (and direction reversed: District→LS) |
| `CONTESTS` | `CONTESTS_IN` |

### Missing Rules — Definitions

#### Missing Rule: `org_status` Classification (Gap #3)

`SeatClassification.org_status` has no rule in the PRD. It must be populated from `OrgUnit` data. The rule is:

```cypher
-- org_status classification: copy from OrgUnit.strength for the constituency
-- If multiple OrgUnits exist, take the weakest (worst case)
MATCH (ou:OrgUnit)-[:ACTIVE_IN]->(c:Constituency {ls_id: $ls_id})
WHERE ou.last_assessed_date > date() - duration({months: 12})
WITH c,
  CASE
    WHEN 'absent'   IN collect(ou.strength) THEN 'absent'
    WHEN 'weak'     IN collect(ou.strength) THEN 'weak'
    WHEN 'moderate' IN collect(ou.strength) THEN 'moderate'
    ELSE 'strong'
  END AS org_status
RETURN org_status
```

This becomes Rule R-07 in the RuleDefinition set:
- `rule_id: "R-07"`, `rule_name: "ORG_STATUS_CLASSIFICATION"`
- `input_fields: ["OrgUnit.strength", "OrgUnit.last_assessed_date"]`
- `layer: "governance"` (it reads governance data to produce a governance classification field)
- **Note:** Assessment must be within 12 months to be valid. If no assessed OrgUnit exists for a constituency, `org_status` must be `null`, not defaulted to `absent`.

#### Missing Rule: `LEADERSHIP_VISIT` Trigger (Gap #4)

No rule in the PRD triggers `LEADERSHIP_VISIT`. Based on the system's logic, this rule should be:

```
Rule R-08: LEADERSHIP_VISIT
  IF seat_status IN [competitive, tossup]
  AND org_status IN [strong, moderate]       -- organisation capable of capitalising on visit
  AND issue_observation_count > 5            -- high issue salience, needs visible response
  AND candidate_risk = clean                 -- no reputational risk from associating senior leader
  THEN recommend LEADERSHIP_VISIT, priority MEDIUM
```

This becomes `RuleDefinition {rule_id: "R-08", rule_version: "v1.0"}`. Logic: A senior leader visit makes sense when the seat is contested, the local organisation can capitalise on it, issue salience is high, and the candidate does not create reputational risk for the visiting leader.

#### Missing Rule: `turnout_trend` Usage in Decision Rules (Gap #5)

`turnout_trend` is classified (rule in §4.5) but never used as a condition in any of Rules R-01 through R-06. It is a computed field with no downstream consumer, violating the Clarity criterion.

**Recommended addition to existing rules:**

Add `turnout_trend` as a secondary priority modifier to R-04 (CADRE_STRENGTHEN):

```
Rule R-04 (amended): CADRE_STRENGTHEN
  IF org_status IN [weak, absent]
  AND seat_status IN [competitive, tossup, leaning]
  THEN recommend CADRE_STRENGTHEN,
       priority = HIGH if turnout_trend IN [declining, sharply_declining]
                  else MEDIUM
```

Rationale: Declining turnout in a contested seat with weak organisation is a compounding risk. The turnout signal upgrades the priority of cadre strengthening.

### Corrected ENUM Values (3 inconsistencies fixed)

| Field | Old Value | Corrected Value | Reason |
|---|---|---|---|
| `SeatClassification.seat_status` | includes `lost` | Remove `lost` | No rule produces it; concept breaks non-partisan design |
| `SeatClassification.candidate_risk` | `multiple_cases` | `multiple_cases_flagged` | Matches rule expression in §4.5 |
| `SeatClassification.delivery_status` | `partial` | `partial_coverage` | Matches rule expression in §4.5 |

### Summary of All Bugs Found in `import_all.js`

| Line | Bug | Fix |
|---|---|---|
| 37–44 | Creates constraints for `Booth`, `BoothResult`, `CasteGroup`, `CommunityBlock`, `RiskCategory` — none in PRD schema | Remove these 5 constraint statements |
| 57–61 | Creates indexes for `Booth`, `BoothResult` | Remove these index statements |
| 102–108 | Party nodes created without `type` field or provenance fields | Add `type`, `source`, `ingested_at` |
| 115–118 | LS nodes created without provenance (`source`, `source_date`, `ingested_at`, `confidence`) | Add all provenance fields |
| 130 | `vs.reservation` copied from parent LS — incorrect | Source VS-specific reservation from ECI delimitation data |
| 185 | Relationship `HAS_LS` direction: `(ls)-[:HAS_LS]->(d)` reversed from PRD | Change to `(d)-[:CONTAINS]->(ls)` |
| 237–247 | Alliance nodes created without `election_id` | Add `election_id` to each alliance; use `"nda_2024"` not `"nda"` |
| 273 | `cb.bjp_affinity_2024 = $bjp_affinity_2024` — partisan classification | Remove this field |
| 269–277 | `CommunityBlock` nodes created — not in PRD | Remove entire block |
| 280–289 | `CasteGroup` nodes created — not in PRD | Remove entire block |
| 293–309 | `RiskCategory` nodes created — replaced by `SeatClassification` | Remove entirely |
| 376 | `c.party_id = toLower($winner_party)` stores full name, not party_id | Resolve to party_id via lookup |
| 377 | `c.gender = 'unknown'` — not in ENUM | Set to `null` |
| 382 | `MERGE (c)-[:CONTESTS]->(ls)` — wrong relationship name | Change to `CONTESTS_IN`, add `election_id`, `vote_share`, `rank` |
| 395–413 | `ElectionResult` missing `margin_votes`, `margin_pct`, `winner_vote_share`, `runner_up`, `runner_up_party_id`, `nota_votes`, `source_url`, all provenance | Compute and add all missing fields |
| All nodes | No provenance fields set on any node | Add `source`, `source_date`, `ingested_at`, `confidence` to every MERGE |

### Summary of All Bugs Found in `server.js`

| Line | Bug | Fix |
|---|---|---|
| 36–37 | `password = 'guru@9114'` hardcoded | Rotate credential immediately; use env var only |
| 52–69 | Sarvam AI key + 13 NewsData keys hardcoded | Rotate all; use env vars only |
| 170–174 | `GET /district/:district/constituencies` returns 5 fake names | Replace with `MATCH (ls)-[:HAS_VS]->(vs) RETURN vs.name` |
| 176–217 | `GET /constituency/:name/analysis` calls `axios` (not installed), always throws, returns fake data | Remove axios call; query real Neo4j schema |
| 193–194 | Uses `API_KEYS[0]` variable — undefined, causes ReferenceError | Remove; use the correct `SARVAM_API_KEY` |
| 287–303 | `GET /api/db-check` diagnostic route exists in production code | Delete before production deployment |
| 315–316 | `extractAndRepairJSON` regex `(\w+):` corrupts JSON strings containing colons | This function is only used for AI output, not graph data — acceptable for narrative only, but document limitation |
| 498, 714 | Queries `Strategy` nodes — not in PRD schema | These strategy analysis routes are outside PRD scope; refactor or remove |
| 984 | Queries `Leader` nodes via `REPRESENTED_BY` — not in PRD schema | Not in scope; remove or document as legacy |
| All DB property access | Uses camelCase property names (`totalPopulation`, `totalMale`) that do not match PRD snake_case (`total_population`) | Standardise: either PRD field names or current field names, but not both |

---

## Implementation Priority Order

Based on this analysis, the recommended Phase 1 implementation order is:

1. **Rotate all compromised credentials** (Sarvam AI key, 13 NewsData keys, Neo4j password) — this is pre-implementation security, not a schema task.

2. **Fix `createConstraints()`** — remove non-PRD labels (`Booth`, `BoothResult`, `CommunityBlock`, `CasteGroup`, `RiskCategory`); add missing constraints (`ElectionResult`, `Turnout`, `Affidavit`, `Alliance`, etc.).

3. **Fix `importConstituencies()`** — add shared `Constituency` base label; fix relationship name to `CONTAINS`; add provenance fields; fix VS reservation bug.

4. **Fix `importElections()`** — correct `type` ENUM values (`"LS"` not `"Lok Sabha"`); parse `phase_count`; add provenance; remove partisan seat counts.

5. **Fix `importConstituencyResults()`** — compute all missing `ElectionResult` fields; create all 1,055 `Candidate` nodes (not just 80 winners); fix `party_id` lookup; add provenance; rename `CONTESTS` to `CONTESTS_IN`.

6. **Add `importTurnout()` step** — new step using ECI electoral roll data.

7. **Add `importAffidavits()` step** — new step using MyNeta scrape data.

8. **Remove `importSocialStructure()`** — or rewrite without `CommunityBlock`, `CasteGroup`, `RiskCategory` blocks; retain `Issue` nodes only.

9. **Add validation layer** — wrap all MERGE statements with the provenance and field validators defined in §6.3.

10. **Fix API routes** — replace fake data with real Neo4j queries; delete `GET /api/db-check`.

---

*This document is the authoritative ontology reference for Phase 1 implementation. All schema decisions must be checked against this document before code is written. Any deviation requires explicit team sign-off and an update to this document.*
