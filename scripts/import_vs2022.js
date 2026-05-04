// import_vs2022.js - Import VS 2022 results
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const neo4j = require('neo4j-driver');
const fs = require('fs');
const path = require('path');

console.log('==========================================');
console.log(' VS 2022 Results Import');
console.log('==========================================');

const URI = process.env.NEO4J_URI;
const PASSWORD = process.env.NEO4J_PASSWORD;
const driver = neo4j.driver(URI, neo4j.auth.basic('neo4j', PASSWORD), { encrypted: 'ENCRYPTION_OFF' });

async function runCypher(q, p = {}) {
    const s = driver.session();
    try { return await s.run(q, p); }
    finally { await s.close(); }
}

function toPartyId(n) {
    const m = { 'bharatiya janata party': 'bjp', 'samajwadi party': 'sp', 'bahujan samaj party': 'bsp', 'indian national congress': 'inc', 'none of the above': 'nota' };
    return m[n?.toString().toLowerCase().trim()] || n?.toString().toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_|_$/g, '') || 'other';
}

async function main() {
    const filePath = path.join(__dirname, '..', 'data', 'states', 'UP', 'vs2022_results.csv');
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    const hdrs = lines[0].split(',').map(h => h.trim());
    const byAC = new Map(); // Assembly Constituency
    
    for (let i = 1; i < lines.length; i++) {
        const v = lines[i].split(',');
        const r = {}; hdrs.forEach((h, idx) => r[h] = v[idx] || '');
        const acNo = r['Constituency_No'];
        if (!acNo) continue;
        if (!byAC.has(acNo)) byAC.set(acNo, { name: r['Constituency_Name'], rows: [] });
        byAC.get(acNo).rows.push({ c: r['Candidate'], p: r['Party'], v: parseInt(r['Votes']) || 0, pos: parseInt(r['Position']) || 0, s: r['Sex'] });
    }
    
    let cCnt = 0, rCnt = 0;
    const eid = 'VS2022';
    
    for (const [acNo, d] of byAC) {
        const vs_id = `UP-VS-${acNo}`;
        const sorted = d.rows.sort((a, b) => b.v - a.v);
        const total = sorted.reduce((s, r) => s + r.v, 0);
        const w = sorted[0], ru = sorted[1];
        const mv = w.v - (ru?.v || 0);
        const mp = total > 0 ? (mv / total) * 100 : 0;
        const wvs = total > 0 ? (w.v / total) * 100 : 0;
        
        // Create ElectionResult
        await runCypher(`MERGE (er:ElectionResult {result_id: $rid})
         SET er.election_id = $eid, er.constituency_id = $vs_id, er.winner = $w, er.winner_party_id = $wp,
             er.winner_votes = $wv, er.winner_vote_share = $wvs, er.runner_up = $r, er.runner_up_party_id = $rp,
             er.runner_up_votes = $rv, er.margin_votes = $mv, er.margin_pct = $mp,
             er.total_valid_votes = $tv, er.source = 'ECI', er.confidence = 'high'
         WITH er MATCH (vs:VidhanSabhaConstituency {vs_id: $vs_id}) MERGE (vs)-[:HAS_RESULT {election_id: $eid}]->(er)`,
            { rid: `${eid}_AC${acNo}`, eid, vs_id, w: w?.c, wp: toPartyId(w?.p), wv: w?.v, wvs, r: ru?.c, rp: toPartyId(ru?.p), rv: ru?.v, mv, mp, tv: total });
        
        // Create Candidates
        for (let i = 0; i < sorted.length; i++) {
            const c = sorted[i], pid = toPartyId(c.p), sn = c.c.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
            const cid = `CAND_${eid}_AC${acNo}_${sn}_${pid}`;
            const vs = total > 0 ? (c.v / total) * 100 : 0;
            
            await runCypher(`MERGE (c:Candidate {cand_id: $cid}) SET c.name = $n, c.party_id = $pid, c.election_id = $eid, c.constituency_id = $vs_id, c.votes = $v, c.vote_share = $vs, c.rank = $rk, c.gender = $g, c.source = 'ECI', c.confidence = 'high'`,
                { cid, n: c.c, pid, eid, vs_id, v: c.v, vs, rk: i + 1, g: c.s || null });
            await runCypher(`MATCH (c:Candidate {cand_id: $cid}) MATCH (vs:VidhanSabhaConstituency {vs_id: $vs_id}) MERGE (c)-[:CONTESTS_IN {election_id: $eid, vote_share: $vs, rank: $rk}]->(vs)`,
                { cid, vs_id, eid, vs, rk: i + 1 });
            await runCypher(`MATCH (c:Candidate {cand_id: $cid}) MATCH (p:Party {party_id: $pid}) MERGE (c)-[:BELONGS_TO {since: 2022}]->(p)`,
                { cid, pid });
            cCnt++;
        }
        rCnt++;
    }
    console.log(`  ✓ ${cCnt} candidates, ${rCnt} results`);
    
    // Turnout
    console.log('\n=== Importing VS2022 Turnout ===');
    for (const [acNo, d] of byAC) {
        const vs_id = `UP-VS-${acNo}`;
        const total = d.rows.reduce((s, r) => s + r.v, 0);
        const first = d.rows[0];
        const reg = parseInt(first?.Electors) || 0; // Check if Electors in data
        if (reg > 0) {
            const tp = reg > 0 ? (total / reg) * 100 : 0;
            await runCypher(`MERGE (t:Turnout {turnout_id: $tid}) SET t.election_id = $eid, t.constituency_id = $vs_id, t.registered_voters = $reg, t.votes_cast = $cast, t.turnout_pct = $tp, t.source = 'ECI', t.confidence = 'high'
             WITH t MATCH (vs:VidhanSabhaConstituency {vs_id: $vs_id}) MERGE (vs)-[:HAS_TURNOUT {election_id: $eid}]->(t)`,
                { tid: `${eid}_AC${acNo}`, eid, vs_id, reg, cast: total, tp });
        }
    }
    console.log(`  ✓ Turnout imported`);
    
    await driver.close();
    console.log('\n==========================================');
    console.log(' ✓ VS 2022 Import Complete!');
    console.log('==========================================');
}

main();