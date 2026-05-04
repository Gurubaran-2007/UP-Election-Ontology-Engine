# UP Election Ontology Engine

A constituency-level governance accountability and decision support graph for Uttar Pradesh. 

This engine is designed to help political strategists, campaign managers, and analysts answer strategic questions using official public data (ECI results, MyNeta affidavits, scheme delivery) producing deterministic, source-cited outputs.

## Architecture

The project is built on a robust Node.js/Express backend connected to a **Neo4j** graph database, supplemented by a **Python-based Sentiment Pipeline**.

### The Three-Layer Graph Model
1. **Civic Layer:** Structural facts about elections, candidates, and constituencies derived from official ECI and ADR data.
2. **Governance Layer:** Scheme delivery signals and issue landscapes derived from official government portals (PFMS, MGNREGA MIS) and public grievance portals.
3. **Decision Layer:** Rule-based, deterministic classifications and recommendations derived from the Civic and Governance layers.

### Sentiment Pipeline Engine
A sophisticated, multi-source pipeline that monitors booth-level public sentiment across UP's 162,000+ polling stations.
- **Tier 1 (Collection):** NewsData API, YouTube, Google Trends, Ground Surveys.
- **Tier 2 (Processing):** Multilingual Transformer (`distilbert-base-multilingual-cased`) and Sarvam AI for handling code-mixed Hindi-English text.
- **Tier 3 (Disaggregation):** Spatial interpolation algorithm to distribute constituency-level sentiment down to the booth level using demographic weights.

## Project Structure

```text
├── src/                # Express backend application (MVC Structure)
│   ├── config/         # Database and AI API configurations
│   ├── routes/         # Modular API endpoints (geography, sentiment, strategy, etc.)
│   └── server.js       # Main entry point
├── scripts/            # Python background workers (e.g., run_sentiment_pipeline.py)
├── sentiment_engine/   # Core python modules for NLP processing and entity resolution
├── tools/              # Utility scripts for data manipulation
├── data/               # Raw and processed datasets (ECI, Census, Mappings)
├── docs/               # Detailed Product Requirements (PRD, Sentiment PRD, Schema)
└── public/             # Static frontend assets
```

## Setup & Running

### Prerequisites
- **Node.js** (v18+)
- **Python** (3.10+)
- **Neo4j** (Local Docker or AuraDB)

### Environment Setup
1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill in the required credentials:
   - `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`
   - `SARVAM_API_KEY`
   - `NEWSDATA_API_KEYS`

### Launching the Server
Install dependencies and run the server:
```bash
npm install
npm start
```
The server will start on port `3000` (or your configured port). The background sentiment pipeline is automatically scheduled to run via a cron job within the server.

## Design Philosophy & Safeguards

- **Deterministic Outputs:** Every classification is produced by a versioned, human-readable rule. AI is only used to translate facts into narrative summaries, *not* to invent scores or facts.
- **Data Provenance:** Every node and relationship in the Neo4j graph carries `source`, `source_url`, `source_date`, and `confidence` fields for complete auditability.
- **Privacy & Compliance:** The engine strictly operates at the aggregate level. Voter-level profiling, caste inference from voter rolls, and manipulative microtargeting are explicitly blocked to comply with Responsible AI principles and ECI guidelines.

## Documentation
For deep dives into the schema, data sources, and architecture, refer to the documents in the `docs/` folder:
- `PRD.md` — The core product vision and Neo4j ontology schema.
- `SENTIMENT_ANALYSIS_PRD.md` — The architecture of the Python sentiment NLP engine.
- `DATA_LOADING.md` — Instructions on graph data ingestion.
- `datasources.md` — Consolidated inventory of official data sources.
