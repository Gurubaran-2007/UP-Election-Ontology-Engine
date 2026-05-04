# TODO

## Python / Dependencies

- [ ] **torch is heavy (~2 GB)** — currently pinned in requirements.txt but not yet installed.
      The sentiment pipeline falls back to VADER-only if torch/transformers are absent,
      so the pipeline won't crash. Install when ready to enable DistilBERT multilingual
      classification for Hindi articles:
      ```
      .venv/bin/pip install torch transformers
      ```

## Decision Layer (Phase 3 - not yet coded)

- [ ] **Strategy Builder** — Frontend interface for generating political implementation plans
- [ ] **AI Strategy Prediction** — Deterministic narration grounded in graph demographic data
- [ ] SeatClassification computation from margin_pct + delivery_status
- [ ] DecisionRecommendation + EvidenceBundle nodes
- [ ] TRIGGERED_BY relationship from DecisionRecommendation → RuleDefinition

## Data / Imports (user-executed)

- [ ] Run `node scripts/import_all.js`
- [ ] Run `node scripts/import_tcpd.js` (LS2019, VS2022, LS2024)
- [ ] Run `.venv/bin/python scripts/load_entities_to_neo4j.py`
- [ ] Run `.venv/bin/python run_sentiment_pipeline.py`

## API Routes (not yet added)

- [ ] GET /api/up/constituency/:name/issues
- [ ] GET /api/up/constituency/:name/recommendation

## Credentials

- [ ] Rotate any credentials that were committed to git history before .env was gitignored
