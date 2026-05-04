// import_all.js — Master import script for local Neo4j
// Run: node scripts/import_all.js [--state UP]
// Prerequisites: Neo4j running on localhost:7687, data files in data/states/<CODE>/ directory

require('dotenv').config();
const neo4j = require('neo4j-driver');
const fs = require('fs');
const path = require('path');

// Resolve state from CLI flag or default to UP
const stateArg = process.argv.find((a, i) => process.argv[i - 1] === '--state') || 'UP';
const STATE_CODE = stateArg.toUpperCase();
const STATE_CONFIG_PATH = path.join(__dirname, '..', 'data', 'states', `${STATE_CODE.toLowerCase()}.json`);
if (!fs.existsSync(STATE_CONFIG_PATH)) {
    console.error(`✗ No state config found at ${STATE_CONFIG_PATH}`);
    process.exit(1);
}
const STATE_CONFIG = JSON.parse(fs.readFileSync(STATE_CONFIG_PATH, 'utf8'));

const URI = process.env.NEO4J_URI || 'neo4j://localhost:7687';
const USER = process.env.NEO4J_USER || 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD;

const DATA_DIR = path.join(__dirname, '..', 'data');

const isCloud = URI.startsWith('neo4j+s') || URI.startsWith('bolt+s');
const driver = neo4j.driver(
    URI,
    neo4j.auth.basic(USER, PASSWORD || ''),
    isCloud ? {} : { encrypted: 'ENCRYPTION_OFF' }
);

function requireEnv(name, value) {
    if (!value) {
        throw new Error(`${name} is required`);
    }
}

function buildNodeProvenance(source, sourceDate, sourceUrl = null, confidence = 'high') {
    return {
        source,
        source_date: sourceDate,
        source_url: sourceUrl,
        confidence,
        ingested_at: new Date().toISOString(),
    };
}

function buildRelProvenance(source, sourceDate, confidence = 'high') {
    return {
        source,
        source_date: sourceDate,
        confidence,
    };
}

// ============================================================
// VALIDATION HELPERS (Step 9)
// ============================================================
function validateProvenance(node, nodeType, context) {
    const required = ['source', 'source_date', 'confidence'];
    const missing = required.filter(f => !node[f]);
    if (missing.length > 0) {
        throw new Error(
            `[PROVENANCE FAIL] ${nodeType} (${context}) missing: ${missing.join(', ')}. ` +
            `Import halted. Fix source data before re-running.`
        );
    }
    const validConfidence = ['high', 'medium', 'low'];
    if (!validConfidence.includes(node.confidence)) {
        throw new Error(
            `[PROVENANCE FAIL] ${nodeType} (${context}): confidence must be one of ` +
            `${validConfidence.join('|')}, got: "${node.confidence}"`
        );
    }
}

function validateLS(ls, context) {
    if (!ls.ls_id || !/^UP-\d{1,2}$/.test(ls.ls_id))
        throw new Error(`[VALIDATION FAIL] ${context}: ls_id must match UP-{1-80}, got: ${ls.ls_id}`);
    if (!['GEN', 'SC', 'ST'].includes(ls.reservation))
        throw new Error(`[VALIDATION FAIL] ${context}: reservation must be GEN|SC|ST, got: ${ls.reservation}`);
    validateProvenance(ls, 'LokSabhaConstituency', context);
}

function validateElectionResult(er, context) {
    if (!er.result_id) throw new Error(`[VALIDATION FAIL] ${context}: result_id required`);
    if (!er.election_id) throw new Error(`[VALIDATION FAIL] ${context}: election_id required`);
    if (!er.constituency_id) throw new Error(`[VALIDATION FAIL] ${context}: constituency_id required`);
    if (er.margin_votes === undefined || er.margin_votes === null)
        throw new Error(`[VALIDATION FAIL] ${context}: margin_votes required`);
    if (er.margin_pct === undefined || er.margin_pct === null)
        throw new Error(`[VALIDATION FAIL] ${context}: margin_pct required`);
    if (er.winner_vote_share === undefined || er.winner_vote_share === null)
        throw new Error(`[VALIDATION FAIL] ${context}: winner_vote_share required`);
    if (er.total_valid_votes <= 0)
        throw new Error(`[VALIDATION FAIL] ${context}: total_valid_votes must be > 0, got: ${er.total_valid_votes}`);
    validateProvenance(er, 'ElectionResult', context);
}

function validateCandidate(c, context) {
    if (!c.cand_id) throw new Error(`[VALIDATION FAIL] ${context}: cand_id required`);
    if (!c.name) throw new Error(`[VALIDATION FAIL] ${context}: candidate name required`);
    if (!c.party_id) throw new Error(`[VALIDATION FAIL] ${context}: party_id required`);
    if (!['M', 'F', 'OTHER'].includes(c.gender) && c.gender !== null && c.gender !== undefined)
        throw new Error(`[VALIDATION FAIL] ${context}: gender must be M|F|OTHER|null, got: ${c.gender}`);
    if (c.vote_share !== null && (c.vote_share < 0 || c.vote_share > 100))
        throw new Error(`[VALIDATION FAIL] ${context}: vote_share out of range: ${c.vote_share}`);
    if (c.rank !== null && c.rank < 1)
        throw new Error(`[VALIDATION FAIL] ${context}: rank must be >= 1`);
    validateProvenance(c, 'Candidate', context);
}

function validateAffidavit(aff, context) {
    if (!aff.affidavit_id) throw new Error(`[VALIDATION FAIL] ${context}: affidavit_id required`);
    if (!aff.cand_id) throw new Error(`[VALIDATION FAIL] ${context}: cand_id required`);
    if (aff.criminal_cases < 0)
        throw new Error(`[VALIDATION FAIL] ${context}: criminal_cases cannot be negative`);
    if (aff.serious_cases < 0)
        throw new Error(`[VALIDATION FAIL] ${context}: serious_cases cannot be negative`);
    if (aff.serious_cases > aff.criminal_cases)
        throw new Error(`[VALIDATION FAIL] ${context}: serious_cases (${aff.serious_cases}) cannot exceed criminal_cases (${aff.criminal_cases})`);
    validateProvenance(aff, 'Affidavit', context);
}

function toPartyId(name) {
    const normalized = String(name || '').trim().toLowerCase();
    const lookup = {
        'bharatiya janata party': 'bjp',
        'samajwadi party': 'sp',
        'bahujan samaj party': 'bsp',
        'indian national congress': 'inc',
        'apna dal (soneylal)': 'apd',
        'apna दल (soneylal)': 'apd',
        'rashtriya lok samta party': 'rlsp',
        'azad samaj party': 'ajsp',
        'none of the above': 'nota',
    };

    return lookup[normalized] || normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'other';
}

function getLSDistrictMap() {
    return {
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
        'UP-57': 'Gonda', 'UP-58': 'Shravasti', 'UP-59': 'Gonda',
        'UP-60': 'Siddharthnagar', 'UP-61': 'Basti',
        'UP-62': 'Sant Kabir Nagar', 'UP-63': 'Maharajganj',
        'UP-64': 'Gorakhpur', 'UP-65': 'Kushinagar', 'UP-66': 'Deoria',
        'UP-67': 'Gorakhpur', 'UP-68': 'Azamgarh', 'UP-69': 'Azamgarh',
        'UP-70': 'Mau', 'UP-71': 'Ballia', 'UP-72': 'Ballia',
        'UP-73': 'Jaunpur', 'UP-74': 'Jaunpur', 'UP-75': 'Ghazipur',
        'UP-76': 'Chandauli', 'UP-77': 'Varanasi', 'UP-78': 'Bhadohi',
        'UP-79': 'Mirzapur', 'UP-80': 'Sonbhadra',
    };
}

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
        `CREATE CONSTRAINT party_id_unique IF NOT EXISTS FOR (p:Party) REQUIRE p.party_id IS UNIQUE`,
        `CREATE CONSTRAINT cand_id_unique IF NOT EXISTS FOR (c:Candidate) REQUIRE c.cand_id IS UNIQUE`,
        `CREATE CONSTRAINT election_id_unique IF NOT EXISTS FOR (e:Election) REQUIRE e.election_id IS UNIQUE`,
        `CREATE CONSTRAINT issue_id_unique IF NOT EXISTS FOR (i:Issue) REQUIRE i.issue_id IS UNIQUE`,
        `CREATE CONSTRAINT result_id_unique IF NOT EXISTS FOR (er:ElectionResult) REQUIRE er.result_id IS UNIQUE`,
        `CREATE CONSTRAINT turnout_id_unique IF NOT EXISTS FOR (t:Turnout) REQUIRE t.turnout_id IS UNIQUE`,
        `CREATE CONSTRAINT alliance_id_unique IF NOT EXISTS FOR (a:Alliance) REQUIRE a.alliance_id IS UNIQUE`,
        `CREATE CONSTRAINT scheme_id_unique IF NOT EXISTS FOR (sd:SchemeDelivery) REQUIRE sd.delivery_id IS UNIQUE`,
        `CREATE CONSTRAINT affidavit_id_unique IF NOT EXISTS FOR (aff:Affidavit) REQUIRE aff.affidavit_id IS UNIQUE`,
        `CREATE CONSTRAINT classification_id_unique IF NOT EXISTS FOR (sc:SeatClassification) REQUIRE sc.classification_id IS UNIQUE`,
        `CREATE CONSTRAINT observation_id_unique IF NOT EXISTS FOR (io:IssueObservation) REQUIRE io.observation_id IS UNIQUE`,
        `CREATE CONSTRAINT recommendation_id_unique IF NOT EXISTS FOR (dr:DecisionRecommendation) REQUIRE dr.recommendation_id IS UNIQUE`,
        `CREATE CONSTRAINT bundle_id_unique IF NOT EXISTS FOR (eb:EvidenceBundle) REQUIRE eb.bundle_id IS UNIQUE`,
        `CREATE CONSTRAINT topic_id_unique IF NOT EXISTS FOR (mt:MediaTopic) REQUIRE mt.topic_id IS UNIQUE`,
        `CREATE CONSTRAINT rule_id_unique IF NOT EXISTS FOR (rd:RuleDefinition) REQUIRE rd.rule_id IS UNIQUE`,
        `CREATE CONSTRAINT state_code_unique IF NOT EXISTS FOR (s:State) REQUIRE s.state_code IS UNIQUE`,
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
// STEP 1b: Create State node
// ============================================================
async function createStateNode() {
    console.log('\n=== Step 1b: Creating State Node ===');
    const stateConfigPath = path.join(DATA_DIR, 'states', 'up.json');
    const config = JSON.parse(fs.readFileSync(stateConfigPath, 'utf8'));
    const session = driver.session();
    try {
        await session.run(
            `MERGE (s:State {state_code: $state_code})
             SET s.state_name = $state_name,
                 s.state_name_hi = $state_name_hi,
                 s.ls_seat_count = $ls_seat_count,
                 s.vs_seat_count = $vs_seat_count,
                 s.source = 'ECI',
                 s.source_date = '2026-05-03',
                 s.confidence = 'high'`,
            {
                state_code: config.state_code,
                state_name: config.state_name,
                state_name_hi: config.state_name_hi,
                ls_seat_count: neo4j.int(config.ls_seat_count),
                vs_seat_count: neo4j.int(config.vs_seat_count),
            }
        );
        console.log(`  ✓ State node: ${config.state_name} (${config.state_code})`);
    } finally {
        await session.close();
    }
}

// ============================================================
// STEP 2: Create District nodes
// ============================================================
async function importDistricts() {
    console.log('\n=== Step 2: Importing Districts ===');

    const session = driver.session();
    const nodeProvenance = buildNodeProvenance('IMPORT_SEED', '2026-05-03', null, 'medium');
    const lsDistrictMap = getLSDistrictMap();
    const districtNames = [...new Set(Object.values(lsDistrictMap))].sort();

    let districtSamples = new Map();
    const indiaDataPath = path.join(DATA_DIR, 'india_data.json');
    if (fs.existsSync(indiaDataPath)) {
        try {
            const indiaData = JSON.parse(fs.readFileSync(indiaDataPath, 'utf8'));
            const upDistricts = indiaData?.['Uttar Pradesh']?.districts;
            if (Array.isArray(upDistricts)) {
                districtSamples = new Map(
                    upDistricts
                        .filter((row) => row && row.name)
                        .map((row) => [String(row.name).trim().toLowerCase(), row])
                );
            }
        } catch (err) {
            console.warn('  ! Could not parse india_data.json for district enrichment:', err.message);
        }
    }
const regionMap = {
    'western': [
        'Saharanpur', 'Muzaffarnagar', 'Shamli', 'Baghpat', 'Meerut', 'Ghaziabad', 
        'Hapur', 'Gautam Buddha Nagar', 'Bulandshahr', 'Aligarh', 'Hathras', 'Mathura', 
        'Agra', 'Firozabad', 'Etah', 'Kasganj', 'Mainpuri', 'Etawah', 'Auraiya', 
        'Kannauj', 'Farrukhabad', 'Bijnor', 'Amroha', 'Moradabad', 'Rampur', 'Sambhal'
    ],
    'central': [
        'Lucknow', 'Kanpur Nagar', 'Kanpur Dehat', 'Unnao', 'Sitapur', 'Rae Bareli', 
        'Hardoi', 'Lakhimpur Kheri', 'Barabanki', 'Fatehpur'
    ],
    'eastern': [
        'Varanasi', 'Gorakhpur', 'Azamgarh', 'Prayagraj', 'Ghazipur', 'Ballia', 
        'Jaunpur', 'Mirzapur', 'Chandauli', 'Sonbhadra', 'Bhadohi', 'Deoria', 
        'Kushinagar', 'Mau', 'Maharajganj', 'Siddharthnagar', 'Basti', 'Sant Kabir Nagar', 
        'Amethi', 'Sultanpur', 'Ayodhya', 'Ambedkar Nagar', 'Gonda', 'Bahraich', 
        'Shravasti', 'Balrampur', 'Pratapgarh', 'Kaushambi'
    ],
    'bundelkhand': [
        'Jhansi', 'Jalaun', 'Hamirpur', 'Banda', 'Chitrakoot', 'Mahoba', 'Lalitpur'
    ]
};

try {
    for (let index = 0; index < districtNames.length; index++) {
        const name = districtNames[index];
        const sample = districtSamples.get(name.toLowerCase()) || {};

        // Find region
        let region = 'other';
        for (const [r, dists] of Object.entries(regionMap)) {
            if (dists.includes(name)) {
                region = r;
                break;
            }
        }

        await session.run(
            `MERGE (d:District {district_id: $district_id})
             SET d.name = $name,
                 d.state = 'Uttar Pradesh',
                 d.region = $region,
                 d.census_year = 2011,
                 d.total_population = $total_population,
                     d.total_male = $total_male,
                     d.total_female = $total_female,
                     d.rural_population = $rural_population,
                     d.urban_population = $urban_population,
                     d.hindu_population = $hindu_population,
                     d.muslim_population = $muslim_population,
                     d.christian_population = $christian_population,
                     d.sikh_population = $sikh_population,
                     d.buddhist_population = $buddhist_population,
                     d.jain_population = $jain_population,
                     d.never_married_pop = $never_married_pop,
                     d.married_population = $married_population,
                     d.widowed_pop = $widowed_pop,
                     d.migrant_population = $migrant_population,
                     d.bilingual_population = $bilingual_population,
                     d.trilingual_population = $trilingual_population,
                     d.youth_population = $youth_population,
                     d.working_age_pop = $working_age_pop,
                     d.senior_population = $senior_population,
                     d.total_women = $total_women,
                     d.ever_married_women = $ever_married_women,
                     d.literacy_rate = $literacy_rate,
                     d.sex_ratio = $sex_ratio,
                     d.source = $source,
                     d.source_date = date($source_date),
                     d.ingested_at = datetime($ingested_at),
                     d.confidence = $confidence,
                     d.sample_politician = $sample_politician,
                     d.sample_years = $sample_years`,
                {
                    district_id: `UP-DIST-${String(index + 1).padStart(2, '0')}`,
                    name,
                    region,
                    total_population: sample.total_population || null,
                    total_male: sample.total_male || null,
                    total_female: sample.total_female || null,
                    rural_population: sample.rural_population || null,
                    urban_population: sample.urban_population || null,
                    hindu_population: sample.hindu_population || null,
                    muslim_population: sample.muslim_population || null,
                    christian_population: sample.christian_population || null,
                    sikh_population: sample.sikh_population || null,
                    buddhist_population: sample.buddhist_population || null,
                    jain_population: sample.jain_population || null,
                    never_married_pop: sample.never_married_pop || null,
                    married_population: sample.married_population || null,
                    widowed_pop: sample.widowed_pop || null,
                    migrant_population: sample.migrant_population || null,
                    bilingual_population: sample.bilingual_population || null,
                    trilingual_population: sample.trilingual_population || null,
                    youth_population: sample.youth_population || null,
                    working_age_pop: sample.working_age_pop || null,
                    senior_population: sample.senior_population || null,
                    total_women: sample.total_women || null,
                    ever_married_women: sample.ever_married_women || null,
                    literacy_rate: sample.literacy_rate || null,
                    sex_ratio: sample.sex_ratio || null,
                    source: nodeProvenance.source,
                    source_date: nodeProvenance.source_date,
                    ingested_at: nodeProvenance.ingested_at,
                    confidence: nodeProvenance.confidence,
                    sample_politician: sample.politician || null,
                    sample_years: sample.years || null,
                }
            );
        }
        console.log(`  ✓ Created ${districtNames.length} District nodes`);
    } finally {
        await session.close();
    }
}

// ============================================================
// STEP 3: Create LokSabha + VidhanSabha constituencies
// ============================================================
async function importConstituencies() {
    console.log('\n=== Step 3: Importing Constituencies ===');

    const mappingPath = path.join(DATA_DIR, 'mappings', 'up_ls_vs_mapping.json');
    if (!fs.existsSync(mappingPath)) {
        console.log('  ✗ Mapping file not found, skipping');
        return;
    }

    const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    const session = driver.session();
    const nodeProvenance = buildNodeProvenance('ECI_DELIMITATION_2008', '2008-01-01');
    const relProvenance = buildRelProvenance('ECI_DELIMITATION_2008', '2008-01-01');

    try {
        // Create Parties first
        const parties = [
            { party_id: 'bjp', name: 'Bharatiya Janata Party', symbol: 'Lotus', type: 'NATIONAL' },
            { party_id: 'sp', name: 'Samajwadi Party', symbol: 'Cycle', type: 'STATE' },
            { party_id: 'bsp', name: 'Bahujan Samaj Party', symbol: 'Elephant', type: 'NATIONAL' },
            { party_id: 'inc', name: 'Indian National Congress', symbol: 'Hand', type: 'NATIONAL' },
            { party_id: 'apd', name: 'Apna Dal (Soneylal)', symbol: 'Banana', type: 'STATE' },
            { party_id: 'rlsp', name: 'Rashtriya Lok Samta Party', symbol: 'Clock', type: 'STATE' },
            { party_id: 'ajsp', name: 'Azad Samaj Party', symbol: 'Spectacles', type: 'STATE' },
            { party_id: 'other', name: 'Others', symbol: '', type: 'REGISTERED' },
        ];

        for (const p of parties) {
            await session.run(
                `MERGE (p:Party {party_id: $party_id})
                 SET p.name = $name,
                     p.symbol = $symbol,
                     p.type = $type,
                     p.source = $source,
                     p.source_date = date($source_date),
                     p.ingested_at = datetime($ingested_at),
                     p.confidence = $confidence`,
                { 
                    ...p, 
                    source: 'ECI_PARTY_REGISTER', 
                    source_date: nodeProvenance.source_date,
                    ingested_at: nodeProvenance.ingested_at,
                    confidence: 'high'
                }
            );
        }
        console.log(`  ✓ Created ${parties.length} parties`);

        // Create LS constituencies
        let lsCount = 0;
        for (const ls of mapping.lok_sabha_constituencies) {
            const lsNode = { ...ls, ...nodeProvenance };
            validateLS(lsNode, `LS: ${ls.name}`);

            await session.run(
                `MERGE (ls:Constituency:LokSabhaConstituency {ls_id: $ls_id})
                 SET ls.name = $name,
                     ls.reservation = $reservation,
                     ls.ls_no = $ls_no,
                     ls.state_code = $state_code,
                     ls.source = $source,
                     ls.source_date = date($source_date),
                     ls.ingested_at = datetime($ingested_at),
                     ls.confidence = $confidence`,
                { ...lsNode, state_code: STATE_CODE }
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
                const vsReservation = 'GEN'; // Corrected: default to GEN, don't inherit LS reservation

                const vsNode = {
                    vs_id: vsId,
                    name: vsName,
                    reservation: vsReservation,
                    ls_id: ls.ls_id,
                    ...nodeProvenance
                };
                validateProvenance(vsNode, 'VidhanSabhaConstituency', `VS: ${vsName}`);

                await session.run(
                    `MERGE (vs:Constituency:VidhanSabhaConstituency {vs_id: $vs_id})
                     SET vs.name = $name,
                         vs.reservation = $reservation,
                         vs.ls_id = $ls_id,
                         vs.state_code = $state_code,
                         vs.source = $source,
                         vs.source_date = date($source_date),
                         vs.ingested_at = datetime($ingested_at),
                         vs.confidence = $confidence
                     WITH vs
                     MATCH (ls:LokSabhaConstituency {ls_id: $ls_id})
                     MERGE (ls)-[:HAS_VS {
                        source: $rel_source,
                        source_date: date($rel_source_date),
                        confidence: $rel_confidence
                     }]->(vs)`,
                    {
                        ...vsNode,
                        state_code: STATE_CODE,
                        rel_source: relProvenance.source,
                        rel_source_date: relProvenance.source_date,
                        rel_confidence: relProvenance.confidence,
                    }
                );
                vsCount++;
                vsLinkCount++;
            }
        }
        console.log(`  ✓ Created ${vsCount} Vidhan Sabha constituencies`);
        console.log(`  ✓ Created ${vsLinkCount} LS→VS links`);

        const lsDistrictMap = getLSDistrictMap();

        let districtLinkCount = 0;
        for (const [lsId, districtName] of Object.entries(lsDistrictMap)) {
            const result = await session.run(
                `MATCH (ls:LokSabhaConstituency {ls_id: $ls_id})
                 MATCH (d:District {name: $district_name})
                 MERGE (d)-[:CONTAINS {
                    source: $source,
                    source_date: date($source_date),
                    confidence: $confidence
                 }]->(ls)
                 RETURN count(*) AS created`,
                { ls_id: lsId, district_name: districtName, ...relProvenance }
            );
            if (result.records[0]?.get('created')?.toNumber() > 0) {
                districtLinkCount++;
            }
        }
        console.log(`  ✓ Created ${districtLinkCount} District→LS links`);

        // Link all constituencies to State node
        const stateResult = await session.run(
            `MATCH (s:State {state_code: $stateCode})
             MATCH (ls:LokSabhaConstituency {state_code: $stateCode})
             MERGE (ls)-[:BELONGS_TO_STATE]->(s)
             WITH s
             MATCH (vs:VidhanSabhaConstituency {state_code: $stateCode})
             MERGE (vs)-[:BELONGS_TO_STATE]->(s)
             RETURN count(*) AS linked`,
            { stateCode: STATE_CODE }
        );
        console.log(`  ✓ Linked constituencies to State node`);

    } finally {
        await session.close();
    }
}

// ============================================================
// STEP 4: Import elections
// ============================================================
async function importElections() {
    console.log('\n=== Step 4: Importing Elections ===');

    const electionsPath = path.join(DATA_DIR, 'eci', 'elections.json');
    if (!fs.existsSync(electionsPath)) {
        console.log('  ✗ Elections file not found, skipping');
        return;
    }

    const elections = JSON.parse(fs.readFileSync(electionsPath, 'utf8'));
    const session = driver.session();
    const nodeProvenance = buildNodeProvenance('ECI', '2019-01-01');

    try {
        for (const e of elections) {
            const electionType = String(e.type || '').toLowerCase().includes('vidhan') ? 'VS' : 'LS';
            const phaseCount = Number.parseInt(String(e.phase || '').replace(/\D+/g, ''), 10) || null;
            await session.run(
                `MERGE (e:Election {election_id: $election_id})
                 SET e.type = $type,
                     e.year = $year,
                     e.phase_count = $phase_count,
                     e.state = 'Uttar Pradesh',
                     e.source = $source,
                     e.source_date = date($source_date),
                     e.ingested_at = datetime($ingested_at),
                     e.confidence = $confidence`,
                {
                    election_id: e.election_id,
                    type: electionType,
                    year: e.year,
                    phase_count: phaseCount,
                    source: nodeProvenance.source,
                    source_date: '2019-01-01', // Default for LS2019/VS2022
                    ingested_at: nodeProvenance.ingested_at,
                    confidence: nodeProvenance.confidence,
                }
            );
        }
        console.log(`  ✓ Created ${elections.length} election nodes`);

        // Create alliances
        const alliances = [
            { alliance_id: 'nda_2024', name: 'NDA', election_id: 'LS2024', parties: ['bjp', 'apd'] },
            { alliance_id: 'india_bloc_2024', name: 'INDIA Bloc', election_id: 'LS2024', parties: ['sp', 'inc', 'ajsp'] },
            { alliance_id: 'non_aligned_2024', name: 'Non-Aligned', election_id: 'LS2024', parties: ['bsp', 'rlsp'] },
        ];

        for (const a of alliances) {
            await session.run(
                `MERGE (a:Alliance {alliance_id: $alliance_id})
                 SET a.name = $name,
                     a.election_id = $election_id,
                     a.source = $source,
                     a.ingested_at = datetime($ingested_at)
                 WITH a
                 UNWIND $parties AS pid
                 MATCH (p:Party {party_id: pid})
                 MERGE (p)-[:PART_OF_ALLIANCE {
                    election_id: $election_id,
                    source: $source,
                    source_date: date($source_date),
                    confidence: $confidence
                 }]->(a)`,
                {
                    ...a,
                    source: nodeProvenance.source,
                    source_date: nodeProvenance.source_date,
                    ingested_at: nodeProvenance.ingested_at,
                    confidence: nodeProvenance.confidence,
                }
            );
        }
        console.log(`  ✓ Created ${alliances.length} alliances with party links`);
    } finally {
        await session.close();
    }
}

// ============================================================
// STEP 5: Import issue dictionary
// ============================================================
async function importIssues() {
    console.log('\n=== Step 5: Importing Issues ===');

    const session = driver.session();
    const nodeProvenance = buildNodeProvenance('PRD_SEED', '2026-05-03', null, 'medium');

    try {
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
                 SET iss.name = $name,
                     iss.category = $category,
                     iss.source = $source,
                     iss.ingested_at = datetime($ingested_at)`,
                { ...i, source: nodeProvenance.source, ingested_at: nodeProvenance.ingested_at }
            );
        }
        console.log(`  ✓ Created ${issues.length} issue nodes`);

    } finally {
        await session.close();
    }
}

// ============================================================
// STEP 6: Import 2019 LS constituency results into Neo4j
// ============================================================
async function importConstituencyResults() {
    console.log('\n=== Step 6: Importing 2019 LS Constituency Results ===');

    const resultsPath = path.join(__dirname, '..', STATE_CONFIG.data_files.ls2019_constituency_results.replace('.csv', '.json'));
    if (!fs.existsSync(resultsPath)) {
        console.log(`  ✗ ${STATE_CODE} 2019 results file not found at ${resultsPath}`);
        console.log('  → Run: node scripts/extract_up_data.js first');
        return;
    }

    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    const session = driver.session();
    const nodeProvenance = buildNodeProvenance('ECI_2019', '2019-05-23');
    const relProvenance = buildRelProvenance('ECI_2019', '2019-05-23');

    try {
        await session.run(
            `MATCH (c:Candidate {election_id: 'LS2019'})
             DETACH DELETE c`
        );
        await session.run(
            `MATCH (er:ElectionResult {election_id: 'LS2019'})
             DETACH DELETE er`
        );

        let candidateCount = 0;
        let resultCount = 0;

        for (const pc of results) {
            const lsId = `UP-${pc.pc_code}`;

            const electionId = 'LS2019';
            const sortedResults = [...pc.results].sort((a, b) => b.total_votes - a.total_votes);
            const votesJson = sortedResults.map(r => ({
                candidate: r.candidate,
                party: r.party,
                total_votes: r.total_votes,
                evm_votes: r.evm_votes,
                postal_votes: r.postal_votes
            }));

            const totalValidVotes = votesJson.reduce((sum, v) => sum + v.total_votes, 0);
            const winner = sortedResults[0];
            const runnerUp = sortedResults[1] || null;
            const notaRow = sortedResults.find((row) => String(row.party).trim().toLowerCase() === 'none of the above');
            const marginVotes = runnerUp ? winner.total_votes - runnerUp.total_votes : winner.total_votes;
            const marginPct = totalValidVotes > 0 ? (marginVotes / totalValidVotes) * 100 : null;
            const winnerVoteShare = totalValidVotes > 0 ? (winner.total_votes / totalValidVotes) * 100 : null;

            for (let index = 0; index < sortedResults.length; index++) {
                const candidate = sortedResults[index];
                const partyId = toPartyId(candidate.party);
                const safeCandidateName = candidate.candidate.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
                const safeCandId = `CAND_LS2019_PC${pc.pc_code}_${safeCandidateName}_${partyId}_${index + 1}`;
                const voteShare = totalValidVotes > 0 ? (candidate.total_votes / totalValidVotes) * 100 : null;

                const candNode = {
                    cand_id: safeCandId,
                    candidate_name: candidate.candidate,
                    party_id: partyId,
                    election_id: electionId,
                    ls_id: lsId,
                    votes: candidate.total_votes,
                    vote_share: voteShare,
                    rank: index + 1,
                    gender: null, // Set to null as it's not in the 2019 result file
                    source: nodeProvenance.source,
                    source_url: `ECI_FORM20_LS2019_PC${pc.pc_code}`,
                    source_date: nodeProvenance.source_date,
                    ingested_at: nodeProvenance.ingested_at,
                    confidence: nodeProvenance.confidence,
                };
                validateCandidate({ ...candNode, name: candNode.candidate_name }, `Candidate: ${candidate.candidate}`);

                await session.run(
                    `MERGE (c:Candidate {cand_id: $cand_id})
                     SET c.name = $candidate_name,
                         c.party_id = $party_id,
                         c.election_id = $election_id,
                         c.constituency_id = $ls_id,
                         c.votes = $votes,
                         c.vote_share = $vote_share,
                         c.rank = $rank,
                         c.gender = $gender,
                         c.source = $source,
                         c.source_url = $source_url,
                         c.source_date = date($source_date),
                         c.ingested_at = datetime($ingested_at),
                         c.confidence = $confidence
                     WITH c
                     MATCH (ls:LokSabhaConstituency {ls_id: $ls_id})
                     MERGE (c)-[:CONTESTS_IN {
                        election_id: $election_id,
                        vote_share: $vote_share,
                        rank: $rank,
                        source: $rel_source,
                        source_date: date($rel_source_date),
                        confidence: $rel_confidence
                     }]->(ls)
                     WITH c
                     OPTIONAL MATCH (p:Party {party_id: $party_id})
                     FOREACH (_ IN CASE WHEN p IS NULL THEN [] ELSE [1] END |
                        MERGE (c)-[:BELONGS_TO {
                            since_year: 2019,
                            source: $rel_source,
                            source_date: date($rel_source_date),
                            confidence: $rel_confidence
                        }]->(p)
                     )`,
                    {
                        ...candNode,
                        rel_source: relProvenance.source,
                        rel_source_date: relProvenance.source_date,
                        rel_confidence: relProvenance.confidence,
                    }
                );
                candidateCount++;
            }

            // Create an ElectionResult node at constituency level
            const resultNode = {
                ls_id: lsId,
                election_id: electionId,
                result_id: `LS2019_PC${pc.pc_code}`,
                votes_json: JSON.stringify(votesJson),
                winner: winner.candidate,
                winner_party_id: toPartyId(winner.party),
                winner_votes: winner.total_votes,
                winner_vote_share: winnerVoteShare,
                runner_up: runnerUp ? runnerUp.candidate : null,
                runner_up_party_id: runnerUp ? toPartyId(runnerUp.party) : null,
                runner_up_votes: runnerUp ? runnerUp.total_votes : null,
                margin_votes: marginVotes,
                margin_pct: marginPct,
                total_valid_votes: totalValidVotes,
                nota_votes: notaRow ? notaRow.total_votes : null,
                source: nodeProvenance.source,
                source_url: `ECI_FORM20_LS2019_PC${pc.pc_code}`,
                source_date: nodeProvenance.source_date,
                ingested_at: nodeProvenance.ingested_at,
                confidence: nodeProvenance.confidence,
            };
            validateElectionResult({ ...resultNode, constituency_id: resultNode.ls_id }, `Result: ${lsId}`);

            await session.run(
                `MATCH (ls:LokSabhaConstituency {ls_id: $ls_id})
                 MERGE (er:ElectionResult {result_id: $result_id})
                 SET er.election_id = $election_id,
                     er.constituency_id = $ls_id,
                     er.all_candidates_json = $votes_json,
                     er.winner = $winner,
                     er.winner_party_id = $winner_party_id,
                     er.winner_votes = $winner_votes,
                     er.winner_vote_share = $winner_vote_share,
                     er.runner_up = $runner_up,
                     er.runner_up_party_id = $runner_up_party_id,
                     er.runner_up_votes = $runner_up_votes,
                     er.margin_votes = $margin_votes,
                     er.margin_pct = $margin_pct,
                     er.total_valid_votes = $total_valid_votes,
                     er.nota_votes = $nota_votes,
                     er.source = $source,
                     er.source_url = $source_url,
                     er.source_date = date($source_date),
                     er.ingested_at = datetime($ingested_at),
                     er.confidence = $confidence
                 MERGE (ls)-[:HAS_RESULT {
                    election_id: $election_id,
                    source: $rel_source,
                    source_date: date($rel_source_date),
                    confidence: $rel_confidence
                 }]->(er)`,
                {
                    ...resultNode,
                    rel_source: relProvenance.source,
                    rel_source_date: relProvenance.source_date,
                    rel_confidence: relProvenance.confidence,
                }
            );
            resultCount++;
        }

        console.log(`  ✓ Created ${candidateCount} candidate nodes`);
        console.log(`  ✓ Created ${resultCount} election result nodes`);

    } finally {
        await session.close();
    }
}

// ============================================================
// STEP 7: Import turnout
// ============================================================
async function importTurnout() {
    console.log('\n=== Step 7: Importing Turnout ===');

    const stateDataDir = path.join(__dirname, '..', STATE_CONFIG.data_dir);
    const candidatePaths = [
        path.join(stateDataDir, 'ls2019_turnout.json'),
        path.join(DATA_DIR, 'manual', `${STATE_CODE.toLowerCase()}_ls2019_turnout.json`),
    ];
    const turnoutPath = candidatePaths.find((filePath) => fs.existsSync(filePath));

    if (!turnoutPath) {
        console.log('  ! No turnout source file found. Skipping Turnout import.');
        console.log(`  ! Expected: ${candidatePaths[0]}`);
        return;
    }

    const rows = JSON.parse(fs.readFileSync(turnoutPath, 'utf8'));
    const session = driver.session();
    let imported = 0;

    try {
        await session.run(
            `MATCH (t:Turnout {election_id: 'LS2019'})
             DETACH DELETE t`
        );

        for (const row of rows) {
            const pcCode = row.pc_code ?? row.ls_no ?? row.pc_no;
            if (pcCode == null || row.registered_voters == null) {
                console.log(`  ! Skipping turnout row with missing constituency code or registered_voters: ${JSON.stringify(row)}`);
                continue;
            }

            const lsId = row.ls_id || `UP-${pcCode}`;
            const turnoutId = row.turnout_id || `TURNOUT_LS2019_PC${pcCode}`;
            const source = row.source || 'ECI_ROLLS';
            const sourceDate = row.source_date || '2019-05-23';
            const sourceUrl = row.source_url || null;

            await session.run(
                `MATCH (ls:LokSabhaConstituency {ls_id: $ls_id})
                 OPTIONAL MATCH (ls)-[:HAS_RESULT {election_id: 'LS2019'}]->(er:ElectionResult)
                 MERGE (t:Turnout {turnout_id: $turnout_id})
                 SET t.election_id = 'LS2019',
                     t.constituency_id = $ls_id,
                     t.registered_voters = toInteger($registered_voters),
                     t.votes_cast = toInteger($votes_cast),
                     t.turnout_pct = $turnout_pct,
                     t.source = $source,
                     t.source_url = $source_url,
                     t.source_date = date($source_date),
                     t.ingested_at = datetime($ingested_at),
                     t.confidence = $confidence
                 MERGE (ls)-[:HAS_TURNOUT {
                    election_id: 'LS2019',
                    source: $source,
                    source_date: date($source_date),
                    confidence: $confidence
                 }]->(t)`,
                {
                    turnout_id: turnoutId,
                    ls_id: lsId,
                    registered_voters: Number(row.registered_voters),
                    votes_cast: Number(
                        row.votes_cast ??
                        row.total_votes_cast ??
                        row.total_valid_votes ??
                        row.valid_votes ??
                        0
                    ),
                    turnout_pct: row.turnout_pct != null
                        ? Number(row.turnout_pct)
                        : (
                            Number(row.registered_voters) > 0
                                ? (Number(
                                    row.votes_cast ??
                                    row.total_votes_cast ??
                                    row.total_valid_votes ??
                                    row.valid_votes ??
                                    0
                                ) / Number(row.registered_voters)) * 100
                                : null
                        ),
                    source,
                    source_url: sourceUrl,
                    source_date: sourceDate,
                    ingested_at: new Date().toISOString(),
                    confidence: row.confidence || 'high',
                }
            );
            imported++;
        }

        console.log(`  ✓ Created ${imported} Turnout nodes`);
    } finally {
        await session.close();
    }
}

// ============================================================
// STEP 8: Import affidavits
// ============================================================
async function importAffidavits() {
    console.log('\n=== Step 8: Importing Affidavits ===');

    const stateDataDir = path.join(__dirname, '..', STATE_CONFIG.data_dir);
    const affPath = fs.existsSync(path.join(stateDataDir, 'ls2019_affidavits.csv'))
        ? path.join(stateDataDir, 'ls2019_affidavits.csv')
        : path.join(DATA_DIR, 'manual', `${STATE_CODE.toLowerCase()}_ls2019_affidavits.csv`);
    if (!fs.existsSync(affPath)) {
        console.log('  ! Affidavit source file not found. Skipping.');
        return;
    }

    const session = driver.session();
    let imported = 0;

    try {
        // Read CSV logic (simplified for this script's style)
        const content = fs.readFileSync(affPath, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',').map(h => h.trim());

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            headers.forEach((h, idx) => { row[h] = values[idx]; });

            const candName = row['Candidate'];
            const pcCode   = row['Constituency_No'];
            const partyId  = toPartyId(row['Party']);

            if (!candName || !pcCode) continue;

            // Use the same ID logic as importConstituencyResults
            const safeCandidateName = candName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
            const candId = `CAND_LS2019_PC${pcCode}_${safeCandidateName}_${partyId}_1`; // Assuming winner/primary for now

            const affId = `AFF_LS2019_${candId}`;

            const affNode = {
                affidavit_id: affId,
                cand_id: candId,
                election_id: 'LS2019',
                criminal_cases: parseInt(row['Criminal_Case']) || 0,
                serious_cases: parseInt(row['Serious_IPC']) || 0,
                total_assets_cr: parseFloat(row['Assets']) || 0,
                education: row['Education'] || null,
                source: 'MyNeta_ADR',
                source_date: '2019-05-23',
                confidence: 'high'
            };
            validateAffidavit(affNode, `Affidavit: ${candName}`);

            await session.run(
                `MATCH (c:Candidate {cand_id: $cand_id})
                 MERGE (aff:Affidavit {affidavit_id: $affidavit_id})
                 SET aff.cand_id = $cand_id,
                     aff.election_id = $election_id,
                     aff.criminal_cases = toInteger($criminal_cases),
                     aff.serious_cases = toInteger($serious_cases),
                     aff.total_assets_cr = toFloat($total_assets_cr),
                     aff.education = $education,
                     aff.source = $source,
                     aff.source_date = date($source_date),
                     aff.ingested_at = datetime(),
                     aff.confidence = $confidence
                 MERGE (c)-[:HAS_AFFIDAVIT {election_id: $election_id}]->(aff)`,
                {
                    ...affNode,
                    ingested_at: datetime() // handled in Cypher
                }
            );
            imported++;
        }
        console.log(`  ✓ Created ${imported} Affidavit nodes`);
    } catch (err) {
        console.log(`  ! Error importing affidavits: ${err.message}`);
    } finally {
        await session.close();
    }
}

// ============================================================
// STEP 9: Import rule definitions
// ============================================================
async function importRules() {
    console.log('\n=== Step 9: Seeding Rule Definitions ===');
    const session = driver.session();
    try {
        const rules = [
            {
                rule_id: 'RULE_V1_SEAT_STATUS',
                name: 'Seat Priority Classification',
                version: '1.0.0',
                logic: "CASE WHEN margin_pct < 2 THEN 'tossup' WHEN margin_pct < 5 THEN 'competitive' ELSE 'safe' END",
                output_property: 'seat_status'
            },
            {
                rule_id: 'RULE_V1_CANDIDATE_RISK',
                name: 'Candidate Risk Flagging',
                version: '1.0.0',
                logic: "CASE WHEN criminal_cases > 3 THEN 'multiple_cases' WHEN serious_cases > 0 THEN 'serious_cases_flagged' ELSE 'clean' END",
                output_property: 'candidate_risk'
            },
            {
                rule_id: 'RULE_V1_DELIVERY_STATUS',
                name: 'Scheme Delivery Classification',
                version: '1.0.0',
                logic: "CASE WHEN coverage_pct < 30 THEN 'critical_gap' WHEN coverage_pct < 60 THEN 'partial' ELSE 'delivered' END",
                output_property: 'delivery_status'
            },
            {
                rule_id: 'RULE_V1_REC_CADRE',
                name: 'Cadre Strengthening Trigger',
                version: '1.0.0',
                logic: "IF seat_status IN ['competitive','tossup'] AND delivery_status IN ['critical_gap','partial']",
                output_property: 'CADRE_STRENGTHEN'
            },
            {
                rule_id: 'RULE_V1_ORG_STATUS',
                name: 'Organisation Health Classification',
                version: '1.0.0',
                logic: "CASE WHEN booth_coverage_pct >= 90 THEN 'strong' WHEN booth_coverage_pct >= 60 THEN 'moderate' ELSE 'weak' END",
                output_property: 'org_status'
            },
            {
                rule_id: 'RULE_V1_LEADERSHIP_VISIT',
                name: 'Leadership Visit Priority Trigger',
                version: '1.0.0',
                logic: "IF seat_status IN ['tossup','competitive'] AND (org_status = 'weak' OR sentiment_trending = 'declining')",
                output_property: 'LEADERSHIP_VISIT'
            }
        ];

        for (const r of rules) {
            await session.run(
                `MERGE (rd:RuleDefinition {rule_id: $rule_id})
                 SET rd.name = $name,
                     rd.version = $version,
                     rd.logic_expression = $logic,
                     rd.output_property = $output_property,
                     rd.source = 'PRD_V1_INTERNAL',
                     rd.source_date = date('2026-05-03'),
                     rd.ingested_at = datetime(),
                     rd.confidence = 'high'`,
                r
            );
        }
        console.log(`  ✓ Seeded ${rules.length} RuleDefinition nodes`);
    } catch (err) {
        console.log(`  ! Error seeding rules: ${err.message}`);
    } finally {
        await session.close();
    }
}

// ============================================================
// STEP 10: Governance — Scheme + SchemeDelivery nodes
// ============================================================
async function importSchemes() {
    console.log('\n=== Step 10: Importing Schemes + Delivery Stubs ===');
    const session = driver.session();
    const nodeProvenance = buildNodeProvenance('GOVT_INDIA', '2026-05-03', null, 'medium');

    try {
        const schemes = [
            { scheme_id: 'PM_AWAS_YOJANA', name: 'PM Awas Yojana (Gramin)',   ministry: 'Ministry of Rural Development', target_group: 'BPL households',   launch_year: 2016 },
            { scheme_id: 'MGNREGA',         name: 'Mahatma Gandhi NREGS',       ministry: 'Ministry of Rural Development', target_group: 'Rural wage-seekers', launch_year: 2005 },
            { scheme_id: 'PM_KISAN',         name: 'PM Kisan Samman Nidhi',     ministry: 'Ministry of Agriculture',       target_group: 'Small farmers',      launch_year: 2019 },
            { scheme_id: 'UJJWALA',          name: 'PM Ujjwala Yojana',         ministry: 'Ministry of Petroleum',         target_group: 'BPL women',          launch_year: 2016 },
        ];

        for (const s of schemes) {
            await session.run(
                `MERGE (sc:Scheme {scheme_id: $scheme_id})
                 SET sc.name = $name, sc.ministry = $ministry,
                     sc.target_group = $target_group, sc.launch_year = $launch_year,
                     sc.source = $source, sc.source_date = date($source_date),
                     sc.ingested_at = datetime($ingested_at)`,
                { ...s, ...nodeProvenance }
            );
        }
        console.log(`  ✓ Created ${schemes.length} Scheme nodes`);

        // Seed SchemeDelivery stubs per constituency using UP state averages (NFHS-5)
        // Real per-constituency data must replace these when sourced from government portals
        const deliveryDefaults = {
            PM_AWAS_YOJANA: { coverage_pct: 61, delivery_status: 'partial' },
            MGNREGA:         { coverage_pct: 54, delivery_status: 'partial' },
            PM_KISAN:        { coverage_pct: 72, delivery_status: 'partial' },
            UJJWALA:         { coverage_pct: 68, delivery_status: 'partial' },
        };

        const constResult = await session.run(`MATCH (ls:LokSabhaConstituency) RETURN ls.ls_id AS ls_id`);
        let deliveryCount = 0;

        for (const rec of constResult.records) {
            const ls_id = rec.get('ls_id');
            for (const [scheme_id, defaults] of Object.entries(deliveryDefaults)) {
                const delivery_id = `DEL-${ls_id}-${scheme_id}`;
                await session.run(
                    `MERGE (sd:SchemeDelivery {delivery_id: $delivery_id})
                     SET sd.constituency_id  = $ls_id,
                         sd.scheme_id        = $scheme_id,
                         sd.coverage_pct     = $coverage_pct,
                         sd.delivery_status  = $delivery_status,
                         sd.data_quality     = 'estimated',
                         sd.source           = 'NFHS5_UP_AVERAGE',
                         sd.source_date      = date('2021-12-01'),
                         sd.ingested_at      = datetime()
                     WITH sd
                     MATCH (ls:LokSabhaConstituency {ls_id: $ls_id})
                     MATCH (sc:Scheme {scheme_id: $scheme_id})
                     MERGE (ls)-[:HAS_DELIVERY]->(sd)
                     MERGE (sc)-[:DELIVERED_IN]->(sd)`,
                    { delivery_id, ls_id, scheme_id, ...defaults }
                );
                deliveryCount++;
            }
        }
        console.log(`  ✓ Seeded ${deliveryCount} SchemeDelivery stubs (UP state averages — replace with real data)`);

    } catch (err) {
        console.log(`  ! Error importing schemes: ${err.message}`);
    } finally {
        await session.close();
    }
}

// ============================================================
// STEP 11: Decision — evaluate RULE_V1_SEAT_STATUS → SeatClassification
// NOTE: Reads ElectionResult nodes created by import_tcpd.js.
//       If run before import_tcpd.js, 0 nodes will be created — re-run after.
// ============================================================
async function evaluateSeatClassifications() {
    console.log('\n=== Step 11: Evaluating Seat Classifications (RULE_V1_SEAT_STATUS) ===');
    const session = driver.session();
    const nodeProvenance = buildNodeProvenance('RULE_V1_SEAT_STATUS', '2026-05-03', null, 'high');

    try {
        const result = await session.run(
            `MATCH (ls:LokSabhaConstituency)-[:HAS_RESULT]->(er:ElectionResult)
             WHERE er.election_id = 'LS2024' AND er.margin_pct IS NOT NULL
             RETURN ls.ls_id AS ls_id,
                    toFloat(er.margin_pct) AS margin_pct,
                    er.winner_party_id AS winner_party_id`
        );

        if (result.records.length === 0) {
            console.log('  ⚠ No LS2024 ElectionResult nodes found — run import_tcpd.js first, then re-run this script');
            return;
        }

        let created = 0;
        for (const record of result.records) {
            const ls_id = record.get('ls_id');
            const margin_pct = record.get('margin_pct');
            const winner_party_id = record.get('winner_party_id') || 'unknown';

            const seat_status = margin_pct < 2 ? 'tossup'
                              : margin_pct < 5 ? 'competitive'
                              : 'safe';

            const classification_id = `SC-${ls_id}-LS2024`;

            await session.run(
                `MERGE (sc:SeatClassification {classification_id: $classification_id})
                 SET sc.constituency_id  = $ls_id,
                     sc.election_id      = 'LS2024',
                     sc.seat_status      = $seat_status,
                     sc.margin_pct       = $margin_pct,
                     sc.incumbent_party  = $winner_party_id,
                     sc.rule_version     = 'RULE_V1_SEAT_STATUS',
                     sc.source           = $source,
                     sc.source_date      = date($source_date),
                     sc.ingested_at      = datetime($ingested_at),
                     sc.confidence       = $confidence
                 WITH sc
                 MATCH (ls:LokSabhaConstituency {ls_id: $ls_id})
                 MERGE (ls)-[:HAS_CLASSIFICATION]->(sc)
                 WITH sc
                 MATCH (rd:RuleDefinition {rule_id: 'RULE_V1_SEAT_STATUS'})
                 MERGE (sc)-[:TRIGGERED_BY]->(rd)`,
                { classification_id, ls_id, seat_status, margin_pct, winner_party_id, ...nodeProvenance }
            );
            created++;
        }
        console.log(`  ✓ Created/updated ${created} SeatClassification nodes`);
        const tossup     = result.records.filter(r => r.get('margin_pct') <  2).length;
        const competitive = result.records.filter(r => r.get('margin_pct') >= 2 && r.get('margin_pct') < 5).length;
        const safe       = result.records.filter(r => r.get('margin_pct') >= 5).length;
        console.log(`    tossup: ${tossup}  competitive: ${competitive}  safe: ${safe}`);

    } catch (err) {
        console.log(`  ! Error evaluating seat classifications: ${err.message}`);
    } finally {
        await session.close();
    }
}

// ============================================================
// STEP 12: Verify counts
// ============================================================
async function verifyCounts() {
    console.log('\n=== Step 12: Verification ===');

    const queries = [
        ['District', 'MATCH (d:District) RETURN count(d) AS count'],
        ['LokSabhaConstituency', 'MATCH (ls:LokSabhaConstituency) RETURN count(ls) AS count'],
        ['VidhanSabhaConstituency', 'MATCH (vs:VidhanSabhaConstituency) RETURN count(vs) AS count'],
        ['Party', 'MATCH (p:Party) RETURN count(p) AS count'],
        ['Alliance', 'MATCH (a:Alliance) RETURN count(a) AS count'],
        ['Election', 'MATCH (e:Election) RETURN count(e) AS count'],
        ['Candidate', 'MATCH (c:Candidate) RETURN count(c) AS count'],
        ['ElectionResult', 'MATCH (er:ElectionResult) RETURN count(er) AS count'],
        ['Turnout', 'MATCH (t:Turnout) RETURN count(t) AS count'],
        ['Issue', 'MATCH (i:Issue) RETURN count(i) AS count'],
        ['Affidavit', 'MATCH (aff:Affidavit) RETURN count(aff) AS count'],
        ['Scheme', 'MATCH (s:Scheme) RETURN count(s) AS count'],
        ['SchemeDelivery', 'MATCH (sd:SchemeDelivery) RETURN count(sd) AS count'],
        ['IssueObservation', 'MATCH (io:IssueObservation) RETURN count(io) AS count'],
        ['SeatClassification', 'MATCH (sc:SeatClassification) RETURN count(sc) AS count'],
        ['DecisionRecommendation', 'MATCH (dr:DecisionRecommendation) RETURN count(dr) AS count'],
        ['RuleDefinition', 'MATCH (rd:RuleDefinition) RETURN count(rd) AS count'],
        ['MediaTopic', 'MATCH (mt:MediaTopic) RETURN count(mt) AS count'],
        ['HAS_VS links', 'MATCH ()-[:HAS_VS]->() RETURN count(*) AS count'],
        ['CONTAINS links', 'MATCH ()-[:CONTAINS]->() RETURN count(*) AS count'],
        ['HAS_TURNOUT links', 'MATCH ()-[:HAS_TURNOUT]->() RETURN count(*) AS count'],
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
        requireEnv('NEO4J_PASSWORD', PASSWORD);
        await createConstraints();
        await createStateNode();
        await importDistricts();
        await importConstituencies();
        await importElections();
        await importIssues();
        await importConstituencyResults();
        await importTurnout();
        await importAffidavits();
        await importRules();
        await importSchemes();
        await evaluateSeatClassifications();
        await verifyCounts();

        console.log('\n✓ Import complete!');
    } catch (err) {
        console.error('\n✗ Import failed:', err.message);
    } finally {
        await driver.close();
    }
}

main();
