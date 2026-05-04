// verify_import.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
    { encrypted: 'ENCRYPTION_OFF' }
);

async function main() {
    const session = driver.session();
    
    // Check results
    const r1 = await session.run(`MATCH (ls:LokSabhaConstituency)-[:HAS_RESULT {election_id: 'LS2024'}]->(er) RETURN ls.name, er.winner, er.winner_party_id, er.margin_pct ORDER BY er.margin_pct LIMIT 10`);
    console.log('LS2024 Competitive Seats:');
    r1.records.forEach(rec => console.log(`  ${rec.get(0)}: ${rec.get(1)} (${rec.get(2)}) - ${rec.get(3).toFixed(2)}%`));
    
    // Check turnout
    const r2 = await session.run(`MATCH (ls:LokSabhaConstituency)-[:HAS_TURNOUT {election_id: 'LS2024'}]->(t) RETURN ls.name, t.registered_voters, t.turnout_pct LIMIT 5`);
    console.log('\nLS2024 Turnout Sample:');
    r2.records.forEach(rec => console.log(`  ${rec.get(0)}: ${rec.get(1)?.toLocaleString()} voters, ${rec.get(2).toFixed(1)}%`));
    
    // Check seat classifications
    const r3 = await session.run(`MATCH (sc:SeatClassification) RETURN sc.seat_status, count(*) ORDER BY count(*) DESC`);
    console.log('\nSeat Classifications:');
    r3.records.forEach(rec => console.log(`  ${rec.get(0)}: ${rec.get(1)}`));
    
    // Summary counts
    const counts = await session.run(`MATCH (n) RETURN labels(n)[0] AS type, count(*) AS cnt`);
    console.log('\nGraph Summary:');
    counts.records.forEach(rec => console.log(`  ${rec.get(0)}: ${rec.get(1)}`));
    
    await session.close();
    await driver.close();
}

main();