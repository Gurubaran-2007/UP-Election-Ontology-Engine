// import_tcpd.js — Import TCPD Lok Dhaba data into Neo4j
//
// Usage:
//   node scripts/import_tcpd.js --election LS2019   (ElectionResult + Candidate + Turnout for 80 LS seats)
//   node scripts/import_tcpd.js --election VS2022   (ElectionResult + Candidate + Turnout for 403 VS seats)
//
// Input files (data/eci/):
//   up_ls2019_results.csv  → LS2019 (extracted from TCPD_GE gz, year=2019 only)
//   up_vs2022_results.csv  → VS2022 (extracted from TCPD_AE gz, year=2022 only)

require('dotenv').config();
const neo4j = require('neo4j-driver');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const URI      = process.env.NEO4J_URI      || 'neo4j://localhost:7687';
const USER     = process.env.NEO4J_USER     || 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD;

if (!PASSWORD) {
    console.error('✗ NEO4J_PASSWORD environment variable is not set. Refusing to run.');
    process.exit(1);
}

const DATA_DIR = path.join(__dirname, '..', 'data', 'eci');

// ── Config per election ──────────────────────────────────────────────────────

const ELECTION_CONFIG = {
    LS2019: {
        file:        'up_ls2019_results.csv',
        year:        '2019',
        election_id: 'LS2019',
        node_label:  'LokSabhaConstituency',
        id_field:    'ls_id',
        id_prefix:   'UP-',
        source:      'TCPD_LOK_DHABA_GE',
        source_date: '2019-05-23',
        confidence:  'medium',
    },
    VS2022: {
        file:        'up_vs2022_results.csv',
        year:        '2022',
        election_id: 'VS2022',
        node_label:  'VidhanSabhaConstituency',
        id_field:    'vs_id',
        id_prefix:   'UP-VS-',
        source:      'TCPD_LOK_DHABA_AE',
        source_date: '2022-03-10',
        confidence:  'medium',
    },
    LS2024: {
        file:        'up_ls2024_results.csv',
        year:        '2024',
        election_id: 'LS2024',
        node_label:  'LokSabhaConstituency',
        id_field:    'ls_id',
        id_prefix:   'UP-',
        source:      'OPENCITY_IN_ECI_2024',
        source_date: '2024-06-04',
        confidence:  'medium',
    },
};

// ── TCPD party name → project party_id ──────────────────────────────────────

const PARTY_MAP = {
    'BJP':  'bjp',
    'INC':  'inc',
    'BSP':  'bsp',
    'SP':   'sp',
    'AAP':  'aap',
    'NOTA': 'nota',
    'IND':  'ind',
};

function normalizePartyId(rawParty) {
    if (!rawParty) return 'other';
    return PARTY_MAP[rawParty.trim().toUpperCase()] || rawParty.trim().toLowerCase().replace(/\s+/g, '_');
}

function normalizeGender(sex) {
    if (sex === 'M') return 'M';
    if (sex === 'F') return 'F';
    return 'OTHER';
}

// ── CSV reader ────────────────────────────────────────────────────────────────

async function readCsv(filePath, onRow) {
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filePath);
        const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

        let headers = null;
        let rowCount = 0;

        rl.on('line', (line) => {
            if (!line.trim()) return;
            if (!headers) {
                headers = line.split(',');
                return;
            }
            const values = line.split(',');
            const row = {};
            headers.forEach((h, i) => { row[h.trim()] = (values[i] || '').trim(); });
            onRow(row);
            rowCount++;
        });

        rl.on('close', () => {
            console.log(`  Read ${rowCount} rows from ${path.basename(filePath)}`);
            resolve(rowCount);
        });
        rl.on('error', reject);
    });
}

// ── Group rows by constituency ────────────────────────────────────────────────

function groupByConstituency(rows) {
    const map = new Map();
    for (const row of rows) {
        const no = row['Constituency_No'];
        if (!map.has(no)) map.set(no, []);
        map.get(no).push(row);
    }
    return map;
}

// ── Neo4j helpers ─────────────────────────────────────────────────────────────

const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD),
    URI.startsWith('neo4j+s') ? {} : { encrypted: 'ENCRYPTION_OFF' }
);

async function runCypher(cypher, params = {}) {
    const session = driver.session();
    try {
        return await session.run(cypher, params);
    } finally {
        await session.close();
    }
}

// ── Validate required columns exist ──────────────────────────────────────────

function validateColumns(sampleRow, required) {
    const missing = required.filter(c => !(c in sampleRow));
    if (missing.length > 0) {
        console.error(`✗ Missing required columns: ${missing.join(', ')}`);
        console.error('  Available columns:', Object.keys(sampleRow).join(', '));
        process.exit(1);
    }
    console.log('  ✓ All required columns present');
}

// ── LS2019: Turnout nodes + ElectionResult backfill ──────────────────────────

async function importLS2019(cfg) {
    console.log('\n=== Importing LS2019 Turnout + ElectionResult backfill ===');

    const rows = [];
    await readCsv(path.join(DATA_DIR, cfg.file), row => rows.push(row));

    if (rows.length === 0) {
        console.error('✗ No rows found. Check the file.');
        return;
    }

    validateColumns(rows[0], ['Constituency_No', 'Electors', 'Valid_Votes', 'Turnout_Percentage',
        'Candidate', 'Party', 'Votes', 'Position', 'Margin', 'Margin_Percentage',
        'Vote_Share_Percentage', 'Constituency_Name']);

    const grouped = groupByConstituency(rows);
    console.log(`  Constituencies found: ${grouped.size}`);

    let turnoutCreated = 0;
    let resultUpdated = 0;
    let candidateCreated = 0;

    for (const [constNo, constRows] of grouped) {
        const lsId = `UP-${constNo}`;
        const sample = constRows[0];

        const electors     = parseInt(sample['Electors']) || null;
        const validVotes   = parseInt(sample['Valid_Votes']) || null;
        const turnoutPct   = parseFloat(sample['Turnout_Percentage']) || null;
        const constName    = sample['Constituency_Name'];

        // Winner row (Position = 1)
        const winnerRow    = constRows.find(r => r['Position'] === '1');
        // Runner-up row (Position = 2, excluding NOTA)
        const runnerUpRow  = constRows.find(r => r['Position'] === '2' && r['Party'] !== 'NOTA');
        // NOTA row
        const notaRow      = constRows.find(r => r['Party'] === 'NOTA');

        if (!winnerRow) {
            console.log(`  ✗ No winner row for ${lsId} (${constName}), skipping`);
            continue;
        }

        const marginVotes  = parseInt(winnerRow['Margin']) || null;
        const marginPct    = parseFloat(winnerRow['Margin_Percentage']) || null;
        const winnerShare  = parseFloat(winnerRow['Vote_Share_Percentage']) || null;
        const notaVotes    = notaRow ? parseInt(notaRow['Votes']) || null : null;

        // 1. Create / update Turnout node
        await runCypher(`
            MERGE (t:Turnout {turnout_id: $turnout_id})
            SET t.election_id        = $election_id,
                t.constituency_id    = $ls_id,
                t.registered_voters  = $electors,
                t.votes_cast         = $valid_votes,
                t.turnout_pct        = $turnout_pct,
                t.source             = $source,
                t.source_date        = date($source_date),
                t.ingested_at        = datetime(),
                t.confidence         = $confidence
            WITH t
            MATCH (ls:LokSabhaConstituency {ls_id: $ls_id})
            MERGE (ls)-[:HAS_TURNOUT {election_id: $election_id, source: $source}]->(t)
        `, {
            turnout_id:   `TURNOUT_LS2019_${lsId}`,
            election_id:  cfg.election_id,
            ls_id:        lsId,
            electors:     electors ? neo4j.int(electors) : null,
            valid_votes:  validVotes ? neo4j.int(validVotes) : null,
            turnout_pct:  turnoutPct,
            source:       cfg.source,
            source_date:  cfg.source_date,
            confidence:   cfg.confidence,
        });
        turnoutCreated++;

        // 2. Backfill missing fields on existing ElectionResult node
        const runnerUpName    = runnerUpRow ? runnerUpRow['Candidate'] : null;
        const runnerUpPartyId = runnerUpRow ? normalizePartyId(runnerUpRow['Party']) : null;
        const runnerUpVotes   = runnerUpRow ? (parseInt(runnerUpRow['Votes']) || null) : null;
        const votesJson       = constRows.map(r => ({
            candidate:  r['Candidate'],
            party:      r['Party'],
            votes:      parseInt(r['Votes']) || 0,
            vote_share: parseFloat(r['Vote_Share_Percentage']) || 0,
        }));

        await runCypher(`
            MATCH (er:ElectionResult {result_id: $result_id})
            SET er.margin_votes        = $margin_votes,
                er.margin_pct          = $margin_pct,
                er.winner_vote_share   = $winner_share,
                er.runner_up           = $runner_up,
                er.runner_up_party_id  = $runner_up_party_id,
                er.runner_up_votes     = $runner_up_votes,
                er.nota_votes          = $nota_votes,
                er.total_valid_votes   = $valid_votes,
                er.all_candidates_json = $all_candidates_json,
                er.source_date         = date($source_date),
                er.ingested_at         = datetime()
        `, {
            result_id:           `LS2019_PC${constNo}`,
            margin_votes:        marginVotes ? neo4j.int(marginVotes) : null,
            margin_pct:          marginPct,
            winner_share:        winnerShare,
            runner_up:           runnerUpName,
            runner_up_party_id:  runnerUpPartyId,
            runner_up_votes:     runnerUpVotes ? neo4j.int(runnerUpVotes) : null,
            nota_votes:          notaVotes ? neo4j.int(notaVotes) : null,
            valid_votes:         validVotes ? neo4j.int(validVotes) : null,
            all_candidates_json: JSON.stringify(votesJson),
            source_date:         cfg.source_date,
        });
        resultUpdated++;

        // 3. Create Candidate nodes for all candidates (including NOTA)
        for (const row of constRows) {
            if (row['Party'] === 'NOTA') continue; // NOTA is not a candidate node
            const candName  = row['Candidate'];
            const candId    = `LS2019_PC${constNo}_${candName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '')}`;

            await runCypher(`
                MERGE (c:Candidate {cand_id: $cand_id})
                SET c.name           = $name,
                    c.party_id       = $party_id,
                    c.election_id    = $election_id,
                    c.constituency_id= $ls_id,
                    c.votes          = $votes,
                    c.vote_share     = $vote_share,
                    c.rank           = $rank,
                    c.gender         = $gender,
                    c.education      = $education,
                    c.incumbent      = $incumbent,
                    c.source         = $source,
                    c.source_date    = date($source_date),
                    c.ingested_at    = datetime(),
                    c.confidence     = $confidence
                WITH c
                MATCH (ls:LokSabhaConstituency {ls_id: $ls_id})
                MERGE (c)-[:CONTESTS_IN {election_id: $election_id, votes: $votes, rank: $rank}]->(ls)
                FOREACH (_ IN CASE WHEN $incumbent THEN [1] ELSE [] END |
                    MERGE (c)-[:IS_INCUMBENT_IN {election_id: $election_id}]->(ls)
                )
                WITH c
                MATCH (p:Party {party_id: $party_id})
                MERGE (c)-[:BELONGS_TO]->(p)
            `, {
                cand_id:      candId,
                name:         candName,
                party_id:     normalizePartyId(row['Party']),
                election_id:  cfg.election_id,
                ls_id:        lsId,
                votes:        neo4j.int(parseInt(row['Votes']) || 0),
                vote_share:   parseFloat(row['Vote_Share_Percentage']) || null,
                rank:         neo4j.int(parseInt(row['Position']) || 0),
                gender:       normalizeGender(row['Sex']),
                education:    row['MyNeta_education'] || null,
                incumbent:    row['Incumbent'] === 'TRUE',
                source:       cfg.source,
                source_date:  cfg.source_date,
                confidence:   cfg.confidence,
            });
            candidateCreated++;
        }
    }

    console.log(`\n  ✓ Turnout nodes created/updated: ${turnoutCreated}`);
    console.log(`  ✓ ElectionResult nodes backfilled: ${resultUpdated}`);
    console.log(`  ✓ Candidate nodes created: ${candidateCreated}`);
}

// ── VS2022: Full results import ───────────────────────────────────────────────

async function importVS2022(cfg) {
    console.log('\n=== Importing VS2022 Full Results ===');

    const rows = [];
    await readCsv(path.join(DATA_DIR, cfg.file), row => rows.push(row));

    if (rows.length === 0) {
        console.error('✗ No rows found. Check the file.');
        return;
    }

    validateColumns(rows[0], ['Constituency_No', 'Electors', 'Valid_Votes', 'Turnout_Percentage',
        'Candidate', 'Party', 'Votes', 'Position', 'Margin', 'Margin_Percentage',
        'Vote_Share_Percentage', 'Constituency_Name', 'District_Name']);

    const grouped = groupByConstituency(rows);
    console.log(`  Constituencies found: ${grouped.size}`);

    let turnoutCreated = 0;
    let resultCreated  = 0;
    let candidateCreated = 0;
    let skipped = 0;

    for (const [constNo, constRows] of grouped) {
        const vsId   = `UP-VS-${constNo}`;
        const sample = constRows[0];

        const electors    = parseInt(sample['Electors']) || null;
        const validVotes  = parseInt(sample['Valid_Votes']) || null;
        const turnoutPct  = parseFloat(sample['Turnout_Percentage']) || null;
        const constName   = sample['Constituency_Name'];

        const winnerRow   = constRows.find(r => r['Position'] === '1');
        const runnerUpRow = constRows.find(r => r['Position'] === '2' && r['Party'] !== 'NOTA');
        const notaRow     = constRows.find(r => r['Party'] === 'NOTA');

        if (!winnerRow) {
            console.log(`  ✗ No winner for VS ${vsId} (${constName}), skipping`);
            skipped++;
            continue;
        }

        const marginVotes = parseInt(winnerRow['Margin']) || null;
        const marginPct   = parseFloat(winnerRow['Margin_Percentage']) || null;
        const winnerShare = parseFloat(winnerRow['Vote_Share_Percentage']) || null;
        const notaVotes   = notaRow ? parseInt(notaRow['Votes']) || null : null;

        // 1. Create Turnout node
        await runCypher(`
            MERGE (t:Turnout {turnout_id: $turnout_id})
            SET t.election_id       = $election_id,
                t.constituency_id   = $vs_id,
                t.registered_voters = $electors,
                t.votes_cast        = $valid_votes,
                t.turnout_pct       = $turnout_pct,
                t.source            = $source,
                t.source_date       = date($source_date),
                t.ingested_at       = datetime(),
                t.confidence        = $confidence
            WITH t
            MATCH (vs:VidhanSabhaConstituency {vs_id: $vs_id})
            MERGE (vs)-[:HAS_TURNOUT {election_id: $election_id, source: $source}]->(t)
        `, {
            turnout_id:  `TURNOUT_VS2022_${vsId}`,
            election_id: cfg.election_id,
            vs_id:       vsId,
            electors:    electors ? neo4j.int(electors) : null,
            valid_votes: validVotes ? neo4j.int(validVotes) : null,
            turnout_pct: turnoutPct,
            source:      cfg.source,
            source_date: cfg.source_date,
            confidence:  cfg.confidence,
        });
        turnoutCreated++;

        // 2. Create ElectionResult node
        const resultId      = `VS2022_${vsId}`;
        const runnerUpName  = runnerUpRow ? runnerUpRow['Candidate'] : null;
        const runnerUpParty = runnerUpRow ? normalizePartyId(runnerUpRow['Party']) : null;
        const runnerUpVotes = runnerUpRow ? (parseInt(runnerUpRow['Votes']) || null) : null;
        const votesJson     = constRows.map(r => ({
            candidate: r['Candidate'],
            party: r['Party'],
            votes: parseInt(r['Votes']) || 0,
            vote_share: parseFloat(r['Vote_Share_Percentage']) || 0
        }));

        await runCypher(`
            MERGE (er:ElectionResult {result_id: $result_id})
            SET er.election_id        = $election_id,
                er.constituency_id    = $vs_id,
                er.all_candidates_json = $all_candidates_json,
                er.winner             = $winner,
                er.winner_party_id    = $winner_party_id,
                er.winner_votes       = $winner_votes,
                er.winner_vote_share  = $winner_share,
                er.runner_up          = $runner_up,
                er.runner_up_party_id = $runner_up_party_id,
                er.runner_up_votes    = $runner_up_votes,
                er.margin_votes       = $margin_votes,
                er.margin_pct         = $margin_pct,
                er.total_valid_votes  = $valid_votes,
                er.nota_votes         = $nota_votes,
                er.source             = $source,
                er.source_url         = $source_url,
                er.source_date        = date($source_date),
                er.ingested_at        = datetime(),
                er.confidence         = $confidence
            WITH er
            MATCH (vs:VidhanSabhaConstituency {vs_id: $vs_id})
            MERGE (vs)-[:HAS_RESULT {election_id: $election_id, source: $source}]->(er)
            WITH er
            MATCH (e:Election {election_id: $election_id})
            MERGE (er)-[:PART_OF]->(e)
        `, {
            result_id:           resultId,
            election_id:         cfg.election_id,
            vs_id:               vsId,
            all_candidates_json: JSON.stringify(votesJson),
            winner:              winnerRow['Candidate'],
            winner_party_id:     normalizePartyId(winnerRow['Party']),
            winner_votes:        neo4j.int(parseInt(winnerRow['Votes']) || 0),
            winner_share:        winnerShare,
            runner_up:           runnerUpName,
            runner_up_party_id:  runnerUpParty,
            runner_up_votes:     runnerUpVotes ? neo4j.int(runnerUpVotes) : null,
            margin_votes:        marginVotes ? neo4j.int(marginVotes) : null,
            margin_pct:          marginPct,
            valid_votes:         validVotes ? neo4j.int(validVotes) : null,
            nota_votes:          notaVotes ? neo4j.int(notaVotes) : null,
            source:              cfg.source,
            source_url:          'https://lokdhaba.ashoka.edu.in',
            source_date:         cfg.source_date,
            confidence:          cfg.confidence,
        });
        resultCreated++;

        // 3. Create Candidate nodes for all candidates
        for (const row of constRows) {
            if (row['Party'] === 'NOTA') continue;
            const candName = row['Candidate'];
            const candId   = `VS2022_${vsId}_${candName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '')}`;

            await runCypher(`
                MERGE (c:Candidate {cand_id: $cand_id})
                SET c.name            = $name,
                    c.party_id        = $party_id,
                    c.election_id     = $election_id,
                    c.constituency_id = $vs_id,
                    c.votes           = $votes,
                    c.vote_share      = $vote_share,
                    c.rank            = $rank,
                    c.gender          = $gender,
                    c.education       = $education,
                    c.incumbent       = $incumbent,
                    c.source          = $source,
                    c.source_date     = date($source_date),
                    c.ingested_at     = datetime(),
                    c.confidence      = $confidence
                WITH c
                MATCH (vs:VidhanSabhaConstituency {vs_id: $vs_id})
                MERGE (c)-[:CONTESTS_IN {election_id: $election_id, votes: $votes, rank: $rank}]->(vs)
                FOREACH (_ IN CASE WHEN $incumbent THEN [1] ELSE [] END |
                    MERGE (c)-[:IS_INCUMBENT_IN {election_id: $election_id}]->(vs)
                )
                WITH c
                MATCH (p:Party {party_id: $party_id})
                MERGE (c)-[:BELONGS_TO]->(p)
            `, {
                cand_id:     candId,
                name:        candName,
                party_id:    normalizePartyId(row['Party']),
                election_id: cfg.election_id,
                vs_id:       vsId,
                votes:       neo4j.int(parseInt(row['Votes']) || 0),
                vote_share:  parseFloat(row['Vote_Share_Percentage']) || null,
                rank:        neo4j.int(parseInt(row['Position']) || 0),
                gender:      normalizeGender(row['Sex']),
                education:   row['MyNeta_education'] || null,
                incumbent:   row['Incumbent'] === 'TRUE',
                source:      cfg.source,
                source_date: cfg.source_date,
                confidence:  cfg.confidence,
            });
            candidateCreated++;
        }
    }

    console.log(`\n  ✓ Turnout nodes created: ${turnoutCreated}`);
    console.log(`  ✓ ElectionResult nodes created: ${resultCreated}`);
    console.log(`  ✓ Candidate nodes created: ${candidateCreated}`);
    if (skipped > 0) console.log(`  ✗ Skipped (no winner row): ${skipped}`);
}

// ── LS2024: Full results import (LokSabhaConstituency) ───────────────────────

async function importLS2024(cfg) {
    console.log('\n=== Importing LS2024 Full Results ===');

    const rows = [];
    await readCsv(path.join(DATA_DIR, cfg.file), row => rows.push(row));

    if (rows.length === 0) {
        console.error('✗ No rows found. Check the file.');
        return;
    }

    // LS2024 source (opencity.in) has no District_Name column
    validateColumns(rows[0], ['Constituency_No', 'Electors', 'Valid_Votes', 'Turnout_Percentage',
        'Candidate', 'Party', 'Votes', 'Position', 'Margin', 'Margin_Percentage',
        'Vote_Share_Percentage', 'Constituency_Name']);

    const grouped = groupByConstituency(rows);
    console.log(`  Constituencies found: ${grouped.size}`);

    let turnoutCreated   = 0;
    let resultCreated    = 0;
    let candidateCreated = 0;
    let skipped          = 0;

    for (const [constNo, constRows] of grouped) {
        const lsId   = `UP-${constNo}`;
        const sample = constRows[0];

        const electors   = parseInt(sample['Electors']) || null;
        const validVotes = parseInt(sample['Valid_Votes']) || null;
        const turnoutPct = parseFloat(sample['Turnout_Percentage']) || null;
        const constName  = sample['Constituency_Name'];

        const winnerRow   = constRows.find(r => r['Position'] === '1');
        const runnerUpRow = constRows.find(r => r['Position'] === '2' && r['Party'] !== 'NOTA');
        const notaRow     = constRows.find(r => r['Party'] === 'NOTA');

        if (!winnerRow) {
            console.log(`  ✗ No winner for LS ${lsId} (${constName}), skipping`);
            skipped++;
            continue;
        }

        const marginVotes = parseInt(winnerRow['Margin']) || null;
        const marginPct   = parseFloat(winnerRow['Margin_Percentage']) || null;
        const winnerShare = parseFloat(winnerRow['Vote_Share_Percentage']) || null;
        const notaVotes   = notaRow ? parseInt(notaRow['Votes']) || null : null;

        // 1. Create Turnout node
        await runCypher(`
            MERGE (t:Turnout {turnout_id: $turnout_id})
            SET t.election_id       = $election_id,
                t.constituency_id   = $ls_id,
                t.registered_voters = $electors,
                t.votes_cast        = $valid_votes,
                t.turnout_pct       = $turnout_pct,
                t.source            = $source,
                t.source_date       = date($source_date),
                t.ingested_at       = datetime(),
                t.confidence        = $confidence
            WITH t
            MATCH (ls:LokSabhaConstituency {ls_id: $ls_id})
            MERGE (ls)-[:HAS_TURNOUT {election_id: $election_id, source: $source}]->(t)
        `, {
            turnout_id:  `TURNOUT_LS2024_${lsId}`,
            election_id: cfg.election_id,
            ls_id:       lsId,
            electors:    electors ? neo4j.int(electors) : null,
            valid_votes: validVotes ? neo4j.int(validVotes) : null,
            turnout_pct: turnoutPct,
            source:      cfg.source,
            source_date: cfg.source_date,
            confidence:  cfg.confidence,
        });
        turnoutCreated++;

        // 2. Create ElectionResult node
        const resultId      = `LS2024_${lsId}`;
        const runnerUpName  = runnerUpRow ? runnerUpRow['Candidate'] : null;
        const runnerUpParty = runnerUpRow ? normalizePartyId(runnerUpRow['Party']) : null;
        const runnerUpVotes = runnerUpRow ? (parseInt(runnerUpRow['Votes']) || null) : null;
        const votesJson     = constRows.map(r => ({
            candidate:  r['Candidate'],
            party:      r['Party'],
            votes:      parseInt(r['Votes']) || 0,
            vote_share: parseFloat(r['Vote_Share_Percentage']) || 0,
        }));

        await runCypher(`
            MERGE (er:ElectionResult {result_id: $result_id})
            SET er.election_id         = $election_id,
                er.constituency_id     = $ls_id,
                er.all_candidates_json = $all_candidates_json,
                er.winner              = $winner,
                er.winner_party_id     = $winner_party_id,
                er.winner_votes        = $winner_votes,
                er.winner_vote_share   = $winner_share,
                er.runner_up           = $runner_up,
                er.runner_up_party_id  = $runner_up_party_id,
                er.runner_up_votes     = $runner_up_votes,
                er.margin_votes        = $margin_votes,
                er.margin_pct          = $margin_pct,
                er.total_valid_votes   = $valid_votes,
                er.nota_votes          = $nota_votes,
                er.source              = $source,
                er.source_url          = $source_url,
                er.source_date         = date($source_date),
                er.ingested_at         = datetime(),
                er.confidence          = $confidence
            WITH er
            MATCH (ls:LokSabhaConstituency {ls_id: $ls_id})
            MERGE (ls)-[:HAS_RESULT {election_id: $election_id, source: $source}]->(er)
            WITH er
            MATCH (e:Election {election_id: $election_id})
            MERGE (er)-[:PART_OF]->(e)
        `, {
            result_id:           resultId,
            election_id:         cfg.election_id,
            ls_id:               lsId,
            all_candidates_json: JSON.stringify(votesJson),
            winner:              winnerRow['Candidate'],
            winner_party_id:     normalizePartyId(winnerRow['Party']),
            winner_votes:        neo4j.int(parseInt(winnerRow['Votes']) || 0),
            winner_share:        winnerShare,
            runner_up:           runnerUpName,
            runner_up_party_id:  runnerUpParty,
            runner_up_votes:     runnerUpVotes ? neo4j.int(runnerUpVotes) : null,
            margin_votes:        marginVotes ? neo4j.int(marginVotes) : null,
            margin_pct:          marginPct,
            valid_votes:         validVotes ? neo4j.int(validVotes) : null,
            nota_votes:          notaVotes ? neo4j.int(notaVotes) : null,
            source:              cfg.source,
            source_url:          'https://opencity.in',
            source_date:         cfg.source_date,
            confidence:          cfg.confidence,
        });
        resultCreated++;

        // 3. Create Candidate nodes for all candidates
        for (const row of constRows) {
            if (row['Party'] === 'NOTA') continue;
            const candName = row['Candidate'];
            const candId   = `LS2024_${lsId}_${candName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/, '')}`;

            await runCypher(`
                MERGE (c:Candidate {cand_id: $cand_id})
                SET c.name            = $name,
                    c.party_id        = $party_id,
                    c.election_id     = $election_id,
                    c.constituency_id = $ls_id,
                    c.votes           = $votes,
                    c.vote_share      = $vote_share,
                    c.rank            = $rank,
                    c.gender          = $gender,
                    c.incumbent       = $incumbent,
                    c.source          = $source,
                    c.source_date     = date($source_date),
                    c.ingested_at     = datetime(),
                    c.confidence      = $confidence
                WITH c
                MATCH (ls:LokSabhaConstituency {ls_id: $ls_id})
                MERGE (c)-[:CONTESTS_IN {election_id: $election_id, votes: $votes, rank: $rank}]->(ls)
                FOREACH (_ IN CASE WHEN $incumbent THEN [1] ELSE [] END |
                    MERGE (c)-[:IS_INCUMBENT_IN {election_id: $election_id}]->(ls)
                )
                WITH c
                MATCH (p:Party {party_id: $party_id})
                MERGE (c)-[:BELONGS_TO]->(p)
            `, {
                cand_id:     candId,
                name:        candName,
                party_id:    normalizePartyId(row['Party']),
                election_id: cfg.election_id,
                ls_id:       lsId,
                votes:       neo4j.int(parseInt(row['Votes']) || 0),
                vote_share:  parseFloat(row['Vote_Share_Percentage']) || null,
                rank:        neo4j.int(parseInt(row['Position']) || 0),
                gender:      normalizeGender(row['Sex']),
                incumbent:   row['Incumbent'] === 'TRUE',
                source:      cfg.source,
                source_date: cfg.source_date,
                confidence:  cfg.confidence,
            });
            candidateCreated++;
        }
    }

    console.log(`\n  ✓ Turnout nodes created: ${turnoutCreated}`);
    console.log(`  ✓ ElectionResult nodes created: ${resultCreated}`);
    console.log(`  ✓ Candidate nodes created: ${candidateCreated}`);
    if (skipped > 0) console.log(`  ✗ Skipped (no winner row): ${skipped}`);
}

// ── Verification queries ──────────────────────────────────────────────────────

async function verify(electionId) {
    console.log(`\n=== Verification: ${electionId} ===`);
    const checks = [
        [`Turnout nodes`,    `MATCH (t:Turnout {election_id: $id}) RETURN count(t) AS c`],
        [`ElectionResult`,   `MATCH (er:ElectionResult {election_id: $id}) RETURN count(er) AS c`],
        [`Candidate nodes`,  `MATCH (c:Candidate {election_id: $id}) RETURN count(c) AS c`],
        [`margin_pct set`,   `MATCH (er:ElectionResult {election_id: $id}) WHERE er.margin_pct IS NOT NULL RETURN count(er) AS c`],
        [`registered_voters`,`MATCH (t:Turnout {election_id: $id}) WHERE t.registered_voters IS NOT NULL RETURN count(t) AS c`],
    ];
    for (const [label, query] of checks) {
        const r = await runCypher(query, { id: electionId });
        const count = r.records[0]?.get('c')?.toNumber() ?? 0;
        console.log(`  ${count > 0 ? '✓' : '✗'} ${label}: ${count}`);
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    const arg = process.argv.find(a => a.startsWith('--election=') || a === '--election');
    const election = arg?.includes('=') ? arg.split('=')[1] : process.argv[process.argv.indexOf('--election') + 1];

    if (!election || !ELECTION_CONFIG[election]) {
        console.error('Usage: node scripts/import_tcpd.js --election LS2019|VS2022|LS2024');
        process.exit(1);
    }

    const cfg = ELECTION_CONFIG[election];
    const filePath = path.join(DATA_DIR, cfg.file);

    if (!fs.existsSync(filePath)) {
        console.error(`✗ File not found: ${filePath}`);
        process.exit(1);
    }

    console.log(`\nTCPD Import — ${election}`);
    console.log(`File: ${cfg.file}`);
    console.log(`Source confidence: ${cfg.confidence} (upgrade to "high" after QA spot-check)`);

    try {
        if (election === 'LS2019') await importLS2019(cfg);
        if (election === 'VS2022') await importVS2022(cfg);
        if (election === 'LS2024') await importLS2024(cfg);
        await verify(election);
        console.log('\n✓ Done.');
    } catch (err) {
        console.error('\n✗ Import failed:', err.message);
        console.error(err.stack);
    } finally {
        await driver.close();
    }
}

main();
