# District Map — Feature Implementation Plan

**Scope:** UP Election Ontology Engine — DistrictMap tab + right-side panel
**Date:** 2026-05-04
**Basis:** Actual audit of Neo4j seed scripts, CSV files, and existing routes

---

## Data Inventory (what is actually seeded today)

| Node / Data | Status | Count | Notes |
|---|---|---|---|
| `LokSabhaConstituency` | ✅ Ready | 80 | UP LS seats |
| `ElectionResult` (LS2024) | ✅ Ready | 80 | winner, party_id, margin_pct, vote_share, runner_up |
| `ElectionResult` (LS2019) | ✅ Ready | 80 | same fields + margin_votes, nota_votes |
| `ElectionResult` (VS2022) | ✅ Ready | 403 | winner, party per assembly segment |
| `SeatClassification` | ✅ Ready | 80 | seat_status (tossup/competitive/safe) via RULE_V1_SEAT_STATUS |
| `Candidate` (LS2019) | ✅ Ready | ~880 | name, party_id, votes, vote_share, gender, education |
| `Turnout` (LS2019) | ✅ Ready | 80 | turnout_pct from TCPD CSV |
| `Scheme` | ✅ Ready | 4 | PM Awas, MGNREGA, PM Kisan, Ujjwala |
| `SchemeDelivery` | ⚠️ Stubs | 320 | UP state averages (NFHS-5), all seats = same values |
| `Issue` (taxonomy) | ✅ Ready | 10 | unemployment, roads, law_order, etc. |
| `IssueObservation` | ❌ Empty | 0 | Schema exists, no per-constituency data seeded |
| `Affidavit` (LS2019) | ⚠️ Partial | 80 | Source CSV has empty criminal_cases/assets for most |
| `DecisionRecommendation` | ❌ Empty | 0 | Schema + routes exist, no seed yet |
| LS2024 Candidates (TCPD) | ✅ In CSV | 1011 rows | Not yet imported as Candidate nodes |
| Turnout LS2024 | ✅ In CSV | 80 rows | `Turnout_Percentage` column in ls2024_results.csv |

**Key derived computations available immediately (no new seeding needed):**
- `vote_share_trend`: LS2019 winner_vote_share vs LS2024 winner_vote_share (same party)
- `turnout_trend`: LS2019 turnout_pct vs LS2024 turnout_pct (both in ElectionResult)
- `seat_status_label`: Already in SeatClassification

---

## Feature Feasibility by Data Tier

### Tier 1 — Build Now (fully ready, no seeding needed)

#### F1: Seat Health Choropleth on District/LS map
**What it shows:** Color each LS constituency by `seat_status` from `SeatClassification`.

Colors:
- `tossup` (<2% margin) → `#dc2626` (red)
- `competitive` (2–5%) → `#f97316` (orange)
- `safe` (>5%) → `#16a34a` (green)

Hover tooltip:
- Winner name + party badge
- `margin_pct` formatted as "Won by 4.2%"
- `winner_vote_share` as "Vote share: 48%"
- Turnout from `er.total_valid_votes / er.registered_voters` (both in ElectionResult)

**Backend:** New endpoint `GET /api/metrics/up/ls2024/classifications`
- Query: `MATCH (ls:LokSabhaConstituency)-[:HAS_RESULT]->(er:ElectionResult {election_id:'LS2024'}) OPTIONAL MATCH (ls)-[:HAS_CLASSIFICATION]->(sc:SeatClassification) RETURN ls.ls_id, ls.name, sc.seat_status, er.winner, er.winner_party_id, er.margin_pct, er.winner_vote_share`

**Frontend:** Map view toggle — add `'health'` mode alongside existing region colors. When `viewMode === 'health'`, color LS paths by seat_status instead of region cluster.

---

#### F6a: Competitive Seats Filter Panel
**What it shows:** Below the map, a filterable table:
> "Showing 8 tossup seats | 12 competitive | 60 safe"

Clicking a row highlights the seat on the map and opens the right panel.

**Backend:** Existing `GET /api/up/seats/competitive?margin_pct=10` already returns this. Extend to accept `?status=tossup,competitive`.

**Frontend:** Add a `<FilterBar>` below the map SVG; on click, call `highlightOnMap(seat.name)` and `setSel(...)` to open right panel.

---

#### F7: Timeline Sparkline (3-point trend)
**What it shows:** In right panel for selected constituency, two tiny charts:
1. Winner party vote share: LS2019 → (VS2022 sum) → LS2024
2. Turnout: LS2019 → LS2024

**Backend:** Existing `GET /api/up/constituency/:name/results` already returns all `ElectionResult` nodes for a constituency ordered by election_id. VS2022 segments are linked via `HAS_VS` → can aggregate.

**Frontend:** Two `<Sparkline>` components (simple SVG polyline, no D3 needed) using the results array. Show trend direction arrow (↑/↓/→) based on delta.

---

### Tier 2 — Build with Small Seed Scripts (1–3 days data prep)

#### F1b: Turnout Trend Badge
**What it shows:** On the seat health choropleth tooltip: trend arrow for turnout change.

**Computation:** `delta = er_2024.turnout_pct - er_2019.turnout_pct`
- `delta > 3` → `improving` (↑)
- `-3 < delta ≤ 3` → `stable` (→)
- `delta < -3` → `declining` (↓)

**Seed script required:** `scripts/compute_trends.js`
- Read LS2019 + LS2024 ElectionResult pairs for each ls_id
- Write `turnout_trend` and `vote_share_trend` properties onto `SeatClassification`
- Also write `runner_up_party_id` change detection (alliance shift)
- ~50 lines, pure Neo4j read → compute → write

**Frontend:** After SeatClassification has these fields, the tooltip reads them directly.

---

#### F4: Winner Candidate Card in Right Panel
**What it shows:** For selected constituency, a "Winner Profile" card:
- Name, party badge, education level
- Election: LS2024 vote_share%, margin%
- `candidate_risk` badge (clean / cases_declared / multiple_cases)

**Data needed:**
- LS2024 winner education → in TCPD CSV `ls2024_results.csv` (`MyNeta_education` column, Position=1 row)
- `criminal_cases` / `total_assets_cr` → `up_ls2019_affidavits.csv` is mostly empty; skip for now, show "Affidavit: Pending" label
- `candidate_risk` → evaluate via RULE_V1_CANDIDATE_RISK once affidavit data available

**Seed script required:** `scripts/import_ls2024_candidates.js`
- Filter ls2024_results.csv for UP rows with Position=1 (winners)
- Extract: Candidate, Party, Vote_Share_Percentage, MyNeta_education, Margin_Percentage
- MERGE into `Candidate` nodes linked to each LS constituency

**Frontend:** Add `<CandidateCard>` to the district right panel. Fetch from `GET /api/up/constituency/:name/candidates?election=LS2024`.

---

#### F5: Basic DecisionRecommendation Seeding
**What it shows:** For tossup/competitive seats, a "Recommended Actions" section in right panel:
- Action type: `GOVERNANCE_PUSH`, `CADRE_MOBILIZATION`, `LEADERSHIP_VISIT`
- Priority: high/medium
- Status: pending (awaiting human review)
- Evidence: `margin_pct`, `delivery_status`, `seat_status` cited as source facts

**Seed script required:** `scripts/seed_recommendations.js`
- For each SeatClassification where `seat_status IN ['tossup','competitive']`:
  - Create `DecisionRecommendation` node with action_type based on rule:
    - margin < 2% → GOVERNANCE_PUSH + CADRE_MOBILIZATION
    - margin 2–5% → CADRE_MOBILIZATION
  - Link `EvidenceBundle` citing the margin_pct and delivery_status facts
- ~80 lines, pure Cypher through the existing Neo4j driver

**Frontend:** Add "Actions" section to right panel, visible only for tossup/competitive seats. Show recommendation cards with a "Mark Reviewed" button (calls existing `POST /api/up/recommendation/:id/review`).

---

### Tier 3 — Show with Data Quality Labels (stubs visible, not misleading)

#### F2: Governance Coverage Panel
**What it shows:** 4 scheme rows with coverage %, labeled "State average estimate":
- PM Awas Yojana: 61% (estimated)
- MGNREGA: 54% (estimated)
- PM Kisan: 72% (estimated)
- PM Ujjwala: 68% (estimated)

**Important:** All 80 constituencies have identical stub values from NFHS-5 UP state averages. Show the "estimated" label prominently. Do NOT imply per-constituency variation until real PFMS data is available.

**Backend:** `GET /api/up/constituency/:name/schemes` — query `HAS_DELIVERY` edges, return coverage_pct + data_quality field.

**Frontend:** In right panel "Governance" section, show scheme rows with a yellow `⚠ Estimated` badge. Add link text: "Source: NFHS-5 state average — real data pending".

**What real data would require:** PFMS district-wise MIS reports (government portal, requires manual download per scheme per district quarterly).

---

### Tier 4 — Schema Ready, No Data (future work)

#### F3: Issue Salience per Constituency
- `Issue` taxonomy exists (10 categories)
- `IssueObservation` nodes are empty — needs an ETL that reads news/grievance sources and maps mentions to constituency
- **When to build:** After the sentiment/news pipeline populates IssueObservations
- **Placeholder UI:** Right panel can show "Issue data not yet available for this constituency" with the 10 issue category chips as a legend

#### F4b: Full Affidavit Risk Card
- `Affidavit` nodes exist but `criminal_cases`, `total_assets_cr` are 0/null for most candidates
- `up_ls2019_affidavits.csv` source file has empty columns — needs re-scraping from MyNeta/ADR
- **When to build:** After affidavit scraper runs and populates the CSV
- **Placeholder UI:** Show "Affidavit: Pending ADR data" with source link to MyNeta for each winner

#### F8: Provenance Drawer
- All nodes have `source`, `source_date`, `confidence` fields
- **Backend:** Simple Cypher to collect all facts and their provenance for a given constituency
- **Frontend:** "View Sources" button in right panel opens a drawer with fact-by-fact citations
- **Priority:** Add after core panels are stable (low effort, high PRD alignment)

---

## Implementation Order

### Phase 1 (this sprint — all Tier 1)
1. `GET /api/metrics/up/ls2024/classifications` endpoint in `metrics.js`
2. Map view mode toggle: add `health` mode to `DistrictMap.tsx`
3. Choropleth coloring by seat_status (tossup/competitive/safe)
4. Hover tooltip with winner, margin, vote_share
5. 3-point sparkline in right panel using existing `/constituency/:name/results`
6. Competitive seats filter bar below map

### Phase 2 (next sprint)
1. `scripts/compute_trends.js` — add turnout_trend + vote_share_trend to SeatClassification
2. `scripts/import_ls2024_candidates.js` — winner education from TCPD LS2024 CSV
3. CandidateCard component in right panel
4. `scripts/seed_recommendations.js` — basic DecisionRecommendation for competitive seats
5. Actions section in right panel + "Mark Reviewed" button

### Phase 3 (when data is available)
1. Governance panel with real PFMS data replacing stubs
2. Affidavit risk card after ADR re-scrape
3. Issue salience after sentiment pipeline produces IssueObservations
4. Provenance drawer

---

## API Endpoints to Build

| Endpoint | Method | Data source | Phase |
|---|---|---|---|
| `/api/metrics/up/ls2024/classifications` | GET | Neo4j: SeatClassification + ElectionResult | 1 |
| `/api/up/constituency/:name/results` | GET | Already exists | — |
| `/api/up/constituency/:name/candidates?election=LS2024` | GET | Already exists (needs LS2024 seed) | 2 |
| `/api/up/constituency/:name/schemes` | GET | Neo4j: SchemeDelivery | 3 |
| `/api/up/seats/competitive` | GET | Already exists | 1 (extend) |
| `/api/up/recommendation/:id/review` | POST | Already exists | 2 |

---

## Frontend Components to Build

| Component | Location | Phase | Dependencies |
|---|---|---|---|
| `HealthChoropleth` map mode | `DistrictMap.tsx` | 1 | classifications endpoint |
| Hover `SeatTooltip` | `DistrictMap.tsx` | 1 | classifications endpoint |
| `<Sparkline>` | Right panel | 1 | existing results endpoint |
| `<FilterBar>` competitive filter | Below map | 1 | existing competitive endpoint |
| `<CandidateCard>` | Right panel | 2 | LS2024 candidates seed |
| `<ActionCard>` recommendations | Right panel | 2 | recommendations seed |
| `<GovernancePanel>` schemes | Right panel | 3 | PFMS data |
| `<ProvenanceDrawer>` | Right panel | 3 | any node |

---

## Seed Scripts to Write

| Script | Input | Output | Phase |
|---|---|---|---|
| `compute_trends.js` | ElectionResult (LS2019+LS2024) | turnout_trend, vote_share_trend on SeatClassification | 2 |
| `import_ls2024_candidates.js` | `ls2024_results.csv` (Position=1 rows) | Candidate nodes with education for each winner | 2 |
| `seed_recommendations.js` | SeatClassification nodes | DecisionRecommendation nodes for competitive seats | 2 |

---

## Data Quality Commitment

| Feature | Confidence | Label shown in UI |
|---|---|---|
| Seat status (margin-based) | High | "Source: ECI 2024 official results" |
| Winner, party, vote share | High | "Source: ECI 2024" |
| LS2019 turnout | Medium | "Source: TCPD Lok Dhaba" |
| Turnout trend | Computed | "Computed from LS2019 and LS2024 official counts" |
| Scheme delivery % | Estimated | "⚠ State average estimate (NFHS-5) — not constituency-specific" |
| Affidavit data | Pending | "Affidavit: ADR data pending" |
| Issue salience | Not available | "Issue data pending — ETL in progress" |
