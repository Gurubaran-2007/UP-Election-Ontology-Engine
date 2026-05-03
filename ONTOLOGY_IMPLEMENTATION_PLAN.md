# UP Election Ontology – Implementation Plan & Gap Tracker

> **Status:** IN PROGRESS v0.3  
> **Last Updated:** 2026-05-03  
> **Target:** Bridge current Neo4j schema (District/Leader/Strategy) → Full booth-level ontology (Section 7)

---

## 0. Current State Summary

| Layer | What Exists | What's Missing |
|---|---|---|
| **Neo4j (Local)** | `LokSabhaConstituency` (80), `VidhanSabhaConstituency` (403), `Party` (8), `Alliance` (3), `CommunityBlock` (6), `CasteGroup` (30), `Election` (3), `Candidate` (80), `ElectionResult` (80), `Issue` (10), `RiskCategory` (5) + 473 relationships | `Booth` (162K), `BoothResult`, `District` sync from AuraDB, `SentimentObservation`, `OrgUnit`, `BoothWorker`, `Narrative`, `CounterNarrative`, `CampaignEvent`, `Task`, `Scheme`, `Project`, `AudienceSegment`, `Source`, `Document`, `Fact`, `ValidationRecord` |
| **Neo4j (AuraDB Prod)** | `District` (71+), `Leader`, `Strategy` | Full ontology nodes; local Neo4j needs District sync |
| **Neo4j Edges** | `HAS_VS` (403), `PART_OF_BLOCK` (30), `PART_OF_ALLIANCE` (7), `CONTESTS` (80), `BELONGS_TO` (80), `HAS_RESULT` (80) | All booth-level, issue, sentiment, campaign, narrative relationships |
| **Data Files** | `up_ls_vs_mapping.json`, `community_blocks.json`, `elections.json`, `up_ls2019_constituency_results.{csv,json}`, `eci-2019.csv`, `list_of_lok_sabha_constituencies.csv` | ECI booth-level CSV, SHRUG socioeconomic data, CSDS survey, Census 2011 village-level |
| **APIs** | District-level working, constituency/booth = **mock** | Real booth/constituency endpoints, issue scoring, sentiment, task management |
| **Import Scripts** | `import_all.js` (working master script), `download_data.js`, `extract_up_data.js` | Booth-level import, SHRUG/Census import, sentiment ingestion, task/event CRUD |
| **Infrastructure** | Local Neo4j 5.14 via Docker (7474/7687), APOC enabled | District node sync from AuraDB → local, manual data download completion |

---

## 1. Data Acquisition Plan

### 1.1 Priority Data Sources (Critical Path)

| # | Data Element | Source | Format | Est. Size | Status |
|---|---|---|---|---|---|
| 1 | UP Booth List 2019 (162K PS) | Harvard Dataverse (doi:10.7910/DVN/KKOWNJ) | CSV | ~50MB | TODO: Manual download → `data/manual/UP_2019_booth_results.csv` |
| 2 | LS Constituency Results 2019 & 2024 | GitHub: pratapvardhan/Elections-India-2019 | CSV | ~5MB | DONE: `data/eci/eci-2019.csv`, extracted UP: `data/eci/up_ls2019_constituency_results.{csv,json}` |
| 3 | VS Constituency Results 2022 | ECI UP assembly results | CSV/HTML | ~10MB | TODO: Scrape |
| 4 | LS ↔ VS Mapping | anandpdoshi gist (LS extent) + delimitation inference | JSON | ~2MB | DONE: `data/mappings/up_ls_vs_mapping.json` (80 LS → 403 VS) |
| 5 | VS → Booth Mapping | ECI electoral roll PDFs (Section 20 summary) | PDF → CSV | ~200MB | TODO: Parse |
| 6 | SHRUG Socioeconomic Data | SHRUG v2.3 (dataschool.io) | CSV | ~100MB | TODO: Manual download → `data/manual/shrug_up_data.csv` |
| 7 | CSDS-Lokniti Post-Poll Survey 2024 | CSDS Data Unit | CSV/SPSS | ~20MB | TODO: Request → `data/manual/csds_2024_survey.csv` |
| 8 | Census 2011 Village-Level | Census India / SHRUG bridge | CSV | ~500MB | TODO: Download → `data/manual/census_2011_up_villages.csv` |
| 9 | Caste Community Definitions | CSDS survey + Jindal Global analysis | JSON | ~50KB | DONE: `data/mappings/community_blocks.json` (6 blocks, 30 caste groups) |

### 1.2 Data Acquisition Commands

```bash
# Create data directory structure
mkdir -p data/eci data/shrug data/csds data/census data/mappings

# ECI booth-level results 2019 (Scientific Data paper companion dataset)
# URL: Check Zenodo/Dataverse for the 2025 Scientific Data paper dataset
# Expected columns: ps_id, ps_name, ac_no, ac_name, pc_no, pc_name, state, votes_by_party...

# ECI 2024 LS results
curl -o data/eci/ls2024_results.csv "https://results.eci.gov.in/... " # TODO: exact URL

# SHRUG data
curl -L -o data/shrug/shrug_v2.3.zip "https://shrug.dataschool.io/downloads/..." # TODO: exact URL

# Census 2011 village-level UP
# Download from censusindia.gov.in → C-1 Population, DDW level for UP
```

### 1.3 Community Block Definition (JSON)

```json
{
  "community_blocks": [
    {
      "block_id": "UpperCasteGeneral",
      "label": "Upper Caste General",
      "castes": ["Brahmin", "Rajput", "Vaishya", "Kayastha", "Tyagi", "Bhumihar"],
      "category": "Upper",
      "bjp_affinity_2024": "strong_retention"
    },
    {
      "block_id": "YadavOBC",
      "label": "Yadav OBC",
      "castes": ["Yadav"],
      "category": "OBC",
      "bjp_affinity_2024": "hostile"
    },
    {
      "block_id": "NonYadavOBC",
      "label": "Non-Yadav OBC",
      "castes": ["Kurmi", "Lodh", "Kushwaha", "Rajbhar", "Nishad", "Koeri", "Teli", "Gujjar", "Jat", "Ahir"],
      "category": "OBC",
      "bjp_affinity_2024": "swing"
    },
    {
      "block_id": "JatavSC",
      "label": "Jatav SC",
      "castes": ["Jatav", "Chamar"],
      "category": "SC",
      "bjp_affinity_2024": "hostile"
    },
    {
      "block_id": "NonJatavSC",
      "label": "Non-Jatav SC",
      "castes": ["Pasi", "Kori", "Valmiki", "Dhobi", "Khatik", "Dhanuk"],
      "category": "SC",
      "bjp_affinity_2024": "swing_looking_india"
    },
    {
      "block_id": "Muslim",
      "label": "Muslim",
      "castes": ["Sheikh", "Ansari", "Qureshi", "Syed", "Pathan"],
      "category": "Muslim",
      "bjp_affinity_2024": "hostile"
    }
  ]
}
```

---

## 2. Neo4j Import Scripts

### 2.1 Constraints & Indexes (run first)

```cypher
// Geography
CREATE CONSTRAINT booth_id_unique IF NOT EXISTS FOR (b:Booth) REQUIRE b.booth_id IS UNIQUE;
CREATE CONSTRAINT vs_id_unique IF NOT EXISTS FOR (vs:VidhanSabhaConstituency) REQUIRE vs.vs_id IS UNIQUE;
CREATE CONSTRAINT ls_id_unique IF NOT EXISTS FOR (ls:LokSabhaConstituency) REQUIRE ls.ls_id IS UNIQUE;
CREATE CONSTRAINT district_id_unique IF NOT EXISTS FOR (d:District) REQUIRE d.district_id IS UNIQUE;

// Social
CREATE CONSTRAINT caste_code_unique IF NOT EXISTS FOR (cg:CasteGroup) REQUIRE cg.caste_code IS UNIQUE;
CREATE CONSTRAINT block_id_unique IF NOT EXISTS FOR (cb:CommunityBlock) REQUIRE cb.block_id IS UNIQUE;
CREATE CONSTRAINT segment_id_unique IF NOT EXISTS FOR (seg:AudienceSegment) REQUIRE seg.segment_id IS UNIQUE;

// Political
CREATE CONSTRAINT party_id_unique IF NOT EXISTS FOR (p:Party) REQUIRE p.party_id IS UNIQUE;
CREATE CONSTRAINT cand_id_unique IF NOT EXISTS FOR (c:Candidate) REQUIRE c.cand_id IS UNIQUE;
CREATE CONSTRAINT alliance_id_unique IF NOT EXISTS FOR (a:Alliance) REQUIRE a.alliance_id IS UNIQUE;

// Analytics
CREATE CONSTRAINT issue_id_unique IF NOT EXISTS FOR (i:Issue) REQUIRE i.issue_id IS UNIQUE;
CREATE CONSTRAINT election_id_unique IF NOT EXISTS FOR (e:Election) REQUIRE e.election_id IS UNIQUE;
CREATE CONSTRAINT risk_id_unique IF NOT EXISTS FOR (r:RiskCategory) REQUIRE r.risk_id IS UNIQUE;

// Indexes for common lookups
CREATE INDEX booth_district_idx IF NOT EXISTS FOR (b:Booth) ON (b.district);
CREATE INDEX booth_vs_idx IF NOT EXISTS FOR (b:Booth) ON (b.vs_id);
CREATE INDEX booth_urban_rural_idx IF NOT EXISTS FOR (b:Booth) ON (b.urban_rural);
```

### 2.2 Script: `import_constituencies.js`

```javascript
// import_constituencies.js
// Creates LokSabhaConstituency and VidhanSabhaConstituency nodes
// Input: CSV with columns: ls_id, ls_name, ls_reservation, vs_id, vs_name, vs_reservation, district

const neo4j = require('neo4j-driver');
const fs = require('fs');
const csv = require('csv-parser'); // npm install csv-parser

const driver = neo4j.driver(
    process.env.NEO4J_URI || 'neo4j://localhost:7687',
    neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'guru@9114'),
    { encrypted: 'ENCRYPTION_OFF' }
);

async function importConstituencies(csvPath) {
    const session = driver.session();
    const constituencies = [];
    
    fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => constituencies.push(row))
        .on('end', async () => {
            console.log(`Loaded ${constituencies.length} rows from CSV`);
            
            // Create LS constituencies (deduplicated)
            const lsSet = new Map();
            for (const row of constituencies) {
                if (!lsSet.has(row.ls_id)) {
                    lsSet.set(row.ls_id, {
                        ls_id: row.ls_id,
                        name: row.ls_name,
                        reservation: row.ls_reservation || 'GEN'
                    });
                }
            }
            
            for (const [id, ls] of lsSet) {
                await session.run(
                    `MERGE (ls:LokSabhaConstituency {ls_id: $ls_id})
                     SET ls.name = $name, ls.reservation = $reservation`,
                    ls
                );
            }
            console.log(`Created ${lsSet.size} LS constituencies`);
            
            // Create VS constituencies
            for (const row of constituencies) {
                await session.run(
                    `MERGE (vs:VidhanSabhaConstituency {vs_id: $vs_id})
                     SET vs.name = $vs_name, vs.reservation = $vs_reservation,
                         vs.ls_id = $ls_id
                     WITH vs
                     MATCH (ls:LokSabhaConstituency {ls_id: $ls_id})
                     MERGE (ls)-[:HAS_VS]->(vs)
                     WITH vs
                     MATCH (d:District {name: $district})
                     MERGE (d)-[:HAS_VS]->(vs)`,
                    {
                        vs_id: row.vs_id,
                        vs_name: row.vs_name,
                        vs_reservation: row.vs_reservation || 'GEN',
                        ls_id: row.ls_id,
                        district: row.district
                    }
                );
            }
            console.log(`Created ${constituencies.length} VS constituencies with links`);
            
            await session.close();
            await driver.close();
        });
}

importConstituencies(process.argv[2] || 'data/mappings/up_ls_vs_mapping.csv');
```

### 2.3 Script: `import_booths.js`

```javascript
// import_booths.js
// Creates Booth nodes + links to VS, Village/Ward
// Input: CSV with columns: booth_id, part_no, booth_name, ps_no, vs_id, district, urban_rural, village_code/ward_id

const neo4j = require('neo4j-driver');
const fs = require('fs');
const csv = require('csv-parser');

const driver = neo4j.driver(
    process.env.NEO4J_URI || 'neo4j://localhost:7687',
    neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'guru@9114'),
    { encrypted: 'ENCRYPTION_OFF' }
);

async function importBooths(csvPath) {
    const session = driver.session();
    const booths = [];
    
    fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => booths.push(row))
        .on('end', async () => {
            console.log(`Loaded ${booths.length} booths`);
            
            let batch = [];
            const BATCH_SIZE = 1000;
            
            for (const row of booths) {
                batch.push(row);
                if (batch.length >= BATCH_SIZE) {
                    await createBoothBatch(session, batch);
                    batch = [];
                }
            }
            if (batch.length > 0) await createBoothBatch(session, batch);
            
            console.log(`Imported ${booths.length} booths total`);
            await session.close();
            await driver.close();
        });
    
    async function createBoothBatch(session, batch) {
        const query = `
            UNWIND $batch AS row
            MERGE (b:Booth {booth_id: row.booth_id})
            SET b.part_number = row.part_no,
                b.name = row.booth_name,
                b.polling_station_no = row.ps_no,
                b.urban_rural = row.urban_rural,
                b.district = row.district,
                b.vs_id = row.vs_id
            WITH b, row
            MATCH (vs:VidhanSabhaConstituency {vs_id: row.vs_id})
            MERGE (vs)-[:HAS_BOOTH]->(b)
            WITH b, row
            CALL {
                WITH b, row
                FOREACH (_ IN CASE WHEN row.urban_rural = 'Rural' AND row.village_code IS NOT NULL THEN [1] ELSE [] END |
                    MERGE (v:Village {census_village_code: row.village_code})
                    MERGE (b)-[:IN_VILLAGE]->(v)
                )
                FOREACH (_ IN CASE WHEN row.urban_rural = 'Urban' AND row.ward_id IS NOT NULL THEN [1] ELSE [] END |
                    MERGE (w:Ward {ward_id: row.ward_id})
                    MERGE (b)-[:IN_WARD]->(w)
                )
                RETURN count(*) AS dummy
            }
            RETURN count(b) AS created
        `;
        await session.run(query, { batch });
    }
}

importBooths(process.argv[2] || 'data/eci/up_booths_2019.csv');
```

### 2.4 Script: `import_social_structure.js`

```javascript
// import_social_structure.js
// Creates CasteGroup, CommunityBlock, and Booth→Caste/Block relationships
// Input 1: community_blocks.json (from Section 1.3 above)
// Input 2: booth_caste_distribution.csv (booth_id, caste_code, share_pct, year)

const neo4j = require('neo4j-driver');
const fs = require('fs');
const csv = require('csv-parser');

const driver = neo4j.driver(
    process.env.NEO4J_URI || 'neo4j://localhost:7687',
    neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'guru@9114'),
    { encrypted: 'ENCRYPTION_OFF' }
);

async function importSocialStructure(blocksJsonPath, casteCsvPath) {
    const session = driver.session();
    
    // Step 1: Load community blocks
    const blocksData = JSON.parse(fs.readFileSync(blocksJsonPath, 'utf8'));
    
    for (const block of blocksData.community_blocks) {
        await session.run(
            `MERGE (cb:CommunityBlock {block_id: $block_id})
             SET cb.label = $label, cb.description = $label
             WITH cb
             UNWIND $castes AS caste_name
             MERGE (cg:CasteGroup {caste_code: toLower(replace(caste_name, ' ', ''))})
             SET cg.name = caste_name
             MERGE (cg)-[:PART_OF_BLOCK]->(cb)`,
            block
        );
    }
    console.log(`Created ${blocksData.community_blocks.length} community blocks`);
    
    // Step 2: Load booth-caste distributions
    const distributions = [];
    fs.createReadStream(casteCsvPath)
        .pipe(csv())
        .on('data', (row) => distributions.push(row))
        .on('end', async () => {
            console.log(`Loaded ${distributions.length} booth-caste rows`);
            
            let batch = [];
            const BATCH_SIZE = 5000;
            
            for (const row of distributions) {
                batch.push(row);
                if (batch.length >= BATCH_SIZE) {
                    await importCasteBatch(session, batch);
                    batch = [];
                }
            }
            if (batch.length > 0) await importCasteBatch(session, batch);
            
            console.log(`Imported ${distributions.length} caste distributions`);
            
            // Step 3: Compute CommunityBlock aggregations per booth
            await session.run(`
                MATCH (b:Booth)-[r:HAS_CASTE_DISTRIBUTION]->(cg:CasteGroup)-[:PART_OF_BLOCK]->(cb:CommunityBlock)
                WITH b, cb, sum(r.share_pct) AS block_share
                MERGE (b)-[hb:HAS_COMMUNITY_BLOCK]->(cb)
                SET hb.share_pct = block_share
            `);
            console.log('Computed community block aggregations');
            
            await session.close();
            await driver.close();
        });
    
    async function importCasteBatch(session, batch) {
        await session.run(
            `UNWIND $batch AS row
             MATCH (b:Booth {booth_id: row.booth_id})
             MATCH (cg:CasteGroup {caste_code: toLower(replace(row.caste_name, ' ', ''))})
             MERGE (b)-[r:HAS_CASTE_DISTRIBUTION]->(cg)
             SET r.share_pct = toFloat(row.share_pct),
                 r.source_year = coalesce(row.year, '2011')`,
            { batch }
        );
    }
}

importSocialStructure(
    process.argv[2] || 'data/mappings/community_blocks.json',
    process.argv[3] || 'data/census/booth_caste_distribution.csv'
);
```

### 2.5 Script: `import_elections_results.js`

```javascript
// import_elections_results.js
// Creates Election, BoothResult nodes + vote share relationships
// Input: booth_results.csv (booth_id, election_id, party, votes, turnout)

const neo4j = require('neo4j-driver');
const fs = require('fs');
const csv = require('csv-parser');

const driver = neo4j.driver(
    process.env.NEO4J_URI || 'neo4j://localhost:7687',
    neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'guru@9114'),
    { encrypted: 'ENCRYPTION_OFF' }
);

async function importElections(electionsJson, resultsCsvPath) {
    const session = driver.session();
    
    // Step 1: Create Election nodes
    const elections = JSON.parse(fs.readFileSync(electionsJson, 'utf8'));
    for (const e of elections) {
        await session.run(
            `MERGE (e:Election {election_id: $election_id})
             SET e.type = $type, e.year = $year, e.phase = $phase`,
            e
        );
    }
    console.log(`Created ${elections.length} elections`);
    
    // Step 2: Create BoothResult nodes
    const results = [];
    fs.createReadStream(resultsCsvPath)
        .pipe(csv())
        .on('data', (row) => results.push(row))
        .on('end', async () => {
            console.log(`Loaded ${results.length} booth result rows`);
            
            // Group by booth+election for batch creation
            const grouped = {};
            for (const row of results) {
                const key = `${row.booth_id}__${row.election_id}`;
                if (!grouped[key]) {
                    grouped[key] = { booth_id: row.booth_id, election_id: row.election_id, parties: [] };
                }
                grouped[key].parties.push({
                    party: row.party,
                    votes: parseInt(row.votes) || 0
                });
            }
            
            let batch = Object.values(grouped);
            const BATCH_SIZE = 2000;
            
            for (let i = 0; i < batch.length; i += BATCH_SIZE) {
                const slice = batch.slice(i, i + BATCH_SIZE);
                await session.run(
                    `UNWIND $batch AS row
                     MATCH (b:Booth {booth_id: row.booth_id})
                     MATCH (e:Election {election_id: row.election_id})
                     MERGE (br:BoothResult {booth_result_id: row.booth_id + '_' + row.election_id})
                     SET br.votes_json = row.parties,
                         br.turnout = coalesce(toFloat(row.turnout), 0)
                     MERGE (b)-[:HAS_RESULT]->(br)
                     MERGE (br)-[:PART_OF]->(e)`,
                    { batch: slice }
                );
            }
            
            console.log(`Imported ${batch.length} booth results`);
            await session.close();
            await driver.close();
        });
}

importElections(
    process.argv[2] || 'data/eci/elections.json',
    process.argv[3] || 'data/eci/booth_results_ls2019.csv'
);
```

---

## 3. Server.js API Extensions

### 3.1 New Endpoints to Add

| Endpoint | Method | Purpose | Replaces |
|---|---|---|---|
| `/api/up/booth/:boothId` | GET | Real booth data from Neo4j | Mock `/api/up/booth/:boothId/analysis` |
| `/api/up/constituency/:vsId` | GET | Real VS constituency data | Mock `/api/up/constituency/:constName/analysis` |
| `/api/up/constituency/:vsId/booths` | GET | List booths in constituency | N/A |
| `/api/up/district/:district/constituencies` | GET | Real VS list per district | Mock version |
| `/api/up/booth/:boothId/risk` | GET | Risk category + issue heat scores | N/A |
| `/api/up/booth/:boothId/sentiment` | GET | Sentiment observations | N/A |
| `/api/up/booth/:boothId/campaign` | GET | Campaign events + tasks | N/A |
| `/api/up/booth/:boothId/caste` | GET | Caste/community block breakdown | N/A |
| `/api/up/booth/:boothId/narratives` | GET | Active narratives + counter gaps | N/A |
| `/api/up/high-risk-booths` | POST | Find high-risk booths by filter | N/A |
| `/api/up/tasks` | POST | Create/assign campaign task | N/A |
| `/api/up/campaign-events` | POST | Log campaign event | N/A |

### 3.2 Implementation: `/api/up/booth/:boothId`

```javascript
app.get('/api/up/booth/:boothId', async (req, res) => {
    const boothId = req.params.boothId;
    try {
        const session = driver.session();
        
        // Core booth data with all relationships
        const result = await session.run(`
            MATCH (b:Booth {booth_id: $boothId})
            OPTIONAL MATCH (b)<-[:HAS_BOOTH]-(vs:VidhanSabhaConstituency)
            OPTIONAL MATCH (vs)<-[:HAS_VS]-(ls:LokSabhaConstituency)
            OPTIONAL MATCH (b)-[:HAS_RESULT]->(br:BoothResult)-[:PART_OF]->(e:Election)
            OPTIONAL MATCH (b)-[:HAS_COMMUNITY_BLOCK]->(cb:CommunityBlock)
            WITH b, vs, ls, 
                 collect({
                     election_id: e.election_id,
                     type: e.type,
                     year: e.year,
                     votes: br.votes_json,
                     turnout: br.turnout
                 }) AS results,
                 collect({
                     block_id: cb.block_id,
                     label: cb.label
                 }) AS community_blocks
            OPTIONAL MATCH (b)-[:HAS_ISSUE]->(i:Issue)
            OPTIONAL MATCH (b)-[:HAS_HEAT]->(h:IssueHeatScore)
            RETURN b AS booth,
                   vs.name AS vs_name,
                   ls.name AS ls_name,
                   results,
                   community_blocks,
                   collect(DISTINCT {
                       issue: i.name,
                       issue_id: i.issue_id
                   }) AS issues,
                   collect(DISTINCT {
                       dimension: h.dimension,
                       score: h.score,
                       time_window: h.time_window
                   }) AS heat_scores
        `, { boothId });
        
        await session.close();
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: `Booth ${boothId} not found` });
        }
        
        const r = result.records[0];
        const booth = r.get('booth').properties;
        
        res.json({
            booth: {
                id: booth.booth_id,
                name: booth.name,
                part_number: booth.part_number,
                polling_station_no: booth.polling_station_no,
                urban_rural: booth.urban_rural,
                district: booth.district
            },
            constituency: {
                vs: r.get('vs_name'),
                ls: r.get('ls_name')
            },
            election_results: r.get('results'),
            community_blocks: r.get('community_blocks'),
            issues: r.get('issues'),
            heat_scores: r.get('heat_scores')
        });
        
    } catch (e) {
        console.error('[BOOTH API ERROR]', e.message);
        res.status(500).json({ error: e.message });
    }
});
```

### 3.3 Implementation: `/api/up/high-risk-booths`

```javascript
app.post('/api/up/high-risk-booths', async (req, res) => {
    const { district, community_blocks, min_heat_score, max_campaign_events, risk_categories } = req.body;
    
    try {
        const session = driver.session();
        
        // Build dynamic Cypher based on filters
        let whereClauses = [];
        let params = {};
        
        if (district) {
            whereClauses.push('b.district = $district');
            params.district = district;
        }
        if (community_blocks && community_blocks.length > 0) {
            whereClauses.push('cb.block_id IN $community_blocks');
            params.community_blocks = community_blocks;
        }
        if (min_heat_score) {
            whereClauses.push('h.score >= $min_heat_score');
            params.min_heat_score = min_heat_score;
        }
        if (risk_categories && risk_categories.length > 0) {
            whereClauses.push('rc.label IN $risk_categories');
            params.risk_categories = risk_categories;
        }
        
        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        
        const query = `
            MATCH (b:Booth)
            ${whereClause}
            OPTIONAL MATCH (b)-[:HAS_COMMUNITY_BLOCK]->(cb:CommunityBlock)
            OPTIONAL MATCH (b)-[:HAS_HEAT]->(h:IssueHeatScore)
            OPTIONAL MATCH (b)-[:HAS_RISK_CATEGORY]->(rc:RiskCategory)
            OPTIONAL MATCH (b)<-[:COVERS_BOOTH|FOCUSES_ON_BOOTH]-(eventOrTask)
            WITH b, cb, h, rc, count(DISTINCT eventOrTask) AS campaign_activity
            ${max_campaign_events ? 'WHERE campaign_activity <= $max_campaign_events' : ''}
            RETURN b.booth_id AS booth_id,
                   b.name AS booth_name,
                   b.district AS district,
                   b.urban_rural AS urban_rural,
                   collect(DISTINCT cb.label) AS community_blocks,
                   collect(DISTINCT {dimension: h.dimension, score: h.score}) AS heat_scores,
                   rc.label AS risk_category,
                   campaign_activity
            ORDER BY 
                CASE rc.label WHEN 'Losing' THEN 1 WHEN 'TossUp' THEN 2 WHEN 'Leaning' THEN 3 ELSE 4 END,
                campaign_activity ASC
            LIMIT 100
        `;
        
        if (max_campaign_events) params.max_campaign_events = max_campaign_events;
        
        const result = await session.run(query, params);
        await session.close();
        
        const booths = result.records.map(r => ({
            booth_id: r.get('booth_id'),
            booth_name: r.get('booth_name'),
            district: r.get('district'),
            urban_rural: r.get('urban_rural'),
            community_blocks: r.get('community_blocks'),
            heat_scores: r.get('heat_scores'),
            risk_category: r.get('risk_category'),
            campaign_activity: r.get('campaign_activity')
        }));
        
        res.json({ count: booths.length, booths });
        
    } catch (e) {
        console.error('[HIGH-RISK BOOTHS ERROR]', e.message);
        res.status(500).json({ error: e.message });
    }
});
```

---

## 4. Cypher Query Library

### 4.1 High-Risk Booth Queries

#### Q1: Booths where BJP lost ground among NonYadavOBC + NonJatavSC with low campaign activity

```cypher
MATCH (b:Booth)
WHERE b.district = $district
  AND (b)-[:HAS_COMMUNITY_BLOCK]->(:CommunityBlock {block_id: 'NonYadavOBC'})
  AND (b)-[:HAS_COMMUNITY_BLOCK]->(:CommunityBlock {block_id: 'NonJatavSC'})
  
// Get LS2019 vs LS2024 BJP vote share
MATCH (b)-[:HAS_RESULT]->(br2019)-[:PART_OF]->(:Election {election_id: 'LS2019'})
MATCH (b)-[:HAS_RESULT]->(br2024)-[:PART_OF]->(:Election {election_id: 'LS2024'})

// Calculate BJP vote share change
WITH b, 
     [v IN br2019.votes_json WHERE v.party = 'BJP'][0].votes AS bjp_2019,
     [v IN br2024.votes_json WHERE v.party = 'BJP'][0].votes AS bjp_2024,
     br2019.turnout AS turnout_2019,
     br2024.turnout AS turnout_2024

WHERE bjp_2024 < bjp_2019  // BJP lost votes

// Check issue heat
OPTIONAL MATCH (b)-[:HAS_HEAT]->(h:IssueHeatScore)
WHERE h.dimension IN ['unemployment', 'paper_leaks'] AND h.score > 60

// Check campaign activity
OPTIONAL MATCH (b)<-[:COVERS_BOOTH]-(e:CampaignEvent)
WHERE e.date >= date('2025-01-01')

WITH b, 
     bjp_2019, bjp_2024,
     (bjp_2019 - bjp_2024) AS vote_loss,
     count(DISTINCT e) AS recent_events,
     collect(DISTINCT {dimension: h.dimension, score: h.score}) AS high_heat_issues

WHERE recent_events <= 2  // Low campaign activity

RETURN b.booth_id, b.name, b.urban_rural,
       bjp_2019, bjp_2024, vote_loss,
       recent_events,
       high_heat_issues
ORDER BY vote_loss DESC, recent_events ASC
LIMIT 50
```

#### Q2: Risk-prioritized booth list with campaign gap score

```cypher
MATCH (b:Booth)-[:HAS_RISK_CATEGORY]->(rc:RiskCategory)
WHERE rc.label IN ['Losing', 'TossUp', 'Leaning']
  AND b.district = $district

OPTIONAL MATCH (b)-[:HAS_HEAT]->(h:IssueHeatScore)
WHERE h.time_window = 'last_30_days'

OPTIONAL MATCH (b)<-[:COVERS_BOOTH|FOCUSES_ON_BOOTH]-(activity)
WHERE activity.date >= date() - duration('P30D')

WITH b, rc,
     avg(h.score) AS avg_heat,
     count(DISTINCT activity) AS activity_count,
     collect(DISTINCT h.dimension) AS hot_issues

// Campaign gap score: high heat + low activity = high priority
WITH *, (avg_heat * (10 - activity_count)) AS campaign_gap_score

RETURN b.booth_id, b.name, rc.label AS risk,
       round(avg_heat, 1) AS avg_heat_score,
       activity_count AS recent_activities,
       hot_issues,
       round(campaign_gap_score, 1) AS priority_score
ORDER BY priority_score DESC
LIMIT 100
```

### 4.2 Narrative & Counter-Narrative Queries

#### Q3: Narratives in a booth not yet countered with verified facts

```cypher
MATCH (b:Booth {booth_id: $boothId})-[:HAS_ISSUE]->(i:Issue)
MATCH (n:Narrative)-[:ABOUT_ISSUE]->(i)
WHERE NOT EXISTS {
    MATCH (n)<-[:COUNTERS]-(:CounterNarrative)-[:SUPPORTED_BY]->(:Fact {status: 'Verified'})
}
RETURN n.narrative_id, n.text, n.stance, i.name AS issue
ORDER BY i.name
```

#### Q4: Generate counter-narrative recommendations for a booth

```cypher
MATCH (b:Booth {booth_id: $boothId})-[:HAS_ISSUE]->(i:Issue)
MATCH (n:Narrative)-[:ABOUT_ISSUE]->(i)
WHERE n.stance = 'opposition'

// Find available counter facts
MATCH (s:Scheme)-[:LINKED_TO_SCHEME]-(i)
OPTIONAL MATCH (s)-[:IMPLEMENTED_AS]->(p:Project)
WHERE p.status IN ['Completed', 'In Progress']

// Find existing counter narratives for similar issues
OPTIONAL MATCH (n)<-[:COUNTERS]-(cn:CounterNarrative)

RETURN i.name AS issue,
       n.text AS opposition_narrative,
       collect(DISTINCT s.name) AS available_schemes,
       collect(DISTINCT p.name) as local_projects,
       collect(DISTINCT cn.text) AS existing_counters
```

### 4.3 Task Prioritization Queries

#### Q5: Auto-generate tasks for high-risk booths

```cypher
MATCH (b:Booth)-[:HAS_RISK_CATEGORY]->(rc:RiskCategory)
WHERE rc.label IN ['Losing', 'TossUp']
  AND b.district = $district

MATCH (b)-[:HAS_HEAT]->(h:IssueHeatScore)
WHERE h.score > 70 AND h.time_window = 'last_30_days'

MATCH (b)-[:HAS_COMMUNITY_BLOCK]->(cb:CommunityBlock)

// Find booth workers assigned
OPTIONAL MATCH (bw:BoothWorker)-[:PART_OF_UNIT]->(:OrgUnit)-[:COVERS_BOOTH]->(b)

WITH b, rc, h, cb,
     collect(DISTINCT bw) AS available_workers,
     h.score AS heat_score,
     CASE rc.label
         WHEN 'Losing' THEN 10
         WHEN 'TossUp' THEN 7
         ELSE 5
     END AS risk_weight

// Priority = heat_score * risk_weight
WITH *, (heat_score * risk_weight) AS task_priority

UNWIND available_workers AS worker
MERGE (t:Task {
    task_id: 'task_' + b.booth_id + '_' + h.dimension + '_' + toString(date())
})
SET t.type = 'campaign_focus',
    t.status = 'pending',
    t.priority = CASE
        WHEN task_priority > 500 THEN 'critical'
        WHEN task_priority > 300 THEN 'high'
        ELSE 'medium'
    END,
    t.due_date = date() + duration('P7D'),
    t.focus_issue = h.dimension,
    t.focus_segment = cb.label,
    t.created_at = datetime()

MERGE (t)-[:FOCUSES_ON_BOOTH]->(b)
MERGE (t)-[:FOCUSES_ON_ISSUE]->(:Issue {issue_id: h.dimension})
MERGE (t)-[:ASSIGNED_TO]->(worker)

RETURN count(t) AS tasks_created, b.booth_id, task_priority
ORDER BY task_priority DESC
```

#### Q6: Dashboard summary – campaign coverage by risk tier

```cypher
MATCH (b:Booth)-[:HAS_RISK_CATEGORY]->(rc:RiskCategory)
OPTIONAL MATCH (b)<-[:COVERS_BOOTH]-(e:CampaignEvent)
WHERE e.date >= date() - duration('P30D')
OPTIONAL MATCH (b)<-[:FOCUSES_ON_BOOTH]-(t:Task)
WHERE t.status = 'completed' AND t.due_date >= date() - duration('P30D')

RETURN rc.label AS risk_tier,
       count(DISTINCT b) AS total_booths,
       count(DISTINCT e) AS events_last_30d,
       count(DISTINCT t) AS tasks_completed_last_30d,
       round(count(DISTINCT e) * 1.0 / count(DISTINCT b), 2) AS events_per_booth,
       round(count(DISTINCT t) * 1.0 / count(DISTINCT b), 2) AS tasks_per_booth
ORDER BY 
    CASE rc.label WHEN 'Losing' THEN 1 WHEN 'TossUp' THEN 2 WHEN 'Leaning' THEN 3 WHEN 'Safe' THEN 4 ELSE 5 END
```

### 4.4 Cast-Community Analytics Queries

#### Q7: Booth-level caste swing analysis (2019 → 2024)

```cypher
// Assumes we have estimated caste-wise vote share per booth per election
MATCH (b:Booth)-[:HAS_COMMUNITY_BLOCK]->(cb:CommunityBlock)
WHERE cb.block_id IN ['NonYadavOBC', 'NonJatavSC', 'UpperCasteGeneral']

MATCH (b)-[:HAS_RESULT]->(br2019)-[:PART_OF]->(:Election {election_id: 'LS2019'})
MATCH (b)-[:HAS_RESULT]->(br2024)-[:PART_OF]->(:Election {election_id: 'LS2024'})

WITH b, cb,
     [v IN br2019.votes_json WHERE v.party = 'BJP'][0].votes AS bjp_2019,
     [v IN br2024.votes_json WHERE v.party = 'BJP'][0].votes AS bjp_2024

RETURN cb.label AS community_block,
       count(b) AS booth_count,
       avg(bjp_2019) AS avg_bjp_2019,
       avg(bjp_2024) AS avg_bjp_2024,
       avg(bjp_2024 - bjp_2019) AS avg_swing
GROUP BY cb.label
ORDER BY avg_swing ASC
```

#### Q8: Find booths where dominant community block ≠ party performance

```cypher
// Find booths where NonYadavOBC is dominant but BJP is underperforming
MATCH (b:Booth)-[hcb:HAS_COMMUNITY_BLOCK]->(cb:CommunityBlock {block_id: 'NonYadavOBC'})
WHERE hcb.share_pct > 30  // >30% of booth electorate

MATCH (b)-[:HAS_RESULT]->(br)-[:PART_OF]->(:Election {election_id: 'LS2024'})
WITH b, cb,
     [v IN br.votes_json WHERE v.party = 'BJP'][0].votes AS bjp_votes,
     [v IN br.votes_json WHERE v.party = 'SP'][0].votes AS sp_votes

WHERE sp_votes > bjp_votes  // SP won despite non-Yadav OBC dominance

RETURN b.booth_id, b.name, b.district,
       hcb.share_pct AS non_yadav_obc_pct,
       bjp_votes, sp_votes,
       (sp_votes - bjp_votes) AS sp_margin
ORDER BY sp_margin DESC
LIMIT 50
```

---

## 5. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- [x] Local Neo4j via Docker (neo4j:5.14-community, APOC enabled)
- [x] Download ECI 2019 LS constituency results (GitHub: pratapvardhan/Elections-India-2019)
- [x] Download LS constituency extent mapping (anandpdoshi gist)
- [x] Extract UP-specific constituency data (80 LS seats)
- [x] Create `up_ls_vs_mapping.json` (80 LS → 403 VS segments)
- [x] Create `community_blocks.json` (6 blocks, 30 caste groups)
- [x] Create `elections.json` (LS2019, VS2022, LS2024 metadata)
- [x] Run `import_all.js` → constraints, indexes, constituencies, parties, alliances, social structure, issues, risk categories, 2019 results
- [ ] Download ECI booth-level data (2019 baseline) — **MANUAL: Harvard Dataverse**
- [ ] Run `import_booths.js`
- [ ] Sync District nodes from AuraDB → local Neo4j
- [ ] Verify: `MATCH (b:Booth) RETURN count(b)` → ~162,000
- [x] Verify: `MATCH (vs:VidhanSabhaConstituency) RETURN count(vs)` → 403
- [x] Verify: `MATCH (ls:LokSabhaConstituency) RETURN count(ls)` → 80

### Phase 2: Election Results (Weeks 2-3)
- [ ] Parse ECI 2019 booth-level results (Harvard Dataverse)
- [x] Create `elections.json` with LS2019, LS2024, VS2022
- [x] Run constituency-level result import (80 PCs, winners + votes_json)
- [ ] Run `import_elections_results.js` for booth-level
- [ ] Verify: `MATCH (br:BoothResult) RETURN count(br)` → ~162,000 (for LS2019)
- [ ] Implement `/api/up/booth/:boothId` real endpoint
- [ ] Replace mock `/api/up/constituency/:constName/analysis`

### Phase 3: Social Structure (Weeks 3-4)
- [x] Define community_blocks.json (6 blocks, 30 caste groups)
- [x] Import community blocks + caste-to-block mappings into Neo4j
- [ ] Derive booth-caste distributions from SHRUG + Census
- [ ] Run `import_social_structure.js` for booth-level caste distributions
- [x] Verify: `MATCH (cb:CommunityBlock) RETURN count(cb)` → 6
- [ ] Verify: `MATCH ()-[r:HAS_CASTE_DISTRIBUTION]->() RETURN count(r)` → expected ~162K × 6-10 castes
- [ ] Verify: `MATCH ()-[r:HAS_COMMUNITY_BLOCK]->() RETURN count(r)` → booth-level block aggregations

### Phase 4: Issues & Risk Scoring (Weeks 4-5)
- [x] Define Issue taxonomy (10 issues across 5 categories)
- [x] Create Issue nodes in Neo4j
- [x] Create RiskCategory nodes (5 tiers: Safe, Leaning, TossUp, Losing, Hostile)
- [ ] Compute IssueHeatScore from NLP pipeline (or manual initial scoring)
- [ ] Implement `/api/up/booth/:boothId/risk`
- [ ] Implement `/api/up/high-risk-booths`

### Phase 5: Narratives & Campaign Tracking (Weeks 5-6)
- [ ] Seed Narrative/CounterNarrative from 2024 election analysis
- [ ] Implement narrative gap query (Q3)
- [ ] Implement counter-narrative recommendation (Q4)
- [ ] Create CampaignEvent + Task CRUD APIs
- [ ] Implement task auto-generation (Q5)
- [ ] Implement dashboard summary (Q6)

### Phase 6: UI Integration (Weeks 6-8)
- [ ] Update `booth.js` to consume real booth API
- [ ] Add risk category visualization
- [ ] Add issue heat map on booth detail
- [ ] Add narrative/counter-narrative display
- [ ] Add task creation/assignment UI
- [ ] Add high-risk booth list view

---

## 6. Dependency Installation

```bash
npm install csv-parser neo4j-driver
```

New scripts need `csv-parser` for CSV reading. `neo4j-driver` is already installed.

---

## 7. Testing Checklist

After each phase, run these verification queries:

```cypher
-- Phase 1: Geography
MATCH (b:Booth) RETURN count(b) AS booths;
MATCH (vs:VidhanSabhaConstituency) RETURN count(vs) AS vs_seats;
MATCH (ls:LokSabhaConstituency) RETURN count(ls) AS ls_seats;
MATCH (d:District)-[:HAS_VS]->(vs) RETURN count(*) AS district_vs_links;
MATCH (vs)-[:HAS_BOOTH]->(b) RETURN count(*) AS vs_booth_links;
MATCH (b)-[:IN_VILLAGE]->(v) RETURN count(*) AS rural_booths;
MATCH (b)-[:IN_WARD]->(w) RETURN count(*) AS urban_booths;

-- Phase 2: Elections
MATCH (e:Election) RETURN e.election_id, e.type, e.year;
MATCH (br:BoothResult)-[:PART_OF]->(e:Election) RETURN e.election_id, count(br) AS booth_results;

-- Phase 3: Social
MATCH (cb:CommunityBlock) RETURN cb.block_id, cb.label;
MATCH (cg:CasteGroup)-[:PART_OF_BLOCK]->(cb) RETURN cb.label, collect(cg.name) AS castes;
MATCH ()-[r:HAS_CASTE_DISTRIBUTION]->() RETURN count(r) AS caste_distribution_links;
MATCH ()-[r:HAS_COMMUNITY_BLOCK]->() RETURN count(r) AS community_block_links;

-- Phase 4: Issues & Risk
MATCH (i:Issue) RETURN i.issue_id, i.name;
MATCH ()-[r:HAS_ISSUE]->() RETURN count(r) AS booth_issue_links;
MATCH ()-[r:HAS_HEAT]->() RETURN count(r) AS heat_score_links;
MATCH (rc:RiskCategory) RETURN rc.label;
MATCH ()-[r:HAS_RISK_CATEGORY]->() RETURN count(r) AS risk_links;

-- Phase 5: Campaign
MATCH (n:Narrative) RETURN count(n) AS narratives;
MATCH (cn:CounterNarrative) RETURN count(cn) AS counters;
MATCH (e:CampaignEvent) RETURN count(e) AS events;
MATCH (t:Task) RETURN t.status, count(t) AS tasks_by_status;
```

---

## 8. Known Constraints & Limitations

| Constraint | Impact | Mitigation |
|---|---|---|
| No 2024 booth-level ECI data | Can't do actual booth swing analysis yet | Use 2019 baseline + 2024 constituency-level proportional allocation |
| No direct caste census at booth level | Must estimate from SHRUG village-level | Use SHRUG village data → booth mapping with confidence scores |
| Neo4j AuraDB free tier limits | 50K nodes, 175K relationships | **RESOLVED: Running local Neo4j 5.14 via Docker (full graph supported)** |
| District nodes on AuraDB only | Local Neo4j starts empty for geography | Need to export District nodes from AuraDB → import to local, OR dual-route queries |
| No real-time social media ingestion | Sentiment will be delayed/manual | Start with survey data + news NLP, add Twitter later |
| No BJP internal data access | OrgUnit, BoothWorker, CampaignEvent will be manual entry | Build manual entry UI, allow CSV upload for bulk import |

---

## 9. Next Actions

1. **Complete manual downloads** — Harvard Dataverse booth CSV, SHRUG socioeconomic data, Census 2011 villages.
2. **Sync District nodes** — Export `District` from AuraDB (71+ nodes) → import to local Neo4j for `District→LS` links.
3. **Build booth-level import** — Once Dataverse CSV is downloaded, create `import_booths.js` for 162K PS nodes.
4. **Update .env** — Copy `.env.local` vars into `.env` (or route server.js to use local Neo4j for dev).
5. **Wire real API** — Replace mock `/api/up/booth/:boothId` and `/api/up/constituency/:constName/analysis` endpoints.
6. **Add constituency-level API** — Build `/api/up/constituency/:lsId` to return LS data + 2019 results from Neo4j.
7. **Iterate** — Add social structure, issues, narratives incrementally.

---

*This document is living. Update after each phase completion.*
