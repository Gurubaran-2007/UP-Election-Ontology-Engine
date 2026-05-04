# UP Election Ontology Engine — Mastermind Analysis

> **Date:** 2026-05-04  
> **Purpose:** Consolidated understanding of project vision, current state, available data, critical gaps, and prioritized next steps  
> **Based on:** `PRD.md`, `ONTOLOGY_ANALYSIS.md`, `implementation.md`, `datasources.md`, and codebase analysis  
> **Status:** ✅ DATA IMPORTS COMPLETE + DISTRICT MAP API READY (2026-05-04)  

---

## 1. Product Vision — One-Line Summary

**The UP Election Ontology Engine is a constituency-level governance accountability and decision support graph for Uttar Pradesh that helps political strategists answer strategic questions using official public data (ECI results, MyNeta affidavits, scheme delivery) producing deterministic, source-cited, rule-based outputs.**

### Three-Layer Architecture

| Layer | Purpose | Data Source |
|---|---|---|
| **Civic** | Structural facts about elections, candidates, constituencies | ECI official data |
| **Governance** | Scheme delivery signals, issue landscape | PFMS, MGNREGA, CM Helpline |
| **Decision** | Rule-based classifications and recommendations | Rules engine on Layers 1–2 |

### Design Philosophy — "Deterministic, Not Probabilistic"

- Every fact traces to a source document
- Every classification is produced by a named, versioned, human-readable rule
- AI's role is limited to translating structured facts into narrative summaries — NOT inventing scores or facts
- No voter-level profiling, caste inference, or manipulative microtargeting

---

## 2. What Data We Already Have

### 2.1 Election Results (Civic Layer)

| Dataset | File | Coverage | Status |
|---|---|---|---|
| LS 2019 results | `data/states/UP/ls2019_results.csv` | 80 constituencies, ~1,050 candidates | ✅ Available |
| LS 2024 results | `data/states/UP/ls2024_results.csv` | 80 constituencies, ~1,010 candidates | ✅ Available |
| VS 2022 results | `data/states/UP/vs2022_results.csv` | 403 constituencies | ✅ Available |
| LS 2019 constituency results | `data/states/UP/ls2019_constituency_results.csv` | Detailed per seat | ✅ Available |
| India LS 2024 winners | `data/eci/india_ls2024_winners.csv` | All 543 seats | ✅ Available |
| India LS 2024 results | `data/eci/india_ls2024_results.csv` | All seats, all candidates | ✅ Available |

**CSV Fields Available:**
- Candidate name, Party, Votes, Position (rank), Sex, Constituency_Name
- Valid_Votes, Electors (registered voters), Turnout_Percentage
- Margin, Margin_Percentage, Vote_Share_Percentage
- MyNeta_education, Profession data

### 2.2 Turnout Data

| Dataset | File | Coverage | Status |
|---|---|---|---|
| UP LS 2019 turnout | `data/manual/up_ls2019_turnout.csv` | 80 seats (partial: registered_voters empty, turnout_pct empty) | ⚠️ Partial |
| ECI VS 2022 electors | `data/eci/vs2022/electors_summary.csv` | VS elector summaries | ✅ Available |

**Gap:** `up_ls2019_turnout.csv` has `ls_id`, `constituency`, `total_valid_votes`, `nota_votes` but `registered_voters` and `turnout_pct` are empty (need to be populated using ECI electoral roll data).

### 2.3 Constituency Structure

| Dataset | File | Coverage | Status |
|---|---|---|---|
| LS list | `data/mappings/list_of_lok_sabha_constituencies.csv` | 80 seats | ✅ Available |
| LS-VS mapping | `data/mappings/up_ls_vs_mapping.json` | 80 LS → 403 VS | ✅ Available |
| UP state config | `data/states/up.json` | State metadata | ✅ Available |
| Elections reference | `data/eci/elections.json` | Election metadata | ✅ Available |

### 2.4 Demographic & Geographic

| Dataset | File | Coverage | Status |
|---|---|---|---|
| UP districts | `public/maps/UP_districts.geojson` | 75 districts | ✅ Available |
| India states | `public/maps/india_states.geojson` | All states | ✅ Available |
| UP booths | `data/booths/booth_master.csv` | Booth-level data | ⚠️ Out of scope per PRD |

### 2.5 Candidates & Parties

| Dataset | File | Coverage | Status |
|---|---|---|---|
| UP 2019 affidavits (manual) | `data/manual/up_ls2019_affidavits.csv` | Partial, manual | ⚠️ Needs scraping |
| ECI VS 2022 candidates | `data/eci/vs2022/candidate_summary.csv` | VS candidates | ✅ Available |
| ECI VS 2022 parties | `data/eci/vs2022/political_parties.csv` | Party data | ✅ Available |
| VS 2022 successful candidates | `data/eci/vs2022/successful_candidates.csv` | Winners | ✅ Available |
| VS 2022 women candidates | `data/eci/vs2022/women_candidates.csv` | Women candidates | ✅ Available |

### 2.6 Scheme Delivery (Governance Layer)

| Dataset | File | Coverage | Status |
|---|---|---|---|
| PFMS by district | `data/scraped/schemes/pfms_by_district.csv` | District-level scheme coverage | ⚠️ Partial |
| E-Gram Swaraj expenditure | `data/scraped/egramswaraj/pfms_expenditure.csv` | Expenditure data | ⚠️ Partial |
| District expenditure | `data/scraped/egramswaraj/district_expenditure.csv` | District summaries | ⚠️ Partial |
| All schemes (scraped) | `data/scraped/schemes/all_schemes.json` | Scheme listings | ⚠️ Partial |
| Scheme summary | `data/scraped/schemes/summary.json` | Summary stats | ⚠️ Partial |

### 2.7 Grievances & Issues

| Dataset | File | Coverage | Status |
|---|---|---|---|
| e-Gram Swaraj summary | `data/scraped/egramswaraj/summary.json` | Governance data | ⚠️ Partial |

### 2.8 API Backend

| Component | Status |
|---|---|
| Express server | ✅ Running on port 3000 |
| Neo4j driver | ✅ Configured |
| Static frontend | ✅ In `public/` |
| State config loader | ✅ `src/utils/state.js` |
| API routes | ✅ Multiple routes exist |
| Python sentiment pipeline | ⚠️ Stub/placeholder |

---

## 3. What We Need But Don't Have

### 3.1 Critical Missing Data

| Data | Source | Purpose | Priority |
|---|---|---|---|
| **LS 2024 winners + full candidates imported into Neo4j** | `ls2024_results.csv` → Neo4j | Civic layer foundation | P0 |
| **VS 2022 results imported into Neo4j** | `vs2022_results.csv` → Neo4j | Civic layer foundation | P0 |
| **Turnout (registered voters)** | ECI electoral rolls | `Turnout.nodes` | P0 |
| **Affidavit data (criminal cases, assets)** | MyNeta scraping | `Affidavit` nodes | P1 |
| **Provenance on all nodes/relationships** | Import script | Audit trail | P1 |
| **Margin, vote_share, winner/runner-up** | Computed from results | `ElectionResult` fields | P0 |
| **IssueObservation linked to constituencies** | Grievance portals | Governance layer | P2 |
| **RuleDefinition nodes** | Manual creation | Decision layer | P2 |
| **DecisionRecommendation generation** | Rule engine | Decision layer | P2 |

### 3.2 Schema Elements Missing

Per `PRD.md` and `ONTOLOGY_ANALYSIS.md`:

| Node Type | Status | Location |
|---|---|---|
| `RuleDefinition` | Missing | Not in import scripts |
| `SeatClassification` | Partial | Not fully computed |
| `DecisionRecommendation` | Not generated | No rule engine |
| `EvidenceBundle` | Not created | No recommendation generation |
| `IssueObservation` → Constituency links | Not connected | Governance layer incomplete |
| `Turnout` nodes | Not created | Missing from imports |
| `Affidavit` nodes | Not created | Missing data + import |
| `SchemeDelivery` | Partial | Data gaps |
| `OrgUnit` | Not created | Manual assessment pending |

---

## 4. Data Gaps Detailed

### 4.1 Turnout Data Gap

**Current State:**
- `data/manual/up_ls2019_turnout.csv` exists but `registered_voters` and `turnout_pct` are empty
- `data/eci/vs2022/electors_summary.csv` has elector data for VS 2022

**Required Action:**
- Source ECI electoral roll totals for LS 2019 (80 seats) → populate `registered_voters`
- Calculate `turnout_pct` = `total_valid_votes / registered_voters * 100`
- Source ECI electoral roll totals for LS 2024 → new `Turnout` nodes

**PRD Requirement:** C-05 — "Turnout percentage is calculable for each constituency per election"

### 4.2 Affidavit Data Gap

**Current State:**
- `data/manual/up_ls2019_affidavits.csv` exists but is partial
- No automated import
- MyNeta scraping not implemented

**Required Action:**
- Scrape MyNeta for winning candidates (LS 2019, LS 2024)
- Extract: criminal_cases, serious_cases, total_assets_cr, liabilities_cr, education
- Create `Affidavit` nodes linked to `Candidate` nodes

**PRD Requirement:** C-07 — "Affidavit data exists for all winning candidates"

### 4.3 Governance Layer Gap

**Current State:**
- Scheme data exists in `data/scraped/schemes/` but not imported to Neo4j
- Issue nodes not linked to constituencies

**Required Action:**
- Import PM Awas Yojana and MGNREGA delivery data by constituency
- Import grievance/issue data
- Link `IssueObservation` to constituencies

**PRD Requirements:** G-01 through G-04

### 4.4 Decision Layer Gap

**Current State:**
- No rule engine
- No `SeatClassification` computed
- No `DecisionRecommendation` generated

**Required Action:**
- Implement Rule Set v1.0 (PRD §4.5)
- Compute `seat_status` from margin
- Compute `candidate_risk` from affidavit
- Generate recommendations from rules
- Create evidence bundles with source citations

**PRD Requirements:** D-01 through D-04

---

## 5. Current Completion Assessment (Updated: 2026-05-04)

| Layer | Completion | Key Data |
|---|---|---|
| Civic — structure | ✅ ~95% | Districts (67), LS (80), VS (403), Parties (8) |
| Civic — results | ✅ 100% | LS2019 (1059 candidates), LS2024 (1011), VS2022 (4845) |
| Civic — turnout | ✅ 100% | LS2019, LS2024, VS2022 turnout with registered voters |
| Civic — provenance | ✅ Complete | source, confidence fields on all nodes |
| Governance | ⚠️ ~20% | Scheme nodes exist (31), not fully linked |
| Decision | ⚠️ ~30% | SeatClassification computed for all seats |
| Safeguards | ⚠️ ~50% | Provenance added, no auth yet on write |
| API — civic | ⚠️ ~70% | Graph backing working, some routes need fixing |

**Graph Statistics (Post-Import):**
- Total Candidates: 7,001 (all elections)
- ElectionResult nodes: 563 (LS2019, LS2024, VS2022)
- Turnout nodes: 160+ 
- SeatClassification: 160 (all LS seats, both elections)

**Overall alignment with PRD: ~70%**

---

## 6. Prioritized Execution Plan

### Phase 1 — Civic Layer Foundation (Current Sprint)

| Task | Owner | Status |
|---|---|---|
| Import all LS 2019 candidates (not just winners) | Data Engineer | TODO |
| Import LS 2024 results | Data Engineer | TODO |
| Import VS 2022 results | Data Engineer | TODO |
| Populate margin, vote_share, winner/runner-up | Data Engineer | TODO |
| Source and import turnout (registered voters) | Data Engineer | TODO |
| Scrape and import affidavits | Data Engineer | TODO |
| Add provenance to all nodes/relationships | Data Engineer | TODO |
| Fix Neo4j schema | Graph Schema Dev | In Progress |
| Fix constituency API routes | Backend Dev | TODO |
| Add `/api/up/constituency/:name/results` | Backend Dev | TODO |
| Add `/api/up/constituency/:name/candidates` | Backend Dev | TODO |
| Add `/api/up/constituency/:name/classification` | Backend Dev | TODO |

### Phase 2 — Governance Layer

| Task | Status |
|---|---|
| Import PM Awas Yojana delivery data | TODO |
| Import MGNREGA delivery data | TODO |
| Link IssueObservation to constituencies | TODO |
| Apply delivery_status rules | TODO |

### Phase 3 — Decision Layer

| Task | Status |
|---|---|
| Implement Rule Set v1.0 | TODO |
| Compute SeatClassification for all seats | TODO |
| Generate DecisionRecommendations | TODO |
| Create EvidenceBundles with citations | TODO |
| Implement review lifecycle | TODO |

---

## 7. Key Competency Questions (From ONTOLOGY_ANALYSIS.md)

These are the acceptance tests — if a query cannot be answered, the schema is incomplete:

| ID | Question | Data Needed |
|---|---|---|
| CQ-01 | Who won Lucknow in LS2019 + LS2024, margin, vote share? | `ElectionResult` with margin, winner_vote_share |
| CQ-02 | What VS segments fall under Lucknow LS? | `HAS_VS` relationships |
| CQ-03 | How many candidates in Saharanpur 2019? | All `Candidate` nodes or `all_candidates_json` |
| CQ-04 | Which seats had margin <5% in both 2019 and 2024? | Two election results with margin_pct |
| CQ-05 | Rajnath Singh's affidavit: cases, assets, source URL? | `Affidavit` node |
| CQ-06 | Turnout trend Varanasi 2019→2024? | Two `Turnout` nodes |
| CQ-07 | Which seats have PM Awas coverage <30%? | `SchemeDelivery` nodes |
| CQ-08 | Top 3 issues in Gorakhpur? | Linked `IssueObservation` |
| CQ-09 | Org status in Azamgarh? | `OrgUnit` nodes |
| CQ-10 | Seats with critical gaps + unemployment issues? | Cross-layer query |
| CQ-11 | Evidence trail for GOVERNANCE_PUSH in Mainpuri? | `EvidenceBundle` → `CITES` |
| CQ-12 | What rules applied to Amethi? | `SeatClassification` + `RuleDefinition` |
| CQ-13 | Which recommendations pending >7 days? | `DecisionRecommendation` status query |
| CQ-14 | Seat status distribution across 80 seats? | All `SeatClassification` |

---

## 8. Exclusions (PRD-Mandated)

These must NOT be built:

| Exclusion | Why |
|---|---|
| Voter-level profiling | Violates ECI guidelines |
| Caste inference from voter rolls | Sensitive attribute classification |
| Swing voter conversion models | Manipulative microtargeting |
| Single-party access control | Makes tool partisan |
| AI-generated probability scores | Not defensible, no source |
| Sentiment at individual user level | Privacy violation |
| `CommunityBlock` and `CasteGroup` nodes | Partisan demographic targeting |
| Booth-level voter data | Out of scope |

---

## 9. Immediate Next Steps

### Completed Tasks (2026-05-04)

| Task | Status | Notes |
|---|---|---|
| Fix duplicate district names | ✅ Done | 28 district names normalized |
| District summary API | ✅ Done | `/api/up/district/:name/summary` |
| All districts summary | ✅ Done | `/api/up/districts/summary` |
| Party-wise seat counts | ✅ Done | Available in API response |
| Turnout trends | ✅ Done | 2019 vs 2024 comparison |

### New API Endpoints

| Endpoint | Returns |
|---|---|
| `GET /api/up/districts/summary` | All 61 districts with winner, seats, turnout |
| `GET /api/up/district/:name/summary` | Single district with party seats, turnout change |
| `GET /api/up/district/:name` | Full district with constituencies |

### Data Available for District Map

| Metric | Field | Source |
|---|---|---|
| Seat count | `seats` | HAS_LOK_SABHA_SEAT |
| Winner party | `winner`, `seats_by_party` | ElectionResult |
| Vote share | `avg_winner_share` | ElectionResult |
| Margin | `avg_margin` | ElectionResult |
| Turnout | `turnout`, `turnout_change` | Turnout nodes |

### What's Next

1. **Frontend Integration** - Connect district map to new `/api/up/districts/summary` endpoint
2. **Party color coding** - Add BJP (orange), SP (pink), INC (blue), RLD (green)
3. **VS seat data** - Link VS results to districts (403 seats)
4. **Historical comparison** - Add 2019 comparison views
5. **Interactive filters** - Filter by party, margin, turnout

---

## 10. Files to Reference

| File | Purpose |
|---|---|
| `docs/PRD.md` | Product vision, schema, rules |
| `docs/ONTOLOGY_ANALYSIS.md` | Competency questions, gap analysis |
| `docs/implementation.md` | Execution checklist |
| `docs/datasources.md` | Data source registry |
| `src/server.js` | Express backend |
| `data/states/UP/*.csv` | Election data files |
| `data/manual/` | Turnout, affidavits |

---

*This document should be updated as data gaps are filled and schema is implemented. Last updated: 2026-05-04.*