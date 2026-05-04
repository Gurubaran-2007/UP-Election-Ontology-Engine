// check_district_data.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic('neo4j', process.env.NEO4J_PASSWORD), { encrypted: 'ENCRYPTION_OFF' });

async function main() {
    const s = driver.session();
    
    // 1. Districts with constituency count
    const r1 = await s.run(`MATCH (d:District)-[:CONTAINS]->(ls:LokSabhaConstituency) RETURN d.name, count(*) ORDER BY d.name`);
    console.log('Districts with LS seats:');
    r1.records.slice(0, 10).forEach(rec => console.log(`  ${rec.get(0)}: ${rec.get(1)} seats`));
    
    // 2. District -> LS -> Results
    const r2 = await s.run(`
        MATCH (d:District)-[:CONTAINS]->(ls)
        MATCH (ls)-[:HAS_RESULT {election_id: 'LS2024'}]->(er)
        RETURN d.name, count(ls) AS seats, 
               collect(er.winner_party_id)[0..2] AS parties,
               avg(er.winner_vote_share) AS avg_share
        ORDER BY d.name LIMIT 10
    `);
    console.log('\nDistrict winner analysis (LS2024):');
    r2.records.forEach(rec => console.log(`  ${rec.get(0)}: ${rec.get(1)} seats, avg ${rec.get(3)?.toFixed(1)}%`));
    
    await s.close();
    await driver.close();
}

main();