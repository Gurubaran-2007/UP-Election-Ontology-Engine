// query_districts.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic('neo4j', process.env.NEO4J_PASSWORD), { encrypted: 'ENCRYPTION_OFF' });

async function main() {
    const s = driver.session();
    
    // Check what we have
    console.log('=== Districts with LS Results (LS2024) ===');
    const r = await s.run(`
        MATCH (d:District)-[:HAS_LOK_SABHA_SEAT]->(ls:LokSabhaConstituency)
        MATCH (ls)-[:HAS_RESULT {election_id: 'LS2024'}]->(er)
        RETURN d.name, count(ls) AS seats, 
               collect(er.winner_party_id)[0..2] AS parties,
               avg(er.winner_vote_share) AS avg_share
        ORDER BY d.name LIMIT 15
    `);
    r.records.forEach(rec => {
        const parties = rec.get(2).join(', ');
        console.log(`${rec.get(0)}: ${rec.get(1)} seats, ${parties ? parties : 'N/A'}, ${rec.get(3)?.toFixed(1)}%`);
    });
    
    // Check specific fields
    console.log('\n=== Sample Constituency Details ===');
    const r2 = await s.run(`
        MATCH (ls:LokSabhaConstituency {ls_id: 'UP-1'})
        MATCH (ls)-[:HAS_RESULT {election_id: 'LS2024'}]->(er)
        RETURN ls.name, er.winner, er.winner_party_id, er.winner_vote_share, er.margin_pct
    `);
    r2.records.forEach(rec => {
        console.log(`${rec.get(0)}: Winner=${rec.get(1)} (${rec.get(2)}), ${rec.get(3)?.toFixed(1)}% votes, margin ${rec.get(4)?.toFixed(2)}%`);
    });
    
    await s.close();
    await driver.close();
}

main();