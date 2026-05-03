// import_all.js — Master import script for local Neo4j
// Run: node scripts/import_all.js
// Prerequisites: Neo4j running on localhost:7687, data files in data/ directory

const neo4j = require('neo4j-driver');
const fs = require('fs');
const path = require('path');

const URI = process.env.NEO4J_URI || 'neo4j://localhost:7687';
const USER = process.env.NEO4J_USER || 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD || 'guru@9114';

const DATA_DIR = path.join(__dirname, '..', 'data');

const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD), { encrypted: 'ENCRYPTION_OFF' });

async function runCypher(cypher, params = {}) {
    const session = driver.session();
    try {
        const result = await session.run(cypher, params);
        return result;
    } finally {
        await session.close();
    }
}

// ============================================================
// STEP 1: Create constraints and indexes
// ============================================================
async function createConstraints() {
    console.log('\n=== Step 1: Creating Constraints & Indexes ===');

    const constraints = [
        `CREATE CONSTRAINT district_id_unique IF NOT EXISTS FOR (d:District) REQUIRE d.district_id IS UNIQUE`,
        `CREATE CONSTRAINT ls_id_unique IF NOT EXISTS FOR (ls:LokSabhaConstituency) REQUIRE ls.ls_id IS UNIQUE`,
        `CREATE CONSTRAINT vs_id_unique IF NOT EXISTS FOR (vs:VidhanSabhaConstituency) REQUIRE vs.vs_id IS UNIQUE`,
        `CREATE CONSTRAINT booth_id_unique IF NOT EXISTS FOR (b:Booth) REQUIRE b.booth_id IS UNIQUE`,
        `CREATE CONSTRAINT party_id_unique IF NOT EXISTS FOR (p:Party) REQUIRE p.party_id IS UNIQUE`,
        `CREATE CONSTRAINT cand_id_unique IF NOT EXISTS FOR (c:Candidate) REQUIRE c.cand_id IS UNIQUE`,
        `CREATE CONSTRAINT election_id_unique IF NOT EXISTS FOR (e:Election) REQUIRE e.election_id IS UNIQUE`,
        `CREATE CONSTRAINT caste_code_unique IF NOT EXISTS FOR (cg:CasteGroup) REQUIRE cg.caste_code IS UNIQUE`,
        `CREATE CONSTRAINT block_id_unique IF NOT EXISTS FOR (cb:CommunityBlock) REQUIRE cb.block_id IS UNIQUE`,
        `CREATE CONSTRAINT issue_id_unique IF NOT EXISTS FOR (i:Issue) REQUIRE i.issue_id IS UNIQUE`,
        `CREATE CONSTRAINT risk_id_unique IF NOT EXISTS FOR (r:RiskCategory) REQUIRE r.risk_id IS UNIQUE`,
    ];

    for (const c of constraints) {
        try {
            await runCypher(c);
            console.log(`  ✓ ${c.split('FOR (')[1]?.split(')')[0] || c.slice(0, 50)}`);
        } catch (err) {
            console.log(`  ! ${err.message}`);
        }
    }

    const indexes = [
        `CREATE INDEX booth_district_idx IF NOT EXISTS FOR (b:Booth) ON (b.district)`,
        `CREATE INDEX booth_vs_idx IF NOT EXISTS FOR (b:Booth) ON (b.vs_id)`,
        `CREATE INDEX booth_urban_rural_idx IF NOT EXISTS FOR (b:Booth) ON (b.urban_rural)`,
        `CREATE INDEX result_election_idx IF NOT EXISTS FOR (br:BoothResult) ON (br.election_id)`,
        `CREATE INDEX district_name_idx IF NOT EXISTS FOR (d:District) ON (d.name)`,
    ];

    for (const idx of indexes) {
        try {
            await runCypher(idx);
            console.log(`  ✓ Index: ${idx.split('ON (')[1]?.split(')')[0] || idx.slice(0, 50)}`);
        } catch (err) {
            console.log(`  ! Index: ${err.message}`);
        }
    }
}

// ============================================================
// STEP 2: Create LokSabha + VidhanSabha constituencies
// ============================================================
async function importConstituencies() {
    console.log('\n=== Step 2: Importing Constituencies ===');

    const mappingPath = path.join(DATA_DIR, 'mappings', 'up_ls_vs_mapping.json');
    if (!fs.existsSync(mappingPath)) {
        console.log('  ✗ Mapping file not found, skipping');
        return;
    }

    const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    const session = driver.session();

    try {
        // Create Parties first
        const parties = [
            { party_id: 'bjp', name: 'Bharatiya Janata Party', symbol: 'Lotus' },
            { party_id: 'sp', name: 'Samajwadi Party', symbol: 'Cycle' },
            { party_id: 'bsp', name: 'Bahujan Samaj Party', symbol: 'Elephant' },
            { party_id: 'inc', name: 'Indian National Congress', symbol: 'Hand' },
            { party_id: 'apd', name: 'Apna Dal (Soneylal)', symbol: 'Banana' },
            { party_id: 'rlsp', name: 'Rashtriya Lok Samta Party', symbol: 'Clock' },
            { party_id: 'ajsp', name: 'Azad Samaj Party', symbol: 'Spectacles' },
            { party_id: 'other', name: 'Others', symbol: '' },
        ];

        for (const p of parties) {
            await session.run(
                `MERGE (p:Party {party_id: $party_id}) SET p.name = $name, p.symbol = $symbol`,
                p
            );
        }
        console.log(`  ✓ Created ${parties.length} parties`);

        // Create LS constituencies
        let lsCount = 0;
        for (const ls of mapping.lok_sabha_constituencies) {
            await session.run(
                `MERGE (ls:LokSabhaConstituency {ls_id: $ls_id})
                 SET ls.name = $name, ls.reservation = $reservation, ls.ls_no = $ls_no`,
                ls
            );
            lsCount++;
        }
        console.log(`  ✓ Created ${lsCount} Lok Sabha constituencies`);

        // Create VS constituencies + link to LS
        let vsCount = 0;
        let vsLinkCount = 0;
        for (const ls of mapping.lok_sabha_constituencies) {
            for (let i = 0; i < ls.assembly_segments.length; i++) {
                const vsName = ls.assembly_segments[i];
                const vsId = `UP-VS-${ls.ls_no}-${i + 1}`;
                const reservation = ls.reservation;

                await session.run(
                    `MERGE (vs:VidhanSabhaConstituency {vs_id: $vs_id})
                     SET vs.name = $vs_name, vs.reservation = $reservation, vs.ls_id = $ls_id
                     WITH vs
                     MATCH (ls:LokSabhaConstituency {ls_id: $ls_id})
                     MERGE (ls)-[:HAS_VS]->(vs)`,
                    { vs_id: vsId, vs_name: vsName, reservation, ls_id: ls.ls_id }
                );
                vsCount++;
                vsLinkCount++;
            }
        }
        console.log(`  ✓ Created ${vsCount} Vidhan Sabha constituencies`);
        console.log(`  ✓ Created ${vsLinkCount} LS→VS links`);

        // Link LS to Districts (approximate — based on known district associations)
        const lsDistrictMap = {
            'UP-1': 'Saharanpur', 'UP-2': 'Shamli', 'UP-3': 'Muzaffarnagar',
            'UP-4': 'Bijnor', 'UP-5': 'Bijnor', 'UP-6': 'Moradabad',
            'UP-7': 'Rampur', 'UP-8': 'Sambhal', 'UP-9': 'Amroha',
            'UP-10': 'Meerut', 'UP-11': 'Baghpat', 'UP-12': 'Ghaziabad',
            'UP-13': 'Gautam Buddha Nagar', 'UP-14': 'Bulandshahr',
            'UP-15': 'Aligarh', 'UP-16': 'Hathras', 'UP-17': 'Mathura',
            'UP-18': 'Agra', 'UP-19': 'Agra', 'UP-20': 'Firozabad',
            'UP-21': 'Mainpuri', 'UP-22': 'Etah', 'UP-23': 'Badaun',
            'UP-24': 'Bareilly', 'UP-25': 'Bareilly', 'UP-26': 'Pilibhit',
            'UP-27': 'Shahjahanpur', 'UP-28': 'Lakhimpur Kheri',
            'UP-29': 'Lakhimpur Kheri', 'UP-30': 'Sitapur',
            'UP-31': 'Hardoi', 'UP-32': 'Hardoi', 'UP-33': 'Unnao',
            'UP-34': 'Lucknow', 'UP-35': 'Lucknow', 'UP-36': 'Rae Bareli',
            'UP-37': 'Amethi', 'UP-38': 'Sultanpur', 'UP-39': 'Pratapgarh',
            'UP-40': 'Farrukhabad', 'UP-41': 'Etawah', 'UP-42': 'Kannauj',
            'UP-43': 'Kanpur Nagar', 'UP-44': 'Kanpur Nagar',
            'UP-45': 'Jalaun', 'UP-46': 'Jhansi', 'UP-47': 'Hamirpur',
            'UP-48': 'Banda', 'UP-49': 'Fatehpur', 'UP-50': 'Kaushambi',
            'UP-51': 'Prayagraj', 'UP-52': 'Prayagraj', 'UP-53': 'Barabanki',
            'UP-54': 'Ayodhya', 'UP-55': 'Ambedkar Nagar', 'UP-56': 'Bahraich',
            'UP-57': 'Gonda', 'UP-58': 'Shrawasti', 'UP-59': 'Gonda',
            'UP-60': 'Siddharthnagar', 'UP-61': 'Basti',
            'UP-62': 'Sant Kabir Nagar', 'UP-63': 'Maharajganj',
            'UP-64': 'Gorakhpur', 'UP-65': 'Kushinagar', 'UP-66': 'Deoria',
            'UP-67': 'Gorakhpur', 'UP-68': 'Azamgarh', 'UP-69': 'Azamgarh',
            'UP-70': 'Mau', 'UP-71': 'Ballia', 'UP-72': 'Ballia',
            'UP-73': 'Jaunpur', 'UP-74': 'Jaunpur', 'UP-75': 'Ghazipur',
            'UP-76': 'Chandauli', 'UP-77': 'Varanasi', 'UP-78': 'Bhadohi',
            'UP-79': 'Mirzapur', 'UP-80': 'Sonbhadra',
        };

        let districtLinkCount = 0;
        for (const [lsId, districtName] of Object.entries(lsDistrictMap)) {
            const result = await session.run(
                `MATCH (ls:LokSabhaConstituency {ls_id: $ls_id})
                 MATCH (d:District {name: $district_name})
                 MERGE (d)-[:HAS_LS]->(ls)
                 RETURN count(*) AS created`,
                { ls_id: lsId, district_name: districtName }
            );
            if (result.records[0]?.get('created')?.toNumber() > 0) {
                districtLinkCount++;
            }
        }
        console.log(`  ✓ Created ${districtLinkCount} District→LS links`);

    } finally {
        await session.close();
    }
}

// ============================================================
// STEP 3: Import elections
// ============================================================
async function importElections() {
    console.log('\n=== Step 3: Importing Elections ===');

    const electionsPath = path.join(DATA_DIR, 'eci', 'elections.json');
    if (!fs.existsSync(electionsPath)) {
        console.log('  ✗ Elections file not found, skipping');
        return;
    }

    const elections = JSON.parse(fs.readFileSync(electionsPath, 'utf8'));
    const session = driver.session();

    try {
        for (const e of elections) {
            await session.run(
                `MERGE (e:Election {election_id: $election_id})
                 SET e.type = $type, e.year = $year, e.phase = $phase,
                     e.description = $description, e.total_seats = $total_seats,
                     e.bjp_seats = $bjp_seats, e.sp_seats = $sp_seats,
                     e.bsp_seats = $bsp_seats, e.inc_seats = $inc_seats,
                     e.others_seats = $others_seats`,
                e
            );
        }
        console.log(`  ✓ Created ${elections.length} election nodes`);

        // Create alliances
        const alliances = [
            { alliance_id: 'nda', name: 'NDA', parties: ['bjp', 'apd'] },
            { alliance_id: 'india_bloc', name: 'INDIA Bloc', parties: ['sp', 'inc', 'ajsp'] },
            { alliance_id: 'non_aligned', name: 'Non-Aligned', parties: ['bsp', 'rlsp'] },
        ];

        for (const a of alliances) {
            await session.run(
                `MERGE (a:Alliance {alliance_id: $alliance_id})
                 SET a.name = $name
                 WITH a
                 UNWIND $parties AS pid
                 MATCH (p:Party {party_id: pid})
                 MERGE (p)-[:PART_OF_ALLIANCE]->(a)`,
                a
            );
        }
        console.log(`  ✓ Created ${alliances.length} alliances with party links`);
    } finally {
        await session.close();
    }
}

// ============================================================
// STEP 4: Import community blocks + caste groups
// ============================================================
async function importSocialStructure() {
    console.log('\n=== Step 4: Importing Social Structure ===');

    const blocksPath = path.join(DATA_DIR, 'mappings', 'community_blocks.json');
    if (!fs.existsSync(blocksPath)) {
        console.log('  ✗ Community blocks file not found, skipping');
        return;
    }

    const data = JSON.parse(fs.readFileSync(blocksPath, 'utf8'));
    const session = driver.session();

    try {
        // Create CommunityBlocks
        for (const block of data.community_blocks) {
            await session.run(
                `MERGE (cb:CommunityBlock {block_id: $block_id})
                 SET cb.label = $label, cb.description = $description,
                     cb.category = $category, cb.bjp_affinity_2024 = $bjp_affinity_2024`,
                block
            );
        }
        console.log(`  ✓ Created ${data.community_blocks.length} community blocks`);

        // Create CasteGroups + link to blocks
        for (const [casteName, blockId] of Object.entries(data.caste_to_block_mapping)) {
            const casteCode = casteName.toLowerCase().replace(/\s+/g, '');
            await session.run(
                `MERGE (cg:CasteGroup {caste_code: $caste_code})
                 SET cg.name = $caste_name
                 WITH cg
                 MATCH (cb:CommunityBlock {block_id: $block_id})
                 MERGE (cg)-[:PART_OF_BLOCK]->(cb)`,
                { caste_code: casteCode, caste_name: casteName, block_id: blockId }
            );
        }
        console.log(`  ✓ Created ${Object.keys(data.caste_to_block_mapping).length} caste groups with block links`);

        // Create RiskCategories
        const risks = [
            { risk_id: 'safe', label: 'Safe', description: 'BJP stronghold, >50% vote share' },
            { risk_id: 'leaning', label: 'Leaning', description: 'BJP ahead but vulnerable' },
            { risk_id: 'tossup', label: 'TossUp', description: 'Highly competitive, within 5% margin' },
            { risk_id: 'losing', label: 'Losing', description: 'Opposition ahead, BJP lost last election' },
            { risk_id: 'hostile', label: 'Hostile', description: 'Strong opposition territory, <30% BJP' },
        ];

        for (const r of risks) {
            await session.run(
                `MERGE (rc:RiskCategory {risk_id: $risk_id})
                 SET rc.label = $label, rc.description = $description`,
                r
            );
        }
        console.log(`  ✓ Created ${risks.length} risk categories`);

        // Create Issues
        const issues = [
            { issue_id: 'unemployment', name: 'Unemployment', category: 'economic' },
            { issue_id: 'paper_leaks', name: 'Exam Paper Leaks', category: 'governance' },
            { issue_id: 'price_rise', name: 'Price Rise / Inflation', category: 'economic' },
            { issue_id: 'law_order', name: 'Law and Order', category: 'governance' },
            { issue_id: 'local_road', name: 'Road / Infrastructure', category: 'local' },
            { issue_id: 'water', name: 'Water / Irrigation', category: 'local' },
            { issue_id: 'electricity', name: 'Power / Electricity', category: 'local' },
            { issue_id: 'reservation', name: 'Reservation Policy', category: 'social' },
            { issue_id: 'hindutva', name: 'Hindutva / Temple', category: 'ideological' },
            { issue_id: 'farmer_distress', name: 'Farmer Distress / MSP', category: 'economic' },
        ];

        for (const i of issues) {
            await session.run(
                `MERGE (iss:Issue {issue_id: $issue_id})
                 SET iss.name = $name, iss.category = $category`,
                i
            );
        }
        console.log(`  ✓ Created ${issues.length} issue nodes`);

    } finally {
        await session.close();
    }
}

// ============================================================
// STEP 5: Import 2019 LS constituency results into Neo4j
// ============================================================
async function importConstituencyResults() {
    console.log('\n=== Step 5: Importing 2019 LS Constituency Results ===');

    const resultsPath = path.join(DATA_DIR, 'eci', 'up_ls2019_constituency_results.json');
    if (!fs.existsSync(resultsPath)) {
        console.log('  ✗ UP 2019 results file not found.');
        console.log('  → Run: node scripts/extract_up_data.js first');
        return;
    }

    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    const session = driver.session();

    try {
        let candidateCount = 0;
        let resultCount = 0;

        for (const pc of results) {
            const lsId = `UP-${pc.pc_code}`;

            const electionId = 'LS2019';
            const votesJson = pc.results.map(r => ({
                candidate: r.candidate,
                party: r.party,
                total_votes: r.total_votes,
                evm_votes: r.evm_votes,
                postal_votes: r.postal_votes
            }));

            const winner = pc.results.sort((a, b) => b.total_votes - a.total_votes)[0];

            const safeCandId = `LS2019_PC${pc.pc_code}_${winner.candidate.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')}`;

            await session.run(
                `MERGE (c:Candidate {cand_id: $cand_id})
                 SET c.name = $winner_name, c.party_id = toLower($winner_party),
                     c.gender = 'unknown'
                 WITH c
                 MATCH (ls:LokSabhaConstituency {ls_id: $ls_id})
                 MERGE (c)-[:CONTESTS]->(ls)
                 WITH c, ls
                 MATCH (p:Party {party_id: toLower($winner_party)})
                 MERGE (c)-[:BELONGS_TO]->(p)`,
                {
                    cand_id: safeCandId,
                    winner_name: winner.candidate,
                    winner_party: winner.party,
                    ls_id: lsId
                }
            );
            candidateCount++;

            // Create an ElectionResult node at constituency level
            await session.run(
                `MATCH (ls:LokSabhaConstituency {ls_id: $ls_id})
                 MATCH (e:Election {election_id: $election_id})
                 MERGE (er:ElectionResult {result_id: $result_id})
                 SET er.votes_json = $votes_json,
                     er.winner = $winner,
                     er.winner_party = $winner_party,
                     er.total_valid_votes = $total_valid_votes
                 MERGE (ls)-[:HAS_RESULT]->(er)
                 MERGE (er)-[:PART_OF]->(e)`,
                {
                    ls_id: lsId,
                    election_id: electionId,
                    result_id: `LS2019_PC${pc.pc_code}`,
                    votes_json: JSON.stringify(votesJson),
                    winner: winner.candidate,
                    winner_party: winner.party,
                    total_valid_votes: votesJson.reduce((sum, v) => sum + v.total_votes, 0)
                }
            );
            resultCount++;
        }

        console.log(`  ✓ Created ${candidateCount} candidate nodes (winners only)`);
        console.log(`  ✓ Created ${resultCount} election result nodes`);

    } finally {
        await session.close();
    }
}

// ============================================================
// STEP 6: Verify counts
// ============================================================
async function verifyCounts() {
    console.log('\n=== Step 6: Verification ===');

    const queries = [
        ['District', 'MATCH (d:District) RETURN count(d) AS count'],
        ['LokSabhaConstituency', 'MATCH (ls:LokSabhaConstituency) RETURN count(ls) AS count'],
        ['VidhanSabhaConstituency', 'MATCH (vs:VidhanSabhaConstituency) RETURN count(vs) AS count'],
        ['Party', 'MATCH (p:Party) RETURN count(p) AS count'],
        ['Alliance', 'MATCH (a:Alliance) RETURN count(a) AS count'],
        ['CommunityBlock', 'MATCH (cb:CommunityBlock) RETURN count(cb) AS count'],
        ['CasteGroup', 'MATCH (cg:CasteGroup) RETURN count(cg) AS count'],
        ['Election', 'MATCH (e:Election) RETURN count(e) AS count'],
        ['Candidate', 'MATCH (c:Candidate) RETURN count(c) AS count'],
        ['ElectionResult', 'MATCH (er:ElectionResult) RETURN count(er) AS count'],
        ['Issue', 'MATCH (i:Issue) RETURN count(i) AS count'],
        ['RiskCategory', 'MATCH (rc:RiskCategory) RETURN count(rc) AS count'],
        ['HAS_VS links', 'MATCH ()-[:HAS_VS]->() RETURN count(*) AS count'],
        ['HAS_LS links', 'MATCH ()-[:HAS_LS]->() RETURN count(*) AS count'],
        ['PART_OF_BLOCK links', 'MATCH ()-[:PART_OF_BLOCK]->() RETURN count(*) AS count'],
        ['PART_OF_ALLIANCE links', 'MATCH ()-[:PART_OF_ALLIANCE]->() RETURN count(*) AS count'],
    ];

    const session = driver.session();
    try {
        for (const [label, query] of queries) {
            const result = await session.run(query);
            const count = result.records[0]?.get('count')?.toNumber() || 0;
            const status = count > 0 ? '✓' : '✗';
            console.log(`  ${status} ${label}: ${count}`);
        }
    } finally {
        await session.close();
    }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
    console.log('==========================================');
    console.log('  UP Election Ontology — Neo4j Import');
    console.log('==========================================');

    try {
        await createConstraints();
        await importConstituencies();
        await importElections();
        await importSocialStructure();
        await importConstituencyResults();
        await verifyCounts();

        console.log('\n✓ Import complete!');
    } catch (err) {
        console.error('\n✗ Import failed:', err.message);
    } finally {
        await driver.close();
    }
}

main();
