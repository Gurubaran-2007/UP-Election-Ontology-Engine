// run_import.js - Updated import with consistent parameters
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const neo4j = require('neo4j-driver');
const fs = require('fs');
const path = require('path');

console.log('==========================================');
console.log(' UP Election Ontology — Neo4j Import');
console.log('==========================================');

const URI = process.env.NEO4J_URI || 'neo4j://localhost:7687';
const USER = process.env.NEO4J_USER || 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD;

if (!PASSWORD) { console.log('✗ NEO4J_PASSWORD required'); process.exit(1); }

const DATA_DIR = path.join(__dirname, '..', 'data');
const isCloud = URI.startsWith('neo4j+s');
const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD), isCloud ? {} : { encrypted: 'ENCRYPTION_OFF' });

async function runCypher(cypher, params = {}) {
    const session = driver.session();
    try { return await session.run(cypher, params); }
    finally { await session.close(); }
}

function toPartyId(name) {
    const n = String(name || '').trim().toLowerCase();
    const m = { 'bharatiya janata party': 'bjp', 'samajwadi party': 'sp', 'bahujan samaj party': 'bsp', 'indian national congress': 'inc', 'none of the above': 'nota' };
    return m[n] || n.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'other';
}

async function importResults(electionId, fileName) {
    console.log(`\n=== Importing ${electionId} Results ===`);
    const filePath = path.join(DATA_DIR, 'states', 'UP', fileName);
    if (!fs.existsSync(filePath)) { console.log('  ✗ Not found'); return; }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    const byPC = new Map();
    
    for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',');
        const row = {}; headers.forEach((h, idx) => row[h] = vals[idx] || '');
        const pcNo = row['Constituency_No']; if (!pcNo) continue;
        if (!byPC.has(pcNo)) byPC.set(pcNo, { name: row['Constituency_Name'], rows: [] });
        byPC.get(pcNo).rows.push({ cand: row['Candidate'], party: row['Party'], votes: parseInt(row['Votes']) || 0, pos: parseInt(row['Position']) || 0, sex: row['Sex'] });
    }
    
    let candCount = 0, resCount = 0;
    for (const [pcNo, data] of byPC) {
        const ls_id = `UP-${pcNo}`;
        const sorted = data.rows.sort((a, b) => b.votes - a.votes);
        const total = sorted.reduce((s, r) => s + r.votes, 0);
        const w = sorted[0], r = sorted[1];
        const marginV = w.votes - (r?.votes || 0);
        const marginP = total > 0 ? (marginV / total) * 100 : 0;
        const wShare = total > 0 ? (w.votes / total) * 100 : 0;
        
        // ElectionResult
        await runCypher(`MERGE (er:ElectionResult {result_id: $rid})
         SET er.election_id = $eid, er.constituency_id = $ls_id, er.winner = $w, er.winner_party_id = $wpid,
             er.winner_votes = $wv, er.winner_vote_share = $wvs, er.runner_up = $r, er.runner_up_party_id = $rpid,
             er.runner_up_votes = $rv, er.margin_votes = $mv, er.margin_pct = $mp,
             er.total_valid_votes = $tv, er.source = 'ECI', er.confidence = 'high'
         WITH er MATCH (ls:LokSabhaConstituency {ls_id: $ls_id}) MERGE (ls)-[:HAS_RESULT {election_id: $eid}]->(er)`,
            { rid: `${electionId}_PC${pcNo}`, eid: electionId, ls_id, w: w?.cand, wpid: toPartyId(w?.party), wv: w?.votes, wvs: wShare, r: r?.cand, rpid: toPartyId(r?.party), rv: r?.votes, mv: marginV, mp: marginP, tv: total });
        
        // Candidates
        for (let i = 0; i < sorted.length; i++) {
            const c = sorted[i], pid = toPartyId(c.party), sn = c.cand.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
            const cid = `CAND_${electionId}_PC${pcNo}_${sn}_${pid}`;
            const vs = total > 0 ? (c.votes / total) * 100 : 0;
            
            await runCypher(`MERGE (c:Candidate {cand_id: $cid}) SET c.name = $n, c.party_id = $pid, c.election_id = $eid, c.constituency_id = $ls_id, c.votes = $v, c.vote_share = $vs, c.rank = $rk, c.gender = $g, c.source = 'ECI', c.confidence = 'high'`,
                { cid, n: c.cand, pid, eid: electionId, ls_id, v: c.votes, vs, rk: i + 1, g: c.sex || null });
            await runCypher(`MATCH (c:Candidate {cand_id: $cid}) MATCH (ls:LokSabhaConstituency {ls_id: $ls_id}) MERGE (c)-[:CONTESTS_IN {election_id: $eid, vote_share: $vs, rank: $rk}]->(ls)`,
                { cid, ls_id, eid: electionId, vs, rk: i + 1 });
            await runCypher(`MATCH (c:Candidate {cand_id: $cid}) MATCH (p:Party {party_id: $pid}) MERGE (c)-[:BELONGS_TO {since: ${electionId === 'LS2019' ? 2019 : 2024}}]->(p)`,
                { cid, pid });
            candCount++;
        }
        resCount++;
    }
    console.log(`  ✓ ${candCount} candidates, ${resCount} results`);
}

async function importTurnout(electionId, fileName) {
    console.log(`\n=== Importing ${electionId} Turnout ===`);
    const fp = path.join(DATA_DIR, 'states', 'UP', fileName);
    if (!fs.existsSync(fp)) { console.log('  ✗ Not found'); return; }
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    let count = 0;
    for (const t of data) {
        await runCypher(`MERGE (turn:Turnout {turnout_id: $tid}) SET turn.election_id = $eid, turn.constituency_id = $ls_id, turn.registered_voters = $reg, turn.votes_cast = $cast, turn.turnout_pct = $pct, turn.source = 'ECI', turn.confidence = 'high'
         WITH turn MATCH (ls:LokSabhaConstituency {ls_id: $ls_id}) MERGE (ls)-[:HAS_TURNOUT {election_id: $eid}]->(turn)`,
            { tid: `TURNOUT_${electionId}_PC${t.pc_code}`, eid: electionId, ls_id: t.ls_id, reg: t.registered_voters, cast: t.votes_cast, pct: t.turnout_pct });
        count++;
    }
    console.log(`  ✓ ${count} turnout nodes`);
}

async function classifySeats() {
    console.log('\n=== Seat Classifications ===');
    for (const eid of ['LS2019', 'LS2024']) {
        const res = await runCypher(`MATCH (ls:LokSabhaConstituency)-[:HAS_RESULT {election_id: $eid}]->(er:ElectionResult) RETURN ls.ls_id AS lid, er.margin_pct AS mp`, { eid });
        if (res.records.length === 0) continue;
        for (const rec of res.records) {
            const lid = rec.get('lid'), mp = rec.get('mp') || 0;
            let st = 'safe'; if (mp < 2) st = 'tossup'; else if (mp < 5) st = 'competitive'; else if (mp < 15) st = 'leaning';
            await runCypher(`MERGE (sc:SeatClassification {classification_id: $cid}) SET sc.election_id = $eid, sc.seat_status = $st, sc.rule_version = 'v1.0', sc.computed_at = datetime(), sc.source = 'RULE_ENGINE'
             WITH sc MATCH (ls:LokSabhaConstituency {ls_id: $lid}) MERGE (ls)-[:CLASSIFIES]->(sc)`,
                { cid: `SC_${eid}_${lid}`, eid, st, lid });
        }
        console.log(`  ✓ ${res.records.length} seats classified for ${eid}`);
    }
}

async function main() {
    try {
        await importResults('LS2019', 'ls2019_results.csv');
        await importResults('LS2024', 'ls2024_results.csv');
        await importTurnout('LS2019', 'ls2019_turnout.json');
        await importTurnout('LS2024', 'ls2024_turnout.json');
        await classifySeats();
        console.log('\n==========================================');
        console.log(' ✓ Import Complete!');
        console.log('==========================================');
    } catch (err) { console.error('Error:', err.message); }
    finally { await driver.close(); }
}

main();