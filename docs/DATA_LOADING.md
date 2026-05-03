# Data Loading Guide

How to populate your local Neo4j instance after cloning this repo.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 18 | `node --version` |
| Python | ≥ 3.10 | `python3 --version` |
| Neo4j | ≥ 5.x | Desktop, Docker, or AuraDB free tier |
| npm deps | — | `npm install` |

---

## 1. Configure environment

Copy `.env` and fill in your Neo4j credentials:

```bash
cp .env .env.local      # optional — .env is already gitignored for local secrets
```

Edit `.env`:

```
NEO4J_URI=neo4j://localhost:7687     # or neo4j+s://xxxx.databases.neo4j.io for AuraDB
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password-here

NEWSDATA_API_KEYS=your-key1,your-key2    # get free keys at newsdata.io
PYTHON_BIN=.venv/bin/python              # path to python inside your venv
```

---

## 2. Set up Python virtual environment

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

> **Note — `torch` is excluded by default** (it is ~2 GB). The sentiment pipeline runs
> on VADER-only mode without it. To enable DistilBERT multilingual classification for
> Hindi articles, install it separately once ready:
>
> ```bash
> .venv/bin/pip install torch transformers
> ```

---

## 3. Load the base graph

Imports districts, constituencies (80 LS + 403 VS), parties, alliances, elections,
issues, scheme stubs, and rule definitions. Takes ~30 seconds.

```bash
node scripts/import_all.js
```

**What gets created:**

| Node type | Count |
|---|---|
| District | 67 |
| LokSabhaConstituency | 80 |
| VidhanSabhaConstituency | 403 |
| Party | 8 |
| Alliance | 3 |
| Election | 3 |
| Issue | 10 |
| Scheme | 4 |
| SchemeDelivery stubs | 320 |
| RuleDefinition | 6 |

> **Step 11 will warn** "No LS2024 ElectionResult nodes found" on first run — this is expected.
> Run Step 4 (import_tcpd.js LS2024) first, then re-run `import_all.js` to get SeatClassifications.

---

## 4. Load election results (TCPD data)

Imports candidates, results, turnout, and incumbent flags for all three elections.
Run each election separately. Takes ~10–60 seconds per election.

```bash
node scripts/import_tcpd.js --election LS2019
node scripts/import_tcpd.js --election VS2022
node scripts/import_tcpd.js --election LS2024
```

**What gets created per election:**

| Election | Candidates | ElectionResult | Turnout |
|---|---|---|---|
| LS2019 | ~979 | 80 | 80 |
| VS2022 | ~4442 | 403 | 403 |
| LS2024 | ~931 | 80 | 80 |

**Source files** (must exist in `data/eci/`):

```
data/eci/up_ls2019_results.csv    ← from TCPD Lok Dhaba GE dataset (year=2019, state=UP)
data/eci/up_vs2022_results.csv    ← from TCPD AE dataset (year=2022, state=UP)
data/eci/up_ls2024_results.csv    ← from opencity.in / ECI (80 PC results)
```

> The repo ships with all three CSV files. If they are missing, see `docs/datasources.md`
> for download instructions.

---

## 5. Re-run import_all.js to evaluate seat classifications

After LS2024 ElectionResult nodes exist, Step 11 will compute `SeatClassification`
nodes for all 80 seats using `RULE_V1_SEAT_STATUS` (margin < 2% = tossup, < 5% = competitive):

```bash
node scripts/import_all.js
```

Expected output from Step 11:
```
✓ Created/updated 80 SeatClassification nodes
  tossup: 10  competitive: 27  safe: 43
```

---

## 6. Load leader entities (for sentiment entity resolution)

Creates `LeaderEntity` nodes and alias indexes used by the sentiment pipeline.

```bash
.venv/bin/python scripts/load_entities_to_neo4j.py
```

Loads 16 entities (leaders + parties) from `data/aliases/up_entities.json`.

---

## 7. Run the sentiment pipeline

Fetches news from NewsData API, classifies sentiment, resolves entities, writes
`SentimentObservation` nodes, computes `SentimentAggregation`, and checks alert rules.

```bash
.venv/bin/python run_sentiment_pipeline.py
```

This runs once manually. In production it is scheduled automatically every 6 hours
by the Express server's built-in `setInterval` cron (no separate cron job needed).

> Requires at least one `NEWSDATA_API_KEYS` value in `.env`. Free tier gives 200
> requests/day. Keys are rotated automatically on 429 responses.

---

## 8. Verify the graph

```bash
node scripts/import_all.js   # Step 12 prints counts for all node types
```

Or query Neo4j Browser directly:

```cypher
// Node counts
MATCH (n) RETURN labels(n)[0] AS label, count(n) AS count ORDER BY count DESC;

// Check a constituency end-to-end
MATCH (ls:LokSabhaConstituency {name: 'Varanasi'})
OPTIONAL MATCH (ls)-[:HAS_RESULT]->(er:ElectionResult {election_id: 'LS2024'})
OPTIONAL MATCH (ls)-[:HAS_CLASSIFICATION]->(sc:SeatClassification)
OPTIONAL MATCH (ls)-[:HAS_DELIVERY]->(sd:SchemeDelivery)
RETURN ls.name, er.winner, er.margin_pct, sc.seat_status, count(sd) AS schemes;
```

---

## Load order summary

```
1. npm install
2. python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
3. node scripts/import_all.js                          # base graph
4. node scripts/import_tcpd.js --election LS2019
5. node scripts/import_tcpd.js --election VS2022
6. node scripts/import_tcpd.js --election LS2024
7. node scripts/import_all.js                          # re-run for SeatClassification
8. .venv/bin/python scripts/load_entities_to_neo4j.py  # leader entities
9. .venv/bin/python run_sentiment_pipeline.py           # first news fetch
10. node server.js                                      # start API server
```

---

## Troubleshooting

**`✗ NEO4J_PASSWORD environment variable is not set`**
→ Add `NEO4J_PASSWORD` to `.env` and make sure `.env` is in the project root.

**`AuthError: Unsupported authentication token`**
→ The Python script is not loading `.env`. Run from the project root, not a subdirectory.

**`No module named 'torch'`**
→ Expected — torch is optional. The pipeline runs on VADER-only until you install torch.
   See step 2 note above.

**Step 11 shows 0 SeatClassifications**
→ Run `import_tcpd.js --election LS2024` first, then re-run `import_all.js`.

**`upDistricts is not defined` (older versions)**
→ Fixed in the current code. Pull latest and re-run.

**AuraDB connection (`neo4j+s://...`)**
→ The JS driver detects the `+s` prefix and enables encryption automatically.
   No extra config needed — just set `NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io`.

---

## What is NOT auto-loaded

These require manual data sourcing and are marked in `todo.md`:

| Missing data | Source | Notes |
|---|---|---|
| Affidavit data | adrindia.org | Download candidate affidavit CSVs per election |
| Turnout (LS2019 JSON) | TCPD / ECI | `data/eci/up_ls2019_turnout.json` |
| Real scheme delivery coverage | data.gov.in / MIS portals | Currently seeded with NFHS-5 UP averages |
| Booth-level data | ECI / SDM offices | Phase 2 scope |
