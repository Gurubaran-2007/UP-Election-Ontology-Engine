/**
 * seed_neo4j.js
 * Loads UP election data from CSV files into Neo4j
 * Nodes: District, VidhanSabhaConstituency, LokSabhaConstituency, LeaderEntity, Strategy
 */

const neo4j = require('neo4j-driver');
const fs    = require('fs');
const path  = require('path');
const csv   = require('csv-parse/sync');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const driver = neo4j.driver(
    process.env.NEO4J_URI || 'neo4j://localhost:7687',
    neo4j.auth.basic(
        process.env.NEO4J_USER || 'neo4j',
        process.env.NEO4J_PASSWORD
    )
);

const DATA_DIR = path.join(__dirname, '../data/eci');

async function run(session, query, params = {}) {
    return session.run(query, params);
}

// ── 1. Constraints & Indexes ──────────────────────────────────────────────
async function createConstraints(session) {
    console.log('Creating constraints...');
    const constraints = [
        `CREATE CONSTRAINT IF NOT EXISTS FOR (d:District) REQUIRE d.name IS UNIQUE`,
        `CREATE CONSTRAINT IF NOT EXISTS FOR (vs:VidhanSabhaConstituency) REQUIRE vs.vs_id IS UNIQUE`,
        `CREATE CONSTRAINT IF NOT EXISTS FOR (ls:LokSabhaConstituency) REQUIRE ls.ls_id IS UNIQUE`,
        `CREATE CONSTRAINT IF NOT EXISTS FOR (l:LeaderEntity) REQUIRE l.entity_id IS UNIQUE`,
        `CREATE CONSTRAINT IF NOT EXISTS FOR (s:Strategy) REQUIRE s.strategy_id IS UNIQUE`,
    ];
    for (const c of constraints) {
        try { await run(session, c); } catch (e) { /* already exists */ }
    }
    console.log('  Done.');
}

// ── 2. Load VS 2022 results → District + VidhanSabha + LeaderEntity ───────
async function loadVS2022(session) {
    const file = path.join(DATA_DIR, 'up_vs2022_results.csv');
    if (!fs.existsSync(file)) { console.warn('up_vs2022_results.csv not found, skipping.'); return; }

    const records = csv.parse(fs.readFileSync(file), { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true });
    console.log(`Loading VS 2022: ${records.length} rows...`);

    const winners = {};
    for (const r of records) {
        const key = r.Constituency_Name;
        if (!winners[key] || parseInt(r.Position) < parseInt(winners[key].Position)) {
            winners[key] = r;
        }
    }

    let districtsDone = new Set();
    let count = 0;

    for (const [constName, r] of Object.entries(winners)) {
        // District node
        if (!districtsDone.has(r.District_Name)) {
            await run(session,
                `MERGE (d:District {name: $name})
                 SET d.state = 'Uttar Pradesh', d.sub_region = $sub_region`,
                { name: r.District_Name, sub_region: r.Sub_Region || '' }
            );
            districtsDone.add(r.District_Name);
        }

        // VidhanSabha node
        const vsId = `VS_${r.Constituency_No}_2022`;
        await run(session,
            `MERGE (vs:VidhanSabhaConstituency {vs_id: $id})
             SET vs.name = $name, vs.vs_name = $name,
                 vs.constituency_type = $type,
                 vs.district = $district,
                 vs.total_electors = toInteger($electors),
                 vs.turnout_pct = toFloat($turnout),
                 vs.n_candidates = toInteger($n_cand)`,
            {
                id: vsId, name: constName,
                type: r.Constituency_Type || 'GEN',
                district: r.District_Name,
                electors: r.Electors || '0',
                turnout: r.Turnout_Percentage || '0',
                n_cand: r.N_Cand || '0',
            }
        );

        // Link VS → District
        await run(session,
            `MATCH (vs:VidhanSabhaConstituency {vs_id: $vsId})
             MATCH (d:District {name: $district})
             MERGE (vs)-[:IN_DISTRICT]->(d)`,
            { vsId, district: r.District_Name }
        );

        // Winner → LeaderEntity
        const entityId = r.pid || `LEADER_VS_${vsId}`;
        await run(session,
            `MERGE (l:LeaderEntity {entity_id: $id})
             SET l.name = $name, l.party = $party,
                 l.designation = 'MLA', l.constituency = $const,
                 l.constituency_id = $vsId,
                 l.votes = toInteger($votes),
                 l.vote_share = toFloat($vs),
                 l.age = toInteger($age),
                 l.gender = $gender,
                 l.education = $edu,
                 l.election_year = 2022,
                 l.since = '2022'`,
            {
                id: entityId, name: r.Candidate, party: r.Party,
                const: constName, vsId,
                votes: r.Votes || '0', vs: r.Vote_Share_Percentage || '0',
                age: r.Age || '0', gender: r.Sex || 'M',
                edu: r.MyNeta_education || 'N/A',
            }
        );

        // Link Leader → VS
        await run(session,
            `MATCH (l:LeaderEntity {entity_id: $eid})
             MATCH (vs:VidhanSabhaConstituency {vs_id: $vsId})
             MERGE (l)-[:REPRESENTS]->(vs)`,
            { eid: entityId, vsId }
        );

        count++;
    }
    console.log(`  Loaded ${count} constituencies, ${districtsDone.size} districts, ${count} MLAs.`);
}

// ── 3. Load LS 2024 results → LokSabha + Link to VS ──────────────────────
async function loadLS2024(session) {
    const file = path.join(DATA_DIR, 'up_ls2024_results.csv');
    if (!fs.existsSync(file)) { console.warn('up_ls2024_results.csv not found, skipping.'); return; }

    const records = csv.parse(fs.readFileSync(file), { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true });
    console.log(`Loading LS 2024: ${records.length} rows...`);

    const winners = {};
    for (const r of records) {
        const key = r.Constituency_Name;
        if (!winners[key] || parseInt(r.Position) < parseInt(winners[key].Position)) {
            winners[key] = r;
        }
    }

    let count = 0;
    for (const [constName, r] of Object.entries(winners)) {
        const lsId = `LS_${r.Constituency_No || constName.replace(/\s+/g,'_')}_2024`;

        await run(session,
            `MERGE (ls:LokSabhaConstituency {ls_id: $id})
             SET ls.name = $name,
                 ls.total_electors = toInteger($electors),
                 ls.turnout_pct = toFloat($turnout),
                 ls.winning_party = $party,
                 ls.winning_candidate = $candidate,
                 ls.election_year = 2024`,
            {
                id: lsId, name: constName,
                electors: r.Valid_Votes || '0',
                turnout: r.Turnout_Percentage || '0',
                party: r.Party, candidate: r.Candidate,
            }
        );

        // Winner as LeaderEntity (MP)
        const entityId = `MP_${lsId}`;
        await run(session,
            `MERGE (l:LeaderEntity {entity_id: $id})
             SET l.name = $name, l.party = $party,
                 l.designation = 'MP', l.constituency = $const,
                 l.constituency_id = $lsId,
                 l.votes = toInteger($votes),
                 l.vote_share = toFloat($vs),
                 l.election_year = 2024,
                 l.since = '2024'`,
            {
                id: entityId, name: r.Candidate, party: r.Party,
                const: constName, lsId,
                votes: r.Votes || '0', vs: r.Vote_Share_Percentage || '0',
            }
        );

        await run(session,
            `MATCH (l:LeaderEntity {entity_id: $eid})
             MATCH (ls:LokSabhaConstituency {ls_id: $lsId})
             MERGE (l)-[:REPRESENTS]->(ls)`,
            { eid: entityId, lsId }
        );

        count++;
    }
    console.log(`  Loaded ${count} Lok Sabha constituencies and MPs.`);
}

// ── 4. Seed Strategy nodes ────────────────────────────────────────────────
async function seedStrategies(session) {
    console.log('Seeding Strategy nodes...');
    const strategies = [
        { id: 'STR001', title: 'Free Laptop Distribution', year: 2012, outcome: 'High youth mobilisation, SP won 2012 UP elections with strong youth vote share', positive_impact: 72, negative_impact: 18, description: 'Samajwadi Party distributed free laptops to class 12 students across UP' },
        { id: 'STR002', title: 'Ujjwala Yojana LPG Scheme', year: 2016, outcome: 'Massive BPL household penetration, contributed to BJP 2017 UP landslide', positive_impact: 81, negative_impact: 12, description: 'Free LPG connections to BPL households, targeted rural women voters' },
        { id: 'STR003', title: 'UP Anti-Romeo Squad', year: 2017, outcome: 'Polarised urban vote, strong Hindu consolidation in western UP', positive_impact: 64, negative_impact: 28, description: 'Police squads deployed near schools and colleges to prevent harassment' },
        { id: 'STR004', title: 'Kisan Samman Nidhi', year: 2019, outcome: 'Direct cash transfer to farmers, helped BJP consolidate rural vote in 2019 LS', positive_impact: 76, negative_impact: 14, description: 'Rs 6000/year direct benefit transfer to all farmers with land records' },
        { id: 'STR005', title: 'Ram Mandir Bhumi Pujan', year: 2020, outcome: 'Maximum Hindu consolidation, set tone for 2022 UP elections', positive_impact: 85, negative_impact: 22, description: 'Foundation laying ceremony for Ram Temple in Ayodhya' },
        { id: 'STR006', title: 'Free Ration Scheme (PMGKAY)', year: 2020, outcome: 'Broad welfare coverage during COVID, helped BJP retain UP 2022', positive_impact: 88, negative_impact: 8, description: 'Free food grain distribution to 80 crore beneficiaries during COVID-19' },
        { id: 'STR007', title: 'Bulldozer Action Campaign', year: 2022, outcome: 'Law and order narrative strengthened, polarised voters on Hindu-Muslim lines', positive_impact: 61, negative_impact: 35, description: 'Demolition of alleged illegal properties of accused criminals in UP' },
        { id: 'STR008', title: 'PDA Alliance (SP 2024)', year: 2024, outcome: 'SP gained 37 LS seats in UP, PDA strategy successfully mobilised OBC+Dalit+Minority vote', positive_impact: 69, negative_impact: 21, description: 'Samajwadi Party Pichhda, Dalit, Alpasankhyak coalition strategy for 2024 LS elections' },
    ];

    for (const s of strategies) {
        await run(session,
            `MERGE (s:Strategy {strategy_id: $id})
             SET s.title = $title, s.year = $year,
                 s.outcome = $outcome,
                 s.positive_impact = $pos,
                 s.negative_impact = $neg,
                 s.description = $desc`,
            { id: s.id, title: s.title, year: s.year, outcome: s.outcome, pos: s.positive_impact, neg: s.negative_impact, desc: s.description }
        );
    }
    console.log(`  Seeded ${strategies.length} strategies.`);
}

// ── Main ──────────────────────────────────────────────────────────────────
(async () => {
    const session = driver.session();
    try {
        console.log('\n🌱 Starting Neo4j seed...\n');
        await createConstraints(session);
        await loadVS2022(session);
        await loadLS2024(session);
        await seedStrategies(session);
        await loadAliases(session);

        // Summary
        const counts = await session.run(
            `MATCH (n) RETURN labels(n)[0] AS label, count(*) AS count ORDER BY count DESC`
        );
        console.log('\n📊 Neo4j node counts:');
        counts.records.forEach(r => console.log(`  ${r.get('label')}: ${r.get('count')}`));
        console.log('\n✅ Seed complete.\n');
    } catch (e) {
        console.error('Seed failed:', e.message);
    } finally {
        await session.close();
        await driver.close();
    }
})();

// ── 5. Load aliases from up_entities.json → Neo4j ──────────────────────────
async function loadAliases(session) {
    const file = path.join(__dirname, '../data/aliases/up_entities.json');
    if (!fs.existsSync(file)) { console.warn('up_entities.json not found, skipping.'); return; }

    const entities = JSON.parse(fs.readFileSync(file, 'utf8'));
    console.log(`Loading aliases: ${entities.length} entities...`);

    let leaders = 0, parties = 0;

    for (const e of entities) {
        const aliases = (e.aliases || []).map(a => a.toLowerCase());

        if (e.entity_type === 'party') {
            await run(session,
                `MERGE (p:Party {entity_id: $id})
                 SET p.name = $name, p.aliases = $aliases,
                     p.level = $level, p.entity_type = 'party'`,
                { id: e.entity_id, name: e.name, aliases, level: e.level || 'national' }
            );
            parties++;
        } else {
            // Try to match existing LeaderEntity by name, else create new
            await run(session,
                `MERGE (l:LeaderEntity {entity_id: $id})
                 SET l.name = coalesce(l.name, $name),
                     l.aliases = $aliases,
                     l.party = coalesce(l.party, $party),
                     l.level = $level,
                     l.entity_type = $etype`,
                {
                    id: e.entity_id, name: e.name,
                    aliases, party: e.party || '',
                    level: e.level || 'state',
                    etype: e.entity_type || 'leader',
                }
            );
            leaders++;
        }
    }
    console.log(`  Loaded ${leaders} leader aliases, ${parties} party nodes.`);
}
