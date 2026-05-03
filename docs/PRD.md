# UP Election Ontology Engine — Product Requirements Document

> **Version:** 1.0  
> **Date:** 2026-05-03  
> **Status:** Active  
> **Supersedes:** DEVELOPMENT_GUIDE.md, PROJECT_STUDY_REFERENCE.txt, STRATEGY_ANALYSIS_LOGIC.txt, ONTOLOGY_IMPLEMENTATION_PLAN.md, up-bjp-booth-intelligence.md

---

## Part 0 — Existing Documentation Audit

Before stating what to build, this section records what the existing documentation got wrong so those errors are not carried forward.

### DEVELOPMENT_GUIDE.md
| Claim | Reality |
|---|---|
| "Maps: GeoJSON + Leaflet" | Leaflet was removed. All mapping uses D3.js only. |
| "Sensitive data stored in Render's Secret environment variables" | All credentials (Neo4j password, Sarvam AI key, 13 NewsData keys) are hardcoded in `server.js` as default fallbacks. They are in git history and must be considered compromised. |
| "Add new API keys to NEWSDATA_KEYS in server.js" | This instructs contributors to commit secrets to source code — the opposite of the stated security practice. |
| Describes a "production-grade" application | Constituency and booth routes always return fabricated mock data. No authentication exists on any endpoint. |

### PROJECT_STUDY_REFERENCE.txt
| Claim | Reality |
|---|---|
| "Leaflet.js for the India State Map" | India Map was removed in a commit. No Leaflet code exists anywhere. |
| "CREATED BY ANTIGRAVITY AI" | Git author is `Gurubaran-2007`. Attribution is inconsistent. |
| Describes a working constituency/booth module | These modules call `axios` (not installed), always throw `ReferenceError`, always return hardcoded fake data. |

### STRATEGY_ANALYSIS_LOGIC.txt
| Claim | Reality |
|---|---|
| Steps are numbered 1, 2, 4, 3 | Out-of-order editing. Not a reliable reference. |
| "AI returns structured JSON that the frontend uses to draw charts" | The `extractAndRepairJSON` regex (`(\w+):`) corrupts valid JSON containing colons in string values (e.g. URLs). Results fall to hardcoded fallback graphs. |
| Describes "revolutionary" AI-grounded analysis | The AI invents scores (positive: 82, negative: 12) with no source. Scores are not grounded in any measured fact. |

### ONTOLOGY_IMPLEMENTATION_PLAN.md
| Claim | Reality |
|---|---|
| Lists what "exists" in Neo4j local | Local Docker Neo4j and AuraDB (production) are two separate databases with incompatible schemas. No sync or migration script exists. |
| Lists `SentimentObservation` as a missing node | The branch is named `sentiment_analysis` but contains no sentiment analysis code. |
| Community block data has `bjp_affinity_2024` field | This field encodes partisan affinity ratings, not civic facts. Incompatible with the stated purpose of this product. |

### up-bjp-booth-intelligence.md
| Issue | Detail |
|---|---|
| Contains raw AI thinking artifacts | File includes `Thinking: Got it, let's tackle this...` — internal LLM reasoning committed verbatim. |
| Contains terminal instructions | Ends with `cd /path/to/your/repo`, `touch up-bjp-booth-intelligence.md` — instructions meant to be followed, not committed. |
| Partisan access model | "Only authorized BJP personnel will have access via OTP/role-based access." This makes the product a single-party operational tool, which contradicts the stated purpose. |
| Personal voter data processing | "Caste Inference: Sarvam AI on Voter Rolls" — running inference on voter rolls to classify individuals by caste violates Responsible AI principles and ECI data guidelines. |
| Swing voter conversion targeting | "Calculate swing voter potential (estimated opposition voters convertible to BJP)" — this is manipulative microtargeting, explicitly excluded from the product purpose. |

**This file should be deleted or fully rewritten before any further development.**

---

## Part 1 — Product Vision

### 1.1 Purpose Statement

The UP Election Ontology Engine is a **constituency-level governance accountability and decision support graph** for Uttar Pradesh.

It helps a leader answer lawful strategic questions:
- Which constituencies need policy attention?
- Which development issues correlate with anti-incumbency?
- Which candidate profiles are stronger locally?
- Where do organizational gaps exist?
- What actions improve public trust, service delivery, candidate fit, and election readiness in each constituency?

The graph operates on **official public data** — ECI election results and turnout, MyNeta/ADR candidate affidavits, official government scheme delivery data — and produces **deterministic, source-cited, rule-based outputs** that support human judgment rather than replacing it.

### 1.2 What This Product Is Not

These are explicitly excluded from scope. Any feature that moves toward these must be rejected at design review.

| Excluded | Why |
|---|---|
| Voter-level profiling or targeting | Violates ECI data guidelines and Responsible AI principles for India |
| Caste inference from voter rolls | Classifying individual citizens by sensitive attributes for campaign use |
| Swing voter conversion models | Manipulative microtargeting |
| Single-party access control | Makes this a partisan tool, not a governance accountability tool |
| Probabilistic AI scores as primary output | Fabricated numbers with no source are not defensible |
| Sentiment scores from social media at individual level | Aggregate discourse signals only, not individual-level opinion mining |

### 1.3 Design Philosophy

**Deterministic, not probabilistic.**

Every fact in the graph traces to a source document. Every classification is produced by a named, versioned, human-readable rule. Every recommendation cites the facts that triggered it. A human reviewer can verify any output by reading the source document.

| Probabilistic (rejected) | Deterministic (required) |
|---|---|
| AI returns `"positive": 82` | Graph stores `margin_pct: 1.8` from ECI 2024 |
| Weighted composite score of 72 | Rule: `margin_pct < 5 → seat_status = competitive` |
| "High resistance from OBC voters" (AI opinion) | `ElectionResult: non_yadav_obc_swing = -4.2pp` (CSDS survey, cited) |
| Sentiment model predicts dissatisfaction | `SchemeDelivery: coverage_pct = 43%` (PFMS, cited) |

AI's role in this system is limited to: translating structured graph facts into readable Hindi or English narrative. It does not generate the underlying facts or scores.

---

## Part 2 — Users

| User | What They Need |
|---|---|
| **Constituency in-charge** | Seat health snapshot: margin trend, top issues, scheme gaps, candidate risk |
| **State campaign coordinator** | Cross-constituency comparison: where to deploy senior leaders, where governance push matters more than messaging |
| **Candidate evaluation team** | Affidavit risk summary, historical vote share, incumbency record, issue fit |
| **Governance programme officer** | Which constituencies have the worst scheme delivery gaps and highest issue salience |
| **Research analyst** | Queryable graph: custom Cypher queries across all civic, governance, and decision data |

---

## Part 3 — Three-Layer Architecture

### Layer 1 — Civic

Structural facts about elections, candidates, and constituencies. All data from ECI official sources.

**What it answers:** Who won where, by how much, on what turnout, with what candidate profile?

### Layer 2 — Governance

Delivery signals and issue landscape. All data from official government portals and public datasets.

**What it answers:** Is the government delivering in this constituency? What issues are most salient?

### Layer 3 — Decision

Rule-based classifications and recommendations derived from Layers 1 and 2. No AI inference.

**What it answers:** What specific actions should be prioritised in this constituency, and why?

---

## Part 4 — Ontology Schema

### 4.1 Object Types (Node Labels)

Every node carries provenance fields: `source`, `source_url`, `source_date`, `ingested_at`, `confidence`.

#### Civic Layer Nodes

```
LokSabhaConstituency {
  ls_id           STRING  UNIQUE        -- "UP-34"
  ls_no           INT                   -- 34
  name            STRING                -- "Lucknow"
  reservation     ENUM[GEN, SC, ST]
  region          STRING                -- "Awadh"
  source          STRING                -- "ECI_DELIMITATION_2008"
  source_date     DATE
}

VidhanSabhaConstituency {
  vs_id           STRING  UNIQUE        -- "UP-VS-34-2"
  vs_no           INT
  name            STRING                -- "Lucknow East"
  reservation     ENUM[GEN, SC, ST]
  ls_id           STRING                -- parent LS constituency
  source          STRING
  source_date     DATE
}

District {
  district_id     STRING  UNIQUE
  name            STRING
  state           STRING  DEFAULT "Uttar Pradesh"
  census_year     INT     DEFAULT 2011
  total_population  BIGINT
  rural_population  BIGINT
  urban_population  BIGINT
  hindu_population  BIGINT
  muslim_population BIGINT
  literacy_rate     FLOAT
  sex_ratio         FLOAT
  source          STRING  DEFAULT "CENSUS_2011"
  source_date     DATE    DEFAULT 2011-03-01
}

Election {
  election_id     STRING  UNIQUE        -- "LS2024", "VS2022"
  type            ENUM[LS, VS]
  year            INT
  state           STRING  DEFAULT "Uttar Pradesh"
  phase_count     INT
  source          STRING  DEFAULT "ECI"
}

ElectionResult {
  result_id           STRING  UNIQUE    -- "LS2024_PC34"
  election_id         STRING
  constituency_id     STRING
  winner              STRING
  winner_party_id     STRING
  winner_votes        BIGINT
  winner_vote_share   FLOAT             -- calculated: winner_votes / total_valid_votes * 100
  runner_up           STRING
  runner_up_party_id  STRING
  runner_up_votes     BIGINT
  margin_votes        BIGINT            -- winner_votes - runner_up_votes
  margin_pct          FLOAT             -- margin_votes / total_valid_votes * 100
  total_valid_votes   BIGINT
  nota_votes          BIGINT
  all_candidates_json STRING            -- full result array stored for audit
  source              STRING  DEFAULT "ECI"
  source_url          STRING
  source_date         DATE
}

Turnout {
  turnout_id          STRING  UNIQUE    -- "TURNOUT_LS2024_PC34"
  election_id         STRING
  constituency_id     STRING
  registered_voters   BIGINT            -- from ECI electoral rolls
  votes_cast          BIGINT
  turnout_pct         FLOAT             -- votes_cast / registered_voters * 100
  source              STRING  DEFAULT "ECI_ROLLS"
  source_url          STRING
  source_date         DATE
}

Candidate {
  cand_id         STRING  UNIQUE        -- "CAND_LS2024_PC34_RAJNATH"
  name            STRING
  party_id        STRING
  election_id     STRING
  constituency_id STRING
  votes           BIGINT
  vote_share      FLOAT
  rank            INT                   -- 1 = winner
  gender          ENUM[M, F, OTHER]
  source          STRING  DEFAULT "ECI"
  source_url      STRING
  source_date     DATE
}

Affidavit {
  affidavit_id        STRING  UNIQUE
  cand_id             STRING
  election_id         STRING
  criminal_cases      INT               -- total declared cases
  serious_cases       INT               -- IPC 302, 376, 420 etc, categorised by ADR
  total_assets_cr     FLOAT             -- in crore INR, declared
  liabilities_cr      FLOAT             -- declared
  education           STRING            -- declared education level
  pan_declared        BOOLEAN
  source              STRING  DEFAULT "MyNeta_ADR"
  source_url          STRING            -- direct myneta.info URL for this candidate
  scraped_date        DATE
}

Party {
  party_id        STRING  UNIQUE        -- "bjp", "sp", "bsp"
  name            STRING
  symbol          STRING
  type            ENUM[NATIONAL, STATE, REGISTERED]
}

Alliance {
  alliance_id     STRING  UNIQUE        -- "nda_2024", "india_bloc_2024"
  name            STRING
  election_id     STRING
}
```

#### Governance Layer Nodes

```
Issue {
  issue_id        STRING  UNIQUE
  name            STRING                -- "Unemployment"
  category        ENUM[economic, governance, local, social, ideological]
}

IssueObservation {
  obs_id              STRING  UNIQUE
  constituency_id     STRING
  issue_id            STRING
  election_id         STRING
  evidence_count      INT               -- number of source documents citing this issue
  source_types        LIST[STRING]      -- ["grievance_portal", "news", "manifesto"]
  source_date         DATE
  confidence          ENUM[high, medium, low]
}

Scheme {
  scheme_id       STRING  UNIQUE        -- "PM_AWAS_YOJANA"
  name            STRING
  ministry        STRING
  launch_year     INT
  beneficiary_type  STRING              -- "rural_poor", "farmers", etc.
}

SchemeDelivery {
  delivery_id         STRING  UNIQUE
  scheme_id           STRING
  constituency_id     STRING
  target_count        BIGINT
  beneficiaries_count BIGINT
  coverage_pct        FLOAT             -- beneficiaries_count / target_count * 100
  last_updated        DATE
  source              STRING            -- "PFMS", "MGNREGA_MIS"
  source_url          STRING
}

OrgUnit {
  unit_id             STRING  UNIQUE
  type                ENUM[booth_committee, mandal, district_cell]
  constituency_id     STRING
  strength            ENUM[strong, moderate, weak, absent]
  last_assessed_date  DATE
  assessed_by         STRING
}

MediaTopic {
  topic_id        STRING  UNIQUE
  headline        STRING
  source_outlet   STRING
  pub_date        DATE
  constituency_id STRING
  sentiment       ENUM[positive, negative, neutral]  -- aggregate, not individual
  source_url      STRING
}
```

#### Decision Layer Nodes

```
SeatClassification {
  class_id            STRING  UNIQUE
  constituency_id     STRING
  election_id         STRING
  -- All fields below are rule-produced, not AI-generated
  seat_status         ENUM[safe, leaning, competitive, tossup, lost]
  turnout_trend       ENUM[improving, stable, declining, sharply_declining]
  vote_share_trend    ENUM[consolidating, stable, eroding, sharp_erosion]
  delivery_status     ENUM[on_target, near_target, partial, critical_gap]
  candidate_risk      ENUM[clean, cases_declared, multiple_cases, serious_cases_flagged]
  org_status          ENUM[strong, moderate, weak, absent]
  -- Provenance
  rule_version        STRING  DEFAULT "v1.0"
  computed_at         DATETIME
  input_sources       LIST[STRING]      -- which nodes fed each field
}

DecisionRecommendation {
  rec_id              STRING  UNIQUE
  constituency_id     STRING
  action_type         ENUM[GOVERNANCE_PUSH, REPLACE_CANDIDATE, REINFORCE_CANDIDATE,
                            CADRE_STRENGTHEN, ALLIANCE_REVIEW,
                            COMMUNICATIONS_EMPHASIS, LEADERSHIP_VISIT]
  priority            ENUM[HIGH, MEDIUM, LOW]
  status              ENUM[pending, approved, rejected, actioned, outcome_recorded]
  rule_id             STRING            -- which rule triggered this
  rule_version        STRING
  triggered_by        MAP               -- {field: value} pairs that satisfied the rule
  created_at          DATETIME
  created_by          STRING            -- "RuleEngine_v1.0" or human username
  reviewed_by         STRING            -- must be set before status → approved/rejected
  reviewed_at         DATETIME
  outcome_notes       STRING
}

EvidenceBundle {
  bundle_id           STRING  UNIQUE
  rec_id              STRING
  explanation_text    STRING            -- plain language summary of why recommendation was made
  generated_at        DATETIME
  -- Evidence items stored as CITES relationships to source nodes
}
```

---

### 4.2 Link Types (Relationships)

Every relationship carries: `source`, `source_date`, `confidence`.

```
-- Civic structure
(District)                  -[:CONTAINS]->            (LokSabhaConstituency)
(LokSabhaConstituency)      -[:HAS_VS]->              (VidhanSabhaConstituency)
(LokSabhaConstituency)      -[:HAS_RESULT {election_id}]->  (ElectionResult)
(LokSabhaConstituency)      -[:HAS_TURNOUT {election_id}]-> (Turnout)
(VidhanSabhaConstituency)   -[:HAS_RESULT {election_id}]->  (ElectionResult)
(VidhanSabhaConstituency)   -[:HAS_TURNOUT {election_id}]-> (Turnout)

-- Candidates
(Candidate)                 -[:CONTESTS_IN {election_id, vote_share, rank}]-> (LokSabhaConstituency)
(Candidate)                 -[:BELONGS_TO {since_year}]->   (Party)
(Candidate)                 -[:HAS_AFFIDAVIT {election_id}]->(Affidavit)
(Candidate)                 -[:IS_INCUMBENT_IN {since_year, terms}]-> (LokSabhaConstituency)

-- Alliances
(Party)                     -[:PART_OF_ALLIANCE {election_id}]-> (Alliance)

-- Governance
(Constituency)              -[:HAS_ISSUE {election_id}]->   (Issue)
(IssueObservation)          -[:OBSERVES]->                  (Issue)
(IssueObservation)          -[:IN_CONSTITUENCY]->           (Constituency)
(Scheme)                    -[:HAS_DELIVERY]->              (SchemeDelivery)
(SchemeDelivery)            -[:COVERS_CONSTITUENCY]->       (Constituency)
(OrgUnit)                   -[:ACTIVE_IN]->                 (Constituency)
(MediaTopic)                -[:COVERS]->                    (Constituency)

-- Decision
(SeatClassification)        -[:CLASSIFIES]->                (Constituency)
(DecisionRecommendation)    -[:TARGETS]->                   (Constituency)
(DecisionRecommendation)    -[:BASED_ON]->                  (EvidenceBundle)
(EvidenceBundle)            -[:CITES {weight, field}]->     (ElectionResult)
(EvidenceBundle)            -[:CITES {weight, field}]->     (Affidavit)
(EvidenceBundle)            -[:CITES {weight, field}]->     (Turnout)
(EvidenceBundle)            -[:CITES {weight, field}]->     (IssueObservation)
(EvidenceBundle)            -[:CITES {weight, field}]->     (SchemeDelivery)
```

---

### 4.3 Data Lineage — Provenance Standard

Every node and every relationship must carry these fields. They are not optional.

```cypher
-- Standard provenance block on node creation
SET n.source        = "ECI_2024"            -- which dataset/system
SET n.source_url    = "https://eci.gov.in/..."  -- direct link to source document
SET n.source_date   = date("2024-06-04")    -- when the underlying data is from
SET n.ingested_at   = datetime()            -- when we loaded it into Neo4j
SET n.confidence    = "high"                -- high = official source, medium = derived, low = estimated

-- Standard provenance on relationship creation
MERGE (a)-[r:HAS_RESULT {
  source:      "ECI_2024",
  source_date: date("2024-06-04"),
  confidence:  "high"
}]->(b)
```

Provenance enables this query on any recommendation:
```cypher
MATCH (rec:DecisionRecommendation {rec_id: $id})
      -[:BASED_ON]->(bundle)
      -[:CITES]->(fact)
RETURN fact, fact.source, fact.source_url, fact.source_date
```
Every fact behind every recommendation is auditable back to its source document.

---

### 4.4 Action Types

Actions are not AI suggestions. They are named workflow states stored as `DecisionRecommendation` nodes with a strict lifecycle.

```
GOVERNANCE_PUSH         -- accelerate scheme delivery in this constituency
REPLACE_CANDIDATE       -- field a different candidate
REINFORCE_CANDIDATE     -- invest in incumbent retention
CADRE_STRENGTHEN        -- prioritise booth-level party organisation
ALLIANCE_REVIEW         -- renegotiate seat share with an ally
COMMUNICATIONS_EMPHASIS -- messaging-heavy intervention, governance delivery is adequate
LEADERSHIP_VISIT        -- schedule senior leader event
```

Lifecycle: `pending → approved/rejected → actioned → outcome_recorded`

A recommendation cannot move from `pending` to `actioned` without a human setting `reviewed_by` and `reviewed_at`. This is enforced at the API layer.

---

### 4.5 Functions — Rule Set v1.0

All classifications are deterministic Cypher CASE expressions. No ML. No weighted averages. All thresholds are human-set, documented here, versioned.

#### Seat Classification Rules

```cypher
-- Seat status (from latest LS result)
CASE
  WHEN er.margin_pct < 2    THEN 'tossup'       -- 16 UP seats in 2019 below 5%
  WHEN er.margin_pct < 5    THEN 'competitive'
  WHEN er.margin_pct < 15   THEN 'leaning'
  ELSE                           'safe'
END AS seat_status

-- Turnout trend (requires two elections)
CASE
  WHEN (t_new.turnout_pct - t_old.turnout_pct) < -5  THEN 'sharply_declining'
  WHEN (t_new.turnout_pct - t_old.turnout_pct) < -2  THEN 'declining'
  WHEN (t_new.turnout_pct - t_old.turnout_pct) >  2  THEN 'improving'
  ELSE                                                     'stable'
END AS turnout_trend

-- Vote share direction (winner party, 2019 vs 2024)
CASE
  WHEN (er_new.winner_vote_share - er_old.winner_vote_share) < -8  THEN 'sharp_erosion'
  WHEN (er_new.winner_vote_share - er_old.winner_vote_share) < -3  THEN 'eroding'
  WHEN (er_new.winner_vote_share - er_old.winner_vote_share) >  3  THEN 'consolidating'
  ELSE                                                                   'stable'
END AS vote_share_trend
```

#### Candidate Classification Rules

```cypher
-- Candidate risk from affidavit facts
CASE
  WHEN aff.serious_cases  > 0  THEN 'serious_cases_flagged'
  WHEN aff.criminal_cases > 3  THEN 'multiple_cases_flagged'
  WHEN aff.criminal_cases > 0  THEN 'cases_declared'
  ELSE                              'clean'
END AS candidate_risk

-- Asset class from affidavit declaration
CASE
  WHEN aff.total_assets_cr > 100  THEN 'very_high_assets'
  WHEN aff.total_assets_cr > 50   THEN 'high_assets'
  WHEN aff.total_assets_cr > 10   THEN 'moderate_assets'
  ELSE                                  'low_assets'
END AS asset_class
```

#### Scheme Delivery Classification

```cypher
CASE
  WHEN sd.coverage_pct < 30   THEN 'critical_gap'
  WHEN sd.coverage_pct < 60   THEN 'partial_coverage'
  WHEN sd.coverage_pct < 85   THEN 'near_target'
  ELSE                              'on_target'
END AS delivery_status
```

#### Decision Rules — When to Recommend Each Action

```
Rule R-01: GOVERNANCE_PUSH
  IF seat_status IN [competitive, tossup]
  AND delivery_status IN [critical_gap, partial_coverage]
  THEN recommend GOVERNANCE_PUSH, priority HIGH

Rule R-02: REPLACE_CANDIDATE
  IF seat_status IN [competitive, tossup]
  AND candidate_risk = serious_cases_flagged
  AND vote_share_trend IN [eroding, sharp_erosion]
  THEN recommend REPLACE_CANDIDATE, priority HIGH

Rule R-03: REINFORCE_CANDIDATE
  IF seat_status IN [safe, leaning]
  AND candidate_risk = clean
  AND vote_share_trend = consolidating
  THEN recommend REINFORCE_CANDIDATE, priority LOW

Rule R-04: CADRE_STRENGTHEN
  IF org_status IN [weak, absent]
  AND seat_status IN [competitive, tossup, leaning]
  THEN recommend CADRE_STRENGTHEN, priority MEDIUM

Rule R-05: ALLIANCE_REVIEW
  IF seat_status = tossup
  AND margin_pct < 3
  AND any allied party holds VS seats in this LS constituency
  THEN recommend ALLIANCE_REVIEW, priority HIGH

Rule R-06: COMMUNICATIONS_EMPHASIS
  IF delivery_status IN [on_target, near_target]
  AND issue_observation_count > 3
  AND candidate_risk = clean
  THEN recommend COMMUNICATIONS_EMPHASIS, priority MEDIUM
```

Rules are stored as `RuleDefinition` nodes in Neo4j so they can be queried and versioned.

---

## Part 5 — Data Sources

### 5.1 Approved Sources by Layer

| Layer | Data | Source | Format | Status |
|---|---|---|---|---|
| Civic | LS constituency structure | ECI Delimitation Order 2008 | JSON | Done |
| Civic | VS constituency mapping | anandpdoshi gist + delimitation inference | JSON | Done |
| Civic | LS 2019 results, all candidates | pratapvardhan/Elections-India-2019 | CSV → JSON | Done (80 seats, 1,055 candidates) |
| Civic | LS 2024 results, all candidates | ECI results website | HTML/PDF → JSON | TODO |
| Civic | VS 2022 results, all candidates | ECI UP state results | HTML/PDF → JSON | TODO |
| Civic | Electoral roll totals (for turnout) | ECI electoral roll summary | PDF → INT | TODO |
| Civic | Candidate affidavits | MyNeta.info / ADR | HTML scrape → JSON | TODO |
| Governance | Scheme delivery coverage | PFMS, MGNREGA MIS | API/CSV | TODO |
| Governance | Issues / grievances | Public grievance portals, CM Helpline UP | CSV | TODO |
| Governance | Census demographics | Census of India 2011 (2021 not yet released) | CSV | Partial (district level in AuraDB) |
| Governance | Socioeconomic indicators | SHRUG v2.3 (dataschool.io) | CSV | TODO |

### 5.2 Explicitly Excluded Sources

| Source | Reason |
|---|---|
| Individual voter rolls with names | Personal data — aggregate totals only are permissible |
| Social media at individual user level | Individual-level opinion data violates privacy norms |
| Purchased voter data | Outside lawful basis |
| Internal party worker data | Outside this system's scope unless anonymised and consented |
| 2021 Census | Not released by Government of India as of this document's date |

---

## Part 6 — Functional Requirements

### 6.1 Civic Layer (Phase 1)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| C-01 | Every LS constituency has a node with result data for LS2019 | 80/80 constituencies queryable, margin_pct populated, source = ECI |
| C-02 | Every LS constituency has a node with result data for LS2024 | 80/80 constituencies queryable, margin_pct populated |
| C-03 | Every VS constituency has a node linked to its parent LS node | 403/403 VS nodes, all with HAS_VS relationship |
| C-04 | Every constituency result stores all candidates, not just the winner | `all_candidates_json` field populated, `Candidate` nodes for all contestants |
| C-05 | Turnout percentage is calculable for each constituency per election | `Turnout.turnout_pct` populated from ECI electoral roll registered voter count |
| C-06 | Margin is stored as a direct property, not calculated at query time | `ElectionResult.margin_pct` and `margin_votes` both set |
| C-07 | Affidavit data exists for all winning candidates | `Affidavit` node with `criminal_cases`, `serious_cases`, `total_assets_cr`, `source_url` |
| C-08 | `SeatClassification` computed for all 80 LS seats | All fields populated, `rule_version` set |
| C-09 | Full hierarchy traversable: District → LS → VS | Cypher path query returns results for all 75 districts |
| C-10 | All nodes and edges carry provenance fields | `source`, `source_date`, `confidence` present on every node and relationship |

### 6.2 Governance Layer (Phase 2)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| G-01 | Each constituency has at least one `IssueObservation` linked | Issue nodes connected via `HAS_ISSUE` with `evidence_count` > 0 |
| G-02 | Top 3 issues per constituency queryable | Cypher query returns ordered issues by `evidence_count` |
| G-03 | Scheme delivery coverage populated for at least 2 major schemes | `SchemeDelivery.coverage_pct` for PM Awas and MGNREGA per constituency |
| G-04 | `delivery_status` classification applied to all constituencies | Rule Set v1.0 applied, `SeatClassification.delivery_status` populated |

### 6.3 Decision Layer (Phase 3)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| D-01 | `DecisionRecommendation` generated for all competitive and tossup seats | All seats with `seat_status` in [competitive, tossup] have at least one recommendation |
| D-02 | Every recommendation has an `EvidenceBundle` with source citations | `CITES` relationships from bundle to at least 2 source nodes |
| D-03 | Recommendation lifecycle enforced: human review required | API returns 400 if attempt to set `status = actioned` without `reviewed_by` |
| D-04 | Rules are stored as queryable nodes | `RuleDefinition` nodes exist with `rule_id`, `rule_version`, `conditions`, `action_type` |

### 6.4 API Layer

| Endpoint | Returns | Source |
|---|---|---|
| `GET /api/up/district/:name/constituencies` | Real VS list from `HAS_VS` graph traversal | Neo4j |
| `GET /api/up/constituency/:name/classification` | `SeatClassification` node with all fields | Neo4j |
| `GET /api/up/constituency/:name/candidates` | All candidates with votes, share, affidavit risk | Neo4j |
| `GET /api/up/constituency/:name/results` | Multi-election result history with margins | Neo4j |
| `GET /api/up/constituency/:name/issues` | Top issues by evidence count | Neo4j |
| `GET /api/up/constituency/:name/recommendation` | `DecisionRecommendation` + evidence | Neo4j |
| `GET /api/up/seats/competitive` | All seats in [competitive, tossup] with classifications | Neo4j |
| `POST /api/up/recommendation/:rec_id/review` | Update status, set reviewed_by | Neo4j (auth required) |

AI narration endpoint (optional, never the primary source):
| `POST /api/up/constituency/:name/narrative` | Plain-language Hindi/English summary of classification facts | Graph facts → Sarvam AI → text |

---

## Part 7 — Non-Functional Requirements and Safeguards

### 7.1 Provenance (Non-Negotiable)

Every node must have `source`, `source_date`, and `confidence`. Every relationship must have `source` and `source_date`. Import scripts that do not set these fields must fail with a validation error, not silently proceed.

### 7.2 Human Review Before Action

No `DecisionRecommendation` may transition to `actioned` without a human setting `reviewed_by` and `reviewed_at`. This must be enforced at the API layer, not just by convention.

### 7.3 Aggregate Analytics Only

The system operates at constituency and district level. No analytics at individual voter level. No models that classify individual citizens by caste, religion, or political preference.

### 7.4 Bias Audit on Rules

Before each Rule Set version release:
- Verify no rule produces systematically different outcomes for reserved vs general constituencies that cannot be explained by the underlying data
- Verify affidavit risk rules apply identically regardless of party affiliation
- Document the audit outcome in the rule version metadata

### 7.5 No Credentials in Source Code

All secrets (Neo4j, API keys) must be environment variables only. No hardcoded defaults in `server.js`. Rotate the following immediately (all are in git history): Neo4j password `guru@9114`, Sarvam AI key `sk_v9tiidlu_...`, all 13 NewsData keys.

### 7.6 Authentication

All `DecisionRecommendation` write endpoints require authentication. Read endpoints for public civic data (election results, affidavits) may be unauthenticated. The `GET /api/db-check` diagnostic route must be removed from production.

---

## Part 8 — Implementation Roadmap

### Phase 1 — Civic Layer Foundation (Current Sprint)

**Three-person division:**

**Person 1 (Data Engineer)**
- Import all 1,055 candidates from existing `up_ls2019_constituency_results.json` (currently only 80 winners imported)
- Calculate and store `margin_votes`, `margin_pct`, `winner_vote_share` on `ElectionResult` nodes
- Download and parse LS 2024 results for all 80 UP seats
- Download and parse VS 2022 results for all 403 UP seats
- Scrape affidavit data for all winning candidates from MyNeta
- Source ECI electoral roll totals (registered voters) for turnout calculation

**Person 2 (Graph Schema Developer)**
- Migrate local Docker Neo4j data into AuraDB — one unified database (critical path for Person 3)
- Extend schema with `Turnout`, `Affidavit` node types
- Add `margin_votes`, `margin_pct`, `winner_vote_share` to existing `ElectionResult` nodes
- Add `IS_INCUMBENT_IN` relationship
- Add `source`, `source_date`, `confidence` to all existing nodes and relationships
- Verify full traversal: `District → LS → VS` returns results for all 75 districts

**Person 3 (Backend Developer)**
- Fix `GET /api/up/district/:name/constituencies` — replace 5 fake names with real `HAS_VS` query
- Fix `GET /api/up/constituency/:name/analysis` — remove broken `axios` call, query real Neo4j data
- Add `GET /api/up/constituency/:name/results` — multi-candidate result data
- Add `GET /api/up/constituency/:name/candidates` — full candidate list with affidavit summary
- Remove `GET /api/db-check` diagnostic route
- Fix `closeDistrictPanel()` undefined reference in `upmap.js`

**Dependency:** Person 3's API work requires Person 2's AuraDB migration (Task 2.1) to complete first.

### Phase 2 — Governance Layer

- Import MGNREGA MIS delivery data per district
- Import PM Awas Yojana coverage data
- Scrape and structure issue observations from UP CM Helpline grievance data
- Connect `Issue` nodes to constituencies via `IssueObservation`
- Apply delivery status classification rules

### Phase 3 — Decision Layer

- Implement `SeatClassification` computation using Rule Set v1.0
- Implement `DecisionRecommendation` generation from decision rules
- Implement `EvidenceBundle` with source citations
- Implement human review API endpoints with lifecycle enforcement
- Store `RuleDefinition` nodes for all rules with version metadata

### Phase 4 — AI Narration Layer

- Replace current AI score generation with structured graph query
- Sarvam AI receives pre-computed facts from graph, returns Hindi/English narrative only
- AI output is clearly labelled as "narrative summary" not "analysis"
- Narrative always displays source citations from the underlying `EvidenceBundle`

---

## Part 9 — Current State Assessment

As of 2026-05-03, `sentiment_analysis` branch:

| Layer | Completion | Notes |
|---|---|---|
| Civic — structure | 50% | LS/VS hierarchy exists, margin/turnout/affidavit missing |
| Civic — data | 30% | 2019 winners only; 2024, 2022 VS, turnout all missing |
| Civic — provenance | 0% | No source fields on any node or relationship |
| Governance | 5% | Issue nodes exist; not linked to constituencies |
| Decision | 3% | RiskCategory nodes exist; not assigned to any constituency |
| Safeguards | 0% | No provenance, no human review, no auth on write endpoints |
| API — civic routes | 15% | District map works; constituency/booth always return mock data |

**Overall alignment with stated purpose: 22%**

The civic layer foundation (structure, import scripts, 2019 data) is the most complete part of the codebase and is the correct starting point. Everything else builds on top of it.

---

## Part 10 — Glossary

| Term | Definition |
|---|---|
| Deterministic | Same inputs always produce the same output via explicit rules; no probabilistic inference |
| Provenance | The source, URL, date, and confidence level attached to every fact in the graph |
| EvidenceBundle | A set of cited source nodes that together explain why a recommendation was made |
| Rule Set | A versioned collection of CASE/IF-THEN rules that classify facts into actionable categories |
| Civic Layer | Graph nodes and relationships derived entirely from ECI official election data |
| Governance Layer | Graph nodes and relationships from government scheme delivery and public issue data |
| Decision Layer | Rule-produced classifications and human-reviewed recommendations derived from Layers 1–2 |
| Action Type | A named category of human decision that can be recommended and tracked through a review lifecycle |
