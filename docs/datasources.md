# Data Sources Registry

This file consolidates the data sources currently mentioned across the project docs and existing repo data files.

It is intended to be the single reference point for:
- approved sources
- existing local files
- pending acquisitions
- excluded or out-of-scope data

Primary references used to compile this file:
- `docs/PRD.md`
- `docs/ONTOLOGY_ANALYSIS.md`
- `docs/implementation.md`

## Approved Sources

| Source | Purpose | Status | Format | Notes |
|---|---|---|---|---|
| ECI Delimitation Order 2008 | Authoritative LS and VS constituency structure and reservation | Mentioned, not fully materialized in repo | Official order / structured extract | Canonical source for constituency IDs and reservation categories |
| ECI Form 20 / ECI results site | Election results for LS 2019, LS 2024, VS 2022 | Partial | HTML / PDF / CSV / JSON | Canonical source for candidate rows, winner, margin, total valid votes, NOTA |
| ECI electoral roll summaries | Registered voters and turnout inputs | Mentioned, not yet imported | PDF / tabular extract | Required for `Turnout` nodes |
| MyNeta / ADR | Candidate affidavit data | Mentioned, not yet imported | HTML / scraped JSON | Required for `Affidavit` nodes |
| PFMS | Scheme delivery data | Mentioned, not yet imported | API / CSV | Planned governance source |
| MGNREGA MIS | Scheme delivery data | Mentioned, not yet imported | API / CSV | Planned governance source |
| Census of India 2011 | District demographic data | Partial | CSV / official tables | Approved; 2021 Census remains excluded |
| Public grievance portals / CM Helpline UP | Issue observations | Mentioned, not yet imported | CSV / structured records | Planned governance source |
| SHRUG v2.3 | Socioeconomic indicators | Mentioned, not yet imported | CSV | Supporting governance source |
| CSDS-Lokniti post-poll survey | Aggregate electoral trend inputs | Mentioned, not yet imported | CSV / SPSS | Supporting analysis source, not foundational civic source |

## Existing Repo Data Files

| File | Source Type | Status | Intended Use | Notes |
|---|---|---|---|---|
| `data/eci/up_ls2019_constituency_results.json` | Reusable with transformation | Present | Candidate-level LS 2019 result import | Must be transformed into `ElectionResult` and `Candidate` nodes |
| `data/eci/up_ls2019_constituency_results.csv` | Reusable with transformation | Present | Tabular LS 2019 result import | Backup/import-friendly version of the 2019 result data |
| `data/eci/elections.json` | Reusable with correction | Present | `Election` node seed data | Needs enum normalization and removal of partisan seat-count fields |
| `data/mappings/up_ls_vs_mapping.json` | Reusable with additions | Present | LS-to-VS structure import | Missing official VS reservation and full VS identifiers |
| `data/india_data.json` | Out of scope | Present | None for current PRD | India-wide data, not aligned to the UP constituency schema |

## Pending Data Acquisition

| Source | Needed For | Current Status | Planned Output |
|---|---|---|---|
| LS 2024 ECI result data | `ElectionResult`, `Candidate`, `SeatClassification` | TODO | Structured JSON / CSV in `data/eci/` |
| VS 2022 ECI result data | VS-level results and history | TODO | Structured JSON / CSV in `data/eci/` |
| ECI electoral roll totals | `Turnout` nodes | TODO | Structured extract in `data/eci/` or `data/manual/` |
| MyNeta / ADR affidavits | `Affidavit` nodes | TODO | Structured JSON in `data/manual/` or dedicated affidavit path |
| PFMS scheme data | `SchemeDelivery` | TODO | Normalized import files |
| MGNREGA MIS data | `SchemeDelivery` | TODO | Normalized import files |
| Census 2011 district/village extracts | Governance demographics | Partial / TODO | Normalized import files |
| SHRUG v2.3 UP extracts | Socioeconomic governance layer | TODO | `data/manual/` or normalized derived files |
| Public grievance / CM Helpline data | `IssueObservation` | TODO | Structured issue evidence files |

## Excluded or Out-of-Scope Sources

| Source | Status | Why Excluded |
|---|---|---|
| Individual voter rolls with names | Excluded | Personal data; outside lawful and PRD scope |
| Voter-level caste inference | Excluded | Sensitive-attribute classification of individuals |
| Purchased voter data | Excluded | Outside lawful basis and PRD scope |
| Individual social-media opinion data | Excluded | Privacy and Responsible AI concerns |
| 2021 Census | Excluded for now | Not officially released as a usable source in the project docs |
| `data/mappings/community_blocks.json` in its current form | Excluded from active ontology import | Contains `bjp_affinity_2024`, which is a partisan classification not allowed by the PRD |
| Booth-level targeting logic from old server routes | Excluded | Outside current PRD scope and inconsistent with the governance-accountability framing |

## Source Quality Tiers

| Tier | Meaning | Examples |
|---|---|---|
| Tier 1 | Official / authoritative source | ECI, Census 2011, PFMS, MGNREGA MIS |
| Tier 2 | Public but secondary structured source | MyNeta / ADR, SHRUG |
| Tier 3 | Supporting analysis source | CSDS-Lokniti, grievance-derived issue summaries |
| Excluded | Must not feed the production ontology in current form | `community_blocks.json`, voter-level targeting data |

## Before Building Further

- [ ] Confirm which sources are the canonical import source for each PRD node type
- [ ] Record a download or acquisition path for every pending source
- [ ] Add source URLs and acquisition dates for all local datasets
- [ ] Mark each local file as `approved`, `derived`, `staging`, or `excluded`
- [ ] Verify that no excluded source is still being imported by current scripts
- [ ] Add provenance metadata expectations to each import step

## Suggested Next Step

Create a follow-up `docs/data_inventory.md` or extend this file with:
- direct source URLs
- owner / acquisition status
- local path
- refresh cadence
- import script that consumes the source
